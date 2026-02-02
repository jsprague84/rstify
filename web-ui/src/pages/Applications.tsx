import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { Application, CreateApplication, UpdateApplication } from '../api/types';

function AppIcon({ app, size = 32 }: { app: Application; size?: number }) {
  const [v] = useState(() => Date.now());
  if (!app.image) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-400 text-xs font-bold"
      >
        {app.name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`${api.getApplicationIconUrl(app.id)}?v=${v}`}
      alt={app.name}
      style={{ width: size, height: size }}
      className="rounded object-cover"
    />
  );
}
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [deleteApp, setDeleteApp] = useState<Application | null>(null);

  const load = useCallback(() => {
    api.listApplications().then(setApps).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateApplication) => {
    await api.createApplication(data);
    setShowCreate(false);
    load();
  };

  const handleUpdate = async (id: number, data: UpdateApplication) => {
    await api.updateApplication(id, data);
    setEditApp(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteApp) return;
    await api.deleteApplication(deleteApp.id);
    setDeleteApp(null);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Applications</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Application
        </button>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={apps}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'image', header: 'Icon', render: a => <AppIcon app={a} size={28} /> },
          { key: 'name', header: 'Name' },
          { key: 'description', header: 'Description', render: a => a.description || '-' },
          { key: 'token', header: 'Token', render: a => <TokenDisplay token={a.token} /> },
          { key: 'default_priority', header: 'Priority' },
        ]}
        actions={a => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditApp(a)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteApp(a)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Application">
          <AppForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      {editApp && (
        <Modal open onClose={() => setEditApp(null)} title="Edit Application">
          <AppForm app={editApp} onSubmit={d => handleUpdate(editApp.id, d)} onClose={() => setEditApp(null)} onIconChange={load} />
        </Modal>
      )}
      <ConfirmDialog
        open={!!deleteApp}
        onClose={() => setDeleteApp(null)}
        onConfirm={handleDelete}
        title="Delete Application"
        message={`Delete application "${deleteApp?.name}"? All associated messages will be deleted.`}
      />
    </div>
  );
}

function AppForm({ app, onSubmit, onClose, onIconChange }: { app?: Application; onSubmit: (d: CreateApplication & UpdateApplication) => Promise<void>; onClose: () => void; onIconChange?: () => void }) {
  const [form, setForm] = useState({
    name: app?.name || '',
    description: app?.description || '',
    default_priority: app?.default_priority ?? 5,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [iconLoading, setIconLoading] = useState(false);
  const [iconVersion, setIconVersion] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        description: form.description || undefined,
        default_priority: form.default_priority,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;
    setIconLoading(true);
    setError('');
    try {
      await api.uploadApplicationIcon(app.id, file);
      setIconVersion(Date.now());
      onIconChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIconLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleIconRemove = async () => {
    if (!app) return;
    setIconLoading(true);
    setError('');
    try {
      await api.deleteApplicationIcon(app.id);
      setIconVersion(Date.now());
      onIconChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setIconLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
      {app && (
        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Icon</label>
          <div className="flex items-center gap-3">
            {app.image ? (
              <img
                src={`${api.getApplicationIconUrl(app.id)}?v=${iconVersion}`}
                alt="icon"
                className="w-10 h-10 rounded object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-bold">
                {app.name.charAt(0).toUpperCase()}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              onChange={handleIconUpload}
              disabled={iconLoading}
              className="text-sm"
            />
            {app.image && (
              <button
                type="button"
                onClick={handleIconRemove}
                disabled={iconLoading}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Default Priority</label>
        <input type="number" min={0} max={10} value={form.default_priority} onChange={e => setForm(f => ({ ...f, default_priority: parseInt(e.target.value) || 0 }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{app ? 'Save' : 'Create'}</button>
      </div>
    </form>
  );
}
