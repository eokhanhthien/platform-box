const { getDB } = require('./database');

async function getAllPermissions() {
    return new Promise((resolve, reject) => {
        const db = getDB();
        db.all('SELECT role, permissions FROM role_permissions', [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                // Parse JSON array and format into object: { 'Admin': {...}, 'Lãnh đạo': {...} }
                const result = {};
                rows.forEach(row => {
                    try {
                        result[row.role] = JSON.parse(row.permissions);
                    } catch (e) {
                        result[row.role] = {};
                    }
                });
                resolve({ success: true, data: result });
            }
        });
    });
}

async function updatePermissions(role, permissionsObj) {
    return new Promise((resolve, reject) => {
        const db = getDB();
        const jsonStr = JSON.stringify(permissionsObj);

        // Upsert logic
        db.get('SELECT count(*) AS count FROM role_permissions WHERE role = ?', [role], (err, row) => {
            if (err) return reject(err);

            if (row.count > 0) {
                db.run('UPDATE role_permissions SET permissions = ? WHERE role = ?', [jsonStr, role], (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                });
            } else {
                db.run('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)', [role, jsonStr], (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                });
            }
        });
    });
}

module.exports = {
    getAllPermissions,
    updatePermissions
};
