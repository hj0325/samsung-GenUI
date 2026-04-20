// ============================================================================
//  GENUI PIPELINE v1 (3-step variant) — interpreter → normalizer → planner
//  ---------------------------------------------------------------------------
//  Each step is an INDEPENDENT LLM call. Output JSON of step N is passed
//  verbatim to step N+1. No step invents UI markup.
//
//    STEP 1  scenario_interpreter  scenario_text → {intent, context, tasks,
//                                                   constraints, ui_state}
//    STEP 2  handoff_normalizer    STEP_1 → {planning_summary, task_groups,
//                                            slot_requirements,
//                                            selection_constraints, ui_state}
//    STEP 3  component_selector    STEP_2 → {required_components[],
//                                            planner_notes}
//
//  Plus step_7 explanation_layer (invoked separately).
// ============================================================================

const fs = require('fs');
const path = require('path');
const {
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput
} = require('./schema_normalizer');
const {
  validateContextComponentMatch,
  validateLayoutOverflow,
  buildViolation:  buildLayoutViolation,
  flattenGroups:   _flattenGroups
} = require('./layout_composer');
const Generator = require('./generator');
const DesignMemory = require('./design_memory');

const REGISTRY_PATH = path.join(__dirname, 'figma-refs', 'component_registry.json');
let REGISTRY = null;
try { REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (e) { console.warn('[pipeline] component_registry.json not found or invalid:', e.message); }

// ---------------------------------------------------------------------------
//  Pre-filter: single entry point for allowed-component filtering.
//  Called once before Step 4 (layout composer). Uses Generator's surfaceRules
//  + registry.allowedContexts from DesignMemory. Returns filtered refs array.
// ---------------------------------------------------------------------------
function preFilterComponents(componentRefs, uiState) {
  if (!DesignMemory || !DesignMemory.generatorMemory) return componentRefs;
  return Generator.filterAllowedComponents(uiState, componentRefs, DesignMemory);
}

function allowedComponentTypes() {
  if (!REGISTRY) return [];
  return (REGISTRY.vocabulary && REGISTRY.vocabulary.allowed_types) || Object.keys(REGISTRY.components || {});
}

function allowedSemanticComponentTypes() {
  if (!REGISTRY) return [];
  return (REGISTRY.vocabulary && REGISTRY.vocabulary.semantic_allowed_types) || allowedComponentTypes();
}

// ---------------------------------------------------------------------------
//  STEP 1 — SCENARIO INTERPRETER
// ---------------------------------------------------------------------------

function buildInterpreterPrompt() {
  return `You are a scenario interpreter for a state-based generative UI system.

You must NOT generate UI.
You must NOT choose components.
You must ONLY convert the scenario into structured intent, context, tasks, constraints, and UI state.

Return STRICT JSON only.

{
  "intent": {
    "primary_goal": "",
    "secondary_goal": null
  },
  "context": {
    "environment": "",
    "attention_mode": "focused | glanceable | distracted",
    "urgency": "low | medium | high",
    "mobility_mode": "stationary | walking | driving | transit",
    "interaction_mode": "touch | voice | mixed | minimal-touch"
  },
  "tasks": [
    {
      "task_id": "",
      "type": "",
      "priority": 1,
      "content_need": ""
    }
  ],
  "constraints": [],
  "ui_state": {
    "base_surface": "lock | home | app",
    "home_substate": "none | launcher | app-drawer | widget-edit",
    "overlay_type": "none | quick-settings | notification-shade | system-dialog",
    "overlay_coverage": "none | partial | full",
    "window_mode": "single | split | floating",
    "attention_mode": "focused | glanceable | distracted",
    "density_mode": "expanded | normal | compressed",
    "interaction_mode": "touch | voice | mixed | minimal-touch",
    "background_policy": "wallpaper | solid-dark | scrim-over-wallpaper | scrim-over-app | dialog-surface"
  }
}

Rules:
- interpret, do not design
- tasks must be atomic
- priority must be explicit (1 highest)
- constraints must reflect real UX constraints
- ui_state must reflect context, not arbitrary guess`;
}

// ---------------------------------------------------------------------------
//  STEP 2 — HANDOFF NORMALIZER (planner preparation)
// ---------------------------------------------------------------------------

function buildNormalizerPrompt() {
  return `You are a handoff normalizer.

You receive structured scenario JSON from STEP 1.
Your job is to convert it into a component-selection-ready planning packet.

You must NOT:
- generate UI
- invent components
- change ui_state arbitrarily
- reinterpret the scenario creatively

You must:
- group tasks into primary / secondary / optional
- convert tasks into slot requirements
- translate constraints into selection constraints
- prepare a minimal, clean packet for component selection

Return STRICT JSON:

{
  "planning_summary": {
    "primary_goal": "",
    "interaction_priority": "",
    "attention_strategy": "",
    "density_strategy": "",
    "background_policy": ""
  },
  "task_groups": {
    "primary": [],
    "secondary": [],
    "optional": []
  },
  "slot_requirements": [
    {
      "slot": "",
      "purpose": "",
      "content_type": "",
      "priority": 1,
      "selection_hint": ""
    }
  ],
  "selection_constraints": {
    "prefer": [],
    "avoid": [],
    "collapse_first": []
  },
  "ui_state": {}
}

Rules:
- keep only top 2 tasks as primary/secondary if too many
- rest → optional
- convert tasks → slots (NOT components)
- selection_hint must describe behavior, not component name
- if attention_mode = glanceable → prefer summary, compact, single-value
- if minimal-touch → avoid dense interaction clusters
- if urgency high → primary must reflect urgency
- DO NOT invent component names`;
}

// ---------------------------------------------------------------------------
//  STEP 3 — COMPONENT SELECTOR
// ---------------------------------------------------------------------------

function buildPlannerPrompt() {
  const allowed = allowedSemanticComponentTypes();
  const list = allowed.join('\n');
  return `You are a component selector.

You receive a planning packet.
Your job is to select components ONLY from the allowed vocabulary.

You must NOT:
- reinterpret the scenario
- invent new components
- generate layout or styling

Allowed component types:
${list}

Return STRICT JSON:

{
  "required_components": [
    {
      "slot": "",
      "component_type": "",
      "variant_hint": "",
      "priority": 1,
      "content": {
        "label": "",
        "value": "",
        "icon": null
      },
      "constraints": []
    }
  ],
  "planner_notes": {
    "kept_primary_tasks": [],
    "collapsed_optional_tasks": [],
    "selection_reasoning": []
  }
}

Rules:
- select components that match slot_requirements
- respect selection_constraints.prefer / avoid
- if conflict → preserve primary tasks
- collapse optional first
- if glanceable → compact or glance variants
- if minimal-touch → larger, simpler components
- content must match content_need`;
}

// ---------------------------------------------------------------------------
//  STEP 7 — EXPLANATION LAYER
// ---------------------------------------------------------------------------

function buildExplanationPrompt() {
  return `You are the EXPLANATION LAYER.

Your inputs are (a) the original scenario_text, (b) the resolved ui_state, (c) required_components, (d) layout_plan, (e) validation_report, (f) planner_notes. You do NOT make new decisions or invent components. You ONLY explain what the pipeline already decided and what the user should know.

Return STRICT JSON only:
{
  "why_this_ui": "string (1–3 sentences, plain language)",
  "what_was_prioritized": ["string", "..."],
  "what_was_removed_or_collapsed": ["string", "..."],
  "what_should_be_fixed": ["string", "..."]
}

RULES
- why_this_ui: cite the strongest ui_state signals (attention_mode, density_mode, mobility_mode, interaction_mode, background_policy) and the top-priority component. Max 3 sentences.
- what_was_prioritized: list component_type + one-line reason for each priority:1 item.
- what_was_removed_or_collapsed: use planner_notes.collapsed_optional_tasks; also list any priority:3 items flagged by layout_overflow_check.
- what_should_be_fixed: ONE line per validation.violations entry (include ruleId + message). If no violations, return [].
- JSON only. No prose. No markdown.`;
}

// ---------------------------------------------------------------------------
//  CANONICAL VIOLATION FACTORY + ID GEN
// ---------------------------------------------------------------------------

function makeIdGen(prefix) {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(3, '0')}`;
}

function buildViolation(fields) {
  const autoFix = fields.autoFix || { possible: false, action: null, value: null };
  const status  = fields.status || 'review-required';
  return {
    id:          fields.id,
    stage:       fields.stage,
    ruleId:      fields.ruleId,
    category:    fields.category,
    severity:    fields.severity,
    status,
    frame:       fields.frame || '(pipeline)',
    element:     fields.element || null,
    nodeId:      fields.nodeId || null,
    property:    fields.property || null,
    actual:      fields.actual   === undefined ? null : fields.actual,
    expected:    fields.expected === undefined ? null : fields.expected,
    delta:       fields.delta    === undefined ? null : fields.delta,
    message:     fields.message || '',
    autoFix,
    needsReview: status !== 'auto-fixable'
  };
}

// ---------------------------------------------------------------------------
//  validatePlan — canonical, camelCase only (stage='plan')
// ---------------------------------------------------------------------------

function validatePlan(plan) {
  const allowedVocab = new Set(allowedSemanticComponentTypes());
  const components = (plan && plan.requiredComponents) || [];
  const idGen = makeIdGen('plan-v');
  const violations = [];

  components.forEach((c, idx) => {
    const type = c.componentType;
    if (!type) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'plan',
        ruleId:   'plan_missing_component_type',
        category: 'vocabulary',
        severity: 'high',
        status:   'review-required',
        element:  `requiredComponents[${idx}]`,
        property: 'componentType',
        actual:   null,
        expected: 'non-empty componentType',
        message:  `requiredComponents[${idx}] is missing componentType`
      }));
    } else if (!allowedVocab.has(type)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'plan',
        ruleId:   'plan_vocabulary_violation',
        category: 'vocabulary',
        severity: 'high',
        status:   'review-required',
        element:  type,
        property: 'componentType',
        actual:   type,
        expected: Array.from(allowedVocab),
        message:  `componentType "${type}" is not in the semantic vocabulary`
      }));
    }
    if (c.priority == null || ![1, 2, 3].includes(c.priority)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'plan',
        ruleId:   'plan_priority_out_of_range',
        category: 'consistency',
        severity: 'medium',
        status:   'review-required',
        element:  type || `requiredComponents[${idx}]`,
        property: 'priority',
        actual:   c.priority,
        expected: [1, 2, 3],
        message:  `priority must be 1, 2, or 3 (got ${JSON.stringify(c.priority)})`
      }));
    }
  });

  return { violations };
}

// ---------------------------------------------------------------------------
//  STEP 4 — LAYOUT COMPOSER (LLM)
//  ---------------------------------------------------------------------------
//  Turns (normalized planning packet, selected components) into a strict
//  layoutPlan with groups. This is the step that actually *composes* UI —
//  Steps 1–3 narrow semantics; Step 4 produces structure.
// ---------------------------------------------------------------------------

function buildComposerPrompt() {
  return `You are a layout composer for a state-based generative UI system.

You receive:
- a normalized planning packet from STEP 2
- a selected component list from STEP 3

Your job is to produce a strict layout plan.
You must compose, not invent.

You must NOT:
- invent new components
- reinterpret the original scenario
- generate free-form UI prose
- output visual styling commentary
- ignore the uiState
- rename component ids

You must:
- choose a layout container strategy
- assign variants to selected components
- decide ordering, grouping, and placement
- apply spacing and padding decisions
- decide whether lower-priority items should be visible, collapsed, or hidden
- preserve primary tasks first
- produce strict JSON only

Return STRICT JSON with this shape:

{
  "layoutPlan": {
    "container": "vertical-stack | horizontal-stack | grid | overlay-stack",
    "backgroundPolicy": "wallpaper | solid-dark | scrim-over-wallpaper | scrim-over-app | dialog-surface",
    "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
    "gap": 0,
    "groups": [
      {
        "groupId": "",
        "purpose": "",
        "container": "vertical-stack | horizontal-stack | grid",
        "gap": 0,
        "children": [
          {
            "componentId": "",
            "variant": "",
            "placement": "top | middle | bottom | leading | trailing | full-width",
            "priority": 1,
            "visibility": "visible | collapsed | hidden"
          }
        ]
      }
    ]
  },
  "composerNotes": {
    "layoutStrategy": "",
    "priorityPreservation": [],
    "collapsedComponents": [],
    "whyThisStructure": []
  }
}

## Reference Layout

You will also receive a **Reference Layout** generated deterministically by the
design system engine (generator.js). It encodes One UI design guidelines:
  - Component ordering by weight (chrome → widgets → containers → navigation)
  - Screen-specific anchor positions (clock block, shortcut row, top status)
  - Mandatory components for the screen type
  - Pair-gap rules between adjacent component roles
  - Touch-target minimums and density constraints

**You MUST follow the Reference Layout ordering.** The reference determines:
  1. Which component comes first, second, third, etc.
  2. Which components anchor to fixed positions (top, bottom)
  3. The container strategy and spacing values

You MAY diverge from the reference ONLY when:
  - You need to group components that the reference lists sequentially
    (e.g., wrapping 3 chips into a horizontal-stack group is fine)
  - The reference has no opinion on a component (not listed) — place it
    by priority relative to its neighbors
  - attentionMode or densityMode require collapsing — drop from the
    reference tail first (highest index = lowest priority)

You MUST NOT reorder components against the reference. If the reference says
[status-bar, app-bar, content-card, bottom-nav], your groups[].children[]
must emit them in that exact sequence (possibly across groups).

Navigation components (bottom-nav, pill-tab, tab-bar) with placement "bottom"
in the reference MUST appear in the LAST group with placement: "bottom".

Composition rules:
- respect uiState.attentionMode
- respect uiState.densityMode
- respect uiState.interactionMode
- preserve priority 1 first
- preserve priority 2 if space allows
- collapse priority 3 first when densityMode is compressed
- if attentionMode is glanceable, prefer vertical-stack or simple overlay-stack
- avoid dense multi-column layouts in glanceable mode
- if interactionMode is minimal-touch, prefer larger full-width or simply stacked components
- if overlayType is not none, assume limited usable space
- if backgroundPolicy is solid-dark, do not imply wallpaper-dependent layout logic
- componentId MUST match a componentType from the Selected Components list verbatim
- layoutPlan.backgroundPolicy MUST equal uiState.backgroundPolicy
- layoutPlan.padding and gap SHOULD match the Reference Layout spacing values
- output composition decisions, not descriptive prose`;
}

// ---------------------------------------------------------------------------
//  STEP 4 — VALIDATION (hard checks)
//  ---------------------------------------------------------------------------
//  Operates on the normalized composer output (camelCase, groups-based).
//  Returns canonical violation rows with stage='layout'.
// ---------------------------------------------------------------------------

function validateLayout(layoutPlan, uiState, plan, referenceLayout) {
  const violations = [];
  const lp     = layoutPlan || {};
  const groups = Array.isArray(lp.groups) ? lp.groups : [];
  const idGen  = makeIdGen('layout-v');

  const selectedTypes = new Set(
    ((plan && plan.requiredComponents) || [])
      .map(c => c.componentType)
      .filter(Boolean)
  );

  const allChildren = [];
  groups.forEach(g => {
    (g.children || []).forEach(ch => {
      allChildren.push({ ...ch, _groupId: g.groupId, _groupContainer: g.container });
    });
  });

  // 1. unknown componentIds
  allChildren.forEach(ch => {
    if (!selectedTypes.has(ch.componentId)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'unknown_component_id',
        category: 'consistency',
        severity: 'high',
        status:   'review-required',
        element:  ch.componentId,
        property: 'componentId',
        actual:   ch.componentId,
        expected: Array.from(selectedTypes),
        message:  `componentId "${ch.componentId}" is not in STEP 3 requiredComponents`
      }));
    }
  });

  // 2. invalid variants (registry states)
  allChildren.forEach(ch => {
    if (!REGISTRY || !REGISTRY.components) return;
    const spec = REGISTRY.components[ch.componentId];
    if (!spec) return;
    const states = Array.isArray(spec.states) ? spec.states : [];
    if (!ch.variant || ch.variant === 'default') return;
    if (!states.includes(ch.variant)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'invalid_variant',
        category: 'vocabulary',
        severity: 'medium',
        status:   'review-required',
        element:  ch.componentId,
        property: 'variant',
        actual:   ch.variant,
        expected: states,
        message:  `variant "${ch.variant}" not in registry states [${states.join(', ')}] for "${ch.componentId}"`
      }));
    }
  });

  // 3. densityMode === 'compressed' → priority 3 must not remain visible
  if (uiState && uiState.densityMode === 'compressed') {
    allChildren.forEach(ch => {
      if (ch.priority === 3 && ch.visibility === 'visible') {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'compressed_priority3_visible',
          category: 'layout',
          severity: 'medium',
          status:   'auto-fixable',
          element:  ch.componentId,
          property: 'visibility',
          actual:   'visible',
          expected: 'collapsed|hidden',
          message:  `priority 3 child "${ch.componentId}" must be collapsed or hidden when densityMode=compressed`,
          autoFix:  { possible: true, action: 'setVisibility', value: 'collapsed' }
        }));
      }
    });
  }

  // 4. attentionMode === 'glanceable' → no top-level grid, no grid groups with >2 children
  if (uiState && uiState.attentionMode === 'glanceable') {
    if (lp.container === 'grid') {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'glanceable_forbids_grid_root',
        category: 'layout',
        severity: 'high',
        status:   'review-required',
        element:  'layoutPlan',
        property: 'container',
        actual:   'grid',
        expected: 'vertical-stack|overlay-stack',
        message:  'attentionMode=glanceable forbids grid as top-level container'
      }));
    }
    groups.forEach(g => {
      if (g.container === 'grid' && (g.children || []).length > 2) {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'glanceable_grid_too_wide',
          category: 'layout',
          severity: 'medium',
          status:   'review-required',
          element:  g.groupId,
          property: 'children.length',
          actual:   (g.children || []).length,
          expected: 2,
          delta:    (g.children || []).length - 2,
          message:  `attentionMode=glanceable forbids grid groups with >2 children (found ${(g.children||[]).length})`
        }));
      }
    });
  }

  // 5. interactionMode === 'minimal-touch' → no dense horizontal clusters
  if (uiState && uiState.interactionMode === 'minimal-touch') {
    groups.forEach(g => {
      if (g.container === 'horizontal-stack' && (g.children || []).length > 3) {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'minimal_touch_dense_cluster',
          category: 'touch-target',
          severity: 'medium',
          status:   'review-required',
          element:  g.groupId,
          property: 'children.length',
          actual:   (g.children || []).length,
          expected: 3,
          delta:    (g.children || []).length - 3,
          message:  `interactionMode=minimal-touch forbids horizontal-stack groups with >3 children (found ${(g.children||[]).length})`
        }));
      }
    });
  }

  // 6. overlayType !== 'none' → at most 2 groups with visible children
  if (uiState && uiState.overlayType && uiState.overlayType !== 'none') {
    const visibleGroups = groups.filter(g => (g.children || []).some(ch => ch.visibility === 'visible'));
    if (visibleGroups.length > 2) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'overlay_too_many_groups',
        category: 'layout',
        severity: 'medium',
        status:   'review-required',
        element:  'layoutPlan',
        property: 'groups.visibleCount',
        actual:   visibleGroups.length,
        expected: 2,
        delta:    visibleGroups.length - 2,
        message:  `overlayType=${uiState.overlayType} limits visible groups to 2; found ${visibleGroups.length}`
      }));
    }
  }

  // 7. priority 1 must remain visible
  allChildren.forEach(ch => {
    if (ch.priority === 1 && (ch.visibility === 'hidden' || ch.visibility === 'collapsed')) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'priority1_removed',
        category: 'consistency',
        severity: 'high',
        status:   'review-required',
        element:  ch.componentId,
        property: 'visibility',
        actual:   ch.visibility,
        expected: 'visible',
        message:  `priority 1 component "${ch.componentId}" must not be hidden or collapsed`
      }));
    }
  });

  // 8. backgroundPolicy mismatch
  if (uiState && uiState.backgroundPolicy && lp.backgroundPolicy
      && lp.backgroundPolicy !== uiState.backgroundPolicy) {
    violations.push(buildViolation({
      id:       idGen(),
      stage:    'layout',
      ruleId:   'background_policy_mismatch',
      category: 'context',
      severity: 'high',
      status:   'review-required',
      element:  'layoutPlan',
      property: 'backgroundPolicy',
      actual:   lp.backgroundPolicy,
      expected: uiState.backgroundPolicy,
      message:  `layoutPlan.backgroundPolicy=${lp.backgroundPolicy} must equal uiState.backgroundPolicy=${uiState.backgroundPolicy}`
    }));
  }

  // 9. Reference Layout ordering check
  //    Verify the LLM's output follows the deterministic reference ordering.
  //    Emits medium-severity violations for out-of-order components and
  //    high-severity for navigation components not placed at the bottom.
  if (referenceLayout && Array.isArray(referenceLayout.orderedComponents)) {
    const refOrder = referenceLayout.orderedComponents.map(r => r.componentId);
    // Extract the LLM's actual ordering by walking groups[].children[]
    const actualOrder = [];
    groups.forEach(g => {
      (g.children || []).forEach(ch => {
        if (ch.visibility !== 'hidden') actualOrder.push(ch.componentId);
      });
    });

    // Check pairwise ordering: for any two components A,B where A appears
    // before B in refOrder, A should also appear before B in actualOrder.
    const refIdx = {};
    refOrder.forEach((id, i) => { refIdx[id] = i; });
    for (let i = 0; i < actualOrder.length - 1; i++) {
      const a = actualOrder[i], b = actualOrder[i + 1];
      if (refIdx[a] != null && refIdx[b] != null && refIdx[a] > refIdx[b]) {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'reference_order_mismatch',
          category: 'ordering',
          severity: 'medium',
          status:   'review-required',
          element:  b,
          property: 'order',
          actual:   `${a} (ref#${refIdx[a]}) before ${b} (ref#${refIdx[b]})`,
          expected: `${b} before ${a} per reference`,
          message:  `"${a}" appears before "${b}" but reference layout expects the opposite order`
        }));
      }
    }

    // Check navigation anchor: nav components must be in the last group
    const navRefEntries = referenceLayout.orderedComponents.filter(r => r.placement === 'bottom');
    const navIds = new Set(navRefEntries.map(r => r.componentId));
    if (navIds.size > 0 && groups.length > 0) {
      const lastGroup = groups[groups.length - 1];
      const lastGroupIds = new Set((lastGroup.children || []).map(ch => ch.componentId));
      navIds.forEach(navId => {
        if (actualOrder.includes(navId) && !lastGroupIds.has(navId)) {
          violations.push(buildViolation({
            id:       idGen(),
            stage:    'layout',
            ruleId:   'nav_not_at_bottom',
            category: 'ordering',
            severity: 'high',
            status:   'review-required',
            element:  navId,
            property: 'placement',
            actual:   'not in last group',
            expected: 'last group (bottom-anchored)',
            message:  `"${navId}" must be in the last layout group (bottom-anchored per One UI guidelines)`
          }));
        }
      });
    }
  }

  return { violations };
}

