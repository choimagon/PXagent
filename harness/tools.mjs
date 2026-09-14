import {spawn,execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
export async function runCommand({command,args=[],directory,signal,timeoutMs=180000,maxBytes=2*1024*1024,env={},inheritEnv=true}) {
  if(signal?.aborted)throw signal.reason;
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:directory,env:{...(inheritEnv?process.env:{}),...env},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32',windowsHide:true});
    let bytes=0,stdout='',stderr='',error,killTimer;
    const kill=force=>{if(!child.pid)return;try{if(process.platform==='win32')execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else process.kill(-child.pid,force?'SIGKILL':'SIGTERM');}catch{}};
    const stop=reason=>{if(error)return;error=reason;kill(false);killTimer=setTimeout(()=>kill(true),1000);};
    const abort=()=>stop(signal.reason||Error('명령이 중지되었습니다.'));
    const timer=setTimeout(()=>stop(Error('명령 실행 시간이 초과되었습니다.')),timeoutMs);signal?.addEventListener('abort',abort,{once:true});
    const collect=(chunk,isError)=>{bytes+=chunk.length;if(bytes>maxBytes){stop(Error('명령 출력 제한을 초과했습니다.'));return;}if(isError)stderr+=chunk.toString();else stdout+=chunk.toString();};
    child.stdout.on('data',chunk=>collect(chunk,false));child.stderr.on('data',chunk=>collect(chunk,true));
    child.once('error',reason=>{error=reason;});
    child.once('close',(code,exitSignal)=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);if(error){kill(true);reject(error);}else resolve({exitCode:code??1,signal:exitSignal,stdout,stderr});});
  });
}
export const git=(directory,args,signal)=>runCommand({command:'git',args:['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false',...args],directory,signal});
export async function mustGit(directory,args,signal) {const result=await git(directory,args,signal);if(result.exitCode!==0)throw Error(`Git 작업 실패: ${result.stderr.slice(-1500)}`);return result.stdout;}
export const runShell=(command,directory,signal,timeoutMs)=>runCommand({command:process.platform==='win32'?'cmd.exe':'/bin/sh',args:process.platform==='win32'?['/d','/s','/c',command]:['-c',command],directory,signal,timeoutMs});
// Run model-selected commands through Codex's native OS sandbox. Never fall back to unrestricted execution.
export function createSandboxRunner(binary,env) {
  let help;
  return async(command,directory,signal,timeoutMs=180000,{readOnly=false}={})=>{
    help ||= runCommand({command:binary,args:['sandbox','--help'],env,inheritEnv:false,timeoutMs:10000}).then(result=>{if(result.exitCode)throw Error('Codex 명령 샌드박스를 사용할 수 없습니다.');return result.stdout;});
    const supported=await help,temporary=path.join(directory,'.px-runtime','tmp');await mkdir(temporary,{recursive:true});
    let args=['sandbox'];
    if(supported.includes('--permission-profile'))args.push('-P','px_worker','-c',`permissions.px_worker.filesystem={":root"="read",${JSON.stringify(readOnly?temporary:directory)}="write"}`,'-c','permissions.px_worker.network.enabled=true','-C',directory);
    else args.push(process.platform==='darwin'?'macos':process.platform==='win32'?'windows':'linux',...(readOnly?['-c','sandbox_mode="read-only"']:['--full-auto']),'-c','sandbox_workspace_write.writable_roots=[]','-c','sandbox_workspace_write.exclude_slash_tmp=true','-c','sandbox_workspace_write.exclude_tmpdir_env_var=true','-c','sandbox_workspace_write.network_access=true');
    args.push('--',process.platform==='win32'?'cmd.exe':'/bin/sh',...(process.platform==='win32'?['/d','/s','/c',command]:['-c',command]));
    return runCommand({command:binary,args,directory,signal,timeoutMs,env:{...env,TMPDIR:temporary,TEMP:temporary,TMP:temporary},inheritEnv:false});
  };
}
