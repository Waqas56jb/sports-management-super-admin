/**
 * Coach data scope. The real API derives this from the auth token; the mock reads the session.
 * Every coach service goes through these helpers so a coach can never read another team's data.
 */
import { ApiError } from '../apiClient';
import { authStorage } from '../authStorage';

export function currentCoach(db) {
  const userId = authStorage.get()?.user?.id;
  const coach = db.coaches.find((c) => c.user_id === userId);
  if (!coach) {
    // Same behaviour as a 401 from the real API: the app signs out and explains why.
    setTimeout(() => window.dispatchEvent(new CustomEvent('auth:expired')), 0);
    throw new ApiError('errors.sessionExpired', { status: 401 });
  }
  return coach;
}

export const myTeamIds = (db) => currentCoach(db).team_ids;

export const isMyTeam = (db, teamId) => myTeamIds(db).includes(teamId);

export const involvesMyTeam = (db, match) => {
  const ids = myTeamIds(db);
  return ids.includes(match.home_team_id) || ids.includes(match.away_team_id);
};

export function assertMyTeam(db, teamId) {
  if (!isMyTeam(db, teamId)) throw new ApiError('errors.forbidden', { status: 403 });
}
