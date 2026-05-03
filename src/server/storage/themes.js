'use strict';

const path = require('path');
const { ROOT_DIR, readJson, writeJson } = require('./fileStore');

const THEMES_PATH = path.join(ROOT_DIR, 'figma-refs', 'themes.json');

function readThemes() {
  return readJson(THEMES_PATH, { _active: null, themes: [] });
}

function setActiveTheme(id) {
  const data = readThemes();
  if (!id || !Array.isArray(data.themes) || !data.themes.find((theme) => theme.id === id)) {
    throw new Error('unknown theme id: ' + id);
  }
  data._active = id;
  writeJson(THEMES_PATH, data);
  return { active: id, themes: data };
}

function saveTheme(theme, options = {}) {
  const data = readThemes();
  const themes = Array.isArray(data.themes) ? data.themes : [];
  const index = themes.findIndex((item) => item.id === theme.id);
  if (index >= 0 && !options.replace) {
    const error = new Error('theme id already exists; pass replace:true to overwrite');
    error.code = 'THEME_EXISTS';
    throw error;
  }
  if (index >= 0) themes[index] = theme;
  else themes.push(theme);
  data.themes = themes;
  writeJson(THEMES_PATH, data);
  return { saved: theme.id, total: themes.length };
}

module.exports = {
  THEMES_PATH,
  readThemes,
  setActiveTheme,
  saveTheme,
};
