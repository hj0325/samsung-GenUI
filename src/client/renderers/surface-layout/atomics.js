import { chromeRoleMap, bodyRoleMap } from '@/src/client/renderers/registry';

export function getAtomicRole(componentId) {
  return chromeRoleMap[componentId] || bodyRoleMap[componentId] || null;
}
