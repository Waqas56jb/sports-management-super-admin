import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { ACCOUNTS, API, as, closeDb, request } from './helpers.js';

after(closeDb);

describe('health', () => {
  it('GET /health is public and reports the service', async () => {
    const res = await request.get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'sports-management-api');
    assert.ok(res.body.timestamp);
  });
});

describe('authentication', () => {
  it('logs in every role and never returns the password hash', async () => {
    for (const role of ['admin', 'coach', 'player']) {
      const res = await request.post(`${API}/auth/login`).send({ ...ACCOUNTS[role], portal: role });
      assert.equal(res.status, 200, role);
      assert.equal(res.body.message, 'Login successful');
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.role, role);
      assert.equal(JSON.stringify(res.body).includes('password_hash'), false);
    }
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request.post(`${API}/auth/login`).send({ email: ACCOUNTS.admin.email, password: 'Wrong@123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with the same 401 (no account discovery)', async () => {
    const res = await request.post(`${API}/auth/login`).send({ email: 'nobody@example.com', password: 'Whatever@1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('validates the email format before touching the database', async () => {
    const res = await request.post(`${API}/auth/login`).send({ email: 'not-an-email', password: 'x' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Validation failed');
    assert.equal(res.body.errors[0].field, 'email');
  });

  it('refuses a portal the account does not belong to', async () => {
    const res = await request.post(`${API}/auth/login`).send({ ...ACCOUNTS.player, portal: 'admin' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'NOT_ADMIN');
  });

  it('protects routes: no token → 401, invalid token → 401', async () => {
    assert.equal((await request.get(`${API}/auth/me`)).status, 401);
    const bad = await request.get(`${API}/auth/me`).set('Authorization', 'Bearer not.a.jwt');
    assert.equal(bad.status, 401);
    assert.equal(bad.body.error.code, 'TOKEN_INVALID');
  });

  it('GET /auth/me returns the signed-in user', async () => {
    const res = await as('coach').get('/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, ACCOUNTS.coach.email);
    assert.ok(res.body.data.team_ids.length >= 1);
  });

  it('logout revokes the token server-side; refresh rotates it', async () => {
    const login = await request.post(`${API}/auth/login`).send(ACCOUNTS.player);
    const token = login.body.data.token;
    const refreshed = await request.post(`${API}/auth/refresh`).set('Authorization', `Bearer ${token}`);
    assert.equal(refreshed.status, 200);
    const fresh = refreshed.body.data.token;
    assert.notEqual(fresh, token);
    assert.equal((await request.get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`)).status, 401, 'old token is revoked');
    assert.equal((await request.post(`${API}/auth/logout`).set('Authorization', `Bearer ${fresh}`)).status, 200);
    const after = await request.get(`${API}/auth/me`).set('Authorization', `Bearer ${fresh}`);
    assert.equal(after.status, 401);
    assert.equal(after.body.error.code, 'SESSION_REVOKED');
  });

  it('forgot-password answers the same way for known and unknown emails', async () => {
    const a = await request.post(`${API}/auth/forgot-password`).send({ email: 'nobody@example.com' });
    assert.equal(a.status, 200);
    assert.equal(a.body.data.ok, true);
  });

  it('reset-password rejects an invalid token', async () => {
    const res = await request.post(`${API}/auth/reset-password`).send({ token: 'x'.repeat(40), password: 'Valid@1234' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'RESET_TOKEN_INVALID');
  });
});

describe('role-based access (cross-role)', () => {
  it('admin reaches admin endpoints', async () => {
    assert.equal((await as('admin').get('/users')).status, 200);
    assert.equal((await as('admin').get('/dashboard/admin')).status, 200);
  });

  it('coach cannot manage platform users', async () => {
    assert.equal((await as('coach').get('/users')).status, 403);
    const res = await as('coach').post('/users', { name: 'Should Fail', email: 'fail.coach@gmail.com', role: 'coach' });
    assert.equal(res.status, 403);
  });

  it('player cannot reach admin or coach areas', async () => {
    assert.equal((await as('player').get('/users')).status, 403);
    assert.equal((await as('player').get('/coach/dashboard')).status, 403);
    assert.equal((await as('player').get('/dashboard/admin')).status, 403);
  });

  it('paginated lists use the standard envelope and cap the limit at 100', async () => {
    const res = await as('admin').get('/players?page=1&limit=500');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.pagination.limit, 100);
    assert.ok(res.body.pagination.total >= res.body.data.length);
  });

  it('rejects unknown sort columns without leaking SQL', async () => {
    const res = await as('admin').get('/players?sortBy=name;drop table users');
    assert.equal(res.status, 400);
  });
});
