import type { ReactNode } from 'react';

interface SidePanelProps {
  title: string;
  className: string;
  /** Open as a sheet on narrow screens. Wide screens always show the panel. */
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** A side panel (Explorer, Properties) with a header and a scrolling body. */
export function SidePanel({ title, className, open, onClose, children }: SidePanelProps) {
  return (
    <aside className={`${className} panel${open ? ' sheet-open' : ''}`} aria-label={title}>
      <div className="phead">
        <h2>{title}</h2>
        <div className="spacer" />
        <button className="btn icon narrow-only" aria-label={`Close ${title}`} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="pbody">{children}</div>
    </aside>
  );
}
