import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Topic, MessageResponse } from 'shared';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useCrudResource } from '../hooks/useCrudResource';
import { useAsyncAction } from '../hooks/useAsyncAction';

export default function Topics() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const fetchTopics = useCallback(() => api.listTopics(), []);
  const crud = useCrudResource(fetchTopics);

  const [showCreate, setShowCreate] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);
  const [publishTopic, setPublishTopic] = useState<Topic | null>(null);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createEveryoneRead, setCreateEveryoneRead] = useState(true);
  const [createEveryoneWrite, setCreateEveryoneWrite] = useState(true);

  const resetCreateForm = () => {
    setCreateName('');
    setCreateDescription('');
    setCreateEveryoneRead(true);
    setCreateEveryoneWrite(true);
  };

  const openCreate = () => {
    resetCreateForm();
    setShowCreate(true);
  };

  const handleDelete = async () => {
    if (!deleteTopic) return;
    const ok = await crud.mutate(() => api.deleteTopic(deleteTopic.name));
    if (ok) setDeleteTopic(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Topics</h2>
        <button onClick={openCreate} className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-pill hover:bg-brand-600 transition">
          Create Topic
        </button>
      </div>
      {crud.error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm mb-4">{crud.error}</div>}
      <DataTable
        data={crud.items}
        keyField="id"
        loading={crud.loading}
        empty={
          <EmptyState
            title="No topics yet"
            subtitle="Topics are pub/sub channels — publishers send to a topic and every subscriber receives the message."
            actionLabel="Create your first topic"
            onAction={openCreate}
          />
        }
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'description', header: 'Description', render: t => t.description || '-' },
          { key: 'everyone_read', header: 'Public Read', render: t => t.everyone_read ? 'Yes' : 'No' },
          { key: 'everyone_write', header: 'Public Write', render: t => t.everyone_write ? 'Yes' : 'No' },
        ]}
        actions={t => (
          <div className="flex gap-2 items-center">
            <button onClick={() => setPublishTopic(t)} className="px-3 py-1 text-xs font-semibold rounded-pill border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition">Send</button>
            <button onClick={() => navigate(`/messages?source=topic:${encodeURIComponent(t.name)}`)} className="text-primary hover:text-brand-700 text-sm font-medium">Messages</button>
            <button onClick={() => setEditTopic(t)} className="text-primary hover:text-brand-700 text-sm font-medium">Edit</button>
            <button onClick={() => setDeleteTopic(t)} className="text-error hover:text-error/80 text-sm font-medium">Delete</button>
          </div>
        )}
      />
      <FormModal
        title="Create Topic"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async () => {
          await api.createTopic({
            name: createName,
            description: createDescription || null,
            everyone_read: createEveryoneRead,
            everyone_write: createEveryoneWrite,
          });
          await crud.reload();
        }}
        submitLabel="Create"
      >
        <FormField label="Name" required value={createName} onChange={setCreateName} placeholder="Topic name" />
        <FormField label="Description" value={createDescription} onChange={setCreateDescription} placeholder="Description (optional)" />
        <FormField type="checkbox" label="Everyone can read" checked={createEveryoneRead} onChange={setCreateEveryoneRead} />
        <FormField type="checkbox" label="Everyone can write" checked={createEveryoneWrite} onChange={setCreateEveryoneWrite} />
      </FormModal>
      {editTopic && (
        <Modal open onClose={() => setEditTopic(null)} title={`Edit Topic: ${editTopic.name}`}>
          <EditTopicForm topic={editTopic} onSubmit={async (data) => {
            await api.updateTopic(editTopic.name, data);
            await crud.reload();
            setEditTopic(null);
          }} onClose={() => setEditTopic(null)} />
        </Modal>
      )}
      <ConfirmDialog
        open={!!deleteTopic}
        onClose={() => setDeleteTopic(null)}
        onConfirm={handleDelete}
        title="Delete Topic"
        message={`Delete topic "${deleteTopic?.name}"? All associated messages will be deleted.`}
      />
      {publishTopic && (
        <Modal open onClose={() => setPublishTopic(null)} title={`Send to ${publishTopic.name}`}>
          <PublishForm topicName={publishTopic.name} onSuccess={() => { setPublishTopic(null); toast('Message sent', 'success'); }} onClose={() => setPublishTopic(null)} />
        </Modal>
      )}
    </div>
  );
}

