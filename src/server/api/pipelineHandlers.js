'use strict';

const pipelineService = require('../services/pipelineService');
const { readBody } = require('../http/readBody');
const { sendJson } = require('../http/sendJson');

async function handlePlan(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const scenarioText = body.scenario_text || body.prompt || '';
    const result = await pipelineService.runPlanScenario({
      scenarioText,
      fastMode: body.fastMode === true,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleCompose(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const scenarioText = body.scenario_text || body.prompt || '';
    const result = await pipelineService.runComposeScenario({
      scenarioText,
      viewport: body.viewport || null,
      fastMode: body.fastMode === true,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleFull(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const scenarioText = body.scenario_text || body.prompt || '';
    const result = await pipelineService.runFullScenario({
      scenarioText,
      viewport: body.viewport || null,
      fastMode: body.fastMode === true,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleFullStream(req, res) {
  const body = await readBody(req, res);
  if (body === null) return;
  await pipelineService.streamFullScenario({
    scenarioText: body.scenario_text || body.prompt || '',
    viewport: body.viewport || null,
    fastMode: body.fastMode === true,
    res,
  });
}

module.exports = {
  handlePlan,
  handleCompose,
  handleFull,
  handleFullStream,
};
