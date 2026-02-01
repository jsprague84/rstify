import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Application, CreateApplication, UpdateApplication } from '../api/types';
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
        <h2 className="text-2xl font-bold">Applications</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Application
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={apps}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
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
          <AppForm app={editApp} onSubmit={d => handleUpdate(editApp.id, d)} onClose={() => setEditApp(null)} />
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

function AppForm({ app, onSubmit, onClose }: { app?: Application; onSubmit: (d: CreateApplication & UpdateApplication) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({
    name: app?.name || '',
    description: app?.description || '',
    default_priority: app?.default_priority ?? 5,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      <input placeholder="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
      <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
      <div>
        <label className="block text-sm text-gray-700 mb-1">Default Priority</label>
        <input type="number" min={0} max={10} value={form.default_priority} onChange={e => setForm(f => ({ ...f, default_priority: parseInt(e.target.value) || 0 }))} className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{app ? 'Save' : 'Create'}</button>
      </div>
    </form>
  );
}
