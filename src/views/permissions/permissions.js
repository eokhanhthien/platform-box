// src/views/permissions/permissions.js
// Simplified permissions UI: one toggle per module per role (ON = full access, OFF = no access)

// Full set of actions granted when a module is toggled ON
const FULL_PERMISSIONS = ['view', 'create', 'update', 'delete', 'export', 'config'];

let _permSelectedRole = null;

async function renderPermissionsUI() {
    const roles = window.APP_CONFIG.ROLES.filter(r => r !== 'Admin'); // Admin always has full access

    const bar = document.getElementById('permRoleBar');
    bar.innerHTML = '';

    roles.forEach((role, i) => {
        const btn = document.createElement('button');
        btn.className = 'perm-role-tab' + (i === 0 ? ' active' : '');
        btn.textContent = role;
        btn.onclick = () => {
            document.querySelectorAll('.perm-role-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _permSelectedRole = role;
            buildPermissionCards(role);
        };
        bar.appendChild(btn);
    });

    _permSelectedRole = roles[0];
    buildPermissionCards(_permSelectedRole);
}

function buildPermissionCards(role) {
    const grid = document.getElementById('permModuleGrid');
    grid.innerHTML = '';

    const currentPerms = window.APP_CONFIG.PERMISSIONS[role] || {};

    window.APP_CONFIG.NAVIGATION.forEach(module => {
        // Don't allow self-editing the permissions module
        if (module.id === 'permissions') return;

        const roleModulePerms = currentPerms[module.id] || [];
        const isOn = roleModulePerms.length > 0;

        const card = document.createElement('div');
        card.className = 'perm-module-card' + (isOn ? ' is-on' : '');
        card.id = `perm-card-${module.id}`;

        card.innerHTML = `
            <div class="perm-module-info">
                <div class="perm-module-icon">
                    <i class="${module.icon}"></i>
                </div>
                <div>
                    <div class="perm-module-label">${module.label}</div>
                    <div class="perm-module-sub">${isOn ? 'Có quyền truy cập' : 'Chưa có quyền'}</div>
                </div>
            </div>
            <label class="perm-toggle" title="Bật/Tắt quyền truy cập">
                <input
                    type="checkbox"
                    class="perm-module-toggle"
                    data-module="${module.id}"
                    ${isOn ? 'checked' : ''}
                    onchange="onPermToggleChange('${module.id}', this)"
                >
                <span class="perm-toggle-slider"></span>
            </label>
        `;

        grid.appendChild(card);
    });
}

function onPermToggleChange(moduleId, checkbox) {
    const card = document.getElementById(`perm-card-${moduleId}`);
    const subtitle = card.querySelector('.perm-module-sub');

    if (checkbox.checked) {
        card.classList.add('is-on');
        subtitle.textContent = 'Có quyền truy cập';
    } else {
        card.classList.remove('is-on');
        subtitle.textContent = 'Chưa có quyền';
    }
}

async function savePermissions() {
    const role = _permSelectedRole;
    if (!role) return;

    const toggles = document.querySelectorAll('.perm-module-toggle');
    const newPerms = {};

    toggles.forEach(toggle => {
        const moduleId = toggle.dataset.module;
        newPerms[moduleId] = toggle.checked ? [...FULL_PERMISSIONS] : [];
    });

    const res = await window.api.updatePermissions(role, newPerms);

    if (res.success) {
        window.APP_CONFIG.PERMISSIONS[role] = newPerms;
        Swal.fire({
            icon: 'success',
            title: 'Đã lưu!',
            text: `Phân quyền cho vai trò "${role}" đã được cập nhật.`,
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        Swal.fire('Lỗi', 'Không thể lưu phân quyền: ' + res.error, 'error');
    }
}
