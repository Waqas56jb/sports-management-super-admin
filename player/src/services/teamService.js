import { todayISO } from '@/utils/formatters';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, sortBy } from './mock/query';
import { enrichMatch, teamSummary } from './mock/relations';
import { currentPlayer } from './mock/scope';
import { attendanceRecordsInScope, computeTeamRecords, standings, summarizeAttendance } from './mock/statsEngine';

const coach = (db, id) => {
  const c = db.coaches.find((x) => x.id === id);
  return c ? { id: c.id, name: c.name, photo: c.photo, license: c.license } : null;
};

export const teamService = {
  /** The player's own team with staff, record, standing and fixtures (GET /player/team). */
  async getMyTeam() {
    if (!USE_MOCK) return api.get('/player/team');
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const team = db.teams.find((t) => t.id === me.team_id);
    const today = todayISO();
    const league = db.competitions.find((c) => c.status === 'active' && c.type === 'league' && c.team_ids.includes(team.id));
    const table = league ? standings(db, league.id) : [];
    const position = table.findIndex((r) => r.team_id === team.id) + 1;
    const matches = db.matches.filter((m) => m.home_team_id === team.id || m.away_team_id === team.id);
    const seasonRecord = league ? computeTeamRecords(db, { competitionId: league.id }).find((r) => r.team_id === team.id) : null;
    return clone({
      ...team,
      coach: coach(db, team.coach_id),
      assistant_coach: coach(db, team.assistant_coach_id),
      competition: league ? { id: league.id, name: league.name, season: league.season, position: position || null, teams: table.length } : null,
      record: seasonRecord,
      all_time: computeTeamRecords(db).find((r) => r.team_id === team.id),
      attendance: summarizeAttendance(attendanceRecordsInScope(db, { teamId: team.id })),
      players_count: db.players.filter((p) => p.team_id === team.id).length,
      next_match: (() => {
        const m = matches.filter((x) => x.status === 'live' || (x.status === 'scheduled' && x.date >= today)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
        return m ? enrichMatch(db, m) : null;
      })(),
      recent_results: sortBy(matches.filter((m) => m.status === 'completed'), 'date', 'desc').slice(0, 5).map((m) => enrichMatch(db, m)),
    });
  },

  /** Teammates — public information only (no contact details, no private data). */
  async getRoster({ search, position } = {}) {
    if (!USE_MOCK) return api.get('/player/team/roster', { search, position });
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    return clone(
      sortBy(db.players.filter((p) => p.team_id === me.team_id && (!position || p.position === position) && matchesSearch(search, p.name, p.jersey_number)), 'jersey_number').map((p) => ({
        id: p.id,
        name: p.name,
        photo: p.photo,
        jersey_number: p.jersey_number,
        position: p.position,
        status: p.status,
        is_me: p.id === me.id,
        team: teamSummary(db, p.team_id),
      })),
    );
  },
};
