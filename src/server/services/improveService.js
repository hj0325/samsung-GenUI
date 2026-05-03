'use strict';

const learnedRules = require('../pipeline/learnedRules');
const improvementEngine = require('../../../improvement_engine');
const historyStore = require('../storage/improvementHistory');
const { buildPipelineRunner } = require('./pipelineService');
const { callOpenAI } = require('../openai/client');

function getTestSuite() {
  return improvementEngine.getTestSuite() || { error: 'test-suite not loaded' };
}

async function runTestSuite({ viewport }) {
  const runner = buildPipelineRunner(viewport);
  const t0 = Date.now();
  const report = await improvementEngine.runTestSuite({ runner });
  report.summary.elapsedMsTotal = Date.now() - t0;
  const savedAs = improvementEngine.saveCycleReport(report);
  report.summary.savedAs = savedAs;
  return report;
}

function listHistory() {
  return { reports: historyStore.listReports() };
}

function readHistoryReport(filename) {
  return historyStore.readReport(filename);
}

async function extractPatterns({ reportFilename }) {
  let filename = reportFilename;
  if (!filename) {
    const reports = historyStore.listReports();
    if (!reports.length) throw new Error('no cycle reports found — run /api/improve/test-suite/run first');
    filename = reports[0];
  }
  const report = historyStore.readReport(filename);
  if (!report) throw new Error(`report not found: ${filename}`);
  const extraction = await improvementEngine.runPatternExtraction({
    report,
    llmCall: (sys, user) => callOpenAI(sys, user, 0.4),
  });
  extraction.sourceReport = filename;
  return extraction;
}

function getRuleSchemaSummary() {
  return { ruleTypes: improvementEngine.getRuleSchemaSummary() };
}

function getLearnedRules() {
  return {
    runtime: learnedRules.listLearnedRules(),
    persisted: improvementEngine.loadLearnedRules(),
  };
}

async function runTrial({ rules, baseline, persist = true, viewport }) {
  const runner = buildPipelineRunner(viewport);
  let baselineReport = baseline || null;
  if (!baselineReport) baselineReport = await improvementEngine.runTestSuite({ runner });
  const results = [];
  for (const rule of rules) {
    const trial = await improvementEngine.trialRule({
      rule,
      runner,
      baseline: baselineReport,
      pipelineModule: learnedRules,
    });
    results.push({
      ruleType: rule.type,
      ruleId: trial.rule && trial.rule.id,
      accepted: trial.accepted,
      baseline: trial.baseline,
      trial: trial.trial,
      delta: trial.delta,
      deltaPct: trial.deltaPct,
      threshold: trial.threshold,
      reason: trial.reason,
      confidence: rule.confidence,
    });
  }
  const accepted = results.filter((item) => item.accepted);
  const rejected = results.filter((item) => !item.accepted);
  if (persist && accepted.length) {
    improvementEngine.persistAcceptedRules(accepted.map((item) => ({
      rule: rules[results.indexOf(item)],
      baseline: item.baseline,
      trial: item.trial,
      delta: item.delta,
      deltaPct: item.deltaPct,
    })));
  }
  if (persist && rejected.length) {
    improvementEngine.persistRejectedRules(rejected.map((item) => ({
      rule: rules[results.indexOf(item)],
      baseline: item.baseline,
      trial: item.trial,
      delta: item.delta,
      deltaPct: item.deltaPct,
      reason: item.reason,
    })));
  }
  return {
    results,
    summary: {
      total: results.length,
      accepted: accepted.length,
      rejected: rejected.length,
      baselineScore: baselineReport.summary.cumulativeScore,
      finalScore: accepted.length ? results[results.length - 1].trial : baselineReport.summary.cumulativeScore,
      persisted: persist,
    },
  };
}

async function runCycle({ sourceReport, dryRun = false, viewport, useVariations = false, variationCount = 2 }) {
  const runner = buildPipelineRunner(viewport);
  let baselineReport;
  if (sourceReport) {
    baselineReport = historyStore.readReport(sourceReport);
    if (!baselineReport) throw new Error(`source report not found: ${sourceReport}`);
  } else {
    baselineReport = await improvementEngine.runTestSuite({ runner });
    improvementEngine.saveCycleReport(baselineReport);
  }
  const baselineScore = baselineReport.summary.cumulativeScore;
  const extraction = await improvementEngine.runPatternExtraction({
    report: baselineReport,
    llmCall: (sys, user) => callOpenAI(sys, user, 0.4),
  });
  const results = [];
  for (const rule of extraction.proposedRules) {
    const trial = await improvementEngine.trialRule({
      rule,
      runner,
      baseline: baselineReport,
      pipelineModule: learnedRules,
      useVariations,
      llmCall: (sys, user) => callOpenAI(sys, user, 0.5),
      variationCount,
    });
    results.push({
      rule,
      accepted: trial.accepted,
      baseline: trial.baseline,
      trial: trial.trial,
      delta: trial.delta,
      deltaPct: trial.deltaPct,
      trainingDeltaPct: trial.trainingDeltaPct,
      validationDeltaPct: trial.validationDeltaPct,
      hasHoldout: trial.hasHoldout,
      reason: trial.reason,
    });
  }
  const accepted = results.filter((item) => item.accepted);
  const rejected = results.filter((item) => !item.accepted);
  if (!dryRun && accepted.length) improvementEngine.persistAcceptedRules(accepted);
  if (!dryRun && rejected.length) improvementEngine.persistRejectedRules(rejected);
  const finalScore = accepted.length ? Math.max(...accepted.map((item) => item.trial)) : baselineScore;
  return {
    dryRun,
    baseline: {
      score: baselineScore,
      weightedAvgScore: baselineReport.summary.weightedAvgScore,
      source: sourceReport || 'fresh',
    },
    extraction: {
      analysis: extraction.analysis,
      proposedCount: extraction.proposedRules.length,
      rejectedShape: extraction.rejectedCount,
    },
    trials: results,
    accepted: accepted.map((item) => ({ id: item.rule.id, type: item.rule.type, deltaPct: item.deltaPct })),
    rejected: rejected.map((item) => ({ type: item.rule.type, deltaPct: item.deltaPct, reason: item.reason })),
    summary: {
      baselineScore,
      finalScore,
      improvement: finalScore - baselineScore,
      improvementPct: baselineScore !== 0 ? Math.round((finalScore - baselineScore) / Math.abs(baselineScore) * 10000) / 100 : 0,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
    },
  };
}

module.exports = {
  getTestSuite,
  runTestSuite,
  listHistory,
  readHistoryReport,
  extractPatterns,
  getRuleSchemaSummary,
  getLearnedRules,
  runTrial,
  runCycle,
};
