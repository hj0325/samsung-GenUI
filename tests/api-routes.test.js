const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('split pipeline route files point to dedicated handler modules', () => {
  assert.match(read('pages/api/pipeline/plan.js'), /handlePlan/);
  assert.match(read('pages/api/pipeline/full-stream.js'), /handleFullStream/);
  assert.match(read('pages/api/themes/index.js'), /handleThemes/);
  assert.match(read('pages/api/improve/history.js'), /handleHistoryList/);
});

test('agent and legacy routes are no longer served from catch-all api file', () => {
  assert.match(read('pages/api/agent/generate.js'), /handleGenerate/);
  assert.match(read('pages/api/agent/fallbacks/reset.js'), /handleFallbackReset/);
  assert.match(read('pages/api/legacy/[...path].js'), /serveLegacyPath/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'pages', 'api', '[...slug].js')), false);
});
