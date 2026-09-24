/**
 * Players: admin management, the coach's (read-only, team-scoped) views, and the player's own
 * profile + dashboard. Identity always comes from the authenticated actor — never from the client.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { many, one, pool, query, withTransaction } from '../config/database.js';
import { forbidden, notFound } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { assertTeamAccess, isCoach, teamScope } from '../utils/permissions.js';
import { addDays, mondayOf, toISODate, todayISO } from '../utils/dates.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { summarizeLines, summarizeRecords } from '../utils/statistics.js';
import { audit, cleanSession, getEnrichedMatches, MATCH_SELECT, SESSION_SELECT, splitName, teamJson } from './shared.js';
import { attendanceGroups, computePlayerStats, playerMatchHistory } from './statisticsService.js';
import { assignPlayerToTeam } from './teamService.js';
import { notifyAdmins } from './notificationService.js';
import { resolveImageField } from './storageService.js';

const PLAYER_SORT = { name: 'vp.name', jersey_number: 'vp.jersey_number', position: 'vp.position', status: 'vp.status', registration_date: 'vp.registration_date', date_of_birth: 'vp.date_of_birth', created_at: 'vp.created_at', player_code: 'vp.player_code' };

export async function loadPlayer(id, client = pool) {
  const p = await one(`SELECT vp.*, ${teamJson('t')} AS team FROM v_players vp LEFT JOIN teams t ON t.id = vp.team_id WHERE vp.id = $1`, [id], client);
  if (!p) throw notFound('Player');
  return p;
}

function listFilter(actor, q) {
  const b = new SqlBuilder();
  const scope = teamScope(actor);
  if (scope) b.where('vp.team_id = ANY(?::uuid[])', scope);
  if (q.team_id === 'none') b.where('vp.team_id IS NULL');
  else b.whereIf(q.team_id, 'vp.team_id = ?', q.team_id);
  b.whereIf(q.position, 'vp.position = ?', q.position);
  b.whereIf(q.status, 'vp.status = ?', q.status);
  b.search(q.search, ['vp.name', 'vp.email', 'vp.jersey_number', 'vp.player_code']);
  return b;
}

// ------------------------------------------------------------------ lists

export async function list(actor, q = {}) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const b = listFilter(actor, q);
  const computedSort = ['rating', 'goals', 'attendance_rate'].includes(q.sortBy);
  const sort = PLAYER_SORT[q.sortBy] ?? 'vp.name';
  const dir = String(q.sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const params = [...b.params];
  const baseSql = `SELECT vp.*, ${teamJson('t')} AS team FROM v_players vp LEFT JOIN teams t ON t.id = vp.team_id ${b.clause}`;

  if (!isCoach(actor) && !computedSort) {
    const [rows, count] = await Promise.all([
      many(`${baseSql} ORDER BY ${sort} ${dir} NULLS LAST, vp.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
      one(`SELECT count(*)::int AS total FROM v_players vp ${b.clause}`, params),
    ]);
    return { rows, pagination: buildPagination(count.total, p) };
  }

  // Coach list shows rating / goals / attendance per player and may sort by them.
  const rows = await many(`${baseSql} ORDER BY ${sort} ${dir} NULLS LAST, vp.name`, params);
  const ids = rows.map((r) => r.id);
  const [stats, attendance] = await Promise.all([computePlayerStats({ playerIds: ids }), attendanceGroups({ groupBy: 'player', playerIds: ids })]);
  const byId = Object.fromEntries(stats.map((s) => [s.player_id, s]));
  let data = rows.map((r) => ({ ...r, rating: byId[r.id]?.rating ?? null, goals: byId[r.id]?.goals ?? 0, attendance_rate: attendance[r.id]?.rate ?? null }));
  if (computedSort) {
    const f = dir === 'DESC' ? -1 : 1;
    data = data.sort((a, b2) => {
      const av = a[q.sortBy];
      const bv = b2[q.sortBy];
      if (av === bv) return a.name.localeCompare(b2.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * f;
    });
  }
  const pagination = buildPagination(data.length, p);
  const start = (pagination.page - 1) * p.limit;
  return { rows: data.slice(start, start + p.limit), pagination };
}

export async function options(actor, q = {}) {
  const b = new SqlBuilder();
  const scope = teamScope(actor);
  if (scope) b.where('vp.team_id = ANY(?::uuid[])', scope);
  b.whereIf(q.team_id, 'vp.team_id = ?', q.team_id);
  b.whereIf(q.status, 'vp.status = ?', q.status);
  return many(`SELECT vp.id, vp.name, vp.team_id, vp.position, vp.jersey_number, vp.photo, vp.status FROM v_players vp ${b.clause} ORDER BY vp.name`, b.params);
}

// ------------------------------------------------------------------ detail (admin / coach)

export async function get(actor, id) {
  const player = await loadPlayer(id);
  if (isCoach(actor)) assertTeamAccess(actor, player.team_id);
  else if (actor.role === 'player' && actor.playerId !== id) throw forbidden('You can only view your own profile');

  const [coach, statsRows, attendanceRows, history] = await Promise.all([
    player.team_id
      ? one(`SELECT vc.id, vc.name, vc.photo, vc.license FROM v_teams t JOIN v_coaches vc ON vc.id = t.coach_id WHERE t.id = $1`, [player.team_id])
      : null,
    computePlayerStats({ playerIds: [id] }),
    many(
      `SELECT a.id, a.status, a.notes, s.date, s.training_type, s.id AS session_id FROM training_attendance a
       JOIN v_training_sessions s ON s.id = a.training_session_id WHERE a.player_id = $1 ORDER BY s.date DESC, s.start_time DESC`,
      [id],
    ),
    playerMatchHistory(id, {}),
  ]);
  const matchIds = history.map((h) => h.match.id);
  const matches = matchIds.length ? await getEnrichedMatches(`WHERE m.id = ANY($1::uuid[])`, [matchIds], pool, { details: false }) : [];
  const enriched = Object.fromEntries(matches.map((m) => [m.id, m]));
  const completed = history.filter((h) => h.match.status === 'completed');

  const result = {
    ...player,
    coach,
    statistics: statsRows[0] ?? null,
    attendance: { ...summarizeRecords(attendanceRows), recent: attendanceRows.slice(0, 8) },
    recent_matches: (isCoach(actor) ? history : completed)
      .slice(-6)
      .reverse()
      .map((h) => ({ match: enriched[h.match.id], line: h.line })),
  };
  if (isCoach(actor)) {
    const weeks = {};
    attendanceRows.forEach((r) => {
      (weeks[mondayOf(r.date)] ??= []).push(r);
    });
    result.performance_trend = history.slice(-12).map(({ match, line }) => ({
      match_id: match.id,
      date: match.date,
      opponent: enriched[match.id]?.[match.home_team_id === player.team_id ? 'away_team' : 'home_team'] ?? null,
      rating: line.rating,
      goals: line.goals,
      assists: line.assists,
      minutes: line.minutes,
    }));
    result.attendance.trend = Object.keys(weeks).sort().slice(-10).map((week) => ({ week, rate: summarizeRecords(weeks[week]).rate }));
  }
  return result;
}

/** GET /players/:id/statistics — aggregate statistics with season / competition / date filters. */
export async function statistics(actor, id, q = {}) {
  const player = await loadPlayer(id);
  if (isCoach(actor)) assertTeamAccess(actor, player.team_id);
  if (actor.role === 'player' && actor.playerId !== id) throw forbidden('You can only view your own statistics');
  const history = await playerMatchHistory(id, { season: q.season, competitionId: q.competition_id, from: q.date_from, to: q.date_to, includeLive: false });
  const totals = summarizeLines(history.map((h) => h.line));
  return {
    player_id: id,
    matches: totals.matches_played,
    starts: totals.starts,
    minutes: totals.minutes_played,
    goals: totals.goals,
    assists: totals.assists,
    shots: totals.shots,
    shots_on_target: totals.shots_on_target,
    passes: totals.passes,
    completed_passes: totals.completed_passes,
    pass_accuracy: totals.pass_accuracy,
    fouls: totals.fouls,
    yellow_cards: totals.yellow_cards,
    red_cards: totals.red_cards,
    average_rating: totals.average_rating,
  };
}

