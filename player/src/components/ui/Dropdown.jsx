import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Drop falsy entries and leading/trailing/duplicate dividers produced by conditional items. */
function cleanItems(items) {
  const out = [];
  items.filter(Boolean).forEach((item) => {
    if (item.divider && (!out.length || out[out.length - 1].divider)) return;
    out.push(item);
  });
  while (out.length && out[out.length - 1].divider) out.pop();
  return out;
}

/**
 * Menu button. The menu is portalled so it is never clipped by scrolling tables.
 * items: [{ label, icon, onClick, to, tone: 'danger', disabled } | { divider: true } | { heading }]
 */
export default function Dropdown({ trigger, items, align = 'end', label, className, menuClassName, header }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId();
  const navigate = useNavigate();

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = menuRef.current?.offsetWidth ?? 224;
    const height = menuRef.current?.offsetHeight ?? 200;
    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8 && rect.top - height - 6 > 8) top = rect.top - height - 6;
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? [])];
        const idx = nodes.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (idx + 1) % nodes.length : (idx - 1 + nodes.length) % nodes.length;
        nodes[next]?.focus();
      }
    };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    requestAnimationFrame(() => menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus());
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const select = (item) => {
    setOpen(false);
    if (item.to) navigate(item.to);
    item.onClick?.();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={className}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={id}
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={cn('fixed z-[60] min-w-56 animate-fade-in rounded-xl border border-line bg-surface p-1.5 shadow-(--shadow-pop)', menuClassName)}
            onClick={(e) => e.stopPropagation()}
          >
            {header}
            {cleanItems(items).map((item, i) => {
              if (item.divider) return <div key={`d${i}`} className="my-1.5 h-px bg-line" role="separator" />;
              if (item.heading) return <p key={`h${i}`} className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-3">{item.heading}</p>;
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => select(item)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm outline-none transition-colors sm:min-h-9',
                    'hover:bg-surface-3 focus-visible:bg-surface-3 disabled:opacity-50',
                    item.tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-ink',
                  )}
                >
                  {Icon && <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.suffix}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
