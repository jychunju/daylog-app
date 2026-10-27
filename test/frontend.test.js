'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { once } = require('node:events');
const vm = require('node:vm');
const { createApp, koreaToday } = require('../server');

test('frontend fetch login, CRUD, autosave, date restrictions, username check and logout', async t => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'daylog-ui-test-'));
  const { app, db } = createApp({ dataDir });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const dom = new JSDOM(readFileSync(path.join(__dirname, '../index.html'), 'utf8'), { url: base, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  t.after(async () => {
    window.close(); await new Promise(resolve => server.close(resolve)); db.close();
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(dataDir).startsWith('daylog-ui-test-'));
    rmSync(dataDir, { recursive: true, force: true });
  });
  let cookie = '', offline = false;
  window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};
  window.fetch = async (url, options = {}) => {
    if (offline) throw new TypeError('offline');
    const response = await fetch(new URL(url, base), { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
    const session = response.headers.get('set-cookie'); if (session) cookie = session.split(';')[0];
    return response;
  };
  const $ = id => window.document.getElementById(id);
  const run = script => vm.runInContext(script, dom.getInternalVMContext());
  function submit(id) { $(id).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }
  async function waitFor(predicate, label) {
    const deadline = Date.now() + 8000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`Timed out: ${label}; ${$('auth-error').textContent}; ${$('status').textContent}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  run(readFileSync(path.join(__dirname, '../app.js'), 'utf8'));
  $('signup-tab').click(); $('auth-name').value = 'Tester'; $('auth-username').value = 'ui-user';
  $('auth-password').value = $('auth-confirm').value = 'test-password-123';
  submit('auth-form');
  assert.ok($('auth-error').textContent.includes('중복 확인'));
  $('username-check').click();
  await waitFor(() => $('username-status').dataset.state === 'available', 'username availability');
  $('auth-username').value = 'ui-user-new';
  $('auth-username').dispatchEvent(new window.Event('input'));
  submit('auth-form');
  assert.ok($('auth-error').textContent.includes('중복 확인'));
  $('auth-username').value = 'ui-user';
  $('auth-username').dispatchEvent(new window.Event('input'));
  $('username-check').click();
  await waitFor(() => $('username-status').dataset.state === 'available', 'username recheck');
  submit('auth-form');
  await waitFor(() => !$('app-shell').hidden, 'signup');
  assert.equal(window.document.querySelectorAll('[data-mood]').length, 8);
  const key = koreaToday();
  assert.equal(run('selectedKey'), key);
  $('schedule-input').value = 'Meeting'; submit('schedule-form');
  await waitFor(() => $('schedule-list').textContent.includes('Meeting'), 'event create');
  $('task-input').value = 'Read'; submit('task-form');
  await waitFor(() => $('task-list').textContent.includes('Read'), 'task create');
  const check = $('task-list').querySelector('input'); check.checked = true;
  check.dispatchEvent(new window.Event('change'));
  await waitFor(() => run('dayRecord().tasks[0].done'), 'task patch');
  $('journal-input').value = 'Saved from the browser'; $('journal-input').dispatchEvent(new window.Event('input'));
  await waitFor(() => db.prepare('SELECT content FROM journals').get()?.content === 'Saved from the browser', 'journal autosave');
  await waitFor(() => run('dirtyJournals.size') === 0, 'autosave finished');
  $('journal-input').value = 'Changed twice'; $('journal-input').dispatchEvent(new window.Event('input'));
  window.document.querySelector('[data-mood]').click();
  run('selectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()+1),false)');
  assert.equal($('journal-section').hidden, true);
  await waitFor(() => db.prepare('SELECT content FROM journals').get().content === 'Changed twice', 'draft flush on date change');
  run('selectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()-1),false)');
  assert.equal($('journal-form').hidden, true); assert.equal($('journal-read-view').hidden, false);
  run('selectDate(today,false)');
  assert.equal($('journal-input').value, 'Changed twice');
  // Failed writes leave the visible input and database unchanged, and show an error.
  offline = true; $('task-input').value = 'Not saved'; submit('task-form');
  await waitFor(() => $('status').textContent.includes('서버'), 'offline notification');
  assert.equal(db.prepare('SELECT count(*) AS n FROM tasks').get().n, 1);
  assert.equal($('task-input').value, 'Not saved'); offline = false;
  run('selectDate(today,false)'); $('schedule-list').querySelector('button').click();
  await waitFor(() => db.prepare('SELECT count(*) AS n FROM events').get().n === 0, 'event delete');
  $('logout-button').click(); await waitFor(() => $('app-shell').hidden, 'logout');
  $('signup-tab').click(); $('auth-username').value = 'ui-user'; $('username-check').click();
  await waitFor(() => $('username-status').dataset.state === 'error', 'duplicate username');
  assert.ok($('username-status').textContent.includes('이미 사용'));
  $('login-tab').click();
  $('auth-username').value = 'ui-user'; $('auth-password').value = 'test-password-123'; submit('auth-form');
  await waitFor(() => !$('app-shell').hidden, 'login');
  assert.equal($('journal-input').value, 'Changed twice');
});
