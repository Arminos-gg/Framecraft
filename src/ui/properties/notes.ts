/** Short notes under a Properties section, explaining how Roblox (or the web export) reads it. */
import { classDef, type Category } from '../../model/classes.ts';
import { formOf, getInstance, type AnyInstance, type Doc } from '../../model/document.ts';

/**
 * Whether Properties shows a property that only means something in some places: a TextBox's
 * form fields inside a Form, a gradient's ApplyTo on a text object, and the settings of the
 * Embed kind picked.
 */
export function showsProp(
  doc: Doc,
  inst: AnyInstance,
  key: string,
  values: Readonly<Record<string, unknown>>,
): boolean {
  switch (key) {
    case 'InputType':
    case 'Required':
      return inst.className !== 'TextBox' || !!formOf(doc, inst.id);
    case 'ApplyTo': {
      if (inst.className !== 'UIGradient') return true;
      const parent = inst.parent === null ? undefined : getInstance(doc, inst.parent);
      return !!parent && !!classDef(parent.className).text && parent.className !== 'TextBox';
    }
    case 'Autoplay':
      return inst.className !== 'Embed' || values.Kind === 'YouTube';
    case 'Zoom':
      return inst.className !== 'Embed' || values.Kind === 'Map';
  }
  return true;
}

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
  if (def.image)
    notes.Image = onSite
      ? 'Takes PNG, JPG, SVG and more. ImageColor3 tints the picture: white leaves it as it is, and a white picture takes the color exactly.'
      : 'The picture shows here and in the HTML export. Roblox can’t use it, so add the image’s asset id for Studio. ImageColor3 tints it, as in Roblox.';
  switch (inst.className) {
    case 'ScreenGui':
      notes.Behavior =
        'Export turns IgnoreGuiInset on, so Roblox’s top bar doesn’t push the layout down.';
      break;
    case 'ScrollingFrame':
      notes.Scrolling =
        values.AutomaticCanvasSize !== 'None'
          ? 'AutomaticCanvasSize is on, so the scrolling area grows to fit the children, and CanvasSize is the smallest it gets.'
          : 'CanvasSize is the area you can scroll through. AutomaticCanvasSize can grow it to fit the children.';
      break;
    case 'UIStroke':
      notes.Stroke = onSite
        ? 'On text objects, Contextual outlines the letters. Border outlines the box, and Top, Right, Bottom and Left pick its sides.'
        : 'On text objects, Contextual outlines the letters. Border outlines the box.';
      break;
    case 'UIHover':
      notes.Hover =
        'While the mouse is over the object, it takes these colors, grows by Scale and moves up by Lift pixels, over Duration seconds. Try it in preview. TextColor3 only matters on text.';
      break;
    case 'UIGradient':
      notes.Gradient =
        values.ApplyTo === 'Text' && onSite
          ? 'Colors the letters instead of the background, times TextColor3, so white text takes the gradient exactly. Rotation 0 runs left to right, 90 top to bottom. Gradient letters have no outline.'
          : 'Multiplies the parent’s background color. Rotation 0 runs left to right, 90 top to bottom.';
      break;
    case 'Form':
      notes.Form =
        'Action is where the form sends what people type: a form service’s address, such as https://formspree.io/f/your-id from formspree.io, which emails it to you. Each TextBox is a field named by its Name, and its buttons send it. Then they say SentText.';
      break;
    case 'Embed':
      notes.Embed =
        values.Kind === 'Map'
          ? 'Type an address or a place in Source. Zoom runs from 1 (the world) to 20 (a building). Try it in preview.'
          : 'Paste a YouTube link in Source; a time in it (t=90) starts the video there. Autoplay starts it muted. Try it in preview.';
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
        'With BaseUrl set to your site’s address, such as https://example.com, pages get canonical links and social previews. SmoothScroll makes links to a section of the same page glide there.';
      break;
    case 'Breakpoint':
      notes.Breakpoint =
        'Pages show this breakpoint’s changes in windows up to MaxWidth pixels wide. The viewport previews it at PreviewWidth × PreviewHeight.';
      break;
  }
  if (inst.className === 'TextBox' && values.InputType !== undefined)
    notes.Form =
      'In a Form, this box is a field named by its Name. Email, Phone, Number and Url get the right keyboard on phones and are checked before sending; LongText is a box for a message.';
  if (def.image && onSite)
    notes.Filters =
      'Photo filters for the website: Grayscale and Sepia from 0 to 1, Brightness, Contrast and Saturation where 1 leaves the picture as it is, and Blur in pixels.';
  if (classDef(inst.className).web && def.kind === 'gui' && !notes.Web)
    notes.Web =
      'Cursor is the mouse pointer over it.' +
      (values.Pinned === true
        ? ' Pinned keeps it on screen while the page scrolls; in a list it sticks to the top.'
        : '');
  if (def.kind === 'gui' && !notes.Web)
    notes.Web =
      'Link makes the object a link to a page, a section of a page (by its name) or another site. HtmlTag picks the element it becomes on the website, and Cursor is the mouse pointer over it.' +
      (values.Pinned === true
        ? ' Pinned keeps it on screen while the page scrolls; in a list it sticks to the top.'
        : '');
  if (def.kind === 'gui' && onSite && values.Appear !== undefined)
    notes.Animation =
      'Appear plays once, the first time the object scrolls into view. AppearDelay staggers objects that come in together. Try it in preview.';
  if (
    def.kind === 'gui' &&
    onSite &&
    typeof values.BackgroundBlur === 'number' &&
    values.BackgroundBlur > 0
  )
    notes.Appearance =
      'BackgroundBlur blurs what’s behind the object. Make the background partly see-through to get frosted glass.';
  return notes;
}
