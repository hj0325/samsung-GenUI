'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  buildInterpreterPrompt: legacyPipeline.buildInterpreterPrompt,
  buildNormalizerPrompt: legacyPipeline.buildNormalizerPrompt,
  runInterpretAndNormalize: legacyPipeline.runInterpretAndNormalize,
};
