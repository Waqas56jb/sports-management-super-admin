import { trainingService } from '@/services/trainingService';
import { useQuery } from './useQuery';

export function useTrainingSessions(params) {
  const { tab, type, from, to, page, pageSize } = params;
  return useQuery(() => trainingService.getTrainingSessions(params), [tab, type, from, to, page, pageSize]);
}

export function useTrainingCounts() {
  return useQuery(() => trainingService.counts(), []);
}

export function useTrainingSession(id) {
  return useQuery(() => trainingService.getTrainingSession(id), [id]);
}
