import type { ClassName, PropsOf } from '../../src/model/classes.ts';
import { applyCommand, insert, remove } from '../../src/model/commands.ts';
import {
  breakpointsOf,
  childOfClass,
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import { pageSubtree } from '../../src/model/builder.ts';
import { blankDoc, blankSiteDoc } from '../../src/model/sample.ts';

/** Documents full of objects with AutomaticSize, for the export checks in auto-size.spec.ts. */

type Add = <C extends ClassName>(parent: InstanceId, c: C, props?: Partial<PropsOf<C>>) => string;

function builder(start: Doc) {
  let doc = start;
  let n = 0;
  const add: Add = (parent, c, props = {}) => {
    const inst = createInstance(c, props, `t${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  return {
    add,
    edit(f: (d: Doc) => Doc) {
      doc = f(doc);
    },
    get doc() {
      return doc;
    },
  };
}

const PARAGRAPH =
  'Collect gems on every island, trade them at the market, and unlock new boats as you go.';

const pad = (b: { add: Add }, id: string, x: number, y = x) =>
  b.add(id, 'UIPadding', {
    PaddingLeft: [0, x],
    PaddingRight: [0, x],
    PaddingTop: [0, y],
    PaddingBottom: [0, y],
  });

/** A screen of objects that grow, in every way the engine handles. */
export function screenDoc(): Doc {
  const b = builder(blankDoc());
  const sg = Object.values(b.doc.instances).find((i) => i.className === 'ScreenGui')!.id;
  const text = { Font: 'Gotham', TextSize: 18, BackgroundColor3: [240, 240, 240] } as const;

  const tag = b.add(sg, 'TextLabel', {
    ...text,
    Name: 'Tag',
    Text: 'Limited offer',
    Position: [0, 20, 0, 20],
    Size: [0, 0, 0, 32],
    AutomaticSize: 'X',
  });
  pad(b, tag, 12, 0);
  b.add(sg, 'TextLabel', {
    ...text,
    Name: 'Centered',
    Text: 'Grows both ways from the middle',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 20],
    Size: [0, 40, 0, 30],
    AutomaticSize: 'X',
  });
  const para = b.add(sg, 'TextLabel', {
    ...text,
    Name: 'Paragraph',
    Text: PARAGRAPH,
    TextWrapped: true,
    TextXAlignment: 'Left',
    Position: [0, 20, 0, 80],
    Size: [0.3, 0, 0, 0],
    AutomaticSize: 'Y',
  });
  pad(b, para, 8);
  b.add(sg, 'TextLabel', {
    ...text,
    Name: 'Lines',
    Text: 'Line one\nLine two\nLine three',
    Position: [0, 20, 0.6, 0],
    Size: [0, 60, 0, 10],
    AutomaticSize: 'XY',
  });
  const narrow = b.add(sg, 'Frame', {
    Name: 'Narrow',
    Position: [0, 20, 0, 300],
    Size: [0, 220, 0, 100],
  });
  b.add(narrow, 'TextLabel', {
    ...text,
    Name: 'Bubble',
    Text: PARAGRAPH,
    TextWrapped: true,
    Size: [0, 0, 0, 0],
    AutomaticSize: 'XY',
  });

  // A card that grows around a list: a title, a paragraph and a row of buttons that grow.
  const card = b.add(sg, 'Frame', {
    Name: 'Card',
    Position: [0.38, 0, 0, 80],
    Size: [0.25, 0, 0, 40],
    AutomaticSize: 'Y',
  });
  pad(b, card, 16);
  b.add(card, 'UIListLayout', { Padding: [0, 10] });
  b.add(card, 'TextLabel', {
    ...text,
    Name: 'Title',
    Text: 'Island pass',
    TextSize: 24,
    Size: [1, 0, 0, 28],
    LayoutOrder: 1,
  });
  b.add(card, 'TextLabel', {
    ...text,
    Name: 'Body',
    Text: PARAGRAPH,
    TextWrapped: true,
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
    LayoutOrder: 2,
  });
  b.add(card, 'Frame', { Name: 'Gone', Size: [1, 0, 0, 300], Visible: false, LayoutOrder: 3 });
  const row = b.add(card, 'Frame', {
    Name: 'Buttons',
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
    BackgroundTransparency: 1,
    LayoutOrder: 4,
  });
  b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0.05, 0] });
  for (const [i, label] of ['Buy', 'Maybe later'].entries()) {
    const button = b.add(row, 'TextButton', {
      ...text,
      Name: label,
      Text: label,
      Size: [0, 0, 0, 36],
      AutomaticSize: 'X',
      LayoutOrder: i,
    });
    pad(b, button, 14, 0);
  }

  // Free-placed children, a Scale backdrop that stretches, and Scale padding.
  const panel = b.add(sg, 'Frame', {
    Name: 'Panel',
    Position: [0.68, 0, 0.05, 0],
    Size: [0, 100, 0, 50],
    AutomaticSize: 'XY',
  });
  b.add(panel, 'UIPadding', {
    PaddingLeft: [0.1, 0],
    PaddingRight: [0, 6],
    PaddingTop: [0.2, 0],
    PaddingBottom: [0, 6],
  });
  b.add(panel, 'Frame', {
    Name: 'Backdrop',
    Size: [1, 0, 1, 0],
    BackgroundColor3: [200, 220, 255],
  });
  b.add(panel, 'Frame', {
    Name: 'Badge',
    AnchorPoint: [1, 0],
    Position: [0, 180, 0, 10],
    Size: [0, 60, 0, 24],
  });
  b.add(panel, 'TextLabel', {
    ...text,
    Name: 'Caption',
    Text: PARAGRAPH,
    TextWrapped: true,
    Position: [0, 10, 0, 60],
    Size: [0, 150, 0, 0],
    AutomaticSize: 'Y',
  });
  const square = b.add(panel, 'Frame', {
    Name: 'Square',
    Position: [0.5, 0, 0, 40],
    Size: [0.3, 0, 0.3, 0],
  });
  b.add(square, 'UIAspectRatioConstraint', { AspectRatio: 1 });

  // A feed whose items grow and push each other down.
  const feed = b.add(sg, 'Frame', {
    Name: 'Feed',
    Position: [0.68, 0, 0.45, 0],
    Size: [0, 260, 0.5, 0],
  });
  b.add(feed, 'UIListLayout', { Padding: [0, 6] });
  for (const [i, words] of ['Short one.', PARAGRAPH, 'Another short one.'].entries())
    b.add(feed, 'TextLabel', {
      ...text,
      Name: `Item ${i + 1}`,
      Text: words,
      TextWrapped: true,
      Size: [1, 0, 0, 20],
      AutomaticSize: 'Y',
      LayoutOrder: i,
    });

  b.add(sg, 'TextBox', {
    ...text,
    Name: 'Search',
    Text: '',
    PlaceholderText: 'Search the catalog',
    Position: [0, 20, 0.85, 0],
    Size: [0, 120, 0, 32],
    AutomaticSize: 'X',
  });
  return b.doc;
}

/** A website: sections that grow on a page with a list, and a section on a free page. */
export function siteDoc(): Doc {
  const b = builder(blankSiteDoc());
  const home = Object.values(b.doc.instances).find((i) => i.props.Name === 'Home')!.id;
  const text = { Font: 'BuilderSans', BackgroundTransparency: 1 } as const;
  const hero = b.add(home, 'Frame', {
    Name: 'Hero',
    Size: [1, 0, 0, 200],
    AutomaticSize: 'Y',
    BackgroundColor3: [20, 24, 40],
    LayoutOrder: 1,
  });
  pad(b, hero, 40, 64);
  b.add(hero, 'UIListLayout', { Padding: [0, 16], HorizontalAlignment: 'Center' });
  b.add(hero, 'TextLabel', {
    ...text,
    Name: 'Headline',
    Text: 'Build websites the way you build Roblox UI',
    TextSize: 56,
    TextWrapped: true,
    TextColor3: [255, 255, 255],
    Size: [0.7, 0, 0, 0],
    AutomaticSize: 'Y',
    HtmlTag: 'h1',
    LayoutOrder: 1,
  });
  b.add(hero, 'TextLabel', {
    ...text,
    Name: 'Lead',
    Text: PARAGRAPH,
    TextSize: 20,
    TextWrapped: true,
    TextColor3: [200, 205, 220],
    Size: [0.5, 0, 0, 0],
    AutomaticSize: 'Y',
    LayoutOrder: 2,
  });
  const cta = b.add(hero, 'TextButton', {
    ...text,
    Name: 'Start',
    Text: 'Start building',
    TextSize: 18,
    BackgroundTransparency: 0,
    Size: [0, 0, 0, 48],
    AutomaticSize: 'X',
    LayoutOrder: 3,
  });
  pad(b, cta, 24, 0);

  const features = b.add(home, 'Frame', {
    Name: 'Features',
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
    LayoutOrder: 2,
  });
  pad(b, features, 40);
  b.add(features, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 24] });
  for (const [i, words] of ['Scale and Offset', PARAGRAPH, 'Breakpoints'].entries()) {
    const card = b.add(features, 'Frame', {
      Name: `Feature ${i + 1}`,
      Size: [0.3, 0, 0, 120],
      AutomaticSize: 'Y',
      LayoutOrder: i,
    });
    pad(b, card, 20);
    b.add(card, 'TextLabel', {
      ...text,
      Name: `Feature ${i + 1} text`,
      Text: words,
      TextSize: 18,
      TextWrapped: true,
      TextXAlignment: 'Left',
      Size: [1, 0, 0, 0],
      AutomaticSize: 'Y',
    });
  }
  const note = b.add(home, 'TextLabel', {
    ...text,
    Name: 'Note',
    Text: PARAGRAPH,
    TextSize: 16,
    TextWrapped: true,
    Size: [1, 0, 0, 30],
    LayoutOrder: 3,
  });
  // Phone wraps the note onto more lines, so it grows only there, and the cards stack.
  const phone = breakpointsOf(b.doc).find((p) => p.props.Name === 'Phone')!.id;
  b.edit(
    (d) =>
      applyCommand(d, {
        type: 'setProps',
        id: note,
        props: { AutomaticSize: 'Y' },
        breakpoint: phone,
      }).doc,
  );
  const list = childOfClass(b.doc, features, 'UIListLayout')!.id;
  b.edit(
    (d) =>
      applyCommand(d, {
        type: 'setProps',
        id: list,
        props: { FillDirection: 'Vertical' },
        breakpoint: phone,
      }).doc,
  );
  for (const i of [1, 2, 3]) {
    const card = Object.values(b.doc.instances).find((x) => x.props.Name === `Feature ${i}`)!.id;
    b.edit(
      (d) =>
        applyCommand(d, {
          type: 'setProps',
          id: card,
          props: { Size: [1, 0, 0, 80] },
          breakpoint: phone,
        }).doc,
    );
  }

  // A page without a list: a free-placed section that grows pushes the page longer.
  const site = serviceOf(b.doc, 'Site').id;
  b.edit((d) => applyCommand(d, insert(site, pageSubtree({ Name: 'Free', Path: '/free' }))).doc);
  const free = Object.values(b.doc.instances).find((i) => i.props.Name === 'Free')!.id;
  b.edit((d) => applyCommand(d, remove(childOfClass(d, free, 'UIListLayout')!.id)).doc);
  const story = b.add(free, 'Frame', {
    Name: 'Story',
    Position: [0.1, 0, 0.5, 0],
    Size: [0.8, 0, 0, 100],
    AutomaticSize: 'Y',
  });
  pad(b, story, 24);
  b.add(story, 'TextLabel', {
    ...text,
    Name: 'Story text',
    Text: Array.from({ length: 12 }, () => PARAGRAPH).join(' '),
    TextSize: 22,
    TextWrapped: true,
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
  });
  return b.doc;
}
