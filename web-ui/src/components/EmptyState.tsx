interface EmptyStateProps {
  title: string;
  subtitle?: string;
  /** Label for the call-to-action button; omit to render no CTA. */
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered empty state for lists/tables, matching the Messages inbox style. */
export default function EmptyState({ title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="px-6 py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
      <p className="text-slate-500 dark:text-slate-400 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-5 py-2 rounded-pill bg-primary text-white text-sm font-semibold hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-brand-800 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
