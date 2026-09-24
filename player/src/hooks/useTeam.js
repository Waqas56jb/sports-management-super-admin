import { teamService } from '@/services/teamService';
import { useQuery } from './useQuery';

export function useTeam() {
  return useQuery(() => teamService.getMyTeam(), []);
}

export function useRoster({ search, position } = {}) {
  return useQuery(() => teamService.getRoster({ search, position }), [search, position]);
}
