import { useState } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { trainingService } from '@/services/trainingService';
import Calendar from './Calendar';
import { calendarRange } from './calendarUtils';

/** Self-loading calendar of training sessions, matches and competition dates. */
export default function CalendarPanel({ teamId, kinds, initialView = 'month' }) {
  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(() => new Date());
  const range = calendarRange(view, date);
  const { data, loading } = useQuery(() => trainingService.calendar({ ...range, teamId }), [range.from, range.to, teamId]);
  const events = (data ?? []).filter((e) => !kinds || kinds.includes(e.kind));
  return <Calendar events={events} loading={loading && !data} view={view} onViewChange={setView} date={date} onDateChange={setDate} />;
}
