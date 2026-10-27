'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp, koreaToday } = require('../server');

async function fixture(t, existingDir) {
  const dataDir = existingDir || mkdtempSync(path.join(tmpdir(), 'daylog-test-'));
  const { app, db } = createApp({ dataDir });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let stopped = false;
  async function close() { if (!stopped) { stopped = true; await new Promise(resolve => server.close(resolve)); db.close(); } }
  t.after(async () => {
    await close();
    if (!existingDir) {
      assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep));
      assert.ok(path.basename(dataDir).startsWith('daylog-test-'));
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
  async function request(url, { method = 'GET', body, cookie, headers = {} } = {}) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const content = await response.text();
    return { status: response.status, data: content && response.headers.get('content-type')?.includes('json') ? JSON.parse(content) : content, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function register(username = 'tester') {
    const result = await request('/api/auth/register', { method: 'POST', body: { username, password: 'test-password-123', name: username } });
    assert.equal(result.status, 201); return result.cookie;
  }
  return { request, register, db, dataDir, close, base };
}

test('events/tasks/journals CRUD, date filtering, ownership and validation', async t => {
  const { request, register } = await fixture(t);
  assert.equal((await request('/api/events')).status, 401);
  const cookie = await register(); const other = await register('other');
  const date = koreaToday();
  for (const [kind, values, change] of [
    ['events', { date, time: '09:30', title: "Meeting'); DROP TABLE events; --" }, { time: '10:15' }],
    ['tasks', { date, title: 'Read', done: false }, { done: true }],
    ['journals', { date, content: 'A calm day', mood: '평온' }, { content: 'Updated' }]
  ]) {
    const created = await request(`/api/${kind}`, { method: 'POST', cookie, body: values });
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.equal((await request(`/api/${kind}?date=${date}`, { cookie })).data.length, 1);
    assert.equal((await request(`/api/${kind}?date=2001-01-01`, { cookie })).data.length, 0);
    assert.equal((await request(`/api/${kind}/${id}`, { cookie })).data.id, id);
    for (const method of ['GET', 'PATCH', 'DELETE']) assert.equal((await request(`/api/${kind}/${id}`, { method, cookie: other, ...(method === 'PATCH' ? { body: change } : {}) })).status, 404);
    assert.equal((await request(`/api/${kind}/${id}`, { method: 'PATCH', cookie, body: change })).status, 200);
    assert.equal((await request(`/api/${kind}/${id}`, { cookie })).data[Object.keys(change)[0]], Object.values(change)[0]);
    assert.equal((await request(`/api/${kind}/${id}`, { method: 'DELETE', cookie })).status, 204);
    assert.equal((await request(`/api/${kind}/${id}`, { cookie })).status, 404);
  }
  assert.equal((await request('/api/events', { method: 'POST', cookie, body: { date: '2026-02-30', time: '25:00', title: 'Bad' } })).status, 400);
  assert.equal((await request('/api/tasks', { method: 'POST', cookie, body: { date, title: 'Bad', done: 'false' } })).status, 400);
  assert.equal((await request('/api/events?date=not-a-date', { cookie })).status, 400);
  assert.equal((await request('/api/tasks', { method: 'POST', cookie, body: { date, title: ' ', done: false } })).status, 400);
  assert.equal((await request('/api/tasks', { method: 'POST', cookie, body: { date, title: 'Ok', done: false, user_id: 'other' } })).status, 400);
  assert.equal((await request('/api/journals', { method: 'POST', cookie, body: { date: '2001-01-01', content: 'Past', mood: '' } })).status, 403);
  assert.equal((await request('/api/journals', { method: 'POST', cookie, body: { date: '2999-01-01', content: 'Future', mood: '' } })).status, 403);
  assert.equal((await request('/api/tasks', { method: 'POST', cookie, headers: { Origin: 'https://other.example' }, body: { date, title: 'Bad', done: false } })).status, 403);
});

test('username availability, case normalization and concurrent duplicate signup prevention', async t => {
  const { request, register } = await fixture(t);
  assert.equal((await request('/api/auth/username-availability?username=free-user')).data.available, true);
  await register('taken-user');
  assert.equal((await request('/api/auth/username-availability?username=TAKEN-USER')).data.available, false);
  for (const username of ['', 'has space', 'x'.repeat(255)]) assert.equal((await request(`/api/auth/username-availability?username=${encodeURIComponent(username)}`)).status, 400);
  const body = { username: 'race-user', name: 'Race', password: 'test-password-123' };
  const results = await Promise.all([
    request('/api/auth/register', { method: 'POST', body }),
    request('/api/auth/register', { method: 'POST', body: { ...body, username: 'RACE-USER' } })
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await request('/api/auth/username-availability?username=race-user')).data.available, false);
});

test('disk persistence, server sessions, password hashing, static file protection', async t => {
  const first = await fixture(t); const cookie = await first.register();
  await first.request('/api/tasks', { method: 'POST', cookie, body: { date: koreaToday(), title: 'Persist', done: false } });
  const user = first.db.prepare('SELECT * FROM users').get();
  assert.notEqual(user.password_hash, 'test-password-123');
  assert.equal((await first.request('/api/auth/login', { method: 'POST', body: { username: 'tester', password: 'wrong-password' } })).status, 401);
  for (const file of ['/data/daylog.sqlite', '/server.js', '/package.json', '/node_modules/express/package.json']) assert.equal((await first.request(file)).status, 404);
  assert.equal((await first.request('/')).status, 200);
  await first.close();
  const second = await fixture(t, first.dataDir);
  assert.equal((await second.request('/api/tasks', { cookie })).data[0].title, 'Persist');
  assert.equal((await second.request('/api/auth/me', { cookie })).status, 200);
  assert.equal((await second.request('/api/auth/logout', { method: 'POST', cookie })).status, 204);
  assert.equal((await second.request('/api/tasks', { cookie })).status, 401);
  await second.close();
});
