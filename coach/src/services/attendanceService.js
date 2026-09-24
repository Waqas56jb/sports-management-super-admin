import { addDays, parseDate, toISODate, todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb } from './mock/db';
import { paginate } from './mock/query';
import { enrichSession, playerSummary, teamSummary } from './mock/relations';
import { assertMyTeam, myTeamIds } from './mock/scope';
import { attendanceRecordsInScope, summarizeAttendance } from './mock/statsEngine';

const bucketKey = {
  day: (iso) => iso,
  week: (iso) => {
    const d = parseDate(iso);
    return toISODate(addDays(d, -((d.getDay() + 6) % 7)));
  },
  month: (iso) => `${iso.slice(0, 7)}-01`,
};

function scoped(db, filters) {
  const ids = myTeamIds(db);
  return attendanceRecordsInScope(db, filters).filter((r) => ids.includes(r.session.team_id));
}

export const attendanceService = {
  /**
   * Aggregates for the attendance dashboard. granularity: 'day' | 'week' | 'month'.
   * The status filter does not change rates — it only applies to the records list.
   */
  async overview({ teamId, playerId, sessionId, from, to, granularity = 'week' } = {}) {
    if (!USE_MOCK) return api.get('/coach/attendance/overview', { teamId, playerId, sessionId, from, to, granularity });
    await delay();
    const db = getDb();
    const records = scoped(db, { teamId, playerId, sessionId, from, to });
    const group = (keyFn) => {
      const out = {};
      records.forEach((r) => {
        (out[keyFn(r)] ??= []).push(r);
      });
      return out;
    };
    const toKey = bucketKey[granularity] ?? bucketKey.week;
    const buckets = group((r) => toKey(r.session.date));
    const trend = Object.keys(buckets)
      .sort()
      .slice(granularity === 'day' ? -21 : granularity === 'month' ? -6 : -12)
      .map((key) => {
        const row = { key, overall: summarizeAttendance(buckets[key]).rate };
        const perTeam = {};
        buckets[key].forEach((r) => {
          (perTeam[r.session.team_id] ??= []).push(r);
        });
        Object.entries(perTeam).forEach(([tid, recs]) => {
          row[tid] = summarizeAttendance(recs).rate;
        });
        return row;
      });

    const ids = teamId ? [teamId] : myTeamIds(db);
    const today = todayISO();
    const pending = db.trainingSessions
      .filter((s) => ids.includes(s.team_id) && s.status !== 'cancelled' && s.date <= today && !db.attendance.some((a) => a.training_session_id === s.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => enrichSession(db, s));

    return clone({
      summary: summarizeAttendance(records),
      byTeam: Object.entries(group((r) => r.session.team_id)).map(([id, recs]) => ({ team: teamSummary(db, id), ...summarizeAttendance(recs) })),
      trend,
      players: Object.entries(group((r) => r.player_id))
        .map(([id, recs]) => {
          const player = playerSummary(db, id);
          return { player, team: teamSummary(db, player?.team_id), ...summarizeAttendance(recs) };
        })
        .filter((p) => p.player)
        .sort((a, b) => a.rate - b.rate),
      sessions: Object.entries(group((r) => r.training_session_id))
        .map(([, recs]) => ({ session: enrichSession(db, recs[0].session), ...summarizeAttendance(recs) }))
        .sort((a, b) => b.session.date.localeCompare(a.session.date)),
      pending,
    });
  },

  async records({ teamId, playerId, sessionId, status, from, to, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/coach/attendance', { teamId, playerId, sessionId, status, from, to, page, pageSize });
    await delay();
    const db = getDb();
    const rows = scoped(db, { teamId, playerId, sessionId, status, from, to })
      .sort((a, b) => b.session.date.localeCompare(a.session.date) || a.player_id.localeCompare(b.player_id))
      .map(({ session, ...r }) => ({ ...r, session: enrichSession(db, session), player: playerSummary(db, r.player_id) }));
    return clone(paginate(rows, { page, pageSize }));
  },

  /** Edit a single register entry from the history table. */
  async updateRecord(id, { status, notes }) {
    if (!USE_MOCK) return api.patch(`/coach/attendance/${id}`, { status, notes });
    await delay(300);
    const db = getDb();
    const record = db.attendance.find((a) => a.id === id);
    if (!record) throw new ApiError('errors.notFound', { status: 404 });
    const session = db.trainingSessions.find((s) => s.id === record.training_session_id);
    assertMyTeam(db, session?.team_id);
    record.status = status;
    record.notes = notes ?? record.notes;
    commit();
    return clone(record);
  },
};
