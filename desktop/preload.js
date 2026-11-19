/* Ponte entre o painel (site) e o app: o painel detecta window.huntixDesktop e passa a imprimir direto */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('huntixDesktop', {
  print: html => ipcRenderer.invoke('hx:print', html),
  printers: () => ipcRenderer.invoke('hx:printers'),
  setPrinter: nome => ipcRenderer.invoke('hx:setPrinter', nome),
  info: () => ipcRenderer.invoke('hx:info'),
  notify: (titulo, texto) => ipcRenderer.send('hx:notify', titulo, texto)
});
