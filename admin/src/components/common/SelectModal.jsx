import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n';

/** Small modal that asks for one value from a list (assign team, assign coach…). */
export default function SelectModal({ open, title, label, hint, options, value, placeholder, submitLabel, onClose, onSubmit }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSelected(value ?? '');
  }, [open, value]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(selected);
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="select-modal-form" loading={busy} className="w-full sm:w-auto">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="select-modal-form" onSubmit={submit}>
        <Select label={label} hint={hint} options={options} value={selected} placeholder={placeholder} onChange={(e) => setSelected(e.target.value)} data-autofocus />
      </form>
    </Modal>
  );
}
