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
  buildExplanationPrompt,
  validatePlan,
  runPlan,
  runExplain,
  allowedComponentTypes,
  allowedSemanticComponentTypes,
  REGISTRY_PATH,
  // schema-normalizer re-exports for consumers that want the raw primitives
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  toLegacySelectorOutput
};
