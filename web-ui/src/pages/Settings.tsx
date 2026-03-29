import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

const inputCls = "w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white";

export default function Settings() {
  const { user, token } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold dark:text-white mb-4">Settings</h2>

      <div className="grid gap-6 max-w-lg">
        {/* Account info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold dark:text-white mb-3">Account</h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div><span className="text-gray-500 dark:text-gray-400">Username:</span> {user?.username}</div>
            <div><span className="text-gray-500 dark:text-gray-400">Role:</span> {user?.is_admin ? 'Admin' : 'User'}</div>
          </div>
        </div>

        {/* Password change */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold dark:text-white mb-3">Change Password</h3>
          <PasswordChangeForm token={token} />
        </div>

        {/* Admin: inbox threshold */}
        {user?.is_admin && <InboxThresholdForm />}
      </div>
    </div>
  );
}

function InboxThresholdForm() {
  const { toast } = useToast();
  const [threshold, setThreshold] = useState('5');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listSettings().then(settings => {
      const t = settings.find(s => s.key === 'inbox_priority_threshold');
      if (t) setThreshold(t.value);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateSetting('inbox_priority_threshold', threshold);
      toast('Threshold updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update threshold', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <h3 className="text-lg font-semibold dark:text-white mb-3">Inbox Routing</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Inbox Priority Threshold</label>
          <input
            type="number"
            min={1}
            max={10}
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className={inputCls}
          />
          <p className="text-xs text-gray-400 mt-1">Messages with priority &gt;= this value appear in Inbox and trigger push notifications</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50 hover:bg-indigo-700"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function PasswordChangeForm({ token }: { token: string | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/current/user/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-2 rounded text-sm">{success}</div>}
      <input type="password" placeholder="Current password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls} />
      <input type="password" placeholder="New password (min 8 chars)" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} />
      <input type="password" placeholder="Confirm new password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
      <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50 hover:bg-indigo-700">
        Change Password
      </button>
    </form>
  );
}
