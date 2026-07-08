import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Application, MessageResponse } from 'shared';
import { useMessageStream } from '../hooks/useMessageStream';
import { useAsyncAction } from '../hooks/useAsyncAction';
import ConfirmDialog from '../components/ConfirmDialog';
import MessageContent from '../components/MessageContent';
import { useToast } from '../components/Toast';
import { formatLocalTime, formatTimeAgo } from 'shared';

const PAGE_SIZE = 50;

function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^(https?:|mailto:)/i.test(url.trim()) ? url : undefined;
}

function getSourceId(m: MessageResponse): string {
  if (m.appid) return `app:${m.appid}`;
  if (m.topic) return `topic:${m.topic}`;
  return 'source:unknown';
}

/** Priority → restrained signal, surfaced only for high/critical. Color = meaning, not decoration. */
function priorityMeta(p: number): { label: string; chip: string; dot: string } | null {
  if (p >= 8) return { label: 'Critical', chip: 'text-error bg-error/10', dot: 'bg-error' };
  if (p >= 5) return { label: 'High', chip: 'text-warning bg-warning/10', dot: 'bg-warning' };
  return null;
}

function Avatar({ name, iconUrl, size = 40 }: { name: string; iconUrl?: string | null; size?: number }) {
  if (iconUrl) {
    return (
      <img src={iconUrl} alt={name}
        className="rounded-full object-cover flex-shrink-0 bg-slate-100 dark:bg-surface-elevated"
        style={{ width: size, height: size }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    );
  }
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-semibold bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-300"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name[0] || '?').toUpperCase()}
    </div>
  );
}

interface SourceMeta {
  sourceId: string; name: string; sourceType: 'app' | 'topic';
  iconUrl: string | null; latest: MessageResponse; count: number; priority: number;
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
    const iconUrl = m.icon_url || (isApp && appsMap.get(m.appid!)?.image ? api.getApplicationIconUrl(m.appid!) : null);
    map.set(sourceId, { sourceId, name, sourceType: isApp ? 'app' : 'topic', iconUrl, latest: m, count: 1, priority: m.priority });
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.latest.date).getTime() - new Date(a.latest.date).getTime());
}

