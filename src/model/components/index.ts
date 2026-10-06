/**
 * Pre-made components: ready-made groups of objects, such as a navbar or a hotbar, that the
 * Components drawer adds to the project as a plain copy, which is then edited like anything
 * else. Each is built in code with the Builder, in the look picked: Light or Dark, Rounded or
 * Sharp, and for a website or Roblox screen.
 */
import { Builder, pageSubtree } from '../builder.ts';
import {
  breakpointsOf,
  extractSubtree,
  newId,
  reIdSubtree,
  type AnyInstance,
  type Doc,
  type InstanceId,
  type Subtree,
} from '../document.ts';
import { BASIC_COMPONENTS } from './basics.ts';
import { ROBLOX_COMPONENTS } from './roblox.ts';
import { SITE_COMPONENTS } from './site.ts';
import { themeFor, type ComponentOptions, type Look, type Target } from './theme.ts';
import type { ComponentDef } from './types.ts';

export type { ComponentDef, ComponentKind, Placement } from './types.ts';
export type { ComponentOptions, Corners, Look, Target } from './theme.ts';

export const COMPONENTS: readonly ComponentDef[] = [
  ...SITE_COMPONENTS,
  ...ROBLOX_COMPONENTS,
  ...BASIC_COMPONENTS,
];

export const componentById = (id: string) => COMPONENTS.find((c) => c.id === id);

/** Whether a component suits a view: made for it, or for both. */
export const fitsTarget = (def: ComponentDef, target: Target) =>
  def.kind === 'both' || def.kind === target;

/** The style a component draws in: its own, or the view's for one made for both. */
export const styleOf = (def: ComponentDef, target: Target): Target =>
  def.kind === 'both' ? target : def.kind;

/** Websites start Light and Roblox screens Dark, as the templates are. */
export const defaultLook = (def: ComponentDef, target: Target): Look =>
  styleOf(def, target) === 'site' ? 'light' : 'dark';

/**
 * Where a component is built: straight onto a page, which wraps a block in a section of its
 * own, or into anything else, which takes the component as it is.
 */
export type BuildPlace = 'page' | 'other';

export interface BuiltComponent {
  readonly doc: Doc;
  /** The component itself. */
  readonly rootId: InstanceId;
  /** What gets added: the component, or the section wrapped around it on a page. */
  readonly outerId: InstanceId;
  /** The page or ScreenGui it was built in. */
  readonly holderId: InstanceId;
}

/** Builds a component in a project of its own. */
export function buildComponent(
  def: ComponentDef,
  options: ComponentOptions,
  place: BuildPlace,
  makeId: () => InstanceId = newId,
): BuiltComponent {
  const t = themeFor({ ...options, target: styleOf(def, options.target) });
  const b = new Builder(makeId);
  if (place === 'other') {
    const holderId = b.add(b.starterGui, 'ScreenGui', { Name: 'Preview' });
    const rootId = def.build(b, holderId, t);
    return { doc: b.doc, rootId, outerId: rootId, holderId };
  }
  const holderId = b.addSubtree(
    b.site,
    pageSubtree({ Name: 'Preview', Path: '/', BackgroundColor3: t.c.bg }, makeId),
  );
  if (def.place === 'section') {
    const rootId = def.build(b, holderId, t);
    return { doc: b.doc, rootId, outerId: rootId, holderId };
  }
  const outerId = b.add(holderId, 'Frame', { Name: 'Section', BackgroundColor3: t.c.bg });
  if (def.place === 'screen') {
    // A Roblox piece places itself on a screen, so it gets a window-sized area.
    b.set(outerId, { Size: [1, 0, 1, 0] });
  } else {
    b.set(outerId, { HtmlTag: 'section', Size: [1, 0, 0, 0], AutomaticSize: 'Y' });
    b.add(outerId, 'UIPadding', { PaddingTop: [0, 48], PaddingBottom: [0, 48] });
    b.add(outerId, 'UIListLayout', { HorizontalAlignment: 'Center' });
  }
  const rootId = def.build(b, outerId, t);
  if (outerId !== rootId) {
    const name = b.doc.instances[rootId]!.props.Name;
    b.set(outerId, { Name: `${name}Section` });
  }
  return { doc: b.doc, rootId, outerId, holderId };
}

/**
 * Changes for a breakpoint are keyed by the Breakpoint's id, which differs between projects.
 * Moves each change to the target project's breakpoint of the same name, and drops changes
 * for breakpoints it doesn't have.
 */
function adoptBreakpoints(subtree: Subtree, from: Doc, to: Doc): Subtree {
  const byName = new Map(breakpointsOf(to).map((bp) => [bp.props.Name, bp.id]));
  const remap = new Map<InstanceId, InstanceId | undefined>(
    breakpointsOf(from).map((bp) => [bp.id, byName.get(bp.props.Name)]),
  );
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const [id, inst] of Object.entries(subtree.instances)) {
    if (!inst.overrides) {
      instances[id] = inst;
      continue;
    }
    const overrides: Record<InstanceId, object> = {};
    for (const [bp, changes] of Object.entries(inst.overrides)) {
      const target = remap.get(bp);
      if (target !== undefined) overrides[target] = changes;
    }
    const { overrides: _old, ...rest } = inst;
    void _old;
    instances[id] = (Object.keys(overrides).length ? { ...rest, overrides } : rest) as AnyInstance;
  }
  return { rootId: subtree.rootId, instances };
}

/** A fresh copy of a component, ready to insert into `doc`. */
export function componentSubtree(
  doc: Doc,
  def: ComponentDef,
  options: ComponentOptions,
  place: BuildPlace,
  makeId: () => InstanceId = newId,
): Subtree {
  const built = buildComponent(def, options, place);
  const subtree = extractSubtree(built.doc, built.outerId);
  return reIdSubtree(adoptBreakpoints(subtree, built.doc, doc), makeId);
}
