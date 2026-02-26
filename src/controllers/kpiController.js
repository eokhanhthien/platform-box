const { ipcMain } = require('electron');
const kpiModel = require('../models/kpiModel');

function initKpiController() {

    ipcMain.handle('getKpiTemplate', async (event, department) => {
        try { return await kpiModel.getKpiTemplate(department); }
        catch (error) { return { success: false, error: 'Database error fetching template' }; }
    });

    ipcMain.handle('saveKpiTemplate', async (event, department, config) => {
        try { return await kpiModel.saveKpiTemplate(department, config); }
        catch (error) { return { success: false, error: 'Database error saving template' }; }
    });

    ipcMain.handle('getKpiReports', async (event, filters) => {
        try { return await kpiModel.getKpiReports(filters); }
        catch (error) { return { success: false, error: 'Database error fetching reports' }; }
    });

    ipcMain.handle('getUserKpiReport', async (event, userId, period) => {
        try { return await kpiModel.getUserKpiReport(userId, period); }
        catch (error) { return { success: false, error: 'Database error fetching user report' }; }
    });

    ipcMain.handle('saveUserKpiReport', async (event, userId, department, period, kpiData) => {
        try { return await kpiModel.saveUserKpiReport(userId, department, period, kpiData); }
        catch (error) { return { success: false, error: 'Database error saving user report' }; }
    });

    ipcMain.handle('deleteKpiReport', async (event, userId, period) => {
        try { return await kpiModel.deleteKpiReport(userId, period); }
        catch (error) { return { success: false, error: 'Database error deleting report' }; }
    });
}

module.exports = { initKpiController };
