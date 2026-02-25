/**
 * todo.js — Logic module Todo List
 * Entry: initTodoModule() gọi từ dashboard.js sau khi HTML fragment được inject.
 * Tuân thủ RULES.md: window.api, RBAC, không inline script trong HTML.
 */

// ===== STATE =====
let _todoTasks = [];
let _todoFiltered = [];
let _todoUser = null;
let _todoPerms = [];
let _todoUsers = [];
let _calY = 0, _calM = 0, _calSel = null;

// ===== ENTRY =====
async function initTodoModule() {
    try {
        _todoUser = window._currentUser;
        const rolePerms = (window.APP_CONFIG && window.APP_CONFIG.PERMISSIONS && _todoUser)
            ? (window.APP_CONFIG.PERMISSIONS[_todoUser.role] || {}) : {};
        _todoPerms = rolePerms['todo'] || [];

        const isAdmin = _todoUser && _todoUser.role === 'Admin';
        const canView = isAdmin || _todoPerms.includes('view');
        const canCreate = isAdmin || _todoPerms.includes('create');
        const canViewAll = isAdmin || _todoPerms.includes('view_all');

        // Không có quyền
        if (!canView) {
            document.getElementById('section-todo').innerHTML =
                `<div style="text-align:center;padding:80px 0;color:var(--text-muted);">
                    <i class="fas fa-lock" style="font-size:40px;opacity:.25;display:block;margin-bottom:16px;"></i>
                    <h3 style="font-weight:600;margin-bottom:8px;">Không có quyền truy cập</h3>
                    <p>Liên hệ Admin để được cấp quyền module Todo List.</p>
                </div>`;
            return;
        }

        // Ẩn nút Thêm nếu không có quyền create
        const btnAdd = document.getElementById('btnAddTodo');
        if (btnAdd && !canCreate) btnAdd.style.display = 'none';

        // Hiện filter người dùng nếu có view_all
        if (canViewAll) {
            const af = document.getElementById('todoAssigneeFilter');
            if (af) af.style.display = '';
            const ag = document.getElementById('assigneeGroup');
            if (ag) ag.style.display = '';
            await _loadTodoUsers();
        }

        // Init calendar
        const now = new Date();
        _calY = now.getFullYear();
        _calM = now.getMonth();
        _calSel = null;

        await todoLoadTasks();
    } catch (e) {
        console.error('[Todo] initTodoModule error:', e);
    }
}

// ===== LOAD =====
async function todoLoadTasks() {
    try {
        const isAdmin = _todoUser && _todoUser.role === 'Admin';
        const canViewAll = isAdmin || _todoPerms.includes('view_all');
        const filters = canViewAll ? {} : { owner_id: _todoUser ? _todoUser.id : -1 };

        const res = await window.api.getTodos(filters);
        _todoTasks = (res && res.success) ? (res.data || []) : [];
        todoApplyFilter();
    } catch (e) {
        console.error('[Todo] loadTasks error:', e);
        _todoTasks = [];
        todoApplyFilter();
    }
}

// ===== FILTER =====
function todoApplyFilter() {
    const q = (document.getElementById('todoSearch')?.value || '').toLowerCase();
    const pri = document.getElementById('todoPriorityFilter')?.value || '';
    const uid = document.getElementById('todoAssigneeFilter')?.value || '';

    _todoFiltered = _todoTasks.filter(t => {
        if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
        if (pri && t.priority !== pri) return false;
        if (uid && String(t.owner_id) !== uid && String(t.assignee_id || '') !== uid) return false;
        return true;
    });

    _renderKanban();
    _renderStats();
    _renderCalendar();
}

// ===== KANBAN =====
function _renderKanban() {
    const cols = { todo: [], doing: [], done: [] };
    _todoFiltered.forEach(t => (cols[t.status] || cols.todo).push(t));

    ['todo', 'doing', 'done'].forEach(s => {
        const body = document.getElementById('cards-' + s);
        const count = document.getElementById('count-' + s);
        if (!body) return;
        count.textContent = cols[s].length;

        if (!cols[s].length) {
            const msg = { todo: 'Chưa có việc cần làm', doing: 'Chưa có việc đang làm', done: 'Chưa hoàn thành task nào' }[s];
            body.innerHTML = `<div class="kanban-empty"><i class="fas fa-inbox"></i><span>${msg}</span></div>`;
            return;
        }
        body.innerHTML = cols[s].map(t => _cardHTML(t, s)).join('');
    });
}

