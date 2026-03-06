const { getNotes, getNoteById, addNote, updateNote, deleteNote, getAllTags, getPendingReminders, markReminderFired, updateNoteOrders } = require('../models/noteModel');
const { ipcMain, Notification, app } = require('electron');
const path = require('path');

// ── Reminder Scheduler ────────────────────────────────────────────────────────
let _reminderInterval = null;

function startReminderScheduler() {
    console.log('[Reminder] Scheduler started. Checking every 60 seconds...');
    _checkReminders();
    _reminderInterval = setInterval(_checkReminders, 60 * 1000);
}

function stopReminderScheduler() {
    if (_reminderInterval) {
        clearInterval(_reminderInterval);
        _reminderInterval = null;
    }
}

async function _checkReminders() {
    try {
        const res = await getPendingReminders();
        if (!res.success) {
            console.error('[Reminder] getPendingReminders failed:', res.error);
            return;
        }

        const now = new Date();
        const nowDate = _padDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const nowHour = String(now.getHours()).padStart(2, '0');
        const nowMin = String(now.getMinutes()).padStart(2, '0');
        const nowTime = `${nowHour}:${nowMin}`;

        console.log(`[Reminder] Check at ${nowDate} ${nowTime} | Pending: ${res.data.length}`);

        if (!res.data.length) return;

        for (const note of res.data) {
            const noteDate = (note.reminder_date || '').trim();
            const noteTime = (note.reminder_time || '08:00').trim();

            console.log(`  → Note id=${note.id} title="${note.title}" date="${noteDate}" time="${noteTime}"`);

            let shouldFire = false;
            if (noteDate && noteDate < nowDate) {
                console.log(`    → PAST DUE: ${noteDate} < ${nowDate}`);
                shouldFire = true;
            } else if (noteDate && noteDate === nowDate && noteTime <= nowTime) {
                console.log(`    → TODAY & TIME REACHED: ${noteTime} <= ${nowTime}`);
                shouldFire = true;
            } else {
                console.log(`    → Not yet: date=${noteDate} vs ${nowDate}, time=${noteTime} vs ${nowTime}`);
            }

            if (shouldFire) {
                await _sendNotification(note);

                if (note.reminder_repeat) {
                    const nextDate = _getNextReminderDate(note.reminder_repeat, noteDate);
                    const { getNoteById, updateNote } = require('../models/noteModel');
                    const fullNote = await getNoteById(note.id);
                    if (fullNote.success) {
                        await updateNote(note.id, {
                            ...fullNote.data,
                            reminder_date: nextDate
                        });
                        console.log(`[Reminder] Recurring note id=${note.id} scheduled for next date: ${nextDate}`);
                    }
                } else {
                    await markReminderFired(note.id);
                }
            }
        }
    } catch (e) {
        console.error('[Reminder] Error in _checkReminders:', e.message);
    }
}

function _getNextReminderDate(repeatStr, startDateStr) {
    const days = repeatStr.split(',').map(Number);
    if (!days.length) return null;

    let current = new Date(startDateStr);
    current.setDate(current.getDate() + 1);

    for (let i = 0; i < 14; i++) {
        if (days.includes(current.getDay())) {
            return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        }
        current.setDate(current.getDate() + 1);
    }
    return null;
}

function _padDate(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}


async function _sendNotification(note) {
    try {
        if (!Notification.isSupported()) {
            console.warn('[Reminder] Notification not supported on this platform.');
            return;
        }

        const iconPath = path.join(__dirname, '../../images/icon.png');
        const notif = new Notification({
            title: '🔔 Noteflow - Ghi chú',
            body: `${note.title || 'Ghi chú'}\nĐến giờ nhắc nhở lúc ${note.reminder_time || '08:00'} ngày ${note.reminder_date}`,
            icon: iconPath,
            urgency: 'normal'
        });
        notif.show();

        // Auto-close after 4 seconds
        setTimeout(() => notif.close(), 4000);
        console.log(`[Reminder] Sent notification for note id=${note.id} "${note.title}"`);
    } catch (e) {
        console.error('[Reminder] Failed to send notification:', e.message);
    }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
function initNoteController() {
    ipcMain.handle('getNotes', async (event, filters) => {
        try { return await getNotes(filters || {}); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('getNoteById', async (event, id) => {
        try { return await getNoteById(id); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('addNote', async (event, data) => {
        try { return await addNote(data); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('updateNote', async (event, id, data) => {
        try { return await updateNote(id, data); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('deleteNote', async (event, id) => {
        try { return await deleteNote(id); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('updateNoteOrders', async (event, updates) => {
        try { return await updateNoteOrders(updates); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('getAllTags', async (event) => {
        try { return await getAllTags(); }
        catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('markReminderFired', async (event, id) => {
        try { return await markReminderFired(id); }
        catch (e) { return { success: false, error: e.message }; }
    });

    // Test notification (for debugging from DevTools)
    ipcMain.handle('testReminderNotification', async () => {
        try {
            if (!Notification.isSupported()) {
                return { success: false, error: 'Notifications not supported' };
            }
            const iconPath = path.join(__dirname, '../../images/icon.png');
            const notif = new Notification({
                title: '🔔 Noteflow - Kiểm tra',
                body: 'Hệ thống thông báo của Noteflow hoạt động bình thường!',
                icon: iconPath,
                urgency: 'normal'
            });
            notif.show();

            // Auto-close after 4 seconds
            setTimeout(() => notif.close(), 4000);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Force check reminders now & return debug info
    ipcMain.handle('checkRemindersNow', async () => {
        try {
            const res = await getPendingReminders();
            if (!res.success) return { success: false, error: res.error };

            const now = new Date();
            const nowDate = _padDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
            const nowHour = String(now.getHours()).padStart(2, '0');
            const nowMin = String(now.getMinutes()).padStart(2, '0');
            const nowTime = `${nowHour}:${nowMin}`;

            const debug = { nowDate, nowTime, pending: res.data, fired: [] };

            for (const note of res.data) {
                const noteDate = (note.reminder_date || '').trim();
                const noteTime = (note.reminder_time || '08:00').trim();
                const pastDue = noteDate && noteDate < nowDate;
                const todayReady = noteDate && noteDate === nowDate && noteTime <= nowTime;

                if (pastDue || todayReady) {
                    await _sendNotification(note);
                    await markReminderFired(note.id);
                    debug.fired.push({ id: note.id, title: note.title });
                }
            }
            return { success: true, debug };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Start the reminder scheduler
    startReminderScheduler();

    // Cleanup on quit
    app.on('before-quit', stopReminderScheduler);
}

module.exports = { initNoteController };
