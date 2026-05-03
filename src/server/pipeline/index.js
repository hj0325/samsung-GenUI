'use strict';

const legacyPipeline = require('../../../pipeline');
const context = require('./context');
const prompts = require('./prompts');
const interpret = require('./interpret');
const select = require('./select');
const contentBag = require('./contentBag');
const compose = require('./compose');
const validate = require('./validate');
const learnedRules = require('./learnedRules');
const renderRegistry = require('./renderRegistry');

module.exports = {
  ...legacyPipeline,
  ...context,
  ...prompts,
  ...interpret,
  ...select,
  ...contentBag,
  ...compose,
  ...validate,
  ...learnedRules,
  ...renderRegistry,
};
