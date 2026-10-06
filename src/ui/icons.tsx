/**
 * Icons from the editor design: a 20 px grid, 1.6 px strokes in the current color. Class
 * icons are colored by kind: layers and pages blue, objects grey, modifiers violet.
 */
import { classDef, type ClassName } from '../model/classes.ts';

const PATHS = {
  undo: '<path d="M7.5 5 4 8.5 7.5 12"/><path d="M4.5 8.5H12a4 4 0 0 1 0 8H9"/>',
  redo: '<path d="M12.5 5 16 8.5 12.5 12"/><path d="M15.5 8.5H8a4 4 0 0 0 0 8h3"/>',
  tree: '<rect x="3" y="3" width="5" height="4" rx="1"/><rect x="10" y="9" width="7" height="3.5" rx="1"/><rect x="10" y="14" width="7" height="3.5" rx="1"/><path d="M5.5 7v8.75H10M5.5 10.75H10"/>',
  sliders:
    '<path d="M3 6h14M3 14h14"/><circle cx="8" cy="6" r="2.2" fill="currentColor"/><circle cx="13" cy="14" r="2.2" fill="currentColor"/>',
  devices:
    '<rect x="2.5" y="4" width="10.5" height="8" rx="1.2"/><path d="M5.5 15.5h4.5M7.75 12v3.5"/><rect x="13" y="7.5" width="4.5" height="8.5" rx="1"/>',
  play: '<path d="M6.5 4.5v11l9-5.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  export: '<path d="M10 3v9M6.5 6.5 10 3l3.5 3.5"/><path d="M4 11v5.5h12V11"/>',
  copy: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>',
  eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
  eyeOff:
    '<path d="M3 3l14 14"/><path d="M8.2 4.8A8 8 0 0 1 10 4.5c5 0 8 5.5 8 5.5a14 14 0 0 1-2.4 3.1M5.4 6.3A14 14 0 0 0 2 10s3 5.5 8 5.5a7.6 7.6 0 0 0 3.2-.7"/>',
  chev: '<path d="M7 4l6 6-6 6" stroke-width="2.4"/>',
  chevDown: '<path d="M5 8l5 5 5-5" stroke-width="2"/>',
  toScale: '<path d="M5 15 15 5"/><circle cx="6" cy="6" r="2"/><circle cx="14" cy="14" r="2"/>',
  toOffset:
    '<rect x="2.5" y="6.5" width="15" height="7" rx="1.5"/><path d="M6 6.5v3M9.5 6.5v2M13 6.5v3"/>',
  trash: '<path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/>',
  duplicate:
    '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>',
  plus: '<path d="M10 4v12M4 10h12" stroke-width="1.8"/>',
  minus: '<path d="M4.5 10h11" stroke-width="1.8"/>',
  search: '<circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/>',
  check: '<path d="M4.5 10.5l3.5 3.5 7.5-8" stroke-width="2.2"/>',
  info: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5"/><circle cx="10" cy="6.4" r="0.9" fill="currentColor" stroke="none"/>',
  image:
    '<rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3.5 14l4-4 3 3 2-2 4 4"/><circle cx="13" cy="7.5" r="1.2"/>',
  close: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
  file: '<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/>',
  blank: '<rect x="4" y="3" width="12" height="14" rx="2"/><path d="M10 7.5v5M7.5 10h5"/>',
  theme:
    '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none"/>',
  reset: '<path d="M4 10a6 6 0 1 0 2-4.5"/><path d="M4 3.5V7h3.5"/>',
  upload: '<path d="M10 13V3.5M6.5 7 10 3.5 13.5 7"/><path d="M4 13v4h12v-4"/>',
  download: '<path d="M10 3v9.5M6.5 9 10 12.5 13.5 9"/><path d="M4 14.5V17h12v-2.5"/>',
  link: '<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>',
  DataModel: '<circle cx="10" cy="10" r="7"/>',
  StarterGui:
    '<path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.5l1.5 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/>',
  Site: '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.3 2.4 2.3 12.6 0 15M10 2.5c-2.3 2.4-2.3 12.6 0 15"/>',
  Breakpoint: '<rect x="5.5" y="2.5" width="9" height="15" rx="1.8"/><path d="M9 14.5h2"/>',
  ScreenGui:
    '<rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17"/>',
  Page: '<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h5"/>',
  Frame: '<rect x="3.5" y="3.5" width="13" height="13" rx="1.5"/>',
  TextLabel: '<path d="M5 5h10M10 5v10" stroke-width="2"/>',
  TextButton: '<rect x="2.5" y="5.5" width="15" height="9" rx="4.5"/><path d="M7.5 10h5"/>',
  TextBox: '<rect x="2.5" y="5.5" width="15" height="9" rx="1.5"/><path d="M6.5 8v4"/>',
  ImageLabel:
    '<rect x="3" y="3.5" width="14" height="13" rx="1.5"/><circle cx="7.5" cy="8" r="1.5"/><path d="M3.5 15l4.5-4.5 3 3 2-2 3.5 3.5"/>',
  ImageButton:
    '<rect x="3" y="3.5" width="14" height="13" rx="4"/><circle cx="7.5" cy="8" r="1.5"/><path d="M4 15l4-4 3 3 2-2 3 3"/>',
  ScrollingFrame:
    '<rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M13.5 3v14"/><path d="M15.3 6v3" stroke-width="2"/>',
  UICorner: '<path d="M4 16V9a5 5 0 0 1 5-5h7" stroke-width="2"/>',
  UIStroke:
    '<rect x="3" y="3" width="14" height="14" rx="2"/><rect x="6" y="6" width="8" height="8" rx="1"/>',
  UIGradient:
    '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3.5 13 13 3.5M7 16.5 16.5 7"/>',
  UIPadding:
    '<rect x="3" y="3" width="14" height="14" rx="2"/><rect x="6.5" y="6.5" width="7" height="7" rx="1" stroke-dasharray="2 1.6"/>',
  UIListLayout:
    '<rect x="3.5" y="3.5" width="13" height="3" rx="1"/><rect x="3.5" y="8.5" width="13" height="3" rx="1"/><rect x="3.5" y="13.5" width="13" height="3" rx="1"/>',
  UIAspectRatioConstraint:
    '<rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M6 12.5V7.5h3M14 7.5v5h-3"/>',
} satisfies Record<string, string> & Record<ClassName, string>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}

const KIND_CLASS = {
  root: 'root',
  service: 'root',
  setting: 'root',
  container: 'container',
  gui: 'obj',
  modifier: 'mod',
} as const;

/** A class's icon, in its kind's color. */
export function ClassIcon({ className }: { className: ClassName }) {
  return (
    <span className={`ico ${KIND_CLASS[classDef(className).kind]}`}>
      <Icon name={className} />
    </span>
  );
}

/** The app's mark: the selection frame with its AnchorPoint. */
export function Mark() {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="1" width="24" height="24" rx="6.5" fill="var(--accent)" />
      <rect
        x="7"
        y="7"
        width="12"
        height="12"
        rx="2.5"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="2"
      />
      <circle cx="13" cy="13" r="2.3" fill="var(--on-accent)" />
      <path d="M19 13h4M13 19v4" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