function EditTopicForm({ topic, onSubmit, onClose }: {
  topic: Topic;
  onSubmit: (d: Record<string, any>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    description: topic.description || '',
    everyone_read: topic.everyone_read,
    everyone_write: topic.everyone_write,
    notify_policy: topic.notify_policy || 'always',
    notify_priority_min: topic.notify_priority_min ?? 0,
    notify_digest_interval: topic.notify_digest_interval ?? 60,
    store_policy: topic.store_policy || 'all',
    store_interval: topic.store_interval ?? 60,
    inbox_override: topic.inbox_override ?? null,
    inbox_priority_min: topic.inbox_priority_min ?? null,
  });
  const [showPolicies, setShowPolicies] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        description: form.description || undefined,
        everyone_read: form.everyone_read,
        everyone_write: form.everyone_write,
        notify_policy: form.notify_policy,
        notify_priority_min: form.notify_policy === 'threshold' ? form.notify_priority_min : undefined,
        notify_digest_interval: form.notify_policy === 'digest' ? form.notify_digest_interval : undefined,
        store_policy: form.store_policy,
        store_interval: form.store_policy === 'interval' ? form.store_interval : undefined,
        // '' explicitly clears the override (server treats null as keep-current)
        inbox_override: form.inbox_override || '',
        inbox_priority_min: form.inbox_override === 'threshold' ? (form.inbox_priority_min ?? 5) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-sm font-medium dark:text-gray-300 mb-1";
  const inputClass = "w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white";
  const radioClass = "flex items-center gap-2 text-sm dark:text-gray-300";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm">{error}</div>}
      <div>
        <label className={labelClass}>Name (read-only)</label>
        <input value={topic.name} disabled className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-400 bg-gray-50" />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm dark:text-gray-300">
        <input type="checkbox" checked={form.everyone_read} onChange={e => setForm(f => ({ ...f, everyone_read: e.target.checked }))} />
        Everyone can read
      </label>
      <label className="flex items-center gap-2 text-sm dark:text-gray-300">
        <input type="checkbox" checked={form.everyone_write} onChange={e => setForm(f => ({ ...f, everyone_write: e.target.checked }))} />
        Everyone can write
      </label>

      <button type="button" onClick={() => setShowPolicies(!showPolicies)} className="text-sm text-primary hover:text-brand-700">
        {showPolicies ? '\u25BE Hide' : '\u25B8 Show'} Notification & Storage Policies
      </button>

      {showPolicies && (
        <div className="space-y-4 border dark:border-gray-600 rounded p-3">
          <div>
            <label className={labelClass}>Notification Policy</label>
            <div className="space-y-1">
              {['always', 'never', 'threshold', 'on_change', 'digest'].map(p => (
                <label key={p} className={radioClass}>
                  <input type="radio" name="notify_policy" value={p} checked={form.notify_policy === p} onChange={() => setForm(f => ({ ...f, notify_policy: p }))} />
                  {p === 'always' ? 'Always notify' : p === 'never' ? 'Never notify' : p === 'threshold' ? 'Priority threshold' : p === 'on_change' ? 'On change only' : 'Digest'}
                </label>
              ))}
            </div>
            {form.notify_policy === 'threshold' && (
              <div className="mt-2">
                <label className={labelClass}>Minimum Priority</label>
                <input type="number" min={0} max={10} value={form.notify_priority_min} onChange={e => setForm(f => ({ ...f, notify_priority_min: parseInt(e.target.value) || 0 }))} className={inputClass} />
              </div>
            )}
            {form.notify_policy === 'digest' && (
              <div className="mt-2">
                <label className={labelClass}>Digest Interval (seconds)</label>
                <input type="number" min={1} value={form.notify_digest_interval} onChange={e => setForm(f => ({ ...f, notify_digest_interval: parseInt(e.target.value) || 60 }))} className={inputClass} />
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Storage Policy</label>
            <div className="space-y-1">
              {['all', 'on_change', 'interval'].map(p => (
                <label key={p} className={radioClass}>
                  <input type="radio" name="store_policy" value={p} checked={form.store_policy === p} onChange={() => setForm(f => ({ ...f, store_policy: p }))} />
                  {p === 'all' ? 'Store all messages' : p === 'on_change' ? 'Store on change only' : 'Store at interval'}
                </label>
              ))}
            </div>
            {form.store_policy === 'interval' && (
              <div className="mt-2">
                <label className={labelClass}>Store Interval (seconds)</label>
                <input type="number" min={1} value={form.store_interval} onChange={e => setForm(f => ({ ...f, store_interval: parseInt(e.target.value) || 60 }))} className={inputClass} />
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Inbox Routing</label>
            <select
              value={form.inbox_override || ''}
              onChange={e => setForm(f => ({ ...f, inbox_override: e.target.value || null }))}
              className={inputClass}
            >
              <option value="">Auto (server default)</option>
              <option value="always">Always — all messages go to inbox</option>
              <option value="never">Never — channel only</option>
              <option value="threshold">Custom threshold</option>
            </select>
          </div>
          {form.inbox_override === 'threshold' && (
            <div>
              <label className={labelClass}>Minimum Priority for Inbox</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.inbox_priority_min ?? 5}
                onChange={e => setForm(f => ({ ...f, inbox_priority_min: parseInt(e.target.value) || 5 }))}
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-pill hover:bg-brand-600 disabled:opacity-50 transition">Save</button>
      </div>
    </form>
  );
}

function PublishForm({ topicName, onSuccess, onClose }: { topicName: string; onSuccess: () => void; onClose: () => void }) {
  const publishAction = useAsyncAction<MessageResponse>();
  const [form, setForm] = useState({ title: '', message: '', priority: 5, tags: '', scheduled_for: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
    const result = await publishAction.execute(() =>
      api.publishToTopic(topicName, {
        title: form.title || undefined,
        message: form.message,
        priority: form.priority,
        tags: tags && tags.length > 0 ? tags : undefined,
        scheduled_for: form.scheduled_for || undefined,
      })
    );
    if (result !== undefined) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {publishAction.error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm">{publishAction.error}</div>}
      <input placeholder="Title (optional)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <textarea placeholder="Message" required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Priority</label>
          <input type="number" min={1} max={10} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 5 }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
          <input placeholder="tag1, tag2" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Schedule for (optional)</label>
        <input type="datetime-local" value={form.scheduled_for} onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value }))} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        <p className="text-xs text-gray-400 mt-1">Leave empty to send immediately</p>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={publishAction.loading} className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-pill hover:bg-brand-600 disabled:opacity-50 transition">{form.scheduled_for ? 'Schedule' : 'Send'}</button>
      </div>
    </form>
  );
}
