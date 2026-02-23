const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        // Để an toàn, chúng ta lấy app data path từ electron (chạy ở main process)
        const { app } = require('electron');

        // Phát triển (Dev): Lưu tại thư mục gốc dự án để dễ xem.
        // Chạy thực tế (Prod): Lưu ở appData để không bị lỗi quyền ghi đè ổ C hoặc thư mục cài đặt.
        let dbPath;
        if (app.isPackaged) {
            const userDataPath = app.getPath('userData');
            dbPath = path.join(userDataPath, 'app.db');
        } else {
            dbPath = path.join(__dirname, '../../app.db'); // Lưu vào thư mục gốc của project
        }

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
                        // Create kpi_templates table
                        db.run(`CREATE TABLE IF NOT EXISTS kpi_templates (
                            department TEXT PRIMARY KEY,
                            config TEXT
                        )`, (err) => {
                            if (err) {
                                console.error('Error creating kpi_templates table', err.message);
                                reject(err);
                                return;
                            }

                            // Create kpi_reports table (Wide Table with 30 kpi columns)
                            const kpiColumns = Array.from({ length: 30 }, (_, i) => `kpi_${i + 1} REAL`).join(',\n                            ');
                            db.run(`CREATE TABLE IF NOT EXISTS kpi_reports (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                user_id INTEGER,
                                department TEXT,
                                period TEXT,
                                ${kpiColumns},
                                status TEXT DEFAULT 'DRAFT',
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(user_id, period)
                            )`, (err) => {
                                if (err) {
                                    console.error('Error creating kpi_reports table', err.message);
                                    reject(err);
                                    return;
                                }
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
                                                    const defaultPerms = JSON.stringify({
                                                        dashboard: ['view'],
                                                        users: ['view', 'create', 'update', 'delete'],
                                                        reports: ['view', 'export'],
                                                        game: ['view'],
                                                        permissions: ['view', 'update'], // Quyền config phân quyền
                                                        kpi: ['view', 'create', 'update', 'delete', 'config'] // config is for admin templates
                                                    });
                                                    db.run('INSERT OR IGNORE INTO role_permissions (role, permissions) VALUES (?, ?)', ['Admin', defaultPerms]);
                                                });
                                        }
                                        resolve(db);
                                    });
                                });
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
