// ============================================================================
//  GENUI PIPELINE v1 — schema normalization layer
//  ---------------------------------------------------------------------------
//  Sits between each LLM step and its downstream consumer. Takes the raw
//  JSON emitted by the LLM (snake_case, partially-specified, occasionally
//  off-vocabulary) and produces a strict, camelCase, enum-checked object
//  shaped exactly like the NormalizedInterpreterOutput / PlanningPacket /
//  SelectorOutput / ComposerOutput types.
//
//  Pure functions. No LLM calls. No DOM. Usable from Node + browser.
// ============================================================================

'use strict';

const allowed = {
  baseSurface:      ['lock', 'home', 'app'],
  homeSubstate:     ['none', 'launcher', 'app-drawer', 'widget-edit'],
  overlayType:      ['none', 'quick-settings', 'notification-shade', 'system-dialog'],
  overlayCoverage:  ['none', 'partial', 'full'],
  windowMode:       ['single', 'split', 'floating'],
  attentionMode:    ['focused', 'glanceable', 'distracted'],
  densityMode:      ['expanded', 'normal', 'compressed'],
  interactionMode:  ['touch', 'voice', 'mixed', 'minimal-touch'],
  backgroundPolicy: ['wallpaper', 'solid-dark', 'scrim-over-wallpaper', 'scrim-over-app', 'dialog-surface'],
  urgency:          ['low', 'medium', 'high'],
  mobilityMode:     ['stationary', 'walking', 'driving', 'transit'],
  layoutContainer:  ['vertical-stack', 'horizontal-stack', 'grid', 'overlay-stack'],
  groupContainer:   ['vertical-stack', 'horizontal-stack', 'grid'],
  placement:        ['top', 'middle', 'bottom', 'leading', 'trailing', 'full-width'],
  visibility:       ['visible', 'collapsed', 'hidden']
};

// ---------------------------------------------------------------------------
//  low-level assertions
// ---------------------------------------------------------------------------

function assertEnum(value, allowedValues, fallback) {
  if (typeof value !== 'string') return fallback;
  return allowedValues.includes(value) ? value : fallback;
}

function assertString(value, fallback) {
  if (fallback === undefined) fallback = '';
  return typeof value === 'string' ? value : fallback;
}

function assertStringArray(value) {
  return Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
}

function assertPriority(value, fallback) {
  if (fallback === undefined) fallback = 2;
  return value === 1 || value === 2 || value === 3 ? value : fallback;
}

function assertNumber(value, fallback) {
  if (fallback === undefined) fallback = 0;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function camelizeKeysDeep(input) {
  if (Array.isArray(input)) return input.map(camelizeKeysDeep);
  if (input && typeof input === 'object') {
    const out = {};
    for (const key of Object.keys(input)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camelKey] = camelizeKeysDeep(input[key]);
    }
    return out;
  }
  return input;
}

// ---------------------------------------------------------------------------
//  UI state (shared by interpreter + normalizer outputs)
// ---------------------------------------------------------------------------

function normalizeUIState(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  return {
    baseSurface:      assertEnum(raw.baseSurface,      allowed.baseSurface,      'app'),
    homeSubstate:     assertEnum(raw.homeSubstate,     allowed.homeSubstate,     'none'),
    overlayType:      assertEnum(raw.overlayType,      allowed.overlayType,      'none'),
    overlayCoverage:  assertEnum(raw.overlayCoverage,  allowed.overlayCoverage,  'none'),
    windowMode:       assertEnum(raw.windowMode,       allowed.windowMode,       'single'),
    attentionMode:    assertEnum(raw.attentionMode,    allowed.attentionMode,    'focused'),
    densityMode:      assertEnum(raw.densityMode,      allowed.densityMode,      'normal'),
    interactionMode:  assertEnum(raw.interactionMode,  allowed.interactionMode,  'touch'),
    backgroundPolicy: assertEnum(raw.backgroundPolicy, allowed.backgroundPolicy, 'solid-dark')
  };
}

// ---------------------------------------------------------------------------
//  STEP 1 → normalized
// ---------------------------------------------------------------------------

function normalizeInterpreterOutput(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  const intent  = raw.intent  || {};
  const context = raw.context || {};
  const tasks   = Array.isArray(raw.tasks) ? raw.tasks : [];

  return {
    intent: {
      primaryGoal:   assertString(intent.primaryGoal),
      secondaryGoal: intent.secondaryGoal == null ? null : assertString(intent.secondaryGoal)
    },
    context: {
      environment:     assertString(context.environment),
      attentionMode:   assertEnum(context.attentionMode,   allowed.attentionMode,   'focused'),
      urgency:         assertEnum(context.urgency,         allowed.urgency,         'medium'),
      mobilityMode:    assertEnum(context.mobilityMode,    allowed.mobilityMode,    'stationary'),
      interactionMode: assertEnum(context.interactionMode, allowed.interactionMode, 'touch')
    },
    tasks: tasks.map((t, i) => {
      const task = camelizeKeysDeep(t) || {};
      return {
        taskId:      assertString(task.taskId, 'task_' + (i + 1)),
        type:        assertString(task.type),
        priority:    assertPriority(task.priority),
        contentNeed: assertString(task.contentNeed)
      };
    }),
    constraints: assertStringArray(raw.constraints),
    uiState:     normalizeUIState(raw.uiState)
  };
}

// ---------------------------------------------------------------------------
//  STEP 2 → normalized
// ---------------------------------------------------------------------------

