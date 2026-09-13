import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const data=await mkdtemp(path.join(tmpdir(),'px-packaged-smoke-'));
const arch=process.env.PX_BUILD_ARCH||process.arch;
const folder=process.platform==='darwin'?`mac${arch==='arm64'?'-arm64':''}`:process.platform==='win32'?`win${arch==='arm64'?'-arm64':''}-unpacked`:`linux${arch==='arm64'?'-arm64':''}-unpacked`;
const binary=process.platform==='darwin'?path.resolve('release',folder,'PXagents.app','Contents','MacOS','PXagents'):path.resolve('release',folder,process.platform==='win32'?'PXagents.exe':'px-agents-office');
let output='';
try {
  const env={...process.env,PX_DESKTOP_DATA:data,CODEX_HOME:path.join(data,'codex-home'),PX_DESKTOP_SMOKE:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(binary,[],{env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
  const timer=setTimeout(()=>child.kill(),90000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});clearTimeout(timer);
  if(code!==0||!output.includes('PX_DESKTOP_SMOKE_OK'))throw Error('패키징한 앱 실행 검증 실패:\n'+output);
  console.log('패키징한 앱과 첫 실행 설정 화면 검증 완료');
} finally {await rm(data,{recursive:true,force:true});}
