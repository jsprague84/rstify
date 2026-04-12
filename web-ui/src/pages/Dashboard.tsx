import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { StatsResponse, HealthResponse, VersionResponse, MqttStatusResponse } from 'shared';
import { useAuth } from '../hooks/useAuth';
import { useAsyncAction } from '../hooks/useAsyncAction';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [mqttStatus, setMqttStatus] = useState<MqttStatusResponse | null>(null);
  const statsAction = useAsyncAction<StatsResponse>();
  const healthAction = useAsyncAction<HealthResponse>();
  const versionAction = useAsyncAction<VersionResponse>();
  const mqttAction = useAsyncAction<MqttStatusResponse>();

  useEffect(() => {
    healthAction.execute(() => api.getHealth()).then(r => r && setHealth(r));
    versionAction.execute(() => api.getVersion()).then(r => r && setVersion(r));
    mqttAction.execute(() => api.getMqttStatus()).then(r => r && setMqttStatus(r));
    if (user?.is_admin) {
      statsAction.execute(() => api.getStats()).then(r => r && setStats(r));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user?.is_admin) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4 dark:text-white">Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400">Welcome, {user?.username}. Use the sidebar to manage your applications, clients, and topics.</p>
        {health && <ServerInfo health={health} version={version} />}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Dashboard</h2>
      {statsAction.error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{statsAction.error}</div>}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Users" value={stats.users} />
          <StatCard label="Topics" value={stats.topics} />
          <StatCard label="Total Messages" value={stats.messages} />
          <StatCard label="Messages (24h)" value={stats.messages_last_24h} />
        </div>
      )}
      {health && <ServerInfo health={health} version={version} />}
      {mqttStatus && <MqttStatusCard status={mqttStatus} />}
    </div>
  );
}

function MqttStatusCard({ status }: { status: MqttStatusResponse }) {
  if (!status.enabled) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">MQTT Broker</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">Disabled</span>
          </span>
          <span className="text-gray-400 dark:text-gray-500">Set MQTT_ENABLED=true to activate the integrated MQTT broker</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">MQTT Broker</h3>
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-700 dark:text-gray-300">Running</span>
        </span>
        {status.listen_addr && <span className="text-gray-500 dark:text-gray-400">{status.listen_addr}</span>}
        {status.ws_listen_addr && <span className="text-gray-500 dark:text-gray-400">WS: {status.ws_listen_addr}</span>}
        <span className="text-gray-500 dark:text-gray-400">{status.bridges_active} bridge{status.bridges_active !== 1 ? 's' : ''} active</span>
      </div>
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

function ServerInfo({ health, version }: { health: HealthResponse; version: VersionResponse | null }) {
  const isHealthy = health.health === 'green';
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Server</h3>
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-700 dark:text-gray-300">{isHealthy ? 'Healthy' : 'Degraded'}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">DB: {health.database}</span>
        {version && <span className="text-gray-500 dark:text-gray-400">v{version.version}</span>}
        {version?.buildDate && <span className="text-gray-500 dark:text-gray-400">Built: {version.buildDate}</span>}
      </div>
    </div>
  );
}
