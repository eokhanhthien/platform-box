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
    // Ma trận phân quyền: Role -> Module -> [Actions]
    PERMISSIONS: {
        'Admin': {
            dashboard: ['view'],
            users: ['view', 'create', 'update', 'delete'],
            reports: ['view', 'export'],
            game: ['view']
        },
        'Lãnh đạo': {
            dashboard: ['view'],
            users: ['view'], // Chỉ được xem danh sách Users, không được sửa/xóa
            reports: ['view']
        },
        'Nhân viên': {
            dashboard: ['view']
            // Nhấn viên mặc định không có quyền vào module Users hay Reports
        }
    },
    // Khai báo các Module hợp lệ để tự động quét vẽ lên Navbar
    NAVIGATION: [
        { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-border-all', url: '#' },
        { id: 'users', label: 'Quản lý Users', icon: 'fas fa-users', url: '#' },
        { id: 'reports', label: 'Báo cáo', icon: 'fas fa-chart-line', url: '#' }
    ]
};
