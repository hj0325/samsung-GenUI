const test = require('node:test');
const assert = require('node:assert/strict');

const pipelineContracts = require('../src/shared/contracts/pipeline');
const bridgeContracts = require('../src/shared/contracts/bridge');

test('shared pipeline contracts expose known endpoints and stream events', () => {
  assert.equal(pipelineContracts.PIPELINE_ENDPOINTS.FULL_STREAM, '/api/pipeline/full/stream');
  assert.equal(pipelineContracts.PIPELINE_STREAM_EVENTS.DONE, 'done');
  assert.equal(pipelineContracts.PIPELINE_STREAM_EVENTS.ERROR, 'error');
});

test('shared bridge contract exposes constrained message types', () => {
  assert.equal(bridgeContracts.BRIDGE_SOURCE, 'next-genui-shell');
  assert.deepEqual(Object.keys(bridgeContracts.BRIDGE_MESSAGE_TYPES).sort(), [
    'CLEAR',
    'DEVICE',
    'GENERATE',
    'PROMPT',
    'THEME_MODE',
    'THEME_PRESET',
  ]);
});
