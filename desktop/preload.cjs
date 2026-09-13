const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pxDesktop',{
  openExternal:url=>ipcRenderer.invoke('px:open-external',url),
  chooseFolder:()=>ipcRenderer.invoke('px:choose-folder'),
});
