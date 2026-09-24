import { addDays, parseDate, toISODate, todayISO } from '@/utils/format';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { sortBy } from './mock/query';
import { enrichMatch, enrichSession, playerSummary, teamSummary } from './mock/relations';
import { currentCoach, involvesMyTeam } from './mock/scope';
import { attendanceRecordsInScope, computePlayerStats, computeTeamRecords, summarizeAttendance } from './mock/statsEngine';

/** Result from one team's point of view. */
export function perspective(match, teamId) {
  const home = match.home_team_id === teamId;
  const gf = home ? match.home_score : match.away_score;
  const ga = home ? match.away_score : match.home_score;
  return { home, gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D' };
}

export const coachService = {
  /** Everything the coach dashboard needs in one call (GET /coach/dashboard). */
  async dashboard() {
    if (!USE_MOCK) return api.get('/coach/dashboard');
    await delay(500);
    const db = getDb();
    const coach = currentCoach(db);
    const teamIds = coach.team_ids;
    const today = todayISO();
    const mine = (m) => involvesMyTeam(db, m);
    const sessions = db.trainingSessions.filter((s) => teamIds.includes(s.team_id));
    const active = sessions.filter((s) => s.status !== 'cancelled');
    const players = db.players.filter((p) => teamIds.includes(p.team_id));
    const matches = db.matches.filter(mine);
    const league = db.competitions.find((c) => c.status === 'active' && c.type === 'league');
    const seasonScope = league ? { competitionId: league.id } : {};

    // Last 8 weeks of attendance for my teams
    const from = toISODate(addDays(new Date(), -56));
    const records = attendanceRecordsInScope(db, { from, to: today }).filter((r) => teamIds.includes(r.session.team_id));
    const weeks = {};
    records.forEach((r) => {
      const d = parseDate(r.session.date);
      const monday = toISODate(addDays(d, -((d.getDay() + 6) % 7)));
      ((weeks[monday] ??= {})[r.session.team_id] ??= []).push(r);
    });
    const attendanceTrend = Object.keys(weeks)
      .sort()
      .map((week) => ({ week, ...Object.fromEntries(Object.entries(weeks[week]).map(([tid, recs]) => [tid, summarizeAttendance(recs).rate])) }));

    const todaySchedule = [
      ...active.filter((s) => s.date === today).map((s) => ({ kind: 'training', time: s.start_time, end: s.end_time, item: enrichSession(db, s) })),
      ...matches.filter((m) => m.date === today && m.status !== 'cancelled').map((m) => ({ kind: 'match', time: m.time, item: enrichMatch(db, m) })),
    ].sort((a, b) => a.time.localeCompare(b.time));

    const live = matches.find((m) => m.status === 'live');
    const nextScheduled = sortBy(matches.filter((m) => m.status === 'scheduled' && m.date >= today), 'date').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
    const nextMatch = live ?? nextScheduled ?? null;

    const recentResults = sortBy(matches.filter((m) => m.status === 'completed'), 'date', 'desc')
      .slice(0, 5)
      .map((m) => {
        const teamId = teamIds.includes(m.home_team_id) ? m.home_team_id : m.away_team_id;
        const p = perspective(m, teamId);
        return { ...enrichMatch(db, m), my_team: teamSummary(db, teamId), opponent: teamSummary(db, p.home ? m.away_team_id : m.home_team_id), ...p };
      });

    const stats = computePlayerStats(db, seasonScope).filter((s) => teamIds.includes(s.team_id) && s.matches_played > 0);
    const topPlayers = [...stats]
      .sort((a, b) => (b.rating ?? 0) + b.goals * 0.4 + b.assists * 0.25 - ((a.rating ?? 0) + a.goals * 0.4 + a.assists * 0.25))
      .slice(0, 6)
      .map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, s.team_id) }));

    const teamResults = computeTeamRecords(db, seasonScope)
      .filter((r) => teamIds.includes(r.team_id))
      .map((r) => ({ ...r, team: teamSummary(db, r.team_id) }));

    const completedSessions = active.filter((s) => s.date < today);
    const pendingRegisters = completedSessions
      .filter((s) => !db.attendance.some((a) => a.training_session_id === s.id))
      .map((s) => enrichSession(db, s));

    return clone({
      coach: { id: coach.id, name: coach.name, photo: coach.photo },
      teams: teamIds.map((id) => teamSummary(db, id)).filter(Boolean),
      season: league ? { id: league.id, name: league.name, season: league.season } : null,
      counts: {
        teams: teamIds.length,
        players: players.length,
        active_players: players.filter((p) => p.status === 'active').length,
        upcoming_matches: matches.filter((m) => m.status === 'scheduled' && m.date >= today).length,
        live_matches: matches.filter((m) => m.status === 'live').length,
        upcoming_training: active.filter((s) => s.date >= today).length,
        training_this_week: active.filter((s) => s.date >= today && s.date <= toISODate(addDays(new Date(), 7))).length,
        attendance_rate: summarizeAttendance(records).rate,
        active_competitions: db.competitions.filter((c) => c.status === 'active' && c.team_ids.some((t) => teamIds.includes(t))).length,
      },
      todaySchedule,
      nextMatch: nextMatch ? enrichMatch(db, nextMatch) : null,
      recentResults,
      attendance: {
        summary: summarizeAttendance(records),
        byTeam: teamIds.map((id) => ({ team: teamSummary(db, id), ...summarizeAttendance(records.filter((r) => r.session.team_id === id)) })),
      },
      attendanceTrend,
      topPlayers,
      teamResults,
      training: {
        completed: completedSessions.length,
        upcoming: active.filter((s) => s.date >= today).length,
        cancelled: sessions.filter((s) => s.status === 'cancelled').length,
        attendance_rate: summarizeAttendance(records).rate,
        pending: pendingRegisters,
        next: active
          .filter((s) => s.date >= today)
          .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
          .slice(0, 4)
          .map((s) => enrichSession(db, s)),
      },
    });
  },
};
