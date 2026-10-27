'use strict';

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, randomBytes, scrypt: scryptCallback, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const scrypt = promisify(scryptCallback);
const MOODS = ['', '기쁨', '평온', '설렘', '감사', '슬픔', '지침', '속상함', '걱정', '영감'];
const TABLES = { events: ['date', 'time', 'title'], tasks: ['date', 'title', 'done'], journals: ['date', 'content', 'mood'] };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function requireValue(condition, message) { if (!condition) throw new HttpError(400, message); }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function text(value, max, allowEmpty = false) {
  return typeof value === 'string' && value.length <= max && (allowEmpty || !!value.trim());
}
function normalize(kind, body, partial = false) {
  requireValue(body && typeof body === 'object' && !Array.isArray(body), 'JSON 객체를 보내주세요.');
  const fields = TABLES[kind];
  requireValue(Object.keys(body).every(key => fields.includes(key)), '지원하지 않는 필드가 있습니다.');
  const result = {};
  for (const field of fields) {
    if (partial && !(field in body)) continue;
    const value = body[field];
    if (field === 'date') requireValue(validDate(value), '날짜는 유효한 YYYY-MM-DD 형식이어야 합니다.');
    if (field === 'time') requireValue(typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value), '시간은 HH:MM 형식이어야 합니다.');
    if (field === 'title') requireValue(text(value, 80), '제목은 1~80자여야 합니다.');
    if (field === 'done') requireValue(typeof value === 'boolean', '완료 여부는 true 또는 false여야 합니다.');
    if (field === 'content') requireValue(text(value, 1000, true), '일기는 1,000자 이하여야 합니다.');
    if (field === 'mood') requireValue(MOODS.includes(value), '감정 값이 올바르지 않습니다.');
    result[field] = field === 'title' ? value.trim() : field === 'done' ? Number(value) : value;
  }
  requireValue(Object.keys(result).length > 0, '변경할 값을 입력해 주세요.');
  return result;
}
function koreaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function journalWritable(date) { if (date !== koreaToday()) throw new HttpError(403, '일기와 감정은 당일에만 작성·수정·삭제할 수 있습니다.'); }
function serialize(kind, row) { return kind === 'tasks' ? { ...row, done: !!row.done } : row; }

