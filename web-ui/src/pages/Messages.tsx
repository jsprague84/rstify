import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../api/client';
import type { Application, MessageResponse } from 'shared';
import { useMessageStream } from '../hooks/useMessageStream';
import { useAsyncAction } from '../hooks/useAsyncAction';
import ConfirmDialog from '../components/ConfirmDialog';
import MessageContent from '../components/MessageContent';
import { useToast } from '../components/Toast';
import PriorityBadge from '../components/PriorityBadge';
import { formatLocalTime, formatTimeAgo } from 'shared';

const PAGE_SIZE = 50;

/** Defense in depth: only render http(s)/mailto links; drop javascript:/data: URLs. */
function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^(https?:|mailto:)/i.test(url.trim()) ? url : undefined;
}

/** Stable per-message source key — mirrors the mobile app's grouping. */
function getSourceId(m: MessageResponse): string {
  if (m.appid) return `app:${m.appid}`;
  if (m.topic) return `topic:${m.topic}`;
  return 'source:unknown';
}

/** Left accent bar by priority (critical → red, high → amber, else brand blue). */
function priorityAccent(p: number): string {
  if (p >= 8) return 'border-l-error';
  if (p >= 5) return 'border-l-warning';
  return 'border-l-primary';
}

const AVATAR_COLORS = [
  'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
];
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function Avatar({ name, iconUrl, size = 44 }: { name: string; iconUrl?: string | null; size?: number }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className="rounded-xl object-contain flex-shrink-0 bg-slate-100 dark:bg-surface-elevated"
        style={{ width: size, height: size }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  const color = AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
  return (
    <div
      className={`rounded-xl flex-shrink-0 flex items-center justify-center font-bold ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name[0] || '?').toUpperCase()}
    </div>
  );
}

interface SourceMeta {
  sourceId: string;
  name: string;
  sourceType: 'app' | 'topic';
  iconUrl: string | null;
  latest: MessageResponse;
  count: number;
  priority: number;
}

function groupBySource(messages: MessageResponse[], appsMap: Map<number, Application>): SourceMeta[] {
  const map = new Map<string, SourceMeta>();
  for (const m of messages) {
    const sourceId = getSourceId(m);
    const existing = map.get(sourceId);
    if (existing) {
      existing.count += 1;
      existing.priority = Math.max(existing.priority, m.priority);
      if (new Date(m.date).getTime() > new Date(existing.latest.date).getTime()) existing.latest = m;
      continue;
    }
    const isApp = !!m.appid;
    const name = isApp ? appsMap.get(m.appid!)?.name || `App #${m.appid}` : m.topic || 'Unknown';
    const iconUrl =
      m.icon_url || (isApp && appsMap.get(m.appid!)?.image ? api.getApplicationIconUrl(m.appid!) : null);
    map.set(sourceId, {
      sourceId,
      name,
      sourceType: isApp ? 'app' : 'topic',
      iconUrl,
      latest: m,
      count: 1,
      priority: m.priority,
    });
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest.date).getTime() - new Date(a.latest.date).getTime(),
  );
}

/** One-line plain preview of a message body (strip markdown noise). */
function preview(m: MessageResponse): string {
  return (m.message || '')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export default function Messages() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [error, setError] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<MessageResponse | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'stream'>('grouped');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const fetchLimit = useRef(PAGE_SIZE);
  const [apps, setApps] = useState<Application[]>([]);
  const appsMap = useMemo(() => {
    const m = new Map<number, Application>();
    for (const a of apps) m.set(a.id, a);
    return m;
  }, [apps]);

  const load = useCallback((limit: number) => {
    setLoading(true);
    api.listMessages(limit, 0, true)
      .then(res => {
        setMessages(res.messages);
        setHasMore(res.paging.size >= limit);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(PAGE_SIZE);
    api.listApplications().then(setApps).catch(e => console.error('Failed to load applications', e));
  }, [load]);

  const searchQueryRef = useRef('');
  searchQueryRef.current = searchQuery;

  const handleReconnect = useCallback(() => {
    if (!searchQueryRef.current.trim()) load(fetchLimit.current);
  }, [load]);

  const wsStatus = useMessageStream(
    useCallback((msg: MessageResponse) => {
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [msg, ...prev]));
      setLiveCount(c => c + 1);
    }, []),
    handleReconnect,
  );

  const deleteAction = useAsyncAction<true>();
  const deleteAllAction = useAsyncAction<true>();
  const searchAction = useAsyncAction<MessageResponse[]>();

  const handleDelete = async () => {
    if (!deleteMsg) return;
    const msgToDelete = deleteMsg;
    const ok = await deleteAction.execute(async () => { await api.deleteMessage(msgToDelete.id); return true as const; });
    if (ok) setMessages(prev => prev.filter(m => m.id !== msgToDelete.id));
    else toast('Failed to delete message', 'error');
    setDeleteMsg(null);
  };

  const handleDeleteAll = async () => {
    const ok = await deleteAllAction.execute(async () => { await api.deleteAllMessages(); return true as const; });
    if (ok) { setMessages([]); setLiveCount(0); setSelectedSourceId(null); }
    else toast('Failed to delete messages', 'error');
    setShowDeleteAll(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSelectedSourceId(null);
    if (!query.trim()) { load(fetchLimit.current); return; }
    const results = await searchAction.execute(() => api.searchMessages({ q: query, limit: 100 }));
    if (results) setMessages(results);
    else setError('Search failed');
  };

  const handleLoadMore = () => {
    fetchLimit.current += PAGE_SIZE;
    load(fetchLimit.current);
  };

  const onAttachmentDeleted = (msgId: number, attId: number) =>
    setMessages(prev => prev.map(msg => msg.id === msgId
      ? { ...msg, attachments: (msg.attachments || []).filter(a => a.id !== attId) }
      : msg));

  const sources = useMemo(() => groupBySource(messages, appsMap), [messages, appsMap]);
  const selectedSource = selectedSourceId ? sources.find(s => s.sourceId === selectedSourceId) : null;
  const threadMessages = useMemo(
    () => (selectedSourceId ? messages.filter(m => getSourceId(m) === selectedSourceId) : []),
    [messages, selectedSourceId],
  );

  const searching = searchAction.loading;
  const inThread = !!selectedSource;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {inThread && (
            <button
              onClick={() => setSelectedSourceId(null)}
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-elevated transition"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {inThread ? (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={selectedSource!.name} iconUrl={selectedSource!.iconUrl} size={36} />
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{selectedSource!.name}</h2>
                <p className="text-caption text-slate-500 dark:text-slate-400">{threadMessages.length} messages</p>
              </div>
            </div>
          ) : (
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inbox</h2>
          )}
          <ConnectionDot status={wsStatus} />
          {!inThread && liveCount > 0 && (
            <span className="text-caption font-medium bg-success/10 text-success px-2 py-0.5 rounded-pill">
              +{liveCount} new
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setShowDeleteAll(true)}
            className="text-sm text-slate-400 hover:text-error transition flex-shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      {!inThread && (
        <>
          {/* Segmented control */}
          <div className="inline-flex rounded-pill bg-slate-100 dark:bg-surface-elevated p-1 mb-4">
            {(['grouped', 'stream'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-5 py-1.5 text-sm font-semibold rounded-pill transition ${
                  viewMode === v
                    ? 'bg-white dark:bg-surface-card text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {v === 'grouped' ? 'Grouped' : 'Stream'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="w-full rounded-field border border-slate-200 dark:border-surface-elevated bg-white dark:bg-surface-card pl-11 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            />
          </div>
        </>
      )}

      {error && (
        <div className="bg-error/10 text-error px-4 py-2.5 rounded-field text-sm mb-4">{error}</div>
      )}

      {/* Content */}
      {inThread ? (
        <div className="space-y-3">
          {threadMessages.map(m => (
            <MessageCard key={m.id} m={m} appsMap={appsMap} onDelete={setDeleteMsg} onAttachmentDeleted={onAttachmentDeleted} />
          ))}
        </div>
      ) : searching ? (
        <p className="text-slate-400 text-center py-12">Searching…</p>
      ) : sources.length === 0 && !loading ? (
        <EmptyState />
      ) : viewMode === 'grouped' ? (
        <div className="space-y-2.5">
          {sources.map(s => (
            <SourceCard key={s.sourceId} source={s} onOpen={() => setSelectedSourceId(s.sourceId)} />
          ))}
          {hasMore && <LoadMore loading={loading} onClick={handleLoadMore} />}
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <MessageCard key={m.id} m={m} appsMap={appsMap} onDelete={setDeleteMsg} onAttachmentDeleted={onAttachmentDeleted} />
          ))}
          {hasMore && <LoadMore loading={loading} onClick={handleLoadMore} />}
        </div>
      )}

      <ConfirmDialog open={!!deleteMsg} onClose={() => setDeleteMsg(null)} onConfirm={handleDelete} title="Delete Message" message="Delete this message?" />
      <ConfirmDialog open={showDeleteAll} onClose={() => setShowDeleteAll(false)} onConfirm={handleDeleteAll} title="Delete All Messages" message="Are you sure you want to delete ALL messages? This cannot be undone." />
    </div>
  );
}

function ConnectionDot({ status }: { status: string }) {
  const color = status === 'connected' ? 'text-success' : status === 'reconnecting' ? 'text-warning' : 'text-error';
  const dot = status === 'connected' ? 'bg-success' : status === 'reconnecting' ? 'bg-warning' : 'bg-error';
  const label = status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting…' : 'Offline';
  return (
    <span className={`flex items-center gap-1.5 text-caption font-medium ${color}`}>
      <span className="relative flex h-2 w-2">
        {status === 'connected' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`} />
      </span>
      {label}
    </span>
  );
}

function SourceCard({ source, onOpen }: { source: SourceMeta; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left flex items-center gap-3.5 bg-white dark:bg-surface-card rounded-card border-l-4 ${priorityAccent(source.priority)} p-3.5 shadow-sm hover:shadow-md hover:-translate-y-px transition-all`}
    >
      <Avatar name={source.name} iconUrl={source.iconUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-900 dark:text-white truncate">{source.name}</span>
          <span className="text-caption text-slate-400 flex-shrink-0">{formatTimeAgo(source.latest.date)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {source.latest.title ? <span className="font-medium text-slate-600 dark:text-slate-300">{source.latest.title} · </span> : null}
            {preview(source.latest)}
          </span>
          <span className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-pill bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 text-caption font-bold flex items-center justify-center">
            {source.count}
          </span>
        </div>
      </div>
    </button>
  );
}

function MessageCard({
  m, appsMap, onDelete, onAttachmentDeleted,
}: {
  m: MessageResponse;
  appsMap: Map<number, Application>;
  onDelete: (m: MessageResponse) => void;
  onAttachmentDeleted: (msgId: number, attId: number) => void;
}) {
  const appName = m.appid ? appsMap.get(m.appid)?.name : undefined;
  return (
    <div className={`group bg-white dark:bg-surface-card rounded-card border-l-4 ${priorityAccent(m.priority)} shadow-sm p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            {m.title && (
              safeHref(m.click_url) ? (
                <a href={safeHref(m.click_url)} target="_blank" rel="noopener noreferrer"
                   className="font-semibold text-slate-900 dark:text-white hover:text-primary flex items-center gap-1">
                  {m.title}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <span className="font-semibold text-slate-900 dark:text-white">{m.title}</span>
              )
            )}
            {m.topic && <span className="text-caption font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-pill">{m.topic}</span>}
            {appName && <span className="text-caption font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-pill">{appName}</span>}
            <PriorityBadge priority={m.priority} />
          </div>
          <div className="text-slate-700 dark:text-slate-300 text-sm">
            <MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
          </div>
          {m.tags && m.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {m.tags.map(t => (
                <span key={t} className="text-caption bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-pill">{t}</span>
              ))}
            </div>
          )}
          <MessageAttachments message={m} onDeleted={(attId) => onAttachmentDeleted(m.id, attId)} />
          <MessageActions message={m} />
          <p className="text-caption text-slate-400 mt-2.5">{formatLocalTime(m.date)}</p>
        </div>
        <button
          onClick={() => onDelete(m)}
          className="flex-shrink-0 text-slate-300 hover:text-error opacity-0 group-hover:opacity-100 transition"
          aria-label="Delete message"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function LoadMore({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="text-center pt-2 pb-4">
      <button
        onClick={onClick}
        disabled={loading}
        className="px-5 py-2 text-sm font-medium bg-white dark:bg-surface-card text-slate-600 dark:text-slate-300 rounded-pill shadow-sm hover:shadow-md disabled:opacity-50 transition"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-surface-elevated flex items-center justify-center mx-auto mb-3">
        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-slate-500 dark:text-slate-400 font-medium">No messages yet</p>
      <p className="text-sm text-slate-400 mt-1">Messages from your apps and topics will appear here.</p>
    </div>
  );
}

function isImageType(type?: string | null): boolean {
  return !!type && type.startsWith('image/');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAttachments({ message, onDeleted }: { message: MessageResponse; onDeleted: (attId: number) => void }) {
  const { toast } = useToast();

  const handleDeleteAttachment = async (attId: number) => {
    try {
      await api.deleteAttachment(attId);
      onDeleted(attId);
      toast('Attachment deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const attachments = message.attachments || [];
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-2">
      {attachments.map(att => (
        <div key={att.id} className="flex items-start gap-2">
          {isImageType(att.type) ? (
            <a href={att.url} target="_blank" rel="noopener noreferrer">
              <img src={att.url} alt={att.name} className="max-w-xs max-h-48 rounded-field border border-slate-200 dark:border-surface-elevated cursor-pointer hover:opacity-90" />
            </a>
          ) : (
            <a href={att.url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 text-sm text-primary hover:underline bg-slate-50 dark:bg-surface-elevated px-3 py-1.5 rounded-field">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {att.name} <span className="text-slate-400 text-caption">({formatFileSize(att.size)})</span>
            </a>
          )}
          <button onClick={() => handleDeleteAttachment(att.id)} className="text-slate-300 hover:text-error text-xs mt-1">✕</button>
        </div>
      ))}
    </div>
  );
}

function MessageActions({ message }: { message: MessageResponse }) {
  const { toast } = useToast();
  const [executing, setExecuting] = useState<string | null>(null);
  const actionRunner = useAsyncAction<Response>();

  const actions = getMessageActions(message);
  if (!actions || actions.length === 0) return null;

  const handleAction = async (action: any, index: number) => {
    setExecuting(`${message.id}-${index}`);
    if (action.type === 'view' || action.action === 'view') {
      const url = action.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      setExecuting(null);
    } else if (action.type === 'http' || action.action === 'http') {
      const response = await actionRunner.execute(() =>
        api.executeMessageAction({ url: action.url, method: action.method, headers: action.headers, body: action.body }));
      if (response) toast(response.ok ? 'Action executed successfully' : `Action failed: ${response.statusText}`, response.ok ? 'success' : 'error');
      else toast('Action failed: network error', 'error');
      setExecuting(null);
    } else if (action.type === 'broadcast' || action.action === 'broadcast') {
      toast('Broadcast actions are only supported on Android devices', 'info');
      setExecuting(null);
    } else {
      setExecuting(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {actions.map((action: any, index: number) => (
        <button
          key={index}
          onClick={() => handleAction(action, index)}
          disabled={executing === `${message.id}-${index}`}
          className="text-caption font-medium px-3 py-1.5 bg-primary hover:bg-brand-700 text-white rounded-pill disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {executing === `${message.id}-${index}` ? 'Loading…' : (action.label || action.name || 'Action')}
        </button>
      ))}
    </div>
  );
}

function getMessageActions(message: MessageResponse): any[] | null {
  if (message.actions && message.actions.length > 0) return message.actions;
  const extras = message.extras;
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return null;
  const ex = extras as Record<string, any>;
  if (ex['android::action']?.actions) return ex['android::action'].actions;
  if (Array.isArray(ex.actions)) return ex.actions;
  return null;
}
