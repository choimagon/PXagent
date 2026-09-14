const { app, BrowserWindow, dialog, shell, ipcMain, safeStorage, session } = require('electron');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdirSync, createWriteStream, existsSync } = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {createUpdater}=require('./updater.cjs');
let window, backend, origin, stopping = false;
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// Choose the profile before locking so isolated installer checks can run beside the app.
if(process.env.PX_DESKTOP_DATA)app.setPath('userData',path.resolve(process.env.PX_DESKTOP_DATA));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if(window){if(window.isMinimized())window.restore();window.show();window.focus();} });
  app.on('activate', () => { if(origin&&!window)void createWindow(); });
  app.whenReady().then(start).catch(error => {dialog.showErrorBox('PXagents 실행 오류',error.message);app.quit();});
}
function external(url) {
  try { const parsed = new URL(url); if(['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password)void shell.openExternal(url); } catch {}
}
async function freePort() {
  const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));return port;
}
function environment() {
  const home=app.getPath('home');
  const additions=process.platform==='win32'?[path.join(process.env.SystemRoot||'C:\\Windows','System32','OpenSSH'),path.join(process.env.APPDATA||home,'npm')]:['/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin',path.join(home,'.local','bin')];
  const tools=path.join(app.isPackaged?process.resourcesPath:path.join(root,'build'),'codex','codex-path');
  return {...process.env,PATH:[tools,...additions,process.env.PATH||''].join(path.delimiter)};
}
async function start() {
  app.setName('PXagents');
  // A separate profile prevents dev and installed builds sharing mutable data.
  const data=app.getPath('userData');mkdirSync(data,{recursive:true});
  const password=randomBytes(32).toString('hex');
  const secure=safeStorage.isEncryptionAvailable()&&!(process.platform==='linux'&&safeStorage.getSelectedStorageBackend()==='basic_text');
  const log=createWriteStream(path.join(data,'desktop.log'),{flags:'a',mode:0o600});
  const bundled=path.join(app.isPackaged?process.resourcesPath:path.join(root,'build'),'codex','bin',process.platform==='win32'?'codex.exe':'codex');
  const port=await freePort();origin=`http://127.0.0.1:${port}`;
  backend=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...environment(),ELECTRON_RUN_AS_NODE:'1',PX_DESKTOP:'1',PX_SECRET_STORAGE:secure?'secure':'unavailable',PX_BUNDLED_CODEX:existsSync(bundled)?bundled:'',DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port),TAIL_WEB_PORT:process.env.TAIL_WEB_PORT||'3212',CODEX_WORKDIR:app.getPath('home'),OFFICE_PASSWORD:password},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  backend.stdout.pipe(log);backend.stderr.pipe(log);
  backend.on('error',error=>{if(!stopping){dialog.showErrorBox('서버 실행 오류',error.message);app.quit();}});
  backend.on('message',async message=>{
    if(message?.type!=='secret-request')return;
    try {
      if(!secure)throw Error('OS 보안 저장소를 사용할 수 없습니다. Linux에서는 GNOME Keyring 또는 KWallet을 활성화해주세요.');
      if(typeof message.value!=='string'||message.value.length>2000000)throw Error('보안 저장 요청을 확인해주세요.');
      let value;
      if(message.operation==='encrypt')value=safeStorage.encryptString(message.value).toString('base64');
      else if(message.operation==='decrypt')value=safeStorage.decryptString(Buffer.from(message.value,'base64'));
      else throw Error('지원하지 않는 보안 저장 요청입니다.');
      if(backend?.connected)backend.send({type:'secret-response',id:message.id,value});
    } catch(error) { if(backend?.connected)backend.send({type:'secret-response',id:message.id,error:error.message}); }
  });
  backend.on('exit',()=>{if(!stopping){dialog.showErrorBox('사무실 서버 종료','앱을 다시 실행해주세요. 자세한 기록은 앱 저장 폴더의 desktop.log에 있습니다.');app.quit();}});
  let ready=false;
  for(let i=0;i<240;i++) {
    if(backend.exitCode!==null)throw Error('사무실 서버를 시작하지 못했습니다.');
    try {if((await fetch(origin+'/api/auth',{signal:AbortSignal.timeout(700)})).ok){ready=true;break;}}catch{}
    await delay(250);
  }
  if(!ready)throw Error('사무실 서버 시작 시간이 초과되었습니다.');
  const login=await fetch(origin+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  const token=/(?:^|\s)px_session=([^;]+)/.exec(login.headers.get('set-cookie')||'')?.[1];
  if(!token)throw Error('앱의 사무실 연결을 인증하지 못했습니다.');
  await session.defaultSession.cookies.set({url:origin,name:'px_session',value:token,httpOnly:true,sameSite:'strict',path:'/'});
  const installTarget=process.platform==='darwin'?path.dirname(path.dirname(path.dirname(process.execPath))):process.env.APPIMAGE||path.dirname(process.execPath);
  let updateMode=process.platform==='darwin'?'mac':process.platform==='win32'?'windows':process.env.APPIMAGE?'appimage':'tar';
  if(process.platform==='linux'&&!process.env.APPIMAGE){try{await require('node:fs').promises.access(path.dirname(installTarget),require('node:fs').constants.W_OK);}catch{updateMode='deb';}}
  const updater=createUpdater({currentVersion:app.getVersion(),target:installTarget,mode:updateMode,dataDir:data,packaged:app.isPackaged,onStatus:state=>{if(window&&!window.webContents.isDestroyed())window.webContents.send('px:update-status',state);}});
  await updater.restore();
  const updateCall=(channel,handler)=>ipcMain.handle(channel,async event=>{if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame)throw Error('업데이트 요청을 인증하지 못했습니다.');return handler();});
  const updateGate=async action=>{const response=await fetch(origin+'/api/update/'+action,{method:'POST',headers:{Cookie:`px_session=${token}`}});const result=await response.json();if(!response.ok)throw Error(result.error||'업데이트 준비에 실패했습니다.');};
  updateCall('px:update-status',()=>updater.status());
  updateCall('px:update-check',()=>updater.check());
  updateCall('px:update-download',()=>updater.download());
  updateCall('px:update-cancel',()=>updater.cancel());
  let updateInstalling=false;
  const applyUpdate=async manual=>{if(updateInstalling)throw Error('업데이트 설치를 준비 중입니다.');updateInstalling=true;let gated=false;try{await updateGate('prepare');gated=true;if(manual){const file=updater.file();if(!file||updater.status().status!=='ready')throw Error('다운로드를 먼저 완료해주세요.');const error=await shell.openPath(file);if(error)throw Error(error);}else{const state=await updater.install();setTimeout(()=>app.quit(),150);return state;}setTimeout(()=>app.quit(),150);}catch(error){if(gated)await updateGate('cancel');updateInstalling=false;throw error;}};
  updateCall('px:update-open-file',()=>applyUpdate(true));
  updateCall('px:update-install',()=>applyUpdate(false));
  ipcMain.handle('px:open-external',(event,url)=>{if(event.sender===window?.webContents)external(url);});
  ipcMain.handle('px:choose-folder',async event=>{if(event.sender!==window?.webContents)return null;const result=await dialog.showOpenDialog(window,{properties:['openDirectory'],title:'작업 시작 폴더 선택'});return result.canceled?null:result.filePaths[0];});
  await createWindow();
  if(process.env.PX_DESKTOP_SMOKE==='1') {
    // Used by platform CI to validate a real Electron window and bundled Codex.
    const setup=await(await fetch(origin+'/api/setup',{headers:{Cookie:`px_session=${token}`}})).json();
    if(!setup.desktop||!setup.codex.installed)throw Error('데스크톱 앱 또는 포함된 Codex를 확인하지 못했습니다.');
    let firstScreen=false;
    for(let i=0;i<80&&!firstScreen;i++){
      firstScreen=await window.webContents.executeJavaScript('document.querySelector(".setup-screen [data-setup=codex]") !== null');
      if(!firstScreen)await delay(100);
    }
    if(!firstScreen)throw Error('첫 실행 계정 연결 화면을 확인하지 못했습니다.');
    const updateInfo=await window.webContents.executeJavaScript('window.pxDesktop.updateStatus()');
    if(updateInfo.currentVersion!==app.getVersion())throw Error('업데이트 IPC와 앱 버전을 확인하지 못했습니다.');
    console.log('PX_DESKTOP_SMOKE_OK');app.quit();
  }
}
async function createWindow() {
  window=new BrowserWindow({width:1440,height:1000,minWidth:390,minHeight:650,title:'PXagents',backgroundColor:'#171a19',icon:path.join(root,'build','icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.removeMenu();window.once('ready-to-show',()=>window?.show());
  window.on('closed',()=>{window=null;});
  window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();external(url);}});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  await window.loadURL(origin);
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',event=>{
  if(stopping||!backend||backend.exitCode!==null)return;
  event.preventDefault();stopping=true;
  const timeout=setTimeout(()=>{backend?.kill();app.quit();},20000);
  backend.once('exit',()=>{clearTimeout(timeout);app.quit();});
  if(backend.connected)backend.send({type:'shutdown'});else backend.kill();
});