function normalizeNormalizerOutput(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  const planningSummary      = raw.planningSummary      || {};
  const taskGroups           = raw.taskGroups           || {};
  const selectionConstraints = raw.selectionConstraints || {};

  const normalizeTaskGroup = (items) =>
    (Array.isArray(items) ? items : []).map((item, i) => {
      const t = camelizeKeysDeep(item) || {};
      return {
        taskId:        assertString(t.taskId, 'task_' + (i + 1)),
        type:          assertString(t.type),
        contentNeed:   assertString(t.contentNeed),
        selectionHint: assertString(t.selectionHint)
      };
    });

  return {
    planningSummary: {
      primaryGoal:         assertString(planningSummary.primaryGoal),
      interactionPriority: assertString(planningSummary.interactionPriority),
      attentionStrategy:   assertString(planningSummary.attentionStrategy),
      densityStrategy:     assertString(planningSummary.densityStrategy),
      backgroundPolicy:    assertString(planningSummary.backgroundPolicy)
    },
    taskGroups: {
      primary:   normalizeTaskGroup(taskGroups.primary),
      secondary: normalizeTaskGroup(taskGroups.secondary),
      optional:  normalizeTaskGroup(taskGroups.optional)
    },
    slotRequirements: (Array.isArray(raw.slotRequirements) ? raw.slotRequirements : []).map((item) => {
      const s = camelizeKeysDeep(item) || {};
      return {
        slot:          assertString(s.slot),
        purpose:       assertString(s.purpose),
        contentType:   assertString(s.contentType),
        priority:      assertPriority(s.priority),
        selectionHint: assertString(s.selectionHint)
      };
    }),
    selectionConstraints: {
      prefer:        assertStringArray(selectionConstraints.prefer),
      avoid:         assertStringArray(selectionConstraints.avoid),
      collapseFirst: assertStringArray(selectionConstraints.collapseFirst)
    },
    uiState: normalizeUIState(raw.uiState)
  };
}

// ---------------------------------------------------------------------------
//  STEP 3 → normalized
// ---------------------------------------------------------------------------

function normalizeSelectorOutput(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  const plannerNotes = raw.plannerNotes || {};

  return {
    requiredComponents: (Array.isArray(raw.requiredComponents) ? raw.requiredComponents : []).map((item) => {
      const c       = camelizeKeysDeep(item) || {};
      const content = c.content || {};
      return {
        slot:          assertString(c.slot),
        componentType: assertString(c.componentType),
        variantHint:   assertString(c.variantHint),
        priority:      assertPriority(c.priority),
        content: {
          label: assertString(content.label),
          value: assertString(content.value),
          icon:  content.icon == null ? null : assertString(content.icon)
        },
        constraints: assertStringArray(c.constraints)
      };
    }),
    plannerNotes: {
      keptPrimaryTasks:       assertStringArray(plannerNotes.keptPrimaryTasks),
      collapsedOptionalTasks: assertStringArray(plannerNotes.collapsedOptionalTasks),
      selectionReasoning:     assertStringArray(plannerNotes.selectionReasoning)
    }
  };
}

// ---------------------------------------------------------------------------
//  STEP 4 → normalized (composer output)
//  NOTE: Step 4 composer is not yet LLM-driven; this normalizer is ready for
//  when the composer is rewired. Currently unused by the pipeline.
// ---------------------------------------------------------------------------

function normalizeComposerOutput(input) {
  const raw           = camelizeKeysDeep(input || {}) || {};
  const layoutPlan    = raw.layoutPlan    || {};
  const padding       = layoutPlan.padding || {};
  const composerNotes = raw.composerNotes || {};

  return {
    layoutPlan: {
      container:        assertEnum(layoutPlan.container,        allowed.layoutContainer,  'vertical-stack'),
      backgroundPolicy: assertEnum(layoutPlan.backgroundPolicy, allowed.backgroundPolicy, 'solid-dark'),
      padding: {
        top:    assertNumber(padding.top),
        right:  assertNumber(padding.right),
        bottom: assertNumber(padding.bottom),
        left:   assertNumber(padding.left)
      },
      gap: assertNumber(layoutPlan.gap),
      groups: (Array.isArray(layoutPlan.groups) ? layoutPlan.groups : []).map((group, i) => {
        const g = camelizeKeysDeep(group) || {};
        return {
          groupId:   assertString(g.groupId, 'group_' + (i + 1)),
          purpose:   assertString(g.purpose),
          container: assertEnum(g.container, allowed.groupContainer, 'vertical-stack'),
          gap:       assertNumber(g.gap),
          children: (Array.isArray(g.children) ? g.children : []).map((child) => {
            const ch = camelizeKeysDeep(child) || {};
            return {
              componentId: assertString(ch.componentId),
              variant:     assertString(ch.variant),
              placement:   assertEnum(ch.placement,  allowed.placement,  'full-width'),
              priority:    assertPriority(ch.priority),
              visibility:  assertEnum(ch.visibility, allowed.visibility, 'visible')
            };
          })
        };
      })
    },
    composerNotes: {
      layoutStrategy:        assertString(composerNotes.layoutStrategy),
      priorityPreservation:  assertStringArray(composerNotes.priorityPreservation),
      collapsedComponents:   assertStringArray(composerNotes.collapsedComponents),
      whyThisStructure:      assertStringArray(composerNotes.whyThisStructure)
    }
  };
}

module.exports = {
  allowed,
  camelizeKeysDeep,
  normalizeUIState,
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput
};
