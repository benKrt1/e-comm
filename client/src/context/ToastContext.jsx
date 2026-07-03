import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import styles from './Toast.module.css';

const ToastContext = createContext(null);

/**
 * App-wide toast notifications. Consumers call useToast() and get a single
 * function: addToast(message, type) where type is 'success' | 'error'.
 * Toasts self-dismiss after 4s; at most 3 are shown at once.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const reduceMotion = useReducedMotion();
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const addToast = useCallback(
    (message, type = 'success') => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-2), { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), 4000)
      );
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {/* aria-live: screen readers announce new toasts without focus moving */}
      <div className={styles.viewport} role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`${styles.toast} ${styles[toast.type]}`}
            >
              <span>{toast.message}</span>
              <button
                className={styles.close}
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
