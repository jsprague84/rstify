import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { UserResponse } from 'shared';
import DataTable from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import ConfirmDialog from '../components/ConfirmDialog';
import { useCrudResource } from '../hooks/useCrudResource';
import { formatLocalTime } from 'shared';

export default function Users() {
  const fetchUsers = useCallback(() => api.listUsers(), []);
  const crud = useCrudResource(fetchUsers);

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserResponse | null>(null);

  // Form field state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setEmail('');
    setIsAdmin(false);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (u: UserResponse) => {
    setUsername(u.username);
    setPassword('');
    setEmail(u.email || '');
    setIsAdmin(u.is_admin);
    setEditUser(u);
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const ok = await crud.mutate(() => api.deleteUser(deleteUser.id));
    if (ok) setDeleteUser(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Users</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Create User
        </button>
      </div>
      {crud.error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">
          {crud.error}
        </div>
      )}
      <DataTable
        data={crud.items}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'username', header: 'Username' },
          { key: 'email', header: 'Email', render: (u) => u.email || '-' },
          { key: 'is_admin', header: 'Admin', render: (u) => (u.is_admin ? 'Yes' : 'No') },
          { key: 'created_at', header: 'Created', render: (u) => formatLocalTime(u.created_at) },
        ]}
        actions={(u) => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => openEdit(u)} className="text-indigo-600 hover:text-indigo-800 text-sm">
              Edit
            </button>
            <button onClick={() => setDeleteUser(u)} className="text-red-600 hover:text-red-800 text-sm">
              Delete
            </button>
          </div>
        )}
      />
      <FormModal
        title="Create User"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async () => {
          await api.createUser({
            username,
            password,
            email: email || null,
            is_admin: isAdmin,
          });
          await crud.reload();
        }}
        submitLabel="Create"
      >
        <FormField label="Username" required value={username} onChange={setUsername} placeholder="Username" />
        <FormField
          label="Password"
          type="password"
          required
          value={password}
          onChange={setPassword}
          placeholder="Password"
        />
        <FormField label="Email" value={email} onChange={setEmail} placeholder="Email (optional)" />
        <FormField type="checkbox" label="Admin" checked={isAdmin} onChange={setIsAdmin} />
      </FormModal>
      <FormModal
        title="Edit User"
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSubmit={async () => {
          if (!editUser) return;
          await api.updateUser(editUser.id, {
            username,
            email: email || null,
            is_admin: isAdmin,
          });
          await crud.reload();
        }}
        submitLabel="Save"
      >
        <FormField label="Username" required value={username} onChange={setUsername} placeholder="Username" />
        <FormField label="Email" value={email} onChange={setEmail} placeholder="Email (optional)" />
        <FormField type="checkbox" label="Admin" checked={isAdmin} onChange={setIsAdmin} />
      </FormModal>
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
