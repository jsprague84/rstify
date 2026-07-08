import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { WebhookDeliveryLog } from 'shared';
import { formatLocalTime, formatTimeAgo } from 'shared';

function statusBadgeCls(code: number | null | undefined): string {
  if (!code) return 'bg-slate-100 text-slate-600 dark:bg-surface-elevated dark:text-slate-300';
  if (code < 300) return 'bg-success/10 text-success';
  if (code < 400) return 'bg-primary/10 text-primary';
  if (code < 500) return 'bg-warning/10 text-warning';
  return 'bg-error/10 text-error';
}

/**
 * Delivery history for one webhook. For outgoing webhooks, entries without a
 * message_id are manual test fires; for incoming, every received request is
 * logged (including rejections — those are the debugging gold).
 */
export default function DeliveryLog({ webhookId, direction }: { webhookId: number; direction: string }) {
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(async (reset: boolean, offset: number) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const successParam = filter === 'all' ? undefined : filter === 'success';
      const result = await api.listWebhookDeliveries(webhookId, 20, successParam, offset);
      setLogs(prev => (reset ? result : [...prev, ...result]));
      setHasMore(result.length === 20);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deliveries');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [webhookId, filter]);

  useEffect(() => { fetchLogs(true, 0); }, [fetchLogs]);

  if (loading) return <div className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Loading…</div>;
  if (error) return <div className="text-sm text-error py-2">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(['all', 'success', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-pill font-medium transition ${filter === f ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-surface-elevated text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}
          >
            {f === 'all' ? 'All' : f === 'success' ? 'Success' : 'Failed'}
          </button>
        ))}
      </div>
      {logs.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
          {filter !== 'all'
            ? 'No delivery attempts matching this filter.'
            : direction === 'incoming'
              ? 'Nothing received yet — every request to the webhook URL (accepted or rejected) will appear here.'
              : 'No deliveries yet — they appear here as soon as a message is published to the trigger topic.'}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/10">
                <th className="pb-1.5 pr-2 font-medium">Time</th>
                <th className="pb-1.5 pr-2 font-medium">Status</th>
                <th className="pb-1.5 pr-2 font-medium">Duration</th>
                <th className="pb-1.5 font-medium">{direction === 'incoming' ? 'Result' : 'Response'}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr
                  key={log.id}
                  className="border-b border-slate-100 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="py-2 pr-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    <span title={formatLocalTime(log.attempted_at)}>{formatTimeAgo(log.attempted_at)}</span>
                    {direction === 'outgoing' && !log.message_id && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 rounded text-[10px] font-semibold">TEST</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded-md font-semibold ${statusBadgeCls(log.status_code)}`}>
                      {log.status_code || 'ERR'}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-slate-600 dark:text-slate-300 tabular-nums">{log.duration_ms}ms</td>
                  <td className="py-2 text-slate-500 dark:text-slate-400">
                    {expandedId === log.id ? (
                      <pre className="whitespace-pre-wrap break-all max-h-40 overflow-auto bg-slate-50 dark:bg-surface-elevated rounded-lg p-2 font-mono">{log.response_body_preview || '—'}</pre>
                    ) : (
                      <span className="truncate block max-w-xs" title={log.response_body_preview || ''}>
                        {log.response_body_preview ? log.response_body_preview.slice(0, 80) : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="text-center py-2">
              <button onClick={() => fetchLogs(false, logs.length)} disabled={loadingMore} className="text-xs font-medium text-primary hover:text-brand-700 disabled:opacity-50 transition">
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
