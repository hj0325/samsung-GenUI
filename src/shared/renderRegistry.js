'use strict';

const PIPELINE_CHROME_ATOMIC_ROLE = {
  'container.status-bar-app': 'status-bar',
  'status-bar.default': 'status-bar',
  'container.header': 'collapsed-app-bar',
  'container.nav-gestures-dark': 'gesture-bar',
  'container.nav-buttons-light': 'nav-buttons',
  'dialog.nav-gesture-bar': 'gesture-bar',
};

const PIPELINE_BODY_ATOMIC_ROLE = {
  'input_summary_card': 'focus-block',
  'weather_glance_card': 'focus-block',
  'calendar_summary_card': 'focus-block',
  'message_summary_card': 'focus-block',
  'eta_card': 'focus-block',
  'reminder_card': 'focus-block',
  'media_control_bar': 'now-bar',
  'now-bar.media-player': 'now-bar',
  'now-bar.dual-line': 'now-bar',
  'now-bar.single-line': 'now-bar',
  'now-bar.charging': 'now-bar',
  'navigation_turn_card': 'now-bar',
  'action_chip_row': 'action-row',
  'quick_toggle_row': 'toggle-chip',
  'notification-card': 'notif-card',
  'notification.ai-regular': 'notif-card-ai',
  'lock-screen.clock': 'clock',
  'lock-screen.weather-date': 'weather-date',
  'lock-screen.shortcut-circle': 'shortcutLeft',
};

const RENDERABLE_COMPONENT_IDS = new Set([
  'container.status-bar-app',
  'status-bar.default',
  'container.header',
  'container.nav-gestures-dark',
  'container.nav-buttons-light',
  'dialog.nav-gesture-bar',
  'input_summary_card',
  'weather_glance_card',
  'calendar_summary_card',
  'message_summary_card',
  'eta_card',
  'reminder_card',
  'media_control_bar',
  'now-bar.media-player',
  'now-bar.dual-line',
  'now-bar.single-line',
  'now-bar.charging',
  'navigation_turn_card',
  'action_chip_row',
  'quick_toggle_row',
  'notification-card',
  'notification.ai-regular',
  'lock-screen.clock',
  'lock-screen.weather-date',
  'lock-screen.shortcut-circle',
  'btn-contained', 'btn-outlined', 'btn-flat', 'fab',
  'switch', 'checkbox', 'radio', 'chip', 'input', 'search',
  'appbar', 'bottomnav', 'pill-tab', 'tab-bar',
  'card', 'list-item', 'dialog', 'snackbar', 'divider', 'badge',
  'status-bar', 'now-bar', 'qs-toggle', 'qs-grid',
  'media-card', 'widget-small', 'keyboard',
]);

function isRenderableComponentId(id) {
  return RENDERABLE_COMPONENT_IDS.has(id);
}

function getRenderRegistry() {
  return {
    renderableComponentIds: Array.from(RENDERABLE_COMPONENT_IDS),
    chromeRoleMap: { ...PIPELINE_CHROME_ATOMIC_ROLE },
    bodyRoleMap: { ...PIPELINE_BODY_ATOMIC_ROLE },
  };
}

module.exports = {
  PIPELINE_CHROME_ATOMIC_ROLE,
  PIPELINE_BODY_ATOMIC_ROLE,
  RENDERABLE_COMPONENT_IDS,
  isRenderableComponentId,
  getRenderRegistry,
};
