import { useState } from 'react';
import {
  HeaderRow, AuthType, getHeader, setHeader, removeHeader, detectAuth, applyAuth,
} from './headerUtils';

const inputCls = 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-elevated px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition';
const chipCls = (active: boolean) =>
  `px-3 py-1.5 text-xs rounded-pill font-medium transition ${active ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-surface-elevated text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`;

const CONTENT_TYPES = [
  { value: 'application/json', label: 'JSON' },
  { value: 'application/x-www-form-urlencoded', label: 'Form' },
  { value: 'text/plain', label: 'Text' },
  { value: 'application/xml', label: 'XML' },
];

/**
 * One editor for everything that ends up in the request headers: Content-Type
 * quick-picks, auth presets, and free-form rows all mutate the same `rows`
 * prop, so nothing gets silently overwritten.
 */
export default function HeadersEditor({ rows, onChange, hasBody }: {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  /** Whether the request will have a body (Content-Type only matters then). */
  hasBody: boolean;
}) {
  const detected = detectAuth(rows);
  const [authType, setAuthType] = useState<AuthType>(detected.type);
  const [token, setToken] = useState(detected.token || '');
  const [username, setUsername] = useState(detected.username || '');
  const [password, setPassword] = useState(detected.password || '');
  const [keyName, setKeyName] = useState('X-API-Key');
  const [keyValue, setKeyValue] = useState('');

  const currentCT = getHeader(rows, 'Content-Type');

  const updateAuth = (type: AuthType, fields: Partial<{ token: string; username: string; password: string; keyName: string; keyValue: string }>) => {
    const merged = { token, username, password, keyName, keyValue, ...fields };
    onChange(applyAuth(rows, { type, ...merged }));
  };

  const updateRow = (idx: number, patch: Partial<HeaderRow>) => {
    const next = rows.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {hasBody && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Content-Type</label>
          <div className="flex gap-1.5 flex-wrap">
            {CONTENT_TYPES.map(ct => (
              <button key={ct.value} type="button" onClick={() => onChange(setHeader(rows, 'Content-Type', ct.value))} className={chipCls(currentCT === ct.value)}>
                {ct.label}
              </button>
            ))}
            {currentCT && !CONTENT_TYPES.some(ct => ct.value === currentCT) && (
              <span className={chipCls(true)}>{currentCT}</span>
            )}
          </div>
          {!currentCT && <p className="text-xs text-slate-400 mt-1">Defaults to application/json when the body looks like JSON.</p>}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Authentication</label>
        <select
          value={authType}
          onChange={e => { const t = e.target.value as AuthType; setAuthType(t); updateAuth(t, {}); }}
          className={inputCls}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="apikey">API key header</option>
        </select>
        {authType === 'bearer' && (
          <input placeholder="Token — {{env.KEY}} works here" value={token} onChange={e => { setToken(e.target.value); updateAuth('bearer', { token: e.target.value }); }} className={`${inputCls} mt-1.5`} />
        )}
        {authType === 'basic' && (
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            <input placeholder="Username" value={username} onChange={e => { setUsername(e.target.value); updateAuth('basic', { username: e.target.value }); }} className={inputCls} />
            <input placeholder="Password" type="password" value={password} onChange={e => { setPassword(e.target.value); updateAuth('basic', { password: e.target.value }); }} className={inputCls} />
          </div>
        )}
        {authType === 'apikey' && (
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            <input placeholder="Header name" value={keyName} onChange={e => { setKeyName(e.target.value); updateAuth('apikey', { keyName: e.target.value }); }} className={inputCls} />
            <input placeholder="Value — {{env.KEY}} works here" value={keyValue} onChange={e => { setKeyValue(e.target.value); updateAuth('apikey', { keyValue: e.target.value }); }} className={inputCls} />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Headers</label>
        {rows.length > 0 && (
          <div className="space-y-1.5 mb-1.5">
            {rows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input value={row.key} onChange={e => updateRow(idx, { key: e.target.value })} placeholder="Header" className={`${inputCls} flex-1 font-mono text-xs`} />
                <input value={row.value} onChange={e => updateRow(idx, { value: e.target.value })} placeholder="Value" className={`${inputCls} flex-[2] font-mono text-xs`} />
                <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-error transition px-1" aria-label="Remove header">✕</button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => onChange([...rows, { key: '', value: '' }])} className="text-xs font-medium text-primary hover:text-brand-700 transition">
          + Add header
        </button>
        <p className="text-xs text-slate-400 mt-1">Values support <code className="bg-slate-100 dark:bg-surface-elevated px-1 rounded">{'{{env.KEY}}'}</code> variables — manage them in the Variables panel.</p>
      </div>
    </div>
  );
}

export { removeHeader };
