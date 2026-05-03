'use strict';

const { handleLegacyApiRequest } = require('./legacyApiRouter');

async function delegateToLegacy(req, res, targetUrl) {
  const originalUrl = req.url;
  req.url = targetUrl;
  try {
    return await handleLegacyApiRequest(req, res);
  } finally {
    req.url = originalUrl;
  }
}

module.exports = {
  delegateToLegacy,
};
