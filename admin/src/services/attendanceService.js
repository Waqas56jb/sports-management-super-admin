import { addDays, parseDate, toISODate } from '@/utils/format';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { paginate } from './mock/query';
import { enrichSession, playerSummary, teamSummary } from './mock/relations';
import { attendanceRecordsInScope, summarizeAttendance } from './mock/statsEngine';

const mondayOf = (iso) => {
  const d = parseDate(iso);
  return toISODate(addDays(d, -((d.getDay() + 6) % 7)));
};

export const attendanceService = {
  /** Aggregates for charts and summary cards (status filter does not apply to rates). */
  async overview({ teamId, playerId, from, to } = {}) {
    if (!USE_MOCK) return api.get('/attendance/overview', { teamId, playerId, from, to });
    await delay();
    const db = getDb();
    const records = attendanceRecordsInScope(db, { teamId, playerId, from, to });

    const group = (keyFn) => {
      const out = {};
      records.forEach((r) => {
        (out[keyFn(r)] ??= []).push(r);
      });
      return out;
    };

    const byTeam = Object.entries(group((r) => r.session.team_id)).map(([id, recs]) => ({ team: teamSummary(db, id), ...summarizeAttendance(recs) }));
    const weeks = group((r) => mondayOf(r.session.date));
    const trend = Object.keys(weeks)
      .sort()
      .map((week) => {
        const row = { week, overall: summarizeAttendance(weeks[week]).rate };
        const perTeam = {};
        weeks[week].forEach((r) => {
          (perTeam[r.session.team_id] ??= []).push(r);
        });
        Object.entries(perTeam).forEach(([tid, recs]) => {
          row[tid] = summarizeAttendance(recs).rate;
        });
        return row;
      });
    const players = Object.entries(group((r) => r.player_id))
      .map(([id, recs]) => {
        const player = playerSummary(db, id);
        return { player, team: teamSummary(db, player?.team_id), ...summarizeAttendance(recs) };
      })
      .filter((p) => p.player)
      .sort((a, b) => a.rate - b.rate);
    const sessions = Object.entries(group((r) => r.training_session_id))
      .map(([id, recs]) => ({ session: enrichSession(db, recs[0].session), ...summarizeAttendance(recs) }))
      .sort((a, b) => b.session.date.localeCompare(a.session.date));

    return clone({ summary: summarizeAttendance(records), byTeam, trend, players, sessions });
  },

  /** Individual register entries — this is where the status filter applies. */
  async records({ teamId, playerId, status, from, to, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/attendance', { teamId, playerId, status, from, to, page, pageSize });
    await delay();
    const db = getDb();
    const rows = attendanceRecordsInScope(db, { teamId, playerId, status, from, to })
      .sort((a, b) => b.session.date.localeCompare(a.session.date) || a.player_id.localeCompare(b.player_id))
      .map(({ session, ...r }) => ({ ...r, session: enrichSession(db, session), player: playerSummary(db, r.player_id) }));
    return clone(paginate(rows, { page, pageSize }));
  },
};
