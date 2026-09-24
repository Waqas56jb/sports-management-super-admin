/**
 * Global search, scoped by role:
 *   admin  → players, coaches, teams, matches, competitions
 *   coach  → players, teams, matches, training, competitions of their teams
 *   player → matches, training, team (team + teammates' public names), competitions, own notifications
 */
import { many } from '../config/database.js';
import { TRAINING_LABELS } from '../config/constants.js';
import { likeEscape } from '../utils/filters.js';
import { isAdmin, isCoach, teamScope } from '../utils/permissions.js';
import { todayISO } from '../utils/dates.js';
import { cleanSession, MATCH_SELECT, SESSION_SELECT, teamJson } from './shared.js';
import { serializeNotification } from './notificationService.js';

const LIMIT = 5;

export async function search(actor, raw) {
  const q = String(raw ?? '').trim();
  const empty = isAdmin(actor)
    ? { players: [], coaches: [], teams: [], matches: [], competitions: [] }
    : isCoach(actor)
      ? { players: [], teams: [], matches: [], training: [], competitions: [] }
      : { matches: [], training: [], team: [], competitions: [], notifications: [] };
  if (q.length < 2) return empty;

  const like = `%${likeEscape(q)}%`;
  const scope = teamScope(actor);
  const today = todayISO();
  const trainingTypes = Object.entries(TRAINING_LABELS).filter(([, names]) => names.some((n) => n.toLowerCase().includes(q.toLowerCase()))).map(([k]) => k);
  const m = (col) => `unaccent_ci(coalesce(${col}::text, '')) LIKE unaccent_ci($1)`;

  const matches = () =>
    many(
      `${MATCH_SELECT} WHERE (${m('ht.name')} OR ${m('awt.name')} OR ${m("ht.name || ' ' || awt.name")} OR ${m('m.location')})
         AND ($2::uuid[] IS NULL OR m.home_team_id = ANY($2::uuid[]) OR m.away_team_id = ANY($2::uuid[]))
       ORDER BY abs(m.date - $3::date), m.date DESC LIMIT ${LIMIT}`,
      [like, scope, today],
    );
  const competitions = () =>
    many(
      `SELECT c.id, c.name, c.season, c.status, c.type FROM v_competitions c
       WHERE (${m('c.name')} OR ${m('c.season')} OR ${m('c.location')}) AND ($2::uuid[] IS NULL OR c.team_ids && $2::uuid[])
       ORDER BY c.start_date DESC LIMIT ${LIMIT}`,
      [like, scope],
    );
  const training = () =>
    many(
      `${SESSION_SELECT} WHERE s.team_id = ANY($2::uuid[])
         AND (${m('st.name')} OR ${m('s.location')} OR ${m('s.description')} ${isCoach(actor) ? `OR ${m('s.notes')}` : ''} OR s.training_type = ANY($3::text[]))
       ORDER BY (s.date >= $4) DESC, CASE WHEN s.date >= $4 THEN s.date - $4::date ELSE $4::date - s.date END LIMIT ${LIMIT}`,
      [like, scope, trainingTypes, today],
    );

  if (isAdmin(actor)) {
    const [players, coaches, teams, ms, comps] = await Promise.all([
      many(`SELECT vp.id, vp.name, vp.photo, vp.position, vp.jersey_number, ${teamJson('t')} AS team FROM v_players vp LEFT JOIN teams t ON t.id = vp.team_id
            WHERE ${m('vp.name')} OR ${m('vp.email')} OR ${m("'#' || vp.jersey_number")} OR ${m('vp.player_code')} ORDER BY vp.name LIMIT ${LIMIT}`, [like]),
      many(`SELECT vc.id, vc.name, vc.photo, vc.license, ${teamJson('t')} AS team FROM v_coaches vc LEFT JOIN teams t ON t.id = vc.team_id
            WHERE ${m('vc.name')} OR ${m('vc.email')} OR ${m('vc.license')} ORDER BY vc.name LIMIT ${LIMIT}`, [like]),
      many(`SELECT t.id, t.name, t.short_name, t.color, t.logo_url AS logo FROM teams t WHERE t.deleted_at IS NULL AND (${m('t.name')} OR ${m('t.short_name')}) ORDER BY t.name LIMIT ${LIMIT}`, [like]),
      matches(),
      competitions(),
    ]);
    return { players, coaches, teams, matches: ms, competitions: comps };
  }

  if (isCoach(actor)) {
    const [players, teams, ms, tr, comps] = await Promise.all([
      many(`SELECT vp.id, vp.name, vp.photo, vp.position, vp.jersey_number, ${teamJson('t')} AS team FROM v_players vp JOIN teams t ON t.id = vp.team_id
            WHERE vp.team_id = ANY($2::uuid[]) AND (${m('vp.name')} OR ${m('vp.email')} OR ${m("'#' || vp.jersey_number")}) ORDER BY vp.name LIMIT ${LIMIT}`, [like, scope]),
      many(`SELECT t.id, t.name, t.short_name, t.color, t.logo_url AS logo FROM teams t WHERE t.id = ANY($2::uuid[]) AND (${m('t.name')} OR ${m('t.short_name')}) LIMIT ${LIMIT}`, [like, scope]),
      matches(),
      training(),
      competitions(),
    ]);
    return { players, teams, matches: ms, training: tr.map(cleanSession), competitions: comps };
  }

  // Player
  const [team, mates, ms, tr, comps, notes] = await Promise.all([
    many(`SELECT t.id, t.name, t.short_name, t.color, t.logo_url AS logo FROM teams t WHERE t.id = $2 AND (${m('t.name')} OR ${m('t.short_name')} OR ${m('t.home_ground')})`, [like, actor.teamId]),
    many(`SELECT vp.id, vp.name, vp.photo, vp.jersey_number, vp.position FROM v_players vp WHERE vp.team_id = $2 AND (${m('vp.name')} OR ${m("'#' || vp.jersey_number")}) ORDER BY vp.jersey_number LIMIT ${LIMIT}`, [like, actor.teamId]),
    matches(),
    training(),
    competitions(),
    many(`SELECT * FROM notifications n WHERE n.user_id = $2 AND (${m('n.title')} OR ${m('n.message')} OR ${m('n.params')}) ORDER BY n.created_at DESC LIMIT ${LIMIT}`, [like, actor.userId]),
  ]);
  return {
    matches: ms,
    training: tr.map((s) => {
      const { notes: _n, ...rest } = cleanSession(s);
      return rest;
    }),
    team: [...team.map((t) => ({ kind: 'team', ...t })), ...mates.map((p) => ({ kind: 'teammate', ...p, is_me: p.id === actor.playerId }))].slice(0, LIMIT),
    competitions: comps,
    notifications: notes.map((n) => serializeNotification(n, 'player')),
  };
}
