/**
 * dashboard-sidebar.js
 * Quản lý logic ẩn/hiện sidebar (Sidebar Toggle).
 * File này được tách riêng theo chuẩn RULES.md (không inline script trong HTML).
 */

(function () {
    const SIDEBAR_WIDTH = 250; // px — khớp với --sidebar-width trong CSS

    const sidebar = document.getElementById('mainSidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    const edgeHotspot = document.getElementById('sidebarEdgeHotspot');

    if (!sidebar || !toggleBtn || !toggleIcon || !edgeHotspot) return;

    let isCollapsed = false;
    let hoverTimer = null;

    /** Ẩn sidebar sang trái */
    function collapseSidebar() {
        isCollapsed = true;
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
        toggleIcon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        toggleBtn.style.left = '0px';
    }

    /** Kéo sidebar ra */
    function expandSidebar() {
        isCollapsed = false;
        sidebar.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
        toggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-left');
        toggleBtn.style.left = (SIDEBAR_WIDTH - 14) + 'px';
    }

    // Click nút toggle
    toggleBtn.addEventListener('click', function () {
        if (isCollapsed) {
            expandSidebar();
        } else {
            collapseSidebar();
        }
    });

    // Hover vào mép trái màn hình → kéo sidebar ra sau 180ms
    edgeHotspot.addEventListener('mouseenter', function () {
        if (!isCollapsed) return;
        hoverTimer = setTimeout(expandSidebar, 180);
    });

    edgeHotspot.addEventListener('mouseleave', function () {
        clearTimeout(hoverTimer);
    });
})();
