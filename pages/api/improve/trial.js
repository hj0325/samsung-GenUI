const { handleTrial } = require('../../../src/server/api/improveHandlers');
export const config = { api: { bodyParser: false, externalResolver: true } };
export default handleTrial;
