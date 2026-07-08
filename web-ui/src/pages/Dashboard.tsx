import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { StatsResponse, HealthResponse, VersionResponse } from 'shared';
import { useAuth } from '../hooks/useAuth';
import { useAsyncAction } from '../hooks/useAsyncAction';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [version, setVersion] = useState<VersionResponse | null>(null);
  const statsAction = useAsyncAction<StatsResponse>();
  const healthAction = useAsyncAction<HealthResponse>();
  const versionAction = useAsyncAction<VersionResponse>();

  useEffect(() => {
    healthAction.execute(() => api.getHealth()).then(r => r && setHealth(r));
    versionAction.execute(() => api.getVersion()).then(r => r && setVersion(r));
    if (user?.is_admin) statsAction.execute(() => api.getStats()).then(r => r && setStats(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isEmptyInstance = user?.is_admin && stats != null && stats.messages === 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back, {user?.username}.</p>
      </div>

      {statsAction.error && (
        <div className="bg-error/10 text-error px-4 py-2.5 rounded-xl text-sm mb-5">{statsAction.error}</div>
      )}
      {healthAction.error && (
        <div className="bg-warning/10 text-warning px-4 py-2.5 rounded-xl text-sm mb-5">
          Could not reach the server health endpoint: {healthAction.error}
        </div>
      )}

      {isEmptyInstance && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 mb-5">
          <p className="font-semibold text-slate-900 dark:text-white">Get your first notification flowing</p>
          <ol className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400 list-decimal list-inside">
            <li><Link to="/applications" className="text-primary hover:underline font-medium">Create an application</Link> — it gets a token your scripts use to push messages.</li>
            <li>Send one: <code className="bg-slate-100 dark:bg-surface-elevated px-1.5 py-0.5 rounded text-xs">curl "{window.location.origin}/message?token=&lt;apptoken&gt;" -F "title=Hi" -F "message=It works"</code></li>
            <li>Watch it arrive in <Link to="/messages" className="text-primary hover:underline font-medium">Messages</Link> — or hook up <Link to="/webhooks" className="text-primary hover:underline font-medium">a webhook</Link>.</li>
          </ol>
        </div>
      )}

      {user?.is_admin && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard label="Users" value={stats.users} icon={<IconUsers />} to="/users" />
          <StatCard label="Topics" value={stats.topics} icon={<IconHash />} to="/topics" />
          <StatCard label="Total messages" value={stats.messages} icon={<IconInbox />} to="/messages" />
          <StatCard label="Messages · 24h" value={stats.messages_last_24h} icon={<IconBolt />} to="/messages" />
        </div>
      )}

      {health && <ServerCard health={health} version={version} />}

      {!user?.is_admin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <QuickLink to="/messages" title="Inbox" subtitle="Read your messages" icon={<IconInbox />} />
          <QuickLink to="/applications" title="Applications" subtitle="Tokens for sending" icon={<IconBolt />} />
          <QuickLink to="/topics" title="Topics" subtitle="Subscribe & publish" icon={<IconHash />} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, to }: { label: string; value: number; icon: ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-card p-5 hover:border-primary/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition group"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition">{label}</p>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-surface-elevated flex items-center justify-center text-slate-400">{icon}</div>
      </div>
      <p className="text-[32px] leading-none font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-4">
        {value.toLocaleString()}
      </p>
    </Link>
  );
}

function QuickLink({ to, title, subtitle, icon }: { to: string; title: string; subtitle: string; icon: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-card p-5 hover:border-primary/40 hover:shadow-sm transition"
    >
      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-surface-elevated flex items-center justify-center text-slate-400 flex-shrink-0">{icon}</div>
      <div>
        <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </Link>
  );
}

function ServerCard({ health, version }: { health: HealthResponse; version: VersionResponse | null }) {
  const isHealthy = health.health === 'green';
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-success' : 'bg-error'}`} />
          <span className="font-semibold text-slate-900 dark:text-white">
            {isHealthy ? 'All systems operational' : 'Service degraded'}
          </span>
        </div>
        {version && <span className="text-sm font-mono text-slate-400">v{version.version}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3 text-sm text-slate-500 dark:text-slate-400">
        <span>Database <span className="text-slate-700 dark:text-slate-300 font-medium">{health.database}</span></span>
        {version?.buildDate && <span>Built <span className="font-mono text-slate-600 dark:text-slate-300">{version.buildDate}</span></span>}
      </div>
    </div>
  );
}

const iconCls = 'w-[18px] h-[18px]';
function IconUsers() {
  return <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8z" /></svg>;
}
function IconHash() {
  return <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 20l2-16m6 16l2-16M4 9h16M3 15h16" /></svg>;
}
function IconInbox() {
  return <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}
function IconBolt() {
  return <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
}
