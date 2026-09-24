/**
 * Development-only demo database, assembled from the data modules in this folder.
 * Dates are relative to "today" so upcoming stays upcoming. Player statistics are NOT stored:
 * they are derived from line-ups and match events (services/mock/statsEngine.js).
 */
import { createRandom } from '@/utils/random';
import { addDays, toISODate } from '@/utils/formatters';
import { buildAttendance } from './attendanceData';
import { buildCompetitions } from './competitionData';
import { buildMatches } from './matchData';
import { buildPlayers, phoneNumber } from './playerData';
import { buildNotifications } from './notificationData';
import { COACHES, TEAM_EVENTS, TEAMS } from './teamData';
import { buildTrainingSessions } from './trainingData';

export const SEED_VERSION = 2;

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

export function createSeed(now = new Date()) {
  const rng = createRandom(20260924);
  const day = (offset) => toISODate(addDays(now, offset));
  const stamp = (offset, hour = 9, minute = 0) => {
    const d = addDays(now, offset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  /** Like stamp() but never in the future. */
  const pastStamp = (offset, hour, minute) => {
    const iso = stamp(offset, hour, minute);
    return Date.parse(iso) > now.getTime() ? new Date(now.getTime() - (hour + 1) * 7 * 60000).toISOString() : iso;
  };

  const users = [];

  const teams = TEAMS.map((t, i) => ({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    logo: null,
    color: i,
    category: t.category,
    age_group: t.age_group,
    gender: t.gender,
    coach_id: COACHES.find((c) => c.team_ids.includes(t.id))?.id ?? null,
    assistant_coach_id: t.assistant_coach_id,
    description: t.description,
    home_ground: t.home_ground,
    founded: t.founded,
    status: 'active',
    strength: t.strength,
    created_at: stamp(-700 + i * 5),
  }));

  const coaches = COACHES.map((c, i) => {
    const [first, ...rest] = c.name.split(' ');
    const email = c.email ?? `${slug(first)}.${slug(rest[rest.length - 1])}@sporthub.dj`;
    const created = stamp(-650 + i * 30);
    const phone = phoneNumber(rng);
    users.push({ id: `u${10 + i}`, name: c.name, email, phone, role: 'coach', status: 'active', avatar: null, created_at: created, updated_at: created, last_login_at: null });
    return { id: c.id, user_id: `u${10 + i}`, name: c.name, photo: null, email, phone, gender: c.gender, license: c.license, experience: c.experience, team_ids: c.team_ids, status: 'active', created_at: created };
  });

  const players = buildPlayers({ rng, teams, users, now, day, stamp, pastStamp });
  const competitions = buildCompetitions(day, teams.map((t) => t.id));
  const featuredId = players.find((p) => p.email === 'player@example.com')?.id;
  const { matches, matchEvents } = buildMatches({ rng, players, teams, day, stamp, now, featuredId });
  const trainingSessions = buildTrainingSessions({ teams, now, stamp });
  const attendance = buildAttendance({ rng, players, sessions: trainingSessions, today: day(0) });
  const teamEvents = TEAM_EVENTS.map((e) => ({ ...e, date: day(e.offset) }));
  const teamName = (id) => teams.find((t) => t.id === id)?.name;
  const demoUser = users.find((u) => u.email === 'player@example.com');
  const notifications = buildNotifications({ userId: demoUser.id, matches, sessions: trainingSessions, competitions, day, pastStamp, now, teamName });

  teams.forEach((t) => delete t.strength);

  return {
    meta: { version: SEED_VERSION, seededOn: day(0), dirty: false },
    users,
    teams,
    coaches,
    players,
    competitions,
    matches,
    matchEvents,
    trainingSessions,
    attendance,
    teamEvents,
    notifications,
    preferences: {},
  };
}
