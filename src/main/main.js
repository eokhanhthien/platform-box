const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDB } = require('../models/database');
const { initUserController } = require('../controllers/userController');
const { initPermissionController } = require('../controllers/permissionController');
const { initSystemController } = require('../controllers/systemController');
const { initKpiController } = require('../controllers/kpiController');
const { initTodoController } = require('../controllers/todoController');
const { initNoteController } = require('../controllers/noteController');

// REQUIRED for Windows 10/11 Toast Notifications to work in Electron
app.setAppUserModelId('com.skyAdmin.platformBox');

let mainWindow;

async function bootstrap() {
    try {
        // 1. Initialize SQLite first
        await initDB();

        // 2. Initialize Controllers (IPC Event Listeners)
        initUserController();
        initPermissionController();
        initSystemController();
        initKpiController();
        initTodoController();
        initNoteController();

        // 3. Create the Main Window
        createWindow();
    } catch (error) {
        console.error('Failed to bootstrap application:', error);
        app.quit();
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false // Don't show until ready-to-show
    });

    // Tải màn hình Login làm mặc định
    mainWindow.loadFile(path.join(__dirname, '../views/auth/login.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });
}

// Lắng nghe sự kiện ipc báo đăng nhập thành công từ renderer để đổi View
ipcMain.on('navigate-to-dashboard', () => {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, '../views/admin/dashboard.html'));
    }
});

ipcMain.on('navigate-to-login', () => {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, '../views/auth/login.html'));
    }
});

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
