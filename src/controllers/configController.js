const { ipcMain } = require('electron');
const { getConfig, saveConfig } = require('../models/configModel');

function initConfigController() {
    ipcMain.handle('getConfig', async () => {
        return await getConfig();
    });

    ipcMain.handle('saveConfig', async (event, key, value) => {
        return await saveConfig(key, value);
    });
}

module.exports = { initConfigController };
