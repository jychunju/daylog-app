'use strict';

const ACCOUNTS_KEY = 'daylog-accounts-v1';
let currentAccount = null;
let authMode = 'login';
const today = new Date();
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayKey = dateKey(today);
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedKey = todayKey;
let records = {};
let toastTimer;
const $ = id => document.getElementById(id);

function notify(message) {
  $('status').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('status').textContent = ''; }, 3500);
}

function dayRecord(key = selectedKey) {
  if (!records[key]) records[key] = { schedules: [], tasks: [], journal: '', mood: '' };
  return records[key];
}

let mutationQueue = Promise.resolve();
const journalTimers = new Map();
const dirtyJournals = new Set();
const journalVersions = new Map();
let pendingMutations = 0;

async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers } });
  } catch { throw new Error('서버에 연결할 수 없어요. 서버 실행 상태를 확인해 주세요.'); }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || '요청을 처리하지 못했어요.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function mutate(work) {
  pendingMutations++;
  const operation = mutationQueue.then(work);
  mutationQueue = operation.catch(() => {});
  return operation.catch(error => { notify(error.message); return null; }).finally(() => { pendingMutations--; });
}

function saveJournal(key = selectedKey) {
  clearTimeout(journalTimers.get(key));
  journalTimers.delete(key);
  if (!dirtyJournals.has(key)) return mutationQueue.then(() => true);
  const day = records[key];
  const version = journalVersions.get(key);
  const body = { date: key, content: day.journal, mood: day.mood };
  return mutate(async () => {
    const id = day.journalId;
    const saved = await api(id ? `/api/journals/${id}` : '/api/journals', {
      method: id ? 'PATCH' : 'POST', body: JSON.stringify(body)
    });
    day.journalId = saved.id;
    if (journalVersions.get(key) === version) dirtyJournals.delete(key);
    if (key === selectedKey) updateJournalState();
    return true;
  });
}

function scheduleJournalSave() {
  const key = selectedKey;
  dirtyJournals.add(key);
  journalVersions.set(key, (journalVersions.get(key) || 0) + 1);
  clearTimeout(journalTimers.get(key));
  journalTimers.set(key, setTimeout(() => saveJournal(key), 500));
}

window.addEventListener('beforeunload', event => {
  if (dirtyJournals.size || pendingMutations) { event.preventDefault(); event.returnValue = ''; }
});

