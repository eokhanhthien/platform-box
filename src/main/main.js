const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDB } = require('../models/database');
const { initUserController } = require('../controllers/userController');

let mainWindow;

async function bootstrap() {
    try {
        // 1. Initialize SQLite first
        await initDB();

        // 2. Initialize Controllers (IPC Event Listeners)
        initUserController();

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
