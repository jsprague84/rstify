import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { TopicPermission, UserResponse } from 'shared';
import DataTable from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import ConfirmDialog from '../components/ConfirmDialog';
import { useCrudResource } from '../hooks/useCrudResource';

export default function Permissions() {
  const fetchPermissions = useCallback(() => api.listPermissions(), []);
  const crud = useCrudResource(fetchPermissions);

  const fetchUsers = useCallback(() => api.listUsers(), []);
  const usersCrud = useCrudResource<UserResponse>(fetchUsers);

  const [showCreate, setShowCreate] = useState(false);
  const [deletePerm, setDeletePerm] = useState<TopicPermission | null>(null);

  // Form field state
  const [userId, setUserId] = useState('');
  const [topicPattern, setTopicPattern] = useState('');
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);

  const resetForm = () => {
    setUserId(usersCrud.items[0]?.id?.toString() ?? '');
    setTopicPattern('');
    setCanRead(true);
    setCanWrite(false);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const handleDelete = async () => {
    if (!deletePerm) return;
    const ok = await crud.mutate(() => api.deletePermission(deletePerm.id));
    if (ok) setDeletePerm(null);
  };

  const getUserName = (id: number) => usersCrud.items.find((u) => u.id === id)?.username || `User #${id}`;

  const userOptions = usersCrud.items.map((u) => ({ value: String(u.id), label: u.username }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Topic Permissions</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Add Permission
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
          { key: 'user_id', header: 'User', render: (p) => getUserName(p.user_id) },
          { key: 'topic_pattern', header: 'Topic Pattern' },
          { key: 'can_read', header: 'Read', render: (p) => (p.can_read ? 'Yes' : 'No') },
          { key: 'can_write', header: 'Write', render: (p) => (p.can_write ? 'Yes' : 'No') },
        ]}
        actions={(p) => (
          <button onClick={() => setDeletePerm(p)} className="text-red-600 hover:text-red-800 text-sm">
            Delete
          </button>
        )}
      />
      <FormModal
        title="Add Topic Permission"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async () => {
          if (!topicPattern.trim()) throw new Error('Topic pattern is required');
          await api.createPermission({
            user_id: Number(userId),
            topic_pattern: topicPattern,
            can_read: canRead,
            can_write: canWrite,
          });
          await crud.reload();
        }}
        submitLabel="Add"
      >
        <FormField
          type="select"
          label="User"
          required
          value={userId}
          onChange={setUserId}
          options={userOptions}
        />
        <FormField
          label="Topic Pattern"
          required
          value={topicPattern}
          onChange={setTopicPattern}
          placeholder="e.g. alerts/* or my-topic"
          helpText="Use * as wildcard. Example: alerts/* matches alerts/cpu, alerts/disk, etc."
        />
        <FormField type="checkbox" label="Can Read" checked={canRead} onChange={setCanRead} />
        <FormField type="checkbox" label="Can Write" checked={canWrite} onChange={setCanWrite} />
      </FormModal>
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
