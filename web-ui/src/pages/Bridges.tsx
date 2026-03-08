import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { MqttBridge, MqttStatus, CreateMqttBridge, UpdateMqttBridge } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Bridges() {
  const [bridges, setBridges] = useState<MqttBridge[]>([]);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus | null>(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editBridge, setEditBridge] = useState<MqttBridge | null>(null);
  const [deleteBridge, setDeleteBridge] = useState<MqttBridge | null>(null);

  const load = useCallback(() => {
    api.listBridges().then(setBridges).catch(e => setError(e.message));
    api.getMqttStatus().then(setMqttStatus).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateMqttBridge) => {
    await api.createBridge(data);
    setShowCreate(false);
    load();
  };

  const handleUpdate = async (id: number, data: UpdateMqttBridge) => {
    await api.updateBridge(id, data);
    setEditBridge(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteBridge) return;
    await api.deleteBridge(deleteBridge.id);
    setDeleteBridge(null);
    load();
  };

  const parseTopics = (json: string | undefined): string[] => {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">MQTT Bridges</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          New Bridge
        </button>
      </div>
      {mqttStatus && (
        mqttStatus.enabled ? (
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-4 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-green-800 dark:text-green-300 font-medium">MQTT Broker Running</span>
            {mqttStatus.listen_addr && <span className="text-green-600 dark:text-green-400">{mqttStatus.listen_addr}</span>}
            {mqttStatus.ws_listen_addr && <span className="text-green-600 dark:text-green-400">WS: {mqttStatus.ws_listen_addr}</span>}
            <span className="text-green-600 dark:text-green-400">{mqttStatus.bridges_active} bridge{mqttStatus.bridges_active !== 1 ? 's' : ''} active</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-4 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-amber-800 dark:text-amber-300">MQTT Broker Disabled — set <code className="bg-amber-100 dark:bg-amber-800/40 px-1 rounded">MQTT_ENABLED=true</code> and restart the server to activate bridges</span>
          </div>
        )
      )}
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={bridges}
        keyField="id"
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'remote_url', header: 'Broker URL' },
          { key: 'enabled', header: 'Status', render: b => (
            <span className={`inline-flex items-center gap-1.5 text-xs ${b.enabled ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${b.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              {b.enabled ? 'Active' : 'Disabled'}
            </span>
          )},
          { key: 'subscribe_topics', header: 'Subscribe', render: b => (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {parseTopics(b.subscribe_topics).join(', ') || '—'}
            </span>
          )},
          { key: 'qos', header: 'QoS', render: b => `${b.qos ?? 0}` },
        ]}
        actions={b => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditBridge(b)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteBridge(b)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && (
        <BridgeFormModal
          title="New Bridge"
          onClose={() => setShowCreate(false)}
          onSubmit={data => handleCreate(data as CreateMqttBridge)}
        />
      )}
      {editBridge && (
        <BridgeFormModal
          title="Edit Bridge"
          bridge={editBridge}
          onClose={() => setEditBridge(null)}
          onSubmit={data => handleUpdate(editBridge.id, data as UpdateMqttBridge)}
        />
      )}
      {deleteBridge && (
        <ConfirmDialog
          open
          title="Delete Bridge"
          message={`Delete bridge "${deleteBridge.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteBridge(null)}
        />
      )}
    </div>
  );
}

function BridgeFormModal({
  title,
  bridge,
  onClose,
  onSubmit,
}: {
  title: string;
  bridge?: MqttBridge;
  onClose: () => void;
  onSubmit: (data: CreateMqttBridge | UpdateMqttBridge) => void;
}) {
  const parseTopics = (json: string | undefined): string[] => {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  const [name, setName] = useState(bridge?.name ?? '');
  const [remoteUrl, setRemoteUrl] = useState(bridge?.remote_url ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [qos, setQos] = useState(bridge?.qos ?? 0);
  const [topicPrefix, setTopicPrefix] = useState(bridge?.topic_prefix ?? '');
  const [subTopics, setSubTopics] = useState<string[]>(parseTopics(bridge?.subscribe_topics));
  const [pubTopics, setPubTopics] = useState<string[]>(parseTopics(bridge?.publish_topics));
  const [autoCreate, setAutoCreate] = useState(bridge?.auto_create_topics ?? true);
  const [enabled, setEnabled] = useState(bridge?.enabled ?? true);
  const [newSubTopic, setNewSubTopic] = useState('');
  const [newPubTopic, setNewPubTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      remote_url: remoteUrl,
      username: username || undefined,
      password: password || undefined,
      qos,
      topic_prefix: topicPrefix || undefined,
      subscribe_topics: subTopics,
      publish_topics: pubTopics,
      auto_create_topics: autoCreate,
      enabled,
    });
  };

  const addSubTopic = () => { if (newSubTopic.trim()) { setSubTopics([...subTopics, newSubTopic.trim()]); setNewSubTopic(''); } };
  const addPubTopic = () => { if (newPubTopic.trim()) { setPubTopics([...pubTopics, newPubTopic.trim()]); setNewPubTopic(''); } };

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input className={inputClass} value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Broker URL</label>
          <input className={inputClass} value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="broker.example.com:1883" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Username</label>
            <input className={inputClass} value={username} onChange={e => setUsername(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>QoS</label>
            <select className={inputClass} value={qos} onChange={e => setQos(Number(e.target.value))}>
              <option value={0}>0 - At Most Once</option>
              <option value={1}>1 - At Least Once</option>
              <option value={2}>2 - Exactly Once</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Topic Prefix</label>
            <input className={inputClass} value={topicPrefix} onChange={e => setTopicPrefix(e.target.value)} placeholder="Optional prefix" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Subscribe Topics</label>
          <div className="flex gap-2 mb-2">
            <input className={inputClass} value={newSubTopic} onChange={e => setNewSubTopic(e.target.value)} placeholder="sensors/#" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubTopic(); } }} />
            <button type="button" onClick={addSubTopic} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500">Add</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {subTopics.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded text-xs">
                {t}
                <button type="button" onClick={() => setSubTopics(subTopics.filter((_, j) => j !== i))} className="hover:text-red-600">&times;</button>
              </span>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Publish Topics</label>
          <div className="flex gap-2 mb-2">
            <input className={inputClass} value={newPubTopic} onChange={e => setNewPubTopic(e.target.value)} placeholder="commands/#" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPubTopic(); } }} />
            <button type="button" onClick={addPubTopic} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500">Add</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {pubTopics.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded text-xs">
                {t}
                <button type="button" onClick={() => setPubTopics(pubTopics.filter((_, j) => j !== i))} className="hover:text-red-600">&times;</button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={autoCreate} onChange={e => setAutoCreate(e.target.checked)} className="rounded" />
            Auto-create topics
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            Enabled
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            {bridge ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