/** GET /players/:id/attendance — register lines for one player. */
export async function attendance(actor, id, q = {}) {
  const player = await loadPlayer(id);
  if (isCoach(actor)) assertTeamAccess(actor, player.team_id);
  const b = new SqlBuilder();
  b.where('a.player_id = ?', id);
  b.whereIf(q.status, 'a.status = ?', q.status);
  b.whereIf(q.date_from, 's.date >= ?', q.date_from);
  b.whereIf(q.date_to, 's.date <= ?', q.date_to);
  const rows = await many(
    `SELECT a.id, a.status, a.notes, a.marked_at, s.id AS session_id, s.date, s.start_time, s.training_type, s.team_id
     FROM training_attendance a JOIN v_training_sessions s ON s.id = a.training_session_id ${b.clause} ORDER BY s.date DESC`,
    b.params,
  );
  return { summary: summarizeRecords(rows), records: rows };
}

// ------------------------------------------------------------------ admin writes

async function nextPlayerCode(client) {
  const row = await one(`SELECT coalesce(max(substring(player_code FROM 2)::int), 0) + 1 AS n FROM players WHERE player_code ~ '^P[0-9]+$'`, [], client);
  return `P${String(row.n).padStart(3, '0')}`;
}

const PROFILE_FIELDS = ['date_of_birth', 'gender', 'nationality', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation', 'jersey_number', 'position', 'secondary_position', 'preferred_foot', 'height', 'weight', 'status', 'registration_date', 'license_number', 'license_valid_until'];

export async function create(actor, data) {
  const id = await withTransaction(async (client) => {
    const photo = await resolveImageField(data.photo, 'players');
    // No password is chosen by the admin: the account gets an unusable random hash and the player
    // sets a password through "forgot password".
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), env.bcryptRounds);
    const { first_name, last_name } = splitName(data.name);
    const user = await one(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, avatar_url, role, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'player', $7, $8, $8) RETURNING id`,
      [data.email, hash, first_name, last_name, data.phone ?? '', photo ?? null, data.status === 'suspended' ? 'suspended' : data.status === 'inactive' ? 'inactive' : 'active', actor.userId],
      client,
    );
    const cols = PROFILE_FIELDS.filter((k) => data[k] !== undefined);
    const player = await one(
      `INSERT INTO players (user_id, player_code, ${cols.join(', ')}${cols.length ? ', ' : ''}created_by, updated_by)
       VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}${cols.length ? ', ' : ''}$${cols.length + 3}, $${cols.length + 3}) RETURNING id`,
      [user.id, await nextPlayerCode(client), ...cols.map((k) => data[k]), actor.userId],
      client,
    );
    if (data.team_id) {
      // Validate the shirt number before assigning (assignPlayerToTeam would silently clear it).
      await query(`UPDATE players SET team_id = $2 WHERE id = $1`, [player.id, data.team_id], client);
      await query(`INSERT INTO team_players (team_id, player_id, joined_at, created_by) VALUES ($1, $2, $3, $4)`, [data.team_id, player.id, data.registration_date ?? todayISO(), actor.userId], client);
    }
    const team = data.team_id ? await one(`SELECT name FROM teams WHERE id = $1`, [data.team_id], client) : null;
    await notifyAdmins(client, {
      subtype: 'account_update',
      template: 'player_registered',
      params: { name: data.name, team: team?.name ?? '—' },
      fallback: { title: 'New player registered', message: `${data.name} has been registered${team ? ` with ${team.name}` : ''}.` },
      referenceType: 'player',
      referenceId: player.id,
    });
    await audit(client, actor, 'player.created', 'player', player.id, { name: data.name, team_id: data.team_id ?? null });
    return player.id;
  });
  return loadPlayer(id);
}

export async function update(actor, id, data) {
  const current = await loadPlayer(id);
  await withTransaction(async (client) => {
    const photo = await resolveImageField(data.photo, 'players');
    const userCols = {};
    if (data.name !== undefined) Object.assign(userCols, splitName(data.name));
    if (data.email !== undefined) userCols.email = data.email;
    if (data.phone !== undefined) userCols.phone = data.phone;
    if (photo !== undefined) userCols.avatar_url = photo;
    if (data.status !== undefined) userCols.status = data.status === 'pending' ? 'pending' : data.status;
    const uKeys = Object.keys(userCols);
    if (uKeys.length) {
      await query(`UPDATE users SET ${uKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${uKeys.length + 2} WHERE id = $1`, [current.user_id, ...uKeys.map((k) => userCols[k]), actor.userId], client);
    }
    const cols = PROFILE_FIELDS.filter((k) => data[k] !== undefined);
    if (cols.length) {
      await query(`UPDATE players SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [id, ...cols.map((k) => data[k]), actor.userId], client);
    }
    if (data.team_id !== undefined && (data.team_id || null) !== (current.team_id ?? null)) {
      await assignPlayerToTeam(client, actor, id, data.team_id || null);
      // An explicit shirt number in the same request wins over the automatic clearing.
      if (data.jersey_number !== undefined) await query(`UPDATE players SET jersey_number = $2 WHERE id = $1`, [id, data.jersey_number], client);
    }
    if (data.status === 'suspended' && current.status !== 'suspended') {
      await notifyAdmins(client, { subtype: 'team_announcement', template: 'player_suspended', params: { name: data.name ?? current.name }, fallback: { title: 'Player suspended', message: `${data.name ?? current.name} is suspended.` }, referenceType: 'player', referenceId: id });
    }
    await audit(client, actor, 'player.updated', 'player', id, { ...data, photo: data.photo === undefined ? undefined : '[image]' });
  });
  return loadPlayer(id);
}

