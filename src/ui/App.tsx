import { useState } from 'react';
import { Explorer } from './Explorer.tsx';
import { Properties } from './Properties.tsx';
import { Ribbon } from './Ribbon.tsx';
import { Viewport } from './Viewport.tsx';

/** Which side panel is open as a sheet on narrow screens. Wide screens show both. */
type Sheet = 'explorer' | 'props' | null;

export function App() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const toggle = (next: Exclude<Sheet, null>) => setSheet((cur) => (cur === next ? null : next));

  return (
    <div className="app">
      <header className="bar">
        <div className="wordmark">
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <rect x="1" y="1" width="24" height="24" rx="6.5" fill="var(--accent)" />
            <rect
              x="7"
              y="7"
              width="12"
              height="12"
              rx="2.5"
              fill="none"
              stroke="var(--on-accent)"
              strokeWidth="2"
            />
            <circle cx="13" cy="13" r="2.3" fill="var(--on-accent)" />
            <path
              d="M19 13h4M13 19v4"
              stroke="var(--on-accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <b>Framecraft</b>
          <span className="chip wide-only">Early build</span>
        </div>
        <div className="spacer" />
        <button
          className={`btn narrow-only${sheet === 'explorer' ? ' on' : ''}`}
          aria-expanded={sheet === 'explorer'}
          onClick={() => toggle('explorer')}
        >
          Explorer
        </button>
        <button
          className={`btn narrow-only${sheet === 'props' ? ' on' : ''}`}
          aria-expanded={sheet === 'props'}
          onClick={() => toggle('props')}
        >
          Properties
        </button>
      </header>

      <Ribbon />
      <Explorer open={sheet === 'explorer'} onClose={() => setSheet(null)} />
      <Viewport />
      <Properties open={sheet === 'props'} onClose={() => setSheet(null)} />
    </div>
  );
}
