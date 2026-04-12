import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { MqttBridge, MqttStatusResponse, CreateMqttBridge, UpdateMqttBridge } from 'shared';
import DataTable from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import ConfirmDialog from '../components/ConfirmDialog';
import { useCrudResource } from '../hooks/useCrudResource';
import { parseJsonArray } from '../utils/webhookHelpers';

export default function Bridges() {
  const fetchBridges = useCallback(() => api.listBridges(), []);
  const crud = useCrudResource(fetchBridges);

  const [mqttStatus, setMqttStatus] = useState<MqttStatusResponse | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editBridge, setEditBridge] = useState<MqttBridge | null>(null);
  const [deleteBridge, setDeleteBridge] = useState<MqttBridge | null>(null);

  // Form field state
  const [name, setName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [qos, setQos] = useState(0);
  const [topicPrefix, setTopicPrefix] = useState('');
  const [subTopics, setSubTopics] = useState<string[]>([]);
  const [pubTopics, setPubTopics] = useState<string[]>([]);
  const [autoCreate, setAutoCreate] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [newSubTopic, setNewSubTopic] = useState('');
  const [newPubTopic, setNewPubTopic] = useState('');

  // Load MQTT status (fire-and-forget, errors silently ignored like original)
  const loadStatusRef = useRef(() => { api.getMqttStatus().then(setMqttStatus).catch(() => {}); });
  const loadStatus = loadStatusRef.current;

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const resetForm = () => {
    setName('');
    setRemoteUrl('');
    setUsername('');
    setPassword('');
    setQos(0);
    setTopicPrefix('');
    setSubTopics([]);
    setPubTopics([]);
    setAutoCreate(true);
    setEnabled(true);
    setNewSubTopic('');
    setNewPubTopic('');
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (b: MqttBridge) => {
    setName(b.name);
    setRemoteUrl(b.remote_url);
    setUsername('');
    setPassword('');
    setQos(b.qos ?? 0);
    setTopicPrefix(b.topic_prefix ?? '');
    setSubTopics(parseJsonArray(b.subscribe_topics));
    setPubTopics(parseJsonArray(b.publish_topics));
    setAutoCreate(b.auto_create_topics ?? true);
    setEnabled(b.enabled ?? true);
    setNewSubTopic('');
    setNewPubTopic('');
    setEditBridge(b);
  };

  const buildPayload = (): CreateMqttBridge | UpdateMqttBridge => ({
    name,
    remote_url: remoteUrl,
    username: username || null,
    password: password || null,
    qos,
    topic_prefix: topicPrefix || null,
    subscribe_topics: subTopics,
    publish_topics: pubTopics,
    auto_create_topics: autoCreate,
    enabled,
  });

  const handleDelete = async () => {
    if (!deleteBridge) return;
    const ok = await crud.mutate(() => api.deleteBridge(deleteBridge.id));
    if (ok) {
      setDeleteBridge(null);
      loadStatus();
    }
  };

  const addSubTopic = () => {
    if (newSubTopic.trim()) {
      setSubTopics(prev => [...prev, newSubTopic.trim()]);
      setNewSubTopic('');
    }
  };

  const addPubTopic = () => {
    if (newPubTopic.trim()) {
      setPubTopics(prev => [...prev, newPubTopic.trim()]);
      setNewPubTopic('');
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  const arrayFieldsJsx = (
    <>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subscribe Topics</label>
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
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publish Topics</label>
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
    </>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">MQTT Bridges</h2>
        <button onClick={openCreate} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
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
      {crud.error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{crud.error}</div>}
      <DataTable
        data={crud.items}
        keyField="id"
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'remote_url', header: 'Broker URL' },
          { key: 'enabled', header: 'Status', render: b => {
            if (!b.enabled) {
              return (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  Disabled
                </span>
              );
            }
            const bridgeInfo = mqttStatus?.bridges?.find(s => s.id === b.id);
            const connected = bridgeInfo?.connected ?? false;
            return (
              <span className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-green-600' : 'text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            );
          }},
          { key: 'subscribe_topics', header: 'Subscribe', render: b => (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {parseJsonArray(b.subscribe_topics).join(', ') || '\u2014'}
            </span>
          )},
          { key: 'qos', header: 'QoS', render: b => `${b.qos ?? 0}` },
        ]}
        actions={b => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => openEdit(b)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteBridge(b)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      <FormModal
        title="New Bridge"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async () => {
          await api.createBridge(buildPayload() as CreateMqttBridge);
          await crud.reload();
          loadStatus();
        }}
        submitLabel="Create"
      >
        <FormField label="Name" required value={name} onChange={setName} />
        <FormField label="Broker URL" required value={remoteUrl} onChange={setRemoteUrl} placeholder="broker.example.com:1883" />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Username" value={username} onChange={setUsername} placeholder="Optional" />
          <FormField label="Password" type="password" value={password} onChange={setPassword} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="QoS"
            type="select"
            value={String(qos)}
            onChange={v => setQos(Number(v))}
            options={[
              { value: '0', label: '0 - At Most Once' },
              { value: '1', label: '1 - At Least Once' },
              { value: '2', label: '2 - Exactly Once' },
            ]}
          />
          <FormField label="Topic Prefix" value={topicPrefix} onChange={setTopicPrefix} placeholder="Optional prefix" />
        </div>
        {arrayFieldsJsx}
        <div className="flex gap-6">
          <FormField type="checkbox" label="Auto-create topics" checked={autoCreate} onChange={setAutoCreate} />
          <FormField type="checkbox" label="Enabled" checked={enabled} onChange={setEnabled} />
        </div>
      </FormModal>
      <FormModal
        title="Edit Bridge"
        open={!!editBridge}
        onClose={() => setEditBridge(null)}
        onSubmit={async () => {
          if (!editBridge) return;
          await api.updateBridge(editBridge.id, buildPayload() as UpdateMqttBridge);
          await crud.reload();
          loadStatus();
        }}
        submitLabel="Update"
      >
        <FormField label="Name" required value={name} onChange={setName} />
        <FormField label="Broker URL" required value={remoteUrl} onChange={setRemoteUrl} placeholder="broker.example.com:1883" />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Username" value={username} onChange={setUsername} placeholder="Optional" />
          <FormField label="Password" type="password" value={password} onChange={setPassword} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="QoS"
            type="select"
            value={String(qos)}
            onChange={v => setQos(Number(v))}
            options={[
              { value: '0', label: '0 - At Most Once' },
              { value: '1', label: '1 - At Least Once' },
              { value: '2', label: '2 - Exactly Once' },
            ]}
          />
          <FormField label="Topic Prefix" value={topicPrefix} onChange={setTopicPrefix} placeholder="Optional prefix" />
        </div>
        {arrayFieldsJsx}
        <div className="flex gap-6">
          <FormField type="checkbox" label="Auto-create topics" checked={autoCreate} onChange={setAutoCreate} />
          <FormField type="checkbox" label="Enabled" checked={enabled} onChange={setEnabled} />
        </div>
      </FormModal>
      <ConfirmDialog
        open={!!deleteBridge}
        title="Delete Bridge"
        message={`Delete bridge "${deleteBridge?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteBridge(null)}
      />
    </div>
  );
}
