'use strict';

const { getServerConfig } = require('../config');
const { sendJson } = require('./sendJson');
const { checkLlmRate, enterLlmRate, exitLlmRate, isLlmRoute } = require('./rateLimit');

function readBody(req, res) {
  return new Promise((resolve) => {
    const { MAX_BODY_BYTES } = getServerConfig();
    const reject413 = (got) => {
      if (res && !res.headersSent) {
        sendJson(res, 413, {
          error: 'Request body too large',
          maxBytes: MAX_BODY_BYTES,
          got,
        });
      }
      try { req.destroy(); } catch (_) {}
      resolve(null);
    };

    const contentLength = parseInt(req.headers['content-length'], 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_BODY_BYTES) {
      reject413(contentLength);
      return;
    }

    let length = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        reject413(length);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (_) {
        parsed = {};
      }

      const url = (req.url || '').split('?')[0];
      if (isLlmRoute(url, req.method)) {
        const check = checkLlmRate();
        if (!check.ok) {
          if (res && !res.headersSent) {
            sendJson(res, check.status, check.body, { 'Retry-After': String(check.retryAfter) });
          }
          resolve(null);
          return;
        }
        enterLlmRate();
        if (res) res.once('close', exitLlmRate);
      }

      resolve(parsed);
    });
    req.on('error', () => resolve(null));
  });
}

module.exports = {
  readBody,
};
