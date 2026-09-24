/**
 * Development / demo seed.
 *
 *   npm run seed           insert the demo dataset (idempotent: existing rows are left untouched)
 *   npm run seed:reset     wipe all application data, then insert a fresh dataset dated from today
 *
 * Every record gets a deterministic UUID derived from its seed key, so running the seed twice never
 * creates duplicates. Player statistics, team statistics and standings are NOT seeded directly:
 * they are rebuilt by the same match engine the API uses (services/statisticsService.js).
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { many, pool, withTransaction } from '../../config/database.js';
import { NOTIFICATION_SUBTYPES } from '../../config/constants.js';
import { addDays, toISODate } from '../../utils/dates.js';
import { renderTemplate } from '../../utils/notificationTemplates.js';
import { recomputeMatch, recomputeStandings } from '../../services/statisticsService.js';
import { buildAttendance } from './data/attendanceData.js';
import { buildCompetitions } from './data/competitionData.js';
import { buildMatches } from './data/matchData.js';
import { buildPlayers, phoneNumber } from './data/playerData.js';
import { createRandom } from './data/random.js';
import { COACHES, TEAM_EVENTS, TEAMS } from './data/teamData.js';
import { buildTrainingSessions } from './data/trainingData.js';

// ------------------------------------------------------------------ deterministic ids

/** RFC 4122 v5-style UUID from a seed key (e.g. "team:t1"). */
function sid(key) {
  const hash = crypto.createHash('sha1').update(`sporthub-seed:${key}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const splitName = (name) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(' ') };
};

const CITY = { t1: 'Djibouti', t2: 'Balbala', t3: 'Arta', t4: 'Tadjourah' };
const COACH_NOTES = [
  'Good intensity overall. Pressing triggers still late on the left side.',
  'Several players carrying knocks — manage load before the weekend.',
  'Excellent finishing drill; keep the 3v2 overload exercise next week.',
  'Communication in the back line improved. Work on set-piece marking.',
  'Short session because of the heat; hydration protocol followed.',
  '',
];
const TRAINING_DESCRIPTIONS = {
  fitness: 'High-intensity interval work and sprint repeats. Hydration breaks every 15 minutes.',
  tactical: 'Defensive shape out of possession, pressing triggers and compactness between the lines.',
  technical: 'Rondos, passing patterns under pressure and finishing from wide areas.',
  recovery: 'Light jog, mobility circuit, stretching and pool session for starters from the weekend.',
  match_preparation: 'Set-piece rehearsal, opponent video review and final line-up walk-through.',
  other: 'Team building session and medical screening.',
};
const CANCEL_REASONS = {
  pitchUnavailable: 'Pitch unavailable — national team event at the venue',
  heatWarning: 'Extreme heat warning issued by the city',
  maintenance: 'Stadium maintenance',
};

// ------------------------------------------------------------------ dataset

export function buildDataset(now = new Date()) {
  const rng = createRandom(20260924);
  const day = (offset) => toISODate(addDays(now, offset));
  const stamp = (offset, hour = 9, minute = 0) => {
    const d = addDays(now, offset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const pastStamp = (offset, hour, minute) => {
    const iso = stamp(offset, hour, minute);
    return Date.parse(iso) > now.getTime() ? new Date(now.getTime() - (hour + 1) * 7 * 60000).toISOString() : iso;
  };

  const users = [
    { key: 'u1', name: 'Abdoulkader Mahamoud', email: 'admin@example.com', phone: '+253 77 12 34 56', role: 'admin', created_at: stamp(-720), last_login_at: pastStamp(0, 8, 12) },
    { key: 'u2', name: 'Fatouma Ahmed Ali', email: 'f.ahmed@sporthub.dj', phone: '+253 77 45 21 90', role: 'admin', created_at: stamp(-540), last_login_at: stamp(-1, 17, 40) },
  ];

  const teams = TEAMS.map((t, i) => ({
    ...t,
    color: i,
    coach_id: COACHES.find((c) => c.team_ids.includes(t.id))?.id ?? null,
    created_at: stamp(-700 + i * 5),
  }));

  // Same order of random draws as the frontends' demo data, so names and results match.
  const mockUsers = [];
  const coaches = COACHES.map((c, i) => {
    const [first, ...rest] = c.name.split(' ');
    const email = c.email ?? `${slug(first)}.${slug(rest[rest.length - 1])}@sporthub.dj`;
    const created = stamp(-650 + i * 30);
    const phone = phoneNumber(rng);
    users.push({ key: `u${10 + i}`, name: c.name, email, phone, role: 'coach', created_at: created, last_login_at: c.email ? pastStamp(0, 7, 55) : pastStamp(-(i + 1), 18, 10) });
    return { ...c, code: `C${String(i + 1).padStart(3, '0')}`, user_key: `u${10 + i}`, email, phone, created_at: created };
  });

  const players = buildPlayers({ rng, teams, users: mockUsers, now, day, stamp, pastStamp });
  mockUsers.forEach((u) => users.push({ key: u.id, name: u.name, email: u.email, phone: u.phone, role: 'player', status: u.status, created_at: u.created_at, last_login_at: u.last_login_at }));

  const competitions = buildCompetitions(day, teams.map((t) => t.id));
  const featuredId = players.find((p) => p.email === 'player@example.com')?.id;
  const { matches, matchEvents } = buildMatches({ rng, players, teams, day, stamp, now, featuredId });

  const sessions = buildTrainingSessions({ teams, now, stamp });
  const startMonday = addDays(now, -((now.getDay() + 6) % 7) - 7 * 6);
  sessions.forEach((s, i) => {
    const week = Math.floor(Math.round((new Date(`${s.date}T12:00:00`) - startMonday) / 86400000) / 7);
    const dow = new Date(`${s.date}T12:00:00`).getDay();
    // The coach workspace also shows a cancelled City Sports Club session.
    if (s.team_id === 't2' && week === 5 && dow === 1) {
      s.status = 'cancelled';
      s.cancellation_key = 'maintenance';
    }
    s.description = TRAINING_DESCRIPTIONS[s.training_type] ?? '';
    s.cancellation_reason = s.cancellation_key ? CANCEL_REASONS[s.cancellation_key] : '';
    s.notes = s.status !== 'cancelled' && s.date < day(0) ? COACH_NOTES[(i + 1 + Number(s.team_id.slice(1))) % COACH_NOTES.length] : '';
  });
  const attendance = buildAttendance({ rng, players, sessions, today: day(0) });
  const pending = sessions.filter((s) => s.team_id === 't1' && s.date < day(0) && s.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date))[0];
  if (pending) pending.notes = '';

  const teamEvents = TEAM_EVENTS.map((e) => ({ ...e, date: day(e.offset) }));

  // ------------------------------------------------------------------ notifications
  const teamName = (id) => teams.find((t) => t.id === id)?.name;
  const byDate = (a, b) => `${a.date}${a.time ?? a.start_time}`.localeCompare(`${b.date}${b.time ?? b.start_time}`);
  const live = matches.find((m) => m.status === 'live');
  const upcoming = matches.filter((m) => m.status === 'scheduled').sort(byDate);
  const lastLeague = matches.filter((m) => m.status === 'completed' && m.competition_id === 'k1').sort((a, b) => b.date.localeCompare(a.date))[0];
  const nextTraining = sessions.filter((s) => s.date >= day(0) && s.status !== 'cancelled').sort(byDate)[0];
  const newest = [...players].sort((a, b) => b.registration_date.localeCompare(a.registration_date))[0];
  const suspended = players.find((p) => p.status === 'suspended');
  const friendlyCancelled = matches.find((m) => m.status === 'cancelled');
  const N = (userKey, role, subtype, template, params, offset, hour, minute, isRead, ref = null, refId = null, linkQuery = null, stampFn = pastStamp) => ({
    user_key: userKey, role, subtype, template, params, is_read: isRead, reference_type: ref, reference_key: refId, link_query: linkQuery, created_at: stampFn(offset, hour, minute),
  });

  const notifications = [];
  for (const admin of ['u1', 'u2']) {
    notifications.push(
      N(admin, 'admin', 'match_reminder', 'match_live', { home: teamName(live.home_team_id), away: teamName(live.away_team_id) }, 0, now.getHours(), Math.max(0, now.getMinutes() - 5), false, 'match', live.id),
      N(admin, 'admin', 'lineup_announced', 'lineup_announced', { team: teamName(live.home_team_id), home: teamName(live.home_team_id), away: teamName(live.away_team_id) }, 0, Math.max(0, now.getHours() - 2), 10, false, 'match', live.id),
      N(admin, 'admin', 'match_scheduled', 'match_scheduled', { home: teamName(upcoming[2].home_team_id), away: teamName(upcoming[2].away_team_id), date: upcoming[2].date }, -1, 15, 22, false, 'match', upcoming[2].id),
      N(admin, 'admin', 'training_created', 'training_created', { team: teamName(nextTraining.team_id), date: nextTraining.date }, -1, 11, 5, false, 'training', nextTraining.id),
      N(admin, 'admin', 'account_update', 'player_registered', { name: newest.name, team: teamName(newest.team_id) }, -2, 9, 40, true, 'player', newest.id),
      N(admin, 'admin', 'match_reminder', 'match_result', { home: teamName(lastLeague.home_team_id), away: teamName(lastLeague.away_team_id), score: `${lastLeague.home_score}–${lastLeague.away_score}` }, -7, 18, 55, true, 'match', lastLeague.id),
      N(admin, 'admin', 'team_announcement', 'player_suspended', { name: suspended.name }, -9, 12, 0, true, 'player', suspended.id),
      N(admin, 'admin', 'match_scheduled', 'match_cancelled', { home: teamName(friendlyCancelled.home_team_id), away: teamName(friendlyCancelled.away_team_id) }, -11, 14, 30, true, 'match', friendlyCancelled.id),
      N(admin, 'admin', 'account_update', 'password_reset', { name: coaches[2].name }, -13, 10, 15, true, 'users'),
      N(admin, 'admin', 'team_announcement', 'competition_created', { name: 'Coupe de Djibouti', season: '2026/27' }, -16, 16, 0, true, 'competition', 'k2'),
      N(admin, 'admin', 'training_created', 'attendance_low', { team: 'Young Stars FC', rate: 78 }, -18, 9, 0, true, 'attendance'),
      N(admin, 'admin', 'account_update', 'coach_assigned', { name: coaches[3].name, team: 'Horizon United' }, -24, 13, 45, true, 'coach', 'c4'),
    );
  }

  // Coach Ahmed (Djibouti FC + Young Stars FC)
  const myTeams = ['t1', 't3'];
  const mineC = (m) => myTeams.includes(m.home_team_id) || myTeams.includes(m.away_team_id);
  const cLive = matches.find((m) => m.status === 'live' && mineC(m));
  const cUpcoming = matches.filter((m) => m.status === 'scheduled' && mineC(m)).sort(byDate);
  const cResult = matches.filter((m) => m.status === 'completed' && mineC(m) && m.competition_id === 'k1').sort((a, b) => b.date.localeCompare(a.date))[0];
  const cNext = sessions.filter((x) => myTeams.includes(x.team_id) && x.date >= day(0) && x.status !== 'cancelled').sort(byDate)[0];
  const cCancelled = sessions.find((x) => x.status === 'cancelled' && myTeams.includes(x.team_id) && x.date >= day(0));
  const cSuspended = players.find((p) => p.status === 'suspended' && myTeams.includes(p.team_id));
  notifications.push(
    ...[
      cLive && N('u10', 'coach', 'match_reminder', 'match_live', { home: teamName(cLive.home_team_id), away: teamName(cLive.away_team_id) }, 0, now.getHours(), Math.max(0, now.getMinutes() - 5), false, 'match', cLive.id),
      cNext && N('u10', 'coach', 'training_reminder', 'training_reminder', { team: teamName(cNext.team_id), date: cNext.date, time: cNext.start_time }, 0, 7, 30, false, 'training', cNext.id),
      pending && N('u10', 'coach', 'attendance_update', 'attendance_pending', { team: teamName(pending.team_id), date: pending.date }, -1, 20, 15, false, 'training', pending.id),
      cUpcoming[1] && N('u10', 'coach', 'match_scheduled', 'match_scheduled', { home: teamName(cUpcoming[1].home_team_id), away: teamName(cUpcoming[1].away_team_id), date: cUpcoming[1].date }, -1, 15, 22, false, 'match', cUpcoming[1].id),
      cCancelled && N('u10', 'coach', 'training_reminder', 'training_cancelled', { team: teamName(cCancelled.team_id), date: cCancelled.date }, -2, 9, 5, true, 'training', cCancelled.id),
      cSuspended && N('u10', 'coach', 'player_update', 'player_suspended', { name: cSuspended.name, team: teamName(cSuspended.team_id) }, -3, 11, 40, true, 'player', cSuspended.id),
      cResult && N('u10', 'coach', 'match_reminder', 'match_result', { home: teamName(cResult.home_team_id), away: teamName(cResult.away_team_id), score: `${cResult.home_score}–${cResult.away_score}` }, -7, 18, 55, true, 'match', cResult.id),
      N('u10', 'coach', 'competition_update', 'competition_fixtures', { name: 'Coupe de Djibouti', season: '2026/27' }, -9, 16, 0, true, 'competition', 'k2'),
      N('u10', 'coach', 'attendance_update', 'attendance_low', { team: 'Young Stars FC', rate: 78 }, -10, 9, 0, true, 'attendance', 't3'),
      N('u10', 'coach', 'team_announcement', 'announcement_heat', {}, -12, 10, 0, true),
      N('u10', 'coach', 'system', 'system_maintenance', { date: day(4) }, -14, 8, 0, true),
    ].filter(Boolean),
  );

  // Demo player Ahmed Hassan (Djibouti FC)
  const demo = players.find((p) => p.email === 'player@example.com');
  const demoUserKey = mockUsers.find((u) => u.email === 'player@example.com').id;
  const mineP = (m) => m.home_team_id === 't1' || m.away_team_id === 't1';
  const pLive = matches.find((m) => m.status === 'live' && mineP(m));
  const pNext = matches.filter((m) => m.status === 'scheduled' && mineP(m)).sort(byDate);
  const pLast = matches.filter((m) => m.status === 'completed' && mineP(m)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const pTraining = sessions.filter((s) => s.team_id === 't1' && s.status !== 'cancelled' && s.date >= day(0)).sort(byDate)[0];
  const pCancelled = sessions.find((s) => s.team_id === 't1' && s.status === 'cancelled' && s.date >= day(0));
  notifications.push(
    ...[
      pLive && N(demoUserKey, 'player', 'match_reminder', 'match_live', { home: teamName(pLive.home_team_id), away: teamName(pLive.away_team_id) }, 0, now.getHours(), Math.max(0, now.getMinutes() - 6), false, 'match', pLive.id),
      pTraining && N(demoUserKey, 'player', 'training_reminder', 'training_reminder', { date: pTraining.date, time: pTraining.start_time }, 0, 7, 45, false, 'training', pTraining.id),
      pNext[0] && N(demoUserKey, 'player', 'match_reminder', 'match_upcoming', { home: teamName(pNext[0].home_team_id), away: teamName(pNext[0].away_team_id), date: pNext[0].date, time: pNext[0].time }, -1, 18, 0, false, 'match', pNext[0].id),
      pLive && N(demoUserKey, 'player', 'team_announcement', 'lineup_published', { home: teamName(pLive.home_team_id), away: teamName(pLive.away_team_id) }, 0, Math.max(0, now.getHours() - 2), 5, false, 'match_lineup', pLive.id),
      pLast && N(demoUserKey, 'player', 'match_result', 'match_result', { home: teamName(pLast.home_team_id), away: teamName(pLast.away_team_id), score: `${pLast.home_score}–${pLast.away_score}` }, -7, 18, 55, true, 'match', pLast.id),
      N(demoUserKey, 'player', 'attendance_update', 'attendance_updated', {}, -2, 20, 10, true, 'attendance'),
      pCancelled && N(demoUserKey, 'player', 'training_reminder', 'training_cancelled', { date: pCancelled.date }, -3, 9, 5, true, 'training', pCancelled.id),
      N(demoUserKey, 'player', 'team_announcement', 'team_meeting', { date: day(1), time: '19:30' }, -1, 12, 30, true, 'calendar'),
      N(demoUserKey, 'player', 'competition_update', 'competition_schedule', { name: 'Coupe de Djibouti', season: '2026/27' }, -9, 16, 0, true, 'competition', 'k2'),
      N(demoUserKey, 'player', 'team_announcement', 'heat_protocol', {}, -12, 10, 0, true),
      N(demoUserKey, 'player', 'system', 'system_maintenance', { date: day(4) }, -14, 8, 0, true),
      N(demoUserKey, 'player', 'system', 'welcome', {}, -40, 9, 0, true, 'profile'),
    ].filter(Boolean),
  );
  // Every other account gets a welcome / maintenance notice so no inbox is empty.
  players.filter((p) => p.id !== demo.id).forEach((p) => notifications.push(N(p.user_id, 'player', 'system', 'welcome', {}, -30, 9, 0, true, 'profile')));
  coaches.filter((c) => c.user_key !== 'u10').forEach((c) => notifications.push(N(c.user_key, 'coach', 'system', 'system_maintenance', { date: day(4) }, -14, 8, 0, false)));

  const announcements = [
    { key: 'an1', title: 'Heat protocol for afternoon sessions', message: 'From this week all outdoor sessions before 17:00 must include a hydration break every 15 minutes.', audience: 'coaches', team_key: null, recipients: coaches.length, created_at: stamp(-5, 10, 0) },
    { key: 'an2', title: 'Medical screening — Young Stars FC', message: 'Annual medical screening takes place at the national training centre. Bring your player ID card.', audience: 'team', team_key: 't3', recipients: 15, created_at: stamp(-12, 9, 30) },
  ];

  return { users, teams, coaches, players, competitions, matches, matchEvents, sessions, attendance, teamEvents, notifications, announcements };
}

// ------------------------------------------------------------------ database writes

async function insertRows(client, table, columns, rows) {
  if (!rows.length) return 0;
  let inserted = 0;
  const chunk = Math.max(1, Math.floor(30000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params = [];
    const values = slice.map((row) => `(${columns.map((c) => { params.push(row[c] === undefined ? null : row[c]); return `$${params.length}`; }).join(', ')})`);
    const res = await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`, params);
    inserted += res.rowCount;
  }
  return inserted;
}

