import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';
import Button from './Button';
import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, confirmLabel, tone = 'danger', loading, onConfirm, onCancel }) {
  const { t } = useI18n();
  const danger = tone === 'danger';
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      dismissible={!loading}
      role="alertdialog"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} className="w-full sm:w-auto" data-autofocus>
            {confirmLabel ?? (danger ? t('common.delete') : t('common.confirm'))}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 pt-2 text-center sm:flex-row sm:items-start sm:text-left">
        <span
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-full',
            danger ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
          )}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {message && <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{message}</p>}
        </div>
      </div>
    </Modal>
  );
}
