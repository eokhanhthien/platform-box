let users = [];

// Initialize Dashboard properly
document.addEventListener("DOMContentLoaded", () => {
    // Load options from config
    const roleSelect = document.getElementById('userRole');
    window.APP_CONFIG.ROLES.forEach(r => roleSelect.add(new Option(r, r)));

    const deptSelect = document.getElementById('userDepartment');
    window.APP_CONFIG.DEPARTMENTS.forEach(d => deptSelect.add(new Option(d, d)));

    // Handle role change to hide/show department
    roleSelect.addEventListener('change', function () {
        const deptGroup = document.getElementById('deptGroup');
        if (this.value === 'Admin') {
            deptGroup.style.display = 'none';
        } else {
            deptGroup.style.display = 'block';
        }
    });

    // Khởi tạo Select2 cho phép THÊM MỚI (tags: true) và Mutilple select (nhiều tag)
    $('#userDepartment').select2({
        tags: true,
        tokenSeparators: [',', '+'],
        placeholder: "Chọn hoặc nhập thêm phòng ban...",
        allowClear: true
    });

    // Initialize User Context
    initDashboardContext();
});

async function initDashboardContext() {
    const currentUser = await window.api.getCurrentUser();
    if (!currentUser) {
        // Chặn nếu chưa đăng nhập
        window.api.navigateToLogin();
        return;
    }

    // Render tên và role ở góc trên phải
    document.querySelector('.user-profile .name').innerText = currentUser.full_name;
    document.querySelector('.user-profile .role').innerText = currentUser.role;

    // Fetch dynamic role permissions from DB
    const permRes = await window.api.getPermissions();
    if (permRes && permRes.success && permRes.data) {
        window.APP_CONFIG.PERMISSIONS = permRes.data;
    } else {
        window.APP_CONFIG.PERMISSIONS = {};
    }

    // Build Sidebar Navigation Động dựa trên Role
    const navMenu = document.querySelector('.nav-menu');
    navMenu.innerHTML = ''; // Clear default items
    const rolePermissions = window.APP_CONFIG.PERMISSIONS[currentUser.role] || {};

    window.APP_CONFIG.NAVIGATION.forEach(item => {
        const modulePerms = rolePermissions[item.id] || [];
        if (modulePerms.includes('view') || currentUser.role === 'Admin') {
            const li = document.createElement('li');
            li.className = 'nav-item';
            // Default select Users if available, or just first item
            if (item.id === 'users') li.classList.add('active');

            li.dataset.moduleId = item.id;
            li.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;

            li.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                li.classList.add('active');
                switchSection(item.id);
            });

            navMenu.appendChild(li);
        }
    });

    // Default to 'users' section on load, or fallback to first visible module
    switchSection('users');

    // Quyền ở Table Users
    const userPerms = rolePermissions['users'] || [];
    if (!userPerms.includes('view') && currentUser.role !== 'Admin') {
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) statsGrid.style.display = 'none';

        document.querySelector('.page-title h1').innerText = `Xin chào, ${currentUser.full_name}`;
        document.querySelector('.page-title p').innerText = "Chào mừng bạn quay trở lại nền tảng làm việc.";
    } else {
        // Nút thêm mới
        const btnNewUser = document.querySelector('.table-header .btn-primary');
        if (btnNewUser) {
            btnNewUser.style.display = (userPerms.includes('create') || currentUser.role === 'Admin') ? 'block' : 'none';
        }

        // Chỉ auto-load users list nếu được view
        loadUsers();
    }
}

// Module View Switcher Function
function switchSection(moduleId) {
    // Hide all sections
    document.querySelectorAll('.module-section').forEach(sec => sec.style.display = 'none');

    // Attempt to show target section
    const target = document.getElementById(`section-${moduleId}`);
    if (target) {
        target.style.display = 'block';
        if (moduleId === 'permissions') {
            renderPermissionsUI();
        }
    } else {
        // Nếu module chưa có màn hình (placeholder)
        const placeholder = document.getElementById('section-placeholder');
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.querySelector('h2').innerText = `Module ${moduleId} đang phát triển...`;
        }
    }
}

// Logout back to Main/Auth Window
async function handleLogout() {
    await window.api.logout();
    window.api.navigateToLogin();
}

async function loadUsers() {
    const res = await window.api.getUsers();
    if (res.success) {
        users = res.data;
        renderTable();
    } else {
        alert('Lỗi khi tải danh sách: ' + res.error);
    }
}

function getRoleBadgeColor(role) {
    if (role === 'Admin') return 'badge-admin';
    if (role === 'Lãnh đạo') return 'badge-leader';
    return 'badge-staff';
}

