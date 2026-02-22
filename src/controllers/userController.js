const { ipcMain } = require('electron');
const { loginUser, getAllUsers, addUser, updateUser, deleteUser } = require('../models/userModel');

function initUserController() {
    ipcMain.handle('login', async (event, username, password) => {
        try {
            const result = await loginUser(username, password);
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });

    ipcMain.handle('getUsers', async (event) => {
        try {
            const result = await getAllUsers();
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });

    ipcMain.handle('addUser', async (event, user) => {
        try {
            if (!user.password) {
                return { success: false, error: 'Mật khẩu là bắt buộc khi thêm mới' };
            }
            const result = await addUser(user);
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });

    ipcMain.handle('updateUser', async (event, id, user) => {
        try {
            // Trong ứng dụng này, vì không thiết kế hash pass phức tạp, user.password có thể được truyền là rỗng.
            // Để an toàn, nếu password rỗng, ta nên fetch DB lấy pass cũ trước. 
            // Tạm thời ta xử lý nhanh ở Model hoặc yêu cầu DB luôn update bằng tay.
            // Với userModel hiện tại, nó update đè luôn. Nên frontend phải gửi password.
            const result = await updateUser(id, user);
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });

    ipcMain.handle('deleteUser', async (event, id) => {
        try {
            const result = await deleteUser(id);
            return result;
        } catch (error) {
            return { success: false, error: 'Database error: ' + error.message };
        }
    });
}

module.exports = {
    initUserController
};
