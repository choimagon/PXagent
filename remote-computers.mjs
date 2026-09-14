import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
function readTailscaleStatus(binary) {
  return new Promise((resolve,reject)=>{
    // macOS Tailscale can abort when stdin is a pipe, even without input.
    const child=spawn(binary,['status','--json'],{stdio:['ignore','pipe','pipe'],timeout:8000,killSignal:'SIGKILL',windowsHide:true});
    const chunks=[];
    let bytes=0,outputError;
    const collect=(chunk,isError)=>{
      if(outputError)return;
      bytes+=chunk.length;
      if(bytes>2*1024*1024){outputError=new Error('Tailscale output limit exceeded');child.kill('SIGKILL');return;}
      if(!isError)chunks.push(chunk);
    };
    child.stdout.on('data',chunk=>collect(chunk,false));
    child.stderr.on('data',chunk=>collect(chunk,true));
    child.once('error',reject);
    child.once('close',(code,signal)=>{
      if(outputError)reject(outputError);
      else if(code!==0||signal)reject(new Error('Tailscale status failed'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}
export async function findTailscale() {
  const programFiles=process.env.ProgramFiles||'C:\\Program Files';
  const candidates=process.env.TAILSCALE_BIN?[process.env.TAILSCALE_BIN]:[...(process.env.PATH||'').split(path.delimiter).filter(Boolean).map(dir=>path.join(dir,process.platform==='win32'?'tailscale.exe':'tailscale')),'/Applications/Tailscale.app/Contents/MacOS/Tailscale',path.join(programFiles,'Tailscale','tailscale.exe'),'/usr/bin/tailscale','/usr/local/bin/tailscale'];
  for(const candidate of candidates) {try {await access(candidate,constants.X_OK);return candidate;}catch{}}
  return null;
}
export function parseComputers(status) {
  if(status.BackendState!=='Running') return [];
  return Object.values(status.Peer||{}).filter(peer=>peer.ID && peer.ID!==status.Self?.ID).flatMap(peer=>{
    const ip=(peer.TailscaleIPs||[]).find(ip=>{const parts=ip.split('.').map(Number);return parts.length===4&&parts[0]===100&&parts[1]>=64&&parts[1]<=127&&parts.every(n=>Number.isInteger(n)&&n>=0&&n<=255);});
    if(!ip)return [];
    return [{id:peer.ID,name:peer.HostName||peer.DNSName||ip,ip,platform:peer.OS||'',online:peer.Online===true,terminalSupported:['linux','macos','freebsd','openbsd'].includes((peer.OS||'').toLowerCase())}];
  }).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));
}
export async function discoverComputers(binary) {
  if(!binary) return {available:false,computers:[],message:'Tailscale가 설치되어 있지 않습니다.'};
  try {
    const stdout=await readTailscaleStatus(binary);
    const status=JSON.parse(stdout);
    return {available:status.BackendState==='Running',computers:parseComputers(status),message:status.BackendState==='Running'?'':'Tailscale 연결을 확인해주세요.'};
  } catch { return {available:false,computers:[],message:'Tailscale 컴퓨터 목록을 조회하지 못했습니다.'}; }
}
export const shellQuote=value=>`'${String(value).replaceAll("'", "'\\''")}'`;
export function validateUsername(value) {
  if(typeof value!=='string'||!/^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}\$?$/.test(value)) throw Object.assign(new Error('접속할 컴퓨터의 계정 이름을 입력해주세요.'),{status:400});
  return value;
}
export function validateRemoteDirectory(value) {
  if(typeof value!=='string'||value.length>4096||/[\0\r\n]/.test(value)||(value&&!value.startsWith('/')&&value!=='~'&&!value.startsWith('~/'))) throw Object.assign(new Error('원격 작업 폴더의 절대 경로를 입력해주세요.'),{status:400});
  return value;
}
export async function runRemoteTerminal({computer,username,sudoPassword='',command,directory='',sudo=false,input='',signal,timeoutMs=120000}) {
  validateUsername(username);validateRemoteDirectory(directory);
  if(!computer?.ip||!/^100\.(?:\d{1,3}\.){2}\d{1,3}$/.test(computer.ip)) throw new Error('Tailscale 작업 대상을 확인해주세요.');
  if(typeof command!=='string'||!command.trim()||command.length>60000||command.includes('\0')) throw Object.assign(new Error('실행할 명령을 입력해주세요.'),{status:400});
  if(/\bcodex(?:\.exe)?(?=[\s'";|&]|$)|@openai\/codex/i.test(command)) throw Object.assign(new Error('원격 컴퓨터에서 Codex를 실행하거나 설치할 수 없습니다. Codex는 사무실 서버에서만 실행합니다.'),{status:400});
  if(sudo&&!sudoPassword) throw Object.assign(new Error('이 컴퓨터의 sudo 비밀번호를 설정해주세요.'),{status:400});
  const cd=directory?(directory==='~'?'cd "$HOME"':directory.startsWith('~/')?`cd "$HOME"/${shellQuote(directory.slice(2))}`:`cd ${shellQuote(directory)}`)+' && ':'';
  const script=cd+command;
  const remoteCommand=sudo?`sudo -S -p '' -- sh -c ${shellQuote(script)}`:`sh -lc ${shellQuote(script)}`;
  const args=['-T','-o',sudoPassword?'BatchMode=no':'BatchMode=yes','-o','NumberOfPasswordPrompts=1','-o','ConnectTimeout=8','-o','StrictHostKeyChecking=accept-new','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2',`${username}@${computer.ip}`,remoteCommand];
  const binary=process.env.SSH_BIN||(process.platform==='win32'?'ssh':'/usr/bin/ssh');
  return new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(signal.reason);
    const env={...process.env,...(sudoPassword?{SSH_ASKPASS:process.execPath,NODE_OPTIONS:`--require "${path.join(root,'scripts/ssh-askpass.cjs').replaceAll('\\','/')}"`,SSH_ASKPASS_REQUIRE:'force',DISPLAY:process.env.DISPLAY||':0',PX_SSH_NODE:process.execPath,PX_SSH_ASKPASS_SCRIPT:path.join(root,'scripts/ssh-askpass.mjs'),PX_SSH_PASSWORD:sudoPassword}:{})};
    const child=spawn(binary,args,{env,stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32',windowsHide:true});
    let stdout='',stderr='',bytes=0,stopError,killTimer;
    const redact=text=>sudoPassword?text.split(sudoPassword).join('[비밀번호 숨김]'):text;
    function stop(error){if(stopError)return;stopError=error;try{if(process.platform==='win32')child.kill();else process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{if(process.platform==='win32')child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL');}catch{}},1500);}
    const abort=()=>stop(signal.reason||new Error('원격 명령을 중지했습니다.'));
    const timer=setTimeout(()=>stop(new Error('원격 명령 실행 시간이 초과되었습니다.')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    const collect=(chunk,isError)=>{bytes+=chunk.length;if(bytes>2*1024*1024){stop(new Error('원격 명령 출력이 너무 큽니다. 파일로 저장한 뒤 필요한 부분을 확인하세요.'));return;}if(isError)stderr+=chunk;else stdout+=chunk;};
    child.stdout.on('data',chunk=>collect(chunk,false));child.stderr.on('data',chunk=>collect(chunk,true));
    const cleanup=()=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);};
    child.on('error',error=>{cleanup();reject(error);});
    child.on('close',code=>{cleanup();if(stopError)reject(stopError);else resolve({exitCode:code,stdout:redact(stdout),stderr:redact(stderr)});});
    child.stdin.on('error',()=>{});
    child.stdin.end((sudo?sudoPassword+'\n':'')+input);
  });
}