/** Soft delete: the account is closed but match / attendance history is kept. */
export async function remove(actor, id) {
  const p = await loadPlayer(id);
  await withTransaction(async (client) => {
    await query(`UPDATE team_players SET left_at = GREATEST($2::date, joined_at), status = 'left' WHERE player_id = $1 AND left_at IS NULL`, [id, todayISO()], client);
    await query(`UPDATE players SET deleted_at = now(), status = 'inactive', updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await query(`UPDATE users SET deleted_at = now(), status = 'inactive', updated_by = $2 WHERE id = $1`, [p.user_id, actor.userId], client);
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [p.user_id], client);
    await audit(client, actor, 'player.deleted', 'player', id, { name: p.name });
  });
  return { ok: true };
}

// ------------------------------------------------------------------ player space

function identity(p, coach) {
  return {
    id: p.id,
    player_code: p.player_code,
    name: p.name,
    photo: p.photo,
    position: p.position,
    jersey_number: p.jersey_number,
    status: p.status,
    team: p.team,
    coach,
  };
}

async function teamCoaches(teamId) {
  if (!teamId) return { coach: null, assistant: null };
  const t = await one(
    `SELECT vc1.id AS coach_id, vc1.name AS coach_name, vc2.id AS assistant_id, vc2.name AS assistant_name
     FROM v_teams t LEFT JOIN v_coaches vc1 ON vc1.id = t.coach_id LEFT JOIN v_coaches vc2 ON vc2.id = t.assistant_coach_id WHERE t.id = $1`,
    [teamId],
  );
  return {
    coach: t?.coach_id ? { id: t.coach_id, name: t.coach_name } : null,
    assistant: t?.assistant_id ? { id: t.assistant_id, name: t.assistant_name } : null,
  };
}

export async function me(actor) {
  const p = await loadPlayer(actor.playerId);
  const { coach } = await teamCoaches(p.team_id);
  return identity(p, coach);
}

/** Full own profile (personal + sporting information). */
export async function myProfile(actor) {
  const p = await loadPlayer(actor.playerId);
  const { coach, assistant } = await teamCoaches(p.team_id);
  return {
    ...p,
    ...identity(p, coach),
    assistant_coach: assistant,
    license_valid: p.license_valid_until ? p.license_valid_until >= todayISO() : false,
  };
}

/** Players may only change their contact details, address, photo and emergency contact. */
export async function updateMyProfile(actor, data) {
  const p = await loadPlayer(actor.playerId);
  await withTransaction(async (client) => {
    const photo = await resolveImageField(data.photo, 'players');
    const user = {};
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (photo !== undefined) user.avatar_url = photo;
    const uKeys = Object.keys(user);
    if (uKeys.length) await query(`UPDATE users SET ${uKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $1 WHERE id = $1`, [actor.userId, ...uKeys.map((k) => user[k])], client);
    const cols = ['address', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'].filter((k) => data[k] !== undefined);
    if (cols.length) await query(`UPDATE players SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [p.id, ...cols.map((k) => data[k]), actor.userId], client);
    await audit(client, actor, 'player.profile_updated', 'player', p.id, { fields: [...uKeys, ...cols] });
  });
  return myProfile(actor);
}

export async function sessionWithMyAttendance(sessions, playerId, client = pool) {
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const rows = await many(`SELECT training_session_id, status, notes FROM training_attendance WHERE player_id = $1 AND training_session_id = ANY($2::uuid[])`, [playerId, ids], client);
  const mine = Object.fromEntries(rows.map((r) => [r.training_session_id, r]));
  return sessions.map((s) => {
    const { notes: _coachNotes, ...publicSession } = s; // coach notes stay private
    const r = mine[s.id];
    return { ...publicSession, my_attendance: s.status === 'cancelled' ? null : r ? { status: r.status, notes: r.notes } : { status: 'pending', notes: '' } };
  });
}

export async function dashboard(actor) {
  const p = await loadPlayer(actor.playerId);
  const teamId = p.team_id;
  const today = todayISO();
  const horizon = toISODate(addDays(new Date(), 14));
  const league = await one(`SELECT id, name, season FROM v_competitions WHERE status = 'active' AND type = 'league' ORDER BY start_date DESC LIMIT 1`);

  const [{ coach }, history, allHistory, attendanceRows, nextMatch, sessions, recentMatches, scheduleSessions, scheduleMatches, events, competitions] = await Promise.all([
    teamCoaches(teamId),
    playerMatchHistory(p.id, league ? { competitionId: league.id } : {}),
    playerMatchHistory(p.id, {}),
    many(`SELECT a.status FROM training_attendance a JOIN training_sessions s ON s.id = a.training_session_id AND s.deleted_at IS NULL WHERE a.player_id = $1`, [p.id]),
    teamId ? many(`${MATCH_SELECT} WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND (m.status = 'live' OR (m.status = 'scheduled' AND m.date >= $2)) ORDER BY (m.status = 'live') DESC, m.date, m.time LIMIT 1`, [teamId, today]) : [],
    teamId ? many(`${SESSION_SELECT} WHERE s.team_id = $1 AND s.date >= $2 ORDER BY s.date, s.start_time LIMIT 4`, [teamId, today]) : [],
    teamId ? many(`${MATCH_SELECT} WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = 'completed' ORDER BY m.date DESC, m.time DESC LIMIT 5`, [teamId]) : [],
    teamId ? many(`${SESSION_SELECT} WHERE s.team_id = $1 AND s.date BETWEEN $2 AND $3`, [teamId, today, horizon]) : [],
    teamId ? many(`${MATCH_SELECT} WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.date BETWEEN $2 AND $3 AND m.status <> 'completed'`, [teamId, today, horizon]) : [],
    teamId ? many(`SELECT id, team_id, kind, title, date, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end", location FROM team_events WHERE team_id = $1 AND date BETWEEN $2 AND $3`, [teamId, today, horizon]) : [],
    teamId ? many(`SELECT * FROM v_competitions WHERE $1 = ANY(team_ids) AND ((start_date BETWEEN $2 AND $3) OR (end_date BETWEEN $2 AND $3))`, [teamId, today, horizon]) : [],
  ]);

  const byMatch = Object.fromEntries(allHistory.map((h) => [h.match.id, h.line]));
  const recent = recentMatches.map((m) => {
    const home = m.home_team_id === teamId;
    const gf = home ? m.home_score : m.away_score;
    const ga = home ? m.away_score : m.home_score;
    return { match: m, opponent: home ? m.away_team : m.home_team, gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', line: byMatch[m.id] ?? null };
  });

  const schedule = [
    ...scheduleSessions.map((s) => ({ kind: 'training', date: s.date, time: s.start_time, id: s.id, cancelled: s.status === 'cancelled', item: cleanSession({ ...s, notes: undefined }) })),
    ...scheduleMatches.map((m) => ({ kind: 'match', date: m.date, time: m.time, id: m.id, cancelled: m.status === 'cancelled', item: m })),
    ...events.map((e) => ({ kind: 'event', date: e.date, time: e.start, id: e.id, item: e })),
    ...competitions.flatMap((c) =>
      [
        c.start_date >= today && c.start_date <= horizon && { kind: 'competition', date: c.start_date, time: '00:00', id: `${c.id}-s`, item: { ...c, edge: 'start' } },
        c.end_date >= today && c.end_date <= horizon && { kind: 'competition', date: c.end_date, time: '00:00', id: `${c.id}-e`, item: { ...c, edge: 'end' } },
      ].filter(Boolean),
    ),
  ].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const allMatchIds = history.map((h) => h.match.id);
  const opponents = allMatchIds.length ? await getEnrichedMatches(`WHERE m.id = ANY($1::uuid[])`, [allMatchIds], pool, { details: false }) : [];
  const oppById = Object.fromEntries(opponents.map((m) => [m.id, m.home_team_id === teamId ? m.away_team : m.home_team]));

  return {
    player: identity(p, coach),
    season: league,
    stats: summarizeLines(history.map((h) => h.line)),
    attendance: summarizeRecords(attendanceRows),
    nextMatch: nextMatch[0] ?? null,
    upcomingSessions: await sessionWithMyAttendance(sessions, p.id),
    recent,
    schedule: schedule.slice(0, 8),
    series: history.map(({ match, line }) => ({
      match_id: match.id,
      date: match.date,
      opponent: oppById[match.id] ?? null,
      goals: line.goals,
      assists: line.assists,
      minutes: line.minutes,
      rating: line.rating,
    })),
  };
}

