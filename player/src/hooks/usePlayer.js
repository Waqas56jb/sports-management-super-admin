import { playerService } from '@/services/playerService';
import { useQuery } from './useQuery';

/** Signed-in player's identity card (name, number, position, team, status). */
export function usePlayer() {
  return useQuery(() => playerService.getCurrentPlayer(), []);
}

/** Full personal + sports profile of the signed-in player. */
export function usePlayerProfile() {
  return useQuery(() => playerService.getPlayerProfile(), []);
}

export function useDashboard() {
  return useQuery(() => playerService.getDashboard(), []);
}
