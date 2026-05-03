'use strict';

const themeStore = require('../storage/themes');

function getThemes() {
  return themeStore.readThemes();
}

function setActiveTheme(id) {
  return themeStore.setActiveTheme(id);
}

function saveTheme(theme, replace) {
  return themeStore.saveTheme(theme, { replace: !!replace });
}

module.exports = {
  getThemes,
  setActiveTheme,
  saveTheme,
};