function createApp({ dataDir = process.env.DAYLOG_DATA_DIR || path.join(__dirname, 'data'), databasePath } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(databasePath || path.join(dataDir, 'daylog.sqlite'));
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL, time TEXT NOT NULL, title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', mood TEXT NOT NULL DEFAULT '', UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS events_user_date ON events(user_id, date);
    CREATE INDEX IF NOT EXISTS tasks_user_date ON tasks(user_id, date);
    `);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const origin = req.headers.origin;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== `http://${req.headers.host}`) return res.status(403).json({ error: '같은 사이트에서만 요청할 수 있습니다.' });
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  const userView = user => ({ id: user.id, username: user.username, name: user.name });
  function issueSession(res, user) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(createHash('sha256').update(token).digest('hex'), user.id, Date.now() + 7 * 86400000);
    res.cookie('daylog_session', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
  }
  function authenticate(req, res, next) {
    const token = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('daylog_session='))?.slice(15);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return next(new HttpError(401, '로그인이 필요합니다.'));
    const hash = createHash('sha256').update(token).digest('hex');
    const user = db.prepare('SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').get(hash, Date.now());
    if (!user) return next(new HttpError(401, '다시 로그인해 주세요.'));
    req.user = user; req.sessionHash = hash; next();
  }
  const failures = new Map();
  function rateLimit(req, res, next) {
    const key = req.ip;
    const entry = failures.get(key) || { count: 0, reset: Date.now() + 60000 };
    if (entry.reset < Date.now()) { entry.count = 0; entry.reset = Date.now() + 60000; }
    if (++entry.count > 30) return next(new HttpError(429, '잠시 후 다시 로그인해 주세요.'));
    failures.set(key, entry); next();
  }
  app.get('/api/auth/username-availability', rateLimit, (req, res) => {
    const username = req.query.username;
    requireValue(text(username, 254) && !/\s/.test(username), '아이디는 공백 없이 1~254자로 입력해 주세요.');
    const normalized = username.trim().toLowerCase();
    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(normalized);
    res.json({ username: normalized, available: !exists });
  });
  for (const action of ['register', 'login']) app.post(`/api/auth/${action}`, rateLimit, async (req, res) => {
    const { username, password, name } = req.body || {};
    requireValue(text(username, 254) && !/\s/.test(username), '아이디는 공백 없이 1~254자로 입력해 주세요.');
    requireValue(text(password, 128) && password.length >= 8, '비밀번호는 8~128자여야 합니다.');
    const normalized = username.trim().toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(normalized);
    if (action === 'register') {
      requireValue(text(name, 30), '이름은 1~30자여야 합니다.');
      if (user) throw new HttpError(409, '이미 사용 중인 아이디입니다.');
      const salt = randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      user = { id: randomUUID(), username: normalized, name: name.trim(), salt, password_hash: hash };
      try { db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, normalized, user.name, hash, salt); }
      catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, '이미 사용 중인 아이디입니다.'); throw error; }
    } else {
      const candidate = await scrypt(password, user?.salt || 'missing-user-dummy-salt', 64);
      if (!user || !timingSafeEqual(candidate, Buffer.from(user.password_hash, 'hex'))) throw new HttpError(401, '아이디 또는 비밀번호를 확인해 주세요.');
    }
    issueSession(res, user);
    res.status(action === 'register' ? 201 : 200).json({ user: userView(user) });
  });
  app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: userView(req.user) }));
  app.post('/api/auth/logout', authenticate, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
    res.clearCookie('daylog_session', { path: '/' }); res.status(204).end();
  });
  app.use('/api', authenticate);

  for (const kind of Object.keys(TABLES)) {
    // Table/column identifiers come exclusively from the constant allowlist above.
    app.get(`/api/${kind}`, (req, res) => {
      let sql = `SELECT id, ${TABLES[kind].join(', ')} FROM ${kind} WHERE user_id = ?`;
      const args = [req.user.id];
      if (req.query.date !== undefined) {
        requireValue(validDate(req.query.date), '날짜 형식을 확인해 주세요.'); sql += ' AND date = ?'; args.push(req.query.date);
      }
      res.json(db.prepare(`${sql} ORDER BY date, id`).all(...args).map(row => serialize(kind, row)));
    });
    function find(req) {
      const row = db.prepare(`SELECT id, ${TABLES[kind].join(', ')} FROM ${kind} WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
      if (!row) throw new HttpError(404, '기록을 찾을 수 없습니다.');
      return row;
    }
    app.get(`/api/${kind}/:id`, (req, res) => res.json(serialize(kind, find(req))));
    app.post(`/api/${kind}`, (req, res) => {
      const values = normalize(kind, req.body);
      if (kind === 'journals') journalWritable(values.date);
      const id = randomUUID();
      db.prepare(`INSERT INTO ${kind} (id, user_id, ${TABLES[kind].join(', ')}) VALUES (?, ?, ${TABLES[kind].map(() => '?').join(', ')})`).run(id, req.user.id, ...Object.values(values));
      res.status(201).json(serialize(kind, { id, ...values }));
    });
    app.patch(`/api/${kind}/:id`, (req, res) => {
      const row = find(req);
      const values = normalize(kind, req.body, true);
      if (kind === 'journals') { journalWritable(row.date); journalWritable(values.date || row.date); }
      db.prepare(`UPDATE ${kind} SET ${Object.keys(values).map(field => `${field} = ?`).join(', ')} WHERE id = ? AND user_id = ?`).run(...Object.values(values), req.params.id, req.user.id);
      res.json(serialize(kind, { ...row, ...values }));
    });
    app.delete(`/api/${kind}/:id`, (req, res) => {
      const row = find(req);
      if (kind === 'journals') journalWritable(row.date);
      db.prepare(`DELETE FROM ${kind} WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
      res.status(204).end();
    });
  }
  app.get('/api/records', (req, res) => {
    const records = {};
    const day = date => records[date] ||= { schedules: [], tasks: [], journal: '', mood: '' };
    for (const row of db.prepare('SELECT id, date, time, title FROM events WHERE user_id = ? ORDER BY date, time').all(req.user.id)) day(row.date).schedules.push({ id: row.id, time: row.time, title: row.title });
    for (const row of db.prepare('SELECT id, date, title, done FROM tasks WHERE user_id = ? ORDER BY date, id').all(req.user.id)) day(row.date).tasks.push({ id: row.id, title: row.title, done: !!row.done });
    for (const row of db.prepare('SELECT id, date, content, mood FROM journals WHERE user_id = ?').all(req.user.id)) Object.assign(day(row.date), { journal: row.content, mood: row.mood, journalId: row.id });
    res.json({ records, today: koreaToday() });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'API 경로를 찾을 수 없습니다.' }));
  // Serve an explicit allowlist; database, backups, server source and dependencies stay private.
  for (const file of ['index.html', 'styles.css', 'app.js']) app.get(`/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: '요청은 5MB 이하여야 합니다.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'JSON 형식이 올바르지 않습니다.' });
    if (String(error.message).includes('UNIQUE constraint')) return res.status(409).json({ error: '해당 날짜에 이미 일기가 있습니다.' });
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : '서버 처리 중 오류가 발생했습니다.' });
  });
  return { app, db };
}

if (require.main === module) {
  const { app, db } = createApp();
  const server = app.listen(3000, 'localhost', () => console.log('Daylog: http://localhost:3000'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
module.exports = { createApp, koreaToday };
