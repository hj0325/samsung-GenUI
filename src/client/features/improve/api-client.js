import { getJson, postJson } from '@/src/client/lib/http';

export function fetchImproveHistory() {
  return getJson('/api/improve/history');
}

export function fetchImproveReport(filename) {
  return getJson(`/api/improve/history/${filename}`);
}

export function fetchLearnedRules() {
  return getJson('/api/improve/learned');
}

export function fetchRuleSchema() {
  return getJson('/api/improve/rule-schema');
}

export function fetchTestSuite() {
  return getJson('/api/improve/test-suite');
}

export function runTestSuite(payload = {}) {
  return postJson('/api/improve/test-suite/run', payload);
}

export function extractPatterns(payload = {}) {
  return postJson('/api/improve/extract', payload);
}

export function runImproveCycle(payload = {}) {
  return postJson('/api/improve/cycle', payload);
}
