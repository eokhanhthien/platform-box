/**
 * dashboard.js — Core routing & navigation for Personal Workspace
 * Drives both the Todo module views and Notes module from the unified sidebar.
 */

// ── State ──────────────────────────────────────────────────────────────────
let _currentSection = 'todo'; // 'todo' | 'notes'
let _todoInitialized = false;
let _notesInitialized = false;

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Load todo section first (default)
    await _ensureTodoLoaded();
    switchTodoView('today');
});

// ── Navigation Handler (called from sidebar nav-item clicks) ───────────────
async function handleNav(el) {
    // Update active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');

    const section = el.dataset.section;
    const view = el.dataset.view || null;

    if (section === 'todo' || section === undefined) {
        await _showSection('todo');
        if (view && typeof switchTodoView === 'function') {
            switchTodoView(view);
        }
    } else if (section === 'notes') {
        await _showSection('notes');
        // Reset filter — show all notes
        if (typeof window._notesSetFilter === 'function') {
            window._notesSetFilter('');
        }
    } else if (section === 'notes-pinned') {
        await _showSection('notes');
        if (typeof window._notesSetFilter === 'function') {
            window._notesSetFilter('__pinned__');
        }
    } else if (section === 'notes-reminder') {
        await _showSection('notes');
        if (typeof window._notesSetFilter === 'function') {
            window._notesSetFilter('__reminder__');
        }
    }
}

// ── Section switcher ──────────────────────────────────────────────────────
async function _showSection(section) {
    _currentSection = section;

    // Hide all sections
    document.querySelectorAll('.module-section').forEach(el => {
        el.classList.remove('visible');
    });

    if (section === 'todo') {
        document.getElementById('section-todo').classList.add('visible');
        await _ensureTodoLoaded();
    } else if (section === 'notes') {
        document.getElementById('section-notes').classList.add('visible');
        await _ensureNotesLoaded();
    }
}

// ── Lazy loaders ──────────────────────────────────────────────────────────
async function _ensureTodoLoaded() {
    const el = document.getElementById('section-todo');
    if (!el) return;

    // Load HTML template if empty
    if (el.innerHTML.trim() === '') {
        const res = await window.api.loadTemplate('todo');
        if (res.success) {
            el.innerHTML = res.html;
        } else {
            el.innerHTML = `<div style="padding:64px;text-align:center;color:#cbd5e1;">Không thể tải module Todo: ${res.error}</div>`;
            return;
        }
    }

    // Init todo module (idempotent — todo.js guards against double-init via state)
    if (!_todoInitialized && typeof initTodoModule === 'function') {
        _todoInitialized = true;
        await initTodoModule();
    }
}

async function _ensureNotesLoaded() {
    const el = document.getElementById('section-notes');
    if (!el) return;

    // Load HTML template if empty
    if (el.innerHTML.trim() === '') {
        const res = await window.api.loadTemplate('notes');
        if (res.success) {
            el.innerHTML = res.html;
        } else {
            el.innerHTML = `<div style="padding:64px;text-align:center;color:#cbd5e1;">Không thể tải module Ghi Chú: ${res.error}</div>`;
            return;
        }
    }

    // Init notes module
    if (!_notesInitialized && typeof initNotesModule === 'function') {
        _notesInitialized = true;
        await initNotesModule();
    }
}
