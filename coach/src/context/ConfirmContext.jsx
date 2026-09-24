import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation dialogs:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title, message, confirmLabel, tone: 'danger', onConfirm: async () => {...} });
 * If `onConfirm` is given the dialog stays open with a loading button until it settles.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setState(options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
    setBusy(false);
  };

  const handleConfirm = async () => {
    if (!state?.onConfirm) return close(true);
    setBusy(true);
    try {
      await state.onConfirm();
      close(true);
    } catch {
      // The caller reports the error (toast); keep the dialog usable.
      setBusy(false);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!state}
        title={state?.title}
        message={state?.message}
        confirmLabel={state?.confirmLabel}
        tone={state?.tone}
        loading={busy}
        onConfirm={handleConfirm}
        onCancel={() => !busy && close(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
