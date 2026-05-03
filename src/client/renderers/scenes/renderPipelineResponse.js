import { renderableComponentIds } from '@/src/client/renderers/registry';

export function summarizePipelineResponse(response) {
  const components = (((response || {}).plan || {}).requiredComponents) || [];
  return {
    count: components.length,
    renderable: components.filter((component) => renderableComponentIds.includes(component.componentType || component.componentId)).length,
    items: components,
  };
}
