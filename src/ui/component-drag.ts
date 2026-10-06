/**
 * Dragging a card from the Components drawer onto the viewport: the drag carries which
 * component and the look picked for it.
 */
import {
  componentById,
  type ComponentDef,
  type ComponentOptions,
} from '../model/components/index.ts';

export const COMPONENT_MIME = 'application/x-framecraft-component';

export const encodeComponentDrag = (id: string, options: ComponentOptions) =>
  JSON.stringify({ id, ...options });

export function decodeComponentDrag(
  data: string,
): { def: ComponentDef; options: ComponentOptions } | null {
  try {
    const { id, look, corners, target } = JSON.parse(data) as Record<string, unknown>;
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
