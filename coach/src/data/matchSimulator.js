/**
 * Builds plausible lineups and a consistent event timeline for demo matches:
 * substitutions happen before goals are assigned, and a goal can only be scored
 * by a player who is actually on the pitch at that minute.
 */
const FORMATION_SHAPE = {
  '4-3-3': { goalkeeper: 1, defender: 4, midfielder: 3, forward: 3 },
  '4-4-2': { goalkeeper: 1, defender: 4, midfielder: 4, forward: 2 },
  '3-5-2': { goalkeeper: 1, defender: 3, midfielder: 5, forward: 2 },
  '4-2-3-1': { goalkeeper: 1, defender: 4, midfielder: 5, forward: 1 },
};

const TEAM_FORMATIONS = { t1: ['4-3-3', '4-3-3', '4-2-3-1'], t2: ['4-4-2', '4-3-3'], t3: ['4-2-3-1', '4-3-3'], t4: ['3-5-2', '4-4-2'] };

export function pickLineup(rng, squad, formation) {
  const shape = FORMATION_SHAPE[formation] ?? FORMATION_SHAPE['4-3-3'];
  const available = rng.shuffle(squad.filter((p) => p.status === 'active'));
  const starting = [];
  for (const [position, count] of Object.entries(shape)) {
    available
      .filter((p) => p.position === position && !starting.includes(p.id))
      .slice(0, count)
      .forEach((p) => starting.push(p.id));
  }
  // Top up from any position if a line is short
  for (const p of available) {
    if (starting.length >= 11) break;
    if (!starting.includes(p.id) && p.position !== 'goalkeeper') starting.push(p.id);
  }
  const substitutes = available.filter((p) => !starting.includes(p.id)).slice(0, 7).map((p) => p.id);
  return { formation, starting, substitutes };
}

function poisson(rng, lambda) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng.next();
  } while (p > l);
  return Math.min(k - 1, 6);
}

export function simulateMatch({ rng, match, players, strength, upToMinute = 90, idPrefix }) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const events = [];
  let seq = 1;
  const push = (e) => {
    events.push({ id: `${idPrefix}${seq}`, match_id: match.id, description: '', related_player_id: null, ...e });
    seq += 1;
  };

  const sides = { home: match.home_team_id, away: match.away_team_id };
  const lineups = {};
  const state = {};

  for (const [side, teamId] of Object.entries(sides)) {
    const squad = players.filter((p) => p.team_id === teamId);
    const formation = rng.pick(TEAM_FORMATIONS[teamId] ?? ['4-3-3']);
    lineups[side] = pickLineup(rng, squad, formation);
    state[side] = { offAt: {}, onAt: {}, redAt: {} };
  }

  const onPitch = (side, minute) => {
    const s = state[side];
    const l = lineups[side];
    const ids = [
      ...l.starting.filter((id) => !(s.offAt[id] <= minute)),
      ...l.substitutes.filter((id) => s.onAt[id] !== undefined && s.onAt[id] <= minute && !(s.offAt[id] <= minute)),
    ];
    return ids.filter((id) => !(s.redAt[id] <= minute));
  };

  // 1. Substitutions (up to 3 per side, second half)
  for (const side of ['home', 'away']) {
    const count = rng.int(2, 3);
    const bench = rng.shuffle(lineups[side].substitutes.filter((id) => byId[id].position !== 'goalkeeper'));
    const minutes = Array.from({ length: count }, () => rng.int(56, 84)).sort((a, b) => a - b);
    minutes.forEach((minute, i) => {
      if (minute > upToMinute || !bench[i]) return;
      const candidates = onPitch(side, minute).filter((id) => byId[id].position !== 'goalkeeper' && lineups[side].starting.includes(id));
      const off = rng.pick(candidates);
      if (!off) return;
      state[side].offAt[off] = minute;
      state[side].onAt[bench[i]] = minute;
      push({ player_id: off, related_player_id: bench[i], team_id: sides[side], event_type: 'substitution', minute });
    });
  }

  // 2. Red cards (rare)
  for (const side of ['home', 'away']) {
    if (!rng.chance(0.07)) continue;
    const minute = rng.int(30, 88);
    if (minute > upToMinute) continue;
    const pool = onPitch(side, minute).filter((id) => byId[id].position !== 'goalkeeper');
    const player = rng.pick(pool);
    if (!player) continue;
    state[side].redAt[player] = minute;
    push({ player_id: player, team_id: sides[side], event_type: 'red_card', minute, description: 'Serious foul play' });
  }

  // 3. Goals + assists
  const homeAdv = 0.15;
  const goals = {
    home: poisson(rng, (strength[sides.home] ?? 1.2) + homeAdv),
    away: poisson(rng, strength[sides.away] ?? 1.1),
  };
  const WEIGHT = { forward: 6, midfielder: 3, defender: 1, goalkeeper: 0 };
  const score = { home: 0, away: 0 };
  for (const side of ['home', 'away']) {
    const minutes = Array.from({ length: goals[side] }, () => rng.int(3, 90)).sort((a, b) => a - b);
    for (const minute of minutes) {
      if (minute > upToMinute) continue;
      const pool = onPitch(side, minute);
      const weighted = pool.flatMap((id) => Array(WEIGHT[byId[id].position]).fill(id));
      const scorer = rng.pick(weighted);
      if (!scorer) continue;
      const penalty = rng.chance(0.1);
      push({ player_id: scorer, team_id: sides[side], event_type: 'goal', minute, description: penalty ? 'Penalty' : '' });
      score[side] += 1;
      if (!penalty && rng.chance(0.72)) {
        const assister = rng.pick(pool.filter((id) => id !== scorer && byId[id].position !== 'goalkeeper'));
        if (assister) push({ player_id: assister, related_player_id: scorer, team_id: sides[side], event_type: 'assist', minute });
      }
    }
  }

  // 4. Yellow cards
  for (const side of ['home', 'away']) {
    const count = rng.int(0, 3);
    for (let i = 0; i < count; i += 1) {
      const minute = rng.int(10, 90);
      if (minute > upToMinute) continue;
      const player = rng.pick(onPitch(side, minute));
      if (player) push({ player_id: player, team_id: sides[side], event_type: 'yellow_card', minute, description: rng.pick(['Tactical foul', 'Dissent', 'Late challenge', 'Time wasting']) });
    }
  }

  events.sort((a, b) => a.minute - b.minute);

  // 5. Team statistics (possession, shots…) consistent with the score and scaled to minutes played.
  const f = upToMinute / 90;
  const edge = (strength[sides.home] ?? 1.2) - (strength[sides.away] ?? 1.1);
  const homePossession = Math.max(34, Math.min(66, Math.round(50 + edge * 18 + rng.int(-6, 6))));
  const sideStats = (side, possession) => {
    const onTarget = score[side] + Math.round(rng.int(1, 4) * f);
    return {
      possession,
      shots: onTarget + Math.round(rng.int(3, 8) * f),
      shots_on_target: onTarget,
      corners: Math.round(rng.int(2, 9) * f),
      fouls: Math.round(rng.int(8, 16) * f),
      offsides: Math.round(rng.int(0, 5) * f),
    };
  };
  const teamStats = { home: sideStats('home', homePossession), away: sideStats('away', 100 - homePossession) };
  return { lineups, events, homeScore: score.home, awayScore: score.away, teamStats };
}
