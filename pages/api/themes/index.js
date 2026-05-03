const { handleThemes } = require('../../../src/server/api/themeHandlers');
export const config = { api: { bodyParser: false, externalResolver: true } };
export default handleThemes;
