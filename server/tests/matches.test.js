import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { as, closeDb, fixtures, many, one } from './helpers.js';

let f;
let live;
before(async () => {
  f = await fixtures();
  live = await one(`SELECT id, home_team_id, away_team_id FROM v_matches WHERE status = 'live' AND (home_team_id = $1 OR away_team_id = $1) LIMIT 1`, [f.djiboutiFc]);
});
after(closeDb);

async function onPitch(matchId, teamId) {
  const lineup = await many(`SELECT player_id FROM match_lineups WHERE match_id = $1 AND team_id = $2 AND is_starting`, [matchId, teamId]);
  const off = await many(`SELECT related_player_id AS id FROM match_events WHERE match_id = $1 AND team_id = $2 AND event_type = 'substitution'
                          UNION SELECT player_id FROM match_events WHERE match_id = $1 AND team_id = $2 AND event_type = 'red_card'`, [matchId, teamId]);
  const gone = new Set(off.map((r) => r.id));
  return lineup.map((r) => r.player_id).filter((id) => !gone.has(id));
}

describe('match retrieval', () => {
  it('returns the match centre with line-ups, events and player lines', async () => {
    const res = await as('coach').get(`/matches/${live.id}`);
    assert.equal(res.status, 200);
    const m = res.body.data;
    assert.ok(m.home_team.name && m.away_team.name);
    assert.ok(m.lineups.home.starting.length === 11);
    assert.ok(Array.isArray(m.events));
    assert.ok(Object.keys(m.player_lines).length > 0);
  });

  it('players only see matches of their team', async () => {
    const other = await one(`SELECT id FROM v_matches WHERE home_team_id <> $1 AND away_team_id <> $1 LIMIT 1`, [f.djiboutiFc]);
    assert.equal((await as('player').get(`/player/matches/${other.id}`)).status, 403);
    assert.equal((await as('player').get(`/matches/${other.id}`)).status, 403);
    assert.equal((await as('player').get(`/player/matches/${live.id}`)).status, 200);
  });
});

describe('match permissions', () => {
  it('player cannot create a match or modify statistics / events', async () => {
    const res = await as('player').post('/matches', { home_team_id: f.djiboutiFc, away_team_id: f.citySports, date: '2027-05-01', time: '16:00' });
    assert.equal(res.status, 403);
    assert.equal((await as('player').patch(`/matches/${live.id}/statistics`, { home: { corners: 9 } })).status, 403);
    assert.equal((await as('player').post(`/matches/${live.id}/events`, { event_type: 'goal', player_id: f.demoPlayer.id, minute: 10 })).status, 403);
  });

  it('coach cannot operate a match of unrelated teams', async () => {
    const other = await one(`SELECT id FROM v_matches WHERE status = 'completed' AND home_team_id NOT IN ($1, $2) AND away_team_id NOT IN ($1, $2) LIMIT 1`, [f.djiboutiFc, f.youngStars]);
    assert.equal((await as('coach').get(`/matches/${other.id}`)).status, 403);
    const res = await as('coach').patch(`/matches/${other.id}/statistics`, { home: { corners: 3 } });
    assert.equal(res.status, 403);
  });
});

describe('line-up validation', () => {
  it('requires exactly 11 starters from the team, including a goalkeeper', async () => {
    const next = await one(`SELECT id, home_team_id, away_team_id FROM v_matches WHERE status = 'scheduled' AND (home_team_id = $1 OR away_team_id = $1) ORDER BY date LIMIT 1`, [f.djiboutiFc]);
    const squad = await many(`SELECT id, position FROM players WHERE team_id = $1 AND deleted_at IS NULL ORDER BY jersey_number`, [f.djiboutiFc]);
    const ten = squad.slice(0, 10).map((p) => p.id);
    const short = await as('coach').patch(`/matches/${next.id}/lineup`, { team_id: f.djiboutiFc, starting: ten });
    assert.equal(short.status, 422);
    assert.equal(short.body.error.code, 'ELEVEN_REQUIRED');

    const outsider = await as('coach').patch(`/matches/${next.id}/lineup`, { team_id: f.djiboutiFc, starting: [...ten, f.otherPlayer.id] });
    assert.equal(outsider.status, 422);
    assert.equal(outsider.body.error.code, 'PLAYER_NOT_IN_TEAM');

    const noKeeper = squad.filter((p) => p.position !== 'goalkeeper').slice(0, 11).map((p) => p.id);
    const nk = await as('coach').patch(`/matches/${next.id}/lineup`, { team_id: f.djiboutiFc, starting: noKeeper });
    assert.equal(nk.status, 422);
    assert.equal(nk.body.error.code, 'GOALKEEPER_REQUIRED');
  });
});

