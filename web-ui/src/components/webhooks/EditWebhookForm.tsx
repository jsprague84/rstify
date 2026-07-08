import { useRef, useState } from 'react';
import type { UpdateWebhookConfig, WebhookConfigWithHealth, WebhookVariable } from 'shared';
import { getWebhookGuide } from 'shared';
import { inputCls, labelCls, chipCls, primaryBtnCls, secondaryBtnCls } from './styles';
import { HeaderRow, headersJsonToRows, rowsToHeadersObject, friendlyWebhookError } from './headerUtils';
import HeadersEditor from './HeadersEditor';
import TemplateHint from './TemplateHint';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function EditWebhookForm({ webhook, variables, existingGroups, onSubmit, onClose, onRegenerate }: {
  webhook: WebhookConfigWithHealth;
  variables: WebhookVariable[];
  existingGroups: string[];
  onSubmit: (d: UpdateWebhookConfig) => Promise<void>;
  onClose: () => void;
  onRegenerate?: () => Promise<void>;
}) {
  const isOutgoing = webhook.direction === 'outgoing';
  const [name, setName] = useState(webhook.name);
  const [enabled, setEnabled] = useState(webhook.enabled);
  const [groupName, setGroupName] = useState(webhook.group_name || '');
  const [secret, setSecret] = useState('');
  const [targetUrl, setTargetUrl] = useState(webhook.target_url || '');
  const [method, setMethod] = useState(webhook.http_method || 'POST');
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(headersJsonToRows(webhook.headers));
  const [bodyTemplate, setBodyTemplate] = useState(webhook.body_template || '');
  const [maxRetries, setMaxRetries] = useState(webhook.max_retries ?? 3);
  const [retryDelay, setRetryDelay] = useState(webhook.retry_delay_secs ?? 60);
  const [timeoutSecs, setTimeoutSecs] = useState(webhook.timeout_secs ?? 15);
  const [followRedirects, setFollowRedirects] = useState(webhook.follow_redirects ?? true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const hasBody = method !== 'GET' && method !== 'DELETE';
  const guide = getWebhookGuide(webhook.webhook_type);
  const webhookUrl = !isOutgoing ? `${window.location.origin}/api/wh/${webhook.token}` : null;

  const insertToken = (token: string) => {
    const el = bodyRef.current;
    if (!el) { setBodyTemplate(t => t + token); return; }
    const start = el.selectionStart ?? bodyTemplate.length;
    const end = el.selectionEnd ?? start;
    setBodyTemplate(bodyTemplate.slice(0, start) + token + bodyTemplate.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        name,
        template: null,
        enabled,
        groupName: groupName || null,
        secret: secret || null,
        targetUrl: isOutgoing ? targetUrl : null,
        httpMethod: isOutgoing ? method : null,
        headers: isOutgoing ? rowsToHeadersObject(headerRows) : null,
        bodyTemplate: isOutgoing ? bodyTemplate || null : null,
        maxRetries: isOutgoing ? maxRetries : null,
        retryDelaySecs: isOutgoing ? retryDelay : null,
        timeoutSecs: isOutgoing ? timeoutSecs : null,
        followRedirects: isOutgoing ? followRedirects : null,
      });
    } catch (err) {
      setError(friendlyWebhookError(err instanceof Error ? err.message : 'Failed to save'));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm whitespace-pre-line">{error}</div>}

      {webhookUrl && (
        <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-3.5 space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Webhook URL</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-slate-800 dark:text-slate-100 break-all flex-1">{webhookUrl}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)} className="text-xs font-medium text-primary hover:text-brand-700 whitespace-nowrap transition">Copy</button>
          </div>
          {onRegenerate && (
            <button
              type="button"
              onClick={() => { if (confirm('Regenerate the token? The current URL stops working immediately.')) onRegenerate(); }}
              className="text-xs font-medium text-warning hover:underline"
            >
              Regenerate token
            </button>
          )}
        </div>
      )}

      <div className="text-xs text-slate-400">
        {isOutgoing ? 'Outgoing' : `Incoming · ${guide.label}`}
      </div>

      <div>
        <label className={labelCls}>Name</label>
        <input required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Group (optional)</label>
        <input placeholder="e.g. Production, Monitoring" value={groupName} onChange={e => setGroupName(e.target.value)} className={inputCls} list="webhook-groups-edit" />
        {existingGroups.length > 0 && (
          <datalist id="webhook-groups-edit">{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
        )}
      </div>

      {!isOutgoing && (
        <div>
          <label className={labelCls}>Secret</label>
          <input
            type="password"
            placeholder="Leave empty to keep the current secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-400 mt-1">{guide.secretHelp}</p>
        </div>
      )}

      {isOutgoing && (
        <>
          <div>
            <label className={labelCls}>Send request to</label>
            <div className="flex gap-1 mb-1.5">
              {METHODS.map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={chipCls(method === m)}>{m}</button>
              ))}
            </div>
            <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className={inputCls} placeholder="https://example.com/hook — {{env.KEY}} works here" />
          </div>

          <HeadersEditor rows={headerRows} onChange={setHeaderRows} hasBody={hasBody} />

          {hasBody && (
            <div>
              <label className={labelCls}>Body template</label>
              <textarea
                ref={bodyRef}
                placeholder="Leave empty to send the full message as JSON"
                value={bodyTemplate}
                onChange={e => setBodyTemplate(e.target.value)}
                className={`${inputCls} font-mono text-xs`}
                rows={4}
              />
              <TemplateHint variables={variables} onInsert={insertToken} />
            </div>
          )}

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
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        Enabled
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
        <button type="submit" disabled={loading} className={primaryBtnCls}>{loading ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
