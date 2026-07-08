import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { TopicPermission, UserResponse, Topic } from 'shared';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import ConfirmDialog from '../components/ConfirmDialog';
import { useCrudResource } from '../hooks/useCrudResource';

export default function Permissions() {
  const fetchPermissions = useCallback(() => api.listPermissions(), []);
  const crud = useCrudResource(fetchPermissions);

  const fetchUsers = useCallback(() => api.listUsers(), []);
  const usersCrud = useCrudResource<UserResponse>(fetchUsers);

  // Real topic names for the pattern autocomplete — free text stays allowed
  // for wildcards, but typos shouldn't be the default experience.
  const [topics, setTopics] = useState<Topic[]>([]);
  useEffect(() => {
    api.listTopics().then(setTopics).catch(() => {});
  }, []);

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
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Topic Permissions</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-pill hover:bg-brand-600 transition"
        >
          Add Permission
        </button>
      </div>
      {crud.error && (
        <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm mb-4">
          {crud.error}
        </div>
      )}
      <DataTable
        data={crud.items}
        keyField="id"
        loading={crud.loading}
        empty={
          <EmptyState
            title="No topic permissions yet"
            subtitle="Grant users read or write access to topics with exact names or wildcard patterns."
            actionLabel="Add a permission"
            onAction={openCreate}
          />
        }
        columns={[
          { key: 'user_id', header: 'User', render: (p) => getUserName(p.user_id) },
          { key: 'topic_pattern', header: 'Topic Pattern' },
          { key: 'can_read', header: 'Read', render: (p) => (p.can_read ? 'Yes' : 'No') },
          { key: 'can_write', header: 'Write', render: (p) => (p.can_write ? 'Yes' : 'No') },
        ]}
        actions={(p) => (
          <button onClick={() => setDeletePerm(p)} className="text-error hover:text-error/80 text-sm font-medium">
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
        <div>
          <FormField
            label="Topic Pattern"
            required
            value={topicPattern}
            onChange={setTopicPattern}
            placeholder="e.g. alerts/* or my-topic"
            helpText="Use * as wildcard. Example: alerts/* matches alerts/cpu, alerts/disk, etc."
          />
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 -mt-1 mb-2">
              {topics
                .filter(t => !topicPattern || t.name.toLowerCase().includes(topicPattern.toLowerCase()))
                .slice(0, 8)
                .map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopicPattern(t.name)}
                    className={`px-2 py-0.5 text-xs rounded-pill transition ${topicPattern === t.name ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 hover:text-primary'}`}
                  >
                    {t.name}
                  </button>
                ))}
            </div>
          )}
        </div>
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
