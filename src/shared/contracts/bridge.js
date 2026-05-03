'use strict';

const BRIDGE_SOURCE = 'next-genui-shell';
const BRIDGE_MESSAGE_TYPES = {
  PROMPT: 'prompt',
  GENERATE: 'generate',
  CLEAR: 'clear',
  THEME_MODE: 'themeMode',
  THEME_PRESET: 'themePreset',
  DEVICE: 'device',
};

module.exports = {
  BRIDGE_SOURCE,
  BRIDGE_MESSAGE_TYPES,
};
