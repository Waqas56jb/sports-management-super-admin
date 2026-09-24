/**
 * Player data scope. The real API derives this from the auth token; the mock reads the session.
 * Every player service goes through these helpers so a player only ever reads their own data.
 */
import { ApiError } from '../apiClient';
import { authStorage } from '../authStorage';

export function currentPlayer(db) {
  const userId = authStorage.get()?.user?.id;
  const player = db.players.find((p) => p.user_id === userId);
  if (!player) {
    setTimeout(() => window.dispatchEvent(new CustomEvent('auth:expired')), 0);
    throw new ApiError('errors.sessionExpired', { status: 401 });
  }
  return player;
}

export const myTeamId = (db) => currentPlayer(db).team_id;

export const involvesMyTeam = (db, match) => {
  const id = myTeamId(db);
  return match.home_team_id === id || match.away_team_id === id;
};

export function forbidden() {
  return new ApiError('errors.forbidden', { status: 403 });
}
