const { ipcMain } = require('electron');
const { getAllPermissions, updatePermissions } = require('../models/permissionModel');

function initPermissionController() {
    ipcMain.handle('getPermissions', async (event) => {
        try {
            const result = await getAllPermissions();
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });

    ipcMain.handle('updatePermissions', async (event, role, permissionsObj) => {
        try {
            const result = await updatePermissions(role, permissionsObj);
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });
}

module.exports = {
    initPermissionController
};
