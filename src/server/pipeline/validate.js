'use strict';

const legacyPipeline = require('../../../pipeline');

module.exports = {
  validatePlan: legacyPipeline.validatePlan,
  validateLayout: legacyPipeline.validateLayout,
  rollupValidationResults: legacyPipeline.rollupValidationResults,
};
