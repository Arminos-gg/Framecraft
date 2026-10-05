/**
 * Starting documents: a blank Roblox UI, a blank website, the sample game menu from the
 * prototype, and a sample two-page website.
 */
import type { ClassName, PropsOf } from './classes.ts';
import { applyCommand, insert } from './commands.ts';
import {
  breakpointsOf,
  createInstance,
  emptyProject,
  newId,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
  type Subtree,
} from './document.ts';
import { colorSequence, type Color3 } from './values.ts';

/** Builds a document by inserting instances one at a time, through the same commands the editor uses. */
class Builder {
  doc: Doc;
  readonly makeId: () => InstanceId;
  constructor(makeId: () => InstanceId) {
    this.makeId = makeId;
    this.doc = emptyProject(makeId);
  }

  get starterGui() {
    return serviceOf(this.doc, 'StarterGui').id;
  }
  get site() {
    return serviceOf(this.doc, 'Site').id;
  }
  breakpoint(name: string) {
    const bp = breakpointsOf(this.doc).find((b) => b.props.Name === name);
    if (!bp) throw new Error(`No ${name} breakpoint`);
    return bp.id;
  }

  add<C extends ClassName>(parentId: InstanceId, className: C, props: Partial<PropsOf<C>> = {}) {
    const inst = createInstance(className, props, this.makeId()) as unknown as AnyInstance;
    this.doc = applyCommand(this.doc, insert(parentId, single(inst))).doc;
    return inst.id;
  }
  addSubtree(parentId: InstanceId, subtree: Subtree) {
    this.doc = applyCommand(this.doc, insert(parentId, subtree)).doc;
    return subtree.rootId;
  }
  /** Changes base values; the command checks the names and values. */
  set(id: InstanceId, props: Readonly<Record<string, unknown>>) {
    this.doc = applyCommand(this.doc, { type: 'setProps', id, props }).doc;
  }
  /** Changes values at one breakpoint only; the command checks the names and values. */
  change(id: InstanceId, breakpoint: string, props: Readonly<Record<string, unknown>>) {
    const cmd = { type: 'setProps', id, props, breakpoint: this.breakpoint(breakpoint) } as const;
    this.doc = applyCommand(this.doc, cmd).doc;
  }
}

/**
 * A new page: a Page whose sections stack from the top, each pushing the next one down,
 * as on a web page.
 */
export function pageSubtree(
  props: Partial<PropsOf<'Page'>> = {},
  makeId: () => InstanceId = newId,
): Subtree {
  const page = createInstance('Page', props, makeId());
  const list = {
    ...createInstance('UIListLayout', { SortOrder: 'LayoutOrder' }, makeId()),
    parent: page.id,
  };
  return {
    rootId: page.id,
    instances: { [page.id]: { ...page, children: [list.id] }, [list.id]: list },
  };
}

/** A blank Roblox UI: one ScreenGui. */
export function blankDoc(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  b.add(b.starterGui, 'ScreenGui');
  return b.doc;
}

/** A blank website: a home page. */
export function blankSiteDoc(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  b.addSubtree(b.site, pageSubtree({ Name: 'Home', Path: '/' }, makeId));
  return b.doc;
}

