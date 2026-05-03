'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  runContentBag: legacyPipeline.runContentBag,
  applyContentSwap: legacyPipeline.applyContentSwap,
  buildContentBagPrompt: legacyPipeline.buildContentBagPrompt,
};
