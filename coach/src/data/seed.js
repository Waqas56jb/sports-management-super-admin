/**
 * Development-only demo database.
 *
 * Everything is generated deterministically and relative to "today" so that upcoming fixtures stay
 * upcoming and completed fixtures have real results. Player statistics are NOT stored here — they are
 * derived from match lineups and match events (see services/mock/statsEngine.js), so a goal recorded
 * in a match always shows up in the scorer's statistics.
 */
import { createRandom } from '@/utils/random';
import { addDays, toISODate } from '@/utils/format';
import {
  ABSENCE_NOTES,
  FAMILY_NAMES,
  FEMALE_FIRST_NAMES,
  MALE_FIRST_NAMES,
  NEIGHBOURHOODS,
  REFEREES,
  RELATIONS,
} from './names';
import { simulateMatch } from './matchSimulator';

export const SEED_VERSION = 1;

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const phoneNumber = (rng) =>
  `+253 77 ${String(rng.int(10, 99))} ${String(rng.int(10, 99))} ${String(rng.int(10, 99))}`;

const TEAMS = [
  {
    id: 't1',
    name: 'Djibouti FC',
    short_name: 'DFC',
    category: 'senior',
    age_group: 'open',
    gender: 'male',
    home_ground: 'Stade El Hadj Hassan Gouled Aptidon',
    founded: 1994,
    description:
      'Founding member of the national league and eight-time champions. Known for a disciplined 4-3-3 and one of the strongest academies in the country.',
    strength: 1.65,
  },
  {
    id: 't2',
    name: 'City Sports Club',
    short_name: 'CSC',
    category: 'senior',
    age_group: 'open',
    gender: 'male',
    home_ground: 'Stade Municipal de Balbala',
    founded: 2003,
    description:
      'Community club from Balbala with a large local fan base. Plays a high-pressing game built around quick wide players.',
    strength: 1.3,
  },
  {
    id: 't3',
    name: 'Young Stars FC',
    short_name: 'YSF',
    category: 'youth',
    age_group: 'u21',
    gender: 'male',
    home_ground: "Centre Technique National d'Arta",
    founded: 2015,
    description:
      'Federation development side for the best under-21 talent. Competes in the senior league to accelerate player development.',
    strength: 1.05,
  },
  {
    id: 't4',
    name: 'Horizon United',
    short_name: 'HZU',
    category: 'senior',
    age_group: 'open',
    gender: 'male',
    home_ground: 'Stade de Tadjourah',
    founded: 2009,
    description:
      'Northern club based in Tadjourah. Compact defensive structure and dangerous on the counter-attack.',
    strength: 1.2,
  },
];

const COACHES = [
  // Coach Ahmed (the demo login) leads the senior side and the federation's U21 development team.
  { id: 'c1', name: 'Ahmed Hassan Robleh', license: 'CAF A Licence', experience: 14, team_ids: ['t1', 't3'], gender: 'male', email: 'coach@example.com' },
  { id: 'c2', name: 'Omar Farah Djama', license: 'CAF A Licence', experience: 11, team_ids: ['t2'], gender: 'male' },
  { id: 'c3', name: 'Ismaël Houssein Aden', license: 'CAF B Licence', experience: 7, team_ids: [], gender: 'male' },
  { id: 'c4', name: 'Moussa Ali Waberi', license: 'CAF B Licence', experience: 9, team_ids: ['t4'], gender: 'male' },
  { id: 'c5', name: 'Kadra Mohamed Elmi', license: 'CAF C Licence', experience: 4, team_ids: [], gender: 'female' },
];

/** Squad template: position + shirt number. 16 players per team. */
const SQUAD = [
  ['goalkeeper', 1], ['goalkeeper', 16],
  ['defender', 2], ['defender', 3], ['defender', 4], ['defender', 5], ['defender', 15],
  ['midfielder', 6], ['midfielder', 8], ['midfielder', 10], ['midfielder', 14], ['midfielder', 18],
  ['forward', 7], ['forward', 9], ['forward', 11], ['forward', 19],
];