// ---------------------------------------------------------------------------
//  STEP 4 — RUNNER
//  ---------------------------------------------------------------------------
//  LLM composer → normalize → validateLayout + context/overflow validators.
//  Returns the canonical composed output and the merged layout-stage
//  violations (still canonical rows; rollup happens at the orchestrator).
// ---------------------------------------------------------------------------

async function runComposeLayout({ planningPacket, plan, llmCall, viewport }) {
  if (!llmCall)        throw new Error('runComposeLayout requires llmCall(systemPrompt, userMessage)');
  if (!planningPacket) throw new Error('runComposeLayout requires planningPacket');
  if (!plan)           throw new Error('runComposeLayout requires plan');

  // --- Pre-filter: single-point component filtering via Generator rules ---
  //
  // NON-MUTATING: earlier revisions did `plan.requiredComponents = plan...
  // .filter(...)` which mutated the caller's plan object. When the
  // streaming endpoint sent `step_done.plan` (still holding the full
  // list) and then the final `done` event (observing the post-filter
  // list), the two payloads disagreed — looked like data was being
  // wiped. We now build a local filtered copy without touching the
  // shared plan.
  const uiStatePre = planningPacket.uiState;
  let filteredPlan = plan;
  if (plan && Array.isArray(plan.requiredComponents)) {
    const ids = plan.requiredComponents.map(c => c.componentType).filter(Boolean);
    const allowed = preFilterComponents(ids, uiStatePre);
    const allowedSet = new Set(allowed);
    filteredPlan = Object.assign({}, plan, {
      requiredComponents: plan.requiredComponents.filter(
        c => !c.componentType || allowedSet.has(c.componentType)
      )
    });
  }
  // For the rest of this function, use `filteredPlan` instead of `plan`.
  plan = filteredPlan;

  // --- Reference Layout: deterministic order + positions from generator.js ---
  // This gives the LLM a design-system-grounded ordering to follow rather than
  // inventing its own sequence. Generator.resolveOrder applies weight-based
  // sorting (chrome→widgets→containers→navigation→gesture), mandatory component
  // injection, collapse rules, and screen-specific anchors.
  let referenceLayout = null;
  try {
    const refIds = (plan.requiredComponents || [])
      .map(c => c.componentType).filter(Boolean);
    const uiStateRef = planningPacket.uiState || {};
    const ordered   = Generator.resolveOrder(uiStateRef, refIds, DesignMemory, { skipCollapse: true });
    const positions = Generator.resolvePositions(uiStateRef, ordered, DesignMemory);
    const spacing   = Generator.resolveSpacing(uiStateRef, DesignMemory);

    referenceLayout = {
      _note: 'Deterministic reference from One UI design system rules. Follow this ordering.',
      container: spacing ? spacing.container : 'vertical-stack',
      padding:   spacing ? spacing.outerPadding : { top: 16, right: 18, bottom: 0, left: 18 },
      gap:       spacing ? spacing.gap : 10,
      orderedComponents: positions.map(function (pos, idx) {
        return {
          index:     idx,
          componentId: pos.id,
          role:      pos.role,
          placement: (pos.top != null && pos.top <= 30) ? 'top'
                   : (pos.id && (pos.id.includes('nav') || pos.id.includes('pill-tab') || pos.id.includes('gesture'))) ? 'bottom'
                   : 'middle',
          anchorFixed: !!(pos.top != null && pos.top <= 30) ||
                       !!(pos.id && (pos.id.includes('nav') || pos.id.includes('pill-tab') || pos.id.includes('gesture'))),
          position:  { top: pos.top, left: pos.left, width: pos.width, height: pos.height }
        };
      })
    };
  } catch (e) {
    console.warn('[pipeline] Reference layout generation failed (non-fatal):', e.message);
  }

  const refSection = referenceLayout
    ? `\n\nReference Layout (from design system rules — follow this ordering):\n${JSON.stringify(referenceLayout, null, 2)}`
    : '';

  const userMessage =
    `Normalized Planning Packet:\n${JSON.stringify(planningPacket)}\n\n` +
    `Selected Components:\n${JSON.stringify(plan)}` +
    refSection;

  const raw      = await llmCall(buildComposerPrompt(), userMessage);
  const composed = normalizeComposerOutput(raw);
  const uiState  = planningPacket.uiState;

  const hardChecks = validateLayout(composed.layoutPlan, uiState, plan, referenceLayout);

  const ctxIdGen  = makeIdGen('layout-c');
  const ovfIdGen  = makeIdGen('layout-o');
  const ctxViolations = validateContextComponentMatch(composed.layoutPlan, uiState, plan, ctxIdGen);
  const ovfViolations = validateLayoutOverflow(composed.layoutPlan, uiState, viewport, ovfIdGen);

  const violations = [].concat(hardChecks.violations, ctxViolations, ovfViolations);
  return { composed, violations, referenceLayout };
}

