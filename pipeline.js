// ============================================================================
//  GENUI PIPELINE v1 — step_1 (scenario_interpreter) + step_3 (component_planner)
//  ---------------------------------------------------------------------------
//  Pure prompt builders + thin orchestrator. No HTML generation here.
//  Consumed by server.js via /api/pipeline/plan. Runs AFTER
//  ui-state.js (step_2) has produced the resolved ui_state.
// ============================================================================

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'figma-refs', 'component_registry.json');
let REGISTRY = null;
try { REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (e) { console.warn('[pipeline] component_registry.json not found or invalid:', e.message); }

function allowedComponentTypes() {
  if (!REGISTRY) return [];
  return (REGISTRY.vocabulary && REGISTRY.vocabulary.allowed_types) || Object.keys(REGISTRY.components || {});
}

function registrySummaryForPrompt() {
  if (!REGISTRY) return '(component_registry.json unavailable)';
  const rows = [];
  const comps = REGISTRY.components || {};
  for (const id of Object.keys(comps)) {
    const c = comps[id];
    rows.push(`  ${id} — category:${c.category} · contexts:[${(c.allowed_contexts || []).join(',')}] · collapse_priority:${c.behavior?.collapse_priority ?? 2}`);
  }
  return rows.join('\n');
}

// ---------------------------------------------------------------------------
//  STEP 1 — SCENARIO INTERPRETER
// ---------------------------------------------------------------------------

function buildInterpreterPrompt() {
  return `You are the SCENARIO INTERPRETER for genui_pipeline_v1 step_1.

Your job: take a short natural-language scenario_text and return a STRUCTURED JSON with intent, context, tasks, and constraints.

You do NOT generate UI. You do NOT pick components. You ONLY structure the scenario.

OUTPUT SCHEMA (return exactly this shape as JSON):
{
  "intent": { "primary_goal": "string", "secondary_goal": "string | null" },
  "context": {
    "environment": "string",
    "attention_mode": "focused | glanceable | distracted",
    "urgency": "low | medium | high",
    "mobility_mode": "stationary | walking | driving | transit",
    "interaction_mode": "touch | voice | mixed | minimal-touch"
  },
  "tasks": [
    { "task_id": "t1", "type": "string", "priority": 1, "content_need": "string" }
  ],
  "constraints": ["minimal_text","large_touch_targets","single_glance_readability","reduce_visual_density","one_hand_use","low_cognitive_load"]
}

RULES
- "priority" is an integer 1|2|3 (1 = most important).
- "constraints" values must come from the enum above.
- Emit 1–5 tasks maximum. Fewer is better.
- If the scenario implies driving or a car context, set mobility_mode:"driving" AND attention_mode:"glanceable".
- If minimal interaction is implied, set interaction_mode:"minimal-touch".
- Return JSON only. No prose.`;
}

// ---------------------------------------------------------------------------
//  STEP 3 — COMPONENT PLANNER
// ---------------------------------------------------------------------------

function buildPlannerPrompt() {
  const allowed = allowedComponentTypes().join(', ');
  const summary = registrySummaryForPrompt();
  return `You are the COMPONENT PLANNER for genui_pipeline_v1 step_3.

Your input is (a) the interpreted scenario, (b) the resolved ui_state. Your job: select components from the REGISTRY VOCABULARY below. You must NOT invent new component_type names.

ALLOWED component_type values (ONLY these):
${allowed}

REGISTRY SUMMARY (id — category · allowed_contexts · collapse_priority):
${summary}

OUTPUT SCHEMA (return exactly this shape as JSON):
{
  "required_components": [
    {
      "slot": "string (e.g. primary_info | secondary_info | control | chrome_top | chrome_bottom)",
      "component_type": "string (MUST be in the ALLOWED list)",
      "variant_hint": "default | compact | glance",
      "priority": 1,
      "content": { "label": "string", "value": "string", "icon": "string | null" },
      "constraints": ["string"]
    }
  ]
}

SELECTION RULES
- component_type MUST be one of the ALLOWED list. If none fit, pick the closest available and note it in "constraints".
- If ui_state.attention_mode == "glanceable", prefer components whose allowed_contexts include "glanceable"; avoid long text-heavy components.
- If ui_state.density_mode == "compressed", prefer "compact" or "glance" variant_hint.
- If ui_state.interaction_mode == "minimal-touch", avoid dense action clusters; prefer single-primary-action components.
- If ui_state.base_surface == "app" with overlay_type == "none", do NOT emit lock/home-only components (e.g. now-bar, widget-small).
- Emit 1–6 components maximum. Fewer is better.
- Lower priority numbers = more important. Items with priority 3 are the first to collapse.
- Return JSON only. No prose.`;
}

// ---------------------------------------------------------------------------
//  VALIDATION — enforce the hard rule "no invented components"
// ---------------------------------------------------------------------------

function validatePlan(plan) {
  const allowed = new Set(allowedComponentTypes());
  const errors = [];
  const components = (plan && plan.required_components) || [];
  components.forEach((c, idx) => {
    if (!c.component_type) {
      errors.push({ index: idx, error: 'missing component_type' });
    } else if (!allowed.has(c.component_type)) {
      errors.push({ index: idx, component_type: c.component_type, error: 'component_type not in registry vocabulary' });
    }
    if (c.priority == null || ![1,2,3].includes(c.priority)) {
      errors.push({ index: idx, component_type: c.component_type, error: 'priority must be 1|2|3' });
    }
  });
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
//  STEP 7 — EXPLANATION LAYER
// ---------------------------------------------------------------------------

function buildExplanationPrompt() {
  return `You are the EXPLANATION LAYER for genui_pipeline_v1 step_7.

Your inputs are (a) the original scenario_text, (b) the resolved ui_state, (c) required_components, (d) layout_plan, (e) validation_report (plan + layout). You do NOT make new decisions or invent components. You ONLY explain what the pipeline already decided and what the user should know.

OUTPUT SCHEMA (return exactly this shape as JSON):
{
  "why_this_ui": "string (1–3 sentences, plain language, explains the core design choice)",
  "what_was_prioritized": ["string", "..."],
  "what_was_removed_or_collapsed": ["string", "..."],
  "what_should_be_fixed": ["string", "..."]
}

RULES
- "why_this_ui": cite the strongest ui_state signals (attention_mode, density_mode, mobility_mode, interaction_mode, background_policy) and the top-priority component. Max 3 sentences.
- "what_was_prioritized": list component_type + one-line reason for each priority:1 item.
- "what_was_removed_or_collapsed": list anything that would be dropped under fallback_rules OR any priority-3 item that layout_overflow_check flagged.
- "what_should_be_fixed": ONE line per validation.violations entry (include ruleId + message). If no violations, return [].
- Return JSON only. No prose. No markdown.`;
}

async function runExplain({ scenarioText, uiState, plan, layoutPlan, validation, llmCall }) {
  if (!llmCall) throw new Error('runExplain requires llmCall(systemPrompt, userMessage)');
  const payload = {
    scenario_text: scenarioText,
    ui_state: uiState,
    required_components: (plan && plan.required_components) || [],
    layout_plan: layoutPlan,
    validation_report: validation
  };
  return llmCall(buildExplanationPrompt(), JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
//  ORCHESTRATOR — takes an llmCall(systemPrompt, userMessage) and runs
//  step_1 + step_3 sequentially. uiStateResolver is injected because
//  ui-state.js is a browser module; server.js passes a Node-compatible
//  equivalent or pre-resolves the state.
// ---------------------------------------------------------------------------

async function runPlan({ scenarioText, uiState, llmCall }) {
  if (!llmCall) throw new Error('runPlan requires llmCall(systemPrompt, userMessage)');

  // Step 1: interpret
  const interp = await llmCall(
    buildInterpreterPrompt(),
    `scenario_text: ${JSON.stringify(scenarioText)}`
  );

  // Step 3: plan (step 2 = ui_state resolver, supplied by caller)
  const plan = await llmCall(
    buildPlannerPrompt(),
    JSON.stringify({ interpretation: interp, ui_state: uiState })
  );

  const validation = validatePlan(plan);
  return { interpretation: interp, ui_state: uiState, plan, validation };
}

module.exports = {
  buildInterpreterPrompt,
  buildPlannerPrompt,
  buildExplanationPrompt,
  validatePlan,
  runPlan,
  runExplain,
  allowedComponentTypes,
  REGISTRY_PATH
};
