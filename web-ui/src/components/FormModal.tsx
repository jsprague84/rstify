import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { normalizeError } from '../utils/normalizeError';

interface FormModalProps {
  /** Modal title. */
  title: string;
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when user cancels or submission succeeds. */
  onClose: () => void;
  /** Async submit handler — throw to show error, resolve to auto-close. */
  onSubmit: () => Promise<void>;
  /** Form field children. */
  children: React.ReactNode;
  /** Submit button label. Default: "Save". */
  submitLabel?: string;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
}

/**
 * Composes Modal + form submission handling + loading/error state.
 * FormModal manages its own async state internally rather than using useAsyncAction,
 * keeping form submission behavior self-contained.
 *
 * On submit success: auto-calls onClose.
 * On submit failure: shows error inside the modal, keeps it open.
 */
export function FormModal({
  title,
  open,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
}: FormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when modal opens
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit();
      onClose();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={title} open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