function renderMetrics() {
  const prefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}-`;
  const days = Object.entries(records).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
  $('schedule-total').textContent = days.reduce((sum, day) => sum + day.schedules.length, 0);
  $('task-completed').textContent = days.reduce((sum, day) => sum + day.tasks.filter(task => task.done).length, 0);
  $('task-total').textContent = ` / ${days.reduce((sum, day) => sum + day.tasks.length, 0)}`;
  $('journal-total').textContent = days.filter(day => day.journal.trim()).length;
}

function dueSoon(key) {
  const [year, month, day] = key.split('-').map(Number);
  const difference = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return difference >= 0 && difference <= 3 ? difference : null;
}

function dueLabel(days) {
  return days === 0 ? '오늘' : days === 1 ? '내일' : `D-${days}`;
}

function renderUpcoming() {
  const upcoming = Object.entries(records)
    .filter(([key, day]) => dueSoon(key) !== null && day.tasks.some(task => !task.done))
    .sort(([a], [b]) => a.localeCompare(b));
  $('upcoming-section').hidden = !upcoming.length;
  $('upcoming-list').replaceChildren();
  for (const [key, day] of upcoming) {
    const pending = day.tasks.filter(task => !task.done);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upcoming-item';
    const badge = document.createElement('span');
    badge.className = 'due-badge';
    badge.textContent = dueLabel(dueSoon(key));
    const title = document.createElement('span');
    title.className = 'upcoming-name';
    title.textContent = pending[0].title;
    const count = document.createElement('span');
    count.className = 'upcoming-count';
    count.textContent = pending.length > 1 ? `외 ${pending.length - 1}개 ›` : '›';
    button.setAttribute('aria-label', `${key}, ${dueLabel(dueSoon(key))}, 미완료 할 일 ${pending.length}개: ${pending.map(task => task.title).join(', ')}`);
    button.append(badge, title, count);
    button.addEventListener('click', () => {
      const [year, month, date] = key.split('-').map(Number);
      selectDate(new Date(year, month - 1, date), true);
      $('task-input').focus({ preventScroll: true });
    });
    $('upcoming-list').append(button);
  }
}

function renderCalendar(focusKey) {
  $('month-title').textContent = `${visibleMonth.getFullYear()}년 ${visibleMonth.getMonth() + 1}월`;
  $('calendar-grid').setAttribute('aria-label', `${$('month-title').textContent} 날짜`);
  const firstWeekday = visibleMonth.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < cellCount; index++) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstWeekday + 1);
    const key = dateKey(date);
    const day = records[key];
    const pending = day?.tasks.filter(task => !task.done).length || 0;
    const urgent = pending > 0 && dueSoon(key) !== null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day';
    button.dataset.date = key;
    button.classList.toggle('outside', date.getMonth() !== visibleMonth.getMonth());
    button.classList.toggle('today', key === todayKey);
    button.classList.toggle('selected', key === selectedKey && !$('detail-panel').hidden);
    button.classList.toggle('sunday', date.getDay() === 0);
    button.classList.toggle('due-soon', urgent);
    button.setAttribute('aria-pressed', String(key === selectedKey && !$('detail-panel').hidden));
    if (key === todayKey) button.setAttribute('aria-current', 'date');
    button.setAttribute('aria-label', `${date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}${key === todayKey ? ', 오늘' : ''}, 일정 ${day?.schedules.length || 0}개, 할 일 ${day?.tasks.length || 0}개${day?.journal ? ', 일기 있음' : ''}`);
    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = date.getDate();
    button.append(number);
    if (urgent) {
      const badge = document.createElement('span');
      badge.className = 'day-due';
      badge.textContent = `할 일 ${pending}`;
      badge.title = `${dueLabel(dueSoon(key))}까지 완료할 일 ${pending}개`;
      button.append(badge);
    }
    if (day) {
      day.schedules.slice(0, 2).forEach(schedule => {
        const preview = document.createElement('span');
        preview.className = 'day-preview';
        preview.textContent = schedule.title;
        button.append(preview);
      });
      const dots = document.createElement('span');
      dots.className = 'day-dots';
      dots.setAttribute('aria-hidden', 'true');
      for (const [exists, type] of [[day.schedules.length, 'schedule'], [day.tasks.length, 'task'], [day.journal.trim(), 'journal']]) {
        if (exists) {
          const dot = document.createElement('i');
          dot.className = `dot ${type}-dot`;
          dots.append(dot);
        }
      }
      button.append(dots);
    }
    button.addEventListener('click', () => selectDate(date, true));
    button.addEventListener('keydown', event => {
      const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      if (offset === undefined) return;
      event.preventDefault();
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
      selectDate(target, false);
      $('calendar-grid').querySelector(`[data-date="${dateKey(target)}"]`)?.focus();
    });
    fragment.append(button);
  }
  $('calendar-grid').replaceChildren(fragment);
  renderMetrics();
  renderUpcoming();
  if (focusKey) $('calendar-grid').querySelector(`[data-date="${focusKey}"]`)?.focus();
}

function deleteButton(label, callback) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'delete-entry';
  button.textContent = '×';
  button.setAttribute('aria-label', `${label} 삭제`);
  button.addEventListener('click', callback);
  return button;
}

function emptyItem(text) {
  const item = document.createElement('li');
  item.className = 'empty';
  item.textContent = text;
  return item;
}

function renderEntries() {
  const day = dayRecord();
  $('schedule-count').textContent = `${day.schedules.length}건`;
  $('task-count').textContent = `${day.tasks.filter(task => !task.done).length}개 남음`;
  $('schedule-list').replaceChildren();
  $('task-list').replaceChildren();
  for (const schedule of [...day.schedules].sort((a, b) => a.time.localeCompare(b.time))) {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = schedule.time;
    time.textContent = schedule.time;
    const title = document.createElement('span');
    title.className = 'entry-text';
    title.textContent = schedule.title;
    item.append(time, title, deleteButton(schedule.title, () => mutate(async () => {
      await api(`/api/events/${schedule.id}`, { method: 'DELETE' });
      day.schedules = day.schedules.filter(entry => entry.id !== schedule.id);
      renderEntries(); renderCalendar();
    })));
    $('schedule-list').append(item);
  }
  for (const task of day.tasks) {
    const item = document.createElement('li');
    item.classList.toggle('completed', task.done);
    item.classList.toggle('task-due', !task.done && dueSoon(selectedKey) !== null);
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = task.done;
    check.setAttribute('aria-label', `${task.title} 완료`);
    check.addEventListener('change', () => {
      const done = check.checked;
      check.disabled = true;
      mutate(async () => {
        await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
        task.done = done;
        renderEntries(); renderCalendar();
      }).finally(() => { check.checked = task.done; check.disabled = false; });
    });
    const title = document.createElement('span');
    title.className = 'entry-text';
    title.textContent = task.title;
    const due = document.createElement('span');
    due.className = 'task-due-label';
    due.textContent = dueSoon(selectedKey) !== null ? dueLabel(dueSoon(selectedKey)) : '';
    item.append(check, title, due, deleteButton(task.title, () => mutate(async () => {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      day.tasks = day.tasks.filter(entry => entry.id !== task.id);
      renderEntries(); renderCalendar();
    })));
    $('task-list').append(item);
  }
  if (!day.schedules.length) $('schedule-list').append(emptyItem('아직 일정이 없어요. 여유로운 하루를 계획해 보세요.'));
  if (!day.tasks.length) $('task-list').append(emptyItem('작은 할 일부터 가볍게 시작해 보세요.'));
}

function canWriteJournal() {
  return currentAccount !== null && selectedKey === dateKey(new Date());
}

function updateJournalState() {
  const day = dayRecord();
  const writable = canWriteJournal();
  const past = selectedKey < dateKey(new Date());
  $('journal-section').hidden = selectedKey > dateKey(new Date());
  $('journal-form').hidden = !writable;
  $('journal-moods').hidden = !writable;
  $('journal-read-view').hidden = !past;
  $('journal-read-text').textContent = day.journal.trim() ? day.journal : '이날 남긴 일기가 없어요.';
  const selectedMood = Array.from(document.querySelectorAll('[data-mood]')).find(button => button.dataset.mood === day.mood);
  $('journal-read-mood').textContent = day.mood ? `${selectedMood?.textContent || ''} ${day.mood}` : '기록된 감정이 없어요.';
  $('journal-input').readOnly = !writable;
  $('journal-input').placeholder = writable ? '오늘 있었던 일을 편안하게 기록해 주세요. 소소한 순간도, 마음에 남은 이야기도 좋아요.' : past ? '이날 남긴 일기가 없어요.' : '이날의 이야기는 당일에 남길 수 있어요.';
  $('journal-save').hidden = !writable;
  $('journal-access-note').textContent = writable ? '오늘의 이야기는 오늘만 쓸 수 있어요. 편안하게 남겨주세요.' : past ? '지난 일기는 수정할 수 없어요. 그날의 마음을 읽어보세요.' : '일기와 감정은 해당 날짜에만 기록할 수 있어요.';
  $('journal-state').textContent = dirtyJournals.has(selectedKey) ? '저장 필요' : writable ? (day.journal.trim() ? '저장됨' : '기록 대기') : past ? '읽기 전용' : '작성 전';
  $('char-counter').textContent = `${$('journal-input').value.length} / 1,000자`;
  document.querySelectorAll('[data-mood]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.mood === day.mood));
    button.disabled = !writable;
  });
}

function selectDate(date, scroll) {
  if (journalTimers.has(selectedKey)) saveJournal(selectedKey);
  selectedKey = dateKey(date);
  visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  $('detail-panel').hidden = false;
  $('detail-weekday').textContent = `${date.getFullYear()}년 · ${date.toLocaleDateString('ko-KR', { weekday: 'long' })}${selectedKey === todayKey ? ' · 오늘' : ''}`;
  const displayDate = `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}(${date.toLocaleDateString('ko-KR', { weekday: 'short' })})`;
  $('detail-title').textContent = displayDate;
  $('task-date-title').textContent = `${displayDate}까지 해야 할 일`;
  $('schedule-input').value = '';
  $('task-input').value = '';
  $('journal-input').value = dayRecord().journal;
  renderEntries(); updateJournalState(); renderCalendar();
  if (scroll && window.matchMedia('(max-width: 800px)').matches) {
    $('detail-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
}

function moveMonth(offset) {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
  renderCalendar();
}

$('previous-month').addEventListener('click', () => moveMonth(-1));
$('next-month').addEventListener('click', () => moveMonth(1));
['today-button', 'header-today'].forEach(id => $(id).addEventListener('click', () => selectDate(today, false)));
$('close-panel').addEventListener('click', () => {
  $('detail-panel').hidden = true;
  renderCalendar(selectedKey);
});
$('detail-panel').addEventListener('keydown', event => {
  if (event.key === 'Escape') $('close-panel').click();
});

$('schedule-form').addEventListener('submit', async event => {
  event.preventDefault();
  const title = $('schedule-input').value.trim();
  if (!title) return $('schedule-input').focus();
  const key = selectedKey;
  const day = dayRecord(key);
  const time = $('schedule-time').textContent;
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    const saved = await mutate(async () => {
      const row = await api('/api/events', { method: 'POST', body: JSON.stringify({ date: key, time, title }) });
      day.schedules.push({ id: row.id, time: row.time, title: row.title });
      return row;
    });
    if (saved && key === selectedKey) { $('schedule-input').value = ''; renderEntries(); }
    renderCalendar();
  } finally { if (button) button.disabled = false; }
});
$('task-form').addEventListener('submit', async event => {
  event.preventDefault();
  const title = $('task-input').value.trim();
  if (!title) return $('task-input').focus();
  const key = selectedKey;
  const day = dayRecord(key);
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    const saved = await mutate(async () => {
      const row = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ date: key, title, done: false }) });
      day.tasks.push({ id: row.id, title: row.title, done: row.done });
      return row;
    });
    if (saved && key === selectedKey) { $('task-input').value = ''; renderEntries(); }
    renderCalendar();
  } finally { if (button) button.disabled = false; }
});
document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', () => {
  if (!canWriteJournal()) { updateJournalState(); return; }
  dayRecord().mood = dayRecord().mood === button.dataset.mood ? '' : button.dataset.mood;
  scheduleJournalSave(); updateJournalState();
}));
$('journal-input').addEventListener('input', () => {
  if (!canWriteJournal()) { $('journal-input').value = dayRecord().journal; updateJournalState(); return; }
  dayRecord().journal = $('journal-input').value;
  scheduleJournalSave(); updateJournalState(); renderCalendar();
});
$('journal-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!canWriteJournal()) { updateJournalState(); return; }
  dayRecord().journal = $('journal-input').value;
  if (await saveJournal()) notify('하루의 기록을 저장했어요.');
  updateJournalState(); renderCalendar();
});
$('today-month').textContent = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}`;
$('today-day').textContent = today.getDate();
$('today-weekday').textContent = today.toLocaleDateString('ko-KR', { weekday: 'long' });

