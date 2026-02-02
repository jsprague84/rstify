import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Topic, CreateTopic } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Topics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);

  const load = useCallback(() => {
    api.listTopics().then(setTopics).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateTopic) => {
    await api.createTopic(data);
    setShowCreate(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTopic) return;
    await api.deleteTopic(deleteTopic.name);
    setDeleteTopic(null);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Topics</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Topic
        </button>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={topics}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'description', header: 'Description', render: t => t.description || '-' },
          { key: 'everyone_read', header: 'Public Read', render: t => t.everyone_read ? 'Yes' : 'No' },
          { key: 'everyone_write', header: 'Public Write', render: t => t.everyone_write ? 'Yes' : 'No' },
        ]}
        actions={t => (
          <button onClick={() => setDeleteTopic(t)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Topic">
          <TopicForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      <ConfirmDialog
        open={!!deleteTopic}
        onClose={() => setDeleteTopic(null)}
        onConfirm={handleDelete}
        title="Delete Topic"
        message={`Delete topic "${deleteTopic?.name}"? All associated messages will be deleted.`}
      />
    </div>
  );
}

function TopicForm({ onSubmit, onClose }: { onSubmit: (d: CreateTopic) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', everyone_read: true, everyone_write: true });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        description: form.description || undefined,
        everyone_read: form.everyone_read,
        everyone_write: form.everyone_write,
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
      <input placeholder="Topic name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <label className="flex items-center gap-2 text-sm dark:text-gray-300">
        <input type="checkbox" checked={form.everyone_read} onChange={e => setForm(f => ({ ...f, everyone_read: e.target.checked }))} />
        Everyone can read
      </label>
      <label className="flex items-center gap-2 text-sm dark:text-gray-300">
        <input type="checkbox" checked={form.everyone_write} onChange={e => setForm(f => ({ ...f, everyone_write: e.target.checked }))} />
        Everyone can write
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Create</button>
      </div>
    </form>
  );
}
