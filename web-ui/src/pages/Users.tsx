import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { User, CreateUser, UpdateUser } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const load = useCallback(() => {
    api.listUsers().then(setUsers).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateUser) => {
    await api.createUser(data);
    setShowCreate(false);
    load();
  };

  const handleUpdate = async (id: number, data: UpdateUser) => {
    await api.updateUser(id, data);
    setEditUser(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    await api.deleteUser(deleteUser.id);
    setDeleteUser(null);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Users</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create User
        </button>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={users}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'username', header: 'Username' },
          { key: 'email', header: 'Email', render: u => u.email || '-' },
          { key: 'is_admin', header: 'Admin', render: u => u.is_admin ? 'Yes' : 'No' },
          { key: 'created_at', header: 'Created' },
        ]}
        actions={u => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditUser(u)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteUser(u)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSubmit={handleUpdate} />}
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Delete user "${deleteUser?.username}"? This cannot be undone.`}
      />
    </div>
  );
}

function CreateUserModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: CreateUser) => Promise<void> }) {
  const [form, setForm] = useState({ username: '', password: '', email: '', is_admin: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        username: form.username,
        password: form.password,
        email: form.email || undefined,
        is_admin: form.is_admin,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Create User">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
        <input placeholder="Username" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        <input placeholder="Password" type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        <input placeholder="Email (optional)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        <label className="flex items-center gap-2 text-sm dark:text-gray-300">
          <input type="checkbox" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
          Admin
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSubmit }: { user: User; onClose: () => void; onSubmit: (id: number, d: UpdateUser) => Promise<void> }) {
  const [form, setForm] = useState({ username: user.username, email: user.email || '', is_admin: user.is_admin });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(user.id, {
        username: form.username,
        email: form.email || undefined,
        is_admin: form.is_admin,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
        <input placeholder="Username" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        <label className="flex items-center gap-2 text-sm dark:text-gray-300">
          <input type="checkbox" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
          Admin
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}
