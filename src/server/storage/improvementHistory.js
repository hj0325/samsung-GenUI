'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT_DIR, ensureDir, sanitizeFilename } = require('./fileStore');

const HISTORY_DIR = path.join(ROOT_DIR, 'data', 'improvement_history');

function saveReport(report) {
  ensureDir(HISTORY_DIR);
  const filename = (report && report.summary && report.summary.builtAt
    ? report.summary.builtAt.replace(/[:.]/g, '-')
    : 'run-' + Date.now()) + '.json';
  fs.writeFileSync(path.join(HISTORY_DIR, filename), JSON.stringify(report, null, 2));
  return filename;
}

function listReports() {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs.readdirSync(HISTORY_DIR).filter((file) => file.endsWith('.json')).sort().reverse();
}

function readReport(filename) {
  const safeName = sanitizeFilename(filename);
  const target = path.join(HISTORY_DIR, safeName);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

module.exports = {
  HISTORY_DIR,
  saveReport,
  listReports,
  readReport,
};
