// src/views/system_config/system_config.js

let _configData = {};

async function initSystemConfigModule() {
    await fetchAndRenderConfig();
}

async function fetchAndRenderConfig() {
    const res = await window.api.getConfig();
    if (res.success) {
        _configData = res.data;
        renderConfigList('ROLES');
        renderConfigList('DEPARTMENTS');
    } else {
        Swal.fire('Lỗi', 'Không thể tải cấu hình: ' + res.error, 'error');
    }
}

function renderConfigList(key) {
    const container = document.getElementById(`list-${key}`);
    if (!container) return;

    container.innerHTML = '';
    const items = _configData[key] || [];

    if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 12px; color: var(--text-muted); font-size: 13px;">Chưa có dữ liệu</div>`;
        return;
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'config-item-row';
        div.innerHTML = `
            <span class="config-item-name">${item}</span>
            <div style="display:flex; gap: 8px;">
                <button class="actions-btn" onclick="editConfigItem('${key}', ${index}, '${item}')" title="Sửa"><i class="fas fa-pen"></i></button>
                <button class="actions-btn" onclick="deleteConfigItem('${key}', ${index}, '${item}')" title="Xóa"><i class="fas fa-trash-alt" style="color:#ef4444;"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

function addConfigItem(key, titleMsg) {
    Swal.fire({
        title: titleMsg,
        input: 'text',
        inputPlaceholder: 'Nhập giá trị mới...',
        showCancelButton: true,
        confirmButtonText: 'Lưu',
        cancelButtonText: 'Hủy',
        inputValidator: (value) => {
            if (!value) {
                return 'Giá trị không được để trống!';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const val = result.value.trim();
            if (!_configData[key]) _configData[key] = [];
            _configData[key].push(val);
            saveConfigToServer(key);
        }
    });
}

function editConfigItem(key, index, oldVal) {
    Swal.fire({
        title: 'Sửa giá trị',
        input: 'text',
        inputValue: oldVal,
        showCancelButton: true,
        confirmButtonText: 'Cập nhật',
        cancelButtonText: 'Hủy',
        inputValidator: (value) => {
            if (!value) {
                return 'Giá trị không được để trống!';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            _configData[key][index] = result.value.trim();
            saveConfigToServer(key);
        }
    });
}

function deleteConfigItem(key, index, val) {
    Swal.fire({
        title: 'Bạn có chắc chắn?',
        text: `Xóa "${val}" khỏi danh sách?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    }).then((result) => {
        if (result.isConfirmed) {
            _configData[key].splice(index, 1);
            saveConfigToServer(key);
        }
    });
}

async function saveConfigToServer(key) {
    const res = await window.api.saveConfig(key, _configData[key]);
    if (res.success) {
        // Cập nhật lại biến global tạm thời để không cần F5
        if (window.APP_CONFIG) {
            window.APP_CONFIG[key] = _configData[key];
        }
        renderConfigList(key);
    } else {
        Swal.fire('Lỗi', 'Không thể lưu: ' + res.error, 'error');
        fetchAndRenderConfig(); // reload to revert
    }
}
