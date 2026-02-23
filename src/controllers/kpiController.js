const { ipcMain } = require('electron');
const kpiModel = require('../models/kpiModel');

function initKpiController() {

    // 1. Get KPI Template for a department
    ipcMain.handle('getKpiTemplate', async (event, department) => {
        try {
            return await kpiModel.getKpiTemplate(department);
        } catch (error) {
            console.error('IPC Error getKpiTemplate:', error);
            return { success: false, error: 'Database error fetching template' };
        }
    });

    // 2. Save KPI Template for a department
    ipcMain.handle('saveKpiTemplate', async (event, department, config) => {
        try {
            return await kpiModel.saveKpiTemplate(department, config);
        } catch (error) {
            console.error('IPC Error saveKpiTemplate:', error);
            return { success: false, error: 'Database error saving template' };
        }
    });

    // 3. Get all reports (can filter by department, date range, user_id)
    ipcMain.handle('getKpiReports', async (event, filters) => {
        try {
            return await kpiModel.getKpiReports(filters);
        } catch (error) {
            console.error('IPC Error getKpiReports:', error);
            return { success: false, error: 'Database error fetching reports' };
        }
    });

    // 4. Get specific user report for a period
    ipcMain.handle('getUserKpiReport', async (event, userId, period) => {
        try {
            return await kpiModel.getUserKpiReport(userId, period);
        } catch (error) {
            console.error('IPC Error getUserKpiReport:', error);
            return { success: false, error: 'Database error fetching user report' };
        }
    });

    // 5. Save specific user report for a period
    ipcMain.handle('saveUserKpiReport', async (event, userId, department, period, kpiData) => {
        try {
            return await kpiModel.saveUserKpiReport(userId, department, period, kpiData);
        } catch (error) {
            console.error('IPC Error saveUserKpiReport:', error);
            return { success: false, error: 'Database error saving user report' };
        }
    });
}

module.exports = {
    initKpiController
};
