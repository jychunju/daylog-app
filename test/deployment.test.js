'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createClient } = require('@libsql/client');
const { createDatabase } = require('../database');
const handler = require('../server');
const { createApp, koreaToday } = handler;

test('Vercel requires a remote database and exports an Express handler', () => {
  assert.equal(typeof handler, 'function');
  assert.equal(typeof handler.use, 'function');
  assert.throws(() => createDatabase({ deployed: true, remoteUrl: '', authToken: '' }), /Vercel requires/);
  assert.throws(() => createDatabase({ deployed: true, remoteUrl: 'file:/tmp/daylog.sqlite', authToken: 'test' }), /must use/);
  assert.throws(() => createDatabase({ deployed: true, remoteUrl: 'libsql://test.invalid', authToken: '' }), /AUTH_TOKEN/);
});

test('async libSQL adapter, HTTPS origin, secure session and cross-instance persistence', async t => {
  // The real SDK executes against memory; no cloud credentials are needed for this integration test.
  const client = createClient({ url: 'file::memory:' });
  const options = { deployed: true, remoteUrl: 'libsql://test.invalid', authToken: 'test', remoteClient: client };
  const first = createApp(options), second = createApp(options);
  const servers = [first.app.listen(0, '127.0.0.1'), second.app.listen(0, '127.0.0.1')];
  await Promise.all(servers.map(server => once(server, 'listening')));
  t.after(async () => { await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))); client.close(); });
  async function request(instance, url, { method = 'GET', body, cookie, origin = `https://127.0.0.1:${servers[instance].address().port}` } = {}) {
    const res = await fetch(`http://127.0.0.1:${servers[instance].address().port}${url}`, {
      method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const raw = await res.text();
    return { status: res.status, data: raw ? JSON.parse(raw) : null, cookie: res.headers.get('set-cookie') };
  }
  assert.equal((await request(0, '/api/health')).status, 200);
  const registered = await request(0, '/api/auth/register', { method: 'POST', body: { username: 'remote-user', name: 'Remote', password: 'test-password-123' } });
  assert.equal(registered.status, 201);
  assert.match(registered.cookie, /HttpOnly/i); assert.match(registered.cookie, /Secure/i); assert.match(registered.cookie, /SameSite=Strict/i);
  const cookie = registered.cookie.split(';')[0];
  assert.equal((await request(1, '/api/auth/me', { cookie })).data.user.username, 'remote-user');
  assert.equal((await request(1, '/api/auth/username-availability?username=REMOTE-USER')).data.available, false);
  const values = { date: koreaToday(), title: "Read 'a book'", done: false };
  const task = await request(0, '/api/tasks', { method: 'POST', cookie, body: values });
  assert.equal(task.status, 201);
  assert.equal((await request(1, `/api/tasks/${task.data.id}`, { cookie })).data.title, values.title);
  assert.equal((await request(1, `/api/tasks/${task.data.id}`, { method: 'PATCH', cookie, body: { done: true } })).data.done, true);
  assert.equal((await request(0, '/api/records', { cookie })).data.records[values.date].tasks[0].done, true);
  const journal = await request(1, '/api/journals', { method: 'POST', cookie, body: { date: values.date, content: 'Remote diary', mood: '평온' } });
  assert.equal(journal.status, 201);
  assert.equal((await request(0, '/api/journals', { method: 'POST', cookie, body: { date: values.date, content: 'Duplicate', mood: '' } })).status, 409);
  assert.equal((await request(0, '/api/tasks', { method: 'POST', cookie, origin: 'https://evil.example', body: values })).status, 403);
  assert.equal((await request(1, `/api/tasks/${task.data.id}`, { method: 'DELETE', cookie })).status, 204);
  assert.equal((await request(0, '/api/auth/logout', { method: 'POST', cookie })).status, 204);
  assert.equal((await request(1, '/api/auth/me', { cookie })).status, 401);
  // Signup checks share the same DB-backed rate limit across instances.
  for (let index = 0; index < 32; index++) await request(index % 2, '/api/auth/username-availability?username=check');
  assert.equal((await request(0, '/api/auth/username-availability?username=check')).status, 429);
});
