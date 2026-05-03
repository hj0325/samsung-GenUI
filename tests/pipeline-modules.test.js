const test = require('node:test');
const assert = require('node:assert/strict');

const pipelineIndex = require('../src/server/pipeline');
const interpret = require('../src/server/pipeline/interpret');
const select = require('../src/server/pipeline/select');
const compose = require('../src/server/pipeline/compose');
const validate = require('../src/server/pipeline/validate');
const renderRegistry = require('../src/server/pipeline/renderRegistry');

test('server pipeline index is composed from stage modules', () => {
  assert.equal(typeof pipelineIndex.buildPromptContext, 'function');
  assert.equal(typeof pipelineIndex.runPlan, 'function');
  assert.equal(typeof pipelineIndex.runComposeLayout, 'function');
  assert.equal(typeof pipelineIndex.validateLayout, 'function');
});

test('pipeline stage modules expose callable entry points', () => {
  assert.equal(typeof interpret.runInterpretAndNormalize, 'function');
  assert.equal(typeof select.runSelect, 'function');
  assert.equal(typeof compose.runExplain, 'function');
  assert.equal(typeof validate.rollupValidationResults, 'function');
  assert.equal(typeof renderRegistry.getRenderRegistry, 'function');
});
