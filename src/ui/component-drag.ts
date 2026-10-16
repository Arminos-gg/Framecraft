/**
 * Dragging a card from the Components drawer onto the viewport: the drag carries which
 * component and the look picked for it, or which of the project's own components.
 */
import {
  componentById,
  type ComponentDef,
  type ComponentOptions,
} from '../model/components/index.ts';

export const COMPONENT_MIME = 'application/x-framecraft-component';

export const encodeComponentDrag = (id: string, options: ComponentOptions) =>
  JSON.stringify({ id, ...options });

/** One of the project's own components, which adds a linked copy. */
export const encodeCopyDrag = (componentId: string) => JSON.stringify({ copy: componentId });

export function decodeComponentDrag(
  data: string,
): { def: ComponentDef; options: ComponentOptions } | { copy: string } | null {
  try {
    const { id, look, corners, target, copy } = JSON.parse(data) as Record<string, unknown>;
    if (typeof copy === 'string') return { copy };
    const def = typeof id === 'string' ? componentById(id) : undefined;
    if (!def) return null;
    if (look !== 'light' && look !== 'dark') return null;
    if (corners !== 'rounded' && corners !== 'sharp') return null;
    if (target !== 'site' && target !== 'roblox') return null;
    return { def, options: { look, corners, target } };
  } catch {
    return null;
  }
}
