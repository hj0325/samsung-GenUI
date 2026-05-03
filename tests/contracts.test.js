const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../data/improvement_history/2026-04-28T08-56-46-376Z.json');

test('improvement history fixture preserves expected run shape', () => {
  assert.ok(Array.isArray(fixture.runs));
  assert.ok(fixture.runs.length > 0);
  const run = fixture.runs[0];
  assert.equal(typeof run.scenarioId, 'string');
  assert.equal(typeof run.score, 'number');
  assert.ok(Array.isArray(run.violations));
});
