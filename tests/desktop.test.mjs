import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createCodexLogin} from '../codex-login.mjs';

test('official ChatGPT login is completed through Codex without returning tokens',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'px-login-test-')),file=path.join(dir,'login.cjs');
  await writeFile(file,`const lines=require('node:readline').createInterface({input:process.stdin});lines.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')console.log(JSON.stringify({id:m.id,result:{}}));if(m.method==='account/login/start'){console.log(JSON.stringify({id:m.id,result:{authUrl:'https://auth.openai.com/test-login',loginId:'test'}}));setTimeout(()=>console.log(JSON.stringify({method:'account/login/completed',params:{success:true}})),100);}});`);
  let completed=false;
  const login=createCodexLogin({getBinary:()=>process.execPath,spawnProcess:()=>spawn(process.execPath,[file],{stdio:['pipe','pipe','pipe']}),onComplete:async()=>{completed=true;}});
  try {
    const started=await login.start();assert.equal(started.status,'pending');assert.match(started.authUrl,/auth.openai.com/);
    assert.deepEqual(await login.start(),started);
    for(let i=0;i<100&&!completed;i++)await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(completed,true);assert.deepEqual(login.status(),{status:'complete'});
    assert.equal(login.cancel().status,'cancelled');
  }finally{login.cancel();await rm(dir,{recursive:true,force:true});}
});

test('desktop distribution contains explicit OS targets and excludes user data',async()=>{
  const config=(await import('../electron-builder.config.cjs')).default;
  assert.deepEqual(config.win.target,['nsis']);assert.deepEqual(config.mac.target,['dmg','zip']);assert.deepEqual(config.linux.target,['AppImage','deb']);
  assert.ok(config.files.includes('!data/**'));assert.ok(config.files.includes('!.env'));assert.ok(config.files.includes('!node_modules/**'));
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(pkg.main,'desktop/main.cjs');assert.ok(pkg.devDependencies['@openai/codex']);
});

test('SSH askpass prints a password on Windows/macOS/Linux using the included Node runtime',async()=>{
  const preload=path.resolve('scripts/ssh-askpass.cjs');
  const child=spawn(process.execPath,['password prompt'],{env:{...process.env,PX_SSH_PASSWORD:'test-secret',NODE_OPTIONS:`--require "${preload.replaceAll('\\','/')}"`},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk;});const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  assert.equal(code,0);assert.equal(output,'test-secret');
});
