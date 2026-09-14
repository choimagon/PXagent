const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pxDesktop',{
  openExternal:url=>ipcRenderer.invoke('px:open-external',url),
  chooseFolder:()=>ipcRenderer.invoke('px:choose-folder'),
  updateStatus:()=>ipcRenderer.invoke('px:update-status'),
  checkUpdate:()=>ipcRenderer.invoke('px:update-check'),
  downloadUpdate:()=>ipcRenderer.invoke('px:update-download'),
  cancelUpdate:()=>ipcRenderer.invoke('px:update-cancel'),
  installUpdate:()=>ipcRenderer.invoke('px:update-install'),
  openUpdateFile:()=>ipcRenderer.invoke('px:update-open-file'),
  onUpdateStatus:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('px:update-status',listener);return()=>ipcRenderer.removeListener('px:update-status',listener);},
});
