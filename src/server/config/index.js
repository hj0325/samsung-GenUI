'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../storage/fileStore');

let loaded = false;
let cachedConfig = null;

function stripBom(content) {
  if (!content || content.charCodeAt(0) !== 0xfeff) return content;
  return content.slice(1);
}

/** Key → value lines; first `=` separates key from value (handles `=` inside value). */
function parseDotenvContent(text) {
  const out = {};
  stripBom(String(text || '')).split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq < 1) return;
    const key = line.slice(0, eq).trim();
    if (!key || key.startsWith('#')) return;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  });
  return out;
}

/** Merge layered files (.env.local overrides .env) into process.env if not already set to a non-empty value. */
function applyLayeredEnv(layered) {
  Object.keys(layered).forEach((key) => {
    const incoming = layered[key];
    const v = incoming == null ? '' : String(incoming);
    const existing = process.env[key];
    const hasEffectiveExisting = existing != null && String(existing).trim() !== '';
    if (hasEffectiveExisting) return;
    process.env[key] = v;
  });
}

/** Same precedence as Next.js: base → env-specific local (matches common local dev setups). */
function loadEnvFileOnce() {
  if (loaded) return;
  loaded = true;

  const nodeEnv = process.env.NODE_ENV || 'development';
  const chain = ['.env', '.env.local', `.env.${nodeEnv}`, `.env.${nodeEnv}.local`];

  const layered = {};
  for (const name of chain) {
    const filePath = path.join(ROOT_DIR, name);
    if (!fs.existsSync(filePath)) continue;
    try {
      Object.assign(layered, parseDotenvContent(fs.readFileSync(filePath, 'utf8')));
    } catch (_) {
      /* ignore unreadable dotenv fragments */
    }
  }

  applyLayeredEnv(layered);

  /** next run of getServerConfig must see merged process.env (e.g. empty-string placeholders from tooling). */
  cachedConfig = null;
}

function getServerConfig() {
  loadEnvFileOnce();
  if (cachedConfig) return cachedConfig;

  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
  cachedConfig = {
    ROOT_DIR,
    OPENAI_API_KEY: (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim()) || '',
    OPENAI_MODEL: openaiModel,
    OPENAI_MODEL_FAST: process.env.OPENAI_MODEL_FAST || openaiModel,
    OPENAI_MODEL_COMPOSE: process.env.OPENAI_MODEL_COMPOSE || openaiModel,
    OPENAI_MODEL_EXPLAIN: process.env.OPENAI_MODEL_EXPLAIN || process.env.OPENAI_MODEL_FAST || openaiModel,
    OPENAI_MODEL_CONTENT_BAG: process.env.OPENAI_MODEL_CONTENT_BAG || process.env.OPENAI_MODEL_EXPLAIN || process.env.OPENAI_MODEL_FAST || openaiModel,
    PORT: parseInt(process.env.PORT || '3001', 10),
    BIND_HOST: process.env.BIND_HOST || '127.0.0.1',
    MAX_BODY_BYTES: parseInt(process.env.MAX_BODY_BYTES || '1048576', 10),
    MAX_CONCURRENT_LLM: parseInt(process.env.MAX_CONCURRENT_LLM || '4', 10),
    MAX_LLM_PER_MIN: parseInt(process.env.MAX_LLM_PER_MIN || '60', 10),
  };
  return cachedConfig;
}

function ensureServerConfig() {
  const config = getServerConfig();
  if (!config.OPENAI_API_KEY || !String(config.OPENAI_API_KEY).trim()) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const hintPaths = [`${ROOT_DIR}${path.sep}.env.local`, `${ROOT_DIR}${path.sep}.env`].join(', ');
    throw new Error(
      `OPENAI_API_KEY가 비어 있습니다. 레포 루트(${ROOT_DIR})에 OPENAI_API_KEY를 넣은 \`.env\` 또는 \`.env.${nodeEnv}.local\` / \`.env.local\` 파일을 두세요 (${hintPaths}).`,
    );
  }
  return config;
}

module.exports = {
  loadEnvFileOnce,
  getServerConfig,
  ensureServerConfig,
};
