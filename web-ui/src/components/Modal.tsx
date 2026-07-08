import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className="relative bg-white dark:bg-surface-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5">{title}</h3>
        {children}
      </div>
    </div>
  );
}