function _cardHTML(t, status) {
    const isAdmin = _todoUser?.role === 'Admin';
    const isOwner = t.owner_id === _todoUser?.id;
    const canEdit = isAdmin || _todoPerms.includes('update') || isOwner;
    const canDel = isAdmin || _todoPerms.includes('delete') || isOwner;
    const today = new Date().toISOString().split('T')[0];

    const pCfg = { high: ['🔴', 'Cao', 'priority-high'], medium: ['🟠', 'T.Bình', 'priority-medium'], low: ['🟢', 'Thấp', 'priority-low'] };
    const [pIco, pLbl, pCls] = pCfg[t.priority] || pCfg.medium;

    let dueBadge = '';
    if (t.due_date) {
        const cls = (status !== 'done' && t.due_date < today) ? 'overdue' : t.due_date === today ? 'today' : '';
        const lbl = t.due_date === today ? 'Hôm nay' : _fmt(t.due_date);
        dueBadge = `<span class="task-due-badge ${cls}"><i class="fas fa-calendar-alt"></i>${lbl}</span>`;
    }

    const assignBadge = (t.assignee_name && t.assignee_name !== t.owner_name)
        ? `<span class="task-assignee"><i class="fas fa-user-tag"></i>${_esc(t.assignee_name)}</span>` : '';
    const noteBadge = t.note
        ? `<span class="task-note-icon" title="${_esc(t.note)}" style="color:var(--text-muted);font-size:11px;"><i class="fas fa-sticky-note"></i></span>` : '';

    const editBtn = canEdit
        ? `<button class="task-action-btn" title="Sửa" onclick="event.stopPropagation();todoOpenModal(${t.id})"><i class="fas fa-edit"></i></button>` : '';
    const delBtn = canDel
        ? `<button class="task-action-btn danger" title="Xóa" onclick="event.stopPropagation();todoDelete(${t.id})"><i class="fas fa-trash"></i></button>` : '';

    const labelMap = { todo: 'Cần làm', doing: 'Đang làm', done: 'Xong' };
    const statusBtns = canEdit ? `<div class="task-card-status-btns">
        ${['todo', 'doing', 'done'].map(s =>
        `<button class="status-quick-btn ${s === status ? 'active' : ''}"
             onclick="event.stopPropagation();todoChangeStatus(${t.id},'${s}')">${labelMap[s]}</button>`
    ).join('')}</div>` : '';

    return `<div class="task-card" onclick="todoOpenModal(${t.id})">
        <div class="task-card-top">
            <div class="task-card-title ${status === 'done' ? 'done-title' : ''}">${_esc(t.title)}</div>
            <div class="task-card-actions">${editBtn}${delBtn}</div>
        </div>
        ${t.description ? `<div class="task-card-desc">${_esc(t.description)}</div>` : ''}
        <div class="task-card-meta">
            <span class="task-priority-badge ${pCls}">${pIco} ${pLbl}</span>
            ${dueBadge}${noteBadge}${assignBadge}
        </div>
        ${statusBtns}
    </div>`;
}

// ===== STATS =====
function _renderStats() {
    const today = new Date().toISOString().split('T')[0];
    const od = _todoFiltered.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length;
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('statTotal', _todoFiltered.length);
    el('statDoing', _todoFiltered.filter(t => t.status === 'doing').length);
    el('statDone', _todoFiltered.filter(t => t.status === 'done').length);
    el('statOverdue', od);
}

