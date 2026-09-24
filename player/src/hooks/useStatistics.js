import { statisticsService } from '@/services/statisticsService';
import { useQuery } from './useQuery';

/** Own statistics for the selected season / competition / dates / match type. */
export function useStatistics(params) {
  const { season, competitionId, from, to, matchType } = params;
  return useQuery(() => statisticsService.getMyStatistics(params), [season, competitionId, from, to, matchType]);
}
