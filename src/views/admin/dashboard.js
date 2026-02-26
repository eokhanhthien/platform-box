

// Initialize Dashboard properly
document.addEventListener("DOMContentLoaded", () => {
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

    // Lưu context user toàn cục để các module con sử dụng (todo.js, kpi.js...)
    window._currentUser = currentUser;
    window._currentUserPermissions = window.APP_CONFIG.PERMISSIONS[currentUser.role] || {};

    // Build Sidebar Navigation Động dựa trên Role
    const navMenu = document.querySelector('.nav-menu');
    navMenu.innerHTML = ''; // Clear default items
    const rolePermissions = window.APP_CONFIG.PERMISSIONS[currentUser.role] || {};

    let firstVisibleModule = null;

    window.APP_CONFIG.NAVIGATION.forEach(item => {
        const modulePerms = rolePermissions[item.id] || [];
        if (modulePerms.includes('view') || currentUser.role === 'Admin') {
            if (!firstVisibleModule) firstVisibleModule = item.id;

            const li = document.createElement('li');
            li.className = 'nav-item';

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

    // Default to 'dashboard' section on load, or fallback to first visible module
    const initialModule = firstVisibleModule || 'dashboard';
    const initialNav = document.querySelector(`.nav-item[data-module-id="${initialModule}"]`);
    if (initialNav) initialNav.classList.add('active');

    switchSection(initialModule);
}

// Module View Switcher Function
async function switchSection(moduleId) {
    // Hide all sections
    document.querySelectorAll('.module-section').forEach(sec => sec.style.display = 'none');

    // Attempt to show target section
    const target = document.getElementById(`section-${moduleId}`);
    if (target) {
        target.style.display = 'block';

        // Check if content is loaded (lazy loading)
        // If the target is just an empty div or placeholder, fetch the HTML
        if (target.innerHTML.trim() === '') {
            try {
                const res = await window.api.loadTemplate(moduleId);
                if (res.success) {
                    target.innerHTML = res.html;
                } else {
                    target.innerHTML = `<div style="text-align: center; padding: 64px 0;"><h2 style="color: var(--text-muted);"><i class="fas fa-exclamation-triangle"></i> Lỗi tải giao diện: ${res.error}</h2></div>`;
                }
            } catch (err) {
                target.innerHTML = `<div style="text-align: center; padding: 64px 0;"><h2 style="color: var(--text-muted);"><i class="fas fa-exclamation-triangle"></i> Module ${moduleId} chưa sẵn sàng...</h2></div>`;
            }
        }

        // Trigger module-specific initializers
        if (moduleId === 'dashboard' && typeof renderDashboardStats === 'function') {
            renderDashboardStats();
        } else if (moduleId === 'users' && typeof loadUsers === 'function') {
            // Nút thêm mới theo quyền (kiểm tra lại quyền tại đây khi switch vào)
            const currentUserRole = document.querySelector('.user-profile .role').innerText;
            const userPerms = window.APP_CONFIG.PERMISSIONS[currentUserRole] || {};
            const userModulePerms = userPerms['users'] || [];

            const btnNewUser = document.querySelector('.table-header .btn-primary');
            if (btnNewUser) {
                btnNewUser.style.display = (userModulePerms.includes('create') || currentUserRole === 'Admin') ? 'block' : 'none';
            }

            loadUsers();
        } else if (moduleId === 'permissions' && typeof renderPermissionsUI === 'function') {
            renderPermissionsUI();
        } else if (moduleId === 'kpi' && typeof initKpiModule === 'function') {
            initKpiModule();
        } else if (moduleId === 'todo' && typeof initTodoModule === 'function') {
            await initTodoModule();
        } else if (moduleId === 'notes' && typeof initNotesModule === 'function') {
            await initNotesModule(window._currentUser);
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
