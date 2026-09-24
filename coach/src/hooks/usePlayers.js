import { playerService } from '@/services/playerService';
import { useQuery } from './useQuery';

/** Players of the coach's squads for pickers, optionally for one team. */
export function usePlayers({ teamId, status } = {}) {
  const { data, loading } = useQuery(() => playerService.options({ teamId, status }), [teamId, status]);
  return { players: data ?? [], loading };
}
