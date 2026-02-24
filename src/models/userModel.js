const { getDB } = require('./database');

async function loginUser(username, password) {
    return new Promise((resolve, reject) => {
        const db = getDB();
        db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
            if (err) reject(err);
            else if (row) resolve({ success: true, user: row });
            else resolve({ success: false, error: 'Sai tài khoản hoặc mật khẩu' });
        });
    });
}

async function getAllUsers() {
    return new Promise((resolve, reject) => {
        const db = getDB();
        db.all('SELECT id, username, full_name, role, department FROM users', [], (err, rows) => {
            if (err) reject(err);
            else resolve({ success: true, data: rows });
        });
    });
}

async function addUser(user) {
    return new Promise((resolve, reject) => {
        const db = getDB();
        db.run(
            'INSERT INTO users (username, password, full_name, role, department) VALUES (?, ?, ?, ?, ?)',
            [user.username, user.password, user.full_name, user.role, user.department],
            function (err) {
                if (err) {
                    // Bắt lỗi trùng username (UNIQUE constraint)
                    if (err.message.includes('UNIQUE')) {
                        resolve({ success: false, error: 'Tài khoản này đã tồn tại!' });
                    } else {
                        reject(err);
                    }
                }
                else resolve({ success: true, id: this.lastID });
            }
        );
    });
}

async function updateUser(id, user) {
    return new Promise((resolve, reject) => {
        const db = getDB();

        const hasPassword = user.password && user.password.trim() !== '';

        const sql = hasPassword
            ? 'UPDATE users SET username = ?, password = ?, full_name = ?, role = ?, department = ? WHERE id = ?'
            : 'UPDATE users SET username = ?, full_name = ?, role = ?, department = ? WHERE id = ?';

        const params = hasPassword
            ? [user.username, user.password, user.full_name, user.role, user.department, id]
            : [user.username, user.full_name, user.role, user.department, id];

        db.run(sql, params, function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    resolve({ success: false, error: 'Tài khoản này đã tồn tại!' });
                } else {
                    reject(err);
                }
            }
            else resolve({ success: true, changes: this.changes });
        });
    });
}

async function deleteUser(id) {
    return new Promise((resolve, reject) => {
        const db = getDB();
        db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
            if (err) reject(err);
            else resolve({ success: true, changes: this.changes });
        });
    });
}

module.exports = {
    loginUser,
    getAllUsers,
    addUser,
    updateUser,
    deleteUser
};
