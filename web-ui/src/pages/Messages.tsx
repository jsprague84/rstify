import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { MessageResponse } from '../api/types';
import { useMessageStream } from '../hooks/useMessageStream';
import ConfirmDialog from '../components/ConfirmDialog';

const PAGE_SIZE = 50;

export default function Messages() {
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [error, setError] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<MessageResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'app' | 'topic'>('all');
  const [liveCount, setLiveCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const fetchLimit = useRef(PAGE_SIZE);

  const load = useCallback((limit: number) => {
    setLoading(true);
    api.listMessages(limit)
      .then(res => {
        setMessages(res.messages);
        setHasMore(res.paging.size >= limit);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(PAGE_SIZE);
  }, [load]);

  // Real-time: prepend new messages from WebSocket
  useMessageStream(useCallback((msg: MessageResponse) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [msg, ...prev];
    });
    setLiveCount(c => c + 1);
  }, []));

  // Reset live count when filter changes
  useEffect(() => setLiveCount(0), [filter]);

  const handleDelete = async () => {
    if (!deleteMsg) return;
    await api.deleteMessage(deleteMsg.id);
    setDeleteMsg(null);
    setMessages(prev => prev.filter(m => m.id !== deleteMsg.id));
  };

  const handleLoadMore = () => {
    fetchLimit.current += PAGE_SIZE;
    load(fetchLimit.current);
  };

  const filtered = messages.filter(m => {
    if (filter === 'app') return !!m.appid;
    if (filter === 'topic') return !!m.topic;
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold dark:text-white">Messages</h2>
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </span>
          {liveCount > 0 && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
              +{liveCount} new
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['all', 'app', 'topic'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-md ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {f === 'all' ? 'All' : f === 'app' ? 'App' : 'Topic'}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      {filtered.length === 0 && !loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No messages</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {m.title && <span className="font-semibold text-gray-900 dark:text-white">{m.title}</span>}
                    <span className="text-xs text-gray-400">#{m.id}</span>
                    {m.topic && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">{m.topic}</span>}
                    {m.appid && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">App #{m.appid}</span>}
                    <PriorityBadge priority={m.priority} />
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{m.message}</p>
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {m.tags.map(t => (
                        <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{m.date}</p>
                </div>
                <button onClick={() => setDeleteMsg(m)} className="text-red-500 hover:text-red-700 text-sm ml-4">Delete</button>
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
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
    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    : priority >= 5
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  return <span className={`text-xs px-2 py-0.5 rounded ${colors}`}>P{priority}</span>;
}
