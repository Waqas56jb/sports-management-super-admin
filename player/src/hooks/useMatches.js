import { matchService } from '@/services/matchService';
import { useQuery } from './useQuery';

export function useMatches(params) {
  const { tab, search, competitionId, from, to, status, page, pageSize } = params;
  return useQuery(() => matchService.getMatches(params), [tab, search, competitionId, from, to, status, page, pageSize]);
}

export function useMatchCounts() {
  return useQuery(() => matchService.counts(), []);
}

export function useMatch(id) {
  return useQuery(() => matchService.getMatch(id), [id]);
}
