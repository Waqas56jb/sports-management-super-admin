import { useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { useErrorMessage, useI18n } from '@/i18n';

/**
 * Wraps a mutation: shows a success toast, or an error toast with the translated API error.
 * Re-throws so callers (forms, confirm dialogs) can keep their own state consistent.
 */
export function useAction() {
  const toast = useToast();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  return useCallback(
    async (fn, { success, error = 'errors.actionFailed' } = {}) => {
      try {
        const result = await fn();
        if (success) toast.success(typeof success === 'string' ? t(success) : success);
        return result;
      } catch (err) {
        toast.error(t(error), err?.code ? errorMessage(err) : undefined);
        throw err;
      }
    },
    [toast, t, errorMessage],
  );
}
