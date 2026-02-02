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
      <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
