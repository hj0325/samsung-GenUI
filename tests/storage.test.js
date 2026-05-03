const test = require('node:test');
const assert = require('node:assert/strict');

const themeStore = require('../src/server/storage/themes');
const historyStore = require('../src/server/storage/improvementHistory');
const variationStore = require('../src/server/storage/variations');
const learnedRuleStore = require('../src/server/storage/learnedRules');

test('theme store reads the active theme file', () => {
  const themes = themeStore.readThemes();
  assert.ok(themes);
  assert.ok(Array.isArray(themes.themes));
});

test('improvement history store can list seeded reports', () => {
  const reports = historyStore.listReports();
  assert.ok(Array.isArray(reports));
  assert.ok(reports.length >= 1);
});

test('variation store returns null for unknown scenario without throwing', () => {
  const value = variationStore.readVariations('missing-scenario-for-test');
  assert.equal(value, null);
});

test('learned rule store reads persisted state shape', () => {
  const state = learnedRuleStore.readLearnedRules();
  assert.ok(state);
  assert.ok(Array.isArray(state.accepted));
  assert.ok(Array.isArray(state.rejected));
});
