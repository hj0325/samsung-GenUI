const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('Improve workspace is a direct React screen instead of LegacyPageFrame', () => {
  const source = read('src/client/features/improve/ImproveWorkspace.js');
  assert.match(source, /fetchImproveHistory/);
  assert.match(source, /runImproveCycle/);
  assert.doesNotMatch(source, /LegacyPageFrame/);
});

test('Customize workspace is a direct React editor instead of LegacyPageFrame', () => {
  const source = read('src/client/features/customize/CustomizeWorkspace.js');
  assert.match(source, /fetchThemes/);
  assert.match(source, /Save \+ Activate/);
  assert.doesNotMatch(source, /LegacyPageFrame/);
});

test('GenUI canvas bridge uses shared bridge contracts', () => {
  const source = read('src/client/features/genui/components/CanvasBridgeFrame.js');
  assert.match(source, /BRIDGE_MESSAGE_TYPES/);
  assert.match(source, /BRIDGE_SOURCE/);
  assert.match(source, /window\.location\.origin/);
});
