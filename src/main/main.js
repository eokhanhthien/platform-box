const { app, BrowserWindow } = require('electron');
const path = require('path');
const { initDB } = require('../models/database');
const { initSystemController } = require('../controllers/systemController');
const { initTodoController } = require('../controllers/todoController');
const { initNoteController } = require('../controllers/noteController');

// App identity
app.setName('SkyAdmin');
app.setAppUserModelId('com.skyadmin.app');

let mainWindow;
const iconPath = path.join(__dirname, '../images/icon.png');

// Set Dock icon for macOS (especially needed during dev mode)
if (process.platform === 'darwin') {
    app.dock.setIcon(iconPath);
}

async function bootstrap() {
    try {
        // 1. Initialize SQLite first
        await initDB();

        // 2. Initialize Controllers (IPC Event Listeners)
        initSystemController();
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
        title: 'SkyAdmin',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false // Don't show until ready-to-show
    });

    // Load dashboard directly (no login needed for personal use)
    mainWindow.loadFile(path.join(__dirname, '../views/admin/dashboard.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
