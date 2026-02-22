const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function initSystemController() {
    ipcMain.handle('loadTemplate', async (event, moduleName) => {
        try {
            // Securely construct path to the src/views/{moduleName}/{moduleName}.html
            // Example: "users" -> "src/views/users/users.html"
            const templatePath = path.join(__dirname, '../views', moduleName, `${moduleName}.html`);

            if (fs.existsSync(templatePath)) {
                const html = fs.readFileSync(templatePath, 'utf-8');
                return { success: true, html };
            } else {
                return { success: false, error: 'Template not found at ' + templatePath };
            }
        } catch (error) {
            console.error('Error loading template:', error);
            return { success: false, error: 'Failed to load template' };
        }
    });
}

module.exports = { initSystemController };
