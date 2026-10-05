import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

interface PopoverProps {
  /** The element it opens from; clicks on it don't count as clicks outside. */
  anchor: HTMLElement;
  /** Below the anchor, or to its right (from an Explorer row). */
  placement?: 'below' | 'right';
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
    const left = placement === 'right' ? a.right + 6 : a.left;
    const top = placement === 'right' ? a.top - 8 : a.bottom + 6;
    el.style.left = `${Math.max(8, Math.min(left, innerWidth - w - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(top, innerHeight - h - 8))}px`;
  });

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
