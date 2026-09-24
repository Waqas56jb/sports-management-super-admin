import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from '@/context/ConfirmContext';
import { useI18n } from '@/i18n';

/**
 * Asks for confirmation before leaving a page with unsaved changes
 * (in-app navigation via the router, and tab close / reload via beforeunload).
 */
export function useUnsavedChanges(dirty) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: t('common.unsaved.title'),
      message: t('common.unsaved.message'),
      confirmLabel: t('common.unsaved.discard'),
      tone: 'danger',
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm, t]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
}
