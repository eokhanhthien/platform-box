// src/views/kpi/kpi.js
// KPI Module — Role-based views: Admin (Config + Reports) / Employee (Input only)

// ============================================================================
// GLOBAL STATE
// ============================================================================
let _kpiCurrentUser = null;
let _kpiAdminConfig = {}; // current dept config being edited (Admin)
let _kpiReportConfig = {}; // config used for report header rendering
let _kpiEmpTemplate = {}; // employee's department template

// ============================================================================
// ENTRY POINT — called by dashboard.js when KPI section is activated
// ============================================================================
async function initKpiModule() {
    try {
        const user = await window.api.getCurrentUser();
        if (!user) return;
        _kpiCurrentUser = user;

        // Hide both views first
        document.getElementById('kpi-admin-view').style.display = 'none';
        document.getElementById('kpi-employee-view').style.display = 'none';

        // RBAC check
        const rolePerms = (window.APP_CONFIG.PERMISSIONS[user.role] || {});
        const kpiPerms = rolePerms['kpi'] || [];

        if (!kpiPerms.includes('view') && user.role !== 'Admin') {
            document.querySelector('.kpi-root').innerHTML = `
                <div style="text-align:center; padding:60px 0; color:var(--text-muted);">
                    <i class="fas fa-lock" style="font-size:36px; margin-bottom:16px; opacity:0.4;"></i>
                    <p style="font-size:15px;">Bạn không có quyền truy cập phân hệ KPI.</p>
                </div>`;
            return;
        }

        // Route view based on ROLE, not permissions
        // (permissions only gate access; role determines which UI to show)
        if (user.role === 'Admin' || user.role === 'Lãnh đạo') {
            _initAdminView();
        } else {
            _initEmployeeView();
        }

    } catch (err) {
        console.error('initKpiModule error:', err);
    }
}

// ============================================================================
// ADMIN VIEW
// ============================================================================
function _initAdminView() {
    const view = document.getElementById('kpi-admin-view');
    view.style.display = 'block';

    // Populate department selects
    const depts = window.APP_CONFIG.DEPARTMENTS || [];

    const configSelect = document.getElementById('kpiAdminDeptSelect');
    configSelect.innerHTML = '<option value="">-- Chọn phòng ban --</option>';
    depts.forEach(d => {
        configSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });

    const reportDeptSelect = document.getElementById('kpiReportDeptFilter');
    reportDeptSelect.innerHTML = '<option value="">-- Chọn phòng ban --</option>';

    // Admin thấy tất cả phòng ban; Lãnh đạo chỉ thấy phòng của mình
    let visibleDepts = depts;
    if (_kpiCurrentUser && _kpiCurrentUser.role !== 'Admin') {
        const userDept = _kpiCurrentUser.department || '';
        // users.js lưu bằng ' + ' hoặc ',' — split cả hai
        const myDepts = userDept.split(/[,+]/).map(d => d.trim()).filter(Boolean);
        // Giữ đúng thứ tự của myDepts (thứ tự phòng của lãnh đạo)
        visibleDepts = myDepts.filter(d => depts.includes(d));
        // Fallback: phòng không có trong APP_CONFIG.DEPARTMENTS thì vẫn hiển thị
        if (visibleDepts.length === 0 && myDepts.length > 0) visibleDepts = myDepts;
    }

    visibleDepts.forEach(d => {
        reportDeptSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });

    // Apply default date range (this month)
    applyReportPeriodPreset(); // triggers _renderPeriodInput for admin report

    // Lãnh đạo: chỉ xem báo cáo, không cấu hình tiêu chí
    if (_kpiCurrentUser && _kpiCurrentUser.role !== 'Admin') {
        const configPanel = document.getElementById('kpiConfigPanel');
        if (configPanel) configPanel.style.display = 'none';
    }
}

// --- Config panel ---