// ===== CALENDAR =====
function _renderCalendar() {
    const MN = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const titleEl = document.getElementById('calTitle');
    const gridEl = document.getElementById('calGrid');
    if (!titleEl || !gridEl) return;

    titleEl.textContent = `${MN[_calM]} ${_calY}`;
    const taskDays = new Set(_todoFiltered.filter(t => t.due_date).map(t => t.due_date));
    const today = new Date().toISOString().split('T')[0];
    const startDow = new Date(_calY, _calM, 1).getDay();
    const totalD = new Date(_calY, _calM + 1, 0).getDate();

    let html = DOW.map(d => `<div class="mini-cal-dow">${d}</div>`).join('');
    for (let i = 0; i < startDow; i++) {
        html += `<div class="mini-cal-day other-month">${new Date(_calY, _calM, i - startDow + 1).getDate()}</div>`;
    }
    for (let d = 1; d <= totalD; d++) {
        const ds = `${_calY}-${String(_calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cls = [ds === today ? 'today' : '', taskDays.has(ds) ? 'has-task' : '', ds === _calSel ? 'selected' : ''].filter(Boolean).join(' ');
        html += `<div class="mini-cal-day ${cls}" onclick="todoCalClick('${ds}')">${d}</div>`;
    }
    gridEl.innerHTML = html;
    _renderCalDayTasks();
}

function todoCalClick(ds) { _calSel = _calSel === ds ? null : ds; _renderCalendar(); }
function todoCalPrev() { _calM--; if (_calM < 0) { _calM = 11; _calY--; } _renderCalendar(); }
function todoCalNext() { _calM++; if (_calM > 11) { _calM = 0; _calY++; } _renderCalendar(); }

function _renderCalDayTasks() {
    const el = document.getElementById('calDayTasks');
    if (!el) return;
    if (!_calSel) { el.innerHTML = ''; return; }
    const tasks = _todoFiltered.filter(t => t.due_date === _calSel);
    const sLbl = { todo: 'Cần làm', doing: 'Đang làm', done: 'Xong' };
    if (!tasks.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px 0;"><i class="fas fa-coffee" style="margin-right:4px;"></i>Không có task ngày ${_fmt(_calSel)}</div>`;
        return;
    }
    el.innerHTML = `<div class="cal-day-tasks-title"><i class="fas fa-list" style="margin-right:6px;"></i>${_fmt(_calSel)}</div>` +
        tasks.map(t => `<div class="cal-task-item" onclick="todoOpenModal(${t.id})" style="cursor:pointer;">
            <div class="ct-title">${_esc(t.title)}</div>
            <div class="ct-sub">${sLbl[t.status] || t.status} · ${t.owner_name || 'Bạn'}</div>
        </div>`).join('');
}

// ===== MODAL =====
async function todoOpenModal(id) {
    const overlay = document.getElementById('todoModalOverlay');
    if (!overlay) return;

    // Reset form
    ['todoEditId', 'todoTitle', 'todoDesc', 'todoDueDate', 'todoNote'].forEach(fid => {
        const e = document.getElementById(fid); if (e) e.value = '';
    });
    if (document.getElementById('todoStatus')) document.getElementById('todoStatus').value = 'todo';
    if (document.getElementById('todoPriority')) document.getElementById('todoPriority').value = 'medium';
    const assignEl = document.getElementById('todoAssignee');
    if (assignEl) assignEl.value = '';
    document.getElementById('todoModalTitle').textContent = 'Thêm task mới';
    document.getElementById('todoSaveBtn').style.display = '';
    document.getElementById('todoSaveBtn').innerHTML = '<i class="fas fa-save"></i> Lưu task';
    overlay.querySelectorAll('input,select,textarea').forEach(e => e.disabled = false);

    // Pre-fill today
    if (!id) {
        const todoDueDateEl = document.getElementById('todoDueDate');
        if (todoDueDateEl) todoDueDateEl.value = new Date().toISOString().split('T')[0];
    }

    if (id) {
        const res = await window.api.getTodoById(id);
        if (res && res.success && res.data) {
            const t = res.data;
            const isAdmin = _todoUser?.role === 'Admin';
            const canEdit = isAdmin || _todoPerms.includes('update') || t.owner_id === _todoUser?.id;

            document.getElementById('todoModalTitle').textContent = canEdit ? 'Chỉnh sửa task' : 'Chi tiết task';
            document.getElementById('todoEditId').value = t.id;
            document.getElementById('todoTitle').value = t.title;
            document.getElementById('todoDesc').value = t.description || '';
            document.getElementById('todoStatus').value = t.status;
            document.getElementById('todoPriority').value = t.priority;
            document.getElementById('todoDueDate').value = t.due_date || '';
            document.getElementById('todoNote').value = t.note || '';
            if (assignEl) assignEl.value = t.assignee_id || '';

            if (!canEdit) {
                overlay.querySelectorAll('input,select,textarea').forEach(e => e.disabled = true);
                document.getElementById('todoSaveBtn').style.display = 'none';
            }
        }
    }

    overlay.classList.add('active');
    if (!id) setTimeout(() => { const e = document.getElementById('todoTitle'); if (e) e.focus(); }, 80);
}

