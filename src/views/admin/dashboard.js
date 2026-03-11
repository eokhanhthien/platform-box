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

// --- Custom Global Time Picker ---
let _ctpTargetInput = null;
let _ctpH = 8;
let _ctpM = 0;

window.openCustomTimePicker = function (e, inputId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    _ctpTargetInput = document.getElementById(inputId);
    if (!_ctpTargetInput || _ctpTargetInput.disabled) return;

    // parse current time
    let val = _ctpTargetInput.value || '08:00';
    let parts = val.split(':');
    _ctpH = parseInt(parts[0]) || 0;
    _ctpM = parseInt(parts[1]) || 0;
    _ctpUpdateUI();

    const picker = document.getElementById('globalTimePicker');
    picker.classList.add('active');

    // Position it just below the input
    const rect = _ctpTargetInput.getBoundingClientRect();
    let topPos = rect.bottom + window.scrollY + 8;
    picker.style.top = topPos + 'px';
    picker.style.left = (rect.left + window.scrollX) + 'px';
};

window.ctpAdj = function (type, amount) {
    if (type === 'h') {
        _ctpH = (_ctpH + amount + 24) % 24;
    } else {
        _ctpM = (_ctpM + amount + 60) % 60;
    }
    _ctpUpdateUI();
};

window.ctpClose = function (save) {
    if (save && _ctpTargetInput) {
        _ctpTargetInput.value = `${String(_ctpH).padStart(2, '0')}:${String(_ctpM).padStart(2, '0')}`;
    }
    const picker = document.getElementById('globalTimePicker');
    if (picker) picker.classList.remove('active');
};

function _ctpUpdateUI() {
    const hEl = document.getElementById('ctpHour');
    const mEl = document.getElementById('ctpMinute');
    if (hEl) hEl.textContent = String(_ctpH).padStart(2, '0');
    if (mEl) mEl.textContent = String(_ctpM).padStart(2, '0');
}

// Close time picker when clicking outside
document.addEventListener('click', e => {
    const picker = document.getElementById('globalTimePicker');
    if (picker && picker.classList.contains('active')) {
        // If they click inside the picker or on the bound input, ignore
        if (picker.contains(e.target) || (_ctpTargetInput && _ctpTargetInput.contains(e.target))) {
            return;
        }
        ctpClose(false);
    }
});

// ── IPC Navigation Listener ────────────────────────────────────────────────
if (window.api && window.api.onNavigate) {
    window.api.onNavigate((section, view) => {
        let selector = `.nav-item[data-section="${section}"]`;
        if (view && section === 'todo') {
            selector += `[data-view="${view}"]`;
        }

        let el = document.querySelector(selector);

        // Fallback for notes if specific view not found
        if (!el && section === 'notes') {
            el = document.querySelector('.nav-item[data-section="notes"]');
        }

        if (el) {
            handleNav(el);
            // Apply specific notes view
            if (section === 'notes' && view === 'reminder' && typeof window._notesSetFilter === 'function') {
                setTimeout(() => window._notesSetFilter('__reminder__'), 100);
            }
        }
    });
}
