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
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 3. Note tags table
                await runQuery(`CREATE TABLE IF NOT EXISTS note_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    note_id INTEGER NOT NULL,
                    tag TEXT NOT NULL,
                    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
                )`);

                // Migration: add new columns if they don't exist yet (safe for existing DBs)
                const migrateCol = async (table, col, def) => {
                    try { await runQuery(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (_) { }
                };
                await migrateCol('notes', 'reminder_time', 'TEXT DEFAULT \'08:00\'');
                await migrateCol('notes', 'reminder_fired', 'INTEGER DEFAULT 0');
                await migrateCol('notes', 'order_index', 'INTEGER DEFAULT 0');

                await migrateCol('todos', 'order_index', 'INTEGER DEFAULT 0');
                await migrateCol('todos', 'reminder_date', 'TEXT');
                await migrateCol('todos', 'reminder_time', 'TEXT DEFAULT \'08:00\'');
                await migrateCol('todos', 'reminder_fired', 'INTEGER DEFAULT 0');

                // ── Migration: remove owner_id / assignee_id / department from old tables ──
                // SQLite doesn't support DROP COLUMN directly, so we use the rename-recreate-copy pattern.
                // We detect the old schema by checking if owner_id exists in the table.
                const hasCol = (tableInfo, col) => tableInfo.some(r => r.name === col);

                // Fix NOTES table
                const notesInfo = await new Promise((res, rej) =>
                    db.all(`PRAGMA table_info(notes)`, [], (e, rows) => e ? rej(e) : res(rows)));
                if (hasCol(notesInfo, 'owner_id')) {
                    console.log('[DB] Migrating notes table — removing owner_id...');
                    await runQuery(`ALTER TABLE notes RENAME TO notes_old`);
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
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);
                    await runQuery(`INSERT INTO notes (id,title,content,color,is_pinned,is_locked,order_index,reminder_date,reminder_time,reminder_fired,created_at,updated_at)
                        SELECT id,title,content,color,is_pinned,is_locked,COALESCE(order_index,0),reminder_date,COALESCE(reminder_time,'08:00'),COALESCE(reminder_fired,0),created_at,updated_at FROM notes_old`);
                    await runQuery(`DROP TABLE notes_old`);
                    console.log('[DB] notes migration done.');
                }

                // Fix TODOS table
                const todosInfo = await new Promise((res, rej) =>
                    db.all(`PRAGMA table_info(todos)`, [], (e, rows) => e ? rej(e) : res(rows)));
                if (hasCol(todosInfo, 'owner_id')) {
                    console.log('[DB] Migrating todos table — removing owner_id/assignee_id/department...');
                    await runQuery(`ALTER TABLE todos RENAME TO todos_old`);
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
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);
                    await runQuery(`INSERT INTO todos (id,title,description,status,priority,due_date,note,order_index,reminder_date,reminder_time,reminder_fired,created_at,updated_at)
                        SELECT id,title,description,status,priority,due_date,note,COALESCE(order_index,0),reminder_date,COALESCE(reminder_time,'08:00'),COALESCE(reminder_fired,0),created_at,updated_at FROM todos_old`);
                    await runQuery(`DROP TABLE todos_old`);
                    console.log('[DB] todos migration done.');
                }

                // Fix NOTE_TAGS foreign key references (recreate after notes was recreated)
                // note_tags already uses note_id which is preserved — FK still valid.

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
