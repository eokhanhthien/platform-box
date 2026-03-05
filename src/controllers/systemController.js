const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function initSystemController() {
    ipcMain.handle('loadTemplate', async (event, moduleName) => {
        try {
            // Validate module name to prevent path traversal
            if (!/^[a-zA-Z0-9_-]+$/.test(moduleName)) {
                return { success: false, error: 'Invalid module name' };
            }

            // Path to the requested HTML file
            const templatePath = path.join(__dirname, '..', 'views', moduleName, `${moduleName}.html`);

            if (!fs.existsSync(templatePath)) {
                return { success: false, error: 'Template not found' };
            }

            const html = fs.readFileSync(templatePath, 'utf8');
            return { success: true, html };
        } catch (error) {
            console.error('[System] loadTemplate error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { initSystemController };
