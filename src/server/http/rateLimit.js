'use strict';

const { getServerConfig } = require('../config');

const recent = [];
let inFlight = 0;

function pruneRecent(now) {
  const cutoff = now - 60000;
  while (recent.length && recent[0] < cutoff) recent.shift();
}

function checkLlmRate() {
  const { MAX_CONCURRENT_LLM, MAX_LLM_PER_MIN } = getServerConfig();
  const now = Date.now();
  pruneRecent(now);
  if (inFlight >= MAX_CONCURRENT_LLM) {
    return {
      ok: false,
      status: 429,
      retryAfter: 1,
      body: { error: 'Too many concurrent LLM requests', limit: MAX_CONCURRENT_LLM, inFlight },
    };
  }
  if (recent.length >= MAX_LLM_PER_MIN) {
    const retryAfter = Math.max(1, Math.ceil((recent[0] + 60000 - now) / 1000));
    return {
      ok: false,
      status: 429,
      retryAfter,
      body: { error: 'LLM rate limit exceeded', limit: `${MAX_LLM_PER_MIN}/min`, retryAfterSec: retryAfter },
    };
  }
  return { ok: true };
}

function enterLlmRate() {
  inFlight += 1;
  recent.push(Date.now());
}

function exitLlmRate() {
  inFlight = Math.max(0, inFlight - 1);
}

const LLM_ROUTE_PREFIXES = [
  '/api/pipeline/full',
  '/api/pipeline/plan',
  '/api/pipeline/compose',
  '/api/agent/generate',
  '/api/agent/refine',
  '/api/agent/variants',
  '/api/agent/constraints',
];

function isLlmRoute(url, method) {
  if (method !== 'POST') return false;
  return LLM_ROUTE_PREFIXES.some((prefix) => url === prefix || url === `${prefix}/stream`);
}

module.exports = {
  checkLlmRate,
  enterLlmRate,
  exitLlmRate,
  isLlmRoute,
};