// Used only to verify an existing local account before creating its server account.
function readAccounts() {
  const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  if (!Array.isArray(accounts)) throw new Error('Invalid accounts');
  return accounts;
}

async function passwordVerifier(password, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 210000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}

let checkedUsername = '';
let checkVersion = 0;
function resetUsernameCheck() {
  checkedUsername = '';
  checkVersion++;
  $('username-status').textContent = '';
  $('username-status').dataset.state = '';
  $('username-check').disabled = false;
}
$('auth-username').addEventListener('input', resetUsernameCheck);
$('username-check').addEventListener('click', async () => {
  const username = $('auth-username').value.trim().toLowerCase();
  resetUsernameCheck();
  const version = checkVersion;
  if (!username || /\s/.test(username)) {
    $('username-status').textContent = '아이디는 공백 없이 입력해 주세요.';
    $('username-status').dataset.state = 'error';
    return;
  }
  $('username-check').disabled = true;
  $('username-status').textContent = '확인하고 있어요…';
  try {
    const result = await api(`/api/auth/username-availability?username=${encodeURIComponent(username)}`);
    if (version !== checkVersion || authMode !== 'signup') return;
    checkedUsername = result.available ? result.username : '';
    $('username-status').textContent = result.available ? '사용할 수 있는 아이디예요.' : '이미 사용 중인 아이디예요.';
    $('username-status').dataset.state = result.available ? 'available' : 'error';
  } catch (error) {
    if (version !== checkVersion) return;
    $('username-status').textContent = error.message;
    $('username-status').dataset.state = 'error';
  } finally {
    if (version === checkVersion) $('username-check').disabled = false;
  }
});

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  resetUsernameCheck();
  $('username-check').hidden = !signup;
  $('username-status').hidden = !signup;
  $('login-tab').setAttribute('aria-pressed', String(!signup));
  $('signup-tab').setAttribute('aria-pressed', String(signup));
  $('name-field').hidden = !signup;
  $('confirm-field').hidden = !signup;
  $('auth-name').required = signup;
  $('auth-confirm').required = signup;
  $('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
  $('auth-password').value = '';
  $('auth-confirm').value = '';
  $('auth-error').textContent = '';
  $('auth-title').textContent = signup ? '회원가입' : '로그인';
  $('auth-submit').textContent = signup ? '데이로그 시작하기' : '내 데이로그 열기';

}

