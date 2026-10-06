import type { Builder } from '../builder.ts';
import type { InstanceId } from '../document.ts';
import type { Theme } from './theme.ts';

/** What a component is made for: websites, Roblox screens, or both. */
export type ComponentKind = 'site' | 'roblox' | 'both';

/**
 * How a component lands. A section is a full-width band of a web page and goes into the page.
 * A block sits inside whatever is selected. A screen piece is placed on a Roblox screen by its
 * own Position, such as a hotbar along the bottom.
 */
export type Placement = 'section' | 'block' | 'screen';

export interface ComponentDef {
  readonly id: string;
  readonly name: string;
  readonly kind: ComponentKind;
  readonly category: string;
  /** One line for the card. */
  readonly summary: string;
  /** A few sentences for the preview. */
  readonly description: string;
  /** Why it only looks the part for now, when it needs a script the exports don't write. */
  readonly lookOnly?: string;
  readonly place: Placement;
  /** Builds the component into `parent` and returns its root. */
  readonly build: (b: Builder, parent: InstanceId, t: Theme) => InstanceId;
}
