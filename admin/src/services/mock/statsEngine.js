/**
 * Derives statistics from raw match data. In production the `server/` API owns these
 * calculations; the mock layer reproduces them so the UI can be built against real shapes.
 */
import { inDateRange } from './query';

const PLAYED = new Set(['completed', 'live']);

function hashNoise(a, b) {
  let h = 2166136261;
  for (const c of `${a}|${b}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5 … 0.5
}

/** Per-player line for a single match: minutes, goals, cards, rating. */
export function matchPlayerLines(match, events, playersById) {
  const lines = {};
  if (!match.lineups || !PLAYED.has(match.status)) return lines;
  const end = match.status === 'live' ? match.live_minute ?? 90 : 90;
  const matchEvents = events.filter((e) => e.match_id === match.id);

  for (const side of ['home', 'away']) {
    const lineup = match.lineups[side];
    if (!lineup) continue;
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    const scored = side === 'home' ? match.home_score : match.away_score;
    const conceded = side === 'home' ? match.away_score : match.home_score;
    const on = {};
    const off = {};
    lineup.starting.forEach((id) => {
      on[id] = 0;
    });
    for (const e of matchEvents) {
      if (e.event_type === 'substitution') {
        if (e.player_id) off[e.player_id] = e.minute;
        if (e.related_player_id) on[e.related_player_id] = e.minute;
      }
      if (e.event_type === 'red_card') off[e.player_id] = Math.min(off[e.player_id] ?? 999, e.minute);
    }
    for (const [id, onMinute] of Object.entries(on)) {
      const minutes = Math.max(0, Math.min(off[id] ?? end, end) - onMinute);
      const mine = matchEvents.filter((e) => e.player_id === id);
      const count = (type) => mine.filter((e) => e.event_type === type).length;
      const goals = count('goal');
      const assists = count('assist');
      const yellow = count('yellow_card');
      const red = count('red_card');
      const position = playersById[id]?.position;
      let rating = 6.3 + goals * 0.9 + assists * 0.55 - yellow * 0.25 - red * 1.4 + hashNoise(id, match.id) * 0.9;
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
        rating: Math.max(4.5, Math.min(10, Math.round(rating * 10) / 10)),
      };
    }
  }
  return lines;
}

export function scopedMatches(db, { competitionId, season, teamId, from, to, includeLive = true } = {}) {
  const compById = Object.fromEntries(db.competitions.map((c) => [c.id, c]));
  return db.matches.filter((m) => {
    if (!(m.status === 'completed' || (includeLive && m.status === 'live'))) return false;
    if (competitionId && m.competition_id !== competitionId) return false;
    if (season && compById[m.competition_id]?.season !== season) return false;
    if (teamId && m.home_team_id !== teamId && m.away_team_id !== teamId) return false;
    return inDateRange(m.date, from, to);
  });
}

/** Aggregate season statistics for every player (matches the `player_statistics` table shape). */
export function computePlayerStats(db, filters = {}) {
  const playersById = Object.fromEntries(db.players.map((p) => [p.id, p]));
  const totals = {};
  for (const p of db.players) {
    totals[p.id] = {
      player_id: p.id,
      team_id: p.team_id,
      matches_played: 0,
      starts: 0,
      goals: 0,
      assists: 0,
      minutes_played: 0,
      yellow_cards: 0,
      red_cards: 0,
      rating_sum: 0,
    };
  }
  for (const m of scopedMatches(db, filters)) {
    const lines = matchPlayerLines(m, db.matchEvents, playersById);
    for (const line of Object.values(lines)) {
      const t = totals[line.player_id];
      if (!t) continue;
      t.matches_played += 1;
      t.starts += line.started ? 1 : 0;
      t.goals += line.goals;
      t.assists += line.assists;
      t.minutes_played += line.minutes;
      t.yellow_cards += line.yellow_cards;
      t.red_cards += line.red_cards;
      t.rating_sum += line.rating;
    }
  }
  const attendance = computeAttendanceByPlayer(db, { from: filters.from, to: filters.to });
  return Object.values(totals).map(({ rating_sum, ...t }) => ({
    ...t,
    rating: t.matches_played ? Math.round((rating_sum / t.matches_played) * 10) / 10 : null,
    attendance_rate: attendance[t.player_id]?.rate ?? null,
  }));
}

/** Attendance rate = (present + late) / sessions recorded. Excused absences still count as missed sessions. */
export function attendanceRate(records) {
  if (!records.length) return null;
  const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  return Math.round((attended / records.length) * 1000) / 10;
}

export function summarizeAttendance(records) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  records.forEach((r) => {
    counts[r.status] += 1;
  });
  return { ...counts, total: records.length, rate: attendanceRate(records) };
}

export function attendanceRecordsInScope(db, { teamId, playerId, status, from, to, sessionId } = {}) {
  const sessions = Object.fromEntries(db.trainingSessions.map((s) => [s.id, s]));
  return db.attendance
    .map((a) => ({ ...a, session: sessions[a.training_session_id] }))
    .filter((a) => {
      if (!a.session) return false;
      if (sessionId && a.training_session_id !== sessionId) return false;
      if (teamId && a.session.team_id !== teamId) return false;
      if (playerId && a.player_id !== playerId) return false;
      if (status && a.status !== status) return false;
      return inDateRange(a.session.date, from, to);
    });
}

export function computeAttendanceByPlayer(db, filters = {}) {
  const grouped = {};
  for (const r of attendanceRecordsInScope(db, filters)) {
    (grouped[r.player_id] ??= []).push(r);
  }
  return Object.fromEntries(Object.entries(grouped).map(([id, recs]) => [id, summarizeAttendance(recs)]));
}

/** Played/won/drawn/lost/goals/points/form for each team in a match scope. */
export function computeTeamRecords(db, filters = {}) {
  const records = {};
  for (const t of db.teams) {
    records[t.id] = { team_id: t.id, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0, form: [] };
  }
  const matches = scopedMatches(db, { ...filters, teamId: undefined, includeLive: false }).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  for (const m of matches) {
    const pairs = [
      [m.home_team_id, m.home_score, m.away_score],
      [m.away_team_id, m.away_score, m.home_score],
    ];
    for (const [teamId, gf, ga] of pairs) {
      const r = records[teamId];
      if (!r) continue;
      r.played += 1;
      r.goals_for += gf;
      r.goals_against += ga;
      const result = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
      if (result === 'W') {
        r.won += 1;
        r.points += 3;
      } else if (result === 'D') {
        r.drawn += 1;
        r.points += 1;
      } else r.lost += 1;
      r.form.push(result);
    }
  }
  return Object.values(records).map((r) => ({ ...r, goal_difference: r.goals_for - r.goals_against, form: r.form.slice(-5) }));
}

export function standings(db, competitionId) {
  const comp = db.competitions.find((c) => c.id === competitionId);
  if (!comp) return [];
  return computeTeamRecords(db, { competitionId })
    .filter((r) => comp.team_ids.includes(r.team_id))
    .sort((a, b) => b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for);
}
