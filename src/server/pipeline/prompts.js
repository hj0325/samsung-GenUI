'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  buildInterpreterPrompt: legacyPipeline.buildInterpreterPrompt,
  buildNormalizerPrompt: legacyPipeline.buildNormalizerPrompt,
  buildInterpretAndPlanPrompt: legacyPipeline.buildInterpretAndPlanPrompt,
  buildPlannerPrompt: legacyPipeline.buildPlannerPrompt,
  buildComposerPrompt: legacyPipeline.buildComposerPrompt,
  buildExplanationPrompt: legacyPipeline.buildExplanationPrompt,
  buildContentBagPrompt: legacyPipeline.buildContentBagPrompt,
};
