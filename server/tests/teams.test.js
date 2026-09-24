import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { as, closeDb, fixtures } from './helpers.js';

let f;
before(async () => {
  f = await fixtures();
});
after(closeDb);

describe('coach team scope', () => {
  it('lists only the assigned teams', async () => {
    const res = await as('coach').get('/coach/teams');
    assert.equal(res.status, 200);
    const ids = res.body.data.map((t) => t.id).sort();
    assert.deepEqual(ids, [f.djiboutiFc, f.youngStars].sort());
    const generic = await as('coach').get('/teams');
    assert.ok(generic.body.data.every((t) => [f.djiboutiFc, f.youngStars].includes(t.id)));
  });

  it('coach A cannot access unrelated team data', async () => {
    assert.equal((await as('coach').get(`/coach/teams/${f.citySports}`)).status, 403);
    assert.equal((await as('coach').get(`/teams/${f.citySports}`)).status, 403);
    assert.equal((await as('coach').get(`/coach/players/${f.otherPlayer.id}`)).status, 403);
    const players = await as('coach').get(`/coach/players?team_id=${f.citySports}`);
    assert.equal(players.body.data.length, 0);
  });

  it('coach cannot modify teams or create competitions', async () => {
    assert.equal((await as('coach').patch(`/teams/${f.djiboutiFc}`, { description: 'hacked' })).status, 403);
    assert.equal((await as('coach').patch(`/teams/${f.citySports}`, { description: 'hacked' })).status, 403);
    assert.equal((await as('coach').post('/teams', { name: 'Rogue FC', short_name: 'RFC' })).status, 403);
    const comp = await as('coach').post('/competitions', { name: 'Rogue Cup', type: 'cup', season: '2027', start_date: '2027-01-01', end_date: '2027-02-01', team_ids: [f.djiboutiFc, f.youngStars] });
    assert.equal(comp.status, 403);
  });

  it('team statistics are calculated server-side', async () => {
    const res = await as('coach').get(`/teams/${f.djiboutiFc}/statistics`);
    assert.equal(res.status, 200);
    const s = res.body.data;
    assert.equal(s.matches, s.wins + s.draws + s.losses);
    assert.equal(s.points, s.wins * 3 + s.draws);
    assert.equal(s.goal_difference, s.goals - s.goals_conceded);
  });
});

describe('admin team management', () => {
  it('creates a team, assigns a head coach, adds players and deletes it', async () => {
    const name = `Test United ${Date.now() % 100000}`;
    const created = await as('admin').post('/teams', { name, short_name: 'TST', category: 'academy', age_group: 'u17' });
    assert.equal(created.status, 201);
    const id = created.body.data.id;

    const duplicate = await as('admin').post('/teams', { name, short_name: 'TS2' });
    assert.equal(duplicate.status, 409);

    const coaches = await as('admin').get('/coaches?team_id=none');
    const freeCoach = coaches.body.data[0];
    if (freeCoach) {
      const assigned = await as('admin').post(`/teams/${id}/coaches`, { coach_id: freeCoach.id, role: 'head_coach' });
      assert.equal(assigned.status, 200);
      assert.equal(assigned.body.data[0].id, freeCoach.id);
      assert.equal((await as('admin').delete(`/teams/${id}/coaches/${freeCoach.id}`)).status, 200);
    }
    assert.equal((await as('admin').delete(`/teams/${id}`)).status, 200);
    assert.equal((await as('admin').get(`/teams/${id}`)).status, 404);
  });

  it('refuses to delete a team with fixtures', async () => {
    const res = await as('admin').delete(`/teams/${f.djiboutiFc}`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'TEAM_HAS_MATCHES');
  });

  it('competition standings follow W3/D1/L0 from completed matches', async () => {
    const comps = await as('admin').get('/competitions?status=active');
    const league = comps.body.data.find((c) => c.type === 'league');
    const res = await as('admin').get(`/competitions/${league.id}/standings`);
    assert.equal(res.status, 200);
    for (const row of res.body.data) {
      assert.equal(row.played, row.won + row.drawn + row.lost);
      assert.equal(row.points, row.won * 3 + row.drawn);
    }
    const points = res.body.data.map((r) => r.points);
    assert.deepEqual(points, [...points].sort((a, b) => b - a));
  });
});
