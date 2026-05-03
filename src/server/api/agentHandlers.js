'use strict';

const agentService = require('../services/agentService');
const { readBody } = require('../http/readBody');
const { sendJson } = require('../http/sendJson');

async function handleGenerate(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    await agentService.generate(body, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleGenerateStream(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    await agentService.generateStream(body, req, res);
  } catch (error) {
    try {
      sendJson(res, 500, { error: error.message });
    } catch (_) {
      try { res.end(); } catch (__) {}
    }
  }
}

async function handleGenerateFlowStream(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    await agentService.generateFlowStream(body, req, res);
  } catch (error) {
    try {
      sendJson(res, 500, { error: error.message });
    } catch (_) {
      try { res.end(); } catch (__) {}
    }
  }
}

async function handleRefine(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    await agentService.refine(body, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleCritic(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    await agentService.critic(body, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleVariants(req, res) {
  try {
    if (req.method === 'GET') {
      const sessionId = (req.url.split('?')[1] || '').split('sessionId=')[1] || 'default';
      sendJson(res, 200, agentService.readVariants(sessionId));
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    agentService.syncVariants(body, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleConstraints(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    agentService.constraints(body, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleEvolve(req, res) {
  try {
    if (req.method === 'GET') {
      sendJson(res, 200, agentService.listEvolveEntries());
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    sendJson(res, 200, agentService.saveEvolveEntry(body));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleHealth(req, res) {
  sendJson(res, 200, agentService.health());
}

async function handleFallbackReset(req, res) {
  sendJson(res, 200, agentService.resetFallbacks());
}

module.exports = {
  handleGenerate,
  handleGenerateStream,
  handleGenerateFlowStream,
  handleRefine,
  handleCritic,
  handleVariants,
  handleConstraints,
  handleEvolve,
  handleHealth,
  handleFallbackReset,
};