describe('goal event business logic', () => {
  it('a goal updates the score and the scorer statistics; deleting it restores both', async () => {
    const teamId = live.home_team_id === f.djiboutiFc || live.away_team_id === f.djiboutiFc ? f.djiboutiFc : live.home_team_id;
    const side = live.home_team_id === teamId ? 'home' : 'away';
    const pitch = await onPitch(live.id, teamId);
    const [scorer, assister] = pitch.slice(-2);
    const before = await one(`SELECT home_score, away_score FROM matches WHERE id = $1`, [live.id]);
    const statsBefore = await one(`SELECT goals FROM player_match_statistics WHERE match_id = $1 AND player_id = $2`, [live.id, scorer]);
    const assistsBefore = await one(`SELECT assists FROM player_match_statistics WHERE match_id = $1 AND player_id = $2`, [live.id, assister]);

    const res = await as('coach').post(`/matches/${live.id}/events`, { event_type: 'goal', team_id: teamId, player_id: scorer, assist_player_id: assister, minute: 50 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const eventId = res.body.data.id;

    const after = await one(`SELECT home_score, away_score FROM matches WHERE id = $1`, [live.id]);
    assert.equal(after[`${side}_score`], before[`${side}_score`] + 1);
    const statsAfter = await one(`SELECT goals FROM player_match_statistics WHERE match_id = $1 AND player_id = $2`, [live.id, scorer]);
    assert.equal(statsAfter.goals, (statsBefore?.goals ?? 0) + 1);
    const assistsAfter = await one(`SELECT assists FROM player_match_statistics WHERE match_id = $1 AND player_id = $2`, [live.id, assister]);
    assert.equal(assistsAfter.assists, (assistsBefore?.assists ?? 0) + 1);

    assert.equal((await as('coach').delete(`/matches/${live.id}/events/${eventId}`)).status, 200);
    const restored = await one(`SELECT home_score, away_score FROM matches WHERE id = $1`, [live.id]);
    assert.deepEqual(restored, before);
  });

  it('rejects a goal by a player who is not on the pitch', async () => {
    const teamId = f.djiboutiFc;
    const bench = await one(
      `SELECT ml.player_id FROM match_lineups ml WHERE ml.match_id = $1 AND ml.team_id = $2 AND NOT ml.is_starting
         AND NOT EXISTS (SELECT 1 FROM match_events e WHERE e.match_id = ml.match_id AND e.event_type = 'substitution' AND e.player_id = ml.player_id) LIMIT 1`,
      [live.id, teamId],
    );
    if (!bench) return;
    const res = await as('coach').post(`/matches/${live.id}/events`, { event_type: 'goal', team_id: teamId, player_id: bench.player_id, minute: 20 });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'PLAYER_NOT_ON_PITCH');
  });

  it('validates substitutions: the player going off must be on the pitch', async () => {
    const teamId = f.djiboutiFc;
    const pitch = await onPitch(live.id, teamId);
    const res = await as('coach').post(`/matches/${live.id}/events`, { event_type: 'substitution', team_id: teamId, player_in_id: pitch[0], player_out_id: pitch[1], minute: 60 });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'PLAYER_NOT_ON_BENCH');
  });

  it('keeps possession consistent (0–100, other side = 100 − x)', async () => {
    const bad = await as('coach').patch(`/matches/${live.id}/statistics`, { home: { possession: 140 } });
    assert.equal(bad.status, 400);
    const before = await many(`SELECT team_id, possession FROM match_statistics WHERE match_id = $1`, [live.id]);
    const res = await as('coach').patch(`/matches/${live.id}/statistics`, { home: { possession: 61 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.home.possession + res.body.data.away.possession, 100);
    const home = before.find((r) => r.team_id === live.home_team_id);
    if (home) await as('coach').patch(`/matches/${live.id}/statistics`, { home: { possession: home.possession } });
  });
});