async function onAdminDeptChange() {
    const dept = document.getElementById('kpiAdminDeptSelect').value;
    const bodyEl = document.getElementById('kpiAdminConfigBody');
    const emptyEl = document.getElementById('kpiAdminConfigEmpty');

    if (!dept) {
        bodyEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }

    try {
        const res = await window.api.getKpiTemplate(dept);
        if (res.success) {
            _kpiAdminConfig = (res.data && res.data.config) ? res.data.config : {};
        } else {
            _kpiAdminConfig = {};
        }

        bodyEl.style.display = 'block';
        emptyEl.style.display = 'none';
        _renderAdminConfigTable();
    } catch (err) {
        console.error('onAdminDeptChange error', err);
    }
}

function _renderAdminConfigTable() {
    const tbody = document.getElementById('kpiAdminConfigBody_table');
    tbody.innerHTML = '';

    const keys = Object.keys(_kpiAdminConfig).sort((a, b) =>
        parseInt(a.split('_')[1]) - parseInt(b.split('_')[1])
    );

    document.getElementById('kpiAdminCountLabel').textContent = keys.length;

    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Chưa có tiêu chí nào. Bấm <strong>Thêm</strong> để bắt đầu.</td></tr>`;
        return;
    }

    keys.forEach(key => {
        const item = _kpiAdminConfig[key];
        tbody.innerHTML += `
        <tr id="crow-${key}">
            <td><input class="cfg-name" data-key="${key}" value="${item.name || ''}" placeholder="Tên tiêu chí..."></td>
            <td><input class="cfg-unit" data-key="${key}" value="${item.unit || ''}" placeholder="VNĐ, Lượt..."></td>
            <td>
                <button class="kpi-btn-icon danger" onclick="adminRemoveKpiRow('${key}')" title="Xóa">
                    <i class="fas fa-times" style="font-size:11px;"></i>
                </button>
            </td>
        </tr>`;
    });
}

function adminAddKpiRow() {
    const keys = Object.keys(_kpiAdminConfig);
    if (keys.length >= 30) {
        Swal.fire('Giới hạn', 'Hệ thống chỉ hỗ trợ tối đa 30 tiêu chí KPI.', 'warning');
        return;
    }

    // Find next available slot kpi_1 to kpi_30
    let nextNum = 1;
    for (let i = 1; i <= 30; i++) {
        if (!_kpiAdminConfig[`kpi_${i}`]) { nextNum = i; break; }
    }

    _kpiAdminConfig[`kpi_${nextNum}`] = { name: '', unit: '' };
    _renderAdminConfigTable();

    // Focus on new row
    setTimeout(() => {
        const inputs = document.querySelectorAll('.cfg-name');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
}

function adminRemoveKpiRow(key) {
    delete _kpiAdminConfig[key];
    _renderAdminConfigTable();
}

async function adminSaveKpiConfig() {
    const dept = document.getElementById('kpiAdminDeptSelect').value;
    if (!dept) return;

    // Sync input values into object
    document.querySelectorAll('.cfg-name').forEach(el => {
        const key = el.getAttribute('data-key');
        if (_kpiAdminConfig[key]) _kpiAdminConfig[key].name = el.value.trim();
    });
    document.querySelectorAll('.cfg-unit').forEach(el => {
        const key = el.getAttribute('data-key');
        if (_kpiAdminConfig[key]) _kpiAdminConfig[key].unit = el.value.trim();
    });

    // Validate
    for (const key in _kpiAdminConfig) {
        if (!_kpiAdminConfig[key].name) {
            Swal.fire('Thiếu thông tin', `Vui lòng nhập tên cho tiêu chí <strong>${key}</strong>.`, 'warning');
            return;
        }
    }

    try {
        const res = await window.api.saveKpiTemplate(dept, _kpiAdminConfig);
        if (res.success) {
            Swal.fire({
                icon: 'success',
                title: 'Đã lưu!',
                text: `Cấu hình KPI cho phòng "${dept}" đã được cập nhật.`,
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire('Lỗi', res.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// --- Report panel ---

function onReportDeptFilterChange() {
    // Just visually reset table until user clicks Tra cứu
    document.getElementById('kpiReportTableWrap').innerHTML = `
        <div class="kpi-empty-state">
            <i class="fas fa-chart-bar"></i>
            <p>Bấm <strong>Tra cứu</strong> để tải báo cáo</p>
        </div>`;
}

// ============================================================================
// PERIOD TYPE HELPERS — shared by both Admin and Employee filter
// ============================================================================

const _fmtDate = d => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().split('T')[0];
};

/**
 * Render the appropriate date input(s) into a container div.
 * type: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
 * prefix: 'adminReport' | 'empHistory'  (used as id prefix for inputs)
 */
function _renderPeriodInput(containerId, prefix, type) {
    const now = new Date();
    const container = document.getElementById(containerId);
    if (!container) return;

    switch (type) {
        case 'day':
            container.innerHTML = `
                <div>
                    <span class="form-col-label">Chọn ngày</span>
                    <input type="date" id="${prefix}Date" class="kpi-form-date" value="${_fmtDate(now)}">
                </div>`;
            break;

        case 'week': {
            // Get current ISO week string yyyy-Www
            const dow = now.getDay() === 0 ? 7 : now.getDay();
            const mon = new Date(now); mon.setDate(now.getDate() - dow + 1);
            const weekStr = _fmtDate(mon).substring(0, 4) + '-W' +
                String(Math.ceil((((mon - new Date(mon.getFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0');
            container.innerHTML = `
                <div>
                    <span class="form-col-label">Chọn tuần</span>
                    <input type="week" id="${prefix}Week" class="kpi-form-date" value="${weekStr}">
                </div>`;
            break;
        }

        case 'month': {
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            container.innerHTML = `
                <div>
                    <span class="form-col-label">Chọn tháng</span>
                    <input type="month" id="${prefix}Month" class="kpi-form-date" value="${monthStr}">
                </div>`;
            break;
        }

        case 'quarter': {
            const q = Math.floor(now.getMonth() / 3) + 1;
            container.innerHTML = `
                <div>
                    <span class="form-col-label">Quý</span>
                    <select id="${prefix}Quarter" class="kpi-form-select">
                        <option value="1" ${q === 1 ? 'selected' : ''}>Q1 (T1–T3)</option>
                        <option value="2" ${q === 2 ? 'selected' : ''}>Q2 (T4–T6)</option>
                        <option value="3" ${q === 3 ? 'selected' : ''}>Q3 (T7–T9)</option>
                        <option value="4" ${q === 4 ? 'selected' : ''}>Q4 (T10–T12)</option>
                    </select>
                </div>
                <div>
                    <span class="form-col-label">Năm</span>
                    <input type="number" id="${prefix}QuarterYear" class="kpi-form-date"
                        style="width:80px;" min="2000" max="2099" value="${now.getFullYear()}">
                </div>`;
            break;
        }

        case 'year':
            container.innerHTML = `
                <div>
                    <span class="form-col-label">Năm</span>
                    <input type="number" id="${prefix}Year" class="kpi-form-date"
                        style="width:90px;" min="2000" max="2099" value="${now.getFullYear()}">
                </div>`;
            break;

        case 'custom':
        default:
            container.innerHTML = `
                <div>
                    <span class="form-col-label">Từ ngày</span>
                    <input type="date" id="${prefix}StartDate" class="kpi-form-date" value="${_fmtDate(new Date(now.getFullYear(), now.getMonth(), 1))}">
                </div>
                <div>
                    <span class="form-col-label">Đến ngày</span>
                    <input type="date" id="${prefix}EndDate" class="kpi-form-date" value="${_fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))}">
                </div>`;
            break;
    }
}

/**
 * Read the current period input values and return {startDate, endDate} (yyyy-mm-dd strings).
 * Returns null if input is missing/invalid.
 */
function _getPeriodDates(prefix, type) {
    const now = new Date();
    try {
        switch (type) {
            case 'day': {
                const v = document.getElementById(prefix + 'Date').value;
                if (!v) return null;
                return { startDate: v, endDate: v };
            }
            case 'week': {
                const v = document.getElementById(prefix + 'Week').value; // yyyy-Www
                if (!v) return null;
                const [yr, ww] = v.split('-W').map(Number);
                // ISO week: Monday of that week
                const jan4 = new Date(yr, 0, 4);
                const startOfW1 = new Date(jan4);
                startOfW1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
                const mon = new Date(startOfW1);
                mon.setDate(startOfW1.getDate() + (ww - 1) * 7);
                const sun = new Date(mon);
                sun.setDate(mon.getDate() + 6);
                return { startDate: _fmtDate(mon), endDate: _fmtDate(sun) };
            }
            case 'month': {
                const v = document.getElementById(prefix + 'Month').value; // yyyy-mm
                if (!v) return null;
                const [yr, mo] = v.split('-').map(Number);
                return {
                    startDate: _fmtDate(new Date(yr, mo - 1, 1)),
                    endDate: _fmtDate(new Date(yr, mo, 0))
                };
            }
            case 'quarter': {
                const q = parseInt(document.getElementById(prefix + 'Quarter').value);
                const yr = parseInt(document.getElementById(prefix + 'QuarterYear').value);
                const startM = (q - 1) * 3;
                return {
                    startDate: _fmtDate(new Date(yr, startM, 1)),
                    endDate: _fmtDate(new Date(yr, startM + 3, 0))
                };
            }
            case 'year': {
                const yr = parseInt(document.getElementById(prefix + 'Year').value);
                if (!yr) return null;
                return {
                    startDate: `${yr}-01-01`,
                    endDate: `${yr}-12-31`
                };
            }
            case 'custom':
            default: {
                const s = document.getElementById(prefix + 'StartDate').value;
                const e = document.getElementById(prefix + 'EndDate').value;
                if (!s || !e) return null;
                return { startDate: s, endDate: e };
            }
        }
    } catch (e) {
        return null;
    }
}

// --- Admin report period handlers ---
function onReportPeriodTypeChange() {
    const type = document.getElementById('kpiReportPeriodType').value;
    _renderPeriodInput('kpiReportDateInputArea', 'adminReport', type);
}

// --- Employee history period handlers ---
function onEmpHistoryPeriodTypeChange() {
    const type = document.getElementById('empHistoryPeriodType').value;
    _renderPeriodInput('empHistoryDateInputArea', 'empHistory', type);
}

// Legacy stubs (kept so old references don't error)
function applyReportPeriodPreset() { onReportPeriodTypeChange(); }
function applyEmpHistoryPreset() { onEmpHistoryPeriodTypeChange(); }

async function adminLoadReports() {
    const dept = document.getElementById('kpiReportDeptFilter').value;
    if (!dept) {
        Swal.fire('Thiếu thông tin', 'Vui lòng chọn phòng ban cần tra cứu.', 'warning');
        return;
    }

    const type = document.getElementById('kpiReportPeriodType').value;
    const dates = _getPeriodDates('adminReport', type);
    if (!dates) {
        Swal.fire('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin thời gian.', 'warning');
        return;
    }
    const { startDate, endDate } = dates;

    const wrap = document.getElementById('kpiReportTableWrap');
    wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải dữ liệu…</p></div>`;

    try {
        // Load template + KPI data + all users of dept (parallel)
        const [tplRes, res, usersRes] = await Promise.all([
            window.api.getKpiTemplate(dept),
            window.api.getKpiReports({ department: dept, startDate, endDate }),
            window.api.getUsers()
        ]);

        _kpiReportConfig = (tplRes.success && tplRes.data) ? (tplRes.data.config || {}) : {};

        if (!res.success) {
            wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Lỗi tải dữ liệu: ${res.error}</p></div>`;
            return;
        }

        // Filter users belonging to this dept — chỉ nhân viên thường, bỏ Lãnh đạo và Admin
        const deptUsers = (usersRes.success && usersRes.data)
            ? usersRes.data.filter(u => {
                if (!u.department) return false;
                if (u.role === 'Admin' || u.role === 'Lãnh đạo') return false;
                const parts = u.department.split(/[,+]/).map(d => d.trim());
                return parts.includes(dept);
            })
            : [];

        _renderReportTable(res.data, _kpiReportConfig, wrap, deptUsers);

    } catch (err) {
        console.error(err);
        wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Đã xảy ra lỗi.</p></div>`;
    }
}

function _renderReportTable(rows, tplConfig, container, deptUsers = []) {
    // Determine KPI columns from template
    let cols = [];
    if (tplConfig && Object.keys(tplConfig).length > 0) {
        cols = Object.keys(tplConfig).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
    } else if (rows && rows.length > 0) {
        const set = new Set();
        rows.forEach(r => { for (let i = 1; i <= 30; i++) { if (r[`kpi_${i}`] != null) set.add(`kpi_${i}`); } });
        cols = Array.from(set).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
    }

    // --- Aggregate: sum KPI values per user (from submitted rows) ---
    const userMap = {};
    (rows || []).forEach(r => {
        const uid = r.user_id || r.username;
        if (!userMap[uid]) {
            userMap[uid] = {
                full_name: r.full_name || r.username,
                department: r.department,
                hasData: true
            };
            cols.forEach(c => { userMap[uid][c] = 0; });
        }
        cols.forEach(c => {
            const v = parseFloat(r[c]);
            if (!isNaN(v)) userMap[uid][c] += v;
        });
    });

    // --- Merge: add dept users who haven't submitted anything ---
    deptUsers.forEach(u => {
        const uid = u.id || u.username;
        if (!userMap[uid]) {
            userMap[uid] = {
                full_name: u.full_name || u.username,
                department: u.department,
                hasData: false
            };
            cols.forEach(c => { userMap[uid][c] = 0; });
        }
    });

    const aggregated = Object.values(userMap);

    if (aggregated.length === 0) {
        container.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-inbox"></i><p>Không có dữ liệu trong khoảng thời gian đã chọn.</p></div>`;
        return;
    }

    let html = `<table class="kpi-report-table"><thead><tr>
        <th>Nhân viên</th>
        <th>Phòng ban</th>
        <th>Trạng thái</th>`;

    cols.forEach(c => {
        const label = (tplConfig && tplConfig[c]) ? tplConfig[c].name : c;
        const unit = (tplConfig && tplConfig[c] && tplConfig[c].unit) ? `<br><small style="opacity:.6;font-size:10px;">(${tplConfig[c].unit})</small>` : '';
        html += `<th class="num">${label}${unit}</th>`;
    });

    html += `</tr></thead><tbody>`;

    // Sort: users with data first, then no-data (alphabetical within each group)
    aggregated.sort((a, b) => {
        if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
        return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
    });

    aggregated.forEach(r => {
        const statusBadge = r.hasData
            ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#ecfdf5;color:#059669;"><i class="fas fa-check-circle"></i> Đã nộp</span>`
            : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fef2f2;color:#dc2626;"><i class="fas fa-clock"></i> Chưa nộp</span>`;

        html += `<tr>
            <td><i class="fas fa-user" style="color:var(--text-muted); margin-right:6px;"></i>${r.full_name}</td>
            <td>${r.department}</td>
            <td>${statusBadge}</td>`;

        cols.forEach(c => {
            const v = r[c];
            const disp = (r.hasData && v != null && v !== 0)
                ? Number(v).toLocaleString('vi-VN')
                : (r.hasData ? '0' : '<span style="color:#d1d5db">—</span>');
            html += `<td class="num">${disp}</td>`;
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ============================================================================
// EMPLOYEE VIEW
// ============================================================================

const _empFmt = d => {
    const tzoff = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzoff).toISOString().split('T')[0];
};

function _initEmployeeView() {
    const view = document.getElementById('kpi-employee-view');
    view.style.display = 'block';

    // Check today's status first
    _empCheckTodayStatus();

    // Init history filters — render default period input
    onEmpHistoryPeriodTypeChange();

    // Load employee template to populate criteria filter
    _empLoadTemplateForFilters();

    // Trigger initial history load
    empLoadHistory();
}

async function _empCheckTodayStatus() {
    const today = _empFmt(new Date());
    try {
        const res = await window.api.getUserKpiReport(_kpiCurrentUser.id, today);
        const badge = document.getElementById('empKpiStatusBadge');
        if (res.success && res.data) {
            badge.className = 'status-badge submitted';
            badge.innerHTML = '<i class="fas fa-circle-check"></i> H\u00f4m nay: \u0110\u00e3 n\u1ed9p';
        } else {
            badge.className = 'status-badge pending';
            badge.innerHTML = '<i class="fas fa-clock"></i> H\u00f4m nay: Ch\u01b0a n\u1ed9p';
        }
    } catch (e) { /* ignore */ }
}

async function _empLoadTemplateForFilters() {
    const user = _kpiCurrentUser;
    if (!user || !user.department || user.department === 'T\u1ea5t c\u1ea3') return;

    try {
        const tplRes = await window.api.getKpiTemplate(user.department);
        if (!tplRes.success || !tplRes.data || !tplRes.data.config) return;

        _kpiEmpTemplate = tplRes.data.config;
        const sel = document.getElementById('empHistoryCriteriaFilter');
        sel.innerHTML = '<option value="all">T\u1ea5t c\u1ea3 ti\u00eau ch\u00ed</option>';

        const keys = Object.keys(_kpiEmpTemplate).sort((a, b) =>
            parseInt(a.split('_')[1]) - parseInt(b.split('_')[1])
        );
        keys.forEach(k => {
            const cfg = _kpiEmpTemplate[k];
            sel.innerHTML += `<option value="${k}">${cfg.name}${cfg.unit ? ' (' + cfg.unit + ')' : ''}</option>`;
        });
    } catch (e) { /* ignore */ }
}

// --- Modal ---

function empOpenInputModal() {
    const overlay = document.getElementById('kpiInputModalOverlay');
    overlay.style.display = 'flex';

    const dept = _kpiCurrentUser.department || '(Ch\u01b0a c\u00f3 ph\u00f2ng ban)';
    document.getElementById('empModalDept').textContent = dept;

    // Default to today
    document.getElementById('empKpiPeriod').value = _empFmt(new Date());

    empModalLoadForm();
}

function empCloseInputModal() {
    document.getElementById('kpiInputModalOverlay').style.display = 'none';
}

async function empModalLoadForm() {
    const user = _kpiCurrentUser;
    if (!user || !user.department || user.department === 'T\u1ea5t c\u1ea3') {
        document.getElementById('empKpiFormArea').innerHTML = `
            <div class="kpi-empty-state">
                <i class="fas fa-info-circle"></i>
                <p>T\u00e0i kho\u1ea3n ch\u01b0a \u0111\u01b0\u1ee3c g\u00e1n ph\u00f2ng ban. Li\u00ean h\u1ec7 Admin.</p>
            </div>`;
        return;
    }

    const period = document.getElementById('empKpiPeriod').value;
    if (!period) return;

    const area = document.getElementById('empKpiFormArea');
    area.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-spinner fa-spin"></i></div>`;

    try {
        // Load template (use cached if available)
        if (!_kpiEmpTemplate || Object.keys(_kpiEmpTemplate).length === 0) {
            const tplRes = await window.api.getKpiTemplate(user.department);
            if (!tplRes.success || !tplRes.data || !tplRes.data.config) {
                area.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-tools"></i><p>Ph\u00f2ng ban ch\u01b0a \u0111\u01b0\u1ee3c c\u1ea5u h\u00ecnh ti\u00eau ch\u00ed KPI.<br>Li\u00ean h\u1ec7 Admin.</p></div>`;
                return;
            }
            _kpiEmpTemplate = tplRes.data.config;
        }

        // Load existing data for this period
        const reportRes = await window.api.getUserKpiReport(user.id, period);
        const existing = (reportRes.success && reportRes.data) ? reportRes.data : null;

        const keys = Object.keys(_kpiEmpTemplate).sort((a, b) =>
            parseInt(a.split('_')[1]) - parseInt(b.split('_')[1])
        );

        let html = `<div class="kpi-field-grid" id="kpiEmpFields">`;
        keys.forEach(k => {
            const cfg = _kpiEmpTemplate[k];
            const rawVal = (existing && existing[k] != null) ? existing[k] : '';
            const displayVal = rawVal !== '' ? _formatNumDisplay(rawVal) : '';
            html += `
            <div class="kpi-field-item">
                <label>${cfg.name}<span class="unit-hint">${cfg.unit ? '(' + cfg.unit + ')' : ''}</span></label>
                <input type="text" inputmode="numeric" class="kpi-num-input" data-kpi-id="${k}" data-raw="${rawVal}" value="${displayVal}" placeholder="Nh\u1eadp s\u1ed1 li\u1ec7u...">
            </div>`;
        });
        html += `</div>`;

        area.innerHTML = html;
        _attachNumFormatListeners();

    } catch (err) {
        area.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>L\u1ed7i khi t\u1ea3i bi\u1ec3u m\u1eabu.</p></div>`;
    }
}

async function empSubmitKpi() {
    const period = document.getElementById('empKpiPeriod').value;
    if (!period) {
        Swal.fire('Ch\u00fa \u00fd', 'Vui l\u00f2ng ch\u1ecdn ng\u00e0y b\u00e1o c\u00e1o.', 'warning');
        return;
    }

    const inputs = document.querySelectorAll('#kpiEmpFields input[data-kpi-id]');
    const kpiData = {};
    inputs.forEach(input => {
        const key = input.getAttribute('data-kpi-id');
        const raw = input.getAttribute('data-raw');
        if (raw !== null && raw !== '') kpiData[key] = parseFloat(raw);
    });

    if (Object.keys(kpiData).length === 0) {
        const conf = await Swal.fire({
            title: 'Bi\u1ec3u m\u1eabu tr\u1ed1ng',
            text: 'B\u1ea1n ch\u01b0a nh\u1eadp b\u1ea5t k\u1ef3 ch\u1ec9 ti\u00eau n\u00e0o. V\u1eabn mu\u1ed1n l\u01b0u?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'V\u1eabn l\u01b0u',
            cancelButtonText: 'Quay l\u1ea1i'
        });
        if (!conf.isConfirmed) return;
    }

    try {
        Swal.fire({ title: '\u0110ang l\u01b0u\u2026', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const res = await window.api.saveUserKpiReport(
            _kpiCurrentUser.id,
            _kpiCurrentUser.department,
            period,
            kpiData
        );

        Swal.close();

        if (res.success) {
            Swal.fire({ icon: 'success', title: '\u0110\u00e3 l\u01b0u!', text: `K\u1ebft qu\u1ea3 KPI ng\u00e0y ${period} \u0111\u00e3 \u0111\u01b0\u1ee3c ghi nh\u1eadn.`, timer: 2000, showConfirmButton: false });

            empCloseInputModal();

            // Refresh today status + history table
            _empCheckTodayStatus();
            empLoadHistory();
        } else {
            Swal.fire('L\u1ed7i', res.error, 'error');
        }
    } catch (err) {
        Swal.close();
        Swal.fire('L\u1ed7i', 'Kh\u00f4ng th\u1ec3 k\u1ebft n\u1ed1i t\u1edbi server.', 'error');
    }
}

// --- History Table ---

// (applyEmpHistoryPreset is defined as legacy stub above, pointing to onEmpHistoryPeriodTypeChange)

async function empLoadHistory() {
    const type = document.getElementById('empHistoryPeriodType') ?
        document.getElementById('empHistoryPeriodType').value : 'month';
    const criteriaKey = document.getElementById('empHistoryCriteriaFilter').value;

    const dates = _getPeriodDates('empHistory', type);
    if (!dates) return; // input not yet rendered or invalid

    const { startDate, endDate } = dates;

    const wrap = document.getElementById('empHistoryTableWrap');
    wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải...</p></div>`;

    try {
        const res = await window.api.getKpiReports({
            userId: _kpiCurrentUser.id,
            startDate,
            endDate
        });

        if (!res.success) {
            wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Lỗi: ${res.error}</p></div>`;
            return;
        }

        _renderEmpHistoryTable(res.data, _kpiEmpTemplate, criteriaKey, wrap);

    } catch (err) {
        wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Lỗi khi tải lịch sử.</p></div>`;
    }
}

function _renderEmpHistoryTable(rows, tplConfig, criteriaKey, container) {
    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-inbox"></i><p>Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u trong kho\u1ea3ng th\u1eddi gian \u0111\u00e3 ch\u1ecdn.</p></div>`;
        return;
    }

    // Determine columns
    let cols = [];
    if (tplConfig && Object.keys(tplConfig).length > 0) {
        cols = Object.keys(tplConfig).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
    } else {
        const set = new Set();
        rows.forEach(r => { for (let i = 1; i <= 30; i++) { if (r[`kpi_${i}`] != null) set.add(`kpi_${i}`); } });
        cols = Array.from(set).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
    }

    // Apply criteria filter: only show the selected column (+ date)
    if (criteriaKey !== 'all') {
        cols = cols.filter(c => c === criteriaKey);
    }

    let html = `<table class="kpi-report-table"><thead><tr>
        <th>Ng\u00e0y</th>`;

    cols.forEach(c => {
        const label = (tplConfig && tplConfig[c]) ? tplConfig[c].name : c;
        const unit = (tplConfig && tplConfig[c] && tplConfig[c].unit) ? `<br><small style="opacity:.6;font-size:10px;">(${tplConfig[c].unit})</small>` : '';
        html += `<th class="num">${label}${unit}</th>`;
    });

    html += `</tr></thead><tbody>`;

    rows.forEach(r => {
        html += `<tr><td style="color:var(--text-muted); font-variant-numeric:tabular-nums;">${r.period}</td>`;
        cols.forEach(c => {
            const v = r[c];
            const disp = (v != null) ? Number(v).toLocaleString('vi-VN') : '<span style="color:#ccc;">\u2014</span>';
            html += `<td class="num">${disp}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ============================================================================
// NUMBER FORMAT HELPERS
// ============================================================================

/**
 * Format a raw number for display using vi-VN locale: 1500000 -> "1.500.000"
 */
function _formatNumDisplay(val) {
    if (val === '' || val === null || val === undefined) return '';
    const num = parseFloat(String(val).replace(/\./g, '').replace(/,/g, '.'));
    if (isNaN(num)) return String(val);
    return num.toLocaleString('vi-VN');
}

/**
 * Attach input/focus/blur events to all .kpi-num-input elements
 * to provide real-time number formatting.
 */
function _attachNumFormatListeners() {
    document.querySelectorAll('.kpi-num-input').forEach(input => {
        // On input: strip formatting, reformat, store raw value
        input.addEventListener('input', function () {
            // Allow digits, one dot or comma for decimal
            let raw = this.value.replace(/[^\d,.]/g, '');
            // Remove all dots (thousand separators), treat comma as decimal
            let numStr = raw.replace(/\./g, '').replace(',', '.');
            const num = parseFloat(numStr);
            if (!isNaN(num)) {
                this.setAttribute('data-raw', num);
                // Format and show with thousands separator
                const caretPos = this.selectionStart;
                const prevLen = this.value.length;
                this.value = num.toLocaleString('vi-VN');
                // Adjust caret: keep offset from end
                const diff = this.value.length - prevLen;
                this.setSelectionRange(caretPos + diff, caretPos + diff);
            } else if (raw === '' || raw === '0') {
                this.setAttribute('data-raw', raw === '' ? '' : '0');
                this.value = raw;
            } else {
                this.setAttribute('data-raw', '');
            }
        });

        // On focus: show raw number for easy editing
        input.addEventListener('focus', function () {
            const raw = this.getAttribute('data-raw');
            if (raw !== null && raw !== '') {
                this.value = raw;
                // Select all for quick re-entry
                this.select();
            }
        });

        // On blur: re-apply display formatting
        input.addEventListener('blur', function () {
            const raw = this.getAttribute('data-raw');
            if (raw !== null && raw !== '') {
                this.value = _formatNumDisplay(raw);
            }
        });
    });
}
