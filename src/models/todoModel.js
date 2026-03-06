const { getDB } = require('./database');

// ==================== TODO CRUD ====================

function getTodos(filters) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            let query = `SELECT * FROM todos`;
            const params = [];
            const conditions = [];

            if (filters.status) {
                conditions.push('status = ?');
                params.push(filters.status);
            }
            if (filters.due_date) {
                conditions.push('due_date = ?');
                params.push(filters.due_date);
            }
            if (filters.due_month) {
                // Format: YYYY-MM
                conditions.push("strftime('%Y-%m', due_date) = ?");
                params.push(filters.due_month);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY order_index ASC, due_date ASC, created_at DESC';

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

function getTodoById(id) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.get(`SELECT * FROM todos WHERE id = ?`, [id], (err, row) => {
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

function addTodo(data) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            const { title, description, status, priority, due_date, note, reminder_date, reminder_time, reminder_repeat } = data;
            db.run(
                `INSERT INTO todos (title, description, status, priority, due_date, note, reminder_date, reminder_time, reminder_fired, reminder_repeat)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                [title, description || null, status || 'todo', priority || 'medium',
                    due_date || null, note || null, reminder_date || null, reminder_time || '08:00', reminder_repeat || null],
                function (err) {
                    if (err) {
                        reject({ success: false, error: err.message });
                    } else {
                        resolve({ success: true, data: { id: this.lastID }, message: 'Thêm task thành công' });
                    }
                }
            );
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function updateTodo(id, data) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            const { title, description, status, priority, due_date, note, reminder_date, reminder_time, reminder_repeat } = data;
            db.run(
                `UPDATE todos SET title=?, description=?, status=?, priority=?, due_date=?,
                 note=?, reminder_date=?, reminder_time=?, reminder_fired=0, reminder_repeat=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [title, description || null, status, priority, due_date || null,
                    note || null, reminder_date || null, reminder_time || '08:00', reminder_repeat || null, id],
                function (err) {
                    if (err) {
                        reject({ success: false, error: err.message });
                    } else {
                        resolve({ success: true, message: 'Cập nhật task thành công' });
                    }
                }
            );
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function updateTodoStatus(id, status) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.run(
                `UPDATE todos SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [status, id],
                function (err) {
                    if (err) {
                        reject({ success: false, error: err.message });
                    } else {
                        resolve({ success: true, message: 'Cập nhật trạng thái thành công' });
                    }
                }
            );
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function deleteTodo(id) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.run('DELETE FROM todos WHERE id=?', [id], function (err) {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true, message: 'Xoá task thành công' });
                }
            });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function updateTodoOrder(items) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmt = db.prepare('UPDATE todos SET order_index=? WHERE id=?');
                for (const item of items) {
                    stmt.run([item.order_index, item.id]);
                }
                stmt.finalize();
                db.run('COMMIT', (err) => {
                    if (err) {
                        reject({ success: false, error: err.message });
                    } else {
                        resolve({ success: true, message: 'Cập nhật thứ tự thành công' });
                    }
                });
            });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function getPendingTodoReminders() {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.all(
                `SELECT id, title, reminder_date, reminder_time, reminder_repeat FROM todos WHERE COALESCE(reminder_fired, 0) = 0 AND reminder_date IS NOT NULL AND status != 'done'`,
                [],
                (err, rows) => {
                    if (err) reject({ success: false, error: err.message });
                    else resolve({ success: true, data: rows || [] });
                }
            );
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

function markTodoReminderFired(id) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            db.run(
                `UPDATE todos SET reminder_fired = 1 WHERE id = ?`,
                [id],
                function (err) {
                    if (err) reject({ success: false, error: err.message });
                    else resolve({ success: true, message: 'Đã đánh dấu báo nhắc' });
                }
            );
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
}

module.exports = {
    getTodos,
    getTodoById,
    addTodo,
    updateTodo,
    updateTodoStatus,
    deleteTodo,
    updateTodoOrder,
    getPendingTodoReminders,
    markTodoReminderFired
};
