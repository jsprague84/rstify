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
          <div className="mb-4 px-4 py-2.5 bg-error/10 text-error rounded-xl text-sm">
            {error}
          </div>
        )}
        {children}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-pill hover:bg-brand-600 disabled:opacity-50 transition"
          >
            {loading ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
