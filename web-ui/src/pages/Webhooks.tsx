import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig, WebhookDeliveryLog, WebhookTestResult, Topic, Application, WebhookVariable } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Sparkline from '../components/Sparkline';
import CodeGenerator from '../components/CodeGenerator';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';
import { parseWebhookHeaders } from '../utils/webhookHelpers';
import { formatLocalTime } from '../utils/time';

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editWh, setEditWh] = useState<WebhookConfig | null>(null);
  const [deleteWh, setDeleteWh] = useState<WebhookConfig | null>(null);
  const [logsWh, setLogsWh] = useState<WebhookConfig | null>(null);
  const [testResult, setTestResult] = useState<{ wh: WebhookConfig; result: WebhookTestResult | null; loading: boolean; error: string; customPayload: string } | null>(null);
  const [codeWh, setCodeWh] = useState<WebhookConfig | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [variables, setVariables] = useState<WebhookVariable[]>([]);
  const [showVars, setShowVars] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.listWebhooks(),
      api.listTopics(),
      api.listApplications(),
      api.listWebhookVariables(),
    ]).then(([wh, tp, ap, vars]) => {
      setWebhooks(wh);
      setTopics(tp);
      setApps(ap);
      setVariables(vars);
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

  const handleDuplicate = async (w: WebhookConfig) => {
    try {
      await api.createWebhook({
        name: `${w.name} (copy)`,
        webhook_type: w.webhook_type,
        direction: w.direction,
        target_topic_id: w.target_topic_id ?? undefined,
        target_application_id: w.target_application_id ?? undefined,
        target_url: w.target_url ?? undefined,
        http_method: w.http_method,
        headers: Object.keys(parseWebhookHeaders(w.headers)).length > 0 ? parseWebhookHeaders(w.headers) : undefined,
        body_template: w.body_template ?? undefined,
        max_retries: w.max_retries,
        retry_delay_secs: w.retry_delay_secs,
        timeout_secs: w.timeout_secs,
        follow_redirects: w.follow_redirects,
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed');
    }
  };

  const handleToggleEnabled = async (w: WebhookConfig) => {
    try {
      await api.updateWebhook(w.id, { enabled: !w.enabled });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteWh) return;
    await api.deleteWebhook(deleteWh.id);
    setDeleteWh(null);
    load();
  };

  const defaultTestPayload = JSON.stringify({ title: 'Test Webhook', message: 'This is a test message from rstify.', priority: 5, topic: 'test-topic' }, null, 2);

  const handleTest = async (wh: WebhookConfig) => {
    if (wh.direction === 'outgoing') {
      // Show payload editor first
      setTestResult({ wh, result: null, loading: false, error: '', customPayload: defaultTestPayload });
      return;
    }
    setTestResult({ wh, result: null, loading: true, error: '', customPayload: '' });
    try {
      const result = await api.testWebhook(wh.id);
      setTestResult({ wh, result, loading: false, error: '', customPayload: '' });
    } catch (err) {
      setTestResult({ wh, result: null, loading: false, error: err instanceof Error ? err.message : 'Test failed', customPayload: '' });
    }
  };

  const handleSendTest = async () => {
    if (!testResult) return;
    const { wh, customPayload } = testResult;
    setTestResult(prev => prev ? { ...prev, loading: true, error: '', result: null } : null);
    try {
      let payload: { title?: string; message?: string; priority?: number; topic?: string } | undefined;
      if (customPayload.trim()) {
        payload = JSON.parse(customPayload);
      }
      const result = await api.testWebhook(wh.id, payload);
      setTestResult(prev => prev ? { ...prev, result, loading: false } : null);
    } catch (err) {
      setTestResult(prev => prev ? { ...prev, loading: false, error: err instanceof Error ? err.message : 'Test failed' } : null);
    }
  };

  const getWebhookUrl = (wh: WebhookConfig) => {
    const base = window.location.origin;
    return `${base}/api/wh/${wh.token}`;
  };

  const generateCurl = (w: WebhookConfig) => {
    if (w.direction === 'outgoing' && w.target_url) {
      const parts = [`curl -X ${w.http_method} '${w.target_url}'`];
      if (w.headers) {
        try {
          const h = JSON.parse(w.headers) as Record<string, string>;
          for (const [k, v] of Object.entries(h)) parts.push(`-H '${k}: ${v}'`);
        } catch { /* skip */ }
      }
      if (w.http_method !== 'GET' && w.http_method !== 'DELETE') {
        const body = w.body_template || '{"title":"Test","message":"Hello"}';
        parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
        if (!w.headers || !w.headers.toLowerCase().includes('content-type')) {
          parts.push("-H 'Content-Type: application/json'");
        }
      }
      return parts.join(' \\\n  ');
    }
    const url = getWebhookUrl(w);
    return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"title":"Test","message":"Hello"}'`;
  };

  const copyCurl = (w: WebhookConfig) => {
    navigator.clipboard.writeText(generateCurl(w));
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
        <div className="flex gap-2">
          <button onClick={() => setShowVars(v => !v)} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
            Variables {variables.length > 0 && `(${variables.length})`}
          </button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            Create Webhook
          </button>
        </div>
      </div>
      {showVars && <VariablesSection variables={variables} onReload={load} />}
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      {(() => {
        const columns = [
          { key: 'id' as const, header: 'ID' },
          { key: 'name' as const, header: 'Name' },
          { key: 'direction' as const, header: 'Direction', render: (w: WebhookConfig) => directionBadge(w.direction || 'incoming') },
          { key: 'webhook_type' as const, header: 'Type' },
          { key: 'target_url' as const, header: 'Target', render: (w: WebhookConfig) =>
            w.direction === 'outgoing' && w.target_url ? (
              <span className="text-xs text-gray-600 dark:text-gray-400">{w.http_method} {w.target_url}</span>
            ) : (
              <WebhookUrlDisplay url={getWebhookUrl(w)} />
            )
          },
          { key: 'enabled' as const, header: 'Enabled', render: (w: WebhookConfig) => (
            <button
              onClick={() => handleToggleEnabled(w)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${w.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              title={w.enabled ? 'Enabled – click to disable' : 'Disabled – click to enable'}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${w.enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
            </button>
          )},
          { key: 'health' as const, header: 'Health', render: (w: WebhookConfig) => {
            if (w.direction !== 'outgoing' || w.recent_success_rate == null) {
              return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />No data</span>;
            }
            const rate = w.recent_success_rate;
            const color = rate >= 0.8 ? 'green' : rate >= 0.5 ? 'amber' : 'red';
            const label = rate >= 0.8 ? 'Healthy' : rate >= 0.5 ? 'Degraded' : 'Failing';
            const dotCls = color === 'green' ? 'bg-green-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500';
            const textCls = color === 'green' ? 'text-green-700 dark:text-green-400' : color === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400';
            return (
              <span className={`inline-flex items-center gap-1 text-xs ${textCls}`} title={`${Math.round(rate * 100)}% success rate${w.last_delivery_at ? ` | Last: ${formatLocalTime(w.last_delivery_at)}` : ''}`}>
                <span className={`w-2 h-2 rounded-full ${dotCls} inline-block`} />
                {label}
              </span>
            );
          }},
          { key: 'sparkline' as const, header: '', render: (w: WebhookConfig) =>
            w.direction === 'outgoing' && w.recent_durations && w.recent_durations.length >= 2
              ? <Sparkline data={w.recent_durations} />
              : null
          },
        ];
        const renderActions = (w: WebhookConfig) => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => handleTest(w)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 text-sm">Test</button>
            <button onClick={() => copyCurl(w)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm">Curl</button>
            {w.direction === 'outgoing' && <button onClick={() => setCodeWh(w)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm">Code</button>}
            <button onClick={() => setLogsWh(w)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm">Logs</button>
            <button onClick={() => handleDuplicate(w)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm">Dup</button>
            <button onClick={() => setEditWh(w)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteWh(w)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        );

        // Group webhooks by group_name
        const groups = new Map<string, WebhookConfig[]>();
        const ungrouped: WebhookConfig[] = [];
        for (const wh of webhooks) {
          if (wh.group_name) {
            const list = groups.get(wh.group_name) || [];
            list.push(wh);
            groups.set(wh.group_name, list);
          } else {
            ungrouped.push(wh);
          }
        }

        const hasGroups = groups.size > 0;
        const toggleGroup = (name: string) => {
          setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
          });
        };

        if (!hasGroups) {
          return <DataTable data={webhooks} keyField="id" columns={columns} actions={renderActions} />;
        }

        return (
          <div className="space-y-4">
            {ungrouped.length > 0 && (
              <DataTable data={ungrouped} keyField="id" columns={columns} actions={renderActions} />
            )}
            {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupName, items]) => (
              <div key={groupName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span>{collapsedGroups.has(groupName) ? '\u25b6' : '\u25bc'} {groupName}</span>
                  <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{items.length}</span>
                </button>
                {!collapsedGroups.has(groupName) && (
                  <DataTable data={items} keyField="id" columns={columns} actions={renderActions} />
                )}
              </div>
            ))}
          </div>
        );
      })()}
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Webhook">
          <WebhookForm topics={topics} apps={apps} onSubmit={handleCreate} onClose={() => setShowCreate(false)} existingGroups={[...new Set(webhooks.map(w => w.group_name).filter((g): g is string => !!g))]} />
        </Modal>
      )}
      {editWh && (
        <Modal open onClose={() => setEditWh(null)} title="Edit Webhook">
          <EditWebhookForm
            webhook={editWh}
            topics={topics}
            apps={apps}
            onSubmit={d => handleUpdate(editWh.id, d)}
            onClose={() => setEditWh(null)}
            onRegenerate={editWh.direction !== 'outgoing' ? async () => {
              const updated = await api.regenerateWebhookToken(editWh.id);
              setEditWh(updated);
              load();
            } : undefined}
            existingGroups={[...new Set(webhooks.map(w => w.group_name).filter((g): g is string => !!g))]}
          />
        </Modal>
      )}
      {logsWh && (
        <Modal open onClose={() => setLogsWh(null)} title={`Delivery Logs \u2014 ${logsWh.name}`}>
          <DeliveryLogViewer webhookId={logsWh.id} />
        </Modal>
      )}
      {testResult && (
        <Modal open onClose={() => setTestResult(null)} title={`Test \u2014 ${testResult.wh.name}`}>
          {testResult.wh.direction === 'outgoing' && !testResult.result && !testResult.loading && !testResult.error && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Test Payload (JSON)</label>
              <textarea
                value={testResult.customPayload}
                onChange={e => setTestResult(prev => prev ? { ...prev, customPayload: e.target.value } : null)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm p-2 font-mono text-gray-900 dark:text-gray-100"
                rows={6}
              />
              <div className="flex justify-end">
                <button onClick={handleSendTest} className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700">Send Test</button>
              </div>
            </div>
          )}
          {(testResult.result || testResult.loading || testResult.error) && (
            <TestResultDisplay result={testResult.result} loading={testResult.loading} error={testResult.error} webhookUrl={getWebhookUrl(testResult.wh)} direction={testResult.wh.direction} />
          )}
        </Modal>
      )}
      {codeWh && codeWh.target_url && (
        <Modal open onClose={() => setCodeWh(null)} title={`Code \u2014 ${codeWh.name}`}>
          <CodeGenerator
            url={codeWh.target_url}
            method={codeWh.http_method}
            headers={parseWebhookHeaders(codeWh?.headers)}
            body={codeWh.body_template || '{"title":"Test","message":"Hello"}'}
          />
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
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const statusColor = result.status_code
    ? result.status_code < 300 ? 'bg-green-500' : result.status_code < 400 ? 'bg-blue-500' : result.status_code < 500 ? 'bg-amber-500' : 'bg-red-500'
    : 'bg-gray-500';

  const formatBody = (raw: string) => {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 text-sm font-medium ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
          {result.status_code && <span className="font-mono">HTTP {result.status_code}</span>}
        </div>
        {result.duration_ms != null && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{result.duration_ms}ms</span>
        )}
      </div>
      {result.error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">{result.error}</div>
      )}
      {(result.response_preview || result.response_headers) && (
        <div>
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-600 mb-2">
            <button onClick={() => setTab('body')} className={`px-3 py-1 text-xs font-medium ${tab === 'body' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Body</button>
            <button onClick={() => setTab('headers')} className={`px-3 py-1 text-xs font-medium ${tab === 'headers' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Headers</button>
          </div>
          {tab === 'body' && result.response_preview && (
            <div className="relative">
              <pre className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs text-gray-700 dark:text-gray-300 max-h-64 overflow-auto whitespace-pre-wrap font-mono">{formatBody(result.response_preview)}</pre>
              <button
                onClick={() => navigator.clipboard.writeText(result.response_preview!)}
                className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >Copy</button>
            </div>
          )}
          {tab === 'headers' && result.response_headers && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs font-mono max-h-64 overflow-auto">
              {Object.entries(result.response_headers).map(([k, v]) => (
                <div key={k} className="text-gray-700 dark:text-gray-300"><span className="text-indigo-600 dark:text-indigo-400">{k}:</span> {v}</div>
              ))}
            </div>
          )}
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

type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

function detectAuthFromHeaders(headersText: string): { type: AuthType; token?: string; username?: string; password?: string; keyName?: string; keyValue?: string } {
  const parsed = parseHeaders(headersText);
  if (!parsed) return { type: 'none' };
  const authValue = Object.entries(parsed).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
  if (!authValue) return { type: 'none' };
  if (authValue.startsWith('Bearer ')) return { type: 'bearer', token: authValue.slice(7) };
  if (authValue.startsWith('Basic ')) {
    try {
      const decoded = atob(authValue.slice(6));
      const [username, ...rest] = decoded.split(':');
      return { type: 'basic', username, password: rest.join(':') };
    } catch { return { type: 'basic' }; }
  }
  return { type: 'none' };
}

function mergeAuthHeader(headersText: string, authType: AuthType, authFields: { token?: string; username?: string; password?: string; keyName?: string; keyValue?: string }): string {
  // Remove existing Authorization header
  const lines = headersText.split('\n').filter(l => {
    const idx = l.indexOf(':');
    return idx <= 0 || l.slice(0, idx).trim().toLowerCase() !== 'authorization';
  });

  let authHeader = '';
  if (authType === 'bearer' && authFields.token) {
    authHeader = `Authorization: Bearer ${authFields.token}`;
  } else if (authType === 'basic' && authFields.username) {
    authHeader = `Authorization: Basic ${btoa(`${authFields.username}:${authFields.password || ''}`)}`;
  } else if (authType === 'apikey' && authFields.keyName && authFields.keyValue) {
    // For API key in header, use the key name as header name
    const filtered = lines.filter(l => {
      const idx = l.indexOf(':');
      return idx <= 0 || l.slice(0, idx).trim() !== authFields.keyName;
    });
    return [...filtered.filter(l => l.trim()), `${authFields.keyName}: ${authFields.keyValue}`].join('\n');
  }

  if (authHeader) {
    return [...lines.filter(l => l.trim()), authHeader].join('\n');
  }
  return lines.filter(l => l.trim()).join('\n');
}

const CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
  'application/xml',
] as const;

function ContentTypeSelector({ headers, onHeadersChange }: { headers: string; onHeadersChange: (h: string) => void }) {
  const lines = headers.split('\n');
  const ctLine = lines.find(l => l.trim().toLowerCase().startsWith('content-type:'));
  const current = ctLine ? ctLine.split(':').slice(1).join(':').trim() : 'application/json';
  const isCustom = current && !CONTENT_TYPES.includes(current as typeof CONTENT_TYPES[number]);
  const [customValue, setCustomValue] = useState(isCustom ? current : '');

  const setCT = (val: string) => {
    const filtered = lines.filter(l => !l.trim().toLowerCase().startsWith('content-type:'));
    const newLines = [...filtered.filter(l => l.trim()), `Content-Type: ${val}`];
    onHeadersChange(newLines.join('\n'));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Content-Type</label>
      <div className="flex gap-2 flex-wrap">
        {CONTENT_TYPES.map(ct => (
          <button key={ct} type="button" onClick={() => setCT(ct)} className={btnCls(current === ct)}>
            {ct.replace('application/', '')}
          </button>
        ))}
        <button type="button" onClick={() => { setCustomValue(isCustom ? current : ''); setCT(customValue || 'custom'); }} className={btnCls(!!isCustom)}>
          Custom
        </button>
      </div>
      {isCustom && (
        <input
          className={`${inputCls} mt-1`}
          placeholder="Custom Content-Type"
          value={customValue}
          onChange={e => { setCustomValue(e.target.value); setCT(e.target.value); }}
        />
      )}
    </div>
  );
}

function AuthSection({ headers, onHeadersChange }: { headers: string; onHeadersChange: (h: string) => void }) {
  const detected = detectAuthFromHeaders(headers);
  const [authType, setAuthType] = useState<AuthType>(detected.type);
  const [token, setToken] = useState(detected.token || '');
  const [username, setUsername] = useState(detected.username || '');
  const [password, setPassword] = useState(detected.password || '');
  const [keyName, setKeyName] = useState(detected.keyName || 'X-API-Key');
  const [keyValue, setKeyValue] = useState(detected.keyValue || '');

  const updateHeaders = (type: AuthType, fields: { token?: string; username?: string; password?: string; keyName?: string; keyValue?: string }) => {
    onHeadersChange(mergeAuthHeader(headers, type, fields));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Authentication</label>
      <select value={authType} onChange={e => { const t = e.target.value as AuthType; setAuthType(t); updateHeaders(t, { token, username, password, keyName, keyValue }); }} className={inputCls}>
        <option value="none">None</option>
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="apikey">API Key</option>
      </select>
      {authType === 'bearer' && (
        <input placeholder="Token" value={token} onChange={e => { setToken(e.target.value); updateHeaders('bearer', { token: e.target.value }); }} className={inputCls} />
      )}
      {authType === 'basic' && (
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Username" value={username} onChange={e => { setUsername(e.target.value); updateHeaders('basic', { username: e.target.value, password }); }} className={inputCls} />
          <input placeholder="Password" type="password" value={password} onChange={e => { setPassword(e.target.value); updateHeaders('basic', { username, password: e.target.value }); }} className={inputCls} />
        </div>
      )}
      {authType === 'apikey' && (
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Header name" value={keyName} onChange={e => { setKeyName(e.target.value); updateHeaders('apikey', { keyName: e.target.value, keyValue }); }} className={inputCls} />
          <input placeholder="API key value" value={keyValue} onChange={e => { setKeyValue(e.target.value); updateHeaders('apikey', { keyName, keyValue: e.target.value }); }} className={inputCls} />
        </div>
      )}
    </div>
  );
}

function WebhookForm({ topics, apps, onSubmit, onClose, existingGroups = [] }: {
  topics: Topic[];
  apps: Application[];
  onSubmit: (d: CreateWebhookConfig) => Promise<void>;
  onClose: () => void;
  existingGroups?: string[];
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
    max_retries: 3,
    retry_delay_secs: 60,
    timeout_secs: 15,
    follow_redirects: true,
    group_name: '',
    secret: undefined as string | undefined,
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
        max_retries: form.direction === 'outgoing' ? form.max_retries : undefined,
        retry_delay_secs: form.direction === 'outgoing' ? form.retry_delay_secs : undefined,
        timeout_secs: form.direction === 'outgoing' ? form.timeout_secs : undefined,
        follow_redirects: form.direction === 'outgoing' ? form.follow_redirects : undefined,
        group_name: form.group_name || undefined,
        secret: form.secret || undefined,
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
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group (optional)</label>
        <input
          placeholder="e.g. Production, Monitoring"
          value={form.group_name}
          onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
          className={inputCls}
          list="webhook-groups"
        />
        {existingGroups.length > 0 && (
          <datalist id="webhook-groups">
            {existingGroups.map(g => <option key={g} value={g} />)}
          </datalist>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook Type</label>
        <select value={form.webhook_type} onChange={e => setForm(f => ({ ...f, webhook_type: e.target.value }))} className={inputCls}>
          <option value="custom">Custom</option>
          <option value="json">JSON</option>
          <option value="github">GitHub</option>
          <option value="grafana">Grafana</option>
          <option value="forgejo">Forgejo / Gitea</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook Secret (optional)</label>
        <input
          type="password"
          placeholder="HMAC signing secret for signature verification"
          value={form.secret || ''}
          onChange={e => setForm(f => ({ ...f, secret: e.target.value || undefined }))}
          className={inputCls}
        />
        <p className="text-xs text-gray-400 mt-1">Set a secret in Forgejo/GitHub webhook settings to enable signature verification</p>
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

          <ContentTypeSelector headers={form.headers} onHeadersChange={h => setForm(f => ({ ...f, headers: h }))} />

          <AuthSection headers={form.headers} onHeadersChange={h => setForm(f => ({ ...f, headers: h }))} />

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Additional Headers (one per line: Key: Value)</label>
            <textarea placeholder="X-Custom-Header: value" value={form.headers} onChange={e => setForm(f => ({ ...f, headers: e.target.value }))} className={inputCls} rows={2} />
          </div>

          <div>
            <textarea placeholder="Body template (optional)" value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} className={inputCls} rows={3} />
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

          <label className="flex items-center gap-2 text-sm dark:text-gray-300">
            <input type="checkbox" checked={form.follow_redirects} onChange={e => setForm(f => ({ ...f, follow_redirects: e.target.checked }))} />
            Follow redirects
          </label>
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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusBadgeCls(code: number | undefined, success: boolean): string {
  if (!code) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  if (code < 300) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (code < 400) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  if (code < 500) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
}

function DeliveryLogViewer({ webhookId }: { webhookId: number }) {
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(async (reset = false) => {
    const offset = reset ? 0 : logs.length;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const successParam = filter === 'all' ? undefined : filter === 'success';
      const result = await api.listWebhookDeliveries(webhookId, 20, successParam, offset);
      if (reset) setLogs(result); else setLogs(prev => [...prev, ...result]);
      setHasMore(result.length === 20);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [webhookId, filter, logs.length]);

  useEffect(() => { fetchLogs(true); }, [webhookId, filter]);

  if (loading) return <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['all', 'success', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-xs rounded font-medium ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            {f === 'all' ? 'All' : f === 'success' ? 'Success' : 'Failed'}
          </button>
        ))}
      </div>
      {logs.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">No delivery attempts{filter !== 'all' ? ' matching filter' : ''}.</div>
      ) : (
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
                <tr key={log.id} className="border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                  <td className="py-1.5 pr-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    <span title={formatLocalTime(log.attempted_at)}>{relativeTime(log.attempted_at)}</span>
                    {!log.message_id && <span className="ml-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-[10px] font-medium">TEST</span>}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeCls(log.status_code, log.success)}`}>
                      {log.status_code || 'ERR'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-gray-600 dark:text-gray-300">{log.duration_ms}ms</td>
                  <td className="py-1.5 text-gray-500 dark:text-gray-400">
                    {expandedId === log.id ? (
                      <pre className="whitespace-pre-wrap break-all max-h-40 overflow-auto bg-gray-50 dark:bg-gray-800 rounded p-2 font-mono">{log.response_body_preview || '\u2014'}</pre>
                    ) : (
                      <span className="truncate block max-w-xs" title={log.response_body_preview || ''}>{log.response_body_preview ? log.response_body_preview.slice(0, 80) : '\u2014'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="text-center py-2">
              <button onClick={() => fetchLogs(false)} disabled={loadingMore} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditWebhookForm({ webhook, topics, apps, onSubmit, onClose, onRegenerate, existingGroups = [] }: {
  webhook: WebhookConfig;
  topics: Topic[];
  apps: Application[];
  onSubmit: (d: UpdateWebhookConfig) => Promise<void>;
  onClose: () => void;
  onRegenerate?: () => Promise<void>;
  existingGroups?: string[];
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
    follow_redirects: webhook.follow_redirects ?? true,
    group_name: webhook.group_name || '',
    secret: undefined as string | undefined,
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
        group_name: form.group_name || undefined,
        secret: form.secret || undefined,
        ...(isOutgoing ? {
          target_url: form.target_url,
          http_method: form.http_method,
          headers: parseHeaders(form.headers),
          body_template: form.body_template || undefined,
          max_retries: form.max_retries,
          retry_delay_secs: form.retry_delay_secs,
          timeout_secs: form.timeout_secs,
          follow_redirects: form.follow_redirects,
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
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 space-y-2">
          <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Webhook URL</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-blue-800 dark:text-blue-200 break-all flex-1">{webhookUrl}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">Copy</button>
          </div>
          {onRegenerate && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Regenerate token? The old webhook URL will stop working.')) {
                  onRegenerate();
                }
              }}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >Regenerate Token</button>
          )}
        </div>
      )}

      {/* Show type and direction info */}
      <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Type: <strong>{webhook.webhook_type}</strong></span>
        <span>Direction: <strong>{webhook.direction}</strong></span>
      </div>

      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group (optional)</label>
        <input
          placeholder="e.g. Production, Monitoring"
          value={form.group_name}
          onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
          className={inputCls}
          list="webhook-edit-groups"
        />
        {existingGroups.length > 0 && (
          <datalist id="webhook-edit-groups">
            {existingGroups.map(g => <option key={g} value={g} />)}
          </datalist>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook Secret (optional)</label>
        <input
          type="password"
          placeholder="HMAC signing secret for signature verification"
          value={form.secret || ''}
          onChange={e => setForm(f => ({ ...f, secret: e.target.value || undefined }))}
          className={inputCls}
        />
        <p className="text-xs text-gray-400 mt-1">Set a secret in Forgejo/GitHub webhook settings to enable signature verification</p>
      </div>

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
          <ContentTypeSelector headers={form.headers} onHeadersChange={h => setForm(f => ({ ...f, headers: h }))} />
          <AuthSection headers={form.headers} onHeadersChange={h => setForm(f => ({ ...f, headers: h }))} />

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Additional Headers (one per line: Key: Value)</label>
            <textarea placeholder="X-Custom-Header: value" value={form.headers} onChange={e => setForm(f => ({ ...f, headers: e.target.value }))} className={inputCls} rows={2} />
          </div>
          <div>
            <textarea placeholder="Body template" value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} className={inputCls} rows={3} />
            <TemplateHelp />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Template (JSON)</label>
            <textarea
              value={form.template || ''}
              onChange={e => setForm(f => ({ ...f, template: e.target.value }))}
              className={`${inputCls} min-h-[80px] font-mono text-xs`}
              placeholder='{"title": "{{.Title}}", "message": "{{.Message}}"}'
            />
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

          <label className="flex items-center gap-2 text-sm dark:text-gray-300">
            <input type="checkbox" checked={form.follow_redirects} onChange={e => setForm(f => ({ ...f, follow_redirects: e.target.checked }))} />
            Follow redirects
          </label>
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

function VariablesSection({ variables, onReload }: { variables: WebhookVariable[]; onReload: () => void }) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    try {
      await api.createWebhookVariable({ key: newKey.trim(), value: newValue });
      setNewKey('');
      setNewValue('');
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleSave = async (id: number) => {
    try {
      await api.updateWebhookVariable(id, { key: editKey, value: editValue });
      setEditingId(null);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteWebhookVariable(id);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Template Variables</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Define variables to use in webhook body templates with <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{'{{env.KEY}}'}</code> syntax.
      </p>
      {error && <div className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</div>}
      <table className="w-full text-sm mb-2">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="pb-1 pr-2">Key</th>
            <th className="pb-1 pr-2">Value</th>
            <th className="pb-1 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {variables.map(v => (
            <tr key={v.id} className="border-t border-gray-200 dark:border-gray-700">
              {editingId === v.id ? (
                <>
                  <td className="py-1 pr-2"><input value={editKey} onChange={e => setEditKey(e.target.value)} className={`${inputCls} text-xs`} /></td>
                  <td className="py-1 pr-2"><input value={editValue} onChange={e => setEditValue(e.target.value)} className={`${inputCls} text-xs`} /></td>
                  <td className="py-1">
                    <button onClick={() => handleSave(v.id)} className="text-xs text-green-600 hover:underline mr-2">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-1 pr-2 font-mono text-xs dark:text-gray-300">{v.key}</td>
                  <td className="py-1 pr-2 text-xs text-gray-600 dark:text-gray-400">{v.value}</td>
                  <td className="py-1">
                    <button onClick={() => { setEditingId(v.id); setEditKey(v.key); setEditValue(v.value); }} className="text-xs text-indigo-600 hover:underline mr-2">Edit</button>
                    <button onClick={() => handleDelete(v.id)} className="text-xs text-red-600 hover:underline">Del</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <input placeholder="Key" value={newKey} onChange={e => setNewKey(e.target.value)} className={`${inputCls} text-xs flex-1`} />
        <input placeholder="Value" value={newValue} onChange={e => setNewValue(e.target.value)} className={`${inputCls} text-xs flex-1`} />
        <button onClick={handleAdd} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Add</button>
      </div>
    </div>
  );
}
