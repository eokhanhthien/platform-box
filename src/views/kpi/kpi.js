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
    reportDeptSelect.innerHTML = '<option value="Tất cả">Tất cả phòng ban</option>';
    depts.forEach(d => {
        reportDeptSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });

    // Apply default date range (this month)
    applyReportPeriodPreset();
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

function applyReportPeriodPreset() {
    const preset = document.getElementById('kpiReportPeriodPreset').value;
    const startEl = document.getElementById('kpiReportStartDate');
    const endEl = document.getElementById('kpiReportEndDate');

    if (preset === 'custom') {
        startEl.disabled = false;
        endEl.disabled = false;
        return;
    }

    startEl.disabled = true;
    endEl.disabled = true;

    const now = new Date();
    const fmt = d => {
        const tzoff = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzoff).toISOString().split('T')[0];
    };

    if (preset === 'today') {
        startEl.value = fmt(now);
        endEl.value = fmt(now);
    } else if (preset === 'this_week') {
        const dow = now.getDay() === 0 ? 7 : now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - dow + 1);
        const sun = new Date(now); sun.setDate(now.getDate() - dow + 7);
        startEl.value = fmt(mon);
        endEl.value = fmt(sun);
    } else if (preset === 'this_month') {
        startEl.value = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
        endEl.value = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
}

async function adminLoadReports() {
    const dept = document.getElementById('kpiReportDeptFilter').value;
    const startDate = document.getElementById('kpiReportStartDate').value;
    const endDate = document.getElementById('kpiReportEndDate').value;

    if (!startDate || !endDate) {
        Swal.fire('Thiếu thông tin', 'Vui lòng chọn khoảng thời gian cần tra cứu.', 'warning');
        return;
    }

    const wrap = document.getElementById('kpiReportTableWrap');
    wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải dữ liệu…</p></div>`;

    try {
        // Load department template for column headers
        if (dept !== 'Tất cả') {
            const tplRes = await window.api.getKpiTemplate(dept);
            _kpiReportConfig = (tplRes.success && tplRes.data) ? (tplRes.data.config || {}) : {};
        } else {
            _kpiReportConfig = {};
        }

        const res = await window.api.getKpiReports({ department: dept, startDate, endDate });

        if (!res.success) {
            wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Lỗi tải dữ liệu: ${res.error}</p></div>`;
            return;
        }

        _renderReportTable(res.data, _kpiReportConfig, wrap);

    } catch (err) {
        console.error(err);
        wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Đã xảy ra lỗi.</p></div>`;
    }
}

function _renderReportTable(rows, tplConfig, container) {
    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-inbox"></i><p>Không có dữ liệu trong khoảng thời gian đã chọn.</p></div>`;
        return;
    }

    // Determine KPI columns
    let cols = [];
    if (tplConfig && Object.keys(tplConfig).length > 0) {
        cols = Object.keys(tplConfig).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
    } else {
        const set = new Set();
        rows.forEach(r => { for (let i = 1; i <= 30; i++) { if (r[`kpi_${i}`] != null) set.add(`kpi_${i}`); } });
        cols = Array.from(set).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
    }

    let html = `<table class="kpi-report-table"><thead><tr>
        <th>Nhân viên</th>
        <th>Phòng ban</th>
        <th>Ngày</th>`;

    cols.forEach(c => {
        const label = (tplConfig && tplConfig[c]) ? tplConfig[c].name : c;
        const unit = (tplConfig && tplConfig[c] && tplConfig[c].unit) ? `<br><small style="opacity:.6;font-size:10px;">(${tplConfig[c].unit})</small>` : '';
        html += `<th class="num">${label}${unit}</th>`;
    });

    html += `</tr></thead><tbody>`;

    rows.forEach(r => {
        html += `<tr>
            <td><i class="fas fa-user" style="color:var(--text-muted); margin-right:6px;"></i>${r.full_name || r.username}</td>
            <td>${r.department}</td>
            <td style="color:var(--text-muted);">${r.period}</td>`;

        cols.forEach(c => {
            const v = r[c];
            const disp = (v != null) ? Number(v).toLocaleString('vi-VN') : '<span style="color:#ccc;">—</span>';
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

    // Init history filters
    applyEmpHistoryPreset();

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
            const val = (existing && existing[k] != null) ? existing[k] : '';
            html += `
            <div class="kpi-field-item">
                <label>${cfg.name}<span class="unit-hint">${cfg.unit ? '(' + cfg.unit + ')' : ''}</span></label>
                <input type="number" data-kpi-id="${k}" value="${val}" step="any" placeholder="Nh\u1eadp s\u1ed1 li\u1ec7u...">
            </div>`;
        });
        html += `</div>`;

        area.innerHTML = html;

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
        const val = input.value.trim();
        if (val !== '') kpiData[key] = parseFloat(val);
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

function applyEmpHistoryPreset() {
    const preset = document.getElementById('empHistoryPreset').value;
    const startEl = document.getElementById('empHistoryStartDate');
    const endEl = document.getElementById('empHistoryEndDate');

    if (preset === 'custom') {
        startEl.disabled = false;
        endEl.disabled = false;
        return;
    }
    startEl.disabled = true;
    endEl.disabled = true;

    const now = new Date();
    if (preset === 'this_week') {
        const dow = now.getDay() === 0 ? 7 : now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - dow + 1);
        const sun = new Date(now); sun.setDate(now.getDate() - dow + 7);
        startEl.value = _empFmt(mon);
        endEl.value = _empFmt(sun);
    } else if (preset === 'this_month') {
        startEl.value = _empFmt(new Date(now.getFullYear(), now.getMonth(), 1));
        endEl.value = _empFmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
}

async function empLoadHistory() {
    const startDate = document.getElementById('empHistoryStartDate').value;
    const endDate = document.getElementById('empHistoryEndDate').value;
    const criteriaKey = document.getElementById('empHistoryCriteriaFilter').value;

    if (!startDate || !endDate) {
        // If dates not set yet, auto-apply preset
        applyEmpHistoryPreset();
        // Re-read after apply
        const s2 = document.getElementById('empHistoryStartDate').value;
        const e2 = document.getElementById('empHistoryEndDate').value;
        if (!s2 || !e2) return;
    }

    const wrap = document.getElementById('empHistoryTableWrap');
    wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-spinner fa-spin"></i><p>\u0110ang t\u1ea3i...</p></div>`;

    try {
        const sd = document.getElementById('empHistoryStartDate').value;
        const ed = document.getElementById('empHistoryEndDate').value;

        const res = await window.api.getKpiReports({
            userId: _kpiCurrentUser.id,
            startDate: sd,
            endDate: ed
        });

        if (!res.success) {
            wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>L\u1ed7i: ${res.error}</p></div>`;
            return;
        }

        _renderEmpHistoryTable(res.data, _kpiEmpTemplate, criteriaKey, wrap);

    } catch (err) {
        wrap.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>L\u1ed7i khi t\u1ea3i l\u1ecbch s\u1eed.</p></div>`;
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
