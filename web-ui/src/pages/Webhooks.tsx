import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig, WebhookDeliveryLog, WebhookTestResult, Topic, Application } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editWh, setEditWh] = useState<WebhookConfig | null>(null);
  const [deleteWh, setDeleteWh] = useState<WebhookConfig | null>(null);
  const [logsWh, setLogsWh] = useState<WebhookConfig | null>(null);
  const [testResult, setTestResult] = useState<{ wh: WebhookConfig; result: WebhookTestResult | null; loading: boolean; error: string } | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.listWebhooks(),
      api.listTopics(),
      api.listApplications(),
    ]).then(([wh, tp, ap]) => {
      setWebhooks(wh);
      setTopics(tp);
      setApps(ap);
    }).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateWebhookConfig) => {
    await api.createWebhook(data);
    setShowCreate(false);
    load();
  };

  const handleUpdate = async (id: number, data: UpdateWebhookConfig) => {
    await api.updateWebhook(id, data);
    setEditWh(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteWh) return;
    await api.deleteWebhook(deleteWh.id);
    setDeleteWh(null);
    load();
  };

  const handleTest = async (wh: WebhookConfig) => {
    setTestResult({ wh, result: null, loading: true, error: '' });
    try {
      const result = await api.testWebhook(wh.id);
      setTestResult({ wh, result, loading: false, error: '' });
    } catch (err) {
      setTestResult({ wh, result: null, loading: false, error: err instanceof Error ? err.message : 'Test failed' });
    }
  };

  const getWebhookUrl = (wh: WebhookConfig) => {
    const base = window.location.origin;
    return `${base}/api/wh/${wh.token}`;
  };

  const directionBadge = (dir: string) => {
    const isOut = dir === 'outgoing';
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
        isOut
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      }`}>
        {isOut ? '\u2192 Out' : '\u2190 In'}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Webhooks</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Webhook
        </button>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={webhooks}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'direction', header: 'Direction', render: w => directionBadge(w.direction || 'incoming') },
          { key: 'webhook_type', header: 'Type' },
          { key: 'target_url', header: 'Target', render: w =>
            w.direction === 'outgoing' && w.target_url ? (
              <span className="text-xs text-gray-600 dark:text-gray-400">{w.http_method} {w.target_url}</span>
            ) : (
              <WebhookUrlDisplay url={getWebhookUrl(w)} />
            )
          },
          { key: 'enabled', header: 'Enabled', render: w => w.enabled ? 'Yes' : 'No' },
        ]}
        actions={w => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => handleTest(w)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 text-sm">Test</button>
            <button onClick={() => setLogsWh(w)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm">Logs</button>
            <button onClick={() => setEditWh(w)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteWh(w)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Webhook">
          <WebhookForm topics={topics} apps={apps} onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      {editWh && (
        <Modal open onClose={() => setEditWh(null)} title="Edit Webhook">
          <EditWebhookForm webhook={editWh} topics={topics} apps={apps} onSubmit={d => handleUpdate(editWh.id, d)} onClose={() => setEditWh(null)} />
        </Modal>
      )}
      {logsWh && (
        <Modal open onClose={() => setLogsWh(null)} title={`Delivery Logs \u2014 ${logsWh.name}`}>
          <DeliveryLogViewer webhookId={logsWh.id} />
        </Modal>
      )}
      {testResult && (
        <Modal open onClose={() => setTestResult(null)} title={`Test \u2014 ${testResult.wh.name}`}>
          <TestResultDisplay result={testResult.result} loading={testResult.loading} error={testResult.error} webhookUrl={getWebhookUrl(testResult.wh)} direction={testResult.wh.direction} />
        </Modal>
      )}
      <ConfirmDialog
        open={!!deleteWh}
        onClose={() => setDeleteWh(null)}
        onConfirm={handleDelete}
        title="Delete Webhook"
        message={`Delete webhook "${deleteWh?.name}"?`}
      />
    </div>
  );
}

function WebhookUrlDisplay({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-1">
      <code className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={url}>{url}</code>
      <button onClick={handleCopy} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function TestResultDisplay({ result, loading, error, webhookUrl, direction }: {
  result: WebhookTestResult | null;
  loading: boolean;
  error: string;
  webhookUrl: string;
  direction: string;
}) {
  if (loading) return <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Sending test request...</div>;
  if (error) return <div className="text-sm text-red-600 dark:text-red-400 py-2">{error}</div>;
  if (!result) return null;

  if (direction === 'incoming') {
    return (
      <div className="space-y-3">
        <div className="text-sm dark:text-gray-300">
          Send a POST request to this URL to trigger the webhook:
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
          <div className="flex items-center gap-2">
            <code className="text-xs text-gray-800 dark:text-gray-200 break-all flex-1">{result.webhook_url || webhookUrl}</code>
            <button
              onClick={() => navigator.clipboard.writeText(result.webhook_url || webhookUrl)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >Copy</button>
          </div>
        </div>
        {result.curl_example && (
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Example curl command:</div>
            <div className="bg-gray-900 dark:bg-gray-800 rounded p-3 relative">
              <code className="text-xs text-green-400 break-all whitespace-pre-wrap">{result.curl_example}</code>
              <button
                onClick={() => navigator.clipboard.writeText(result.curl_example!)}
                className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-200"
              >Copy</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Outgoing result
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-sm font-medium ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
        {result.success ? 'Test successful' : 'Test failed'}
        {result.status_code && <span className="text-gray-500 dark:text-gray-400 font-normal">(HTTP {result.status_code})</span>}
      </div>
      {result.error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">{result.error}</div>
      )}
      {result.response_preview && (
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Response:</div>
          <pre className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-xs text-gray-700 dark:text-gray-300 max-h-40 overflow-auto whitespace-pre-wrap">{result.response_preview}</pre>
        </div>
      )}
    </div>
  );
}

function TemplateHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="text-indigo-600 dark:text-indigo-400 hover:underline">
        {open ? 'Hide' : 'Show'} template variables
      </button>
      {open && (
        <div className="mt-1 bg-gray-50 dark:bg-gray-700 rounded p-2 space-y-0.5 text-gray-600 dark:text-gray-300">
          <div><code>{'{{title}}'}</code> — Message title</div>
          <div><code>{'{{message}}'}</code> — Message body</div>
          <div><code>{'{{priority}}'}</code> — Priority level (1-10)</div>
          <div><code>{'{{appname}}'}</code> — Application name</div>
          <div><code>{'{{date}}'}</code> — ISO 8601 timestamp</div>
          <div><code>{'{{json}}'}</code> — Full message as JSON</div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white";
const btnCls = (active: boolean) =>
  `px-3 py-1.5 text-sm rounded font-medium ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`;

function parseHeaders(text: string): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function headersToText(headers?: string | null): string {
  if (!headers) return '';
  try {
    const obj = JSON.parse(headers);
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n');
  } catch {
    return headers;
  }
}

function WebhookForm({ topics, apps, onSubmit, onClose }: {
  topics: Topic[];
  apps: Application[];
  onSubmit: (d: CreateWebhookConfig) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    direction: 'incoming' as 'incoming' | 'outgoing',
    webhook_type: 'custom',
    target_url: '',
    http_method: 'POST',
    headers: '',
    body_template: '',
    template: '',
    target_topic_id: undefined as number | undefined,
    target_application_id: undefined as number | undefined,
    timeout_secs: 15,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.direction === 'outgoing' && !form.target_url.trim()) {
      setError('Target URL is required for outgoing webhooks');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        webhook_type: form.webhook_type,
        direction: form.direction,
        template: form.template || undefined,
        target_topic_id: form.target_topic_id,
        target_application_id: form.target_application_id,
        target_url: form.direction === 'outgoing' ? form.target_url : undefined,
        http_method: form.direction === 'outgoing' ? form.http_method : undefined,
        headers: form.direction === 'outgoing' && form.headers ? parseHeaders(form.headers) : undefined,
        body_template: form.direction === 'outgoing' && form.body_template ? form.body_template : undefined,
        timeout_secs: form.direction === 'outgoing' ? form.timeout_secs : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Direction toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Direction</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setForm(f => ({ ...f, direction: 'incoming' }))} className={btnCls(form.direction === 'incoming')}>
            Incoming
          </button>
          <button type="button" onClick={() => setForm(f => ({ ...f, direction: 'outgoing' }))} className={btnCls(form.direction === 'outgoing')}>
            Outgoing
          </button>
        </div>
      </div>

      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook Type</label>
        <select value={form.webhook_type} onChange={e => setForm(f => ({ ...f, webhook_type: e.target.value }))} className={inputCls}>
          <option value="custom">Custom</option>
          <option value="json">JSON</option>
          <option value="github">GitHub</option>
          <option value="grafana">Grafana</option>
        </select>
      </div>

      {/* Target topic */}
      {topics.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Topic {form.direction === 'incoming' ? '(required for incoming)' : '(triggers outgoing when messages arrive)'}</label>
          <select value={form.target_topic_id ?? ''} onChange={e => setForm(f => ({ ...f, target_topic_id: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">None</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Target application (incoming only) */}
      {form.direction === 'incoming' && apps.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Application (optional)</label>
          <select value={form.target_application_id ?? ''} onChange={e => setForm(f => ({ ...f, target_application_id: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">None</option>
            {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      {/* Outgoing-specific fields */}
      {form.direction === 'outgoing' && (
        <>
          <input placeholder="Target URL" required value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))} className={inputCls} />

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">HTTP Method</label>
            <div className="flex gap-2">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                <button key={m} type="button" onClick={() => setForm(f => ({ ...f, http_method: m }))} className={btnCls(form.http_method === m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Headers (one per line: Key: Value)</label>
            <textarea placeholder="Content-Type: application/json" value={form.headers} onChange={e => setForm(f => ({ ...f, headers: e.target.value }))} className={inputCls} rows={2} />
          </div>

          <div>
            <textarea placeholder="Body template (optional)" value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} className={inputCls} rows={3} />
            <TemplateHelp />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Timeout (seconds)</label>
            <input type="number" min={1} max={120} value={form.timeout_secs} onChange={e => setForm(f => ({ ...f, timeout_secs: parseInt(e.target.value) || 15 }))} className={inputCls} />
          </div>
        </>
      )}

      {/* Incoming template */}
      {form.direction === 'incoming' && (
        <div>
          <textarea placeholder="Template (optional)" value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))} className={inputCls} rows={3} />
          <TemplateHelp />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Create</button>
      </div>
    </form>
  );
}

function DeliveryLogViewer({ webhookId }: { webhookId: number }) {
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listWebhookDeliveries(webhookId)
      .then(setLogs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [webhookId]);

  if (loading) return <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (logs.length === 0) return <div className="text-sm text-gray-500 dark:text-gray-400">No delivery attempts yet.</div>;

  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-600">
            <th className="pb-1 pr-2">Time</th>
            <th className="pb-1 pr-2">Status</th>
            <th className="pb-1 pr-2">Duration</th>
            <th className="pb-1">Response</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b dark:border-gray-700">
              <td className="py-1 pr-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{new Date(log.attempted_at + 'Z').toLocaleString()}</td>
              <td className="py-1 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  log.success ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                  {log.status_code || 'ERR'}
                </span>
              </td>
              <td className="py-1 pr-2 text-gray-600 dark:text-gray-300">{log.duration_ms}ms</td>
              <td className="py-1 text-gray-500 dark:text-gray-400 truncate max-w-xs" title={log.response_body_preview || ''}>
                {log.response_body_preview ? log.response_body_preview.slice(0, 80) : '\u2014'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditWebhookForm({ webhook, topics, apps, onSubmit, onClose }: {
  webhook: WebhookConfig;
  topics: Topic[];
  apps: Application[];
  onSubmit: (d: UpdateWebhookConfig) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: webhook.name,
    template: webhook.template,
    enabled: webhook.enabled,
    target_url: webhook.target_url || '',
    http_method: webhook.http_method || 'POST',
    headers: headersToText(webhook.headers),
    body_template: webhook.body_template || '',
    max_retries: webhook.max_retries ?? 3,
    retry_delay_secs: webhook.retry_delay_secs ?? 60,
    timeout_secs: webhook.timeout_secs ?? 15,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isOutgoing = webhook.direction === 'outgoing';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        template: form.template,
        enabled: form.enabled,
        ...(isOutgoing ? {
          target_url: form.target_url,
          http_method: form.http_method,
          headers: parseHeaders(form.headers),
          body_template: form.body_template || undefined,
          max_retries: form.max_retries,
          retry_delay_secs: form.retry_delay_secs,
          timeout_secs: form.timeout_secs,
        } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  // Show webhook URL for incoming webhooks
  const webhookUrl = !isOutgoing ? `${window.location.origin}/api/wh/${webhook.token}` : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Show webhook URL for incoming webhooks */}
      {webhookUrl && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 space-y-1">
          <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Webhook URL</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-blue-800 dark:text-blue-200 break-all flex-1">{webhookUrl}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">Copy</button>
          </div>
        </div>
      )}

      {/* Show type and direction info */}
      <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Type: <strong>{webhook.webhook_type}</strong></span>
        <span>Direction: <strong>{webhook.direction}</strong></span>
      </div>

      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />

      {isOutgoing ? (
        <>
          <input placeholder="Target URL" value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))} className={inputCls} />
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">HTTP Method</label>
            <div className="flex gap-2">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                <button key={m} type="button" onClick={() => setForm(f => ({ ...f, http_method: m }))} className={btnCls(form.http_method === m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Headers (one per line: Key: Value)</label>
            <textarea placeholder="Content-Type: application/json" value={form.headers} onChange={e => setForm(f => ({ ...f, headers: e.target.value }))} className={inputCls} rows={2} />
          </div>
          <div>
            <textarea placeholder="Body template" value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} className={inputCls} rows={3} />
            <TemplateHelp />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Retries</label>
              <input type="number" min={0} max={10} value={form.max_retries} onChange={e => setForm(f => ({ ...f, max_retries: parseInt(e.target.value) || 0 }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Retry Delay (s)</label>
              <input type="number" min={1} max={3600} value={form.retry_delay_secs} onChange={e => setForm(f => ({ ...f, retry_delay_secs: parseInt(e.target.value) || 60 }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Timeout (s)</label>
              <input type="number" min={1} max={120} value={form.timeout_secs} onChange={e => setForm(f => ({ ...f, timeout_secs: parseInt(e.target.value) || 15 }))} className={inputCls} />
            </div>
          </div>
        </>
      ) : (
        <div>
          <textarea placeholder="Template" value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))} className={inputCls} rows={3} />
          <TemplateHelp />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm dark:text-gray-300">
        <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
        Enabled
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}
