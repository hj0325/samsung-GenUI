'use strict';

const path = require('path');
const { ROOT_DIR, readJson, writeJson } = require('./fileStore');

const LEARNED_RULES_PATH = path.join(ROOT_DIR, 'figma-refs', 'learned_rules.json');

function readLearnedRules() {
  return readJson(LEARNED_RULES_PATH, { accepted: [], rejected: [] });
}

function writeLearnedRules(state) {
  writeJson(LEARNED_RULES_PATH, state || { accepted: [], rejected: [] });
  return true;
}

module.exports = {
  LEARNED_RULES_PATH,
  readLearnedRules,
  writeLearnedRules,
};
