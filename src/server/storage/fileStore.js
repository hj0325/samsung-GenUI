'use strict';

const fs = require('fs');
const path = require('path');

/** Next.js 번들에서는 __dirname이 .next 아래가 되어 레포 루트 계산이 깨짐 — cwd에서 package.json을 찾는다. */
function resolveWorkspaceRoot() {
  let dir = path.resolve(process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '../../..');
}

const ROOT_DIR = resolveWorkspaceRoot();

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

function sanitizeFilename(name) {
  if (!name || /[^A-Za-z0-9._\-]/.test(name) || String(name).includes('..')) {
    throw new Error('invalid filename');
  }
  return String(name);
}

module.exports = {
  ROOT_DIR,
  ensureDir,
  readJson,
  writeJson,
  sanitizeFilename,
};
