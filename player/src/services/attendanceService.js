import { todayISO } from '@/utils/formatters';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { inDateRange, paginate } from './mock/query';
import { enrichSession } from './mock/relations';
import { currentPlayer } from './mock/scope';
import { summarizeAttendance } from './mock/statsEngine';

/**
 * The player's own attendance (read-only). "Pending" = a past session whose register
 * the coach has not completed yet. Rate = (present + late) ÷ recorded sessions.
 */
export const attendanceService = {
  async getMyAttendance({ from, to, status, type, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/player/attendance', { from, to, status, type, page, pageSize });
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const today = todayISO();
    const coachName = (id) => db.coaches.find((c) => c.id === id)?.name ?? null;

    const sessions = db.trainingSessions.filter(
      (s) => s.team_id === me.team_id && s.status !== 'cancelled' && s.date <= today && inDateRange(s.date, from, to) && (!type || s.training_type === type),
    );
    const all = sessions
      .map((s) => {
        const r = db.attendance.find((a) => a.training_session_id === s.id && a.player_id === me.id);
        // Sessions before the player joined / while inactive have no register line and are skipped.
        if (!r && db.attendance.some((a) => a.training_session_id === s.id)) return null;
        return { id: r?.id ?? `pending-${s.id}`, status: r?.status ?? 'pending', notes: r?.notes ?? '', session: { ...enrichSession(db, s), coach_name: coachName(s.coach_id) } };
      })
      .filter(Boolean)
      .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.session.start_time.localeCompare(a.session.start_time));

    const recorded = all.filter((r) => r.status !== 'pending');
    const summary = { ...summarizeAttendance(recorded), pending: all.length - recorded.length, sessions: all.length };

    // Monthly buckets for charts
    const months = {};
    recorded.forEach((r) => {
      (months[r.session.date.slice(0, 7)] ??= []).push(r);
    });
    const monthly = Object.keys(months)
      .sort()
      .map((m) => ({ month: `${m}-01`, ...summarizeAttendance(months[m]) }));

    // Running participation trend (cumulative rate after each session)
    let attended = 0;
    const trend = [...recorded].reverse().map((r, i) => {
      if (r.status === 'present' || r.status === 'late') attended += 1;
      return { date: r.session.date, rate: Math.round((attended / (i + 1)) * 1000) / 10 };
    });

    const history = status ? all.filter((r) => r.status === status) : all;
    return clone({ summary, monthly, trend, history: paginate(history, { page, pageSize }) });
  },
};
