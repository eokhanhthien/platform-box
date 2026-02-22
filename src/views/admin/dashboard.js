let users = [];

// Initialize Dashboard properly
document.addEventListener("DOMContentLoaded", () => {
    // Khởi tạo Select2 cho phép THÊM MỚI (tags: true) và Mutilple select (nhiều tag)
    $('#userDepartment').select2({
        tags: true,
        tokenSeparators: [',', '+'],
        placeholder: "Chọn hoặc nhập thêm phòng ban...",
        allowClear: true
    });

    // Auto-load users list
    loadUsers();
});

// Logout back to Main/Auth Window
function handleLogout() {
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
                <button class="actions-btn" onclick="editUser(${u.id})" title="Edit User">
                    <i class="fas fa-pen"></i>
                </button>
                ${u.username !== 'admin' ? `
                <button class="actions-btn" onclick="deleteUser(${u.id})" title="Delete User">
                    <i class="fas fa-trash-alt" style="color:#ef4444;"></i>
                </button>` : ''}
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
    document.getElementById('userRole').value = 'Nhân viên';
    document.getElementById('editUserId').value = '';

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

        document.getElementById('userModal').classList.add('active');
    }
}

async function saveUser() {
    const username = document.getElementById('userUsername').value.trim();
    let password = document.getElementById('userPassword').value.trim();
    const full_name = document.getElementById('userFullName').value.trim();
    const role = document.getElementById('userRole').value;
    const id = document.getElementById('editUserId').value;

    const deptsArray = $('#userDepartment').val() || [];
    const department = deptsArray.join(' + ');

    if (!username || !full_name || !department) {
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
