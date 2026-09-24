import { useMemo } from 'react';

/** Live register maths: counts and attendance % for rows of { status }. Late counts as attended. */
export function useAttendanceSummary(rows) {
  return useMemo(() => {
    const marked = rows.filter((r) => r.status);
    const counts = { present: 0, late: 0, excused: 0, absent: 0 };
    marked.forEach((r) => {
      counts[r.status] += 1;
    });
    const rate = marked.length ? ((counts.present + counts.late) / marked.length) * 100 : null;
    return { ...counts, marked: marked.length, unmarked: rows.length - marked.length, rate };
  }, [rows]);
}
