import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { openModal, closeModal } from '@/hooks/useModalState';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}

export default function ModalShell({ isOpen, onClose, title, children, icon }: ModalShellProps) {
  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => closeModal();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-dark-border animate-fade-in-up max-h-[calc(90vh-7rem)] mb-28 sm:mb-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-4 py-3 flex items-center gap-2 z-10">
          {icon}
          <h3 className="font-display text-lg font-bold text-white flex-1">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
