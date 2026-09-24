import { useCallback } from 'react';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { coachService } from '@/services/coachService';
import { playerService } from '@/services/playerService';
import { teamService } from '@/services/teamService';
import { useQuery } from './useQuery';

/** Translate a list of enum values into <Select> options: toOptions(POSITIONS, 'positions'). */
export function useOptions() {
  const { t } = useI18n();
  return useCallback((values, namespace) => values.map((v) => ({ value: v, label: t(`${namespace}.${v}`) })), [t]);
}

/** Reference lists used by filters and forms. */
export function useTeamOptions() {
  const { data } = useQuery(() => teamService.options(), []);
  return { teams: data ?? [], teamOptions: (data ?? []).map((tm) => ({ value: tm.id, label: tm.name })) };
}

export function useCoachOptions(deps = []) {
  const { data } = useQuery(() => coachService.options(), deps);
  return data ?? [];
}

export function useCompetitionOptions() {
  const { data } = useQuery(() => competitionService.options(), []);
  return { competitions: data ?? [], competitionOptions: (data ?? []).map((c) => ({ value: c.id, label: `${c.name} ${c.season}` })) };
}

export function useSeasonOptions() {
  const { data } = useQuery(() => competitionService.seasons(), []);
  return (data ?? []).map((s) => ({ value: s, label: s }));
}

export function usePlayerOptions(params = {}, deps = []) {
  const { data } = useQuery(() => playerService.options(params), deps);
  return data ?? [];
}
