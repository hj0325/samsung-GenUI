'use strict';

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...headers,
  });
  res.end(body);
}

module.exports = {
  sendJson,
};