function todoCloseModal() {
    const o = document.getElementById('todoModalOverlay');
    if (o) o.classList.remove('active');
}

async function todoSave() {
    const titleVal = (document.getElementById('todoTitle')?.value || '').trim();
    if (!titleVal) {
        Swal.fire({ icon: 'warning', title: 'Bắt buộc', text: 'Vui lòng nhập tiêu đề task.', timer: 2000, showConfirmButton: false });
        return;
    }

    const btn = document.getElementById('todoSaveBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    const editId = document.getElementById('todoEditId').value;
    const data = {
        title: titleVal,
        description: (document.getElementById('todoDesc')?.value || '').trim() || null,
        status: document.getElementById('todoStatus')?.value || 'todo',
        priority: document.getElementById('todoPriority')?.value || 'medium',
        due_date: document.getElementById('todoDueDate')?.value || null,
        note: (document.getElementById('todoNote')?.value || '').trim() || null,
        assignee_id: document.getElementById('todoAssignee')?.value || null,
        owner_id: _todoUser?.id,
        department: _todoUser?.department || null
    };

    let res;
    try {
        res = editId
            ? await window.api.updateTodo(parseInt(editId), data)
            : await window.api.addTodo(data);
    } catch (e) {
        res = { success: false, error: e.message };
    }

    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Lưu task';

    if (res && res.success) {
        todoCloseModal();
        // Await Swal để tắt hẳn trước khi reload — tránh Swal chặn click button
        await Swal.fire({ icon: 'success', title: editId ? 'Đã cập nhật!' : 'Đã thêm task!', timer: 1200, showConfirmButton: false });
        await todoLoadTasks();
    } else {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: res?.error || 'Không thể lưu task.' });
    }
}

async function todoDelete(id) {
    const cf = await Swal.fire({
        icon: 'warning', title: 'Xóa task này?', text: 'Thao tác không thể hoàn tác.',
        showCancelButton: true, confirmButtonText: 'Xóa ngay',
        confirmButtonColor: '#dc2626', cancelButtonText: 'Hủy'
    });
    if (!cf.isConfirmed) return;
    const res = await window.api.deleteTodo(id);
    if (res && res.success) {
        Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1000, showConfirmButton: false });
        await todoLoadTasks();
    }
}

async function todoChangeStatus(id, status) {
    const res = await window.api.updateTodoStatus(id, status);
    if (res && res.success) await todoLoadTasks();
}

// ===== HELPERS =====
async function _loadTodoUsers() {
    const res = await window.api.getUsers();
    if (!res || !res.success) return;
    _todoUsers = res.data || [];
    const opts = _todoUsers.map(u => `<option value="${u.id}">${_esc(u.full_name)} (${u.role})</option>`).join('');
    const sel1 = document.getElementById('todoAssignee');
    const sel2 = document.getElementById('todoAssigneeFilter');
    if (sel1) sel1.innerHTML = `<option value="">— Bản thân —</option>${opts}`;
    if (sel2) sel2.innerHTML = `<option value="">Tất cả người dùng</option>${opts}`;
}

function _fmt(ds) {
    if (!ds) return '';
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
}

function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
