const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const workspacePath = path.join(__dirname, '..', 'src', 'client', 'features', 'genui', 'GenuiWorkspace.js');

test('GenUI workspace is no longer a thin LegacyPageFrame wrapper', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  assert.match(source, /GenuiTopbar/);
  assert.match(source, /SidebarTabs/);
  assert.match(source, /PipelineOutputPanel/);
  assert.match(source, /CanvasBridgeFrame/);
  assert.doesNotMatch(source, /LegacyPageFrame/);
});
