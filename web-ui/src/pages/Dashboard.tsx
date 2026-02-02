import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { StatsResponse } from '../api/types';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.is_admin) return;
    api.getStats().then(setStats).catch(e => setError(e.message));
  }, [user]);

  if (!user?.is_admin) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4 dark:text-white">Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400">Welcome, {user?.username}. Use the sidebar to manage your applications, clients, and topics.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Dashboard</h2>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Users" value={stats.users} />
          <StatCard label="Topics" value={stats.topics} />
          <StatCard label="Total Messages" value={stats.messages} />
          <StatCard label="Messages (24h)" value={stats.messages_last_24h} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
