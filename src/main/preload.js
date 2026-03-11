const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // System Components (lazy load HTML templates)
    loadTemplate: (moduleName) => ipcRenderer.invoke('loadTemplate', moduleName),

    // Todo Feature
    getTodos: (filters) => ipcRenderer.invoke('getTodos', filters),
    getTodoById: (id) => ipcRenderer.invoke('getTodoById', id),
    addTodo: (data) => ipcRenderer.invoke('addTodo', data),
    updateTodo: (id, data) => ipcRenderer.invoke('updateTodo', id, data),
    updateTodoStatus: (id, status) => ipcRenderer.invoke('updateTodoStatus', id, status),
    deleteTodo: (id) => ipcRenderer.invoke('deleteTodo', id),
    updateTodoOrder: (items) => ipcRenderer.invoke('updateTodoOrder', items),

    // Notes Feature
    getNotes: (filters) => ipcRenderer.invoke('getNotes', filters),
    getNoteById: (id) => ipcRenderer.invoke('getNoteById', id),
    addNote: (data) => ipcRenderer.invoke('addNote', data),
    updateNote: (id, data) => ipcRenderer.invoke('updateNote', id, data),
    deleteNote: (id) => ipcRenderer.invoke('deleteNote', id),
    updateNoteOrders: (updates) => ipcRenderer.invoke('updateNoteOrders', updates),
    getAllTags: () => ipcRenderer.invoke('getAllTags'),
    markReminderFired: (id) => ipcRenderer.invoke('markReminderFired', id),
    testReminderNotification: () => ipcRenderer.invoke('testReminderNotification'),
    checkRemindersNow: () => ipcRenderer.invoke('checkRemindersNow'),

    // App Navigation
    onNavigate: (callback) => ipcRenderer.on('navigate', (event, ...args) => callback(...args)),
    onRefreshData: (callback) => ipcRenderer.on('refresh-data', (event, ...args) => callback(...args))
});
