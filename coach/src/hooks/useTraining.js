import { trainingService } from '@/services/trainingService';
import { useQuery } from './useQuery';

/** Completed (non-cancelled) sessions for pickers, optionally for one team. */
export function useTrainingOptions({ teamId } = {}) {
  const { data, loading } = useQuery(() => trainingService.options({ teamId }), [teamId]);
  return { sessions: data ?? [], loading };
}
