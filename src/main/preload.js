const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Auth
    login: (username, password) => ipcRenderer.invoke('login', username, password),
    logout: () => ipcRenderer.invoke('logout'),
    getCurrentUser: () => ipcRenderer.invoke('getCurrentUser'),
    navigateToDashboard: () => ipcRenderer.send('navigate-to-dashboard'),
    navigateToLogin: () => ipcRenderer.send('navigate-to-login'),

    // Users CRUD
    getUsers: () => ipcRenderer.invoke('getUsers'),
    addUser: (user) => ipcRenderer.invoke('addUser', user),
    updateUser: (id, user) => ipcRenderer.invoke('updateUser', id, user),
    deleteUser: (id) => ipcRenderer.invoke('deleteUser', id),

    // Permissions
    getPermissions: () => ipcRenderer.invoke('getPermissions'),
    updatePermissions: (role, config) => ipcRenderer.invoke('updatePermissions', role, config),

    // System Components
    loadTemplate: (moduleName) => ipcRenderer.invoke('loadTemplate', moduleName),

    // KPI Feature
    getKpiTemplate: (department) => ipcRenderer.invoke('getKpiTemplate', department),
    saveKpiTemplate: (department, config) => ipcRenderer.invoke('saveKpiTemplate', department, config),
    getKpiReports: (filters) => ipcRenderer.invoke('getKpiReports', filters),
    getUserKpiReport: (userId, period) => ipcRenderer.invoke('getUserKpiReport', userId, period),
    saveUserKpiReport: (userId, department, period, kpiData) => ipcRenderer.invoke('saveUserKpiReport', userId, department, period, kpiData),
    deleteKpiReport: (userId, period) => ipcRenderer.invoke('deleteKpiReport', userId, period),

    // Todo Feature
    getTodos: (filters) => ipcRenderer.invoke('getTodos', filters),
    getTodoById: (id) => ipcRenderer.invoke('getTodoById', id),
    addTodo: (data) => ipcRenderer.invoke('addTodo', data),
    updateTodo: (id, data) => ipcRenderer.invoke('updateTodo', id, data),
    updateTodoStatus: (id, status) => ipcRenderer.invoke('updateTodoStatus', id, status),
    deleteTodo: (id) => ipcRenderer.invoke('deleteTodo', id),

    // Notes Feature
    getNotes: (filters) => ipcRenderer.invoke('getNotes', filters),
    getNoteById: (id) => ipcRenderer.invoke('getNoteById', id),
    addNote: (data) => ipcRenderer.invoke('addNote', data),
    updateNote: (id, data) => ipcRenderer.invoke('updateNote', id, data),
    deleteNote: (id) => ipcRenderer.invoke('deleteNote', id),
    getAllTags: (ownerId) => ipcRenderer.invoke('getAllTags', ownerId),
    markReminderFired: (id) => ipcRenderer.invoke('markReminderFired', id),
    testReminderNotification: () => ipcRenderer.invoke('testReminderNotification'),
    checkRemindersNow: () => ipcRenderer.invoke('checkRemindersNow')
});