const APP_TABLES = [
  'audit_logs', 'notifications', 'notification_preferences', 'announcements', 'training_attendance', 'training_sessions',
  'player_match_statistics', 'match_statistics', 'match_events', 'match_lineups', 'matches', 'competition_teams', 'competitions',
  'team_events', 'team_players', 'coach_teams', 'players', 'coaches', 'teams', 'password_reset_tokens', 'user_sessions', 'users',
];

export async function seed({ reset = false, log = console.log } = {}) {
  const now = new Date();
  const d = buildDataset(now);
  const passwords = {
    admin: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    coach: process.env.SEED_COACH_PASSWORD || 'Coach@123',
    player: process.env.SEED_PLAYER_PASSWORD || 'Player@123',
  };

  log('→ hashing demo passwords');
  const hashes = {};
  for (const u of d.users) hashes[u.key] = await bcrypt.hash(passwords[u.role], env.bcryptRounds);

  const U = (key) => sid(`user:${key}`);
  const T = (key) => sid(`team:${key}`);
  const C = (key) => sid(`coach:${key}`);
  const P = (key) => sid(`player:${key}`);
  const K = (key) => sid(`competition:${key}`);
  const M = (key) => sid(`match:${key}`);
  const S = (key) => sid(`training:${key}`);
  const adminId = U('u1');
  const refId = (type, key) => {
    if (!key) return null;
    return { match: M, match_lineup: M, training: S, competition: K, player: P, coach: C, team: T, attendance: T }[type]?.(key) ?? null;
  };
  const playerByKey = Object.fromEntries(d.players.map((p) => [p.id, p]));

  return withTransaction(async (client) => {
    if (reset) {
      log('→ removing existing application data');
      await client.query(`TRUNCATE ${APP_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    }
    const counts = {};
    counts.users = await insertRows(client, 'users', ['id', 'email', 'password_hash', 'first_name', 'last_name', 'phone', 'role', 'status', 'last_login_at', 'created_at', 'updated_at', 'password_changed_at'], d.users.map((u) => ({
      id: U(u.key), email: u.email.toLowerCase(), password_hash: hashes[u.key], ...splitName(u.name), phone: u.phone, role: u.role, status: u.status ?? 'active', last_login_at: u.last_login_at, created_at: u.created_at, updated_at: u.created_at, password_changed_at: u.created_at,
    })));

    counts.teams = await insertRows(client, 'teams', ['id', 'name', 'short_name', 'description', 'city', 'country', 'category', 'age_group', 'gender', 'home_ground', 'founded', 'color', 'status', 'created_by', 'created_at', 'updated_at'], d.teams.map((t) => ({
      id: T(t.id), name: t.name, short_name: t.short_name, description: t.description, city: CITY[t.id] ?? '', country: 'DJ', category: t.category, age_group: t.age_group, gender: t.gender, home_ground: t.home_ground, founded: t.founded, color: t.color, status: 'active', created_by: adminId, created_at: t.created_at, updated_at: t.created_at,
    })));

    counts.coaches = await insertRows(client, 'coaches', ['id', 'user_id', 'coach_code', 'license', 'experience_years', 'specialization', 'phone', 'gender', 'status', 'created_by', 'created_at', 'updated_at'], d.coaches.map((c) => ({
      id: C(c.id), user_id: U(c.user_key), coach_code: c.code, license: c.license, experience_years: c.experience, specialization: c.experience >= 10 ? 'Senior football' : 'Youth development', phone: c.phone, gender: c.gender, status: 'active', created_by: adminId, created_at: c.created_at, updated_at: c.created_at,
    })));

    const coachTeams = [];
    d.coaches.forEach((c) => c.team_ids.forEach((t) => coachTeams.push({ id: sid(`coach_team:${c.id}:${t}`), coach_id: C(c.id), team_id: T(t), role: 'head_coach', created_by: adminId })));
    d.teams.filter((t) => t.assistant_coach_id).forEach((t) => coachTeams.push({ id: sid(`coach_team:${t.assistant_coach_id}:${t.id}`), coach_id: C(t.assistant_coach_id), team_id: T(t.id), role: 'assistant_coach', created_by: adminId }));
    counts.coach_teams = await insertRows(client, 'coach_teams', ['id', 'coach_id', 'team_id', 'role', 'created_by'], coachTeams);

    counts.players = await insertRows(client, 'players', ['id', 'user_id', 'player_code', 'date_of_birth', 'gender', 'nationality', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation', 'jersey_number', 'position', 'secondary_position', 'preferred_foot', 'height', 'weight', 'status', 'registration_date', 'license_number', 'license_valid_until', 'team_id', 'created_by', 'created_at', 'updated_at'], d.players.map((p) => ({
      id: P(p.id), user_id: U(p.user_id), player_code: p.player_code, date_of_birth: p.date_of_birth, gender: p.gender, nationality: p.nationality, address: p.address, emergency_contact_name: p.emergency_contact_name, emergency_contact_phone: p.emergency_contact_phone, emergency_contact_relation: p.emergency_contact_relation, jersey_number: p.jersey_number, position: p.position, secondary_position: p.secondary_position, preferred_foot: p.preferred_foot, height: p.height, weight: p.weight, status: p.status, registration_date: p.registration_date, license_number: p.license_number, license_valid_until: p.license_valid_until, team_id: T(p.team_id), created_by: adminId, created_at: `${p.registration_date}T10:00:00Z`, updated_at: `${p.registration_date}T10:00:00Z`,
    })));

    counts.team_players = await insertRows(client, 'team_players', ['id', 'team_id', 'player_id', 'joined_at', 'status', 'created_by'], d.players.map((p) => ({ id: sid(`team_player:${p.id}`), team_id: T(p.team_id), player_id: P(p.id), joined_at: p.registration_date, status: 'active', created_by: adminId })));

    counts.competitions = await insertRows(client, 'competitions', ['id', 'name', 'type', 'season', 'description', 'start_date', 'end_date', 'status', 'location', 'created_by'], d.competitions.map((c) => ({
      id: K(c.id), name: c.name, type: c.type, season: c.season, description: c.description, start_date: c.start_date, end_date: c.end_date, status: c.status, location: c.location, created_by: adminId,
    })));
    counts.competition_teams = await insertRows(client, 'competition_teams', ['id', 'competition_id', 'team_id'], d.competitions.flatMap((c) => c.team_ids.map((t) => ({ id: sid(`competition_team:${c.id}:${t}`), competition_id: K(c.id), team_id: T(t) }))));

    const lineupFormation = (m, side) => m.lineups?.[side]?.formation ?? null;
    counts.matches = await insertRows(client, 'matches', ['id', 'competition_id', 'home_team_id', 'away_team_id', 'match_date', 'match_time', 'venue', 'status', 'home_score', 'away_score', 'live_minute', 'round', 'referee', 'home_formation', 'away_formation', 'created_by', 'created_at'], d.matches.map((m) => ({
      id: M(m.id), competition_id: m.competition_id ? K(m.competition_id) : null, home_team_id: T(m.home_team_id), away_team_id: T(m.away_team_id), match_date: m.date, match_time: m.time, venue: m.location, status: m.status, home_score: m.home_score, away_score: m.away_score, live_minute: m.live_minute, round: m.round, referee: m.referee, home_formation: lineupFormation(m, 'home'), away_formation: lineupFormation(m, 'away'), created_by: adminId, created_at: m.created_at,
    })));

    const lineups = [];
    d.matches.filter((m) => m.lineups).forEach((m) => {
      for (const side of ['home', 'away']) {
        const l = m.lineups[side];
        const teamKey = side === 'home' ? m.home_team_id : m.away_team_id;
        l.starting.forEach((pid, i) => lineups.push({ id: sid(`lineup:${m.id}:${pid}`), match_id: M(m.id), team_id: T(teamKey), player_id: P(pid), is_starting: true, position: playerByKey[pid].position, shirt_number: playerByKey[pid].jersey_number, sort_order: i, substitute_order: null }));
        l.substitutes.forEach((pid, i) => lineups.push({ id: sid(`lineup:${m.id}:${pid}`), match_id: M(m.id), team_id: T(teamKey), player_id: P(pid), is_starting: false, position: playerByKey[pid].position, shirt_number: playerByKey[pid].jersey_number, sort_order: i, substitute_order: i + 1 }));
      }
    });
    counts.match_lineups = await insertRows(client, 'match_lineups', ['id', 'match_id', 'team_id', 'player_id', 'is_starting', 'position', 'shirt_number', 'sort_order', 'substitute_order'], lineups);

    counts.match_events = await insertRows(client, 'match_events', ['id', 'match_id', 'team_id', 'player_id', 'related_player_id', 'event_type', 'minute', 'description', 'created_by'], d.matchEvents.map((e) => {
      // Simulator: substitution player_id = off, related = on → database: player_id = on, related = off.
      const sub = e.event_type === 'substitution';
      return { id: sid(`event:${e.id}`), match_id: M(e.match_id), team_id: T(e.team_id), player_id: P(sub ? e.related_player_id : e.player_id), related_player_id: sub ? P(e.player_id) : e.related_player_id ? P(e.related_player_id) : null, event_type: e.event_type, minute: e.minute, description: e.description ?? '', created_by: adminId };
    }));

    const teamStats = [];
    d.matches.filter((m) => m.team_stats).forEach((m) => {
      for (const side of ['home', 'away']) {
        const s = m.team_stats[side];
        teamStats.push({ id: sid(`match_stats:${m.id}:${side}`), match_id: M(m.id), team_id: T(side === 'home' ? m.home_team_id : m.away_team_id), possession: s.possession, shots: s.shots, shots_on_target: s.shots_on_target, corners: s.corners, fouls: s.fouls, offsides: s.offsides });
      }
    });
    counts.match_statistics = await insertRows(client, 'match_statistics', ['id', 'match_id', 'team_id', 'possession', 'shots', 'shots_on_target', 'corners', 'fouls', 'offsides'], teamStats);

    counts.training_sessions = await insertRows(client, 'training_sessions', ['id', 'team_id', 'coach_id', 'title', 'type', 'date', 'start_time', 'end_time', 'location', 'description', 'description_key', 'objectives', 'player_note', 'notes', 'status', 'cancellation_reason', 'cancellation_key', 'created_by', 'created_at'], d.sessions.map((s) => ({
      id: S(s.id), team_id: T(s.team_id), coach_id: s.coach_id ? C(s.coach_id) : null, title: '', type: s.training_type, date: s.date, start_time: s.start_time, end_time: s.end_time, location: s.location, description: s.description, description_key: s.description_key, objectives: s.objectives, player_note: s.player_note, notes: s.notes, status: s.status, cancellation_reason: s.cancellation_reason, cancellation_key: s.cancellation_key, created_by: adminId, created_at: s.created_at,
    })));

    const coachUserOf = Object.fromEntries(d.coaches.map((c) => [c.id, U(c.user_key)]));
    const sessionByKey = Object.fromEntries(d.sessions.map((s) => [s.id, s]));
    counts.training_attendance = await insertRows(client, 'training_attendance', ['id', 'training_session_id', 'player_id', 'status', 'notes', 'marked_by', 'marked_at'], d.attendance.map((a) => {
      const s = sessionByKey[a.training_session_id];
      return { id: sid(`attendance:${a.training_session_id}:${a.player_id}`), training_session_id: S(a.training_session_id), player_id: P(a.player_id), status: a.status, notes: a.notes, marked_by: coachUserOf[s.coach_id] ?? adminId, marked_at: `${s.date}T${s.end_time}:00` };
    }));

    counts.team_events = await insertRows(client, 'team_events', ['id', 'team_id', 'kind', 'title', 'date', 'start_time', 'end_time', 'location', 'created_by'], d.teamEvents.map((e) => ({ id: sid(`team_event:${e.id}`), team_id: T(e.team_id), kind: e.kind, title: '', date: e.date, start_time: e.start, end_time: e.end, location: e.location, created_by: adminId })));

    counts.notifications = await insertRows(client, 'notifications', ['id', 'user_id', 'type', 'subtype', 'title', 'message', 'template', 'params', 'reference_type', 'reference_id', 'link_query', 'is_read', 'read_at', 'created_at'], d.notifications.map((n, i) => {
      const text = renderTemplate(n.role, n.template, n.params) ?? { title: n.template, message: '' };
      return {
        id: sid(`notification:${n.user_key}:${n.template}:${i}`), user_id: U(n.user_key), type: NOTIFICATION_SUBTYPES[n.subtype] ?? 'system', subtype: n.subtype, title: text.title, message: text.message, template: n.template, params: JSON.stringify(n.params ?? {}),
        reference_type: n.reference_type, reference_id: refId(n.reference_type, n.reference_key), link_query: n.link_query, is_read: n.is_read, read_at: n.is_read ? n.created_at : null, created_at: n.created_at,
      };
    }));

    counts.announcements = await insertRows(client, 'announcements', ['id', 'title', 'message', 'audience', 'team_id', 'recipients', 'created_by', 'created_at'], d.announcements.map((a) => ({ id: sid(`announcement:${a.key}`), title: a.title, message: a.message, audience: a.audience, team_id: a.team_key ? T(a.team_key) : null, recipients: a.recipients, created_by: adminId, created_at: a.created_at })));

    // Derived data through the API's own engine (only for matches that do not have it yet).
    const toBuild = await many(
      `SELECT m.id FROM matches m WHERE m.status IN ('completed', 'live') AND m.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM player_match_statistics s WHERE s.match_id = m.id)`,
      [],
      client,
    );
    log(`→ computing statistics for ${toBuild.length} played match(es)`);
    for (const { id } of toBuild) await recomputeMatch(client, id, { score: 'auto' });
    const comps = await many(`SELECT id FROM competitions WHERE deleted_at IS NULL`, [], client);
    for (const { id } of comps) await recomputeStandings(client, id);

    return counts;
  });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const reset = process.argv.includes('--reset');
  if (reset && env.isProduction && !process.argv.includes('--force')) {
    console.error('Refusing to reset data with NODE_ENV=production (add --force if you really mean it).');
    process.exit(1);
  }
  const started = Date.now();
  seed({ reset })
    .then(async (counts) => {
      const inserted = Object.entries(counts).filter(([, n]) => n > 0);
      console.log(inserted.length ? `✓ inserted: ${inserted.map(([t, n]) => `${t} ${n}`).join(', ')}` : '✓ demo data already present — nothing to insert');
      const totals = await many(`SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM players) players, (SELECT count(*) FROM matches) matches, (SELECT count(*) FROM player_match_statistics) player_stats, (SELECT count(*) FROM training_attendance) attendance`);
      console.log('  totals:', totals[0], `(${((Date.now() - started) / 1000).toFixed(1)}s)`);
      await pool.end();
    })
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      await pool.end();
      process.exit(1);
    });
}

