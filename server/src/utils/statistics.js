/**
 * Pure statistics functions (no database access). The services feed them rows from PostgreSQL;
 * the results are persisted in player_match_statistics / match_statistics / competition_teams.
 *
 * Event orientation (database): substitution → player_id = player coming ON,
 * related_player_id = player going OFF; assist → related_player_id = the scorer.
 */
import { GOAL_EVENT_TYPES, POINTS, RECORDED_ATTENDANCE } from '../config/constants.js';

const PLAYED = new Set(['completed', 'live']);

function hashNoise(a, b) {
  let h = 2166136261;
  for (const c of `${a}|${b}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5 … 0.5
}

function noise(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000; // 0 … 1
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Goals credited to each side (own goals count for the opponent). */
export function scoreFromEvents(match, events) {
  let home = 0;
  let away = 0;
  for (const e of events) {
    const forTeam = GOAL_EVENT_TYPES.includes(e.event_type) ? e.team_id : e.event_type === 'own_goal' ? (e.team_id === match.home_team_id ? match.away_team_id : match.home_team_id) : null;
    if (forTeam === match.home_team_id) home += 1;
    else if (forTeam === match.away_team_id) away += 1;
  }
  return { home, away };
}

/**
 * Per-player line for one match: minutes, goals, assists, cards and a 4.5–10 rating.
 * `lineups` = { home: { starting: [ids], substitutes: [ids] }, away: … }.
 */
export function matchPlayerLines(match, lineups, events, positions) {
  const lines = {};
  if (!lineups || !PLAYED.has(match.status)) return lines;
  const end = match.status === 'live' ? match.live_minute ?? 90 : 90;

  for (const side of ['home', 'away']) {
    const lineup = lineups[side];
    if (!lineup) continue;
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    const scored = side === 'home' ? match.home_score : match.away_score;
    const conceded = side === 'home' ? match.away_score : match.home_score;
    const on = {};
    const off = {};
    lineup.starting.forEach((id) => {
      on[id] = 0;
    });
    for (const e of events) {
      if (e.team_id !== teamId) continue;
      if (e.event_type === 'substitution') {
        if (e.related_player_id) off[e.related_player_id] = e.minute;
        if (e.player_id) on[e.player_id] = e.minute;
      }
      if (e.event_type === 'red_card') off[e.player_id] = Math.min(off[e.player_id] ?? 999, e.minute);
    }
    for (const [id, onMinute] of Object.entries(on)) {
      const minutes = Math.max(0, Math.min(off[id] ?? end, end) - onMinute);
      const mine = events.filter((e) => e.player_id === id);
      const count = (...types) => mine.filter((e) => types.includes(e.event_type)).length;
      const goals = count(...GOAL_EVENT_TYPES);
      const assists = count('assist');
      const yellow = count('yellow_card');
      const red = count('red_card');
      const position = positions[id];
      let rating = 6.3 + goals * 0.9 + assists * 0.55 - yellow * 0.25 - red * 1.4 - count('own_goal') * 0.6 + hashNoise(id, match.id) * 0.9;
      if (scored > conceded) rating += 0.35;
      if (scored < conceded) rating -= 0.3;
      if (conceded === 0 && (position === 'goalkeeper' || position === 'defender') && minutes >= 60) rating += 0.5;
      if (minutes < 20) rating = 6.0 + (rating - 6.3) * 0.5;
      lines[id] = {
        player_id: id,
        team_id: teamId,
        started: lineup.starting.includes(id),
        minutes,
        goals,
        assists,
        yellow_cards: yellow,
        red_cards: red,
        rating: Math.max(4.5, Math.min(10, round1(rating))),
      };
    }
  }
  return lines;
}

const PROFILE = {
  goalkeeper: { shots: 0, passes: 28, accuracy: 72, keyPasses: 0, fouls: 0.1 },
  defender: { shots: 0.5, passes: 46, accuracy: 86, keyPasses: 0.3, fouls: 1.4 },
  midfielder: { shots: 1.4, passes: 52, accuracy: 84, keyPasses: 1.4, fouls: 1.1 },
  forward: { shots: 3.2, passes: 24, accuracy: 74, keyPasses: 1.1, fouls: 0.9 },
};

/**
 * Detailed figures (shots, passes, fouls…) derived deterministically from a line so they stay
 * consistent with the recorded events: goals ≤ shots on target ≤ shots.
 */
export function extendLine(line, position, matchId) {
  const p = PROFILE[position] ?? PROFILE.midfielder;
  const k = `${line.player_id}|${matchId}`;
  const share = Math.min(1, line.minutes / 90);
  const onTarget = line.goals + Math.round(p.shots * 0.45 * share * (0.5 + noise(`${k}t`)));
  const shots = onTarget + Math.round(p.shots * 0.55 * share * (0.4 + noise(`${k}s`) * 1.2));
  const passes = Math.round(p.passes * share * (0.75 + noise(`${k}p`) * 0.5));
  const accuracy = Math.min(96, Math.max(55, p.accuracy + (noise(`${k}a`) - 0.5) * 14 + (line.rating - 6.5) * 2));
  const completed = Math.round((passes * accuracy) / 100);
  return {
    ...line,
    shots,
    shots_on_target: onTarget,
    passes,
    completed_passes: completed,
    pass_accuracy: passes ? round1((completed / passes) * 100) : null,
    key_passes: line.assists + Math.round(p.keyPasses * share * noise(`${k}k`) * 1.5),
    fouls: Math.round(p.fouls * share * noise(`${k}f`) * 2),
  };
}

/** Attendance rate = (present + late) ÷ recorded sessions × 100, one decimal. */
export function attendanceRate(counts) {
  const recorded = RECORDED_ATTENDANCE.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (!recorded) return null;
  return round1((((counts.present ?? 0) + (counts.late ?? 0)) / recorded) * 100);
}

/** {present, absent, late, excused} counts → summary object used by every app. */
export function summarizeCounts(counts = {}) {
  const c = { present: Number(counts.present ?? 0), absent: Number(counts.absent ?? 0), late: Number(counts.late ?? 0), excused: Number(counts.excused ?? 0) };
  return { ...c, total: c.present + c.absent + c.late + c.excused, rate: attendanceRate(c) };
}

export function summarizeRecords(records) {
  const counts = {};
  records.forEach((r) => {
    if (RECORDED_ATTENDANCE.includes(r.status)) counts[r.status] = (counts[r.status] ?? 0) + 1;
  });
  return summarizeCounts(counts);
}

/** Totals and averages over extended match lines. */
export function summarizeLines(lines) {
  const sum = (k) => lines.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const played = lines.length;
  const passes = sum('passes');
  const completed = sum('completed_passes');
  return {
    matches_played: played,
    starts: lines.filter((l) => l.started).length,
    substitute_appearances: lines.filter((l) => !l.started).length,
    minutes_played: sum('minutes'),
    goals: sum('goals'),
    assists: sum('assists'),
    shots: sum('shots'),
    shots_on_target: sum('shots_on_target'),
    passes,
    completed_passes: completed,
    pass_accuracy: passes ? round1((completed / passes) * 100) : null,
    key_passes: sum('key_passes'),
    fouls: sum('fouls'),
    yellow_cards: sum('yellow_cards'),
    red_cards: sum('red_cards'),
    minutes_per_match: played ? Math.round(sum('minutes') / played) : null,
    average_rating: played ? round1(sum('rating') / played) : null,
  };
}

/** Result from one team's point of view. */
export function perspective(match, teamId) {
  const home = match.home_team_id === teamId;
  const gf = home ? match.home_score : match.away_score;
  const ga = home ? match.away_score : match.home_score;
  return { home, gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D' };
}

/**
 * Team records from completed matches (cancelled / postponed / scheduled / live are ignored).
 * Returns { team_id → record } including the last five results as `form`.
 */
export function teamRecords(teamIds, matches) {
  const records = Object.fromEntries(
    teamIds.map((id) => [id, { team_id: id, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0, form: [] }]),
  );
  const done = matches
    .filter((m) => m.status === 'completed' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
  for (const m of done) {
    for (const [teamId, gf, ga] of [
      [m.home_team_id, m.home_score, m.away_score],
      [m.away_team_id, m.away_score, m.home_score],
    ]) {
      const r = records[teamId];
      if (!r) continue;
      r.played += 1;
      r.goals_for += gf;
      r.goals_against += ga;
      if (gf > ga) {
        r.won += 1;
        r.points += POINTS.win;
        r.form.push('W');
      } else if (gf < ga) {
        r.lost += 1;
        r.points += POINTS.loss;
        r.form.push('L');
      } else {
        r.drawn += 1;
        r.points += POINTS.draw;
        r.form.push('D');
      }
    }
  }
  return Object.fromEntries(
    Object.entries(records).map(([id, r]) => [id, { ...r, goal_difference: r.goals_for - r.goals_against, form: r.form.slice(-5) }]),
  );
}

/** Standings order: points, goal difference, goals scored, then name for a stable table. */
export function sortStandings(rows, nameOf = () => '') {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      String(nameOf(a.team_id)).localeCompare(String(nameOf(b.team_id))),
  );
}
