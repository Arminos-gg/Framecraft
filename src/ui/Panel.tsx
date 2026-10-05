import type { ReactNode } from 'react';
import { Icon } from './icons.tsx';

interface SidePanelProps {
  title: string;
  className: string;
  /** Open as a sheet on narrow screens. Wide screens always show the panel. */
  open: boolean;
  onClose: () => void;
  /** Shown in the header in place of the title, such as tabs. */
  head?: ReactNode;
  /** Buttons at the right of the header. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A side panel (Explorer, Properties): a header, then the body the caller lays out. */
export function SidePanel({
  title,
  className,
  open,
  onClose,
  head,
  actions,
  children,
}: SidePanelProps) {
  return (
    <aside className={`${className} panel${open ? ' sheet-open' : ''}`} aria-label={title}>
      <div className="phead">
        {head ?? <h2>{title}</h2>}
        <div className="spacer" />
        {actions}
        <button
          className="ibtn sm narrow-only"
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </aside>
  );
}
