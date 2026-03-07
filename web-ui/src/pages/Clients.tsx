import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Client, CreateClient, UpdateClient } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';

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
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const load = useCallback(() => {
    api.listClients().then(setClients).catch(e => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (data: CreateClient) => {
    await api.createClient(data);
    setShowCreate(false);
    load();
  };

  const handleUpdate = async (id: number, data: UpdateClient) => {
    await api.updateClient(id, data);
    setEditClient(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteClient) return;
    await api.deleteClient(deleteClient.id);
    setDeleteClient(null);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold dark:text-white">Clients</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Create Client
        </button>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
      <DataTable
        data={clients}
        keyField="id"
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'token', header: 'Token', render: c => <TokenDisplay token={c.token} /> },
          { key: 'scopes', header: 'Scopes', render: c => <ScopeBadges scopes={c.scopes} /> },
          { key: 'created_at', header: 'Created' },
        ]}
        actions={c => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditClient(c)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button onClick={() => setDeleteClient(c)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        )}
      />
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Client">
          <ClientForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
      {editClient && (
        <Modal open onClose={() => setEditClient(null)} title="Edit Client">
          <ClientForm client={editClient} onSubmit={d => handleUpdate(editClient.id, d)} onClose={() => setEditClient(null)} />
        </Modal>
      )}
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

function ClientForm({ client, onSubmit, onClose }: { client?: Client; onSubmit: (d: CreateClient & UpdateClient) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(client?.name || '');
  const existingScopes = client ? parseScopesList(client.scopes) : ['read', 'write'];
  const [scopes, setScopes] = useState<string[]>(existingScopes);
  const [appScope, setAppScope] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scopes.length === 0) {
      setError('At least one scope is required');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ name, scopes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
      <input placeholder="Name" required value={name} onChange={e => setName(e.target.value)} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />

      <div>
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

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{client ? 'Save' : 'Create'}</button>
      </div>
    </form>
  );
}
