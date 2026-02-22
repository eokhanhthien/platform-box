const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        // Để an toàn, chúng ta lấy app data path từ electron (chạy ở main process)
        const { app } = require('electron');
        // Lưu DB ở appData để người dùng cuối dùng được trên cả win/mac
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'app.db');

        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
                reject(err);
            } else {
                console.log(`Connected to the SQLite database at: ${dbPath}`);

                // Tạo bảng users nếu chưa có
                db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          full_name TEXT,
          role TEXT,
          department TEXT
        )`, (err) => {
                    if (err) {
                        console.error('Error creating table', err.message);
                        reject(err);
                    } else {
                        // Create role_permissions table
                        db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
                            role TEXT PRIMARY KEY,
                            permissions TEXT
                        )`, (err) => {
                            if (err) {
                                console.error('Error creating role_permissions table', err.message);
                                reject(err);
                                return;
                            }

                            // Check admin existence
                            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                                if (!err && row.count === 0) {
                                    db.run('INSERT INTO users (username, password, full_name, role, department) VALUES (?, ?, ?, ?, ?)',
                                        ['admin', 'admin', 'Administrator', 'Admin', 'Tất cả'],
                                        (err) => {
                                            if (err) console.error('Error creating admin user:', err.message);
                                            else console.log('Admin user created defaults: admin/admin');

                                            // Default admin permissions
                                            const defaultPerms = JSON.stringify({
                                                dashboard: ['view'],
                                                users: ['view', 'create', 'update', 'delete'],
                                                reports: ['view', 'export'],
                                                game: ['view'],
                                                permissions: ['view', 'update'] // Quyền config phân quyền
                                            });
                                            db.run('INSERT OR IGNORE INTO role_permissions (role, permissions) VALUES (?, ?)', ['Admin', defaultPerms]);
                                        });
                                }
                                resolve(db);
                            });
                        });
                    }
                });
            }
        });
    });
}

function getDB() {
    if (!db) {
        throw new Error("Database not initialized. Call initDB first.");
    }
    return db;
}

module.exports = {
    initDB,
    getDB
};
