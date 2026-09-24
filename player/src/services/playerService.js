import { addDays, toISODate, todayISO } from '@/utils/formatters';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { enrichMatch, enrichSession, teamSummary } from './mock/relations';
import { currentPlayer, involvesMyTeam } from './mock/scope';
import { attendanceRecordsInScope, playerMatchHistory, summarizeAttendance, summarizeLines } from './mock/statsEngine';

const coachName = (db, id) => db.coaches.find((c) => c.id === id)?.name ?? null;

/** Public card of the player (header, dashboard hero). */
function identity(db, p) {
  const team = db.teams.find((t) => t.id === p.team_id);
  return {
    id: p.id,
    player_code: p.player_code,
    name: p.name,
    photo: p.photo,
    position: p.position,
    jersey_number: p.jersey_number,
    status: p.status,
    team: teamSummary(db, p.team_id),
    coach: team ? { id: team.coach_id, name: coachName(db, team.coach_id) } : null,
  };
}

export function sessionWithMyAttendance(db, session, playerId) {
  const record = db.attendance.find((a) => a.training_session_id === session.id && a.player_id === playerId);
  return {
    ...enrichSession(db, session),
    coach_name: coachName(db, session.coach_id),
    my_attendance: session.status === 'cancelled' ? null : record ? { status: record.status, notes: record.notes } : { status: 'pending', notes: '' },
  };
}

export const playerService = {
  /** Lightweight identity of the signed-in player. */
  async getCurrentPlayer() {
    if (!USE_MOCK) return api.get('/player/me');
    await delay(150);
    const db = getDb();
    return clone(identity(db, currentPlayer(db)));
  },

  /** Full profile: personal + sports information (only the player's own record). */
  async getPlayerProfile() {
    if (!USE_MOCK) return api.get('/player/me/profile');
    await delay();
    const db = getDb();
    const p = currentPlayer(db);
    const team = db.teams.find((t) => t.id === p.team_id);
    return clone({
      ...p,
      ...identity(db, p),
      assistant_coach: team?.assistant_coach_id ? { id: team.assistant_coach_id, name: coachName(db, team.assistant_coach_id) } : null,
      license_valid: p.license_valid_until >= todayISO(),
    });
  },

  /** Public information about a teammate — no contact details or private data. */
  async getTeammate(id) {
    if (!USE_MOCK) return api.get(`/player/teammates/${id}`);
    await delay(200);
    const db = getDb();
    const me = currentPlayer(db);
    const p = db.players.find((x) => x.id === id);
    if (!p) throw new ApiError('errors.notFound', { status: 404 });
    if (p.team_id !== me.team_id) throw new ApiError('errors.forbidden', { status: 403 });
    const season = summarizeLines(playerMatchHistory(db, id, { competitionId: 'k1' }).map((h) => h.line));
    return clone({
      id: p.id, name: p.name, photo: p.photo, jersey_number: p.jersey_number, position: p.position, secondary_position: p.secondary_position,
      preferred_foot: p.preferred_foot, nationality: p.nationality, status: p.status, team: teamSummary(db, p.team_id),
      season: { matches_played: season.matches_played, goals: season.goals, assists: season.assists },
    });
  },

  /** Everything on the dashboard in one call (GET /player/dashboard). */
  async getDashboard() {
    if (!USE_MOCK) return api.get('/player/dashboard');
    await delay(450);
    const db = getDb();
    const p = currentPlayer(db);
    const today = todayISO();
    const league = db.competitions.find((c) => c.status === 'active' && c.type === 'league');
    const seasonScope = league ? { competitionId: league.id } : {};
    const history = playerMatchHistory(db, p.id, seasonScope);
    const stats = summarizeLines(history.map((h) => h.line));
    const records = attendanceRecordsInScope(db, { playerId: p.id });
    const attendance = summarizeAttendance(records);
    const matches = db.matches.filter((m) => involvesMyTeam(db, m));
    const live = matches.find((m) => m.status === 'live');
    const next = live ?? matches.filter((m) => m.status === 'scheduled' && m.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
    const sessions = db.trainingSessions.filter((s) => s.team_id === p.team_id);
    const upcomingSessions = sessions
      .filter((s) => s.date >= today)
      .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
      .slice(0, 4)
      .map((s) => sessionWithMyAttendance(db, s, p.id));

    // Participation in recent completed matches of my team (including matches I did not play)
    const byMatch = Object.fromEntries(playerMatchHistory(db, p.id).map((h) => [h.match.id, h.line]));
    const recent = matches
      .filter((m) => m.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((m) => {
        const home = m.home_team_id === p.team_id;
        const gf = home ? m.home_score : m.away_score;
        const ga = home ? m.away_score : m.home_score;
        return { match: enrichMatch(db, m), opponent: teamSummary(db, home ? m.away_team_id : m.home_team_id), gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', line: byMatch[m.id] ?? null };
      });

    // Upcoming schedule: next 14 days of training, matches, team events and competition dates
    const horizon = toISODate(addDays(new Date(), 14));
    const schedule = [
      ...sessions.filter((s) => s.date >= today && s.date <= horizon).map((s) => ({ kind: 'training', date: s.date, time: s.start_time, id: s.id, cancelled: s.status === 'cancelled', item: enrichSession(db, s) })),
      ...matches.filter((m) => m.date >= today && m.date <= horizon && m.status !== 'completed').map((m) => ({ kind: 'match', date: m.date, time: m.time, id: m.id, cancelled: m.status === 'cancelled', item: enrichMatch(db, m) })),
      ...db.teamEvents.filter((e) => e.team_id === p.team_id && e.date >= today && e.date <= horizon).map((e) => ({ kind: 'event', date: e.date, time: e.start, id: e.id, item: e })),
      ...db.competitions
        .filter((c) => c.team_ids.includes(p.team_id))
        .flatMap((c) => [
          c.start_date >= today && c.start_date <= horizon && { kind: 'competition', date: c.start_date, time: '00:00', id: `${c.id}-s`, item: { ...c, edge: 'start' } },
          c.end_date >= today && c.end_date <= horizon && { kind: 'competition', date: c.end_date, time: '00:00', id: `${c.id}-e`, item: { ...c, edge: 'end' } },
        ])
        .filter(Boolean),
    ].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    return clone({
      player: identity(db, p),
      season: league ? { id: league.id, name: league.name, season: league.season } : null,
      stats,
      attendance,
      nextMatch: next ? enrichMatch(db, next) : null,
      upcomingSessions,
      recent,
      schedule: schedule.slice(0, 8),
      series: history.map(({ match, line }) => ({
        match_id: match.id,
        date: match.date,
        opponent: teamSummary(db, match.home_team_id === p.team_id ? match.away_team_id : match.home_team_id),
        goals: line.goals,
        assists: line.assists,
        minutes: line.minutes,
        rating: line.rating,
      })),
    });
  },
};
