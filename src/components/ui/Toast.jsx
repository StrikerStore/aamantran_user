import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
let _id = 0;

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

/**
 * Short messages after an action. Read out by screen readers (polite for
 * news, assertive for errors). Errors stay until closed — a problem the couple
 * has to act on should not vanish while they are reading it.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = ++_id;
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    const ms = duration ?? (type === 'error' ? 0 : 4000);
    if (ms > 0) setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container">
        <div aria-live="polite" className="sr-only">
          {toasts.filter((t) => t.type !== 'error').map((t) => <p key={t.id}>{t.message}</p>)}
        </div>
        <div aria-live="assertive" className="sr-only">
          {toasts.filter((t) => t.type === 'error').map((t) => <p key={t.id}>{t.message}</p>)}
        </div>
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="toast-icon"><Icon size={18} aria-hidden="true" /></span>
              <span className="toast-msg">{t.message}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss message">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
