'use strict';

const { runPlan, runSelect } = require('../pipeline/select');
const { runInterpretAndNormalize } = require('../pipeline/interpret');
const { runContentBag, applyContentSwap } = require('../pipeline/contentBag');
const { runComposeLayout, runExplain } = require('../pipeline/compose');
const { rollupValidationResults } = require('../pipeline/validate');
const normalizer = require('../../../schema_normalizer');
const {
  callOpenAI,
  callOpenAIFast,
  callOpenAICompose,
  callOpenAIContentBag,
  callOpenAIEmbedding,
  callOpenAIExplain,
} = require('../openai/client');

function createLlmBindings() {
  return {
    llmCall: (sys, user) => callOpenAI(sys, user, 0.3),
    llmCallFast: (sys, user) => callOpenAIFast(sys, user, 0.3),
    llmCallCompose: (sys, user) => callOpenAICompose(sys, user, 0.55),
    llmCallContentBag: (sys, user) => callOpenAIContentBag(sys, user, 0.5),
    llmCallExplain: (sys, user) => callOpenAIExplain(sys, user, 0.6),
    embedCall: callOpenAIEmbedding,
  };
}

function buildPipelineRunner(viewport, fastMode = false) {
  return async function runner({ scenarioText }) {
    const llm = createLlmBindings();
    const planResult = await runPlan({
      scenarioText,
      llmCall: llm.llmCall,
      llmCallFast: llm.llmCallFast,
      llmCallContentBag: llm.llmCallContentBag,
      embedCall: llm.embedCall,
      fastMode,
    });
    const layoutResult = await runComposeLayout({
      planningPacket: planResult.planningPacket,
      plan: planResult.plan,
      llmCall: llm.llmCallCompose,
      viewport: viewport || null,
      scenarioText,
      fastMode,
    });
    const validation = rollupValidationResults({
      planViolations: planResult.planViolations,
      layoutViolations: layoutResult.violations,
    });
    return {
      interpretation: planResult.interpretation,
      planningPacket: planResult.planningPacket,
      plan: planResult.plan,
      uiState: planResult.uiState,
      layoutPlan: layoutResult.composed.layoutPlan,
      composerNotes: layoutResult.composed.composerNotes,
      validation,
    };
  };
}

function fastTrim(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj.selectionReasoning)) obj.selectionReasoning = obj.selectionReasoning.slice(0, 2);
  if (Array.isArray(obj.whyThisStructure)) obj.whyThisStructure = obj.whyThisStructure.slice(0, 2);
  if (Array.isArray(obj.priorityPreservation)) obj.priorityPreservation = obj.priorityPreservation.slice(0, 2);
  if (Array.isArray(obj.collapsedOptionalTasks)) obj.collapsedOptionalTasks = obj.collapsedOptionalTasks.slice(0, 1);
  if (Array.isArray(obj.constraints)) obj.constraints = obj.constraints.slice(0, 2);
  if (obj.plannerNotes) fastTrim(obj.plannerNotes);
  if (obj.composerNotes) fastTrim(obj.composerNotes);
  if (obj.interpretation) fastTrim(obj.interpretation);
  if (obj.planningPacket) fastTrim(obj.planningPacket);
  return obj;
}

async function runPlanScenario({ scenarioText, fastMode = false }) {
  const llm = createLlmBindings();
  const planResult = await runPlan({
    scenarioText,
    llmCall: llm.llmCall,
    llmCallFast: llm.llmCallFast,
    llmCallContentBag: llm.llmCallContentBag,
    embedCall: llm.embedCall,
    fastMode,
  });
  const validation = rollupValidationResults({
    planViolations: planResult.planViolations,
    layoutViolations: [],
  });
  return {
    interpretation: planResult.interpretation,
    planningPacket: planResult.planningPacket,
    plan: planResult.plan,
    uiState: planResult.uiState,
    validation,
  };
}

