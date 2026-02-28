/**
 * todo.js — Logic module Todo List (Multi-View Redesign)
 * Views: My Day, Next 7 Days, All Tasks (Kanban), Calendar
 */

// ===== STATE =====
let _todoTasks = [];
let _todoFiltered = [];
let _todoUser = null;
let _todoPerms = [];
let _todoUsers = [];
let _calY = 0, _calM = 0, _calSel = null;
let _currentView = 'today'; // today | next7 | all | calendar

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
        const canViewAll = !isAdmin && _todoPerms.includes('view_all');

        // Check Permissions
        if (!canView) {
            document.getElementById('section-todo').innerHTML =
                `<div style="text-align:center;padding:80px 0;color:var(--text-muted);">
                    <i class="fas fa-lock" style="font-size:40px;opacity:.25;display:block;margin-bottom:16px;"></i>
                    <h3 style="font-weight:600;margin-bottom:8px;">Không có quyền truy cập</h3>
                    <p>Liên hệ Admin để được cấp quyền module Todo List.</p>
                </div>`;
            return;
        }

        // Hide "Add Task" button if no permission
        const btnAdd = document.getElementById('btnAddTodo');
        if (btnAdd && !canCreate) btnAdd.style.display = 'none';

        // Load users for Assignee dropdown
        if (isAdmin || canViewAll) {
            const af = document.getElementById('todoAssigneeFilter');
            if (af) af.style.display = '';
            const ag = document.getElementById('assigneeGroup');
            if (ag) ag.style.display = '';
            await _loadTodoUsers();
        }

        // Initialize Calendar Date
        const now = new Date();
        _calY = now.getFullYear();
        _calM = now.getMonth();
        _calSel = null;

        // Load SortableJS
        if (!window._sortableJsLoaded) {
            window._sortableJsLoaded = true;
            const s = document.createElement('script');
            s.src = '../../../node_modules/sortablejs/Sortable.min.js';
            s.onload = () => { console.log('[Todo] SortableJS loaded locally'); _renderCurrentView(); };
            s.onerror = () => {
                console.warn('[Todo] Local SortableJS not found, trying CDN...');
                const s2 = document.createElement('script');
                s2.src = 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js';
                s2.onload = () => _renderCurrentView();
                document.head.appendChild(s2);
            };
            document.head.appendChild(s);
        }

        await todoLoadTasks();

        // Initial View Render
        switchTodoView('today');

    } catch (e) {
        console.error('[Todo] initTodoModule error:', e);
    }
}

