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

        if (user.role === 'Admin' || kpiPerms.includes('config')) {
            // Admin / Leader: show Admin view
            _initAdminView();
        } else {
            // Normal employee: show Employee view
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
function _initEmployeeView() {
    const view = document.getElementById('kpi-employee-view');
    view.style.display = 'block';

    document.getElementById('empKpiDept').textContent = _kpiCurrentUser.department || '(Chưa có phòng ban)';

    // Set today's date
    const now = new Date();
    const fmt = d => {
        const tzoff = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzoff).toISOString().split('T')[0];
    };
    document.getElementById('empKpiPeriod').value = fmt(now);

    empLoadKpiForm();
}

async function empLoadKpiForm() {
    const user = _kpiCurrentUser;
    if (!user || !user.department || user.department === 'Tất cả') {
        document.getElementById('empKpiFormArea').innerHTML = `
            <div class="kpi-empty-state">
                <i class="fas fa-info-circle"></i>
                <p>Tài khoản của bạn chưa được gán vào một phòng ban cụ thể.<br>Vui lòng liên hệ Admin để được phân công.</p>
            </div>`;
        return;
    }

    const period = document.getElementById('empKpiPeriod').value;
    if (!period) return;

    const area = document.getElementById('empKpiFormArea');
    area.innerHTML = `<div class="kpi-empty-state" style="padding:40px 0;"><i class="fas fa-spinner fa-spin"></i></div>`;

    try {
        // Load template for dept
        const tplRes = await window.api.getKpiTemplate(user.department);

        if (!tplRes.success || !tplRes.data || !tplRes.data.config || Object.keys(tplRes.data.config).length === 0) {
            area.innerHTML = `
                <div class="kpi-empty-state">
                    <i class="fas fa-tools"></i>
                    <p>Phòng ban của bạn chưa được cấu hình tiêu chí KPI.<br>Vui lòng liên hệ Admin.</p>
                </div>`;
            return;
        }

        _kpiEmpTemplate = tplRes.data.config;

        // Load existing data if any
        const reportRes = await window.api.getUserKpiReport(user.id, period);
        const existing = (reportRes.success && reportRes.data) ? reportRes.data : null;

        // Update status badge
        const badgeEl = document.getElementById('empKpiStatusBadge');
        if (existing) {
            badgeEl.className = 'status-badge submitted';
            badgeEl.innerHTML = '<i class="fas fa-circle-check"></i> Đã nộp';
        } else {
            badgeEl.className = 'status-badge pending';
            badgeEl.innerHTML = '<i class="fas fa-clock"></i> Chưa nộp';
        }

        // Render fields
        const keys = Object.keys(_kpiEmpTemplate).sort((a, b) =>
            parseInt(a.split('_')[1]) - parseInt(b.split('_')[1])
        );

        let fieldsHtml = `<div class="kpi-field-grid" id="kpiEmpFields">`;
        keys.forEach(k => {
            const cfg = _kpiEmpTemplate[k];
            const val = (existing && existing[k] != null) ? existing[k] : '';
            fieldsHtml += `
            <div class="kpi-field-item">
                <label>${cfg.name}<span class="unit-hint">${cfg.unit ? `(${cfg.unit})` : ''}</span></label>
                <input type="number" data-kpi-id="${k}" value="${val}" step="any" placeholder="Nhập số liệu...">
            </div>`;
        });
        fieldsHtml += `</div>`;

        fieldsHtml += `
        <div style="display:flex; justify-content:flex-end; margin-top:28px; padding-top:20px; border-top:1px solid var(--border);">
            <button class="kpi-btn-primary" style="padding:12px 32px; font-size:15px;" onclick="empSubmitKpi()">
                <i class="fas fa-paper-plane"></i> Gửi kết quả KPI
            </button>
        </div>`;

        area.innerHTML = fieldsHtml;

    } catch (err) {
        console.error('empLoadKpiForm error:', err);
        area.innerHTML = `<div class="kpi-empty-state"><i class="fas fa-exclamation-circle"></i><p>Đã xảy ra lỗi khi tải biểu mẫu.</p></div>`;
    }
}

async function empSubmitKpi() {
    const period = document.getElementById('empKpiPeriod').value;
    if (!period) {
        Swal.fire('Chú ý', 'Vui lòng chọn ngày báo cáo.', 'warning');
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
        const confirm = await Swal.fire({
            title: 'Biểu mẫu trống',
            text: 'Bạn chưa nhập bất kỳ chỉ tiêu nào. Vẫn muốn lưu không?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Vẫn lưu',
            cancelButtonText: 'Quay lại'
        });
        if (!confirm.isConfirmed) return;
    }

    try {
        Swal.fire({ title: 'Đang lưu…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const res = await window.api.saveUserKpiReport(
            _kpiCurrentUser.id,
            _kpiCurrentUser.department,
            period,
            kpiData
        );

        Swal.close();

        if (res.success) {
            Swal.fire({
                icon: 'success',
                title: 'Đã lưu!',
                text: `Kết quả KPI ngày ${period} đã được ghi nhận.`,
                timer: 2000,
                showConfirmButton: false
            });

            // Update status badge
            const badgeEl = document.getElementById('empKpiStatusBadge');
            badgeEl.className = 'status-badge submitted';
            badgeEl.innerHTML = '<i class="fas fa-circle-check"></i> Đã nộp';

        } else {
            Swal.fire('Lỗi', res.error, 'error');
        }

    } catch (err) {
        Swal.close();
        console.error(err);
        Swal.fire('Lỗi', 'Không thể kết nối tới server.', 'error');
    }
}