function preview(m: MessageResponse): string {
  return (m.message || '').replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

export default function Messages() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [error, setError] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<MessageResponse | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  // True once the first inbox load has settled — the ?source= deep-link merge
  // must wait for it, or the initial load would overwrite the merged history.
  const [bootstrapped, setBootstrapped] = useState(false);
  const fetchLimit = useRef(PAGE_SIZE);
  const [apps, setApps] = useState<Application[]>([]);
  const appsMap = useMemo(() => {
    const m = new Map<number, Application>();
    for (const a of apps) m.set(a.id, a);
    return m;
  }, [apps]);

  const load = useCallback((limit: number, isCurrent: () => boolean = () => true) => {
    setLoading(true);
    api.listMessages(limit, 0, true)
      .then(res => {
        if (!isCurrent()) return;
        setMessages(res.messages);
        setHasMore(res.paging.size >= limit);
      })
      .catch(e => { if (isCurrent()) setError(e.message); })
      .finally(() => { setLoading(false); setBootstrapped(true); });
  }, []);

  useEffect(() => {
    load(PAGE_SIZE);
    api.listApplications().then(setApps).catch(e => console.error('Failed to load applications', e));
  }, [load]);

  const searchQueryRef = useRef('');
  searchQueryRef.current = searchQuery;
  const handleReconnect = useCallback(() => { if (!searchQueryRef.current.trim()) load(fetchLimit.current); }, [load]);

  const wsStatus = useMessageStream(
    useCallback((msg: MessageResponse) => {
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [msg, ...prev]));
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
    if (ok) { setMessages([]); setSelectedSourceId(null); }
    else toast('Failed to delete messages', 'error');
    setShowDeleteAll(false);
  };

  // Debounce keystrokes and drop out-of-order responses so a slow early
  // search can never overwrite the results of a later one (or of clearing).
  const searchSeq = useRef(0);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    clearTimeout(searchDebounce.current);
    const seq = ++searchSeq.current;
    if (!query.trim()) {
      load(fetchLimit.current, () => seq === searchSeq.current);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      const results = await searchAction.execute(() => api.searchMessages({ q: query, limit: 100 }));
      if (seq !== searchSeq.current) return;
      if (results) {
        setMessages(results);
        // If the open thread's source vanished from the results, close it
        // explicitly instead of leaving a silently-empty detail pane.
        setSelectedSourceId(prev =>
          prev && !results.some(m => getSourceId(m) === prev) ? null : prev,
        );
      } else {
        setError('Search failed');
      }
    }, 250);
  };
  useEffect(() => () => clearTimeout(searchDebounce.current), []);

  const handleLoadMore = () => { fetchLimit.current += PAGE_SIZE; load(fetchLimit.current); };
  const onAttachmentDeleted = (msgId: number, attId: number) =>
    setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, attachments: (msg.attachments || []).filter(a => a.id !== attId) } : msg));

  const sources = useMemo(() => groupBySource(messages, appsMap), [messages, appsMap]);
  const selectedSource = selectedSourceId ? sources.find(s => s.sourceId === selectedSourceId) : null;
  const threadMessages = useMemo(
    () => (selectedSourceId ? messages.filter(m => getSourceId(m) === selectedSourceId) : []),
    [messages, selectedSourceId],
  );

  // Deep link: /messages?source=app:5 or ?source=topic:builds opens that
  // thread. If the source isn't in the loaded inbox window (older messages,
  // or a channel-only topic), fetch its history once and merge it in.
  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get('source');
  const fetchedParam = useRef<string | null>(null);
  useEffect(() => {
    if (!sourceParam || !bootstrapped || loading) return;
    if (sources.some(s => s.sourceId === sourceParam)) {
      if (fetchedParam.current !== sourceParam) {
        fetchedParam.current = sourceParam;
        setSelectedSourceId(sourceParam);
      }
      return;
    }
    if (fetchedParam.current === sourceParam) return;
    fetchedParam.current = sourceParam;
    const history = sourceParam.startsWith('topic:')
      ? api.listTopicMessages(sourceParam.slice(6)).then(r => r.messages)
      : sourceParam.startsWith('app:')
        ? api.listApplicationMessages(Number(sourceParam.slice(4))).then(r => r.messages)
        : Promise.resolve([] as MessageResponse[]);
    history
      .then(msgs => {
        if (msgs.length) {
          setMessages(prev => {
            const seen = new Set(prev.map(m => m.id));
            return [...prev, ...msgs.filter(m => !seen.has(m.id))];
          });
        }
        setSelectedSourceId(sourceParam);
      })
      .catch(() => setSelectedSourceId(sourceParam));
  }, [sourceParam, bootstrapped, loading, sources]);

  // On desktop, open the most-recent source by default so the detail pane isn't empty.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (!didAutoSelect.current && !sourceParam && sources.length &&
        typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      didAutoSelect.current = true;
      setSelectedSourceId(sources[0].sourceId);
    }
  }, [sources, sourceParam]);

  const searching = searchAction.loading;

  return (
    <div className="h-full flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-surface-card">
      <div className="flex flex-1 min-h-0">
        {/* ── List pane ── */}
        <aside className={`w-full md:w-[380px] md:flex-shrink-0 flex-col min-h-0 md:border-r border-slate-200 dark:border-white/10 ${selectedSource ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-5 pt-5 pb-4 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Inbox</h1>
                <ConnectionDot status={wsStatus} />
              </div>
              {messages.length > 0 && (
                <button onClick={() => setShowDeleteAll(true)} className="text-sm text-slate-400 hover:text-error transition">Clear</button>
              )}
            </div>
            <div className="relative">
              <svg className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                className="w-full rounded-pill border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-elevated pl-10 pr-4 py-2.5 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white dark:focus:bg-surface-card transition" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {error && <div className="m-4 bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm">{error}</div>}
            {searching ? (
              <p className="text-slate-400 text-center py-16 text-sm">Searching…</p>
            ) : sources.length === 0 && !loading ? (
              searchQuery.trim() ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No results for “{searchQuery.trim()}”</p>
                  <p className="text-sm text-slate-400 mt-1">Try a different search term.</p>
                </div>
              ) : (
                <div className="px-6 py-16 text-center">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No messages yet</p>
                  <p className="text-sm text-slate-400 mt-1">Messages from your apps and topics appear here.</p>
                </div>
              )
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {sources.map(s => (
                  <SourceRow key={s.sourceId} source={s} active={s.sourceId === selectedSourceId} onOpen={() => setSelectedSourceId(s.sourceId)} />
                ))}
                {hasMore && (
                  <div className="p-4 text-center">
                    <button onClick={handleLoadMore} disabled={loading} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition">
                      {loading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Detail pane ── */}
        <section className={`flex-1 flex-col min-h-0 ${selectedSource ? 'flex' : 'hidden md:flex'}`}>
          {selectedSource ? (
            <>
              <div className="px-6 h-[73px] flex-shrink-0 flex items-center gap-3 border-b border-slate-200 dark:border-white/10">
                <button onClick={() => setSelectedSourceId(null)} className="md:hidden -ml-1 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-elevated transition" aria-label="Back">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <Avatar name={selectedSource.name} iconUrl={selectedSource.iconUrl} size={40} />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate leading-tight">{selectedSource.name}</h2>
                  <p className="text-caption text-slate-400">{selectedSource.sourceType === 'app' ? 'Application' : 'Topic'} · {threadMessages.length} messages</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {threadMessages.map(m => (
                    <ThreadMessage key={m.id} m={m} onDelete={setDeleteMsg} onAttachmentDeleted={onAttachmentDeleted} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-surface-elevated flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Select a source to read its messages</p>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog open={!!deleteMsg} onClose={() => setDeleteMsg(null)} onConfirm={handleDelete} title="Delete Message" message="Delete this message?" />
      <ConfirmDialog open={showDeleteAll} onClose={() => setShowDeleteAll(false)} onConfirm={handleDeleteAll} title="Delete All Messages" message="Are you sure you want to delete ALL messages? This cannot be undone." />
    </div>
  );
}

function ConnectionDot({ status }: { status: string }) {
  const color = status === 'connected' ? 'bg-success' : status === 'reconnecting' ? 'bg-warning' : 'bg-slate-300';
  return (
    <span className="flex items-center gap-1.5 text-caption text-slate-400" title={status}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
    </span>
  );
}

function SourceRow({ source, active, onOpen }: { source: SourceMeta; active: boolean; onOpen: () => void }) {
  const pm = priorityMeta(source.priority);
  return (
    <button onClick={onOpen}
      className={`w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors ${active ? 'bg-primary/[0.06] dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
      <Avatar name={source.name} iconUrl={source.iconUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {pm && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm.dot}`} />}
          <span className={`font-semibold text-[15px] truncate ${active ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{source.name}</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {source.latest.title ? <span className="text-slate-600 dark:text-slate-300">{source.latest.title}</span> : null}
          {source.latest.title ? '  ·  ' : ''}{preview(source.latest)}
        </p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 self-start pt-0.5">
        <span className="text-caption text-slate-400 tabular-nums whitespace-nowrap">{formatTimeAgo(source.latest.date)}</span>
        <span className="text-caption font-mono text-slate-400 mt-1.5">{source.count}</span>
      </div>
    </button>
  );
}

function ThreadMessage({
  m, onDelete, onAttachmentDeleted,
}: { m: MessageResponse; onDelete: (m: MessageResponse) => void; onAttachmentDeleted: (msgId: number, attId: number) => void }) {
  const pm = priorityMeta(m.priority);
  return (
    <article className="group py-6 first:pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {(m.title || pm) && (
            <div className="flex items-center flex-wrap gap-2 mb-2">
              {m.title && (
                safeHref(m.click_url) ? (
                  <a href={safeHref(m.click_url)} target="_blank" rel="noopener noreferrer" className="font-bold text-base text-slate-900 dark:text-white hover:text-primary inline-flex items-center gap-1">
                    {m.title}
                    <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                ) : (
                  <span className="font-bold text-base text-slate-900 dark:text-white">{m.title}</span>
                )
              )}
              {pm && <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${pm.chip}`}>{pm.label}</span>}
            </div>
          )}
          <div className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            <MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
          </div>
          {m.tags && m.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {m.tags.map(t => <span key={t} className="text-caption bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md">{t}</span>)}
            </div>
          )}
          <MessageAttachments message={m} onDeleted={(attId) => onAttachmentDeleted(m.id, attId)} />
          <MessageActions message={m} />
          <p className="text-caption text-slate-400 mt-3">{formatLocalTime(m.date)}</p>
        </div>
        <button onClick={() => onDelete(m)} className="flex-shrink-0 text-slate-300 hover:text-error opacity-0 group-hover:opacity-100 focus:opacity-100 transition" aria-label="Delete message">
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </article>
  );
}

function isImageType(type?: string | null): boolean { return !!type && type.startsWith('image/'); }
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAttachments({ message, onDeleted }: { message: MessageResponse; onDeleted: (attId: number) => void }) {
  const { toast } = useToast();
  const handleDeleteAttachment = async (attId: number) => {
    try { await api.deleteAttachment(attId); onDeleted(attId); toast('Attachment deleted', 'success'); }
    catch (err) { toast(err instanceof Error ? err.message : 'Delete failed', 'error'); }
  };
  const attachments = message.attachments || [];
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {attachments.map(att => (
        <div key={att.id} className="flex items-start gap-2">
          {isImageType(att.type) ? (
            <a href={att.url} target="_blank" rel="noopener noreferrer">
              <img src={att.url} alt={att.name} className="max-w-xs max-h-48 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer hover:opacity-90" />
            </a>
          ) : (
            <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline bg-slate-50 dark:bg-surface-elevated px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
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
      if (action.url) window.open(action.url, '_blank', 'noopener,noreferrer');
      setExecuting(null);
    } else if (action.type === 'http' || action.action === 'http') {
      const response = await actionRunner.execute(() => api.executeMessageAction({ url: action.url, method: action.method, headers: action.headers, body: action.body }));
      if (response) toast(response.ok ? 'Action executed successfully' : `Action failed: ${response.statusText}`, response.ok ? 'success' : 'error');
      else toast('Action failed: network error', 'error');
      setExecuting(null);
    } else if (action.type === 'broadcast' || action.action === 'broadcast') {
      toast('Broadcast actions are only supported on Android devices', 'info'); setExecuting(null);
    } else { setExecuting(null); }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action: any, index: number) => (
        <button key={index} onClick={() => handleAction(action, index)} disabled={executing === `${message.id}-${index}`}
          className="text-sm font-medium px-4 py-1.5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-pill hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition">
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
