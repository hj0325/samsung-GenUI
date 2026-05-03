'use strict';

const normalizer = require('../../../schema_normalizer');
const {
  handleGenerate,
  handleGenerateStream,
  handleFlowGenerateStream,
  handleRefine,
  handleCritic,
  handleConstraintExtract,
  handleVariantSync,
  getVariantContext,
  appendEvolveEntry,
  loadEvolveConstraints,
  getAgentHealthPayload,
} = require('../http/legacyApiRouter');

async function generate(body, res) {
  return handleGenerate(body, res);
}

async function generateStream(body, req, res) {
  return handleGenerateStream(body, req, res);
}

async function generateFlowStream(body, req, res) {
  return handleFlowGenerateStream(body, req, res);
}

async function refine(body, res) {
  return handleRefine(body, res);
}

async function critic(body, res) {
  return handleCritic(body, res);
}

function constraints(body, res) {
  return handleConstraintExtract(body, res);
}

function syncVariants(body, res) {
  return handleVariantSync(body, res);
}

function readVariants(sessionId) {
  return {
    sessionId: sessionId || 'default',
    variants: getVariantContext(sessionId || 'default'),
  };
}

function saveEvolveEntry(body) {
  const result = appendEvolveEntry(body);
  const entries = loadEvolveConstraints() || [];
  return { ...result, totalConstraints: entries.length };
}

function listEvolveEntries() {
  const entries = loadEvolveConstraints() || [];
  return { entries, count: entries.length };
}

function health() {
  return getAgentHealthPayload();
}

function resetFallbacks() {
  const before = normalizer.getFallbackStats();
  normalizer.resetFallbackStats();
  return { ok: true, reset: before };
}

module.exports = {
  generate,
  generateStream,
  generateFlowStream,
  refine,
  critic,
  constraints,
  syncVariants,
  readVariants,
  saveEvolveEntry,
  listEvolveEntries,
  health,
  resetFallbacks,
};
