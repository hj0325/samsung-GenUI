const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveLegacyRequestPath } = require('../src/server/api/legacyFiles');

test('legacy path resolver maps genui html inside workspace', () => {
  const target = resolveLegacyRequestPath(['genui.html']);
  assert.ok(target.endsWith('genui.html'));
});

test('legacy path resolver rejects traversal', () => {
  assert.throws(() => resolveLegacyRequestPath(['..', 'secret.txt']));
});
