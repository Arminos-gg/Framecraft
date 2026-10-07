/**
 * Draws the user's UI as real DOM, one element per object, at the pixel boxes the layout engine
 * worked out. Colors come only from the objects' own properties. It reads every value at the
 * scene's breakpoint, so a page shown at Phone looks as it will on a phone.
 */
import { memo, useEffect, useLayoutEffect, useReducer, useRef, type CSSProperties } from 'react';
import { rgb, rgba, roundTo } from '../../export/format.ts';
import {
  ALIGN_X,
  ALIGN_Y,
  gradientCss,
  isGui,
  isTinted,
  maskCss,
  OBJECT_FIT,
  strokesText,
  textRing,
  tintId,
  tintKey,
  tintMatrix,
  type Gui,
} from '../../export/html.ts';
import type { Scene } from '../../editor/editor.ts';
import { udimPx, type Rect } from '../../layout/layout.ts';
import type { Assets } from '../../model/assets.ts';
import { classDef } from '../../model/classes.ts';
import { faceOf, fontCss } from '../../model/fonts.ts';
import {
  childOfClass,
  childrenOf,
  drawnChildren,
  getInstance,
  resolveProps,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../../model/document.ts';
import { clearFitCache, fitTexts } from './fit.ts';

interface StageProps {
  doc: Doc;
  scene: Scene;
  assets: Assets;
  preview: boolean;
}

interface Ctx extends StageProps {
  props<I extends AnyInstance>(inst: I): I['props'];
}

/** The objects drawn inside `id`, those in its Folders included. */
const guiChildren = (doc: Doc, id: InstanceId): Gui[] => drawnChildren(doc, id).filter(isGui);

export const Stage = memo(function Stage({ doc, scene, assets, preview }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fontsLoaded, refit] = useReducer((n: number) => n + 1, 0);

  // TextScaled sizes depend on the loaded fonts, so measure again when fonts arrive.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const onLoad = () => {
      clearFitCache();
      refit();
    };
    fonts.addEventListener('loadingdone', onLoad);
    return () => fonts.removeEventListener('loadingdone', onLoad);
  }, []);
  useLayoutEffect(() => {
    if (ref.current) fitTexts(ref.current);
  });

  const ctx: Ctx = {
    doc,
    scene,
    assets,
    preview,
    props: (inst) => resolveProps(doc, inst as Instance, scene.breakpoint) as typeof inst.props,
  };
  const origin = { x: 0, y: 0, w: scene.width, h: scene.height };

  if (scene.view.kind === 'page') {
    const page = getInstance(doc, scene.view.pageId);
    if (page?.className !== 'Page') return null;
    const { BackgroundColor3, BackgroundTransparency } = ctx.props(page);
    // A see-through page shows the editor's measuring grid behind it.
    return (
      <div
        ref={ref}
        className="screen"
        data-fonts={fontsLoaded}
        style={{
          background: BackgroundTransparency
            ? rgba(BackgroundColor3, BackgroundTransparency)
            : rgb(BackgroundColor3),
        }}
      >
        <TintDefs ctx={ctx} />
        {guiChildren(doc, page.id).map((c) => (
          <GuiView key={c.id} inst={c} origin={origin} ctx={ctx} />
        ))}
      </div>
    );
  }
  return (
    <div ref={ref} className="screen" data-fonts={fontsLoaded}>
      <TintDefs ctx={ctx} />
      {scene.roots.map((id, i) => {
        const sg = getInstance(doc, id);
        if (sg?.className !== 'ScreenGui') return null;
        return (
          <div
            key={id}
            className="sglayer"
            style={{ zIndex: i + 1, display: sg.props.Enabled ? undefined : 'none' }}
          >
            {guiChildren(doc, id).map((c) => (
              <GuiView key={c.id} inst={c} origin={origin} ctx={ctx} />
            ))}
          </div>
        );
      })}
    </div>
  );
});

