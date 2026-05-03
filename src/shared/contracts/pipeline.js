/**
 * @typedef {Object} PipelineValidationSummary
 * @property {number} total
 * @property {number} high
 * @property {number} medium
 * @property {number} low
 */

/**
 * @typedef {Object} PipelineValidation
 * @property {PipelineValidationSummary} summary
 * @property {Array<Object>} violations
 */

/**
 * @typedef {Object} PipelineResponse
 * @property {Object} interpretation
 * @property {Object} planningPacket
 * @property {Object} plan
 * @property {Object} uiState
 * @property {Object=} layoutPlan
 * @property {Object=} composerNotes
 * @property {Object=} explanation
 * @property {PipelineValidation} validation
 */

const PIPELINE_STREAM_EVENTS = {
  STEP_STARTED: 'step_started',
  STEP_DONE: 'step_done',
  DONE: 'done',
  ERROR: 'error',
};

const PIPELINE_ENDPOINTS = {
  PLAN: '/api/pipeline/plan',
  COMPOSE: '/api/pipeline/compose',
  FULL: '/api/pipeline/full',
  FULL_STREAM: '/api/pipeline/full/stream',
};

module.exports = {
  PIPELINE_STREAM_EVENTS,
  PIPELINE_ENDPOINTS,
};
