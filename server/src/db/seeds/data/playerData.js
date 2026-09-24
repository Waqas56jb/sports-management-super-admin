/** Squads: 16 players per team, plus the demo player account (Ahmed Hassan, #9, Djibouti FC). */
import { addDays, toISODate } from '../../../utils/dates.js';
import { FAMILY_NAMES, FEMALE_FIRST_NAMES, MALE_FIRST_NAMES, NEIGHBOURHOODS, RELATIONS } from './names.js';

/** Squad template: position + shirt number. */
export const SQUAD = [
  ['goalkeeper', 1], ['goalkeeper', 16],
  ['defender', 2], ['defender', 3], ['defender', 4], ['defender', 5], ['defender', 15],
  ['midfielder', 6], ['midfielder', 8], ['midfielder', 10], ['midfielder', 14], ['midfielder', 18],
  ['forward', 7], ['forward', 9], ['forward', 11], ['forward', 19],
];

/** Squad slots that are not currently active (teamIndex-squadIndex → status). */
const NON_ACTIVE = { '0-6': 'suspended', '1-15': 'inactive', '2-6': 'inactive', '3-15': 'suspended', '3-1': 'inactive' };

/** The demo login. Djibouti FC (team index 0), squad slot 13 = forward #9. */
export const DEMO_PLAYER = {
  teamIndex: 0,
  squadIndex: 13,
  name: 'Ahmed Hassan',
  email: 'player@example.com',
  phone: '+253 77 84 12 09',
  dob: '2000-03-14',
  address: 'Quartier 7, Djibouti',
  secondary_position: 'midfielder',
  preferred_foot: 'right',
  height: 181,
  weight: 76,
  emergency: { name: 'Amina Hassan', relation: 'mother', phone: '+253 77 31 44 52' },
};

const SECONDARY = { goalkeeper: [null], defender: ['midfielder', null, null], midfielder: ['defender', 'forward', null], forward: ['midfielder', null] };
const HEIGHT = { goalkeeper: [183, 194], defender: [176, 190], midfielder: [168, 182], forward: [170, 186] };
const NATIONALITIES = ['DJ', 'DJ', 'DJ', 'DJ', 'DJ', 'DJ', 'ET', 'SO', 'FR'];

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

export const phoneNumber = (rng) => `+253 77 ${String(rng.int(10, 99))} ${String(rng.int(10, 99))} ${String(rng.int(10, 99))}`;

export function buildPlayers({ rng, teams, users, now, day, stamp, pastStamp }) {
  const firstUse = {};
  const lastUse = {};
  const usedNames = new Set([DEMO_PLAYER.name]);
  const usedEmails = new Set([DEMO_PLAYER.email]);
  const players = [];
  let seq = 1;
  let code = 2; // P001 is reserved for the demo player

  teams.forEach((team, ti) => {
    SQUAD.forEach(([position, jersey], si) => {
      const demo = ti === DEMO_PLAYER.teamIndex && si === DEMO_PLAYER.squadIndex;
      let first;
      let last;
      let full;
      if (demo) {
        full = DEMO_PLAYER.name;
        [first, last] = full.split(' ');
      } else {
        do {
          first = rng.pick(MALE_FIRST_NAMES);
          last = rng.pick(FAMILY_NAMES);
          full = `${first} ${last}`;
        } while (usedNames.has(full) || (firstUse[first] ?? 0) >= 2 || (lastUse[last] ?? 0) >= 3 || first === last);
        usedNames.add(full);
        firstUse[first] = (firstUse[first] ?? 0) + 1;
        lastUse[last] = (lastUse[last] ?? 0) + 1;
      }

      let email = demo ? DEMO_PLAYER.email : `${slug(first)}.${slug(last)}@sporthub.dj`;
      if (!demo && usedEmails.has(email)) email = `${slug(first)}.${slug(last)}${ti + 1}@sporthub.dj`;
      usedEmails.add(email);

      const youth = team.age_group === 'u21';
      const age = youth ? rng.int(17, 20) : rng.int(20, 33);
      const dob = demo ? DEMO_PLAYER.dob : toISODate(new Date(now.getFullYear() - age, rng.int(0, 11), rng.int(1, 28)));
      const registered = demo ? -620 : -rng.int(youth ? 60 : 120, youth ? 700 : 1400);
      const status = NON_ACTIVE[`${ti}-${si}`] ?? 'active';
      const id = `p${seq}`;
      const userId = `u${100 + seq}`;
      seq += 1;
      const phone = demo ? DEMO_PLAYER.phone : phoneNumber(rng);
      const created = stamp(registered, 10);
      const [hMin, hMax] = HEIGHT[position];
      const height = demo ? DEMO_PLAYER.height : rng.int(hMin, hMax);

      users.push({
        id: userId, name: full, email, phone, role: 'player', status, avatar: null, created_at: created, updated_at: created,
        last_login_at: rng.chance(0.8) ? pastStamp(-rng.int(0, 20), rng.int(7, 22), rng.int(0, 59)) : null,
      });

      const relation = demo ? DEMO_PLAYER.emergency.relation : rng.pick(RELATIONS);
      const contactFirst = relation === 'mother' || relation === 'sister' ? rng.pick(FEMALE_FIRST_NAMES) : rng.pick(MALE_FIRST_NAMES);
      players.push({
        id,
        user_id: userId,
        player_code: demo ? 'P001' : `P${String(code++).padStart(3, '0')}`,
        name: full,
        photo: null,
        date_of_birth: dob,
        gender: 'male',
        nationality: demo ? 'DJ' : rng.pick(NATIONALITIES),
        phone,
        email,
        address: demo ? DEMO_PLAYER.address : rng.pick(NEIGHBOURHOODS),
        position,
        secondary_position: demo ? DEMO_PLAYER.secondary_position : rng.pick(SECONDARY[position]),
        preferred_foot: demo ? DEMO_PLAYER.preferred_foot : rng.pick(['right', 'right', 'right', 'left', 'both']),
        height,
        weight: demo ? DEMO_PLAYER.weight : Math.round(height - 105 + rng.int(-4, 6)),
        jersey_number: jersey,
        team_id: team.id,
        emergency_contact_name: demo ? DEMO_PLAYER.emergency.name : `${contactFirst} ${last}`,
        emergency_contact_phone: demo ? DEMO_PLAYER.emergency.phone : phoneNumber(rng),
        emergency_contact_relation: relation,
        status,
        registration_date: day(registered),
        license_number: `DJF-${new Date(now.getTime() + registered * 86400000).getFullYear()}-${String(1000 + seq * 7).slice(-4)}`,
        license_valid_until: toISODate(addDays(now, 280 - (seq % 5) * 30)),
      });
    });
  });
  return players;
}
