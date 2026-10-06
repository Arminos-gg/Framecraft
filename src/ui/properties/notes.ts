/** Short notes under a Properties section, explaining how Roblox (or the web export) reads it. */
import { classDef, type Category } from '../../model/classes.ts';
import type { AnyInstance } from '../../model/document.ts';

export function notesFor(
  inst: AnyInstance,
  values: Readonly<Record<string, unknown>>,
  listItem: boolean,
  onSite: boolean,
): Partial<Record<Category, string>> {
  const notes: Partial<Record<Category, string>> = {};
  const def = classDef(inst.className);
  const transform: string[] = [];
  if (listItem)
    transform.push(
      'A UIListLayout in the parent places this object, so Position, AnchorPoint and Rotation are ignored. Size still applies, and LayoutOrder sets the order.',
    );
  if (values.AutomaticSize !== undefined && values.AutomaticSize !== 'None')
    transform.push(
      'AutomaticSize is on, so the object grows to fit its text and children, and Size is the smallest it gets.',
    );
  if (transform.length) notes.Transform = transform.join(' ');
  if (values.TextScaled === true)
    notes.Text = 'TextScaled is on, so the text grows to fill the box and TextSize is ignored.';
  if (def.image && !onSite)
    notes.Image =
      'The picture shows here and in the HTML export. Roblox can’t use it, so add the image’s asset id for Studio.';
  switch (inst.className) {
    case 'ScreenGui':
      notes.Behavior =
        'Export turns IgnoreGuiInset on, so Roblox’s top bar doesn’t push the layout down.';
      break;
    case 'UIStroke':
      notes.Stroke = 'On text objects, Contextual outlines the letters. Border outlines the box.';
      break;
    case 'UIGradient':
      notes.Gradient =
        'Multiplies the parent’s background color. Rotation 0 runs left to right, 90 top to bottom.';
      break;
    case 'UIListLayout':
      notes.Layout = 'Stacks the parent’s children in LayoutOrder and ignores their Position.';
      break;
    case 'UIAspectRatioConstraint':
      notes.Constraint =
        'Keeps width ÷ height at this ratio, shrinking whichever side is too long.';
      break;
    case 'UIPadding':
      notes.Padding =
        'Shrinks the area children are laid out in. A percent is of the parent’s width or height.';
      break;
    case 'UICorner':
      notes.Corner = 'A percent is of the shorter side, so 50% makes a pill or a circle.';
      break;
    case 'Page':
      notes.Web =
        'Path is the page’s address, such as /pricing; the page at / is the home page. Title and Description show in search results and link previews.';
      break;
    case 'Site':
      notes.Web =
        'With BaseUrl set to your site’s address, such as https://example.com, pages get canonical links and social previews.';
      break;
    case 'Breakpoint':
      notes.Breakpoint =
        'Pages show this breakpoint’s changes in windows up to MaxWidth pixels wide. The viewport previews it at PreviewWidth × PreviewHeight.';
      break;
  }
  if (def.kind === 'gui' && !notes.Web)
    notes.Web =
      'Link makes the object a link to a page, a section of a page (by its name) or another site. HtmlTag picks the element it becomes on the website.';
  return notes;
}
