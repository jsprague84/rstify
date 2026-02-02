import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Client, CreateClient, UpdateClient } from '../api/types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TokenDisplay from '../components/TokenDisplay';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ name });
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
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{client ? 'Save' : 'Create'}</button>
      </div>
    </form>
  );
}
