const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../src/shared/renderRegistry');

test('shared render registry exposes stable role maps and ids', () => {
  assert.ok(registry.RENDERABLE_COMPONENT_IDS.has('container.header'));
  assert.equal(registry.PIPELINE_CHROME_ATOMIC_ROLE['container.header'], 'collapsed-app-bar');
  assert.equal(registry.PIPELINE_BODY_ATOMIC_ROLE['message_summary_card'], 'focus-block');
  assert.ok(Array.isArray(registry.getRenderRegistry().renderableComponentIds));
});
