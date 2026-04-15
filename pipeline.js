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
  normalizeComposerOutput,
  toLegacySelectorOutput
} = require('./schema_normalizer');

const REGISTRY_PATH = path.join(__dirname, 'figma-refs', 'component_registry.json');
let REGISTRY = null;
try { REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (e) { console.warn('[pipeline] component_registry.json not found or invalid:', e.message); }

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
//  VALIDATION — enforce the hard rule "no invented components"
// ---------------------------------------------------------------------------

// Accepts either a NormalizedSelectorOutput (camelCase) or the legacy
// snake_case shape. After schema normalization this runs on the
// NormalizedSelectorOutput; the legacy branch exists for outside callers.
function validatePlan(plan) {
  const allowed = new Set(allowedSemanticComponentTypes());
  const errors = [];
  const isNormalized = plan && Array.isArray(plan.requiredComponents);
  const components = isNormalized
    ? plan.requiredComponents
    : ((plan && plan.required_components) || []);
  components.forEach((c, idx) => {
    const type = isNormalized ? c.componentType : c.component_type;
    if (!type) {
      errors.push({ index: idx, error: 'missing component_type' });
    } else if (!allowed.has(type)) {
      errors.push({ index: idx, component_type: type, error: 'component_type not in semantic vocabulary' });
    }
    if (c.priority == null || ![1,2,3].includes(c.priority)) {
      errors.push({ index: idx, component_type: type, error: 'priority must be 1|2|3' });
    }
  });
  return { ok: errors.length === 0, errors };
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
- output composition decisions, not descriptive prose`;
}

// ---------------------------------------------------------------------------
//  STEP 4 — VALIDATION (hard checks)
//  ---------------------------------------------------------------------------
//  Operates on the normalized composer output (camelCase, groups-based).
//  Rejects outputs that contradict uiState or reference unknown components.
// ---------------------------------------------------------------------------

function validateLayout(layoutPlan, uiState, plan) {
  const errors = [];
  const lp     = layoutPlan || {};
  const groups = Array.isArray(lp.groups) ? lp.groups : [];

  const selectedTypes = new Set(
    ((plan && (plan.requiredComponents || plan.required_components)) || [])
      .map(c => c.componentType || c.component_type)
      .filter(Boolean)
  );

  // flatten children with group context
  const allChildren = [];
  groups.forEach(g => {
    (g.children || []).forEach(ch => {
      allChildren.push({ ...ch, _groupId: g.groupId, _groupContainer: g.container });
    });
  });

  // 1. unknown componentIds
  allChildren.forEach(ch => {
    if (!selectedTypes.has(ch.componentId)) {
      errors.push({
        ruleId: 'unknown_component_id',
        componentId: ch.componentId,
        message: `componentId "${ch.componentId}" is not in STEP 3 requiredComponents`
      });
    }
  });

  // 2. invalid variants (registry states)
  allChildren.forEach(ch => {
    if (!REGISTRY || !REGISTRY.components) return;
    const spec = REGISTRY.components[ch.componentId];
    if (!spec) return;
    const states = Array.isArray(spec.states) ? spec.states : [];
    if (!ch.variant) return;
    if (ch.variant === 'default') return;
    if (!states.includes(ch.variant)) {
      errors.push({
        ruleId: 'invalid_variant',
        componentId: ch.componentId,
        variant: ch.variant,
        message: `variant "${ch.variant}" not in registry states [${states.join(', ')}] for "${ch.componentId}"`
      });
    }
  });

  // 3. densityMode === 'compressed' → priority 3 must not remain visible
  if (uiState && uiState.densityMode === 'compressed') {
    allChildren.forEach(ch => {
      if (ch.priority === 3 && ch.visibility === 'visible') {
        errors.push({
          ruleId: 'compressed_priority3_visible',
          componentId: ch.componentId,
          message: 'priority 3 child must be collapsed or hidden when densityMode=compressed'
        });
      }
    });
  }

  // 4. attentionMode === 'glanceable' → no grid at top-level, no grid groups with >2 children
  if (uiState && uiState.attentionMode === 'glanceable') {
    if (lp.container === 'grid') {
      errors.push({
        ruleId: 'glanceable_forbids_grid_root',
        message: 'attentionMode=glanceable forbids grid as top-level container'
      });
    }
    groups.forEach(g => {
      if (g.container === 'grid' && (g.children || []).length > 2) {
        errors.push({
          ruleId: 'glanceable_grid_too_wide',
          groupId: g.groupId,
          message: 'attentionMode=glanceable forbids grid groups with >2 children'
        });
      }
    });
  }

  // 5. interactionMode === 'minimal-touch' → no dense horizontal clusters
  if (uiState && uiState.interactionMode === 'minimal-touch') {
    groups.forEach(g => {
      if (g.container === 'horizontal-stack' && (g.children || []).length > 3) {
        errors.push({
          ruleId: 'minimal_touch_dense_cluster',
          groupId: g.groupId,
          message: 'interactionMode=minimal-touch forbids horizontal-stack groups with >3 children'
        });
      }
    });
  }

  // 6. overlayType !== 'none' → at most 2 groups with any visible children
  if (uiState && uiState.overlayType && uiState.overlayType !== 'none') {
    const visibleGroups = groups.filter(g => (g.children || []).some(ch => ch.visibility === 'visible'));
    if (visibleGroups.length > 2) {
      errors.push({
        ruleId: 'overlay_too_many_groups',
        message: `overlayType=${uiState.overlayType} limits visible groups to 2; found ${visibleGroups.length}`
      });
    }
  }

  // 7. priority 1 must remain visible
  allChildren.forEach(ch => {
    if (ch.priority === 1 && (ch.visibility === 'hidden' || ch.visibility === 'collapsed')) {
      errors.push({
        ruleId: 'priority1_removed',
        componentId: ch.componentId,
        message: 'priority 1 component must not be hidden or collapsed'
      });
    }
  });

  // 8. backgroundPolicy mismatch
  if (uiState && uiState.backgroundPolicy && lp.backgroundPolicy
      && lp.backgroundPolicy !== uiState.backgroundPolicy) {
    errors.push({
      ruleId: 'background_policy_mismatch',
      actual: lp.backgroundPolicy,
      expected: uiState.backgroundPolicy,
      message: `layoutPlan.backgroundPolicy=${lp.backgroundPolicy} must equal uiState.backgroundPolicy=${uiState.backgroundPolicy}`
    });
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
//  STEP 4 — RUNNER
// ---------------------------------------------------------------------------

async function runComposeLayout({ planningPacket, plan, llmCall }) {
  if (!llmCall) throw new Error('runComposeLayout requires llmCall(systemPrompt, userMessage)');
  if (!planningPacket) throw new Error('runComposeLayout requires planningPacket');
  if (!plan) throw new Error('runComposeLayout requires plan');

  const userMessage =
    `Normalized Planning Packet:\n${JSON.stringify(planningPacket)}\n\n` +
    `Selected Components:\n${JSON.stringify(plan)}`;

  const raw = await llmCall(buildComposerPrompt(), userMessage);
  const composed = normalizeComposerOutput(raw);
  const validation = validateLayout(composed.layoutPlan, planningPacket.uiState, plan);
  return { composed, validation };
}

// Back-compat: flatten normalized layoutPlan.groups[].children into the old
// {container, padding, gap, children:[{component_id, variant, placement,
// priority, content, slot, _spec_found}]} shape used by layout_composer.js
// overflow/context validators and the genui.html client renderer. Content
// (label/value) is pulled from the plan's requiredComponents.
function toLegacyLayoutPlan(normalizedLayoutPlan, plan) {
  const lp = normalizedLayoutPlan || {};
  const components = (plan && (plan.requiredComponents || [])) || [];
  const contentByType = new Map(components.map(c => [c.componentType, c.content || {}]));
  const slotByType    = new Map(components.map(c => [c.componentType, c.slot]));

  const children = [];
  (lp.groups || []).forEach(g => {
    (g.children || []).forEach(ch => {
      if (ch.visibility && ch.visibility !== 'visible') return;
      children.push({
        component_id: ch.componentId,
        variant:      ch.variant || 'default',
        placement:    ch.placement || 'middle',
        priority:     ch.priority || 2,
        slot:         slotByType.get(ch.componentId) || null,
        content:      contentByType.get(ch.componentId) || {},
        _spec_found:  true,
        _groupId:     g.groupId
      });
    });
  });
  return {
    container: lp.container === 'grid' ? 'grid' : 'vertical-stack',
    padding:   lp.padding || { top: 0, right: 0, bottom: 0, left: 0 },
    gap:       lp.gap || 0,
    children
  };
}

// ---------------------------------------------------------------------------
//  ORCHESTRATOR — chains STEP 1 → STEP 2 → STEP 3
// ---------------------------------------------------------------------------

async function runPlan({ scenarioText, llmCall }) {
  if (!llmCall) throw new Error('runPlan requires llmCall(systemPrompt, userMessage)');

  // STEP 1: interpret → normalize
  const interpretationRaw = await llmCall(
    buildInterpreterPrompt(),
    `User Scenario:\n${scenarioText}`
  );
  const interpretation = normalizeInterpreterOutput(interpretationRaw);

  // STEP 2: handoff packet → normalize
  // (Downstream normalizer receives the normalized camelCase, but the LLM
  //  prompt itself speaks in snake_case per spec — so we hand it the raw
  //  step-1 output verbatim when available, otherwise the normalized one.)
  const planningPacketRaw = await llmCall(
    buildNormalizerPrompt(),
    `Input JSON:\n${JSON.stringify(interpretationRaw || interpretation)}`
  );
  const planningPacket = normalizeNormalizerOutput(planningPacketRaw);

  // STEP 3: component selection → normalize
  const planRaw = await llmCall(
    buildPlannerPrompt(),
    `Planning Packet:\n${JSON.stringify(planningPacketRaw || planningPacket)}`
  );
  const plan = normalizeSelectorOutput(planRaw);

  const validation = validatePlan(plan);

  // ui_state is LLM-authoritative from step_1; step_2 carries a copy.
  const uiState = planningPacket.uiState || interpretation.uiState;

  // Legacy snake_case view for consumers not yet migrated (composer, server
  // response shape, client renderer). To be removed after Step 4 + validator
  // rewiring lands on the normalized contract.
  const legacyPlan = toLegacySelectorOutput(plan);

  return {
    // normalized (canonical, camelCase)
    interpretation,
    planningPacket,
    plan,
    uiState,
    validation,
    // back-compat aliases (snake_case)
    planning_packet: planningPacket,
    ui_state:        uiState,
    legacy: { plan: legacyPlan }
  };
}

async function runExplain({ scenarioText, uiState, plan, plannerNotes, layoutPlan, validation, llmCall }) {
  if (!llmCall) throw new Error('runExplain requires llmCall(systemPrompt, userMessage)');
  // `plan` may arrive normalized (camelCase) or legacy (snake_case); accept both.
  const requiredComponents = plan
    ? (plan.requiredComponents || plan.required_components || [])
    : [];
  const notes = plannerNotes
    || (plan && (plan.plannerNotes || plan.planner_notes))
    || null;
  const payload = {
    scenario_text:       scenarioText,
    ui_state:            uiState,
    required_components: requiredComponents,
    planner_notes:       notes,
    layout_plan:         layoutPlan,
    validation_report:   validation
  };
  return llmCall(buildExplanationPrompt(), JSON.stringify(payload));
}

module.exports = {
  buildInterpreterPrompt,
  buildNormalizerPrompt,
  buildPlannerPrompt,
  buildComposerPrompt,
  buildExplanationPrompt,
  validatePlan,
  validateLayout,
  runPlan,
  runComposeLayout,
  runExplain,
  toLegacyLayoutPlan,
  allowedComponentTypes,
  allowedSemanticComponentTypes,
  REGISTRY_PATH,
  // schema-normalizer re-exports for consumers that want the raw primitives
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput,
  toLegacySelectorOutput
};
