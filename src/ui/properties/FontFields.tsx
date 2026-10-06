/**
 * The Properties panel's font editors: a font menu that shows each font in its own letters,
 * and a weight picker with a Bold toggle.
 */
import { useEffect, useRef, useState } from 'react';
import {
  FONT_GROUPS,
  FONT_WEIGHTS,
  FONTS,
  fontCss,
  webWeight,
  type FontKind,
  type FontName,
  type FontWeight,
} from '../../model/fonts.ts';
import { Icon } from '../icons.tsx';
import { Popover } from '../Popover.tsx';

const KIND: Record<FontKind, string> = {
  sans: 'Sans',
  serif: 'Serif',
  mono: 'Mono',
  display: 'Display',
};

const MENU_FONTS_ID = 'framecraft-font-menu';
/** The menu's own copies of the fonts go by another name, so they never stand in for text. */
const MENU_PREFIX = 'Menu ';

/**
 * Loads every font in the menu at Regular, with only the letters of the font names, so the
 * menu can show each font in its own letters without loading whole fonts. Those cut-down
 * fonts are renamed, so the user's text always gets the whole font.
 */
function loadMenuFonts() {
  if (document.getElementById(MENU_FONTS_ID)) return;
  const style = document.createElement('style');
  style.id = MENU_FONTS_ID;
  document.head.appendChild(style);
  const families = [...new Set(Object.values(FONTS).map((f) => f.web))];
  const letters = [...new Set(Object.values(FONTS).flatMap((f) => [...f.label]))].sort().join('');
  const href =
    'https://fonts.googleapis.com/css2?' +
    families.map((f) => 'family=' + f.replace(/ /g, '+')).join('&') +
    '&text=' +
    encodeURIComponent(letters) +
    '&display=swap';
  fetch(href)
    .then((r) => (r.ok ? r.text() : ''))
    .then((css) => {
      style.textContent = css.replace(/font-family: '([^']+)'/g, `font-family: '${MENU_PREFIX}$1'`);
    })
    // Offline, the menu shows the names in the editor's own font.
    .catch(() => style.remove());
}

/** The font menu's own look for a font: its family at Regular. */
const previewStyle = (font: FontName) => {
  const css = fontCss({ font, weight: 'Regular', style: 'Normal' });
  return {
    fontFamily: `"${MENU_PREFIX}${FONTS[font].web}", ${css.family}`,
    fontWeight: css.weight,
  };
};

/**
 * Font: a button showing the font in its own letters, which opens a searchable menu. On the
 * website the web fonts come first; on the Roblox screens Roblox's own fonts do, and a web
 * font says which Roblox font stands in for it in the Roblox exports.
 */
