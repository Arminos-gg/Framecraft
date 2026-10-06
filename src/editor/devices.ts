/**
 * The window sizes the viewport can show. Roblox screens use the prototype's device presets.
 * Pages use Desktop plus one size per breakpoint, and show (and edit) that breakpoint's values.
 */
import { breakpointsOf, type Doc, type InstanceId } from '../model/document.ts';

export interface Device {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  /** The breakpoint a page shows and edits on this device; none for Desktop and screens. */
  readonly breakpoint?: InstanceId;
}

export const SCREEN_DEVICES: readonly Device[] = [
  { id: 'laptop', label: 'Laptop · 1366×768', width: 1366, height: 768 },
  { id: 'hd', label: 'Desktop · 1920×1080', width: 1920, height: 1080 },
  { id: 'tablet', label: 'Tablet · 1024×768', width: 1024, height: 768 },
  { id: 'phoneL', label: 'Phone landscape · 844×390', width: 844, height: 390 },
  { id: 'phoneP', label: 'Phone portrait · 390×844', width: 390, height: 844 },
];

/** The Roblox screens' devices shown side by side, with the one being edited if it isn't here. */
export const SIDE_BY_SIDE_SCREENS: readonly string[] = ['laptop', 'tablet', 'phoneP'];

/** Desktop shows a page's base values. */
export const DESKTOP: Device = {
  id: 'desktop',
  label: 'Desktop · 1366×768',
  width: 1366,
  height: 768,
};

/** Desktop, then each breakpoint from the widest down, at its preview size. */
export function pageDevices(doc: Doc): Device[] {
  return [
    DESKTOP,
    ...breakpointsOf(doc).map((bp) => ({
      id: bp.id,
      label: `${bp.props.Name} · ${bp.props.PreviewWidth}×${bp.props.PreviewHeight}`,
      width: bp.props.PreviewWidth,
      height: bp.props.PreviewHeight,
      breakpoint: bp.id,
    })),
  ];
}
