import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { TopicPermission, CreateTopicPermission, User } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Permissions() {
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deletePerm, setDeletePerm] = useState<TopicPermission | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.listPermissions(),
      api.listUsers(),
    ]).then(([perms, u]) => {
      setPermissions(perms);
      setUsers(u);
    }).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateTopicPermission) => {
    await api.createPermission(data);
    setShowCreate(false);
    load();
  };

  const handleDelete = async () => {
    if (!deletePerm) return;
    await api.deletePermission(deletePerm.id);
    setDeletePerm(null);
    load();
  };

  const getUserName = (userId: number) => users.find(u => u.id === userId)?.username || `User #${userId}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Topic Permissions</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Add Permission
        </button>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={permissions}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'user_id', header: 'User', render: p => getUserName(p.user_id) },
          { key: 'topic_pattern', header: 'Topic Pattern' },
          { key: 'can_read', header: 'Read', render: p => p.can_read ? 'Yes' : 'No' },
          { key: 'can_write', header: 'Write', render: p => p.can_write ? 'Yes' : 'No' },
        ]}
        actions={p => (
          <button onClick={() => setDeletePerm(p)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Add Topic Permission">
          <PermissionForm users={users} onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      <ConfirmDialog
        open={!!deletePerm}
        onClose={() => setDeletePerm(null)}
        onConfirm={handleDelete}
        title="Delete Permission"
        message={`Remove ${getUserName(deletePerm?.user_id ?? 0)}'s access to "${deletePerm?.topic_pattern}"?`}
      />
    </div>
  );
}

const inputCls = "w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white";

function PermissionForm({ users, onSubmit, onClose }: {
  users: User[];
  onSubmit: (d: CreateTopicPermission) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ user_id: users[0]?.id ?? 0, topic_pattern: '', can_read: true, can_write: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic_pattern.trim()) {
      setError('Topic pattern is required');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ user_id: form.user_id, topic_pattern: form.topic_pattern, can_read: form.can_read, can_write: form.can_write });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User</label>
        <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: Number(e.target.value) }))} className={inputCls}>
          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Topic Pattern</label>
        <input placeholder="e.g. alerts/* or my-topic" required value={form.topic_pattern} onChange={e => setForm(f => ({ ...f, topic_pattern: e.target.value }))} className={inputCls} />
        <p className="text-xs text-gray-400 mt-1">Use * as wildcard. Example: alerts/* matches alerts/cpu, alerts/disk, etc.</p>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm dark:text-gray-300">
          <input type="checkbox" checked={form.can_read} onChange={e => setForm(f => ({ ...f, can_read: e.target.checked }))} />
          Can Read
        </label>
        <label className="flex items-center gap-2 text-sm dark:text-gray-300">
          <input type="checkbox" checked={form.can_write} onChange={e => setForm(f => ({ ...f, can_write: e.target.checked }))} />
          Can Write
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Add</button>
      </div>
    </form>
  );
}
