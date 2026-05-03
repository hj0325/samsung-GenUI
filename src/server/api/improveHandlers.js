'use strict';

const improveService = require('../services/improveService');
const { readBody } = require('../http/readBody');
const { sendJson } = require('../http/sendJson');

async function handleTestSuite(req, res) {
  sendJson(res, 200, improveService.getTestSuite());
}

async function handleTestSuiteRun(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const report = await improveService.runTestSuite({ viewport: body.viewport || null });
    sendJson(res, 200, report);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleHistoryList(req, res) {
  sendJson(res, 200, improveService.listHistory());
}

async function handleHistoryItem(req, res) {
  const filename = req.query.filename;
  if (/[^A-Za-z0-9._\\-]/.test(filename) || filename.indexOf('..') >= 0) {
    sendJson(res, 400, { error: 'invalid filename' });
    return;
  }
  const report = improveService.readHistoryReport(filename);
  if (!report) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  sendJson(res, 200, report);
}

async function handleExtract(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const extraction = await improveService.extractPatterns({
      reportFilename: body && body.reportFilename,
    });
    sendJson(res, 200, extraction);
  } catch (error) {
    const status = /no cycle reports|report not found/.test(error.message) ? 404 : 500;
    sendJson(res, status, { error: error.message });
  }
}

async function handleRuleSchema(req, res) {
  sendJson(res, 200, improveService.getRuleSchemaSummary());
}

async function handleLearned(req, res) {
  sendJson(res, 200, improveService.getLearnedRules());
}

async function handleTrial(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const rules = Array.isArray(body && body.rules) ? body.rules : [];
    if (!rules.length) {
      sendJson(res, 400, { error: 'body.rules must be a non-empty array' });
      return;
    }
    const result = await improveService.runTrial({
      rules,
      baseline: body.baseline || null,
      persist: body.persist !== false,
      viewport: body.viewport || null,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleCycle(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const result = await improveService.runCycle({
      sourceReport: body.sourceReport,
      dryRun: !!body.dryRun,
      viewport: body.viewport || null,
      useVariations: !!body.useVariations,
      variationCount: body.variationCount != null ? body.variationCount : 2,
    });
    sendJson(res, 200, result);
  } catch (error) {
    const status = /source report not found/.test(error.message) ? 404 : 500;
    sendJson(res, status, { error: error.message });
  }
}

module.exports = {
  handleTestSuite,
  handleTestSuiteRun,
  handleHistoryList,
  handleHistoryItem,
  handleExtract,
  handleRuleSchema,
  handleLearned,
  handleTrial,
  handleCycle,
};
