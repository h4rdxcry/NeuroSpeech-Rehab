import React, { useEffect } from 'react';
import { UserSettings } from './UserSettings';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { accessibility } = useApp();
  const isHighContrast = accessibility.higherContrast;

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-settings-modal-title"
    >
      <div 
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl transition-all ${
          isHighContrast
            ? 'bg-white dark:bg-[#050A14] border-2 border-black dark:border-white'
            : 'bg-white/95 dark:bg-[#111C3D]/95 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings dialog"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <UserSettings 
          variant="modal" 
          onClose={onClose} 
          showCloseButton={false} 
        />
      </div>
    </div>
  );
};
