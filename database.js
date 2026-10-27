'use strict';
const path = require('node:path');
const { mkdirSync } = require('node:fs');

function createDatabase({ dataDir = process.env.DAYLOG_DATA_DIR || path.join(__dirname, 'data'), databasePath, remoteUrl = process.env.TURSO_DATABASE_URL, authToken = process.env.TURSO_AUTH_TOKEN, deployed = process.env.VERCEL === '1', remoteClient } = {}) {
  if (remoteUrl) {
    if (!/^(libsql|https):\/\//.test(remoteUrl)) throw new Error('TURSO_DATABASE_URL must use libsql:// or https://');
    if (!authToken) throw new Error('TURSO_AUTH_TOKEN is required');
    // HTTP-only client: no native SQLite module or writable filesystem in Vercel.
    const { createClient } = require('@libsql/client/http');
    const client = remoteClient || createClient({ url: remoteUrl, authToken });
    return {
      remote: true,
      prepare(sql) {
        return {
          async get(...args) { return (await client.execute({ sql, args })).rows[0]; },
          async all(...args) { return (await client.execute({ sql, args })).rows; },
          async run(...args) { const result = await client.execute({ sql, args }); return { changes: result.rowsAffected }; }
        };
      },
      async exec(schema) { await client.batch(schema.split(';').map(sql => sql.trim()).filter(Boolean), 'write'); },
      close() { client.close(); }
    };
  }
  if (deployed) throw new Error('Vercel requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN; local SQLite is disabled');
  mkdirSync(dataDir, { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(databasePath || path.join(dataDir, 'daylog.sqlite'));
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return db;
}
module.exports = { createDatabase };
