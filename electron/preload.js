/**
 * Preload script - secure bridge between main and renderer processes.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Receive predictions from main process
  onPrediction: (callback) => {
    ipcRenderer.on('prediction', (_event, data) => callback(data));
  },
  
  // Receive clear command
  onClearPrediction: (callback) => {
    ipcRenderer.on('clear-prediction', () => callback());
  },
  
  // Receive status updates
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
  }
});