/** A game main menu: a coin counter, a centered panel with a title and a list of buttons. */
export function sampleDoc(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const sg = b.add(b.starterGui, 'ScreenGui', { Name: 'MainMenu' });

  const coins = b.add(sg, 'Frame', {
    Name: 'Coins',
    AnchorPoint: [1, 0],
    Position: [1, -20, 0, 20],
    Size: [0, 176, 0, 52],
    BackgroundColor3: [22, 24, 38],
    BackgroundTransparency: 0.12,
  });
  b.add(coins, 'UICorner', { CornerRadius: [0.5, 0] });
  b.add(coins, 'UIStroke', { Color: [255, 204, 77], Thickness: 2, Transparency: 0.25 });
  const icon = b.add(coins, 'Frame', {
    Name: 'CoinIcon',
    AnchorPoint: [0, 0.5],
    Position: [0, 10, 0.5, 0],
    Size: [0, 34, 0, 34],
    BackgroundColor3: [255, 201, 60],
  });
  b.add(icon, 'UICorner', { CornerRadius: [0.5, 0] });
  b.add(icon, 'UIGradient', {
    Color: colorSequence([255, 255, 255], [222, 158, 30]),
    Rotation: 90,
  });
  b.add(icon, 'UIStroke', { Color: [168, 104, 8], Thickness: 2 });
  b.add(coins, 'TextLabel', {
    Name: 'Amount',
    Position: [0, 54, 0, 0],
    Size: [1, -68, 1, 0],
    BackgroundTransparency: 1,
    Text: '12,450',
    Font: 'GothamBold',
    TextSize: 24,
    TextColor3: [255, 255, 255],
    TextXAlignment: 'Left',
  });

  const panel = b.add(sg, 'Frame', {
    Name: 'Panel',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0.34, 0, 0.72, 0],
    BackgroundColor3: [19, 21, 33],
    BackgroundTransparency: 0.06,
  });
  b.add(panel, 'UICorner', { CornerRadius: [0, 18] });
  b.add(panel, 'UIStroke', { Color: [255, 255, 255], Thickness: 1.5, Transparency: 0.84 });
  b.add(panel, 'UIPadding', {
    PaddingTop: [0, 24],
    PaddingBottom: [0, 24],
    PaddingLeft: [0, 24],
    PaddingRight: [0, 24],
  });
  const title = b.add(panel, 'TextLabel', {
    Name: 'Title',
    Size: [1, 0, 0.2, 0],
    BackgroundTransparency: 1,
    Text: 'SKY RAIDERS',
    Font: 'LuckiestGuy',
    TextScaled: true,
    TextColor3: [255, 214, 92],
  });
  b.add(title, 'UIStroke', { Color: [92, 44, 0], Thickness: 3 });
  b.add(panel, 'TextLabel', {
    Name: 'Subtitle',
    Position: [0, 0, 0.2, 6],
    Size: [1, 0, 0.05, 0],
    BackgroundTransparency: 1,
    Text: 'Season 3 · Storm Front',
    Font: 'GothamMedium',
    TextScaled: true,
    TextColor3: [168, 176, 204],
  });
  const buttons = b.add(panel, 'Frame', {
    Name: 'Buttons',
    AnchorPoint: [0, 1],
    Position: [0, 0, 1, 0],
    Size: [1, 0, 0.62, 0],
    BackgroundTransparency: 1,
  });
  b.add(buttons, 'UIListLayout', {
    FillDirection: 'Vertical',
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Bottom',
    Padding: [0.05, 0],
    SortOrder: 'LayoutOrder',
  });
  const button = (name: string, order: number, text: string, bg: Color3, fg: Color3) => {
    const id = b.add(buttons, 'TextButton', {
      Name: name,
      LayoutOrder: order,
      Size: [1, 0, 0.28, 0],
      BackgroundColor3: bg,
      Text: text,
      Font: 'GothamBlack',
      TextScaled: true,
      TextColor3: fg,
    });
    b.add(id, 'UICorner', { CornerRadius: [0, 12] });
    b.add(id, 'UIPadding', { PaddingTop: [0.26, 0], PaddingBottom: [0.26, 0] });
    b.add(id, 'UIGradient', {
      Color: colorSequence([255, 255, 255], [206, 212, 226]),
      Rotation: 90,
    });
  };
  button('PlayButton', 1, 'PLAY', [72, 199, 102], [255, 255, 255]);
  button('ShopButton', 2, 'SHOP', [64, 132, 245], [255, 255, 255]);
  button('SettingsButton', 3, 'SETTINGS', [58, 63, 86], [226, 230, 244]);

  b.add(sg, 'TextLabel', {
    Name: 'Version',
    AnchorPoint: [0, 1],
    Position: [0, 18, 1, -14],
    Size: [0, 260, 0, 20],
    BackgroundTransparency: 1,
    Text: 'v0.1 · made with Framecraft',
    Font: 'SourceSans',
    TextSize: 16,
    TextColor3: [255, 255, 255],
    TextTransparency: 0.3,
    TextXAlignment: 'Left',
  });

  return b.doc;
}

const INK: Color3 = [28, 25, 23];
const CREAM: Color3 = [250, 246, 240];
const ACCENT: Color3 = [194, 98, 45];

/**
 * A two-page coffee shop website: Home and Pricing, each with the same nav bar. Phone hides
 * the nav links, Tablet and Phone shrink the headline, and Phone stacks the price cards.
 */