// ---------------------------------------------------------------------------
//  ORCHESTRATOR — chains STEP 1 → STEP 2 → STEP 3
// ---------------------------------------------------------------------------

async function runPlan({ scenarioText, llmCall }) {
  if (!llmCall) throw new Error('runPlan requires llmCall(systemPrompt, userMessage)');

  // STEP 1
  const interpretationRaw = await llmCall(
    buildInterpreterPrompt(),
    `User Scenario:\n${scenarioText}`
  );
  const interpretation = normalizeInterpreterOutput(interpretationRaw);

  // STEP 2 — hand the LLM the raw step-1 JSON verbatim (snake_case per prompt
  // contract); the normalizer then enforces canonical camelCase for code use.
  const planningPacketRaw = await llmCall(
    buildNormalizerPrompt(),
    `Input JSON:\n${JSON.stringify(interpretationRaw || interpretation)}`
  );
  const planningPacket = normalizeNormalizerOutput(planningPacketRaw);

  // STEP 3
  const planRaw = await llmCall(
    buildPlannerPrompt(),
    `Planning Packet:\n${JSON.stringify(planningPacketRaw || planningPacket)}`
  );
  const plan = normalizeSelectorOutput(planRaw);

  const { violations } = validatePlan(plan);
  const uiState = planningPacket.uiState || interpretation.uiState;

  return {
    interpretation,
    planningPacket,
    plan,
    uiState,
    planViolations: violations
  };
}

