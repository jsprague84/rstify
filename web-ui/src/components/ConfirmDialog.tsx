import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete' }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-5 py-2 text-sm font-semibold text-white bg-error rounded-pill hover:bg-error/90 transition">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