export function FontField({
  id,
  value,
  onSite,
  onChange,
}: {
  id: string;
  value: FontName;
  onSite: boolean;
  onChange: (font: FontName) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  return (
    <span className="selw">
      <button
        id={id}
        type="button"
        className="fld txt fontbtn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Font: ${FONTS[value].label}`}
        style={previewStyle(value)}
        onClick={(e) => setAnchor(open ? null : e.currentTarget)}
      >
        {FONTS[value].label}
      </button>
      <Icon name="chevDown" />
      {anchor && (
        <FontMenu
          anchor={anchor}
          value={value}
          onSite={onSite}
          onPick={(font) => {
            setAnchor(null);
            anchor.focus();
            if (font !== value) onChange(font);
          }}
          onClose={() => setAnchor(null)}
        />
      )}
    </span>
  );
}

function FontMenu({
  anchor,
  value,
  onSite,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  value: FontName;
  onSite: boolean;
  onPick: (font: FontName) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const list = useRef<HTMLDivElement>(null);
  useEffect(loadMenuFonts, []);

  const q = query.trim().toLowerCase();
  const matches = (f: FontName) => {
    const font = FONTS[f];
    return (
      !q ||
      font.label.toLowerCase().includes(q) ||
      font.web.toLowerCase().includes(q) ||
      KIND[font.kind].toLowerCase().includes(q)
    );
  };
  const groups = (onSite ? FONT_GROUPS : [...FONT_GROUPS].reverse()).map((g) => ({
    ...g,
    fonts: g.fonts.filter(matches),
  }));
  const choices = groups.flatMap((g) => g.fonts);
  const [hi, setHi] = useState(() => Math.max(0, choices.indexOf(value)));
  const current = choices[Math.min(hi, choices.length - 1)];

  // Keep the highlighted font in view, the current one when the menu opens.
  useEffect(() => {
    if (current === choices[0]) list.current?.scrollTo({ top: 0 });
    else list.current?.querySelector<HTMLElement>('.mi.hi')?.scrollIntoView({ block: 'nearest' });
  }, [current, choices]);

  /** What the right-hand side says about a font. */
  const detail = (f: FontName) => {
    const font = FONTS[f];
    if (!onSite && font.webOnly) return `${font.roblox} in Roblox`;
    if (onSite && font.label !== font.web) return font.web;
    return KIND[font.kind];
  };

  return (
    <Popover anchor={anchor} label="Fonts" className="pop fontpop" onClose={onClose}>
      <label className="filter">
        <span className="sr">Search fonts</span>
        <Icon name="search" />
        <input
          type="search"
          placeholder="Search fonts"
          autoComplete="off"
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="font-menu-list"
          aria-activedescendant={current ? `font-${current}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            const i = current ? choices.indexOf(current) : -1;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setHi(Math.max(0, Math.min(choices.length - 1, i + step)));
            } else if (e.key === 'Enter' && current) {
              e.preventDefault();
              onPick(current);
            }
          }}
        />
      </label>
      <div className="poplist" id="font-menu-list" role="listbox" aria-label="Fonts" ref={list}>
        {groups.map(
          (g) =>
            g.fonts.length > 0 && (
              <div key={g.name} role="group" aria-label={g.name}>
                <h4>{g.name}</h4>
                {g.fonts.map((f) => (
                  <button
                    key={f}
                    id={`font-${f}`}
                    type="button"
                    role="option"
                    aria-selected={f === value}
                    tabIndex={-1}
                    className={f === current ? 'mi hi' : 'mi'}
                    onClick={() => onPick(f)}
                    onPointerEnter={() => setHi(choices.indexOf(f))}
                  >
                    <span className="fname" style={previewStyle(f)}>
                      {FONTS[f].label}
                    </span>
                    <span className="d">{detail(f)}</span>
                    {f === value && <Icon name="check" />}
                  </button>
                ))}
              </div>
            ),
        )}
        {!choices.length && <p className="popempty">No font matches “{query}”.</p>}
      </div>
    </Popover>
  );
}

/**
 * FontWeight: the weights the font has, each with its number, and a Bold toggle (Ctrl+B).
 * A weight the font lacks stays listed while it's picked; the font draws its nearest one.
 */
export function FontWeightField({
  id,
  font,
  value,
  onChange,
}: {
  id: string;
  font: FontName;
  value: FontWeight;
  onChange: (weight: FontWeight) => void;
}) {
  const has = new Set(FONTS[font].weights);
  const options = (Object.keys(FONT_WEIGHTS) as FontWeight[]).filter(
    (w) => w === value || has.has(FONT_WEIGHTS[w]) || (w === 'Regular' && FONTS[font].regular),
  );
  const bold = FONT_WEIGHTS[value] >= FONT_WEIGHTS.SemiBold;
  const drawn = webWeight(font, value);
  return (
    <span className="wfld">
      <span className="selw">
        <select
          id={id}
          className="fld txt"
          aria-label="FontWeight"
          value={value}
          onChange={(e) => onChange(e.target.value as FontWeight)}
        >
          {options.map((w) => (
            <option key={w} value={w}>
              {w} · {FONT_WEIGHTS[w]}
            </option>
          ))}
        </select>
        <Icon name="chevDown" />
      </span>
      <button
        type="button"
        className={bold ? 'ibtn boldbtn on' : 'ibtn boldbtn'}
        aria-pressed={bold}
        aria-label="Bold"
        title={
          drawn !== FONT_WEIGHTS[value] && !FONTS[font].regular
            ? `Bold (Ctrl+B). ${FONTS[font].label} has no ${FONT_WEIGHTS[value]}, so it draws at ${drawn}.`
            : 'Bold (Ctrl+B)'
        }
        onClick={() => onChange(bold ? 'Regular' : 'Bold')}
      >
        B
      </button>
    </span>
  );
}