function GuiView({ inst, origin, ctx }: { inst: Gui; origin: Rect; ctx: Ctx }) {
  const { doc, scene } = ctx;
  const b = scene.layout.get(inst.id);
  if (!b) return null;
  const p = ctx.props(inst);
  const def = classDef(inst.className);
  const style: CSSProperties = {
    left: b.x - origin.x,
    top: b.y - origin.y,
    width: b.w,
    height: b.h,
    zIndex: p.ZIndex,
  };
  if (!b.visible) style.display = 'none';
  if (b.rotation) style.transform = `rotate(${b.rotation}deg)`;

  const gradient = childOfClass(doc, inst.id, 'UIGradient');
  const g = gradient && ctx.props(gradient);
  if (p.BackgroundTransparency < 1) {
    style.backgroundColor = rgba(p.BackgroundColor3, p.BackgroundTransparency);
    if (g) {
      style.backgroundImage = gradientCss(g.Color, g.Rotation);
      style.backgroundBlendMode = 'multiply';
    }
  }
  if (g && g.Transparency.some((k) => k.value)) {
    style.maskImage = style.WebkitMaskImage = maskCss(g.Transparency, g.Rotation);
  }
  const corner = childOfClass(doc, inst.id, 'UICorner');
  if (corner) {
    const shorter = Math.min(b.w, b.h);
    const r = udimPx(ctx.props(corner).CornerRadius, shorter);
    style.borderRadius = Math.max(0, Math.min(r, shorter / 2));
  }
  const strokes = childrenOf(doc, inst.id).filter(
    (k): k is Instance<'UIStroke'> & AnyInstance => k.className === 'UIStroke',
  );
  const shadows: string[] = [];
  if (p.BorderSizePixel > 0 && !corner && p.BackgroundTransparency < 1)
    shadows.push(`0 0 0 ${p.BorderSizePixel}px ${rgba(p.BorderColor3, p.BackgroundTransparency)}`);
  for (const s of strokes) {
    const sp = ctx.props(s);
    if (sp.Thickness > 0 && !strokesText(inst, s))
      shadows.push(`0 0 0 ${sp.Thickness}px ${rgba(sp.Color, sp.Transparency)}`);
  }
  if (shadows.length) style.boxShadow = shadows.join(', ');
  if (p.ClipsDescendants || def.scroll) style.overflow = 'hidden';

  const classes = ['gui'];
  if (
    (inst.className === 'TextButton' || inst.className === 'ImageButton') &&
    inst.props.AutoButtonColor
  )
    classes.push('btnlike');
  if (inst.props.Link) classes.push('linked');

  const kids = guiChildren(doc, inst.id);
  let content = null;
  if (b.canvas) {
    const canvas = b.canvas;
    content = (
      <div
        className="content"
        style={{
          left: 0,
          top: 0,
          width: b.w,
          height: b.h,
          overflow: ctx.preview ? 'auto' : 'hidden',
        }}
      >
        <div className="canvasbox" style={{ width: canvas.w, height: canvas.h }}>
          {kids.map((k) => (
            <GuiView key={k.id} inst={k} origin={canvas} ctx={ctx} />
          ))}
        </div>
      </div>
    );
  } else if (kids.length) {
    content = (
      <div
        className="content"
        style={{
          left: b.content.x - b.x,
          top: b.content.y - b.y,
          width: b.content.w,
          height: b.content.h,
        }}
      >
        {kids.map((k) => (
          <GuiView key={k.id} inst={k} origin={b.content} ctx={ctx} />
        ))}
      </div>
    );
  }

  return (
    <div className={classes.join(' ')} data-id={inst.id} style={style}>
      {(inst.className === 'ImageLabel' || inst.className === 'ImageButton') && (
        <ImageView inst={inst} ctx={ctx} />
      )}
      {(inst.className === 'TextLabel' ||
        inst.className === 'TextButton' ||
        inst.className === 'TextBox') && <TextView inst={inst} ctx={ctx} />}
      {content}
    </div>
  );
}

