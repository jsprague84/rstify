import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  /** Renders the item in the error color (e.g. Delete). */
  destructive?: boolean;
}

/** "⋯" trigger + small dropdown, closes on outside click / Escape. */
export default function OverflowMenu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM11.5 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15.5 11.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-20 min-w-[150px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-elevated shadow-lg py-1">
          {items.map(item => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => { setOpen(false); item.onClick(); }}
              className={`w-full text-left px-3.5 py-2 text-sm font-medium transition ${
                item.destructive
                  ? 'text-error hover:bg-error/10'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
