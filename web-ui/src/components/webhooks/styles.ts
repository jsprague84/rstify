export const inputCls = 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-elevated px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition';
export const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';
export const chipCls = (active: boolean) =>
  `px-3 py-1.5 text-xs rounded-pill font-medium transition ${active ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-surface-elevated text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`;
export const primaryBtnCls = 'px-5 py-2 text-sm font-semibold text-white bg-primary rounded-pill hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-brand-700 disabled:opacity-50 transition';
export const secondaryBtnCls = 'px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-surface-elevated rounded-pill hover:bg-slate-200 dark:hover:bg-white/10 transition';
