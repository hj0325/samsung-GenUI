'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  addLearnedRule: legacyPipeline.addLearnedRule,
  removeLearnedRule: legacyPipeline.removeLearnedRule,
  listLearnedRules: legacyPipeline.listLearnedRules,
};