// ---------------------------------------------------------------------------
//  VALIDATION ROLLUP — single canonical report
// ---------------------------------------------------------------------------

function rollupValidationResults({ planViolations, layoutViolations }) {
  const violations = [].concat(planViolations || [], layoutViolations || []);
  const summary = {
    total:          violations.length,
    high:           violations.filter(v => v.severity === 'high').length,
    medium:         violations.filter(v => v.severity === 'medium').length,
    low:            violations.filter(v => v.severity === 'low').length,
    autoFixable:    violations.filter(v => v.status === 'auto-fixable').length,
    reviewRequired: violations.filter(v => v.status === 'review-required').length
  };
  return { summary, violations };
}

// ---------------------------------------------------------------------------
//  STEP 7 — EXPLANATION (canonical camelCase input)
// ---------------------------------------------------------------------------

async function runExplain({ scenarioText, uiState, plan, layoutPlan, validationReport, llmCall }) {
  if (!llmCall) throw new Error('runExplain requires llmCall(systemPrompt, userMessage)');
  const payload = {
    scenarioText,
    uiState,
    requiredComponents: (plan && plan.requiredComponents) || [],
    plannerNotes:       (plan && plan.plannerNotes)       || null,
    layoutPlan,
    validationReport
  };
  return llmCall(buildExplanationPrompt(), JSON.stringify(payload));
}

module.exports = {
  // prompts
  buildInterpreterPrompt,
  buildNormalizerPrompt,
  buildPlannerPrompt,
  buildComposerPrompt,
  buildExplanationPrompt,
  // validators (canonical, camelCase)
  validatePlan,
  validateLayout,
  rollupValidationResults,
  // orchestrators
  runPlan,
  runComposeLayout,
  runExplain,
  // vocabulary introspection
  allowedComponentTypes,
  allowedSemanticComponentTypes,
  REGISTRY_PATH,
  // schema-normalizer re-exports
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput
};
