const { getDB } = require('./database');

// ─── helpers ─────────────────────────────────────────────────────────────────
function runQ(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDB().run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function allQ(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDB().all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getQ(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDB().get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ─── Tags helpers ─────────────────────────────────────────────────────────────
async function getTagsForNotes(noteIds) {
    if (!noteIds.length) return {};
    const placeholders = noteIds.map(() => '?').join(',');
    const rows = await allQ(
        `SELECT note_id, tag FROM note_tags WHERE note_id IN (${placeholders})`,
        noteIds
    );
    const map = {};
    rows.forEach(r => {
        if (!map[r.note_id]) map[r.note_id] = [];
        map[r.note_id].push(r.tag);
    });
    return map;
}

async function setNoteTags(noteId, tags) {
    await runQ('DELETE FROM note_tags WHERE note_id = ?', [noteId]);
    const unique = [...new Set((tags || []).map(t => t.trim().toLowerCase()).filter(Boolean))];
    for (const tag of unique) {
        await runQ('INSERT INTO note_tags (note_id, tag) VALUES (?, ?)', [noteId, tag]);
    }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
async function getNotes(filters = {}) {
    try {
        let sql = `SELECT * FROM notes WHERE 1=1`;
        const params = [];

        if (filters.owner_id) {
            sql += ` AND owner_id = ?`;
            params.push(filters.owner_id);
        }

        if (filters.color && filters.color !== 'all') {
            sql += ` AND color = ?`;
            params.push(filters.color);
        }

        if (filters.is_pinned) {
            sql += ` AND is_pinned = 1`;
        }

        if (filters.query) {
            sql += ` AND (title LIKE ? OR content LIKE ?)`;
            params.push(`%${filters.query}%`, `%${filters.query}%`);
        }

        // Tag filter — sub-select
        if (filters.tag) {
            sql += ` AND id IN (SELECT note_id FROM note_tags WHERE tag = ?)`;
            params.push(filters.tag);
        }

        sql += ` ORDER BY is_pinned DESC, updated_at DESC`;

        const rows = await allQ(sql, params);
        if (!rows.length) return { success: true, data: [] };

        const tagsMap = await getTagsForNotes(rows.map(r => r.id));
        const data = rows.map(r => ({ ...r, tags: tagsMap[r.id] || [] }));
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function getNoteById(id) {
    try {
        const note = await getQ('SELECT * FROM notes WHERE id = ?', [id]);
        if (!note) return { success: false, error: 'Not found' };
        const tags = await allQ('SELECT tag FROM note_tags WHERE note_id = ?', [id]);
        note.tags = tags.map(t => t.tag);
        return { success: true, data: note };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function addNote(data) {
    try {
        const { title = '', content = '', color = 'default', is_pinned = 0, is_locked = 0,
            reminder_date = null, reminder_time = '08:00', owner_id, tags = [] } = data;
        const now = new Date().toISOString();
        const result = await runQ(
            `INSERT INTO notes (title, content, color, is_pinned, is_locked, reminder_date, reminder_time, reminder_fired, owner_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [title, content, color, is_pinned ? 1 : 0, is_locked ? 1 : 0, reminder_date, reminder_time || '08:00', owner_id, now, now]
        );
        await setNoteTags(result.lastID, tags);
        return { success: true, data: { id: result.lastID } };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function updateNote(id, data) {
    try {
        const { title, content, color, is_pinned, is_locked, reminder_date, reminder_time, tags } = data;
        const now = new Date().toISOString();
        // Reset reminder_fired when reminder date/time changes
        await runQ(
            `UPDATE notes SET title=?, content=?, color=?, is_pinned=?, is_locked=?, reminder_date=?, reminder_time=?, reminder_fired=0, updated_at=? WHERE id=?`,
            [title ?? '', content ?? '', color ?? 'default', is_pinned ? 1 : 0, is_locked ? 1 : 0,
            reminder_date ?? null, reminder_time ?? '08:00', now, id]
        );
        if (tags !== undefined) await setNoteTags(id, tags);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Get notes with upcoming reminders that haven't been fired yet
async function getPendingReminders() {
    try {
        const rows = await allQ(
            `SELECT id, title, reminder_date, reminder_time FROM notes
             WHERE reminder_date IS NOT NULL AND reminder_date != ''
             AND reminder_fired = 0`,
            []
        );
        return { success: true, data: rows };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Mark a reminder as fired so it doesn't notify again
async function markReminderFired(id) {
    try {
        await runQ('UPDATE notes SET reminder_fired = 1 WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function deleteNote(id) {
    try {
        await runQ('DELETE FROM notes WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function getAllTags(ownerId) {
    try {
        const rows = await allQ(
            `SELECT nt.tag, COUNT(*) as count FROM note_tags nt
             INNER JOIN notes n ON n.id = nt.note_id
             WHERE n.owner_id = ?
             GROUP BY nt.tag ORDER BY count DESC`,
            [ownerId]
        );
        return { success: true, data: rows };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = { getNotes, getNoteById, addNote, updateNote, deleteNote, getAllTags, getPendingReminders, markReminderFired };

