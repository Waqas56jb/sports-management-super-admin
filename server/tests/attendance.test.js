import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { as, closeDb, fixtures, many, one } from './helpers.js';

let f;
let session;
before(async () => {
  f = await fixtures();
  // A past, recorded Djibouti FC session.
  session = await one(
    `SELECT s.id FROM training_sessions s WHERE s.team_id = $1 AND s.deleted_at IS NULL AND s.status <> 'cancelled' AND s.date < CURRENT_DATE
       AND EXISTS (SELECT 1 FROM training_attendance a WHERE a.training_session_id = s.id) ORDER BY s.date DESC LIMIT 1`,
    [f.djiboutiFc],
  );
});
after(closeDb);

describe('attendance', () => {
  it('coach marks attendance for a session of an assigned team (register PUT)', async () => {
    const lines = await many(`SELECT player_id, status, notes FROM training_attendance WHERE training_session_id = $1`, [session.id]);
    const flipped = lines.map((l, i) => (i === 0 ? { ...l, status: l.status === 'present' ? 'late' : 'present' } : l));
    const res = await as('coach').put(`/training/${session.id}/attendance`, { records: flipped });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const row = await one(`SELECT status, marked_by FROM training_attendance WHERE training_session_id = $1 AND player_id = $2`, [session.id, lines[0].player_id]);
    assert.equal(row.status, flipped[0].status);
    const coach = await one(`SELECT id FROM users WHERE email = 'coach@gmail.com'`);
    assert.equal(row.marked_by, coach.id, 'marked_by records who changed it');
    // restore
    assert.equal((await as('coach').put(`/training/${session.id}/attendance`, { records: lines })).status, 200);
  });

  it('rejects a duplicate attendance record with 409', async () => {
    const line = await one(`SELECT player_id FROM training_attendance WHERE training_session_id = $1 LIMIT 1`, [session.id]);
    const res = await as('coach').post('/attendance', { training_session_id: session.id, player_id: line.player_id, status: 'present' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE_ATTENDANCE');
  });

  it('player cannot modify attendance', async () => {
    const line = await one(`SELECT id, player_id FROM training_attendance WHERE training_session_id = $1 LIMIT 1`, [session.id]);
    assert.equal((await as('player').post('/attendance', { training_session_id: session.id, player_id: f.demoPlayer.id, status: 'present' })).status, 403);
    assert.equal((await as('player').patch(`/attendance/${line.id}`, { status: 'present' })).status, 403);
    assert.equal((await as('player').put(`/training/${session.id}/attendance`, { records: [] })).status, 403);
    assert.equal((await as('player').get('/attendance')).status, 403);
  });

  it('coach cannot mark attendance for another team', async () => {
    const other = await one(`SELECT s.id FROM training_sessions s WHERE s.team_id = $1 AND s.date < CURRENT_DATE AND s.status <> 'cancelled' LIMIT 1`, [f.citySports]);
    const res = await as('coach').put(`/training/${other.id}/attendance`, { records: [] });
    assert.equal(res.status, 403);
  });

  it('cannot take attendance for a future session', async () => {
    const next = await one(`SELECT id FROM training_sessions WHERE team_id = $1 AND date > CURRENT_DATE + 1 AND status <> 'cancelled' AND deleted_at IS NULL LIMIT 1`, [f.djiboutiFc]);
    if (!next) return;
    const res = await as('coach').put(`/training/${next.id}/attendance`, { records: [{ player_id: f.demoPlayer.id, status: 'present' }] });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'SESSION_IN_FUTURE');
  });

  it('player reads only their own attendance with a correct rate', async () => {
    const res = await as('player').get('/player/attendance');
    assert.equal(res.status, 200);
    const s = res.body.data.summary;
    const attended = s.present + s.late;
    const recorded = s.present + s.late + s.absent + s.excused;
    assert.equal(s.rate, Math.round((attended / recorded) * 1000) / 10);
  });
});
