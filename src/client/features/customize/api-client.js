import { getJson, postJson } from '@/src/client/lib/http';

export function fetchThemes() {
  return getJson('/api/themes');
}

export function saveTheme(payload) {
  return postJson('/api/themes', payload);
}

export function setActiveTheme(id) {
  return postJson('/api/themes/active', { id });
}
