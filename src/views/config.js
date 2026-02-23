window.APP_CONFIG = {
    ROLES: [
        'Nhân viên',
        'Lãnh đạo',
        'Admin'
    ],
    DEPARTMENTS: [
        'Ban GĐ',
        'Phòng DN Lớn',
        'Phòng DN VVN',
        'Phòng Bán lẻ',
        'Phòng DVKH'
    ],
    // PERMISSIONS: Object này đã được dời sang quản lý động bằng Database!

    // Khai báo các Module hợp lệ để tự động quét vẽ lên Navbar
    NAVIGATION: [
        { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-border-all', url: '#' },
        { id: 'users', label: 'Quản lý Users', icon: 'fas fa-users', url: '#' },
        { id: 'permissions', label: 'Phân quyền', icon: 'fas fa-user-shield', url: '#' },
        { id: 'kpi', label: 'Quản lý KPI', icon: 'fas fa-chart-line', url: '#' }
    ]
};