function openAccount(account, loadedRecords) {
  currentAccount = account;
  records = loadedRecords;
  $('account-name').textContent = `${account.name}님의 데이로그`;
  $('auth-page').hidden = true;
  $('app-shell').hidden = false;
  $('auth-form').reset();
  selectDate(today, false);
  $('header-today').focus();
}

$('login-tab').addEventListener('click', () => setAuthMode('login'));
$('signup-tab').addEventListener('click', () => setAuthMode('signup'));
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const signup = authMode === 'signup';
  const username = $('auth-username').value.trim().toLowerCase();
  const password = $('auth-password').value;
  const name = $('auth-name').value.trim();
  if (!username || /\s/.test(username)) { $('auth-error').textContent = '아이디는 공백 없이 입력해 주세요.'; return; }
  $('auth-error').textContent = '';
  if (signup && !name) { $('auth-error').textContent = '이름을 입력해 주세요.'; return; }
  if (signup && checkedUsername !== username) { $('auth-error').textContent = '아이디 중복 확인을 먼저 해주세요.'; $('username-check').focus(); return; }
  if (signup && password !== $('auth-confirm').value) { $('auth-error').textContent = '비밀번호가 서로 달라요. 다시 확인해 주세요.'; return; }
  $('auth-submit').disabled = true;
  $('login-tab').disabled = true;
  $('signup-tab').disabled = true;
  try {
    let result;
    if (signup) {
      result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, name }) });
    } else {
      try {
        result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      } catch (error) {
        if (error.status !== 401) throw error;
        // Legacy account credentials never leave the browser. Only a verified password is reused.
        let legacy;
        try { legacy = readAccounts().find(entry => (entry.username || entry.email || '').toLowerCase() === username); } catch {}
        if (!legacy || !crypto.subtle || await passwordVerifier(password, legacy.salt) !== legacy.verifier) throw error;
        result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, name: legacy.name }) });
      }
    }
    const loaded = await api('/api/records');
    openAccount(result.user, loaded.records);
  } catch (error) {
    $('auth-error').textContent = error.message;
  } finally {
    $('auth-submit').disabled = false;
    $('login-tab').disabled = false;
    $('signup-tab').disabled = false;
  }
});
$('logout-button').addEventListener('click', async () => {
  $('logout-button').disabled = true;
  $('app-shell').inert = true;
  try {
    for (const key of dirtyJournals) if (!await saveJournal(key)) return;
    await mutationQueue;
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) { notify(error.message); return; }
  finally { $('logout-button').disabled = false; $('app-shell').inert = false; }
  currentAccount = null;
  records = {};
  $('app-shell').hidden = true;
  $('auth-page').hidden = false;
  $('journal-input').value = '';
  $('schedule-list').replaceChildren();
  $('task-list').replaceChildren();
  $('calendar-grid').replaceChildren();
  $('account-name').textContent = '';
  $('auth-form').reset();
  setAuthMode('login');
  $('auth-username').focus();
});

