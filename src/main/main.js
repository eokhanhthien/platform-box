const { app, BrowserWindow } = require('electron');
const path = require('path');
const { initDB } = require('../models/database');
const { initSystemController } = require('../controllers/systemController');
const { initTodoController } = require('../controllers/todoController');
const { initNoteController } = require('../controllers/noteController');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // App identity
    app.setName('Noteflow');
    app.setAppUserModelId('com.noteflow.app');

    let mainWindow;
    const iconPath = path.join(__dirname, '../assets/icons/icon.png');

    // Set Dock icon for macOS (especially needed during dev mode)
    if (process.platform === 'darwin') {
        app.dock.setIcon(iconPath);
    }

    async function bootstrap() {
        try {
            // 1. Create the Main Window first for immediate feedback
            createWindow();

            // 2. Initialize SQLite & Controllers in background
            await initDB();
            initSystemController();
            initTodoController();
            initNoteController();
        } catch (error) {
            console.error('Failed to bootstrap application:', error);
            app.quit();
        }
    }

    function createWindow() {
        // Prevent multiple window creation if bootstrap is re-run (e.g. activate event)
        if (mainWindow) return;

        mainWindow = new BrowserWindow({
            width: 1000,
            height: 700,
            title: 'Noteflow', // Matches app name
            icon: iconPath,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                zoomFactor: 0.8
            },
            show: false
        });

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
}
