import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App.tsx';

describe('App shell', () => {
  const html = renderToString(<App />);

  it('has the Studio-style regions', () => {
    expect(html).toContain('aria-label="Insert and edit tools"');
    expect(html).toContain('aria-label="Explorer"');
    expect(html).toContain('aria-label="Viewport"');
    expect(html).toContain('aria-label="Properties"');
  });

  it('starts with both side sheets closed', () => {
    expect(html).not.toContain('sheet-open');
  });
});
