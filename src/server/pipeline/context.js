'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  buildPromptContext: legacyPipeline.buildPromptContext,
  buildShortlistedVocabBlock: legacyPipeline.buildShortlistedVocabBlock,
  buildVariantReference: legacyPipeline.buildVariantReference,
  buildMandatoryComponentsBlock: legacyPipeline.buildMandatoryComponentsBlock,
  retrieveTopKComponentIds: legacyPipeline.retrieveTopKComponentIds,
};
