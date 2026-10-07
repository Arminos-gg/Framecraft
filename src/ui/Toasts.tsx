/**
 * The toast at the bottom of the window: a short message after an action, with a button such
 * as Undo. It slides in, shows how long it stays with a shrinking bar, waits while the pointer
 * rests on it, and slides out.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { Toast } from '../editor/editor.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { Icon, type IconName } from './icons.tsx';

const ICONS: Record<NonNullable<Toast['tone']> | 'info', IconName> = {
  delete: 'trash',
  done: 'check',
  info: 'info',
};

export function Toasts() {
  const editor = useEditor();
  const { toast } = useEditorState();
  // The last toast stays on screen a moment after it goes, to slide out.
  const [last, setLast] = useState<Toast | null>(toast);
  if (toast && toast !== last) setLast(toast);
  const leaving = !toast && last !== null;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLast(null), 220);
    return () => clearTimeout(t);
  }, [leaving]);
  if (!last) return null;

  const tone = last.tone ?? 'info';
  return (
    <div className="toasts">
      <div
        className={`toast ${tone}${leaving ? ' out' : ''}`}
        role="status"
        key={last.id}
        style={{ '--life': `${last.duration}ms` } as CSSProperties}
        onPointerEnter={() => editor.holdToast(true)}
        onPointerLeave={() => editor.holdToast(false)}
      >
        <span className="tico" aria-hidden="true">
          <Icon name={ICONS[tone]} />
        </span>
        <span className="ttext">
          <b>{last.text}</b>
          {last.detail && <small>{last.detail}</small>}
        </span>
        {last.action && (
          <button
            type="button"
            className="tact"
            disabled={leaving}
            onClick={() => {
              editor.dismissToast();
              last.action!.run();
            }}
          >
            {last.action.label === 'Undo' && <Icon name="undo" />}
            {last.action.label}
          </button>
        )}
        <button
          type="button"
          className="tclose"
          aria-label="Dismiss"
          title="Dismiss"
          disabled={leaving}
          onClick={() => editor.dismissToast()}
        >
          <Icon name="close" />
        </button>
        {!leaving && <i className="tlife" />}
      </div>
    </div>
  );
}
