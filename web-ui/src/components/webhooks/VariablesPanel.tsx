import { useState } from 'react';
import { api } from '../../api/client';
import type { WebhookVariable } from 'shared';
import { inputCls } from './styles';

function MaskedValue({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="text-xs text-slate-500 dark:text-slate-400">{shown ? value : '••••••••'}</code>
      <button
        type="button"
        onClick={() => setShown(s => !s)}
        className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition"
        aria-label={shown ? 'Hide value' : 'Reveal value'}
      >
        {shown ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        )}
      </button>
    </span>
  );
}

/**
 * {{env.KEY}} variable management. Values are masked by default — variables
 * usually hold API tokens that shouldn't sit readable on screen.
 */
export default function VariablesPanel({ variables, onMutate }: {
  variables: WebhookVariable[];
  onMutate: (fn: () => Promise<void>) => Promise<boolean>;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    const ok = await onMutate(() => api.createWebhookVariable({ key: newKey.trim(), value: newValue }).then(() => {}));
    if (ok) { setNewKey(''); setNewValue(''); }
  };

  const handleSave = async (id: number) => {
    const ok = await onMutate(() => api.updateWebhookVariable(id, { key: editKey, value: editValue }).then(() => {}));
    if (ok) setEditingId(null);
  };

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-card p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Variables</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
        Store secrets (API tokens, keys) once and reference them as{' '}
        <code className="bg-slate-100 dark:bg-surface-elevated px-1 rounded">{'{{env.KEY}}'}</code>{' '}
        in any outgoing webhook URL, header, or body template — never hardcode them in the config.
      </p>

      {variables.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-white/[0.06] mb-3">
          {variables.map(v => (
            <div key={v.id} className="py-2 flex items-center gap-3">
              {editingId === v.id ? (
                <>
                  <input value={editKey} onChange={e => setEditKey(e.target.value)} className={`${inputCls} text-xs flex-1`} />
                  <input value={editValue} onChange={e => setEditValue(e.target.value)} className={`${inputCls} text-xs flex-[2]`} placeholder="Value" />
                  <button onClick={() => handleSave(v.id)} className="text-xs font-medium text-success hover:underline">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs font-medium text-slate-400 hover:underline">Cancel</button>
                </>
              ) : (
                <>
                  <code className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex-1">{`{{env.${v.key}}}`}</code>
                  <div className="flex-[2]"><MaskedValue value={v.value} /></div>
                  <button onClick={() => { setEditingId(v.id); setEditKey(v.key); setEditValue(v.value); }} className="text-xs font-medium text-primary hover:underline">Edit</button>
                  <button onClick={() => onMutate(() => api.deleteWebhookVariable(v.id))} className="text-xs font-medium text-error hover:underline">Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input placeholder="KEY" value={newKey} onChange={e => setNewKey(e.target.value)} className={`${inputCls} text-xs flex-1 font-mono`} />
        <input placeholder="Value" type="password" value={newValue} onChange={e => setNewValue(e.target.value)} className={`${inputCls} text-xs flex-[2]`} autoComplete="new-password" />
        <button onClick={handleAdd} className="px-4 py-1.5 text-xs font-semibold bg-primary text-white rounded-pill hover:bg-brand-600 transition">Add</button>
      </div>
    </div>
  );
}
