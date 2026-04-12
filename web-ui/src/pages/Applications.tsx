import { useState, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { Application, MessageResponse } from 'shared';
import MessageContent from '../components/MessageContent';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';
import PriorityBadge from '../components/PriorityBadge';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import { useCrudResource } from '../hooks/useCrudResource';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { formatLocalTime } from 'shared';

function AppIcon({ app, size = 32 }: { app: Application; size?: number }) {
  const [v] = useState(() => Date.now());
  if (!app.image) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-400 text-xs font-bold"
      >
        {app.name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`${api.getApplicationIconUrl(app.id)}?v=${v}`}
      alt={app.name}
      style={{ width: size, height: size }}
      className="rounded object-contain"
    />
  );
}

export default function Applications() {
  const fetchApps = useCallback(() => api.listApplications(), []);
  const crud = useCrudResource(fetchApps);
  const messagesAction = useAsyncAction<MessageResponse[]>();

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [deleteApp, setDeleteApp] = useState<Application | null>(null);
  const [messagesApp, setMessagesApp] = useState<Application | null>(null);
  const [appMessages, setAppMessages] = useState<MessageResponse[]>([]);

  // Form field state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultPriority, setDefaultPriority] = useState('5');
  const [retentionDays, setRetentionDays] = useState('');

  // Icon state (page-specific inline behavior)
  const [iconLoading, setIconLoading] = useState(false);
  const [iconVersion, setIconVersion] = useState(Date.now());
  const [hasIcon, setHasIcon] = useState(false);
  const [iconError, setIconError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setDefaultPriority('5');
    setRetentionDays('');
    setHasIcon(false);
    setIconError('');
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (app: Application) => {
    setName(app.name);
    setDescription(app.description || '');
    setDefaultPriority(String(app.default_priority ?? 5));
    setRetentionDays(app.retention_days != null ? String(app.retention_days) : '');
    setHasIcon(!!app.image);
    setIconVersion(Date.now());
    setIconError('');
    setEditApp(app);
  };

  const loadAppMessages = async (app: Application) => {
    setMessagesApp(app);
    const result = await messagesAction.execute(async () => {
      const res = await api.listApplicationMessages(app.id);
      return res.messages;
    });
    if (result) setAppMessages(result);
  };

  const handleDelete = async () => {
    if (!deleteApp) return;
    const ok = await crud.mutate(() => api.deleteApplication(deleteApp.id));
    if (ok) setDeleteApp(null);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editApp) return;
    setIconLoading(true);
    setIconError('');
    try {
      await api.uploadApplicationIcon(editApp.id, file);
      setHasIcon(true);
      setIconVersion(Date.now());
      crud.reload();
    } catch (err) {
      setIconError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIconLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleIconRemove = async () => {
    if (!editApp) return;
    setIconLoading(true);
    setIconError('');
    try {
      await api.deleteApplicationIcon(editApp.id);
      setHasIcon(false);
      setIconVersion(Date.now());
      crud.reload();
    } catch (err) {
      setIconError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setIconLoading(false);
    }
  };

  const iconEditor = editApp && (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
      {iconError && <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">{iconError}</div>}
      <div className="flex items-center gap-3">
        {hasIcon ? (
          <img
            src={`${api.getApplicationIconUrl(editApp.id)}?v=${iconVersion}`}
            alt="icon"
            className="w-10 h-10 rounded object-contain"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-bold">
            {(name || editApp.name).charAt(0).toUpperCase()}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
          onChange={handleIconUpload}
          disabled={iconLoading}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={iconLoading}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          {iconLoading ? 'Uploading...' : 'Choose File'}
        </button>
        {hasIcon && (
          <button
            type="button"
            onClick={handleIconRemove}
            disabled={iconLoading}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Applications</h2>
        <button onClick={openCreate} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Application
        </button>
      </div>
      {crud.error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{crud.error}</div>}
      <DataTable
        data={crud.items}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'image', header: 'Icon', render: a => <button onClick={() => openEdit(a)} className="cursor-pointer"><AppIcon app={a} size={28} /></button> },
          { key: 'name', header: 'Name' },
          { key: 'description', header: 'Description', render: a => a.description || '-' },
          { key: 'token', header: 'Token', render: a => <TokenDisplay token={a.token} /> },
          { key: 'default_priority', header: 'Priority' },
          { key: 'retention_days', header: 'Retention', render: a => a.retention_days ? `${a.retention_days}d` : '\u221e' },
        ]}
        actions={a => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => loadAppMessages(a)} className="text-blue-600 hover:text-blue-800 text-sm">Messages</button>
            <button onClick={() => openEdit(a)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteApp(a)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      <FormModal
        title="Create Application"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async () => {
          await api.createApplication({
            name,
            description: description || null,
            default_priority: parseInt(defaultPriority) || 0,
          });
          await crud.reload();
        }}
        submitLabel="Create"
      >
        <FormField label="Name" required value={name} onChange={setName} placeholder="Name" />
        <FormField label="Description" value={description} onChange={setDescription} placeholder="Description (optional)" />
        <FormField label="Default Priority" type="number" value={defaultPriority} onChange={setDefaultPriority} min={0} max={10} />
      </FormModal>
      <FormModal
        title="Edit Application"
        open={!!editApp}
        onClose={() => setEditApp(null)}
        onSubmit={async () => {
          if (!editApp) return;
          await api.updateApplication(editApp.id, {
            name,
            description: description || null,
            default_priority: parseInt(defaultPriority) || 0,
            retention_days: retentionDays !== '' ? Number(retentionDays) : null,
          });
          await crud.reload();
        }}
        submitLabel="Save"
      >
        {iconEditor}
        <FormField label="Name" required value={name} onChange={setName} placeholder="Name" />
        <FormField label="Description" value={description} onChange={setDescription} placeholder="Description (optional)" />
        <FormField label="Default Priority" type="number" value={defaultPriority} onChange={setDefaultPriority} min={0} max={10} />
        <FormField
          label="Message Retention (days)"
          type="number"
          value={retentionDays}
          onChange={setRetentionDays}
          min={1}
          max={365}
          placeholder="No limit"
          helpText="Leave empty for no limit. Messages older than this will be auto-deleted."
        />
      </FormModal>
      <ConfirmDialog
        open={!!deleteApp}
        onClose={() => setDeleteApp(null)}
        onConfirm={handleDelete}
        title="Delete Application"
        message={`Delete application "${deleteApp?.name}"? All associated messages will be deleted.`}
      />
      {messagesApp && (
        <Modal open onClose={() => { setMessagesApp(null); setAppMessages([]); messagesAction.clearError(); }} title={`Messages \u2014 ${messagesApp.name}`}>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {messagesAction.loading ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">Loading...</p>
            ) : messagesAction.error ? (
              <p className="text-red-500 dark:text-red-400 text-center py-4">{messagesAction.error}</p>
            ) : appMessages.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No messages</p>
            ) : (
              appMessages.map(m => (
                <div key={m.id} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {m.title && <span className="font-semibold text-gray-900 dark:text-white text-sm">{m.title}</span>}
                    <span className="text-xs text-gray-400">#{m.id}</span>
                    <PriorityBadge priority={m.priority} />
                  </div>
                  <MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {m.tags.map(t => <span key={t} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{t}</span>)}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatLocalTime(m.date)}</p>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
