import { useRef, useState } from 'react';
import type { CreateWebhookConfig, Topic, WebhookVariable } from 'shared';
import { inputCls, labelCls, chipCls, primaryBtnCls, secondaryBtnCls } from './styles';
import { HeaderRow, rowsToHeadersObject, friendlyWebhookError } from './headerUtils';
import HeadersEditor from './HeadersEditor';
import TemplateHint from './TemplateHint';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Focused create form for outgoing webhooks: trigger topic + target request,
 * with delivery tuning behind a disclosure so the common path stays short.
 */
export default function OutgoingWebhookForm({ topics, variables, existingGroups, onSubmit, onBack, onClose }: {
  topics: Topic[];
  variables: WebhookVariable[];
  existingGroups: string[];
  onSubmit: (d: CreateWebhookConfig) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [topicId, setTopicId] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [showDelivery, setShowDelivery] = useState(false);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(60);
  const [timeoutSecs, setTimeoutSecs] = useState(15);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const hasBody = method !== 'GET' && method !== 'DELETE';

  const insertToken = (token: string) => {
    const el = bodyRef.current;
    if (!el) { setBodyTemplate(t => t + token); return; }
    const start = el.selectionStart ?? bodyTemplate.length;
    const end = el.selectionEnd ?? start;
    const next = bodyTemplate.slice(0, start) + token + bodyTemplate.slice(end);
    setBodyTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!topicId) {
      setError('Pick a trigger topic — outgoing webhooks fire when a message is published to a topic.');
      return;
    }
    if (!targetUrl.trim()) {
      setError('Target URL is required.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name,
        webhookType: 'custom',
        direction: 'outgoing',
        targetTopicId: Number(topicId),
        targetApplicationId: null,
        targetUrl: targetUrl.trim(),
        httpMethod: method,
        headers: rowsToHeadersObject(headerRows),
        bodyTemplate: bodyTemplate || null,
        maxRetries,
        retryDelaySecs: retryDelay,
        timeoutSecs,
        followRedirects,
        enabled: null,
        template: null,
        groupName: groupName || null,
        secret: null,
      });
    } catch (err) {
      setError(friendlyWebhookError(err instanceof Error ? err.message : 'Failed to create webhook'));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm whitespace-pre-line">{error}</div>}

      <div>
        <label className={labelCls}>Name</label>
        <input placeholder="e.g. Forward alerts to n8n" required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Trigger — fires on every message published to</label>
        <select value={topicId} onChange={e => setTopicId(e.target.value)} className={inputCls}>
          <option value="">Choose a topic…</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {topics.length === 0 && (
          <p className="text-xs text-warning mt-1">You have no topics yet — outgoing webhooks are triggered by topic messages, so create a topic first.</p>
        )}
      </div>

      <div>
        <label className={labelCls}>Send request to</label>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {METHODS.map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={chipCls(method === m)}>{m}</button>
            ))}
          </div>
        </div>
        <input
          placeholder="https://example.com/hook — {{env.KEY}} works here"
          value={targetUrl}
          onChange={e => setTargetUrl(e.target.value)}
          className={`${inputCls} mt-1.5`}
        />
        <p className="text-xs text-slate-400 mt-1">The URL is checked when you save and again at delivery time; private/internal addresses are blocked unless the server allows them.</p>
      </div>

      <HeadersEditor rows={headerRows} onChange={setHeaderRows} hasBody={hasBody} />

      {hasBody && (
        <div>
          <label className={labelCls}>Body template</label>
          <textarea
            ref={bodyRef}
            placeholder='Leave empty to send the full message as JSON'
            value={bodyTemplate}
            onChange={e => setBodyTemplate(e.target.value)}
            className={`${inputCls} font-mono text-xs`}
            rows={4}
          />
          <TemplateHint variables={variables} onInsert={insertToken} />
        </div>
      )}

      <button type="button" onClick={() => setShowDelivery(s => !s)} className="text-sm font-medium text-primary hover:text-brand-700 transition">
        {showDelivery ? '▾' : '▸'} Delivery options
      </button>
      {showDelivery && (
        <div className="space-y-3 border border-slate-200 dark:border-white/10 rounded-xl p-3.5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Max retries (0–10)</label>
              <input type="number" min={0} max={10} value={maxRetries} onChange={e => setMaxRetries(parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Retry delay (1–3600s)</label>
              <input type="number" min={1} max={3600} value={retryDelay} onChange={e => setRetryDelay(parseInt(e.target.value) || 60)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Timeout (1–120s)</label>
              <input type="number" min={1} max={120} value={timeoutSecs} onChange={e => setTimeoutSecs(parseInt(e.target.value) || 15)} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={followRedirects} onChange={e => setFollowRedirects(e.target.checked)} />
            Follow redirects (same-host only, max 8 hops)
          </label>
        </div>
      )}

      <div>
        <label className={labelCls}>Group (optional)</label>
        <input placeholder="e.g. Production, Monitoring" value={groupName} onChange={e => setGroupName(e.target.value)} className={inputCls} list="webhook-groups-out" />
        {existingGroups.length > 0 && (
          <datalist id="webhook-groups-out">{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition">← Back</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" disabled={loading} className={primaryBtnCls}>{loading ? 'Creating…' : 'Create webhook'}</button>
        </div>
      </div>
    </form>
  );
}