// ===== NAVIGATION / VIEW SWITCHING =====
function switchTodoView(viewName) {
    _currentView = viewName;

    // Update Sidebar Active State
    document.querySelectorAll('.todo-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${viewName}`).classList.add('active');

    // Update Main Title
    const titles = {
        'today': 'My Day',
        'next7': 'Next 7 Days',
        'all': 'All My Tasks',
        'calendar': 'Calendar'
    };
    document.getElementById('todo-view-title').innerHTML = titles[viewName];

    // Subtitle Dates
    const now = new Date();
    const subFormat = { weekday: 'long', month: 'long', day: 'numeric' };
    let subStr = '';

    if (viewName === 'today' || viewName === 'calendar' || viewName === 'all') {
        subStr = now.toLocaleDateString('en-US', subFormat);
    } else if (viewName === 'next7') {
        const nextWk = new Date();
        nextWk.setDate(now.getDate() + 6);
        subStr = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${nextWk.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    document.getElementById('todo-view-subtitle').textContent = subStr;

    // Toggle View Containers
    document.querySelectorAll('.todo-view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    _renderCurrentView();
}

// ===== API & DATA LOADING =====
async function todoLoadTasks() {
    try {
        const isAdmin = _todoUser && _todoUser.role === 'Admin';
        const canViewAll = !isAdmin && _todoPerms.includes('view_all');
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

    _updateSidebarCounts();
    _renderCurrentView();
}

function _updateSidebarCounts() {
    const todayStr = _fmtDateObj(new Date());

    const todayCount = _todoFiltered.filter(t => t.due_date === todayStr && t.status !== 'done').length;

    // Config dates for Next 7 Days
    let next7Dates = [];
    for (let i = 0; i < 7; i++) {
        let d = new Date();
        d.setDate(d.getDate() + i);
        next7Dates.push(_fmtDateObj(d));
    }
    const next7Count = _todoFiltered.filter(t => next7Dates.includes(t.due_date) && t.status !== 'done').length;

    const allCount = _todoFiltered.filter(t => t.status !== 'done').length;

    document.getElementById('count-nav-today').textContent = todayCount;
    document.getElementById('count-nav-next7').textContent = next7Count;
    document.getElementById('count-nav-all').textContent = allCount;
}

function _renderCurrentView() {
    if (_currentView === 'today') _renderMyDay();
    else if (_currentView === 'next7') _renderNext7Days();
    else if (_currentView === 'all') _renderKanban();
    else if (_currentView === 'calendar') _renderCalendar();
}

// ===== VIEW: MY DAY =====
function _renderMyDay() {
    const todayStr = _fmtDateObj(new Date());
    const tasks = _todoFiltered.filter(t => t.due_date === todayStr);

    const container = document.getElementById('list-today');
    const empty = document.getElementById('empty-today');

    if (tasks.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';

    // Sort tasks: undone first, then done. Within undone, sort by priority
    const priorityWeight = { 'high': 3, 'medium': 2, 'low': 1 };
    tasks.sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;

        const wpA = priorityWeight[a.priority] || 0;
        const wpB = priorityWeight[b.priority] || 0;
        return wpB - wpA;
    });

    container.innerHTML = tasks.map(t => _buildListItemHTML(t)).join('');
}

function _buildListItemHTML(t) {
    const isDone = t.status === 'done';
    const isAdmin = _todoUser?.role === 'Admin';
    const isOwner = t.owner_id === _todoUser?.id;
    const canEdit = isAdmin || _todoPerms.includes('update') || isOwner;
    const canDel = isAdmin || _todoPerms.includes('delete') || isOwner;

    const pCfg = { high: '🔴 Cao', medium: '🟠 TB', low: '🟢 Thấp' };

    const checkAction = canEdit
        ? `onclick="event.stopPropagation(); todoToggleCheck(${t.id}, '${t.status}')"`
        : `onclick="event.stopPropagation();"`;

    const delBtn = canDel
        ? `<button class="task-action-btn danger" onclick="event.stopPropagation(); todoDelete(${t.id})"><i class="fas fa-trash"></i></button>`
        : ``;

    return `
        <div class="task-list-item ${isDone ? 'done' : ''}" onclick="todoOpenModal(${t.id})">
            <div class="task-list-checkbox" ${checkAction} title="${isDone ? 'Bỏ tick hoàn thành' : 'Đánh dấu hoàn thành'}">
                <i class="fas fa-check"></i>
            </div>
            <div class="task-list-content">
                <div class="task-list-title">${_esc(t.title)}</div>
                <div class="task-list-meta">
                    <span>${pCfg[t.priority] || pCfg.medium}</span>
                    ${t.description ? `<span style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${_esc(t.description)}"><i class="fas fa-align-left" style="margin-right:4px; opacity:0.7;"></i>${_esc(t.description)}</span>` : ''}
                </div>
            </div>
            <div class="task-list-actions">
                ${delBtn}
            </div>
        </div>
    `;
}

// ===== VIEW: NEXT 7 DAYS =====
function _renderNext7Days() {
    const board = document.getElementById('next7-board');
    if (!board) return;

    // Destroy old sortables
    if (board.__sortables) {
        board.__sortables.forEach(s => s.destroy());
    }
    board.__sortables = [];

    const now = new Date();
    const dates = [];
    const dateObjs = [];

    for (let i = 0; i < 7; i++) {
        let d = new Date();
        d.setDate(now.getDate() + i);
        dateObjs.push(d);
        dates.push(_fmtDateObj(d));
    }

    let html = '';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
        const ds = dates[i];
        const isToday = i === 0;
        let tasks = _todoFiltered.filter(t => t.due_date === ds);

        // Sort: undone first, then done. Within undone, stick to original order_index
        tasks.sort((a, b) => {
            if (a.status === 'done' && b.status !== 'done') return 1;
            if (a.status !== 'done' && b.status === 'done') return -1;
            return (a.order_index || 0) - (b.order_index || 0);
        });

        const name = isToday ? 'Today' : (i === 1 ? 'Tomorrow' : dayNames[dateObjs[i].getDay()]);
        const subDate = dateObjs[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Task Cards HTML
        const cardsHtml = tasks.map(t => _buildKanbanCardHTML(t)).join('');

        html += `
            <div class="next7-col ${isToday ? 'is-today' : ''}">
                <div class="next7-col-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="next7-day-name">${name}</span>
                        <span class="col-count" style="font-size:11px; padding:2px 6px;">${tasks.length}</span>
                    </div>
                    <span class="next7-date">${subDate}</span>
                </div>
                <div class="next7-col-body" id="next7-col-${ds}" data-date="${ds}">
                    ${cardsHtml}
                    ${tasks.length === 0 ? '<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#cbd5e1; font-size:12px; font-weight:700;"><i class="fas fa-download" style="font-size:20px; margin-bottom:8px;"></i>+ Drop here</div>' : ''}
                </div>
                <button class="next7-add-task-btn" onclick="todoOpenModal(null, '${ds}')">
                    <i class="fas fa-plus"></i> Add Task
                </button>
            </div>
        `;
    }

    board.innerHTML = html;

    // Init SortableJS on the 7 columns
    if (window.Sortable) {
        for (let i = 0; i < 7; i++) {
            const ds = dates[i];
            const el = document.getElementById(`next7-col-${ds}`);
            if (el) {
                const s = new Sortable(el, {
                    group: 'next7',
                    animation: 150,
                    draggable: '.draggable-card',
                    ghostClass: 'sortable-ghost',
                    onEnd: async function (evt) {
                        const itemEl = evt.item;
                        const taskId = itemEl.getAttribute('data-id');
                        const toDate = evt.to.getAttribute('data-date');
                        const fromDate = evt.from.getAttribute('data-date');

                        if (taskId && toDate !== fromDate) {
                            await todoChangeDueDate(taskId, toDate, true);
                        }

                        const items = Array.from(evt.to.querySelectorAll('.task-card')).map((card, idx) => ({
                            id: card.getAttribute('data-id'), order_index: idx
                        }));
                        if (items.length) {
                            await window.api.updateTodoOrder(items);
                        }
                        await todoLoadTasks();
                    }
                });
                board.__sortables.push(s);
            }
        }
    }
}

// ===== VIEW: ALL TASKS (KANBAN) =====
function _renderKanban() {
    const cols = { todo: [], doing: [], done: [] };
    _todoFiltered.forEach(t => (cols[t.status] || cols.todo).push(t));

    ['todo', 'doing', 'done'].forEach(s => {
        const body = document.getElementById('cards-' + s);
        const count = document.getElementById('count-' + s);
        if (!body) return;
        count.textContent = cols[s].length;

        if (body._sortable) {
            body._sortable.destroy();
            body._sortable = null;
        }

        if (!cols[s].length) {
            const msg = { todo: 'Chưa có việc cần làm', doing: 'Chưa có việc đang làm', done: 'Chưa hoàn thành task nào' }[s];
            const icon = { todo: 'fa-clipboard-list', doing: 'fa-spinner', done: 'fa-check-circle' }[s];
            body.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#94a3b8; text-align:center; padding: 20px;">
                    <div style="width:48px; height:48px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
                        <i class="fas ${icon}" style="font-size:20px;"></i>
                    </div>
                    <span style="font-size:13px; font-weight:600; color:#64748b;">${msg}</span>
                </div>
            `;
        } else {
            body.innerHTML = cols[s].map(t => _buildKanbanCardHTML(t)).join('');
        }

        if (window.Sortable) {
            body._sortable = new Sortable(body, {
                group: 'allTasks',
                animation: 150,
                draggable: '.draggable-card',
                ghostClass: 'sortable-ghost',
                onEnd: async function (evt) {
                    const itemEl = evt.item;
                    const taskId = itemEl.getAttribute('data-id');
                    const toCol = evt.to.id.replace('cards-', '');
                    const fromCol = evt.from.id.replace('cards-', '');

                    if (taskId && toCol !== fromCol) {
                        await todoChangeStatus(taskId, toCol, true);
                    }

                    const items = Array.from(evt.to.querySelectorAll('.task-card')).map((card, idx) => ({
                        id: card.getAttribute('data-id'), order_index: idx
                    }));
                    if (items.length) {
                        await window.api.updateTodoOrder(items);
                    }
                    await todoLoadTasks();
                }
            });
        }
    });
}

function _buildKanbanCardHTML(t) {
    const isAdmin = _todoUser?.role === 'Admin';
    const isOwner = t.owner_id === _todoUser?.id;
    const canEdit = isAdmin || _todoPerms.includes('update') || isOwner;
    const canDel = isAdmin || _todoPerms.includes('delete') || isOwner;
    const today = new Date().toISOString().split('T')[0];

    const isDone = t.status === 'done';

    const pCfg = { high: '#ef4444', medium: '#f97316', low: '#22c55e' };
    const dotColor = pCfg[t.priority] || '#f97316';

    let topLabel = '';
    if (t.due_date) {
        const [y, m, d] = t.due_date.split('-');
        const dateText = t.due_date === today ? 'HÔM NAY' : `${d}/${m}`;
        const dotHtml = `<div style="width:6px;height:6px;border-radius:50%;background:${dotColor};"></div>`;
        topLabel = `<div style="display:flex; align-items:center; gap:6px; font-size:10px; font-weight:800; color:${dotColor}; margin-bottom:10px; letter-spacing:0.5px;">${dotHtml}${dateText}</div>`;
    }

    const checkIcon = isDone
        ? `<i class="fas fa-check-circle" style="color:var(--td-primary);font-size:15px;"></i>`
        : `<i class="far fa-circle" style="color:#cbd5e1;font-size:15px;"></i>`;

    const checkBtn = canEdit
        ? `<div onclick="event.stopPropagation(); todoToggleCheck(${t.id}, '${t.status}')" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px;" title="${isDone ? 'Bỏ tick hoàn thành' : 'Đánh dấu hoàn thành'}">${checkIcon}</div>`
        : '';

    const editBtn = canEdit ? `<button class="task-action-btn" title="Sửa" onclick="event.stopPropagation();todoOpenModal(${t.id})"><i class="fas fa-edit"></i></button>` : '';
    const delBtn = canDel ? `<button class="task-action-btn danger" title="Xóa" onclick="event.stopPropagation();todoDelete(${t.id})"><i class="fas fa-trash"></i></button>` : '';
    const draggableCls = canEdit ? ' draggable-card' : '';

    const avatarHtml = `<div style="width:20px;height:20px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;font-weight:700;">${(t.title || 'T')[0].toUpperCase()}</div>`;

    return `
        <div class="task-card${draggableCls} ${isDone ? 'done' : ''}" data-id="${t.id}" onclick="todoOpenModal(${t.id})">
            ${topLabel}
            <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:${t.description ? '6px' : '20px'};">
                ${checkBtn ? `<div style="margin-top:2px;">${checkBtn}</div>` : ''}
                <div class="task-card-title ${isDone ? 'done-title' : ''}" style="margin-bottom:0; font-size:15px; font-weight:700; line-height:1.4;">${_esc(t.title)}</div>
            </div>
            ${t.description ? `<div class="task-card-desc" style="margin-bottom:16px; ${isDone ? 'opacity:0.6;' : ''}">${_esc(t.description)}</div>` : ''}
            
            <div style="display:flex; justify-content:flex-end; align-items:center;">
                <div style="display:flex; gap:4px; align-items:center;">
                    <div class="task-card-actions" style="display:flex; gap:4px;">${editBtn}${delBtn}</div>
                </div>
            </div>
        </div>`;
}

// ===== VIEW: CALENDAR =====
function _renderCalendar() {
    const MN = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const titleEl = document.getElementById('calTitle');
    const gridEl = document.getElementById('calGrid');
    if (!titleEl || !gridEl) return;

    titleEl.textContent = `${MN[_calM]} - ${_calY}`;

    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(_calY, _calM, 1);
    const lastDay = new Date(_calY, _calM + 1, 0);
    const totalD = lastDay.getDate();

    // Convert getDay() (Sunday=0) to Monday=0
    let startDow = firstDay.getDay() - 1;
    if (startDow === -1) startDow = 6;

    // Header DOW
    let html = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');

    // Empty cells for previous month
    const prevMonthLastDay = new Date(_calY, _calM, 0).getDate();
    for (let i = 0; i < startDow; i++) {
        const dNum = prevMonthLastDay - startDow + i + 1;
        html += `<div class="cal-cell other-month"><div class="cal-cell-date">${dNum}</div></div>`;
    }

    // Days of current month
    for (let d = 1; d <= totalD; d++) {
        const ds = `${_calY}-${String(_calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = ds === today;
        const tasks = _todoFiltered.filter(t => t.due_date === ds);

        // Max 3 tasks visually, then show +x more
        const displayTasks = tasks.slice(0, 3).map(t =>
            `<div class="cal-task-pill ${t.status === 'done' ? 'done' : ''}">${_esc(t.title)}</div>`
        ).join('');
        const moreTxt = tasks.length > 3 ? `<div style="font-size:10px; color:var(--text-muted); font-weight:600; text-align:center;">+${tasks.length - 3} tasks</div>` : '';

        html += `
            <div class="cal-cell ${isToday ? 'today' : ''}" onclick="todoOpenModal('', '${ds}')">
                <div class="cal-cell-date">${d}</div>
                ${displayTasks}
                ${moreTxt}
            </div>`;
    }

    // Empty cells for next month
    let totalCells = startDow + totalD;
    let nextRows = Math.ceil(totalCells / 7) * 7;
    for (let i = 1; i <= nextRows - totalCells; i++) {
        html += `<div class="cal-cell other-month"><div class="cal-cell-date">${i}</div></div>`;
    }

    gridEl.innerHTML = html;
}

function todoCalToday() {
    const d = new Date();
    _calY = d.getFullYear();
    _calM = d.getMonth();
    _renderCalendar();
}
function todoCalPrev() { _calM--; if (_calM < 0) { _calM = 11; _calY--; } _renderCalendar(); }
function todoCalNext() { _calM++; if (_calM > 11) { _calM = 0; _calY++; } _renderCalendar(); }


// ===== QUICK ACTIONS (Called from UI & Drag Drop) =====
async function todoToggleCheck(id, currentStatus) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await todoChangeStatus(id, newStatus);
}

async function todoChangeStatus(id, status, skipReload = false) {
    const res = await window.api.updateTodoStatus(id, status);
    if (res && res.success && !skipReload) await todoLoadTasks();
}

async function todoChangeDueDate(id, newDate, skipReload = false) {
    // Need to fetch full existing data to preserve it, just changing due_date
    const t = _todoTasks.find(x => String(x.id) === String(id));
    if (!t) return;

    const data = {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        due_date: newDate,
        note: t.note,
        assignee_id: t.assignee_id,
        owner_id: t.owner_id,
        department: t.department
    };

    const res = await window.api.updateTodo(id, data);
    if (res && res.success && !skipReload) await todoLoadTasks();
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

// ===== MODAL (Add / Edit) =====
async function todoOpenModal(id, defaultDate = null) {
    const overlay = document.getElementById('todoModalOverlay');
    if (!overlay) return;

    // Reset form
    ['todoEditId', 'todoTitle', 'todoDueDate'].forEach(fid => {
        const e = document.getElementById(fid); if (e) e.value = '';
    });
    const descArea = document.getElementById('todoDescArea');
    if (descArea) descArea.innerHTML = '';
    if (document.getElementById('todoStatus')) document.getElementById('todoStatus').value = 'todo';
    if (document.getElementById('todoPriority')) document.getElementById('todoPriority').value = 'medium';
    const assignEl = document.getElementById('todoAssignee');
    if (assignEl) assignEl.value = '';

    document.getElementById('todoModalTitle').textContent = 'Thêm task mới';
    document.getElementById('todoSaveBtn').style.display = '';
    document.getElementById('todoSaveBtn').innerHTML = '<i class="fas fa-save"></i> Lưu task';
    overlay.querySelectorAll('input,select,textarea').forEach(e => e.disabled = false);

    // Pre-fill Date
    if (!id) {
        let sd = defaultDate;
        if (!sd) {
            // Context aware default date based on view
            if (_currentView === 'today') sd = _fmtDateObj(new Date());
            else if (_currentView === 'next7') {
                let d = new Date(); d.setDate(d.getDate() + 1); // Default to tomorrow natively
                sd = _fmtDateObj(d);
            }
        }
        if (sd) {
            const e = document.getElementById('todoDueDate');
            if (e) e.value = sd;
        }
    }

    // Load Existing
    if (id) {
        const res = await window.api.getTodoById(id);
        if (res && res.success && res.data) {
            const t = res.data;
            const isAdmin = _todoUser?.role === 'Admin';
            const canEdit = isAdmin || _todoPerms.includes('update') || t.owner_id === _todoUser?.id;

            document.getElementById('todoModalTitle').textContent = canEdit ? 'Chỉnh sửa task' : 'Chi tiết task';
            document.getElementById('todoEditId').value = t.id;
            document.getElementById('todoTitle').value = t.title;
            const descArea = document.getElementById('todoDescArea');
            if (descArea) descArea.innerHTML = t.description || '';
            document.getElementById('todoStatus').value = t.status;
            document.getElementById('todoPriority').value = t.priority;
            document.getElementById('todoDueDate').value = t.due_date || '';
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
    const descArea = document.getElementById('todoDescArea');
    let descHtml = descArea ? descArea.innerHTML : '';
    if (descHtml === '<br>') descHtml = ''; // Fix empty contenteditable anomaly

    const data = {
        title: titleVal,
        description: descHtml || null,
        status: document.getElementById('todoStatus')?.value || 'todo',
        priority: document.getElementById('todoPriority')?.value || 'medium',
        due_date: document.getElementById('todoDueDate')?.value || null,
        note: null,
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
        await Swal.fire({ icon: 'success', title: editId ? 'Đã cập nhật!' : 'Đã thêm task!', timer: 1200, showConfirmButton: false });
        await todoLoadTasks();
    } else {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: res?.error || 'Không thể lưu task.' });
    }
}

// ===== UTILS =====
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

function _fmtDateObj(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.todoScrollNext7 = function (dir) {
    const board = document.getElementById('next7-board');
    if (board) {
        board.scrollBy({ left: dir * 320, behavior: 'smooth' });
    }
};

window.todoExecCmd = function (cmd) {
    const area = document.getElementById('todoDescArea');
    if (area) {
        area.focus();
        document.execCommand(cmd, false, null);
    }
};

let _todoEmojiPickerLoaded = false;

window.todoToggleEmojiPicker = async function (e) {
    if (e) e.stopPropagation();
    const container = document.getElementById('todoEmojiContainer');
    if (!container) return;

    if (!_todoEmojiPickerLoaded) {
        const btn = document.getElementById('btnTodoEmoji');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.type = 'module';
                script.src = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@1/index.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });

            const picker = document.createElement('emoji-picker');
            picker.addEventListener('emoji-click', event => {
                window.todoInsertEmoji(event.detail.unicode, new Event('click'));
            });
            container.appendChild(picker);
            _todoEmojiPickerLoaded = true;
        } catch (err) {
            console.error('Failed to load emoji picker:', err);
        }

        btn.innerHTML = oldHtml;
    }

    container.classList.toggle('active');
};

window.todoInsertEmoji = function (emoji, e) {
    if (e) e.stopPropagation();
    const area = document.getElementById('todoDescArea');
    if (area) {
        area.focus();
        document.execCommand('insertText', false, emoji);
    }
    const container = document.getElementById('todoEmojiContainer');
    if (container) {
        container.classList.remove('active');
    }
};

// Close emoji popover when clicking outside
document.addEventListener('click', function (e) {
    const container = document.getElementById('todoEmojiContainer');
    const wrapper = e.target.closest('.todo-emoji-wrapper');
    if (container && container.classList.contains('active') && !wrapper) {
        container.classList.remove('active');
    }
});
