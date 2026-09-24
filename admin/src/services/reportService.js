import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { inDateRange, sortBy } from './mock/query';
import { competitionSummary, playerSummary, teamSummary } from './mock/relations';
import { attendanceRecordsInScope, computePlayerStats, computeTeamRecords, summarizeAttendance } from './mock/statsEngine';

export const REPORT_TYPES = ['players', 'teams', 'matches', 'attendance', 'competitions', 'performance'];

/**
 * Report rows are returned as raw values; the UI owns labels/formatting so exports follow the
 * selected language. The real API exposes the same resource at GET /reports/:type.
 */
export const reportService = {
  async generate(type, { from, to, teamId, competitionId, season } = {}) {
    if (!USE_MOCK) return api.get(`/reports/${type}`, { from, to, teamId, competitionId, season });
    await delay(550);
    const db = getDb();
    const compById = Object.fromEntries(db.competitions.map((c) => [c.id, c]));
    const scope = { competitionId, season, from, to };
    let rows = [];

    if (type === 'players') {
      const stats = Object.fromEntries(computePlayerStats(db, scope).map((s) => [s.player_id, s]));
      rows = sortBy(
        db.players.filter((p) => (!teamId || p.team_id === teamId) && inDateRange(p.registration_date, undefined, to)),
        'name',
      ).map((p) => ({ ...p, team: teamSummary(db, p.team_id), statistics: stats[p.id] }));
    }

    if (type === 'teams') {
      const records = Object.fromEntries(computeTeamRecords(db, scope).map((r) => [r.team_id, r]));
      rows = db.teams
        .filter((t) => !teamId || t.id === teamId)
        .map((t) => ({
          ...t,
          coach: db.coaches.find((c) => c.id === t.coach_id)?.name ?? null,
          players_count: db.players.filter((p) => p.team_id === t.id).length,
          record: records[t.id],
          attendance_rate: summarizeAttendance(attendanceRecordsInScope(db, { teamId: t.id, from, to })).rate,
        }));
    }

    if (type === 'matches') {
      rows = sortBy(
        db.matches.filter(
          (m) =>
            (!teamId || m.home_team_id === teamId || m.away_team_id === teamId) &&
            (!competitionId || m.competition_id === competitionId) &&
            (!season || compById[m.competition_id]?.season === season) &&
            inDateRange(m.date, from, to),
        ),
        'date',
        'desc',
      ).map((m) => ({ ...m, home_team: teamSummary(db, m.home_team_id), away_team: teamSummary(db, m.away_team_id), competition: competitionSummary(db, m.competition_id) }));
    }

    if (type === 'attendance') {
      const records = attendanceRecordsInScope(db, { teamId, from, to });
      const byPlayer = {};
      records.forEach((r) => {
        (byPlayer[r.player_id] ??= []).push(r);
      });
      rows = Object.entries(byPlayer)
        .map(([id, recs]) => {
          const player = playerSummary(db, id);
          return { player, team: teamSummary(db, player?.team_id), ...summarizeAttendance(recs) };
        })
        .filter((r) => r.player)
        .sort((a, b) => a.player.name.localeCompare(b.player.name));
    }

    if (type === 'competitions') {
      rows = sortBy(
        db.competitions.filter(
          (c) => (!competitionId || c.id === competitionId) && (!season || c.season === season) && (!teamId || c.team_ids.includes(teamId)) && (!from || c.end_date >= from) && (!to || c.start_date <= to),
        ),
        'start_date',
        'desc',
      ).map((c) => {
        const matches = db.matches.filter((m) => m.competition_id === c.id);
        const played = matches.filter((m) => m.status === 'completed');
        return {
          ...c,
          teams_count: c.team_ids.length,
          matches_total: matches.length,
          matches_played: played.length,
          goals: played.reduce((s, m) => s + m.home_score + m.away_score, 0),
        };
      });
    }

    if (type === 'performance') {
      rows = sortBy(
        computePlayerStats(db, scope)
          .filter((s) => s.matches_played > 0 && (!teamId || s.team_id === teamId))
          .map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, s.team_id) })),
        'rating',
        'desc',
      );
    }

    return clone({ type, rows, generated_at: new Date().toISOString() });
  },
};
