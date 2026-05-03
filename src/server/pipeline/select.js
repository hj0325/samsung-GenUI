'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  runPlan: legacyPipeline.runPlan,
  runSelect: legacyPipeline.runSelect,
  runContentBag: legacyPipeline.runContentBag,
  applyContentSwap: legacyPipeline.applyContentSwap,
};
