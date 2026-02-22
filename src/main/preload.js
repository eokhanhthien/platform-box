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
    deleteUser: (id) => ipcRenderer.invoke('deleteUser', id)
});
