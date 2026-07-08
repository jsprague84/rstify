import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { WebhookConfigWithHealth, UpdateWebhookConfig, WebhookTestResult, Topic, Application, WebhookVariable } from 'shared';
import { formatLocalTime, formatTimeAgo, incomingCurlExample, getWebhookGuide } from 'shared';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Sparkline from '../components/Sparkline';
import CodeGenerator from '../components/CodeGenerator';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useCrudResource } from '../hooks/useCrudResource';
import { parseWebhookHeaders } from '../utils/webhookHelpers';
import CreateWebhookFlow from '../components/webhooks/CreateWebhookFlow';
import EditWebhookForm from '../components/webhooks/EditWebhookForm';
import DeliveryLog from '../components/webhooks/DeliveryLog';
import VariablesPanel from '../components/webhooks/VariablesPanel';
import IncomingSetupInfo from '../components/webhooks/IncomingSetupInfo';
import OverflowMenu from '../components/webhooks/OverflowMenu';
import { friendlyWebhookError } from '../components/webhooks/headerUtils';

export default function Webhooks() {
  const { toast } = useToast();

  // Reference data (not CRUD-managed on this page)
  const [topics, setTopics] = useState<Topic[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [variables, setVariables] = useState<WebhookVariable[]>([]);

  const fetchWebhooks = useCallback(async () => {
    const [wh, tp, ap, vars] = await Promise.all([
      api.listWebhooks(),
      api.listTopics(),
      api.listApplications(),
      api.listWebhookVariables(),
    ]);
    setTopics(tp);
    setApps(ap);
    setVariables(vars);
    return wh;
  }, []);
  const crud = useCrudResource(fetchWebhooks);

  // Modal / UI state
  const [showCreate, setShowCreate] = useState(false);
  const [editWh, setEditWh] = useState<WebhookConfigWithHealth | null>(null);
  const [deleteWh, setDeleteWh] = useState<WebhookConfigWithHealth | null>(null);
  const [logsWh, setLogsWh] = useState<WebhookConfigWithHealth | null>(null);
  const [setupWh, setSetupWh] = useState<WebhookConfigWithHealth | null>(null);
  const [testWh, setTestWh] = useState<WebhookConfigWithHealth | null>(null);
  const [codeWh, setCodeWh] = useState<WebhookConfigWithHealth | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showVars, setShowVars] = useState(false);

  const handleUpdate = async (id: number, data: UpdateWebhookConfig) => {
    await api.updateWebhook(id, data);
    setEditWh(null);
    await crud.reload();
  };

  const handleDuplicate = async (w: WebhookConfigWithHealth) => {
    const ok = await crud.mutate(() => api.createWebhook({
      name: `${w.name} (copy)`,
      webhookType: w.webhook_type,
      direction: w.direction,
      targetTopicId: w.target_topic_id ?? null,
      targetApplicationId: w.target_application_id ?? null,
      targetUrl: w.target_url ?? null,
      httpMethod: w.http_method,
      headers: Object.keys(parseWebhookHeaders(w.headers)).length > 0 ? parseWebhookHeaders(w.headers) : null,
      bodyTemplate: w.body_template ?? null,
      maxRetries: w.max_retries,
      retryDelaySecs: w.retry_delay_secs,
      timeoutSecs: w.timeout_secs,
      followRedirects: w.follow_redirects,
      enabled: null,
      template: null,
      groupName: w.group_name ?? null,
      secret: null,
    }).then(() => {}));
    if (ok) toast('Webhook duplicated', 'success');
  };

  const handleToggleEnabled = async (w: WebhookConfigWithHealth) => {
    await crud.mutate(() => api.updateWebhook(w.id, {
      name: null, template: null, enabled: !w.enabled,
      targetUrl: null, httpMethod: null, headers: null,
      bodyTemplate: null, maxRetries: null, retryDelaySecs: null,
      timeoutSecs: null, followRedirects: null, groupName: null, secret: null,
    }).then(() => {}));
  };

  const handleDelete = async () => {
    if (!deleteWh) return;
    const ok = await crud.mutate(() => api.deleteWebhook(deleteWh.id));
    if (ok) setDeleteWh(null);
  };

  const getWebhookUrl = (wh: WebhookConfigWithHealth) => `${window.location.origin}/api/wh/${wh.token}`;

  const generateCurl = (w: WebhookConfigWithHealth) => {
    if (w.direction === 'outgoing' && w.target_url) {
      const parts = [`curl -X ${w.http_method} '${w.target_url}'`];
      const h = parseWebhookHeaders(w.headers);
      for (const [k, v] of Object.entries(h)) parts.push(`-H '${k}: ${v}'`);
      if (w.http_method !== 'GET' && w.http_method !== 'DELETE') {
        const body = w.body_template || '{"title":"Test","message":"Hello"}';
        parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
        if (!Object.keys(h).some(k => k.toLowerCase() === 'content-type')) {
          parts.push("-H 'Content-Type: application/json'");
        }
      }
      return parts.join(' \\\n  ');
    }
    return incomingCurlExample(getWebhookUrl(w), getWebhookGuide(w.webhook_type).samplePayload);
  };

  const copyCurl = (w: WebhookConfigWithHealth) => {
    navigator.clipboard.writeText(generateCurl(w)).then(() => toast('curl command copied', 'success'));
  };

  const directionBadge = (dir: string) => {
    const isOut = dir === 'outgoing';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-semibold ${
        isOut ? 'bg-warning/10 text-warning' : 'bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-300'
      }`}>
        {isOut ? '→ Out' : '← In'}
      </span>
    );
  };

  const columns = [
    { key: 'name', header: 'Name', render: (w: WebhookConfigWithHealth) => (
      <div>
        <div className="font-medium text-slate-900 dark:text-white">{w.name}</div>
        <div className="text-caption text-slate-400">{w.direction === 'outgoing' ? 'outgoing' : getWebhookGuide(w.webhook_type).label}</div>
      </div>
    )},
    { key: 'direction', header: 'Direction', render: (w: WebhookConfigWithHealth) => directionBadge(w.direction || 'incoming') },
    { key: 'target_url', header: 'Target', render: (w: WebhookConfigWithHealth) =>
      w.direction === 'outgoing' && w.target_url ? (
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{w.http_method} {w.target_url.length > 42 ? `${w.target_url.slice(0, 42)}…` : w.target_url}</span>
      ) : (
        <code className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px] inline-block align-middle" title={getWebhookUrl(w)}>…/api/wh/{w.token.slice(0, 10)}…</code>
      )
    },
    { key: 'enabled', header: 'Enabled', render: (w: WebhookConfigWithHealth) => (
      <button
        onClick={() => handleToggleEnabled(w)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${w.enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-white/15'}`}
        title={w.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${w.enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
      </button>
    )},
    { key: 'health', header: 'Health', render: (w: WebhookConfigWithHealth) => {
      if (w.recent_success_rate == null) {
        return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />No data</span>;
      }
      const rate = w.recent_success_rate;
      const label = rate >= 0.8 ? 'Healthy' : rate >= 0.5 ? 'Degraded' : 'Failing';
      const dotCls = rate >= 0.8 ? 'bg-success' : rate >= 0.5 ? 'bg-warning' : 'bg-error';
      const textCls = rate >= 0.8 ? 'text-success' : rate >= 0.5 ? 'text-warning' : 'text-error';
      const lastLabel = w.direction === 'outgoing' ? 'Last delivery' : 'Last received';
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs ${textCls}`}
          title={`${Math.round(rate * 100)}% success${w.last_delivery_at ? ` · ${lastLabel}: ${formatLocalTime(w.last_delivery_at)}` : ''}`}
        >
          <span className={`w-2 h-2 rounded-full ${dotCls} inline-block`} />
          {label}
          {w.last_delivery_at && <span className="text-slate-400 ml-1">{formatTimeAgo(w.last_delivery_at)}</span>}
        </span>
      );
    }},
    { key: 'sparkline', header: '', render: (w: WebhookConfigWithHealth) =>
      w.direction === 'outgoing' && w.recent_durations && w.recent_durations.length >= 2
        ? <Sparkline data={w.recent_durations} />
        : null
    },
  ];

  const renderActions = (w: WebhookConfigWithHealth) => (
    <div className="flex gap-1.5 justify-end items-center">
      {w.direction === 'outgoing' ? (
        <button onClick={() => setTestWh(w)} className="px-3 py-1 text-xs font-semibold rounded-pill border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition">Test</button>
      ) : (
        <button onClick={() => setSetupWh(w)} className="px-3 py-1 text-xs font-semibold rounded-pill border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition">Setup</button>
      )}
      <OverflowMenu items={[
        { label: 'Logs', onClick: () => setLogsWh(w) },
        { label: 'Copy curl', onClick: () => copyCurl(w) },
        ...(w.direction === 'outgoing' && w.target_url ? [{ label: 'Code', onClick: () => setCodeWh(w) }] : []),
        { label: 'Duplicate', onClick: () => handleDuplicate(w) },
        { label: 'Edit', onClick: () => setEditWh(w) },
        { label: 'Delete', onClick: () => setDeleteWh(w), destructive: true },
      ]} />
    </div>
  );

  const existingGroups = [...new Set(crud.items.map(w => w.group_name).filter((g): g is string => !!g))];

  // Group webhooks by group_name
  const groups = new Map<string, WebhookConfigWithHealth[]>();
  const ungrouped: WebhookConfigWithHealth[] = [];
  for (const wh of crud.items) {
    if (wh.group_name) {
      const list = groups.get(wh.group_name) || [];
      list.push(wh);
      groups.set(wh.group_name, list);
    } else {
      ungrouped.push(wh);
    }
  }
  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const emptyState = (
    <EmptyState
      title="No webhooks yet"
      subtitle="Receive notifications from GitHub, Forgejo, Grafana or any script — or forward topic messages to another service."
      actionLabel="Create your first webhook"
      onAction={() => setShowCreate(true)}
    />
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Webhooks</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowVars(v => !v)} className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-pill hover:border-primary hover:text-primary transition">
            Variables {variables.length > 0 && `(${variables.length})`}
          </button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-pill hover:bg-brand-600 transition">
            New webhook
          </button>
        </div>
      </div>
      {showVars && <VariablesPanel variables={variables} onMutate={crud.mutate} />}
      {crud.error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm mb-4">{friendlyWebhookError(crud.error)}</div>}

      {groups.size === 0 ? (
        <DataTable data={crud.items} keyField="id" columns={columns} actions={renderActions} loading={crud.loading} empty={emptyState} />
      ) : (
        <div className="space-y-4">
          {ungrouped.length > 0 && (
            <DataTable data={ungrouped} keyField="id" columns={columns} actions={renderActions} />
          )}
          {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupName, items]) => (
            <div key={groupName}>
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between px-1 py-2 mb-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
              >
                <span>{collapsedGroups.has(groupName) ? '▶' : '▼'} {groupName}</span>
                <span className="text-caption font-mono text-slate-400">{items.length}</span>
              </button>
              {!collapsedGroups.has(groupName) && (
                <DataTable data={items} keyField="id" columns={columns} actions={renderActions} />
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="New webhook">
          <CreateWebhookFlow
            topics={topics}
            apps={apps}
            variables={variables}
            existingGroups={existingGroups}
            onCreated={() => crud.reload()}
            onClose={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editWh && (
        <Modal open onClose={() => setEditWh(null)} title={`Edit — ${editWh.name}`}>
          <EditWebhookForm
            webhook={editWh}
            variables={variables}
            existingGroups={existingGroups}
            onSubmit={d => handleUpdate(editWh.id, d)}
            onClose={() => setEditWh(null)}
            onRegenerate={editWh.direction !== 'outgoing' ? async () => {
              const updated = await api.regenerateWebhookToken(editWh.id);
              setEditWh({ ...editWh, ...updated });
              await crud.reload();
            } : undefined}
          />
        </Modal>
      )}

      {setupWh && (
        <Modal open onClose={() => setSetupWh(null)} title={`Setup — ${setupWh.name}`}>
          <IncomingSetupInfo webhookType={setupWh.webhook_type} url={getWebhookUrl(setupWh)} />
        </Modal>
      )}

      {logsWh && (
        <Modal open onClose={() => setLogsWh(null)} title={`Logs — ${logsWh.name}`}>
          <DeliveryLog webhookId={logsWh.id} direction={logsWh.direction || 'incoming'} />
        </Modal>
      )}

      {testWh && (
        <Modal open onClose={() => setTestWh(null)} title={`Test — ${testWh.name}`}>
          <OutgoingTestPanel webhook={testWh} />
        </Modal>
      )}

      {codeWh && codeWh.target_url && (
        <Modal open onClose={() => setCodeWh(null)} title={`Code — ${codeWh.name}`}>
          <CodeGenerator
            url={codeWh.target_url}
            method={codeWh.http_method}
            headers={parseWebhookHeaders(codeWh.headers)}
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

/** Editable payload → live response viewer for outgoing webhook tests. */
function OutgoingTestPanel({ webhook }: { webhook: WebhookConfigWithHealth }) {
  const defaultPayload = JSON.stringify(
    { title: 'Test Webhook', message: 'This is a test message from rstify.', priority: 5, topic: 'test-topic' },
    null, 2,
  );
  const [payload, setPayload] = useState(defaultPayload);
  const [result, setResult] = useState<WebhookTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'body' | 'headers'>('body');

  const send = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      let parsed: { title?: string; message?: string; priority?: number; topic?: string } | undefined;
      if (payload.trim()) {
        try {
          parsed = JSON.parse(payload);
        } catch {
          setError('The test payload is not valid JSON.');
          setLoading(false);
          return;
        }
      }
      setResult(await api.testWebhook(webhook.id, parsed));
    } catch (err) {
      setError(friendlyWebhookError(err instanceof Error ? err.message : 'Test failed'));
    } finally {
      setLoading(false);
    }
  };

  const formatBody = (raw: string) => {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  };

  const statusColor = result?.status_code
    ? result.status_code < 300 ? 'bg-success' : result.status_code < 400 ? 'bg-primary' : result.status_code < 500 ? 'bg-warning' : 'bg-error'
    : 'bg-slate-400';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Test payload (JSON)</label>
        <textarea
          value={payload}
          onChange={e => setPayload(e.target.value)}
          className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-elevated text-sm p-2.5 font-mono text-slate-800 dark:text-slate-100"
          rows={6}
        />
      </div>
      <div className="flex justify-end">
        <button onClick={send} disabled={loading} className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-pill hover:bg-brand-600 disabled:opacity-50 transition">
          {loading ? 'Sending…' : 'Send test'}
        </button>
      </div>
      {error && <div className="text-sm text-error bg-error/10 rounded-xl px-4 py-2.5 whitespace-pre-line">{error}</div>}
      {result && (
        <div className="space-y-3 border-t border-slate-100 dark:border-white/10 pt-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${result.success ? 'text-success' : 'text-error'}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
              {result.status_code && <span className="font-mono">HTTP {result.status_code}</span>}
            </div>
            {result.duration_ms != null && <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{result.duration_ms}ms</span>}
          </div>
          {result.error && <div className="text-sm text-error bg-error/10 rounded-xl px-4 py-2.5 whitespace-pre-line">{friendlyWebhookError(result.error)}</div>}
          {(result.response_preview || result.response_headers) && (
            <div>
              <div className="flex gap-1 border-b border-slate-200 dark:border-white/10 mb-2">
                <button onClick={() => setTab('body')} className={`px-3 py-1 text-xs font-medium ${tab === 'body' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 dark:text-slate-400'}`}>Body</button>
                <button onClick={() => setTab('headers')} className={`px-3 py-1 text-xs font-medium ${tab === 'headers' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 dark:text-slate-400'}`}>Headers</button>
              </div>
              {tab === 'body' && result.response_preview && (
                <pre className="bg-slate-50 dark:bg-surface-elevated rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 max-h-64 overflow-auto whitespace-pre-wrap font-mono">{formatBody(result.response_preview)}</pre>
              )}
              {tab === 'headers' && result.response_headers && (
                <div className="bg-slate-50 dark:bg-surface-elevated rounded-xl p-3 text-xs font-mono max-h-64 overflow-auto">
                  {Object.entries(result.response_headers).map(([k, v]) => (
                    <div key={k} className="text-slate-700 dark:text-slate-300"><span className="text-primary">{k}:</span> {String(v)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
