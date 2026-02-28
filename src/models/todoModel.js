const { getDB } = require('./database');

// ==================== TODO CRUD ====================

function getTodos(filters) {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            let query = `
                SELECT t.*, 
                       u1.full_name AS owner_name,
                       u2.full_name AS assignee_name
                FROM todos t
                LEFT JOIN users u1 ON t.owner_id = u1.id
                LEFT JOIN users u2 ON t.assignee_id = u2.id
            `;
            const params = [];
            const conditions = [];

            if (filters.owner_id) {
                conditions.push('t.owner_id = ?');
                params.push(filters.owner_id);
            }
            if (filters.department) {
                conditions.push('t.department = ?');
                params.push(filters.department);
            }
            if (filters.status) {
                conditions.push('t.status = ?');
                params.push(filters.status);
            }
            if (filters.due_date) {
                conditions.push('t.due_date = ?');
                params.push(filters.due_date);
            }
            if (filters.due_month) {
                // Format: YYYY-MM
                conditions.push("strftime('%Y-%m', t.due_date) = ?");
                params.push(filters.due_month);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY t.order_index ASC, t.due_date ASC, t.created_at DESC';

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
            db.get(`SELECT t.*, u1.full_name AS owner_name, u2.full_name AS assignee_name
                    FROM todos t
                    LEFT JOIN users u1 ON t.owner_id = u1.id
                    LEFT JOIN users u2 ON t.assignee_id = u2.id
                    WHERE t.id = ?`, [id], (err, row) => {
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
            const { title, description, status, priority, due_date, owner_id, assignee_id, department, note } = data;
            db.run(
                `INSERT INTO todos (title, description, status, priority, due_date, owner_id, assignee_id, department, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, description || null, status || 'todo', priority || 'medium',
                    due_date || null, owner_id, assignee_id || null, department || null, note || null],
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
            const { title, description, status, priority, due_date, assignee_id, note } = data;
            db.run(
                `UPDATE todos SET title=?, description=?, status=?, priority=?, due_date=?,
                 assignee_id=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [title, description || null, status, priority, due_date || null,
                    assignee_id || null, note || null, id],
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

module.exports = {
    getTodos,
    getTodoById,
    addTodo,
    updateTodo,
    updateTodoStatus,
    deleteTodo,
    updateTodoOrder
};
