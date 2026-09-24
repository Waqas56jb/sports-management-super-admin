import { attendanceService } from '@/services/attendanceService';
import { useQuery } from './useQuery';

/** Own attendance: summary, monthly buckets, trend and paginated history (filters combine). */
export function useAttendance(params) {
  const { from, to, status, type, page, pageSize } = params;
  return useQuery(() => attendanceService.getMyAttendance(params), [from, to, status, type, page, pageSize]);
}
