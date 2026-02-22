// ---------------- PERMISSIONS UI LOGIC ---------------- //
async function renderPermissionsUI() {
    const roleSelect = document.getElementById('permRoleSelect');
    roleSelect.innerHTML = '';

    // Populate Roles (exclude Admin from being editable if you want, but for UI sake we list all)
    window.APP_CONFIG.ROLES.forEach(r => {
        if (r !== 'Admin') { // Admin luôn có full quyền ngầm định
            roleSelect.appendChild(new Option(r, r));
        }
    });

    roleSelect.onchange = buildPermissionsTable;
    buildPermissionsTable();
}

function buildPermissionsTable() {
    const tbody = document.querySelector('#permissionsTable tbody');
    tbody.innerHTML = '';

    const selectedRole = document.getElementById('permRoleSelect').value;
    const currentPerms = window.APP_CONFIG.PERMISSIONS[selectedRole] || {};

    const availableActions = ['view', 'create', 'update', 'delete', 'export'];

    window.APP_CONFIG.NAVIGATION.forEach(module => {
        // Skip permissions module itself maybe?
        if (module.id === 'permissions') return;

        const roleModuleActions = currentPerms[module.id] || [];

        const tr = document.createElement('tr');
        let html = `<td><strong>${module.label}</strong> <br><small style="color:#9ca3af;">${module.id}</small></td>`;

        availableActions.forEach(action => {
            const isChecked = roleModuleActions.includes(action) ? 'checked' : '';
            html += `
                <td style="text-align: center;">
                    <input type="checkbox" class="perm-cb" data-module="${module.id}" data-action="${action}" ${isChecked} style="width:16px; height:16px; cursor:pointer;">
                </td>
            `;
        });

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

async function savePermissions() {
    const selectedRole = document.getElementById('permRoleSelect').value;
    const checkboxes = document.querySelectorAll('.perm-cb');

    const newPerms = {};
    checkboxes.forEach(cb => {
        if (cb.checked) {
            const mod = cb.dataset.module;
            const act = cb.dataset.action;
            if (!newPerms[mod]) newPerms[mod] = [];
            newPerms[mod].push(act);
        }
    });

    const res = await window.api.updatePermissions(selectedRole, newPerms);
    if (res.success) {
        // Cập nhật state nội bộ
        window.APP_CONFIG.PERMISSIONS[selectedRole] = newPerms;
        alert(`Đã lưu phân quyền thành công cho chức vụ: ${selectedRole}!`);
    } else {
        alert('Lỗi lưu quyền: ' + res.error);
    }
}
