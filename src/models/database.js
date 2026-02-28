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
                // 1. Users table
                await runQuery(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT,
                    full_name TEXT,
                    role TEXT,
                    department TEXT
                )`);

                // 2. KPI Templates table
                await runQuery(`CREATE TABLE IF NOT EXISTS kpi_templates (
                    department TEXT PRIMARY KEY,
                    config TEXT
                )`);

                // 3. KPI Reports table
                const kpiColumns = Array.from({ length: 30 }, (_, i) => `kpi_${i + 1} REAL`).join(', ');
                await runQuery(`CREATE TABLE IF NOT EXISTS kpi_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    department TEXT,
                    period TEXT,
                    ${kpiColumns},
                    status TEXT DEFAULT 'DRAFT',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, period)
                )`);

                // 4. Role Permissions table
                await runQuery(`CREATE TABLE IF NOT EXISTS role_permissions (
                    role TEXT PRIMARY KEY,
                    permissions TEXT
                )`);

                // 5. Todos table
                await runQuery(`CREATE TABLE IF NOT EXISTS todos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'todo',
                    priority TEXT DEFAULT 'medium',
                    due_date TEXT,
                    owner_id INTEGER NOT NULL,
                    assignee_id INTEGER,
                    department TEXT,
                    note TEXT,
                    order_index INTEGER DEFAULT 0,
                    reminder_date TEXT,
                    reminder_time TEXT DEFAULT '08:00',
                    reminder_fired INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 6. Notes table
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
                    owner_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 7. Note tags table
                await runQuery(`CREATE TABLE IF NOT EXISTS note_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    note_id INTEGER NOT NULL,
                    tag TEXT NOT NULL,
                    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
                )`);

                // Migration: add new columns to notes if they don't exist yet (safe for existing DBs)
                const migrateCol = async (table, col, def) => {
                    try { await runQuery(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (_) { }
                };
                await migrateCol('notes', 'reminder_time', 'TEXT DEFAULT \'08:00\'');
                await migrateCol('notes', 'reminder_fired', 'INTEGER DEFAULT 0');
                await migrateCol('notes', 'order_index', 'INTEGER DEFAULT 0');

                // Migrate todos
                await migrateCol('todos', 'order_index', 'INTEGER DEFAULT 0');
                await migrateCol('todos', 'reminder_date', 'TEXT');
                await migrateCol('todos', 'reminder_time', 'TEXT DEFAULT \'08:00\'');
                await migrateCol('todos', 'reminder_fired', 'INTEGER DEFAULT 0');

                // Enable FK
                await runQuery(`PRAGMA foreign_keys = ON`);


                // 8. System Config table
                await runQuery(`CREATE TABLE IF NOT EXISTS system_config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )`);

                // Seed default configs if empty
                const configCount = await getRow('SELECT COUNT(*) as count FROM system_config');
                if (configCount.count === 0) {
                    const defaultRoles = JSON.stringify(['Nhân viên', 'Lãnh đạo', 'Admin']);
                    const defaultDepts = JSON.stringify(['Ban GĐ', 'Phòng DN Lớn', 'Phòng DN VVN', 'Phòng Bán lẻ', 'Phòng DVKH']);
                    const defaultNav = JSON.stringify([
                        { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-border-all', url: '#' },
                        { id: 'users', label: 'Quản lý Users', icon: 'fas fa-users', url: '#' },
                        { id: 'permissions', label: 'Phân quyền', icon: 'fas fa-user-shield', url: '#' },
                        { id: 'kpi', label: 'Quản lý KPI', icon: 'fas fa-chart-line', url: '#' },
                        { id: 'todo', label: 'Todo List', icon: 'fas fa-tasks', url: '#' },
                        { id: 'notes', label: 'Ghi Chú', icon: 'fas fa-sticky-note', url: '#' },
                        { id: 'system_config', label: 'Cấu hình hệ thống', icon: 'fas fa-cog', url: '#' }
                    ]);

                    await runQuery('INSERT INTO system_config (key, value) VALUES (?, ?)', ['ROLES', defaultRoles]);
                    await runQuery('INSERT INTO system_config (key, value) VALUES (?, ?)', ['DEPARTMENTS', defaultDepts]);
                    await runQuery('INSERT INTO system_config (key, value) VALUES (?, ?)', ['NAVIGATION', defaultNav]);
                }

                // 9. Seed default admin if no users
                const userCount = await getRow('SELECT COUNT(*) as count FROM users');
                if (userCount.count === 0) {
                    await runQuery(
                        'INSERT INTO users (username, password, full_name, role, department) VALUES (?, ?, ?, ?, ?)',
                        ['admin', 'admin', 'Administrator', 'Admin', 'Tất cả']
                    );
                    const defaultPerms = JSON.stringify({
                        dashboard: ['view'],
                        users: ['view', 'create', 'update', 'delete'],
                        reports: ['view', 'export'],
                        game: ['view'],
                        permissions: ['view', 'update'],
                        kpi: ['view', 'create', 'update', 'delete', 'config'],
                        todo: ['view', 'create', 'update', 'delete', 'view_all'],
                        notes: ['view', 'create', 'update', 'delete'],
                        system_config: ['view', 'update']
                    });
                    await runQuery(
                        'INSERT OR IGNORE INTO role_permissions (role, permissions) VALUES (?, ?)',
                        ['Admin', defaultPerms]
                    );
                }

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
