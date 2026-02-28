const { ipcMain, Notification, app } = require('electron');
const todoModel = require('../models/todoModel');

// ── Todo Reminder Scheduler ────────────────────────────────────────────────────────
let _todoReminderInterval = null;

function startTodoReminderScheduler() {
    console.log('[Todo Reminder] Scheduler started. Checking every 60 seconds...');
    _checkTodoReminders();
    _todoReminderInterval = setInterval(_checkTodoReminders, 60 * 1000);
}

function stopTodoReminderScheduler() {
    if (_todoReminderInterval) {
        clearInterval(_todoReminderInterval);
        _todoReminderInterval = null;
    }
}

async function _checkTodoReminders() {
    try {
        const res = await todoModel.getPendingTodoReminders();
        if (!res.success) {
            console.error('[Todo Reminder] getPendingTodoReminders failed:', res.error);
            return;
        }

        const now = new Date();
        const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (!res.data || !res.data.length) return;

        for (const todo of res.data) {
            const tDate = (todo.reminder_date || '').trim();
            const tTime = (todo.reminder_time || '08:00').trim();

            let shouldFire = false;
            if (tDate && tDate < nowDate) {
                shouldFire = true;
            } else if (tDate && tDate === nowDate && tTime <= nowTime) {
                shouldFire = true;
            }

            if (shouldFire) {
                await _sendTodoNotification(todo);
                await todoModel.markTodoReminderFired(todo.id);
            }
        }
    } catch (e) {
        console.error('[Todo Reminder] Error in _checkTodoReminders:', e.message);
    }
}

async function _sendTodoNotification(todo) {
    try {
        if (!Notification.isSupported()) return;

        const notif = new Notification({
            title: '🔔 Việc cần làm: ' + (todo.title || 'Task'),
            body: `Đã đến hạn chót nhắc nhở (${todo.reminder_time || '08:00'} ngày ${todo.reminder_date})`,
            urgency: 'critical'
        });
        notif.show();
        console.log(`[Todo Reminder] Sent notification for task id=${todo.id} "${todo.title}"`);
    } catch (e) {
        console.error('[Todo Reminder] Failed to send notification:', e.message);
    }
}

function initTodoController() {

    ipcMain.handle('getTodos', async (event, filters) => {
        try {
            return await todoModel.getTodos(filters || {});
        } catch (error) {
            console.error('IPC Error getTodos:', error);
            return { success: false, error: 'Database error fetching todos' };
        }
    });

    ipcMain.handle('getTodoById', async (event, id) => {
        try {
            return await todoModel.getTodoById(id);
        } catch (error) {
            console.error('IPC Error getTodoById:', error);
            return { success: false, error: 'Database error fetching todo' };
        }
    });

    ipcMain.handle('addTodo', async (event, data) => {
        try {
            return await todoModel.addTodo(data);
        } catch (error) {
            console.error('IPC Error addTodo:', error);
            return { success: false, error: 'Database error adding todo' };
        }
    });

    ipcMain.handle('updateTodo', async (event, id, data) => {
        try {
            return await todoModel.updateTodo(id, data);
        } catch (error) {
            console.error('IPC Error updateTodo:', error);
            return { success: false, error: 'Database error updating todo' };
        }
    });

    ipcMain.handle('updateTodoStatus', async (event, id, status) => {
        try {
            return await todoModel.updateTodoStatus(id, status);
        } catch (error) {
            console.error('IPC Error updateTodoStatus:', error);
            return { success: false, error: 'Database error updating todo status' };
        }
    });

    ipcMain.handle('deleteTodo', async (event, id) => {
        try {
            return await todoModel.deleteTodo(id);
        } catch (error) {
            console.error('IPC Error deleteTodo:', error);
            return { success: false, error: 'Database error deleting todo' };
        }
    });

    ipcMain.handle('updateTodoOrder', async (event, items) => {
        try {
            return await todoModel.updateTodoOrder(items);
        } catch (error) {
            console.error('IPC Error updateTodoOrder:', error);
            return { success: false, error: 'Database error updating todo order' };
        }
    });

    ipcMain.handle('markTodoReminderFired', async (event, id) => {
        try { return await todoModel.markTodoReminderFired(id); }
        catch (e) { return { success: false, error: e.message }; }
    });

    // Start the reminder scheduler
    startTodoReminderScheduler();

    // Cleanup on quit
    app.on('before-quit', stopTodoReminderScheduler);
}

module.exports = { initTodoController };
