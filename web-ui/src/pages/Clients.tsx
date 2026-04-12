import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Client } from 'shared';
import DataTable from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { FormField } from '../components/FormField';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';
import { useCrudResource } from '../hooks/useCrudResource';
import { formatLocalTime } from 'shared';

const AVAILABLE_SCOPES = ['read', 'write', 'admin'];

function parseScopesList(scopesJson: string): string[] {
  try {
    return JSON.parse(scopesJson);
  } catch {
    return ['read', 'write'];
  }
}

function ScopeBadges({ scopes }: { scopes: string }) {
  const list = parseScopesList(scopes);
  return (
    <div className="flex flex-wrap gap-1">
      {list.map(s => (
        <span key={s} className={`inline-block px-2 py-0.5 text-xs rounded-full ${
          s === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
          s === 'write' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
          s.startsWith('app:') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
        }`}>{s}</span>
      ))}
    </div>
  );
}

export default function Clients() {
  const fetchClients = useCallback(() => api.listClients(), []);
  const crud = useCrudResource(fetchClients);

  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  // Form field state
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read', 'write']);
  const [appScope, setAppScope] = useState('');

  const resetForm = () => {
    setName('');
    setScopes(['read', 'write']);
    setAppScope('');
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (c: Client) => {
    setName(c.name);
    setScopes(parseScopesList(c.scopes));
    setAppScope('');
    setEditClient(c);
  };

  const toggleScope = (scope: string) => {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  };

  const addAppScope = () => {
    const s = `app:${appScope.trim()}`;
    if (appScope.trim() && !scopes.includes(s)) {
      setScopes(prev => [...prev, s]);
      setAppScope('');
    }
  };

  const removeScope = (scope: string) => {
    setScopes(prev => prev.filter(s => s !== scope));
  };

  const handleDelete = async () => {
    if (!deleteClient) return;
    const ok = await crud.mutate(() => api.deleteClient(deleteClient.id));
    if (ok) setDeleteClient(null);
  };

  const scopesEditor = (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scopes</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {AVAILABLE_SCOPES.map(s => (
          <label key={s} className="flex items-center gap-1 text-sm dark:text-gray-300">
            <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="rounded" />
            {s}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          placeholder="App ID (e.g., 5)"
          value={appScope}
          onChange={e => setAppScope(e.target.value)}
          className="flex-1 border dark:border-gray-600 rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
        />
        <button type="button" onClick={addAppScope} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">
          Add app scope
        </button>
      </div>
      {scopes.filter(s => s.startsWith('app:')).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {scopes.filter(s => s.startsWith('app:')).map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {s}
              <button type="button" onClick={() => removeScope(s)} className="hover:text-purple-900">&times;</button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        read = list messages, write = create/delete messages, admin = all access. app:ID restricts to a specific application.
      </p>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Clients</h2>
        <button onClick={openCreate} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Client
        </button>
      </div>
      {crud.error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{crud.error}</div>}
      <DataTable
        data={crud.items}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'token', header: 'Token', render: c => <TokenDisplay token={c.token} /> },
          { key: 'scopes', header: 'Scopes', render: c => <ScopeBadges scopes={c.scopes} /> },
          { key: 'created_at', header: 'Created', render: c => formatLocalTime(c.created_at) },
        ]}
        actions={c => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => openEdit(c)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteClient(c)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      <FormModal
        title="Create Client"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async () => {
          if (scopes.length === 0) throw new Error('At least one scope is required');
          await api.createClient({ name, scopes });
          await crud.reload();
        }}
        submitLabel="Create"
      >
        <FormField label="Name" required value={name} onChange={setName} placeholder="Name" />
        {scopesEditor}
      </FormModal>
      <FormModal
        title="Edit Client"
        open={!!editClient}
        onClose={() => setEditClient(null)}
        onSubmit={async () => {
          if (!editClient) return;
          if (scopes.length === 0) throw new Error('At least one scope is required');
          await api.updateClient(editClient.id, { name, scopes });
          await crud.reload();
        }}
        submitLabel="Save"
      >
        <FormField label="Name" required value={name} onChange={setName} placeholder="Name" />
        {scopesEditor}
      </FormModal>
      <ConfirmDialog
        open={!!deleteClient}
        onClose={() => setDeleteClient(null)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Delete client "${deleteClient?.name}"?`}
      />
    </div>
  );
}
