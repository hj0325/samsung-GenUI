'use strict';

const themeService = require('../services/themeService');
const { readBody } = require('../http/readBody');
const { sendJson } = require('../http/sendJson');

async function handleThemes(req, res) {
  try {
    if (req.method === 'GET') {
      sendJson(res, 200, themeService.getThemes());
      return;
    }
    if (req.method === 'POST') {
      const body = await readBody(req, res);
      if (body === null) return;
      const theme = body && body.theme;
      if (!theme || !theme.id || !theme.name || !theme.vars) {
        sendJson(res, 400, { error: 'theme requires { id, name, vars }' });
        return;
      }
      const saved = themeService.saveTheme(theme, !!body.replace);
      sendJson(res, 200, saved);
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const status = error && error.code === 'THEME_EXISTS' ? 409 : 500;
    sendJson(res, status, { error: error.message });
  }
}

async function handleActiveTheme(req, res) {
  try {
    const body = await readBody(req, res);
    if (body === null) return;
    const result = themeService.setActiveTheme(body && body.id);
    sendJson(res, 200, { active: result.active });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

module.exports = {
  handleThemes,
  handleActiveTheme,
};
