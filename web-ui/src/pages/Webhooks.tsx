import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig, WebhookDeliveryLog } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editWh, setEditWh] = useState<WebhookConfig | null>(null);
  const [deleteWh, setDeleteWh] = useState<WebhookConfig | null>(null);
  const [logsWh, setLogsWh] = useState<WebhookConfig | null>(null);

  const load = useCallback(() => {
    api.listWebhooks().then(setWebhooks).catch(e => setError(e.message));
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
          { key: 'webhook_type', header: 'Type' },
          { key: 'token', header: 'Token', render: w => <TokenDisplay token={w.token} /> },
          { key: 'enabled', header: 'Enabled', render: w => w.enabled ? 'Yes' : 'No' },
        ]}
        actions={w => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setLogsWh(w)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm">Logs</button>
            <button onClick={() => setEditWh(w)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteWh(w)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Webhook">
          <WebhookForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      {editWh && (
        <Modal open onClose={() => setEditWh(null)} title="Edit Webhook">
          <EditWebhookForm webhook={editWh} onSubmit={d => handleUpdate(editWh.id, d)} onClose={() => setEditWh(null)} />
        </Modal>
      )}
      {logsWh && (
        <Modal open onClose={() => setLogsWh(null)} title={`Delivery Logs — ${logsWh.name}`}>
          <DeliveryLogViewer webhookId={logsWh.id} />
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

function WebhookForm({ onSubmit, onClose }: { onSubmit: (d: CreateWebhookConfig) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', webhook_type: 'custom', template: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        webhook_type: form.webhook_type,
        template: form.template || undefined,
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
      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <select value={form.webhook_type} onChange={e => setForm(f => ({ ...f, webhook_type: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white">
        <option value="custom">Custom</option>
        <option value="github">GitHub</option>
        <option value="grafana">Grafana</option>
      </select>
      <textarea placeholder="Template (optional)" value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" rows={3} />
      <TemplateHelp />
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
                {log.response_body_preview ? log.response_body_preview.slice(0, 80) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditWebhookForm({ webhook, onSubmit, onClose }: { webhook: WebhookConfig; onSubmit: (d: UpdateWebhookConfig) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: webhook.name, template: webhook.template, enabled: webhook.enabled });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ name: form.name, template: form.template, enabled: form.enabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <textarea placeholder="Template" value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" rows={3} />
      <TemplateHelp />
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
