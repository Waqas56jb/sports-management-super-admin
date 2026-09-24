import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { as, closeDb, fixtures } from './helpers.js';

let f;
before(async () => {
  f = await fixtures();
});
after(closeDb);

const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe('training sessions', () => {
  it('coach creates, edits, cancels and reinstates a session for an assigned team', async () => {
    const date = future(200 + (Date.now() % 50));
    const created = await as('coach').post('/training', { team_id: f.youngStars, training_type: 'tactical', date, start_time: '06:00', end_time: '07:30', location: 'Test pitch' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data.id;
    assert.equal(created.body.data.training_type, 'tactical');

    const overlap = await as('coach').post('/training', { team_id: f.youngStars, training_type: 'fitness', date, start_time: '07:00', end_time: '08:00' });
    assert.equal(overlap.status, 422);
    assert.equal(overlap.body.error.code, 'TRAINING_OVERLAP');

    const updated = await as('coach').patch(`/training/${id}`, { training_type: 'technical', end_time: '08:00' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.end_time, '08:00');

    const cancelled = await as('coach').post(`/training/${id}/cancel`, { reason: 'Test' });
    assert.equal(cancelled.body.data.status, 'cancelled');
    const restored = await as('coach').post(`/training/${id}/restore`);
    assert.equal(restored.body.data.status, 'scheduled');

    assert.equal((await as('coach').delete(`/training/${id}`)).status, 403, 'only admins delete');
    assert.equal((await as('admin').delete(`/training/${id}`)).status, 200);
  });

  it('coach cannot create training for an unassigned team', async () => {
    const res = await as('coach').post('/training', { team_id: f.citySports, training_type: 'fitness', date: future(300), start_time: '08:00', end_time: '09:00' });
    assert.equal(res.status, 403);
  });

  it('validates the time range', async () => {
    const res = await as('coach').post('/training', { team_id: f.djiboutiFc, training_type: 'fitness', date: future(301), start_time: '10:00', end_time: '09:00' });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].field, 'end_time');
  });

  it('players have read-only access and never see coach notes', async () => {
    const list = await as('player').get('/player/training?tab=completed');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length > 0);
    const s = list.body.data[0];
    assert.equal('notes' in s, false);
    assert.ok(s.my_attendance === null || ['present', 'absent', 'late', 'excused', 'pending'].includes(s.my_attendance.status));
    const create = await as('player').post('/training', { team_id: f.demoPlayer.team_id, training_type: 'fitness', date: future(302), start_time: '08:00', end_time: '09:00' });
    assert.equal(create.status, 403);
    assert.equal((await as('player').patch(`/training/${s.id}`, { location: 'x' })).status, 403);
  });

  it('calendar returns normalised events for the caller only', async () => {
    const res = await as('player').get(`/calendar?date_from=${future(-30)}&date_to=${future(30)}`);
    assert.equal(res.status, 200);
    const e = res.body.data[0];
    for (const key of ['id', 'type', 'title', 'start_at', 'referenceId']) assert.ok(key in e, key);
  });
});
