import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
          warning: <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
          info: <Info className="w-5 h-5 text-[#2563EB] flex-shrink-0" />
        };

        const bgBorders = {
          success: 'bg-white border-emerald-200 text-slate-900',
          error: 'bg-white border-rose-200 text-slate-900',
          warning: 'bg-white border-amber-200 text-slate-900',
          info: 'bg-white border-blue-200 text-slate-900'
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 transition-all transform animate-in slide-in-from-bottom-3 duration-200 ${bgBorders[toast.type]}`}
          >
            {icons[toast.type]}
            <div className="flex flex-col flex-1 min-w-0 pr-1">
              <span className="text-sm font-semibold leading-snug">{toast.title}</span>
              {toast.description && (
                <span className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toast.description}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