function renderTable() {
    const tbody = document.querySelector("#dataTable tbody");
    tbody.innerHTML = "";

    // Update total users stat card
    document.getElementById('stat-total-users').innerText = users.length.toLocaleString();

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #9ca3af; padding: 32px;">No active users found</td></tr>`;
        return;
    }

    users.forEach((u) => {
        // Create initials for avatar
        const initials = u.full_name ? u.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

        let statusBadgeClass = 'status-success';
        if (u.role === 'Admin') statusBadgeClass = 'status-alert';
        if (u.role === 'Lãnh đạo') statusBadgeClass = 'status-pending';

        // Lookup current user permissions from config
        const currentUserRole = document.querySelector('.user-profile .role').innerText;
        const userPerms = window.APP_CONFIG.PERMISSIONS[currentUserRole] || {};
        const canUpdate = (userPerms['users'] || []).includes('update');
        const canDelete = (userPerms['users'] || []).includes('delete') && u.username !== 'admin';

        let actionsHTML = '';
        if (canUpdate) {
            actionsHTML += `<button class="actions-btn" onclick="editUser(${u.id})" title="Edit User"><i class="fas fa-pen"></i></button>`;
        }
        if (canDelete) {
            actionsHTML += `${u.username !== 'admin' ? `<button class="actions-btn" onclick="deleteUser(${u.id})" title="Delete User"><i class="fas fa-trash-alt" style="color:#ef4444;"></i></button>` : ''}`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="avatar">${initials}</div>
                    <div>
                        <span class="user-name">${u.full_name}</span>
                        <span class="user-sub">@${u.username}</span>
                    </div>
                </div>
            </td>
            <td>
                <span style="font-weight:500; color:var(--text-main);">${u.role}</span>
            </td>
            <td>
                <span style="color:var(--text-muted);">${u.department || 'N/A'}</span>
            </td>
            <td>
                <span class="status-badge ${statusBadgeClass}">${u.role === 'Admin' ? 'Admin' : (u.role === 'Lãnh đạo' ? 'Manager' : 'User')}</span>
            </td>
            <td style="text-align: center;">
                ${actionsHTML}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModal() {
    resetForm();
    document.getElementById('modalTitle').innerText = 'New User';
    document.getElementById('pwdHint').style.display = 'none';
    document.getElementById('userModal').classList.add('active');
    setTimeout(() => document.getElementById('userUsername').focus(), 100);
}

function closeModal() {
    document.getElementById('userModal').classList.remove('active');
}

function resetForm() {
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userFullName').value = '';
    document.getElementById('userRole').value = window.APP_CONFIG.ROLES[0] || 'Nhân viên';
    document.getElementById('editUserId').value = '';

    document.getElementById('userRole').dispatchEvent(new Event('change'));

    // Đặt về trạng thái rỗng
    $('#userDepartment').val(null).trigger('change');
}

function editUser(id) {
    const u = users.find(x => x.id === id);
    if (u) {
        resetForm();
        document.getElementById('modalTitle').innerText = 'Edit User';
        document.getElementById('pwdHint').style.display = 'inline';

        document.getElementById('userUsername').value = u.username;
        document.getElementById('userFullName').value = u.full_name;
        document.getElementById('userRole').value = u.role;
        document.getElementById('editUserId').value = u.id;

        let userDepts = [];
        if (u.department) {
            userDepts = u.department.split(/[,+]/).map(d => d.trim()).filter(d => d);
        }

        const selectEl = $('#userDepartment');
        userDepts.forEach(dept => {
            if (selectEl.find("option[value='" + dept + "']").length === 0) {
                selectEl.append(new Option(dept, dept, true, true));
            }
        });

        selectEl.val(userDepts).trigger('change');

        document.getElementById('userRole').dispatchEvent(new Event('change'));

        document.getElementById('userModal').classList.add('active');
    }
}

async function saveUser() {
    const username = document.getElementById('userUsername').value.trim();
    let password = document.getElementById('userPassword').value.trim();
    const full_name = document.getElementById('userFullName').value.trim();
    const role = document.getElementById('userRole').value;
    const id = document.getElementById('editUserId').value;

    let department = '';
    if (role !== 'Admin') {
        const deptsArray = $('#userDepartment').val() || [];
        department = deptsArray.join(' + ');
    }

    if (!username || !full_name || (role !== 'Admin' && (!department || department === ''))) {
        alert("Vui lòng nhập đầy đủ các thông tin bắt buộc (*)");
        return;
    }

    if (!id && !password) {
        alert("Thêm mới nhân viên bắt buộc phải có mật khẩu!");
        return;
    }

    if (id && !password) {
        alert("Vui lòng nhập mật khẩu mới hoặc nhập lại mật khẩu cũ để lưu thay đổi.");
        return;
    }

    if (id) {
        const res = await window.api.updateUser(id, { username, password, full_name, role, department });
        if (res.success) {
            closeModal();
            loadUsers();
        } else {
            alert("Lỗi khi cập nhật: " + res.error);
        }
    } else {
        const res = await window.api.addUser({ username, password, full_name, role, department });
        if (res.success) {
            closeModal();
            loadUsers();
        } else {
            alert("Lỗi khi thêm: " + res.error);
        }
    }
}

async function deleteUser(id) {
    if (confirm("Thao tác này không thể hoàn tác. Bạn có chắc muốn xóa người dùng này?")) {
        const res = await window.api.deleteUser(id);
        if (res.success) {
            loadUsers();
        } else {
            alert("Lỗi khi xóa: " + res.error);
        }
    }
}

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