async function runComposeScenario({ scenarioText, viewport, fastMode = false }) {
  const llm = createLlmBindings();
  const planResult = await runPlan({
    scenarioText,
    llmCall: llm.llmCall,
    llmCallFast: llm.llmCallFast,
    llmCallContentBag: llm.llmCallContentBag,
    embedCall: llm.embedCall,
    fastMode,
  });
  const layoutResult = await runComposeLayout({
    planningPacket: planResult.planningPacket,
    plan: planResult.plan,
    llmCall: llm.llmCallCompose,
    viewport: viewport || null,
    scenarioText,
    fastMode,
  });
  const validation = rollupValidationResults({
    planViolations: planResult.planViolations,
    layoutViolations: layoutResult.violations,
  });
  return {
    interpretation: planResult.interpretation,
    planningPacket: planResult.planningPacket,
    plan: planResult.plan,
    uiState: planResult.uiState,
    layoutPlan: layoutResult.composed.layoutPlan,
    composerNotes: layoutResult.composed.composerNotes,
    validation,
  };
}

async function runFullScenario({ scenarioText, viewport, fastMode = false }) {
  const llm = createLlmBindings();
  const composed = await runComposeScenario({ scenarioText, viewport, fastMode });
  if (fastMode) {
    fastTrim(composed.interpretation);
    fastTrim(composed.planningPacket);
    fastTrim(composed.plan);
    fastTrim(composed.composerNotes);
  }
  const explanation = fastMode ? null : await runExplain({
    scenarioText,
    uiState: composed.uiState,
    plan: composed.plan,
    layoutPlan: composed.layoutPlan,
    validationReport: composed.validation,
    llmCall: llm.llmCallExplain,
  });
  return {
    ...composed,
    explanation,
  };
}