for (const [id, count] of [['time-hour', 24], ['time-minute', 60]]) {
  for (let number = 0; number < count; number++) {
    const option = document.createElement('option');
    option.value = option.textContent = String(number).padStart(2, '0');
    $(id).append(option);
  }
}
$('schedule-time').addEventListener('click', () => {
  const [hour, minute] = $('schedule-time').textContent.split(':');
  $('time-hour').value = hour;
  $('time-minute').value = minute;
  $('time-dialog').returnValue = '';
  $('time-dialog').showModal();
  for (const id of ['time-hour', 'time-minute']) {
    const select = $(id);
    select.scrollTop = Math.max(0, (select.selectedIndex - 2) * select.options[0].offsetHeight);
  }
});
$('time-dialog').addEventListener('close', () => {
  if ($('time-dialog').returnValue === 'confirm') $('schedule-time').textContent = `${$('time-hour').value}:${$('time-minute').value}`;
});
setAuthMode('login');

// Recheck the actual local date so an open tab cannot edit yesterday after midnight.
function refreshJournalAccess() {
  if (currentAccount) updateJournalState();
}
window.addEventListener('focus', refreshJournalAccess);
document.addEventListener('visibilitychange', refreshJournalAccess);
setInterval(refreshJournalAccess, 60000);

if (location.protocol === 'file:') {
  $('auth-error').textContent = 'npm start로 서버를 실행하고 http://localhost:3000에서 열어 주세요.';
} else {
  api('/api/auth/me').then(async result => {
    const loaded = await api('/api/records'); openAccount(result.user, loaded.records);
  }).catch(error => { if (error.status !== 401) $('auth-error').textContent = error.message; });
}
