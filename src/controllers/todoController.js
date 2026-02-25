const { ipcMain } = require('electron');
const todoModel = require('../models/todoModel');

function initTodoController() {

    ipcMain.handle('getTodos', async (event, filters) => {
        try {
            return await todoModel.getTodos(filters || {});
        } catch (error) {
            console.error('IPC Error getTodos:', error);
            return { success: false, error: 'Database error fetching todos' };
        }
    });

    ipcMain.handle('getTodoById', async (event, id) => {
        try {
            return await todoModel.getTodoById(id);
        } catch (error) {
            console.error('IPC Error getTodoById:', error);
            return { success: false, error: 'Database error fetching todo' };
        }
    });

    ipcMain.handle('addTodo', async (event, data) => {
        try {
            return await todoModel.addTodo(data);
        } catch (error) {
            console.error('IPC Error addTodo:', error);
            return { success: false, error: 'Database error adding todo' };
        }
    });

    ipcMain.handle('updateTodo', async (event, id, data) => {
        try {
            return await todoModel.updateTodo(id, data);
        } catch (error) {
            console.error('IPC Error updateTodo:', error);
            return { success: false, error: 'Database error updating todo' };
        }
    });

    ipcMain.handle('updateTodoStatus', async (event, id, status) => {
        try {
            return await todoModel.updateTodoStatus(id, status);
        } catch (error) {
            console.error('IPC Error updateTodoStatus:', error);
            return { success: false, error: 'Database error updating todo status' };
        }
    });

    ipcMain.handle('deleteTodo', async (event, id) => {
        try {
            return await todoModel.deleteTodo(id);
        } catch (error) {
            console.error('IPC Error deleteTodo:', error);
            return { success: false, error: 'Database error deleting todo' };
        }
    });
}

module.exports = { initTodoController };
