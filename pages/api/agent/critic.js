const { handleCritic } = require('../../../src/server/api/agentHandlers');
export const config = { api: { bodyParser: false, externalResolver: true } };
export default handleCritic;
