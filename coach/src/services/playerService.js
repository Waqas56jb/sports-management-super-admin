import { addDays, parseDate, toISODate } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { coachSummary, enrichMatch, teamSummary } from './mock/relations';
import { assertMyTeam, myTeamIds } from './mock/scope';
import { attendanceRecordsInScope, computeAttendanceByPlayer, computePlayerStats, matchPlayerLines, summarizeAttendance } from './mock/statsEngine';

const withTeam = (db, p) => ({ ...p, team: teamSummary(db, p.team_id) });

export const playerService = {
  /** Players of the coach's teams (read-only for coaches). */
  async list({ search, teamId, position, status, page, pageSize, sort = 'name', dir = 'asc' } = {}) {
    if (!USE_MOCK) return api.get('/coach/players', { search, teamId, position, status, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const ids = myTeamIds(db);
    const stats = Object.fromEntries(computePlayerStats(db).map((s) => [s.player_id, s]));
    const attendance = computeAttendanceByPlayer(db);
    const rows = db.players
      .filter(
        (p) =>
          ids.includes(p.team_id) &&
          (!teamId || p.team_id === teamId) &&
          (!position || p.position === position) &&
          (!status || p.status === status) &&
          matchesSearch(search, p.name, p.email, p.jersey_number),
      )
      .map((p) => ({ ...withTeam(db, p), rating: stats[p.id]?.rating ?? null, goals: stats[p.id]?.goals ?? 0, attendance_rate: attendance[p.id]?.rate ?? null }));
    return clone(paginate(sortBy(rows, sort, dir), { page, pageSize }));
  },

  async options({ teamId, status } = {}) {
    if (!USE_MOCK) return api.get('/coach/players/options', { teamId, status });
    await delay(100);
    const db = getDb();
    const ids = myTeamIds(db);
    return clone(
      sortBy(db.players.filter((p) => ids.includes(p.team_id) && (!teamId || p.team_id === teamId) && (!status || p.status === status)), 'name').map((p) => ({
        id: p.id, name: p.name, team_id: p.team_id, position: p.position, jersey_number: p.jersey_number, photo: p.photo, status: p.status,
      })),
    );
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/coach/players/${id}`);
    await delay();
    const db = getDb();
    const player = db.players.find((p) => p.id === id);
    if (!player) throw new ApiError('errors.notFound', { status: 404 });
    assertMyTeam(db, player.team_id);
    const team = db.teams.find((t) => t.id === player.team_id);
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const appearances = db.matches
      .filter((m) => (m.status === 'completed' || m.status === 'live') && m.lineups)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({ match: m, line: matchPlayerLines(m, db.matchEvents, byId)[id] }))
      .filter((r) => r.line);

    const records = attendanceRecordsInScope(db, { playerId: id }).sort((a, b) => b.session.date.localeCompare(a.session.date));
    const weeks = {};
    records.forEach((r) => {
      const d = parseDate(r.session.date);
      (weeks[toISODate(addDays(d, -((d.getDay() + 6) % 7)))] ??= []).push(r);
    });

    return clone({
      ...withTeam(db, player),
      coach: team ? coachSummary(db, team.coach_id) : null,
      statistics: computePlayerStats(db).find((s) => s.player_id === id),
      performance_trend: appearances.slice(-12).map(({ match, line }) => ({
        match_id: match.id,
        date: match.date,
        opponent: teamSummary(db, match.home_team_id === player.team_id ? match.away_team_id : match.home_team_id),
        rating: line.rating,
        goals: line.goals,
        assists: line.assists,
        minutes: line.minutes,
      })),
      attendance: {
        ...summarizeAttendance(records),
        trend: Object.keys(weeks).sort().slice(-10).map((week) => ({ week, rate: summarizeAttendance(weeks[week]).rate })),
        recent: records.slice(0, 8).map((r) => ({ id: r.id, status: r.status, notes: r.notes, date: r.session.date, training_type: r.session.training_type, session_id: r.session.id })),
      },
      recent_matches: appearances.slice(-6).reverse().map(({ match, line }) => ({ match: enrichMatch(db, match), line })),
    });
  },
};
