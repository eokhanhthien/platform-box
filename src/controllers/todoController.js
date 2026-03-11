const { ipcMain, Notification, app } = require('electron');
const path = require('path');
const todoModel = require('../models/todoModel');

// ── Todo Reminder Scheduler ────────────────────────────────────────────────────────
let _todoReminderInterval = null;

function startTodoReminderScheduler() {
    console.log('[Todo Reminder] Scheduler started. Checking every 10 seconds...');
    _checkTodoReminders();
    _todoReminderInterval = setInterval(_checkTodoReminders, 10 * 1000);
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

                if (todo.reminder_repeat) {
                    const nextDate = _getNextReminderDate(todo.reminder_repeat, tDate);
                    const fullTodoRes = await todoModel.getTodoById(todo.id);
                    if (fullTodoRes.success) {
                        await todoModel.updateTodo(todo.id, {
                            ...fullTodoRes.data,
                            reminder_date: nextDate
                        });
                        console.log(`[Todo Reminder] Recurring task id=${todo.id} scheduled for next date: ${nextDate}`);
                    }
                } else {
                    await todoModel.markTodoReminderFired(todo.id);
                }

                // Notify renderer to refresh UI
                const windows = require('electron').BrowserWindow.getAllWindows();
                windows.forEach(win => win.webContents.send('refresh-data', { type: 'todo', id: todo.id }));
            }
        }
    } catch (e) {
        console.error('[Todo Reminder] Error in _checkTodoReminders:', e.message);
    }
}

function _getNextReminderDate(repeatStr, startDateStr) {
    const days = repeatStr.split(',').map(Number); // 0=Sun, 1=Mon, ...
    if (!days.length) return null;

    let current = new Date(startDateStr);
    // Move to next day to start searching
    current.setDate(current.getDate() + 1);

    // Search up to 14 days ahead just in case
    for (let i = 0; i < 14; i++) {
        if (days.includes(current.getDay())) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        current.setDate(current.getDate() + 1);
    }
    return null;
}

async function _sendTodoNotification(todo) {
    try {
        if (!Notification.isSupported()) return;

        const iconPath = path.join(__dirname, '../../images/icon.png');
        const { BrowserWindow } = require('electron');

        const notif = new Notification({
            title: `🔔 ${todo.title || 'Việc cần làm'}`,
            body: `Đến hạn lúc ${todo.reminder_time || '08:00'} ngày ${todo.reminder_date}`,
            icon: iconPath,
            timeoutType: 'never',
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