async function streamFullScenario({ scenarioText, viewport, fastMode = false, res }) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const emit = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const steps = [
    { id: 'interpret', label: 'merged interpret + normalize (steps 1+2)' },
    { id: 'select', label: 'component selector (step 3)' },
    { id: 'compose', label: 'LLM layout composer (step 4)' },
    { id: 'validate', label: 'Rollup validation (step 5)' },
    { id: 'explain', label: 'Explanation layer (step 7)' },
  ];
  const llm = createLlmBindings();
  let stepT0 = 0;
  let currentStep = null;
  const startStep = (idx) => {
    currentStep = steps[idx];
    stepT0 = Date.now();
    emit('step_started', { step: currentStep.id, label: currentStep.label, idx: idx + 1, total: steps.length });
  };
  const doneStep = (idx, output, fallbacks) => {
    emit('step_done', { step: steps[idx].id, output, fallbacks: fallbacks || null, elapsedMs: Date.now() - stepT0, idx: idx + 1, total: steps.length });
  };
  const summarizeCollector = (collector) => {
    if (!collector) return null;
    const maxEvents = 50;
    return {
      total: collector.total,
      byType: collector.byType,
      events: Array.isArray(collector.events) && collector.events.length > maxEvents
        ? collector.events.slice(0, maxEvents).concat([{ truncated: collector.events.length - maxEvents }])
        : (collector.events || []),
    };
  };

  try {
    startStep(0);
    const { result: ipnResult, fallbacks: ipnFallbacks } = await normalizer.withCollector(() => runInterpretAndNormalize({
      scenarioText,
      llmCall: llm.llmCall,
      llmCallFast: llm.llmCallFast,
      fastMode,
    }));
    if (fastMode) {
      fastTrim(ipnResult.interpretation);
      fastTrim(ipnResult.planningPacket);
    }
    doneStep(0, {
      interpretation: ipnResult.interpretation,
      planningPacket: ipnResult.planningPacket,
      uiState: ipnResult.planningPacket.uiState || ipnResult.interpretation.uiState,
    }, summarizeCollector(ipnFallbacks));

    startStep(1);
    const [selectorPair, bagResult] = await Promise.all([
      normalizer.withCollector(() => runSelect({
        scenarioText,
        interpretation: ipnResult.interpretation,
        planningPacket: ipnResult.planningPacket,
        rawCombined: ipnResult.rawCombined,
        llmCall: llm.llmCall,
        embedCall: llm.embedCall,
        fastMode,
      })),
      runContentBag({
        scenarioText,
        planningPacket: ipnResult.planningPacket,
        interpretation: ipnResult.interpretation,
        llmCall: llm.llmCallContentBag,
        fastMode,
      }).catch((error) => {
        console.warn('[Pipeline] content bag stream failure (non-fatal):', error.message);
        return null;
      }),
    ]);
    const { result: selResult, fallbacks: selFallbacks } = selectorPair;
    if (bagResult) applyContentSwap(selResult.plan, bagResult);
    if (fastMode) fastTrim(selResult.plan);
    doneStep(1, { plan: selResult.plan, planViolations: selResult.planViolations, contentBag: bagResult }, summarizeCollector(selFallbacks));

    const planResult = {
      interpretation: ipnResult.interpretation,
      planningPacket: ipnResult.planningPacket,
      plan: selResult.plan,
      uiState: ipnResult.planningPacket.uiState || ipnResult.interpretation.uiState,
      planViolations: selResult.planViolations,
    };

    startStep(2);
    const { result: layoutResult, fallbacks: composeFallbacks } = await normalizer.withCollector(() => runComposeLayout({
      planningPacket: planResult.planningPacket,
      plan: planResult.plan,
      llmCall: llm.llmCallCompose,
      viewport: viewport || null,
      scenarioText,
      fastMode,
    }));
    if (fastMode) fastTrim(layoutResult.composed);
    doneStep(2, {
      layoutPlan: layoutResult.composed.layoutPlan,
      composerNotes: layoutResult.composed.composerNotes,
      layoutViolations: layoutResult.violations,
    }, summarizeCollector(composeFallbacks));

    startStep(3);
    const validation = rollupValidationResults({
      planViolations: planResult.planViolations,
      layoutViolations: layoutResult.violations,
    });
    doneStep(3, validation, null);

    let explanation = null;
    let explainFallbacks = { total: 0, byType: {}, events: [] };
    if (!fastMode) {
      startStep(4);
      const explainRes = await normalizer.withCollector(() => runExplain({
        scenarioText,
        uiState: planResult.uiState,
        plan: planResult.plan,
        layoutPlan: layoutResult.composed.layoutPlan,
        validationReport: validation,
        llmCall: llm.llmCallExplain,
      }));
      explanation = explainRes.result;
      explainFallbacks = explainRes.fallbacks;
      doneStep(4, explanation, summarizeCollector(explainFallbacks));
    } else {
      emit('step_started', { step: 'explain', label: 'Explanation layer (skipped — fast mode)', idx: 5, total: steps.length });
      emit('step_done', { step: 'explain', output: null, fallbacks: null, elapsedMs: 0, idx: 5, total: steps.length, skipped: true });
    }

    emit('done', {
      interpretation: planResult.interpretation,
      planningPacket: planResult.planningPacket,
      plan: planResult.plan,
      uiState: planResult.uiState,
      layoutPlan: layoutResult.composed.layoutPlan,
      composerNotes: layoutResult.composed.composerNotes,
      explanation,
      validation,
      fallbacks: {
        total: (ipnFallbacks.total || 0) + (selFallbacks.total || 0) + (composeFallbacks.total || 0) + (explainFallbacks.total || 0),
        byStep: {
          interpret: ipnFallbacks.total || 0,
          select: selFallbacks.total || 0,
          compose: composeFallbacks.total || 0,
          explain: explainFallbacks.total || 0,
        },
      },
    });
  } catch (error) {
    emit('error', { step: currentStep ? currentStep.id : 'init', message: error.message || 'Pipeline failed', elapsedMs: Date.now() - stepT0 });
  } finally {
    res.end();
  }
}

module.exports = {
  buildPipelineRunner,
  runPlanScenario,
  runComposeScenario,
  runFullScenario,
  streamFullScenario,
};
