import { useState } from 'react';
import type { CreateWebhookConfig, Topic, Application } from 'shared';
import { WEBHOOK_SERVICE_GUIDES, getWebhookGuide } from 'shared';
import { inputCls, labelCls, chipCls, primaryBtnCls, secondaryBtnCls } from './styles';

/**
 * Focused create form for incoming webhooks: pick the sending service, name
 * it, choose where messages land, optionally lock it down with a secret.
 */
export default function IncomingWebhookForm({ topics, apps, existingGroups, onSubmit, onBack, onClose }: {
  topics: Topic[];
  apps: Application[];
  existingGroups: string[];
  onSubmit: (d: CreateWebhookConfig) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('github');
  // 'topic:<id>' | 'app:<id>' — exactly one target is required (messages
  // belong to exactly one topic or application).
  const [target, setTarget] = useState(
    topics.length > 0 ? `topic:${topics[0].id}` : apps.length > 0 ? `app:${apps[0].id}` : '',
  );
  const [secret, setSecret] = useState('');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const guide = getWebhookGuide(type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!target) {
      setError('Pick where messages should land — create a topic (or an application) first if you have none.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name,
        webhookType: type,
        direction: 'incoming',
        targetTopicId: target.startsWith('topic:') ? Number(target.slice(6)) : null,
        targetApplicationId: target.startsWith('app:') ? Number(target.slice(4)) : null,
        targetUrl: null,
        httpMethod: null,
        headers: null,
        bodyTemplate: null,
        maxRetries: null,
        retryDelaySecs: null,
        timeoutSecs: null,
        followRedirects: null,
        enabled: null,
        template: null,
        groupName: groupName || null,
        secret: secret || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm">{error}</div>}

      <div>
        <label className={labelCls}>Which service will send to rstify?</label>
        <div className="flex gap-1.5 flex-wrap">
          {WEBHOOK_SERVICE_GUIDES.map(g => (
            <button key={g.type} type="button" onClick={() => setType(g.type)} className={chipCls(type === g.type)}>
              {g.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">{guide.blurb}</p>
        <p className="text-xs text-slate-400 mt-0.5"><span className="font-medium text-slate-500 dark:text-slate-300">Understands:</span> {guide.events}</p>
      </div>

      <div>
        <label className={labelCls}>Name</label>
        <input placeholder={`e.g. ${guide.label} — my-repo`} required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Deliver messages to</label>
        <select value={target} onChange={e => setTarget(e.target.value)} className={inputCls}>
          {!target && <option value="">Choose a topic or application…</option>}
          {topics.length > 0 && (
            <optgroup label="Topics (fan out to subscribers)">
              {topics.map(t => <option key={t.id} value={`topic:${t.id}`}>{t.name}</option>)}
            </optgroup>
          )}
          {apps.length > 0 && (
            <optgroup label="Applications (appear as that app)">
              {apps.map(a => <option key={a.id} value={`app:${a.id}`}>{a.name}</option>)}
            </optgroup>
          )}
        </select>
        {topics.length === 0 && apps.length === 0 ? (
          <p className="text-xs text-warning mt-1">You need a topic or application first — create a topic on the Topics page, then come back.</p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">Topic messages fan out to subscribers and respect the topic’s inbox policy; application messages always land in your inbox.</p>
        )}
      </div>

      <div>
        <label className={labelCls}>Secret (recommended)</label>
        <input
          type="password"
          placeholder="Shared HMAC secret"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          className={inputCls}
          autoComplete="new-password"
        />
        <p className="text-xs text-slate-400 mt-1">{guide.secretHelp} Without a secret, anyone who learns the URL can post to it.</p>
      </div>

      <div>
        <label className={labelCls}>Group (optional)</label>
        <input placeholder="e.g. Production, Monitoring" value={groupName} onChange={e => setGroupName(e.target.value)} className={inputCls} list="webhook-groups-in" />
        {existingGroups.length > 0 && (
          <datalist id="webhook-groups-in">{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition">← Back</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" disabled={loading} className={primaryBtnCls}>{loading ? 'Creating…' : 'Create webhook'}</button>
        </div>
      </div>
    </form>
  );
}
