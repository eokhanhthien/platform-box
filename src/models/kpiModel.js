const { getDB } = require('./database');

// ==================== KPI TEMPLATES ====================

function getKpiTemplate(department) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.get('SELECT * FROM kpi_templates WHERE department = ?', [department], (err, row) => {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    if (row) {
                        try {
                            const config = JSON.parse(row.config);
                            resolve({ success: true, data: { department: row.department, config: config } });
                        } catch (e) {
                            reject({ success: false, error: 'Lỗi parse config JSON' });
                        }
                    } else {
                        // Return empty config if not found
                        resolve({ success: true, data: null });
                    }
                }
            });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function saveKpiTemplate(department, configObj) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            const configStr = JSON.stringify(configObj);

            // Upsert (Insert or Replace)
            db.run(`INSERT INTO kpi_templates (department, config) 
                    VALUES (?, ?) 
                    ON CONFLICT(department) 
                    DO UPDATE SET config = excluded.config`,
                [department, configStr],
                function (err) {
                    if (err) {
                        reject({ success: false, error: err.message });
                    } else {
                        resolve({ success: true, message: 'Lưu cấu hình KPI thành công' });
                    }
                }
            );
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

// ==================== KPI REPORTS ====================

function getKpiReports(filters) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();

            let query = `
                SELECT 
                    r.*, 
                    u.full_name, 
                    u.username 
                FROM kpi_reports r
                JOIN users u ON r.user_id = u.id
            `;
            const params = [];
            const conditions = [];

            if (filters.department && filters.department !== 'Tất cả') {
                conditions.push('r.department = ?');
                params.push(filters.department);
            }
            if (filters.startDate) {
                conditions.push('r.period >= ?');
                params.push(filters.startDate);
            }
            if (filters.endDate) {
                conditions.push('r.period <= ?');
                params.push(filters.endDate);
            }
            if (filters.userId) {
                conditions.push('r.user_id = ?');
                params.push(filters.userId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY r.period DESC, u.full_name ASC';

            db.all(query, params, (err, rows) => {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true, data: rows });
                }
            });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function getUserKpiReport(userId, period) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.get('SELECT * FROM kpi_reports WHERE user_id = ? AND period = ?', [userId, period], (err, row) => {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true, data: row });
                }
            });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function saveUserKpiReport(userId, department, period, kpiData) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();

            // Build columns and values dynamically from kpiData
            const columns = [];
            const placeholders = [];
            const values = [];
            const updateClauses = [];

            // kpiData could look like: { kpi_1: 100, kpi_2: 50.5 }
            for (let i = 1; i <= 30; i++) {
                const key = `kpi_${i}`;
                if (kpiData[key] !== undefined) {
                    columns.push(key);
                    placeholders.push('?');
                    values.push(kpiData[key]);
                    updateClauses.push(`${key} = excluded.${key}`);
                }
            }

            // Also keep standard fields
            columns.unshift('user_id', 'department', 'period', 'updated_at');
            placeholders.unshift('?', '?', '?', "CURRENT_TIMESTAMP");
            values.unshift(userId, department, period);
            updateClauses.push('updated_at = CURRENT_TIMESTAMP');

            const query = `
                INSERT INTO kpi_reports (${columns.join(', ')}) 
                VALUES (${placeholders.join(', ')})
                ON CONFLICT(user_id, period) 
                DO UPDATE SET ${updateClauses.join(', ')}
            `;

            db.run(query, values, function (err) {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true, message: 'Lưu báo cáo KPI thành công' });
                }
            });

        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function deleteKpiReport(userId, period) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.run('DELETE FROM kpi_reports WHERE user_id = ? AND period = ?', [userId, period], function (err) {
                if (err) reject({ success: false, error: err.message });
                else resolve({ success: true, changes: this.changes });
            });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

module.exports = {
    getKpiTemplate,
    saveKpiTemplate,
    getKpiReports,
    getUserKpiReport,
    saveUserKpiReport,
    deleteKpiReport
};
