import { useCallback } from 'react';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { useQuery } from './useQuery';

/** Translate a list of enum values into <Select> options: toOptions(POSITIONS, 'positions'). */
export function useOptions() {
  const { t } = useI18n();
  return useCallback((values, namespace) => values.map((v) => ({ value: v, label: t(`${namespace}.${v}`) })), [t]);
}

export function useCompetitionOptions() {
  const { data } = useQuery(() => competitionService.getCompetitions(), []);
  return (data ?? []).map((c) => ({ value: c.id, label: `${c.name} ${c.season}` }));
}

export function useSeasonOptions() {
  const { data } = useQuery(() => competitionService.getSeasons(), []);
  return (data ?? []).map((s) => ({ value: s, label: s }));
}
