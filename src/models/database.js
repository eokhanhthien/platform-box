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
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 6. Seed default admin if no users
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
                        todo: ['view', 'create', 'update', 'delete', 'view_all']
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
