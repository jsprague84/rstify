import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Topic, CreateTopic, MessageResponse } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import MessageContent from '../components/MessageContent';
import { useToast } from '../components/Toast';
import { formatLocalTime } from '../utils/time';
import PriorityBadge from '../components/PriorityBadge';

export default function Topics() {
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);
  const [messagesTopic, setMessagesTopic] = useState<Topic | null>(null);
  const [topicMessages, setTopicMessages] = useState<MessageResponse[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [publishTopic, setPublishTopic] = useState<Topic | null>(null);
  const [showDeleteAllTopicMsgs, setShowDeleteAllTopicMsgs] = useState(false);

  const loadTopicMessages = (topic: Topic) => {
    setMessagesTopic(topic);
    setMessagesLoading(true);
    api.listTopicMessages(topic.name)
      .then(res => setTopicMessages(res.messages))
      .catch(e => setError(e.message))
      .finally(() => setMessagesLoading(false));
  };

  const load = useCallback(() => {
    api.listTopics().then(setTopics).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateTopic) => {
    try {
      await api.createTopic(data);
      setShowCreate(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create topic');
    }
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (!editTopic) return;
    try {
      await api.updateTopic(editTopic.name, data);
      setEditTopic(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update topic');
    }
  };

  const handleDelete = async () => {
    if (!deleteTopic) return;
    try {
      await api.deleteTopic(deleteTopic.name);
      setDeleteTopic(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete topic');
    }
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
          <div className="flex gap-2">
            <button onClick={() => loadTopicMessages(t)} className="text-blue-600 hover:text-blue-800 text-sm">Messages</button>
            <button onClick={() => setPublishTopic(t)} className="text-green-600 hover:text-green-800 text-sm">Send</button>
            <button onClick={() => setEditTopic(t)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteTopic(t)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Topic">
          <TopicForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      {editTopic && (
        <Modal open onClose={() => setEditTopic(null)} title={`Edit Topic: ${editTopic.name}`}>
          <EditTopicForm topic={editTopic} onSubmit={handleUpdate} onClose={() => setEditTopic(null)} />
        </Modal>
      )}
      <ConfirmDialog
        open={!!deleteTopic}
        onClose={() => setDeleteTopic(null)}
        onConfirm={handleDelete}
        title="Delete Topic"
        message={`Delete topic "${deleteTopic?.name}"? All associated messages will be deleted.`}
      />
      {messagesTopic && (
        <Modal open onClose={() => { setMessagesTopic(null); setTopicMessages([]); }} title={`Messages — ${messagesTopic.name}`}>
          <TopicMessagesView
            topic={messagesTopic}
            messages={topicMessages}
            loading={messagesLoading}
            onRequestDeleteAll={() => setShowDeleteAllTopicMsgs(true)}
          />
        </Modal>
      )}
      <ConfirmDialog
        open={showDeleteAllTopicMsgs}
        onClose={() => setShowDeleteAllTopicMsgs(false)}
        onConfirm={async () => {
          const ids = topicMessages.map(m => m.id).filter(id => id > 0);
          if (ids.length > 0) {
            try {
              await api.deleteBatchMessages(ids);
              setTopicMessages([]);
              toast('All messages deleted', 'success');
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Failed to delete messages', 'error');
            }
          }
          setShowDeleteAllTopicMsgs(false);
        }}
        title="Delete All Messages"
        message={`Delete all ${topicMessages.length} messages in this topic? This cannot be undone.`}
      />
      {publishTopic && (
        <Modal open onClose={() => setPublishTopic(null)} title={`Send to ${publishTopic.name}`}>
          <PublishForm topicName={publishTopic.name} onSuccess={() => { setPublishTopic(null); toast('Message sent', 'success'); }} onClose={() => setPublishTopic(null)} />
        </Modal>
      )}
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
  });
  const [showPolicies, setShowPolicies] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
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

      <button type="button" onClick={() => setShowPolicies(!showPolicies)} className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">
        {showPolicies ? '▾ Hide' : '▸ Show'} Notification & Storage Policies
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
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}

function TopicMessagesView({ topic, messages, loading, onRequestDeleteAll }: {
  topic: Topic;
  messages: MessageResponse[];
  loading: boolean;
  onRequestDeleteAll: () => void;
}) {
  const [mode, setMode] = useState<'history' | 'live'>('history');
  const [liveMessages, setLiveMessages] = useState<MessageResponse[]>([]);

  useEffect(() => {
    if (mode !== 'live') return;
    setLiveMessages([]);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('rstify_token');
    const wsUrl = `${protocol}//${window.location.host}/api/topics/${encodeURIComponent(topic.name)}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as MessageResponse;
        setLiveMessages(prev => [...prev.slice(-99), msg]);
      } catch {}
    };

    return () => ws.close();
  }, [mode, topic.name]);

  const renderMessage = (m: MessageResponse, idx: number) => (
    <div key={m.id || idx} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
      <div className="flex items-center gap-2 mb-1">
        {m.title && <span className="font-semibold text-gray-900 dark:text-white text-sm">{m.title}</span>}
        {m.id > 0 && <span className="text-xs text-gray-400">#{m.id}</span>}
        <PriorityBadge priority={m.priority} />
        {m.source && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">via {m.source}</span>}
      </div>
      <MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
      {m.tags && m.tags.length > 0 && (
        <div className="flex gap-1 mt-1">
          {m.tags.map(t => <span key={t} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{t}</span>)}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">{formatLocalTime(m.date)}</p>
    </div>
  );

  const displayMessages = mode === 'live' ? liveMessages : messages;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button onClick={() => setMode('history')} className={`px-3 py-1 text-sm rounded ${mode === 'history' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            History
          </button>
          <button onClick={() => setMode('live')} className={`px-3 py-1 text-sm rounded ${mode === 'live' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            Live
          </button>
          {mode === 'live' && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Connected
            </span>
          )}
        </div>
        {mode === 'history' && messages.length > 0 && (
          <button
            onClick={onRequestDeleteAll}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete All
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto space-y-3">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">Loading...</p>
        ) : displayMessages.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">{mode === 'live' ? 'Waiting for messages...' : 'No messages'}</p>
        ) : (
          displayMessages.map((m, i) => renderMessage(m, i))
        )}
      </div>
    </div>
  );
}

function PublishForm({ topicName, onSuccess, onClose }: { topicName: string; onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', message: '', priority: 5, tags: '', scheduled_for: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
      await api.publishToTopic(topicName, {
        title: form.title || undefined,
        message: form.message,
        priority: form.priority,
        tags: tags && tags.length > 0 ? tags : undefined,
        scheduled_for: form.scheduled_for || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
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
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{form.scheduled_for ? 'Schedule' : 'Send'}</button>
      </div>
    </form>
  );
}
