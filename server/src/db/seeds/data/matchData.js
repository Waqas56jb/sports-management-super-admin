/** Fixtures and results. Completed/live matches get line-ups, events and team stats from the simulator. */
import { REFEREES } from './names.js';
import { simulateMatch } from './matchSimulator.js';

/** Double round-robin pairings for four teams. */
const ROUNDS = [
  [['t1', 't2'], ['t3', 't4']],
  [['t1', 't3'], ['t2', 't4']],
  [['t4', 't1'], ['t2', 't3']],
  [['t2', 't1'], ['t4', 't3']],
  [['t3', 't1'], ['t4', 't2']],
  [['t1', 't4'], ['t3', 't2']],
];
const NATIONAL_STADIUM = 'Stade El Hadj Hassan Gouled Aptidon';

export function buildMatches({ rng, players, teams, day, stamp, now, featuredId }) {
  const matches = [];
  const matchEvents = [];
  let seq = 1;
  const strength = Object.fromEntries(teams.map((t) => [t.id, t.strength]));
  const ground = Object.fromEntries(teams.map((t) => [t.id, t.home_ground]));

  const add = ({ competition_id, home, away, offset, time = '16:30', round = null, status, location }) => {
    const match = {
      id: `m${seq}`,
      competition_id,
      home_team_id: home,
      away_team_id: away,
      date: day(offset),
      time,
      location: location ?? ground[home],
      referee: REFEREES[(seq * 3) % REFEREES.length],
      round,
      status,
      home_score: null,
      away_score: null,
      live_minute: null,
      lineups: null,
      team_stats: null,
      created_at: stamp(Math.min(offset, 0) - 21),
    };
    seq += 1;
    if (status === 'completed' || status === 'live') {
      const upTo = status === 'live' ? 63 : 90;
      const sim = simulateMatch({ rng, match, players, strength, upToMinute: upTo, idPrefix: `e${match.id}_`, featuredId });
      Object.assign(match, { lineups: sim.lineups, home_score: sim.homeScore, away_score: sim.awayScore, team_stats: sim.teamStats });
      if (status === 'live') match.live_minute = upTo;
      matchEvents.push(...sim.events);
    }
    matches.push(match);
  };

  // Previous season (k4) — all completed
  ROUNDS.forEach((pairs, r) => pairs.forEach(([home, away], i) => add({ competition_id: 'k4', home, away, offset: -320 + r * 16 + i, round: r + 1, status: 'completed' })));
  ROUNDS.forEach((pairs, r) => pairs.forEach(([home, away], i) => add({ competition_id: 'k4', home: away, away: home, offset: -220 + r * 16 + i, round: r + 7, status: 'completed' })));

  // Independence Day Tournament (k3)
  add({ competition_id: 'k3', home: 't1', away: 't4', offset: -92, time: '17:00', round: 1, status: 'completed', location: NATIONAL_STADIUM });
  add({ competition_id: 'k3', home: 't2', away: 't3', offset: -92, time: '19:30', round: 1, status: 'completed', location: NATIONAL_STADIUM });
  add({ competition_id: 'k3', home: 't4', away: 't3', offset: -88, time: '16:00', round: 2, status: 'completed', location: NATIONAL_STADIUM });
  add({ competition_id: 'k3', home: 't1', away: 't2', offset: -88, time: '19:00', round: 2, status: 'completed', location: NATIONAL_STADIUM });

  // Current league (k1): rounds 1–4 played, round 5 today (one live), round 6 next week
  const offsets = [-28, -21, -14, -7, 0, 7];
  ROUNDS.forEach((pairs, r) => {
    pairs.forEach(([home, away], i) => {
      let status = r < 4 ? 'completed' : 'scheduled';
      let time = i === 0 ? '16:30' : '19:00';
      if (r === 4 && i === 0) {
        status = 'live';
        const kickOff = new Date(now.getTime() - 68 * 60000);
        time = `${String(kickOff.getHours()).padStart(2, '0')}:${String(kickOff.getMinutes()).padStart(2, '0')}`;
      }
      if (r === 4 && i === 1) time = '21:00';
      add({ competition_id: 'k1', home, away, offset: offsets[r] + (r < 4 ? i : 0), time, round: r + 1, status });
    });
  });

  // Friendlies (one cancelled) and the cup semi-finals (k2)
  add({ competition_id: null, home: 't1', away: 't3', offset: -10, time: '17:30', status: 'cancelled' });
  add({ competition_id: null, home: 't2', away: 't4', offset: 11, time: '17:00', status: 'scheduled' });
  add({ competition_id: 'k2', home: 't1', away: 't4', offset: 17, time: '17:00', round: 1, status: 'scheduled', location: NATIONAL_STADIUM });
  add({ competition_id: 'k2', home: 't3', away: 't2', offset: 18, time: '17:00', round: 1, status: 'scheduled', location: NATIONAL_STADIUM });

  return { matches, matchEvents };
}
