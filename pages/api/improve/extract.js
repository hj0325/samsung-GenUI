const { handleExtract } = require('../../../src/server/api/improveHandlers');
export const config = { api: { bodyParser: false, externalResolver: true } };
export default handleExtract;
