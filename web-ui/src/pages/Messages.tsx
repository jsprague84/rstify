import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { MessageResponse } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Messages() {
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [error, setError] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<MessageResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'app' | 'topic'>('all');

  const load = useCallback(() => {
    api.listMessages(200)
      .then(res => setMessages(res.messages))
      .catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!deleteMsg) return;
    await api.deleteMessage(deleteMsg.id);
    setDeleteMsg(null);
    load();
  };

  const filtered = messages.filter(m => {
    if (filter === 'app') return !!m.appid;
    if (filter === 'topic') return !!m.topic;
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Messages</h2>
        <div className="flex gap-1">
          {(['all', 'app', 'topic'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-md ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {f === 'all' ? 'All' : f === 'app' ? 'App' : 'Topic'}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No messages</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {m.title && <span className="font-semibold text-gray-900">{m.title}</span>}
                    <span className="text-xs text-gray-400">#{m.id}</span>
                    {m.topic && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{m.topic}</span>}
                    {m.appid && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">App #{m.appid}</span>}
                    <PriorityBadge priority={m.priority} />
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.message}</p>
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {m.tags.map(t => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{m.date}</p>
                </div>
                <button onClick={() => setDeleteMsg(m)} className="text-red-500 hover:text-red-700 text-sm ml-4">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteMsg}
        onClose={() => setDeleteMsg(null)}
        onConfirm={handleDelete}
        title="Delete Message"
        message="Delete this message?"
      />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const colors = priority >= 8
    ? 'bg-red-100 text-red-700'
    : priority >= 5
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-2 py-0.5 rounded ${colors}`}>P{priority}</span>;
}
