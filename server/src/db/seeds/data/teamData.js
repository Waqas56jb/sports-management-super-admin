/** Teams, coaching staff and team events (development demo data). */

export const TEAMS = [
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
    assistant_coach_id: 'c3',
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
    description: 'Community club from Balbala with a large local fan base. Plays a high-pressing game built around quick wide players.',
    strength: 1.3,
    assistant_coach_id: null,
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
    description: 'Federation development side for the best under-21 talent. Competes in the senior league to accelerate player development.',
    strength: 1.05,
    assistant_coach_id: null,
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
    description: 'Northern club based in Tadjourah. Compact defensive structure and dangerous on the counter-attack.',
    strength: 1.2,
    assistant_coach_id: null,
  },
];

/** Same staff as the coach workspace; Coach Ahmed leads Djibouti FC and Young Stars FC. */
export const COACHES = [
  { id: 'c1', name: 'Ahmed Hassan Robleh', license: 'CAF A Licence', experience: 14, team_ids: ['t1', 't3'], gender: 'male', email: 'coach@example.com' },
  { id: 'c2', name: 'Omar Farah Djama', license: 'CAF A Licence', experience: 11, team_ids: ['t2'], gender: 'male' },
  { id: 'c3', name: 'Ismaël Houssein Aden', license: 'CAF B Licence', experience: 7, team_ids: [], gender: 'male' },
  { id: 'c4', name: 'Moussa Ali Waberi', license: 'CAF B Licence', experience: 9, team_ids: ['t4'], gender: 'male' },
  { id: 'c5', name: 'Kadra Mohamed Elmi', license: 'CAF C Licence', experience: 4, team_ids: [], gender: 'female' },
];

/**
 * Non-training team events. `kind` is translated in the UI (teamEvents.kinds.*).
 * offset = days from today, so the calendar always has current events.
 */
export const TEAM_EVENTS = [
  { id: 'ev1', team_id: 't1', kind: 'meeting', offset: 1, start: '19:30', end: '20:30', location: 'Clubhouse — Djibouti FC' },
  { id: 'ev2', team_id: 't1', kind: 'video', offset: 5, start: '18:00', end: '19:00', location: 'Clubhouse — Djibouti FC' },
  { id: 'ev3', team_id: 't1', kind: 'medical', offset: 9, start: '09:00', end: '12:00', location: 'Centre Médical du Sport, Djibouti' },
  { id: 'ev4', team_id: 't1', kind: 'community', offset: 13, start: '10:00', end: '12:30', location: 'École de Balbala 3' },
  { id: 'ev5', team_id: 't1', kind: 'meeting', offset: -6, start: '19:30', end: '20:30', location: 'Clubhouse — Djibouti FC' },
];
