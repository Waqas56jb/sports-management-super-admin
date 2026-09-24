import Badge from '@/components/ui/Badge';
import { useI18n } from '@/i18n';

const TONES = { fitness: 'danger', tactical: 'info', technical: 'brand', recovery: 'success', match_preparation: 'warning', other: 'neutral' };

export default function TrainingTypeBadge({ type }) {
  const { t } = useI18n();
  return <Badge tone={TONES[type] ?? 'neutral'}>{t(`trainingTypes.${type}`)}</Badge>;
}