export function sampleSite(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const page = (props: Partial<PropsOf<'Page'>>) =>
    b.addSubtree(b.site, pageSubtree({ BackgroundColor3: CREAM, ...props }, makeId));

  const navLinks: { id: InstanceId; to: 'home' | 'pricing' }[] = [];
  const nav = (pageId: InstanceId) => {
    const bar = b.add(pageId, 'Frame', {
      Name: 'Nav',
      HtmlTag: 'nav',
      LayoutOrder: 1,
      Size: [1, 0, 0, 72],
      BackgroundColor3: CREAM,
    });
    b.add(bar, 'UIPadding', { PaddingLeft: [0, 40], PaddingRight: [0, 40] });
    b.change(bar, 'Phone', { Size: [1, 0, 0, 60] });
    b.add(bar, 'TextLabel', {
      Name: 'Logo',
      Size: [0, 200, 1, 0],
      BackgroundTransparency: 1,
      Text: 'Northwind',
      Font: 'GothamBold',
      TextSize: 22,
      TextColor3: INK,
      TextXAlignment: 'Left',
    });
    const links = b.add(bar, 'Frame', {
      Name: 'Links',
      AnchorPoint: [1, 0.5],
      Position: [1, 0, 0.5, 0],
      Size: [0, 240, 0, 40],
      BackgroundTransparency: 1,
    });
    b.change(links, 'Phone', { Visible: false });
    b.add(links, 'UIListLayout', {
      FillDirection: 'Horizontal',
      HorizontalAlignment: 'Right',
      VerticalAlignment: 'Center',
      Padding: [0, 24],
    });
    const link = (name: string, order: number, text: string) =>
      b.add(links, 'TextButton', {
        Name: name,
        LayoutOrder: order,
        Size: [0, 72, 1, 0],
        BackgroundTransparency: 1,
        Text: text,
        Font: 'GothamMedium',
        TextSize: 16,
        TextColor3: INK,
      });
    navLinks.push({ id: link('HomeLink', 1, 'Home'), to: 'home' });
    navLinks.push({ id: link('PricingLink', 2, 'Pricing'), to: 'pricing' });
  };

  const home = page({
    Name: 'Home',
    Path: '/',
    Title: 'Northwind Coffee',
    Description: 'Small-batch coffee, roasted every week.',
  });
  nav(home);
  const hero = b.add(home, 'Frame', {
    Name: 'Hero',
    LayoutOrder: 2,
    // The window's height less the nav, so the hero fills the first screen.
    Size: [1, 0, 1, -72],
    BackgroundColor3: INK,
  });
  b.change(hero, 'Phone', { Size: [1, 0, 0, 420] });
  const headline = b.add(hero, 'TextLabel', {
    Name: 'Headline',
    HtmlTag: 'h1',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.42, 0],
    Size: [0, 720, 0, 140],
    BackgroundTransparency: 1,
    Text: 'Coffee roasted this week, at your door by Friday',
    Font: 'GothamBold',
    TextSize: 52,
    TextWrapped: true,
    TextColor3: CREAM,
  });
  b.change(headline, 'Tablet', { Size: [1, -96, 0, 140], TextSize: 44 });
  b.change(headline, 'Phone', { Size: [1, -48, 0, 160], TextSize: 34 });
  const cta = b.add(hero, 'TextButton', {
    Name: 'Subscribe',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0.66, 0],
    Size: [0, 200, 0, 52],
    BackgroundColor3: ACCENT,
    Text: 'Start a subscription',
    Font: 'GothamBold',
    TextSize: 16,
    TextColor3: [255, 255, 255],
  });
  b.add(cta, 'UICorner', { CornerRadius: [0.5, 0] });

  const pricing = page({ Name: 'Pricing', Path: '/pricing', Title: 'Pricing · Northwind Coffee' });
  nav(pricing);
  const plans = b.add(pricing, 'Frame', {
    Name: 'Plans',
    LayoutOrder: 2,
    Size: [1, 0, 0, 420],
    BackgroundTransparency: 1,
  });
  b.change(plans, 'Phone', { Size: [1, 0, 0, 1000] });
  b.add(plans, 'UIPadding', { PaddingTop: [0, 48], PaddingLeft: [0, 40], PaddingRight: [0, 40] });
  const plansList = b.add(plans, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0, 24],
  });
  b.change(plansList, 'Phone', { FillDirection: 'Vertical' });
  const plan = (name: string, order: number, title: string, price: string) => {
    const card = b.add(plans, 'Frame', {
      Name: name,
      LayoutOrder: order,
      Size: [0, 300, 0, 300],
      BackgroundColor3: [255, 255, 255],
    });
    b.change(card, 'Phone', { Size: [1, 0, 0, 280] });
    b.add(card, 'UICorner', { CornerRadius: [0, 16] });
    b.add(card, 'UIStroke', { Color: [226, 218, 206], Thickness: 1 });
    b.add(card, 'TextLabel', {
      Name: 'PlanName',
      Position: [0, 24, 0, 24],
      Size: [1, -48, 0, 32],
      BackgroundTransparency: 1,
      Text: title,
      Font: 'GothamBold',
      TextSize: 22,
      TextColor3: INK,
      TextXAlignment: 'Left',
    });
    b.add(card, 'TextLabel', {
      Name: 'Price',
      Position: [0, 24, 0, 68],
      Size: [1, -48, 0, 48],
      BackgroundTransparency: 1,
      Text: price,
      Font: 'GothamBlack',
      TextSize: 40,
      TextColor3: ACCENT,
      TextXAlignment: 'Left',
    });
  };
  plan('Taster', 1, 'Taster', '$12 / mo');
  plan('Regular', 2, 'Regular', '$22 / mo');
  plan('Office', 3, 'Office', '$58 / mo');

  // Links need both pages, so they go in last.
  for (const { id, to } of navLinks)
    b.set(id, { Link: { kind: 'page', page: to === 'home' ? home : pricing } });
  b.set(cta, { Link: { kind: 'page', page: pricing, section: 'plans' } });

  return b.doc;
}
