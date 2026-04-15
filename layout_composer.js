// ============================================================================
//  GENUI PIPELINE v1 — step_5 (layout_composer) + pipeline-level validators
//  ---------------------------------------------------------------------------
//  Pure algorithm. NO LLM call. Takes the planner output + resolved ui_state
//  and produces a layout_plan. Then runs two validators that operate on the
//  plan (not on raw Figma): context_component_match, layout_overflow_check.
// ============================================================================

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'figma-refs', 'component_registry.json');
let REGISTRY = null;
try { REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (e) { console.warn('[layout_composer] component_registry.json not found:', e.message); }

// Canonical viewport used for overflow check (Galaxy S26 portrait, zoom=1).
// Can be overridden via opts.viewport.
const DEFAULT_VIEWPORT = { width: 360, height: 780 };

// ----------------------------------------------------------------------------
//  HELPERS
// ----------------------------------------------------------------------------

function getComponentSpec(componentType) {
  if (!REGISTRY) return null;
  return (REGISTRY.components || {})[componentType] || null;
}

function pickVariant(uiState, hinted, componentSpec) {
  // Priority: explicit hint > density-driven > 'default'
  if (hinted && componentSpec && componentSpec.states && componentSpec.states.includes(hinted)) {
    return hinted;
  }
  if (uiState && uiState.densityMode === 'compressed' && componentSpec && componentSpec.states) {
    if (componentSpec.states.includes('glance'))   return 'glance';
    if (componentSpec.states.includes('compact'))  return 'compact';
  }
  if (uiState && uiState.attentionMode === 'glanceable' && componentSpec && componentSpec.states) {
    if (componentSpec.states.includes('glance'))  return 'glance';
  }
  return 'default';
}

function containerFor(uiState) {
  // glanceable / driving → vertical-stack (single-column, large targets, clear priority order)
  // default app screens  → vertical-stack
  // QS overlay / dense tool-rows → grid
  if (!uiState) return 'vertical-stack';
  if (uiState.overlayType === 'quick-settings') return 'grid';
  return 'vertical-stack';
}

function gapForDensity(densityMode) {
  if (densityMode === 'compressed') return 8;
  if (densityMode === 'expanded')   return 16;
  return 12;
}

function paddingForSurface(uiState) {
  if (!uiState) return { top: 16, right: 16, bottom: 16, left: 16 };
  if (uiState.overlayType === 'system-dialog')  return { top: 24, right: 24, bottom: 16, left: 24 };
  if (uiState.overlayType === 'quick-settings') return { top: 12, right: 16, bottom: 12, left: 16 };
  if (uiState.densityMode === 'compressed')     return { top: 12, right: 16, bottom: 12, left: 16 };
  return { top: 20, right: 20, bottom: 20, left: 20 };
}

function placementLabel(index, total) {
  if (total === 1)            return 'center';
  if (index === 0)            return 'top';
  if (index === total - 1)    return 'bottom';
  return 'middle';
}

// ----------------------------------------------------------------------------
//  STEP 5 — COMPOSE LAYOUT
// ----------------------------------------------------------------------------

function composeLayout({ uiState, requiredComponents, opts }) {
  const components = (requiredComponents || []).slice();
  // Sort by priority ASC (1 first), preserving original order on ties.
  components.sort((a, b) => (a.priority || 2) - (b.priority || 2));

  const container = containerFor(uiState);
  const gap       = gapForDensity(uiState && uiState.densityMode);
  const padding   = paddingForSurface(uiState);

  const total = components.length;
  const children = components.map((c, i) => {
    const spec = getComponentSpec(c.component_type);
    return {
      component_id: c.component_type,
      variant:      pickVariant(uiState, c.variant_hint, spec),
      placement:    placementLabel(i, total),
      priority:     c.priority || 2,
      slot:         c.slot || null,
      content:      c.content || {},
      _spec_found:  spec != null
    };
  });

  return {
    layout_plan: {
      container,
      padding,
      gap,
      children
    }
  };
}

// ----------------------------------------------------------------------------
//  PIPELINE-LEVEL VALIDATORS
//  ---------------------------------------------------------------------------
//  Output rows follow the canonical violation schema from
//  figma-refs/validator.js where applicable. Pipeline validators operate on
//  the layout_plan + ui_state + registry, not on raw Figma geometry.
// ----------------------------------------------------------------------------

function buildPipelineViolation({ id, property, ruleId, category, severity, status, actual, expected, delta, message, autoFix, element }) {
  return {
    id,
    frame: '(pipeline)',
    element: element || null,
    nodeId: null,
    property,
    ruleId,
    category,
    severity,
    status,
    actual,
    expected,
    delta: delta === undefined ? null : delta,
    message,
    autoFix: autoFix || { possible: false, action: null, value: null },
    needsReview: status !== 'auto-fixable',
    source: { rawFile: 'pipeline/layout_plan', ruleFile: 'figma-refs/component_registry.json' }
  };
}

// Rule: each component's allowed_contexts must intersect the ui_state context tags.
function validateContextComponentMatch(uiState, layoutPlan, idGen) {
  const out = [];
  const uiContextTags = [];
  if (uiState) {
    if (uiState.baseSurface)                      uiContextTags.push(uiState.baseSurface);
    if (uiState.overlayType && uiState.overlayType !== 'none') uiContextTags.push(uiState.overlayType);
    if (uiState.attentionMode)                    uiContextTags.push(uiState.attentionMode);
    if (uiState.interactionMode)                  uiContextTags.push(uiState.interactionMode);
  }
  const ctxSet = new Set(uiContextTags);

  (layoutPlan.children || []).forEach((child, idx) => {
    const spec = getComponentSpec(child.component_id);
    if (!spec) {
      out.push(buildPipelineViolation({
        id: idGen(),
        element: child.component_id,
        property: 'component_type',
        ruleId: 'context_component_match',
        category: 'context',
        severity: 'high',
        status: 'review-required',
        actual: child.component_id,
        expected: 'registered component',
        message: `component_type "${child.component_id}" is not in the registry`,
        autoFix: { possible: false, action: null, value: null }
      }));
      return;
    }
    const allowed = spec.allowed_contexts || [];
    if (allowed.length === 0) return;
    const match = allowed.some(tag => ctxSet.has(tag));
    if (!match) {
      out.push(buildPipelineViolation({
        id: idGen(),
        element: child.component_id,
        property: 'allowed_contexts',
        ruleId: 'context_component_match',
        category: 'context',
        severity: 'medium',
        status: 'review-required',
        actual: Array.from(ctxSet),
        expected: allowed,
        message: `"${child.component_id}" allowed_contexts [${allowed.join(', ')}] do not intersect ui_state context [${Array.from(ctxSet).join(', ')}]`,
        autoFix: { possible: false, action: null, value: null }
      }));
    }
  });
  return out;
}

// Rule: sum of children min_height + gaps + padding ≤ viewport.height (portrait)
function validateLayoutOverflow(uiState, layoutPlan, viewport, idGen) {
  const out = [];
  const vp = viewport || DEFAULT_VIEWPORT;
  const pad = layoutPlan.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const gap = layoutPlan.gap || 0;
  const children = layoutPlan.children || [];

  // vertical-stack is the common case; for grid we approximate as ceil(n/columns).
  const isGrid = layoutPlan.container === 'grid';
  const columns = isGrid ? 4 : 1; // QS grid default 4 columns

  let needed = pad.top + pad.bottom;
  let widthNeeded = pad.left + pad.right;

  if (isGrid) {
    const rows = Math.ceil(children.length / columns);
    let maxRowHeight = 0;
    children.forEach((child) => {
      const spec = getComponentSpec(child.component_id);
      if (spec) maxRowHeight = Math.max(maxRowHeight, spec.layout_spec?.min_height || 0);
    });
    needed += rows * maxRowHeight + Math.max(0, rows - 1) * gap;
  } else {
    children.forEach((child, i) => {
      const spec = getComponentSpec(child.component_id);
      if (spec) {
        needed += spec.layout_spec?.min_height || 0;
        widthNeeded = Math.max(widthNeeded, (spec.layout_spec?.min_width || 0) + pad.left + pad.right);
      }
      if (i < children.length - 1) needed += gap;
    });
  }

  if (needed > vp.height) {
    out.push(buildPipelineViolation({
      id: idGen(),
      element: layoutPlan.container,
      property: 'height',
      ruleId: 'layout_overflow_check',
      category: 'layout',
      severity: 'high',
      status: 'auto-fixable',
      actual: needed,
      expected: vp.height,
      delta: needed - vp.height,
      message: `layout exceeds viewport height by ${needed - vp.height}px — collapse lowest-priority children or switch to compact variant`,
      autoFix: { possible: true, action: 'remove', value: 'collapse_priority_3_first' }
    }));
  }

  if (widthNeeded > vp.width) {
    out.push(buildPipelineViolation({
      id: idGen(),
      element: layoutPlan.container,
      property: 'width',
      ruleId: 'layout_overflow_check',
      category: 'layout',
      severity: 'medium',
      status: 'review-required',
      actual: widthNeeded,
      expected: vp.width,
      delta: widthNeeded - vp.width,
      message: `a child's min_width + padding exceeds viewport width — switch to compact variant or relax padding`,
      autoFix: { possible: false, action: null, value: null }
    }));
  }

  return out;
}

// ----------------------------------------------------------------------------
//  COMPOSE + VALIDATE (one-shot)
// ----------------------------------------------------------------------------

function runCompose({ uiState, requiredComponents, opts }) {
  const { layout_plan } = composeLayout({ uiState, requiredComponents, opts });

  let counter = 0;
  const idGen = () => `pipeline-v-${String(++counter).padStart(3, '0')}`;

  const violations = [
    ...validateContextComponentMatch(uiState, layout_plan, idGen),
    ...validateLayoutOverflow(uiState, layout_plan, opts && opts.viewport, idGen)
  ];

  const summary = {
    total: violations.length,
    high:   violations.filter(v => v.severity === 'high').length,
    medium: violations.filter(v => v.severity === 'medium').length,
    low:    violations.filter(v => v.severity === 'low').length,
    autoFixable:    violations.filter(v => v.status === 'auto-fixable').length,
    reviewRequired: violations.filter(v => v.status === 'review-required').length,
    semanticReview: violations.filter(v => v.status === 'semantic-review').length
  };

  return { layout_plan, validation: { summary, violations } };
}

module.exports = {
  composeLayout,
  validateContextComponentMatch,
  validateLayoutOverflow,
  runCompose,
  DEFAULT_VIEWPORT
};
