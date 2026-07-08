import { OUTGOING_TEMPLATE_VARIABLES } from 'shared';
import type { WebhookVariable } from 'shared';

/**
 * Clickable chips for every variable that actually works in outgoing body
 * templates / URLs / headers — the implemented set plus the user's own
 * {{env.KEY}} variables. Clicking a chip inserts it via onInsert.
 */
export default function TemplateHint({ variables, onInsert }: {
  variables: WebhookVariable[];
  onInsert: (token: string) => void;
}) {
  const chips = [
    ...OUTGOING_TEMPLATE_VARIABLES.map(v => ({ token: v.token, title: v.description })),
    ...variables.map(v => ({ token: `{{env.${v.key}}}`, title: 'Your variable (Variables panel)' })),
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map(c => (
        <button
          key={c.token}
          type="button"
          title={c.title}
          onClick={() => onInsert(c.token)}
          className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 transition"
        >
          {c.token}
        </button>
      ))}
    </div>
  );
}
