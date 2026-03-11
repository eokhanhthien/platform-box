const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

function runQuery(sql, params) {
    return new Promise((resolve, reject) => {
        db.run(sql, params || [], function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getRow(sql, params) {
    return new Promise((resolve, reject) => {
        db.get(sql, params || [], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allQuery(sql, params) {
    return new Promise((resolve, reject) => {
        db.all(sql, params || [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

const hasCol = (tableInfo, col) => (tableInfo || []).some(r => r.name === col);

function initDB() {
    return new Promise((resolve, reject) => {
        const { app } = require('electron');

        let dbPath;
        if (app.isPackaged) {
            dbPath = path.join(app.getPath('userData'), 'app.db');
        } else {
            dbPath = path.join(__dirname, '../../app.db');
        }

        db = new sqlite3.Database(dbPath, async (err) => {
            if (err) {
                console.error('Error opening database', err.message);
                return reject(err);
            }

            console.log(`Connected to the SQLite database at: ${dbPath}`);

            try {
                // 1. Todos table
                await runQuery(`CREATE TABLE IF NOT EXISTS todos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'todo',
                    priority TEXT DEFAULT 'medium',
                    due_date TEXT,
                    note TEXT,
                    order_index INTEGER DEFAULT 0,
                    reminder_date TEXT,
                    reminder_time TEXT DEFAULT '08:00',
                    reminder_fired INTEGER DEFAULT 0,
                    reminder_repeat TEXT, -- Comma separated days: 0,1,2,3,4,5,6
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 2. Notes table
                await runQuery(`CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL DEFAULT '',
                    content TEXT DEFAULT '',
                    color TEXT DEFAULT 'default',
                    is_pinned INTEGER DEFAULT 0,
                    is_locked INTEGER DEFAULT 0,
                    order_index INTEGER DEFAULT 0,
                    reminder_date TEXT,
                    reminder_time TEXT DEFAULT '08:00',
                    reminder_fired INTEGER DEFAULT 0,
                    reminder_fired_at DATETIME,
                    reminder_repeat TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 3. Note tags table (initial creation or no-op if exists)
                await runQuery(`CREATE TABLE IF NOT EXISTS note_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    note_id INTEGER NOT NULL,
                    tag TEXT NOT NULL,
                    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
                )`);

                // ── MIGRATION: Fix note_tags if FK points to broken notes_old ──
                const noteTagsSql = await allQuery(
                    `SELECT sql FROM sqlite_master WHERE type='table' AND name='note_tags'`
                );
                const noteTagsDdl = (noteTagsSql && noteTagsSql[0] && noteTagsSql[0].sql) || '';
                if (noteTagsDdl.includes('notes_old')) {
                    console.log('[DB] Fixing broken FK in note_tags (was referencing notes_old)...');
                    await runQuery('BEGIN TRANSACTION');
                    try {
                        await runQuery(`CREATE TABLE note_tags_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            note_id INTEGER NOT NULL,
                            tag TEXT NOT NULL,
                            FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
                        )`);
                        await runQuery(`INSERT INTO note_tags_new SELECT * FROM note_tags`);
                        await runQuery(`DROP TABLE note_tags`);
                        await runQuery(`ALTER TABLE note_tags_new RENAME TO note_tags`);
                        await runQuery('COMMIT');
                        console.log('[DB] note_tags FK fixed successfully.');
                    } catch (err) {
                        await runQuery('ROLLBACK');
                        throw err;
                    }
                }

                // ── MIGRATION: NOTES ──
                const notesInfo = await allQuery(`PRAGMA table_info(notes)`);
                if (hasCol(notesInfo, 'owner_id')) {
                    console.log('[DB] Migrating notes table...');
                    await runQuery('BEGIN TRANSACTION');
                    try {
                        await runQuery(`DROP TABLE IF EXISTS notes_temp_backup`);
                        await runQuery(`ALTER TABLE notes RENAME TO notes_temp_backup`);
                        await runQuery(`CREATE TABLE notes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL DEFAULT '',
                            content TEXT DEFAULT '',
                            color TEXT DEFAULT 'default',
                            is_pinned INTEGER DEFAULT 0,
                            is_locked INTEGER DEFAULT 0,
                            order_index INTEGER DEFAULT 0,
                            reminder_date TEXT,
                            reminder_time TEXT DEFAULT '08:00',
                            reminder_fired INTEGER DEFAULT 0,
                            reminder_repeat TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )`);
                        // Use the temporary backup to restore data
                        await runQuery(`INSERT INTO notes (id,title,content,color,is_pinned,is_locked,order_index,reminder_date,reminder_time,reminder_fired,reminder_repeat,created_at,updated_at)
                            SELECT id,title,content,color,is_pinned,is_locked,0,reminder_date,'08:00',0,NULL,created_at,updated_at FROM notes_temp_backup`); await runQuery(`DROP TABLE notes_temp_backup`);
                        await runQuery('COMMIT');
                        console.log('[DB] notes migration successful');
                    } catch (err) {
                        await runQuery('ROLLBACK');
                        throw err;
                    }
                } else {
                    // Safe column additions for newer schema but potentially missing some minor updates
                    const migrateNotesCol = async (col, def) => {
                        try { await runQuery(`ALTER TABLE notes ADD COLUMN ${col} ${def}`); } catch (_) { }
                    };
                    await migrateNotesCol('reminder_time', 'TEXT DEFAULT \'08:00\'');
                    await migrateNotesCol('reminder_fired', 'INTEGER DEFAULT 0');
                    await migrateNotesCol('reminder_repeat', 'TEXT');
                    await migrateNotesCol('order_index', 'INTEGER DEFAULT 0');
                    await migrateNotesCol('reminder_date', 'TEXT');
                    await migrateNotesCol('reminder_fired_at', 'DATETIME');
                }

                // ── MIGRATION: TODOS ──
                const todosInfo = await allQuery(`PRAGMA table_info(todos)`);
                if (hasCol(todosInfo, 'owner_id')) {
                    console.log('[DB] Migrating todos table...');
                    await runQuery('BEGIN TRANSACTION');
                    try {
                        await runQuery(`DROP TABLE IF EXISTS todos_temp_backup`);
                        await runQuery(`ALTER TABLE todos RENAME TO todos_temp_backup`);
                        await runQuery(`CREATE TABLE todos (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL,
                            description TEXT,
                            status TEXT DEFAULT 'todo',
                            priority TEXT DEFAULT 'medium',
                            due_date TEXT,
                            note TEXT,
                            order_index INTEGER DEFAULT 0,
                            reminder_date TEXT,
                            reminder_time TEXT DEFAULT '08:00',
                            reminder_fired INTEGER DEFAULT 0,
                            reminder_fired_at DATETIME,
                            reminder_repeat TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )`);
                        await runQuery(`INSERT INTO todos (id,title,description,status,priority,due_date,note,order_index,reminder_date,reminder_time,reminder_fired,reminder_fired_at,reminder_repeat,created_at,updated_at)
                            SELECT id,title,description,status,priority,due_date,note,0,reminder_date,'08:00',0,NULL,NULL,created_at,updated_at FROM todos_temp_backup`); await runQuery(`DROP TABLE todos_temp_backup`);
                        await runQuery('COMMIT');
                        console.log('[DB] todos migration successful');
                    } catch (err) {
                        await runQuery('ROLLBACK');
                        throw err;
                    }
                } else {
                    const migrateTodosCol = async (col, def) => {
                        try { await runQuery(`ALTER TABLE todos ADD COLUMN ${col} ${def}`); } catch (_) { }
                    };
                    await migrateTodosCol('order_index', 'INTEGER DEFAULT 0');
                    await migrateTodosCol('reminder_date', 'TEXT');
                    await migrateTodosCol('reminder_time', 'TEXT DEFAULT \'08:00\'');
                    await migrateTodosCol('reminder_fired', 'INTEGER DEFAULT 0');
                    await migrateTodosCol('reminder_repeat', 'TEXT');
                    await migrateTodosCol('reminder_fired_at', 'DATETIME');
                }

                // Enable FK
                await runQuery(`PRAGMA foreign_keys = ON`);
                resolve(db);
            } catch (initErr) {
                console.error('Error during DB initialization:', initErr.message);
                reject(initErr);
            }
        });
    });
}

function getDB() {
    if (!db) throw new Error('Database not initialized. Call initDB first.');
    return db;
}

module.exports = { initDB, getDB };
