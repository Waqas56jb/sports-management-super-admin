import { MoreHorizontal } from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import { useI18n } from '@/i18n';

/** "⋯" menu used at the end of table rows and mobile cards. */
export default function RowActions({ items, label }) {
  const { t } = useI18n();
  return (
    <Dropdown
      label={label ?? t('common.moreActions')}
      items={items}
      className="grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink sm:size-9"
      trigger={<MoreHorizontal className="size-5" />}
    />
  );
}
