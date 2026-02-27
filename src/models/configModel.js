const { getDB } = require('./database');

function getConfig() {
    return new Promise((resolve, reject) => {
        const db = getDB();
        db.all("SELECT key, value FROM system_config", [], (err, rows) => {
            if (err) {
                console.error("Error fetching config:", err);
                return resolve({ success: false, error: err.message });
            }

            const config = {};
            rows.forEach(row => {
                try {
                    config[row.key] = JSON.parse(row.value);
                } catch (e) {
                    config[row.key] = row.value; // fallback if not JSON array/object
                }
            });

            resolve({ success: true, data: config });
        });
    });
}

function saveConfig(key, value) {
    return new Promise((resolve, reject) => {
        const db = getDB();
        const strValue = typeof value === 'object' ? JSON.stringify(value) : value;

        db.run(
            "INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [key, strValue],
            function (err) {
                if (err) {
                    console.error("Error saving config:", err);
                    return resolve({ success: false, error: err.message });
                }
                resolve({ success: true });
            }
        );
    });
}

module.exports = {
    getConfig,
    saveConfig
};