/** The color filters for every tinted picture (see `tintDefs` in the HTML export). */
function TintDefs({ ctx }: { ctx: Ctx }) {
  const keys = new Set<string>();
  for (const inst of Object.values(ctx.doc.instances)) {
    if ((inst.className !== 'ImageLabel' && inst.className !== 'ImageButton') || !inst.preview)
      continue;
    const c = ctx.props(inst).ImageColor3;
    if (isTinted(c)) keys.add(tintKey(c));
  }
  if (!keys.size) return null;
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      {[...keys].map((k) => (
        <filter key={k} id={tintId(k)} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={tintMatrix(k)} />
        </filter>
      ))}
    </svg>
  );
}

function ImageView({ inst, ctx }: { inst: Instance<'ImageLabel' | 'ImageButton'>; ctx: Ctx }) {
  const p = ctx.props(inst as AnyInstance) as Instance<'ImageLabel'>['props'];
  const src = inst.preview ? ctx.assets[inst.preview] : undefined;
  if (src)
    return (
      <img
        className="pic"
        alt=""
        src={src}
        style={{
          objectFit: OBJECT_FIT[p.ScaleType],
          opacity: roundTo(1 - p.ImageTransparency, 3),
          filter: isTinted(p.ImageColor3) ? `url(#${tintId(tintKey(p.ImageColor3))})` : undefined,
        }}
      />
    );
  return (
    <div className="ph">{p.Image ? p.Image.replace(/^rbxassetid:\/\//, 'asset ') : 'no image'}</div>
  );
}

const PLACEHOLDER: readonly [number, number, number] = [178, 178, 178];

function TextView({
  inst,
  ctx,
}: {
  inst: Instance<'TextLabel' | 'TextButton' | 'TextBox'> & AnyInstance;
  ctx: Ctx;
}) {
  const b = ctx.scene.layout.get(inst.id)!;
  const p = ctx.props(inst);
  const isBox = inst.className === 'TextBox';
  const placeholder = isBox && !p.Text && !ctx.preview;
  const font = fontCss(faceOf(p));
  const strokes = childrenOf(ctx.doc, inst.id)
    .filter((k): k is Instance<'UIStroke'> & AnyInstance => k.className === 'UIStroke')
    .map((s) => ({ s, sp: ctx.props(s) }))
    .filter(({ s, sp }) => sp.Thickness > 0 && strokesText(inst, s));
  const span: CSSProperties = {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.style,
    textAlign:
      p.TextXAlignment === 'Left' ? 'left' : p.TextXAlignment === 'Right' ? 'right' : 'center',
    color: rgba(placeholder ? PLACEHOLDER : p.TextColor3, p.TextTransparency),
    fontSize: p.TextScaled ? 10 : p.TextSize,
    lineHeight: p.LineHeight,
    // Letter spacing is web only, so it shows on pages only.
    letterSpacing: ctx.scene.view.kind === 'page' && p.LetterSpacing ? p.LetterSpacing : undefined,
  };
  if (strokes.length)
    span.textShadow = strokes
      .map(({ sp }) =>
        textRing(sp.Thickness, rgba(sp.Color, Math.max(sp.Transparency, p.TextTransparency))),
      )
      .join(', ');
  const editable = isBox && ctx.preview;
  const c = b.content;
  return (
    <div
      className={p.TextWrapped ? 'txt wrap' : 'txt'}
      data-fit={p.TextScaled ? '1' : undefined}
      style={{
        left: c.x - b.x,
        top: c.y - b.y,
        width: c.w,
        height: c.h,
        justifyContent: ALIGN_X[p.TextXAlignment],
        alignItems: ALIGN_Y[p.TextYAlignment],
        pointerEvents: editable ? 'auto' : undefined,
      }}
    >
      <span
        style={span}
        contentEditable={editable || undefined}
        suppressContentEditableWarning
        spellCheck={editable ? false : undefined}
        data-ph={editable && isBox ? inst.props.PlaceholderText : undefined}
      >
        {placeholder && isBox ? inst.props.PlaceholderText : p.Text}
      </span>
    </div>
  );
}
