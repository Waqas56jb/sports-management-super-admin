import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { as, closeDb, fixtures, one } from './helpers.js';

let f;
before(async () => {
  f = await fixtures();
});
after(closeDb);

describe('player self-service', () => {
  it('gets the own profile (identity from the token)', async () => {
    const res = await as('player').get('/player/profile');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, f.demoPlayer.id);
    assert.equal(res.body.data.player_code, 'P001');
  });

  it('ignores a playerId query parameter (cannot read someone else)', async () => {
    const res = await as('player').get(`/player/profile?playerId=${f.otherPlayer.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, f.demoPlayer.id);
  });

  it('updates permitted personal fields', async () => {
    const before = await as('player').get('/player/profile');
    const res = await as('player').patch('/player/profile', { address: 'Quartier 5, Djibouti', emergency_contact_phone: '+253 77 40 40 40' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.address, 'Quartier 5, Djibouti');
    await as('player').patch('/player/profile', { address: before.body.data.address, emergency_contact_phone: before.body.data.emergency_contact_phone });
  });

  it('cannot change team, jersey number, status or statistics', async () => {
    for (const body of [{ team_id: f.citySports }, { jersey_number: 10 }, { status: 'active' }, { goals: 99 }, { role: 'admin' }]) {
      const res = await as('player').patch('/player/profile', body);
      assert.equal(res.status, 403, JSON.stringify(body));
      assert.equal(res.body.error.code, 'FIELD_NOT_EDITABLE');
    }
    const p = await one(`SELECT team_id, jersey_number FROM players WHERE id = $1`, [f.demoPlayer.id]);
    assert.equal(p.team_id, f.demoPlayer.team_id);
  });

  it('player A cannot read player B private data', async () => {
    assert.equal((await as('player').get(`/players/${f.otherPlayer.id}`)).status, 403);
    assert.equal((await as('player').get(`/players/${f.otherPlayer.id}/statistics`)).status, 403);
    assert.equal((await as('player').get(`/player/teammates/${f.otherPlayer.id}`)).status, 403);
  });

  it('teammates expose public fields only', async () => {
    const res = await as('player').get(`/player/teammates/${f.teammate.id}`);
    assert.equal(res.status, 200);
    for (const key of ['email', 'phone', 'date_of_birth', 'address', 'emergency_contact_phone']) assert.equal(key in res.body.data, false, key);
    const roster = await as('player').get('/player/team/roster');
    assert.ok(roster.body.data.every((p) => !('email' in p) && !('phone' in p)));
  });

  it('player dashboard is one request with every section', async () => {
    const res = await as('player').get('/dashboard/player');
    assert.equal(res.status, 200);
    for (const key of ['player', 'stats', 'attendance', 'nextMatch', 'upcomingSessions', 'recent', 'schedule', 'series']) assert.ok(key in res.body.data, key);
  });

  it('own statistics come from match events', async () => {
    const res = await as('player').get('/player/statistics');
    assert.equal(res.status, 200);
    const t = res.body.data.totals;
    assert.ok(t.matches_played > 0);
    assert.ok(t.shots_on_target <= t.shots);
    assert.ok(t.completed_passes <= t.passes);
  });
});

describe('admin player management', () => {
  it('creates, updates and soft-deletes a player', async () => {
    const email = `test.player.${Date.now()}@example.com`;
    const created = await as('admin').post('/players', { name: 'Test Player Api', email, position: 'defender', team_id: f.horizon, jersey_number: 88, date_of_birth: '2004-02-02' });
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    assert.match(created.body.data.player_code, /^P\d{3,}$/);
    const membership = await one(`SELECT status FROM team_players WHERE player_id = $1 AND left_at IS NULL`, [id]);
    assert.equal(membership.status, 'active');

    const dup = await as('admin').post('/players', { name: 'Dup Jersey', email: `dup.${Date.now()}@example.com`, team_id: f.horizon, jersey_number: 88 });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'JERSEY_TAKEN');

    const updated = await as('admin').patch(`/players/${id}`, { team_id: f.youngStars });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.team_id, f.youngStars);
    const history = await one(`SELECT count(*)::int AS n FROM team_players WHERE player_id = $1`, [id]);
    assert.equal(history.n, 2, 'membership history kept');

    assert.equal((await as('admin').delete(`/players/${id}`)).status, 200);
    assert.equal((await as('admin').get(`/players/${id}`)).status, 404);
  });

  it('rejects an invalid payload before the database', async () => {
    const res = await as('admin').post('/players', { name: 'X', email: 'bad', jersey_number: 400 });
    assert.equal(res.status, 400);
    const fields = res.body.errors.map((e) => e.field);
    assert.ok(fields.includes('name') && fields.includes('email') && fields.includes('jersey_number'));
  });
});
