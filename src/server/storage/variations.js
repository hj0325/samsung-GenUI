'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT_DIR, ensureDir } = require('./fileStore');

const VARIATIONS_DIR = path.join(ROOT_DIR, 'data', 'variations');

function readVariations(scenarioId) {
  const target = path.join(VARIATIONS_DIR, scenarioId + '.json');
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function saveVariations(scenarioId, data) {
  ensureDir(VARIATIONS_DIR);
  fs.writeFileSync(path.join(VARIATIONS_DIR, scenarioId + '.json'), JSON.stringify(data, null, 2));
  return true;
}

module.exports = {
  VARIATIONS_DIR,
  readVariations,
  saveVariations,
};