/** Squad slots that are not currently active (teamIndex-squadIndex → status). */
const NON_ACTIVE = { '0-6': 'suspended', '1-15': 'inactive', '2-6': 'inactive', '3-15': 'suspended', '3-1': 'inactive' };

export function createSeed(now = new Date()) {
  const rng = createRandom(20260924);
  const day = (offset) => toISODate(addDays(now, offset));
  const stamp = (offset, hour = 9, minute = 0) => {
    const d = addDays(now, offset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  /** Like stamp() but never later than a few minutes ago (sign-ins cannot be in the future). */
  const pastStamp = (offset, hour, minute) => {
    const iso = stamp(offset, hour, minute);
    return Date.parse(iso) > now.getTime() ? new Date(now.getTime() - (hour + 1) * 7 * 60000).toISOString() : iso;
  };

  // ------------------------------------------------------------------ users: admins
  const users = [
    {
      id: 'u1',
      name: 'Abdoulkader Mahamoud',
      email: 'admin@example.com',
      phone: '+253 77 12 34 56',
      role: 'super_admin',
      status: 'active',
      avatar: null,
      created_at: stamp(-720),
      updated_at: stamp(-3),
      last_login_at: pastStamp(0, 8, 12),
    },
    {
      id: 'u2',
      name: 'Fatouma Ahmed Ali',
      email: 'f.ahmed@sporthub.dj',
      phone: '+253 77 45 21 90',
      role: 'super_admin',
      status: 'active',
      avatar: null,
      created_at: stamp(-540),
      updated_at: stamp(-20),
      last_login_at: stamp(-1, 17, 40),
    },
  ];

  // ------------------------------------------------------------------ teams + coaches
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
    description: t.description,
    home_ground: t.home_ground,
    founded: t.founded,
    status: 'active',
    created_at: stamp(-700 + i * 5),
  }));

  const coaches = COACHES.map((c, i) => {
    const userId = `u${10 + i}`;
    const [first, ...rest] = c.name.split(' ');
    const email = c.email ?? `${slug(first)}.${slug(rest[rest.length - 1])}@sporthub.dj`;
    const created = stamp(-650 + i * 30);
    users.push({
      id: userId,
      name: c.name,
      email,
      phone: phoneNumber(rng),
      role: 'coach',
      status: 'active',
      avatar: null,
      created_at: created,
      updated_at: created,
      last_login_at: pastStamp(-rng.int(0, 6), rng.int(7, 20), rng.int(0, 59)),
    });
    return {
      id: c.id,
      user_id: userId,
      name: c.name,
      photo: null,
      email,
      phone: users[users.length - 1].phone,
      gender: c.gender,
      license: c.license,
      experience: c.experience,
      team_ids: c.team_ids,
      status: 'active',
      created_at: created,
    };
  });

  // ------------------------------------------------------------------ players
  const firstUse = {};
  const lastUse = {};
  const usedNames = new Set();
  const usedEmails = new Set();
  const players = [];
  let playerSeq = 1;

  teams.forEach((team, ti) => {
    SQUAD.forEach(([position, jersey], si) => {
      let first;
      let last;
      let full;
      do {
        first = rng.pick(MALE_FIRST_NAMES);
        last = rng.pick(FAMILY_NAMES);
        full = `${first} ${last}`;
      } while (usedNames.has(full) || (firstUse[first] ?? 0) >= 2 || (lastUse[last] ?? 0) >= 3 || first === last);
      usedNames.add(full);
      firstUse[first] = (firstUse[first] ?? 0) + 1;
      lastUse[last] = (lastUse[last] ?? 0) + 1;

      let email = `${slug(first)}.${slug(last)}@sporthub.dj`;
      if (usedEmails.has(email)) email = `${slug(first)}.${slug(last)}${ti + 1}@sporthub.dj`;
      usedEmails.add(email);

      const youth = team.age_group === 'u21';
      const age = youth ? rng.int(17, 20) : rng.int(20, 33);
      const dob = new Date(now.getFullYear() - age, rng.int(0, 11), rng.int(1, 28));
      const registered = -rng.int(youth ? 60 : 120, youth ? 700 : 1400);
      const status = NON_ACTIVE[`${ti}-${si}`] ?? 'active';
      const id = `p${playerSeq}`;
      const userId = `u${100 + playerSeq}`;
      playerSeq += 1;

      const phone = phoneNumber(rng);
      const created = stamp(registered, 10);
      users.push({
        id: userId,
        name: full,
        email,
        phone,
        role: 'player',
        status,
        avatar: null,
        created_at: created,
        updated_at: created,
        last_login_at: rng.chance(0.8) ? pastStamp(-rng.int(0, 20), rng.int(7, 22), rng.int(0, 59)) : null,
      });

      const relation = rng.pick(RELATIONS);
      const contactFirst = relation === 'mother' || relation === 'sister' ? rng.pick(FEMALE_FIRST_NAMES) : rng.pick(MALE_FIRST_NAMES);
      players.push({
        id,
        user_id: userId,
        name: full,
        photo: null,
        date_of_birth: toISODate(dob),
        gender: 'male',
        phone,
        email,
        address: rng.pick(NEIGHBOURHOODS),
        position,
        jersey_number: jersey,
        team_id: team.id,
        emergency_contact_name: `${contactFirst} ${last}`,
        emergency_contact_phone: phoneNumber(rng),
        emergency_contact_relation: relation,
        status,
        registration_date: day(registered),
      });
    });
  });

  // ------------------------------------------------------------------ competitions
  const allTeamIds = teams.map((t) => t.id);
  const competitions = [
    {
      id: 'k1',
      name: 'Djibouti Premier League',
      type: 'league',
      season: '2026/27',
      start_date: day(-29),
      end_date: day(150),
      location: 'Djibouti — nationwide',
      team_ids: allTeamIds,
      status: 'active',
      description: 'Top division of Djiboutian football. Double round-robin, three points for a win.',
    },
    {
      id: 'k2',
      name: 'Coupe de Djibouti',
      type: 'cup',
      season: '2026/27',
      start_date: day(17),
      end_date: day(33),
      location: 'Stade El Hadj Hassan Gouled Aptidon',
      team_ids: allTeamIds,
      status: 'upcoming',
      description: 'National knockout cup. Single-leg semi-finals and final at the national stadium.',
    },
    {
      id: 'k3',
      name: 'Independence Day Tournament',
      type: 'tournament',
      season: '2026',
      start_date: day(-92),
      end_date: day(-88),
      location: 'Stade El Hadj Hassan Gouled Aptidon',
      team_ids: allTeamIds,
      status: 'completed',
      description: 'Four-team invitational played around 27 June to celebrate national Independence Day.',
    },
    {
      id: 'k4',
      name: 'Djibouti Premier League',
      type: 'league',
      season: '2025/26',
      start_date: day(-330),
      end_date: day(-130),
      location: 'Djibouti — nationwide',
      team_ids: allTeamIds,
      status: 'completed',
      description: 'Previous league season. Double round-robin.',
    },
  ];

  // ------------------------------------------------------------------ matches
  const matches = [];
  const matchEvents = [];
  let matchSeq = 1;
  const strength = Object.fromEntries(TEAMS.map((t) => [t.id, t.strength]));
  const ground = Object.fromEntries(teams.map((t) => [t.id, t.home_ground]));

  const addMatch = ({ competition_id, home, away, offset, time = '16:30', round = null, status, location }) => {
    const match = {
      id: `m${matchSeq}`,
      competition_id,
      home_team_id: home,
      away_team_id: away,
      date: day(offset),
      time,
      location: location ?? ground[home],
      referee: REFEREES[(matchSeq * 3) % REFEREES.length],
      round,
      status,
      home_score: null,
      away_score: null,
      live_minute: null,
      lineups: null,
      team_stats: null,
      created_at: stamp(Math.min(offset, 0) - 21),
    };
    matchSeq += 1;
    if (status === 'completed' || status === 'live') {
      const upTo = status === 'live' ? 63 : 90;
      const sim = simulateMatch({ rng, match, players, strength, upToMinute: upTo, idPrefix: `e${match.id}_` });
      match.lineups = sim.lineups;
      match.home_score = sim.homeScore;
      match.away_score = sim.awayScore;
      if (status === 'live') match.live_minute = upTo;
      match.team_stats = sim.teamStats;
      matchEvents.push(...sim.events);
    }
    matches.push(match);
    return match;
  };

  // Double round-robin fixtures
  const ROUNDS = [
    [['t1', 't2'], ['t3', 't4']],
    [['t1', 't3'], ['t2', 't4']],
    [['t4', 't1'], ['t2', 't3']],
    [['t2', 't1'], ['t4', 't3']],
    [['t3', 't1'], ['t4', 't2']],
    [['t1', 't4'], ['t3', 't2']],
  ];

  // Previous season — all completed
  ROUNDS.forEach((pairs, r) => {
    pairs.forEach(([home, away], i) =>
      addMatch({ competition_id: 'k4', home, away, offset: -320 + r * 16 + i, round: r + 1, status: 'completed' }),
    );
  });
  ROUNDS.forEach((pairs, r) => {
    pairs.forEach(([home, away], i) =>
      addMatch({ competition_id: 'k4', home: away, away: home, offset: -220 + r * 16 + i, round: r + 7, status: 'completed' }),
    );
  });

  // Independence Day Tournament
  const itLoc = 'Stade El Hadj Hassan Gouled Aptidon';
  addMatch({ competition_id: 'k3', home: 't1', away: 't4', offset: -92, time: '17:00', round: 1, status: 'completed', location: itLoc });
  addMatch({ competition_id: 'k3', home: 't2', away: 't3', offset: -92, time: '19:30', round: 1, status: 'completed', location: itLoc });
  addMatch({ competition_id: 'k3', home: 't4', away: 't3', offset: -88, time: '16:00', round: 2, status: 'completed', location: itLoc });
  addMatch({ competition_id: 'k3', home: 't1', away: 't2', offset: -88, time: '19:00', round: 2, status: 'completed', location: itLoc });

  // Current league season: rounds 1–4 played, round 5 today (one live), round 6 next week
  const leagueOffsets = [-28, -21, -14, -7, 0, 7];
  ROUNDS.forEach((pairs, r) => {
    pairs.forEach(([home, away], i) => {
      const offset = leagueOffsets[r] + (r < 4 ? i : 0);
      let status = 'scheduled';
      let time = i === 0 ? '16:30' : '19:00';
      if (r < 4) status = 'completed';
      if (r === 4 && i === 0) {
        status = 'live';
        const kickOff = new Date(now.getTime() - 68 * 60000);
        time = `${String(kickOff.getHours()).padStart(2, '0')}:${String(kickOff.getMinutes()).padStart(2, '0')}`;
      }
      if (r === 4 && i === 1) time = '21:00';
      addMatch({ competition_id: 'k1', home, away, offset, time, round: r + 1, status });
    });
  });

  // Friendlies (one cancelled) and the cup
  addMatch({ competition_id: null, home: 't1', away: 't3', offset: -10, time: '17:30', status: 'cancelled' });
  addMatch({ competition_id: null, home: 't2', away: 't4', offset: 11, time: '17:00', status: 'scheduled' });
  const cupLoc = 'Stade El Hadj Hassan Gouled Aptidon';
  addMatch({ competition_id: 'k2', home: 't1', away: 't4', offset: 17, time: '17:00', round: 1, status: 'scheduled', location: cupLoc });
  addMatch({ competition_id: 'k2', home: 't3', away: 't2', offset: 18, time: '17:00', round: 1, status: 'scheduled', location: cupLoc });

  // ------------------------------------------------------------------ training sessions + attendance
  const trainingSessions = [];
  const attendance = [];
  const WEEKLY = [
    { dow: 1, type: 'recovery', start: '07:00', end: '08:30' },
    { dow: 2, type: 'tactical', start: '17:00', end: '19:00' },
    { dow: 4, type: 'technical', start: '17:00', end: '19:00' },
    { dow: 5, type: 'match_preparation', start: '17:30', end: '19:00' },
  ];
  const TRAINING_NOTES = {
    fitness: 'High-intensity interval work and sprint repeats. Hydration breaks every 15 minutes.',
    tactical: 'Defensive shape out of possession, pressing triggers and compactness between the lines.',
    technical: 'Rondos, passing patterns under pressure and finishing from wide areas.',
    recovery: 'Light jog, mobility circuit, stretching and pool session for starters from the weekend.',
    match_preparation: 'Set-piece rehearsal, opponent video review and final line-up walk-through.',
    other: 'Team building session and medical screening.',
  };
  const COACH_NOTES = [
    'Good intensity overall. Pressing triggers still late on the left side.',
    'Several players carrying knocks — manage load before the weekend.',
    'Excellent finishing drill; keep the 3v2 overload exercise next week.',
    'Communication in the back line improved. Work on set-piece marking.',
    'Short session because of the heat; hydration protocol followed.',
    '',
  ];
  const CANCEL_REASONS = ['Pitch unavailable — national team event at the venue', 'Extreme heat warning issued by the city', 'Stadium maintenance'];
  const reliability = Object.fromEntries(players.map((p) => [p.id, 0.72 + rng.next() * 0.25]));
  let tsSeq = 1;
  let attSeq = 1;
  const startMonday = addDays(now, -((now.getDay() + 6) % 7) - 7 * 6);

  for (let week = 0; week < 9; week += 1) {
    teams.forEach((team, ti) => {
      WEEKLY.forEach((slot, si) => {
        // Every team trains 3× a week; each team skips a different slot, and week 3 has a fitness block.
        if ((si + ti) % 4 === 3) return;
        const date = addDays(startMonday, week * 7 + slot.dow - 1);
        const offset = Math.round((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
        const type = week === 2 && slot.type === 'technical' ? 'fitness' : slot.type;
        const session = {
          id: `ts${tsSeq}`,
          team_id: team.id,
          coach_id: team.coach_id,
          date: toISODate(date),
          start_time: ti === 2 && slot.start === '17:00' ? '16:30' : slot.start,
          end_time: ti === 2 && slot.end === '19:00' ? '18:30' : slot.end,
          location: team.home_ground,
          training_type: type,
          description: TRAINING_NOTES[type],
          notes: offset < 0 ? COACH_NOTES[(tsSeq + ti) % COACH_NOTES.length] : '',
          status: 'scheduled',
          cancellation_reason: '',
          created_at: stamp(offset - 6, 11),
        };
        // A few cancelled sessions so the coach sees the full lifecycle.
        if ((team.id === 't1' && week === 3 && slot.dow === 2) || (team.id === 't3' && week === 7 && slot.dow === 4) || (team.id === 't2' && week === 5 && slot.dow === 1)) {
          session.status = 'cancelled';
          session.cancellation_reason = CANCEL_REASONS[week % CANCEL_REASONS.length];
          session.notes = '';
        }
        tsSeq += 1;
        trainingSessions.push(session);
        if (offset < 0 && session.status !== 'cancelled') {
          players
            .filter((p) => p.team_id === team.id && p.status !== 'inactive')
            .forEach((p) => {
              const r = rng.next();
              const rel = reliability[p.id];
              let status = 'present';
              if (r > rel + 0.18) status = 'absent';
              else if (r > rel + 0.1) status = 'excused';
              else if (r > rel) status = 'late';
              attendance.push({
                id: `a${attSeq}`,
                training_session_id: session.id,
                player_id: p.id,
                status,
                notes: status === 'present' ? '' : rng.pick(ABSENCE_NOTES[status]),
              });
              attSeq += 1;
            });
        }
      });
    });
  }

  const todayIso = day(0);
  const pending = trainingSessions
    .filter((ts) => ts.team_id === 't1' && ts.date < todayIso && ts.status !== 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (pending) {
    pending.notes = '';
    for (let i = attendance.length - 1; i >= 0; i -= 1) if (attendance[i].training_session_id === pending.id) attendance.splice(i, 1);
  }

  // ------------------------------------------------------------------ notifications (coach Ahmed's inbox)
  const coachUserId = coaches.find((c) => c.id === 'c1').user_id;
  const myTeams = ['t1', 't3'];
  const teamName = (id) => teams.find((t) => t.id === id)?.name;
  const mine = (m) => myTeams.includes(m.home_team_id) || myTeams.includes(m.away_team_id);
  const liveMatch = matches.find((m) => m.status === 'live' && mine(m));
  const upcoming = matches.filter((m) => m.status === 'scheduled' && mine(m)).sort((a, b) => a.date.localeCompare(b.date));
  const lastResult = matches.filter((m) => m.status === 'completed' && mine(m) && m.competition_id === 'k1').sort((a, b) => b.date.localeCompare(a.date))[0];
  const nextTraining = trainingSessions.filter((x) => myTeams.includes(x.team_id) && x.date >= day(0) && x.status !== 'cancelled').sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))[0];
  const cancelled = trainingSessions.find((x) => x.status === 'cancelled' && myTeams.includes(x.team_id) && x.date >= day(0));
  const suspended = players.find((p) => p.status === 'suspended' && myTeams.includes(p.team_id));
  const lowAttendance = players.find((p) => p.team_id === 't3' && p.status === 'active');

  const N = (type, template, params, offset, hour, minute, isRead, link) => ({ type, template, params, link, is_read: isRead, created_at: pastStamp(offset, hour, minute) });
  const notificationSpecs = [
    liveMatch && N('match_reminder', 'match_live', { home: teamName(liveMatch.home_team_id), away: teamName(liveMatch.away_team_id) }, 0, now.getHours(), Math.max(0, now.getMinutes() - 5), false, `/coach/matches/${liveMatch.id}`),
    nextTraining && N('training_reminder', 'training_reminder', { team: teamName(nextTraining.team_id), date: nextTraining.date, time: nextTraining.start_time }, 0, 7, 30, false, `/coach/training/${nextTraining.id}`),
    pending && N('attendance_update', 'attendance_pending', { team: teamName(pending.team_id), date: pending.date }, -1, 20, 15, false, `/coach/training/${pending.id}`),
    upcoming[1] && N('match_scheduled', 'match_scheduled', { home: teamName(upcoming[1].home_team_id), away: teamName(upcoming[1].away_team_id), date: upcoming[1].date }, -1, 15, 22, false, `/coach/matches/${upcoming[1].id}`),
    cancelled && N('training_reminder', 'training_cancelled', { team: teamName(cancelled.team_id), date: cancelled.date }, -2, 9, 5, true, `/coach/training/${cancelled.id}`),
    suspended && N('player_update', 'player_suspended', { name: suspended.name, team: teamName(suspended.team_id) }, -3, 11, 40, true, `/coach/players/${suspended.id}`),
    lastResult && N('match_reminder', 'match_result', { home: teamName(lastResult.home_team_id), away: teamName(lastResult.away_team_id), score: `${lastResult.home_score}–${lastResult.away_score}` }, -7, 18, 55, true, `/coach/matches/${lastResult.id}`),
    N('competition_update', 'competition_fixtures', { name: 'Coupe de Djibouti', season: '2026/27' }, -9, 16, 0, true, '/coach/competitions/k2'),
    lowAttendance && N('attendance_update', 'attendance_low', { team: 'Young Stars FC', rate: 78 }, -10, 9, 0, true, '/coach/attendance?team=t3'),
    N('team_announcement', 'announcement_heat', {}, -12, 10, 0, true, null),
    N('system', 'system_maintenance', { date: day(4) }, -14, 8, 0, true, null),
  ].filter(Boolean);
  const notifications = notificationSpecs.map((n, i) => ({ id: `n${i + 1}`, user_id: coachUserId, title: null, message: null, ...n }));
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
    notifications,
  };
}
