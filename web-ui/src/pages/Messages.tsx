import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { MessageResponse, AttachmentInfo } from '../api/types';
import { useMessageStream } from '../hooks/useMessageStream';
import ConfirmDialog from '../components/ConfirmDialog';
import MessageContent from '../components/MessageContent';
import { useToast } from '../components/Toast';

const PAGE_SIZE = 50;

export default function Messages() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [error, setError] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<MessageResponse | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'app' | 'topic'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
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
  const wsStatus = useMessageStream(useCallback((msg: MessageResponse) => {
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

  const handleDeleteAll = async () => {
    await api.deleteAllMessages();
    setShowDeleteAll(false);
    setMessages([]);
    setLiveCount(0);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      load(fetchLimit.current);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchMessages({ q: query, limit: 100 });
      setMessages(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
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
          <span className={`flex items-center gap-1.5 text-xs ${
            wsStatus === 'connected' ? 'text-green-600' :
            wsStatus === 'reconnecting' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            <span className="relative flex h-2 w-2">
              {wsStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                wsStatus === 'connected' ? 'bg-green-500' :
                wsStatus === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></span>
            </span>
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
          </span>
          {liveCount > 0 && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
              +{liveCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
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
          {messages.length > 0 && (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              Delete All
            </button>
          )}
        </div>
      </div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      {filtered.length === 0 && !loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No messages</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-start gap-3">
                {m.icon_url && (
                  <img
                    src={m.icon_url}
                    alt="Message icon"
                    className="w-10 h-10 rounded flex-shrink-0 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {m.title && (
                      m.click_url ? (
                        <a
                          href={m.click_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                        >
                          {m.title}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-white">{m.title}</span>
                      )
                    )}
                    <span className="text-xs text-gray-400">#{m.id}</span>
                    {m.topic && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">{m.topic}</span>}
                    {m.appid && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">App #{m.appid}</span>}
                    <PriorityBadge priority={m.priority} />
                  </div>
                  <MessageContent message={m.message} extras={m.extras} />
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {m.tags.map(t => (
                        <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  <MessageAttachments message={m} onUploaded={(att) => {
                    setMessages(prev => prev.map(msg => msg.id === m.id
                      ? { ...msg, attachments: [...(msg.attachments || []), att] }
                      : msg
                    ));
                  }} onDeleted={(attId) => {
                    setMessages(prev => prev.map(msg => msg.id === m.id
                      ? { ...msg, attachments: (msg.attachments || []).filter(a => a.id !== attId) }
                      : msg
                    ));
                  }} />
                  <MessageActions message={m} />
                  <p className="text-xs text-gray-400 mt-2">
                    {m.date}
                    {m.source && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                        via {m.source}
                      </span>
                    )}
                  </p>
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
      <ConfirmDialog
        open={showDeleteAll}
        onClose={() => setShowDeleteAll(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Messages"
        message="Are you sure you want to delete ALL messages? This cannot be undone."
      />
    </div>
  );
}

function isImageType(type?: string): boolean {
  return !!type && type.startsWith('image/');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAttachments({ message, onUploaded, onDeleted }: { message: MessageResponse; onUploaded: (att: AttachmentInfo) => void; onDeleted: (attId: number) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleDeleteAttachment = async (attId: number) => {
    try {
      await api.deleteAttachment(attId);
      onDeleted(attId);
      toast('Attachment deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const att = await api.uploadAttachment(message.id, file);
      onUploaded(att);
      toast('Attachment uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const attachments = message.attachments || [];

  return (
    <div className="mt-2">
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-start gap-2">
              {isImageType(att.type) ? (
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-w-xs max-h-48 rounded border dark:border-gray-600 cursor-pointer hover:opacity-90"
                  />
                </a>
              ) : (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {att.name} <span className="text-gray-400 text-xs">({formatFileSize(att.size)})</span>
                </a>
              )}
              <button onClick={() => handleDeleteAttachment(att.id)} className="text-red-400 hover:text-red-600 text-xs mt-1">✕</button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="mt-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : '+ Attach file'}
      </button>
    </div>
  );
}

function MessageActions({ message }: { message: MessageResponse }) {
  const { toast } = useToast();
  const [executing, setExecuting] = useState<string | null>(null);

  if (!message.extras?.['android::action']?.actions && !parseActions(message.extras)) {
    return null;
  }

  const actions = parseActions(message.extras);
  if (!actions || actions.length === 0) return null;

  const handleAction = async (action: any, index: number) => {
    setExecuting(`${message.id}-${index}`);
    try {
      if (action.type === 'view' || action.action === 'view') {
        const url = action.url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } else if (action.type === 'http' || action.action === 'http') {
        const method = action.method || 'POST';
        const response = await fetch(action.url, {
          method,
          headers: action.headers || {},
          body: action.body,
        });
        if (response.ok) {
          toast('Action executed successfully', 'success');
        } else {
          toast(`Action failed: ${response.statusText}`, 'error');
        }
      } else if (action.type === 'broadcast' || action.action === 'broadcast') {
        toast('Broadcast actions are only supported on Android devices', 'info');
      }
    } catch (error) {
      console.error('Action failed:', error);
      toast(`Action failed: ${error}`, 'error');
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      {actions.map((action: any, index: number) => (
        <button
          key={index}
          onClick={() => handleAction(action, index)}
          disabled={executing === `${message.id}-${index}`}
          className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {executing === `${message.id}-${index}` ? 'Loading...' : (action.label || action.name || 'Action')}
        </button>
      ))}
    </div>
  );
}

function parseActions(extras?: Record<string, any>): any[] | null {
  if (!extras) return null;

  // Try android::action format (Gotify)
  if (extras['android::action']?.actions) {
    return extras['android::action'].actions;
  }

  // Try direct actions array (rstify format)
  if (Array.isArray(extras.actions)) {
    return extras.actions;
  }

  return null;
}

function PriorityBadge({ priority }: { priority: number }) {
  const colors = priority >= 8
    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    : priority >= 5
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  return <span className={`text-xs px-2 py-0.5 rounded ${colors}`}>P{priority}</span>;
}
