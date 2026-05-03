const { handleFullStream } = require('../../../src/server/api/pipelineHandlers');
export const config = { api: { bodyParser: false, externalResolver: true } };
export default handleFullStream;
