/**
 * Starting documents: the sample game menu from the prototype, and a blank project.
 */
import type { ClassName, PropsOf } from './classes.ts';
import { applyCommand, insert } from './commands.ts';
import {
  createInstance,
  newId,
  rootOnlyDoc,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from './document.ts';
import { colorSequence, type Color3 } from './values.ts';

/** Builds a document by inserting instances one at a time, through the same commands the editor uses. */
class Builder {
  doc: Doc = rootOnlyDoc();
  readonly makeId: () => InstanceId;
  constructor(makeId: () => InstanceId) {
    this.makeId = makeId;
  }

  add<C extends ClassName>(parentId: InstanceId, className: C, props: Partial<PropsOf<C>> = {}) {
    const inst = createInstance(className, props, this.makeId()) as unknown as AnyInstance;
    this.doc = applyCommand(this.doc, insert(parentId, single(inst))).doc;
    return inst.id;
  }
}

export function blankDoc(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  b.add(b.doc.rootId, 'ScreenGui');
  return b.doc;
}

/** A game main menu: a coin counter, a centered panel with a title and a list of buttons. */
export function sampleDoc(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const sg = b.add(b.doc.rootId, 'ScreenGui', { Name: 'MainMenu' });

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
