/**
 * Starter templates: websites and Roblox screens to remix. The Project menu offers them under
 * "New from a template", next to starting a blank website or Roblox UI.
 */
import type { Doc, InstanceId } from '../document.ts';
import { hudTemplate } from './hud.ts';
import { inventoryTemplate } from './inventory.ts';
import { landingTemplate } from './landing.ts';
import { linksTemplate } from './links.ts';
import { portfolioTemplate } from './portfolio.ts';
import { settingsTemplate } from './settings.ts';
import { shopTemplate } from './shop.ts';

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** A website (pages in Site) or Roblox UI (ScreenGuis in StarterGui). */
  readonly kind: 'site' | 'roblox';
  readonly build: (makeId?: () => InstanceId) => Doc;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'landing',
    name: 'Landing page',
    description: 'A product page with a hero, features and a call to action.',
    kind: 'site',
    build: landingTemplate,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Your projects in a grid, an about section and a way to get in touch.',
    kind: 'site',
    build: portfolioTemplate,
  },
  {
    id: 'links',
    name: 'Link in bio',
    description: 'A page of links under your name, made for phones.',
    kind: 'site',
    build: linksTemplate,
  },
  {
    id: 'shop',
    name: 'Shop',
    description: 'Category tabs and a grid of items with rarities and prices.',
    kind: 'roblox',
    build: shopTemplate,
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: "A grid of item slots and the selected item's details.",
    kind: 'roblox',
    build: inventoryTemplate,
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Volume sliders, a quality picker and on/off toggles.',
    kind: 'roblox',
    build: settingsTemplate,
  },
  {
    id: 'hud',
    name: 'HUD',
    description: 'Health, coins and gems, a quest tracker and a hotbar.',
    kind: 'roblox',
    build: hudTemplate,
  },
];
