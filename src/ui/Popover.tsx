import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

interface PopoverProps {
  /** The element it opens from; clicks on it don't count as clicks outside. */
  anchor: HTMLElement;
  /** Below the anchor, to its right (from an Explorer row) or to its left (from Properties). */
  placement?: 'below' | 'right' | 'left';
  label: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

/** A floating panel next to a button. Escape or a click outside closes it. */
export function Popover({
  anchor,
  placement = 'below',
  label,
  className = 'pop',
  onClose,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Place it next to the anchor, kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left =
      placement === 'right' ? a.right + 6 : placement === 'left' ? a.left - w - 12 : a.left;
    const top = placement === 'below' ? a.bottom + 6 : a.top - 8;
    el.style.left = `${Math.max(8, Math.min(left, innerWidth - w - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(top, innerHeight - h - 8))}px`;
  });

  // Keyboard focus moves in, onto the current choice if there is one.
  useEffect(() => {
    const el = ref.current;
    if (!el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLElement>(
      '[aria-pressed="true"], [aria-checked="true"], input, button:not([disabled])',
    )?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      className={className}
      role="dialog"
      aria-label={label}
      style={{ left: -9999, top: 0 }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
        anchor.focus();
      }}
    >
      {children}
    </div>
  );
}
