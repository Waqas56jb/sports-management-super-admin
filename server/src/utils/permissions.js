/**
 * Central permission model. Routes declare WHAT they need (requirePermission('training:write'));
 * services enforce WHICH records the actor may touch (assertTeamAccess, teamScope…).
 *
 * The actor is resolved server-side from the JWT session on every request — a client-supplied
 * teamId / playerId is never trusted on its own.
 */
import { forbidden } from './errors.js';

export const PERMISSIONS = {
  'users:manage': ['admin'],
  'players:manage': ['admin'],
  'players:read': ['admin', 'coach'],
  'coaches:manage': ['admin'],
  'coaches:read': ['admin'],
  'teams:manage': ['admin'],
  'teams:read': ['admin', 'coach', 'player'],
  'competitions:manage': ['admin'],
  'competitions:read': ['admin', 'coach', 'player'],
  'matches:manage': ['admin'],
  'matches:read': ['admin', 'coach', 'player'],
  'matches:operate': ['admin', 'coach'], // line-ups, events, live status, team statistics
  'training:write': ['admin', 'coach'],
  'training:delete': ['admin'],
  'training:read': ['admin', 'coach', 'player'],
  'attendance:write': ['admin', 'coach'],
  'attendance:read': ['admin', 'coach'],
  'statistics:read': ['admin', 'coach', 'player'],
  'reports:read': ['admin', 'coach'],
  'notifications:broadcast': ['admin'],
  'calendar:read': ['admin', 'coach', 'player'],
  'uploads:team-logo': ['admin'],
  'dashboard:admin': ['admin'],
  'dashboard:coach': ['coach'],
  'dashboard:player': ['player'],
};

export const can = (actor, permission) => Boolean(actor && PERMISSIONS[permission]?.includes(actor.role));

export const isAdmin = (actor) => actor?.role === 'admin';
export const isCoach = (actor) => actor?.role === 'coach';
export const isPlayer = (actor) => actor?.role === 'player';

/**
 * Team ids the actor is limited to: null = unrestricted (admin), [] = nothing.
 * Coaches see their head-coach and assistant teams; players see their own team.
 */
export function teamScope(actor) {
  if (isAdmin(actor)) return null;
  if (isCoach(actor)) return actor.teamIds ?? [];
  if (isPlayer(actor)) return actor.teamId ? [actor.teamId] : [];
  return [];
}

export function canAccessTeam(actor, teamId) {
  const scope = teamScope(actor);
  return scope === null || (Boolean(teamId) && scope.includes(teamId));
}

export function assertTeamAccess(actor, teamId) {
  if (!canAccessTeam(actor, teamId)) throw forbidden('You do not have access to this team');
}

export function canAccessMatch(actor, match) {
  const scope = teamScope(actor);
  return scope === null || scope.includes(match.home_team_id) || scope.includes(match.away_team_id);
}

export function assertMatchAccess(actor, match) {
  if (!canAccessMatch(actor, match)) throw forbidden('This match does not involve your team');
}

/** Competitions are visible to coaches/players only when one of their teams takes part. */
export function canAccessCompetition(actor, competition) {
  const scope = teamScope(actor);
  return scope === null || (competition.team_ids ?? []).some((t) => scope.includes(t));
}
