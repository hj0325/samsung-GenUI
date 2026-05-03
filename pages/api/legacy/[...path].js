const { serveLegacyPath } = require('../../../src/server/api/legacyFiles');

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [];
  return serveLegacyPath(req, res, pathParts);
}
