'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../storage/fileStore');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function resolveLegacyRequestPath(parts = []) {
  const joined = parts.length ? parts.join('/') : 'genui.html';
  const requested = joined === '' ? 'genui.html' : joined;
  const normalized = requested.startsWith('app/')
    ? requested.replace(/^app\//, 'src/client/legacy/app/')
    : requested === 'improve'
    ? 'improve.html'
    : requested === 'customize'
      ? 'customize.html'
      : requested;
  const resolved = path.resolve(ROOT_DIR, normalized);
  const safeRoot = path.resolve(ROOT_DIR) + path.sep;
  if (resolved !== path.resolve(ROOT_DIR) && !(resolved + path.sep).startsWith(safeRoot)) {
    throw new Error('Forbidden');
  }
  const relative = path.relative(ROOT_DIR, resolved);
  if (relative.split(path.sep).some((segment) => segment.startsWith('.'))) {
    throw new Error('Forbidden');
  }
  return resolved;
}

function serveLegacyPath(req, res, parts = []) {
  let filePath;
  try {
    filePath = resolveLegacyRequestPath(parts);
  } catch {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.statusCode = 200;
  res.end(fs.readFileSync(filePath));
}

module.exports = {
  resolveLegacyRequestPath,
  serveLegacyPath,
};
