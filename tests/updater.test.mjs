import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,chmod,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const {createUpdater,newer,assetName,checksum,validateEntries,trustedURL}=createRequire(import.meta.url)('../desktop/updater.cjs');
const tag='v2.1.2';
const asset=name=>({name,state:'uploaded',size:3,browser_download_url:`https://github.com/choimagon/PXagent/releases/download/${tag}/${name}`});
function release(name){return {tag_name:tag,draft:false,prerelease:false,body:'new release',assets:[asset(name),asset('SHA256SUMS')]};}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('updater compares numeric stable versions and selects all OS/CPU installers',()=>{
  assert.equal(newer('v2.10.0','2.9.9'),true);assert.equal(newer('v2.1.0','2.1.0'),false);assert.equal(newer('2.0.0','2.1.0'),false);assert.throws(()=>newer('v2.2.0-beta','2.1.0'));
  for(const arch of ['x64','arm64']){assert.equal(assetName('win32',arch,'windows',tag),`PXagents-windows-${arch}.exe`);assert.equal(assetName('darwin',arch,'mac',tag),`PXagents-mac-${arch}.zip`);assert.equal(assetName('linux',arch,'tar',tag),`PXagents-linux-${arch}.tar.gz`);assert.equal(assetName('linux',arch,'appimage',tag),`PXagents-2.1.2-linux-${arch}.AppImage`);assert.equal(assetName('linux',arch,'deb',tag),`PXagents-2.1.2-linux-${arch}.deb`);}
  for(const url of ['http://github.com/a','https://evil.example/a','https://github.com@evil.example/a'])assert.throws(()=>trustedURL(url));
  assert.throws(()=>checksum(`${hash('abc')}  app\n${hash('abc')}  app`,'app'));
  for(const list of ['../outside','/tmp/file','pxagents/../../outside','other/file'])assert.throws(()=>validateEntries(list,'tar'));
});
test('updater accepts matching checksums, emits progress, and rejects corrupt or substituted installers',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'px-updater-'));try{const name=assetName('linux','arm64','appimage',tag);let corrupt=false,substitute=false;const events=[];
    const updater=createUpdater({currentVersion:'2.1.1',platform:'linux',arch:'arm64',mode:'appimage',target:path.join(root,'AppImage'),dataDir:root,onStatus:state=>events.push(state),readText:async url=>url.includes('/latest')?JSON.stringify(substitute?{...release(name),assets:[{...asset(name),browser_download_url:'https://evil.example/payload'},asset('SHA256SUMS')]}:release(name)):`${hash('abc')}  ${name}\n`,downloadFile:async(_url,file,options)=>{await writeFile(file,'abc');options.onProgress(3,3);return hash(corrupt?'bad':'abc');}});
    assert.equal((await updater.check()).status,'available');assert.equal((await updater.download()).status,'ready');assert.equal(await readFile(updater.file(),'utf8'),'abc');assert.ok(events.some(e=>e.progress===100));
    corrupt=true;await updater.check();assert.equal((await updater.download()).status,'error');await assert.rejects(updater.install());
    substitute=true;assert.equal((await updater.check()).status,'error');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('cancelling an update removes partial downloads and permits another download',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'px-updater-cancel-'));try{const name=assetName('win32','x64','windows',tag);let started;const begun=new Promise(r=>started=r);
    const updater=createUpdater({currentVersion:'2.1.1',platform:'win32',arch:'x64',mode:'windows',target:root,dataDir:root,readText:async url=>url.includes('/latest')?JSON.stringify(release(name)):`${hash('abc')}  ${name}\n`,downloadFile:async(_url,file,{signal})=>{await writeFile(file,'a');started();await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancel')),{once:true}));}});
    await updater.check();const pending=updater.download();await begun;updater.cancel();assert.equal((await pending).status,'available');await assert.rejects(access(updater.file()));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('POSIX update helper replaces the application, restarts it and preserves separate user data',{skip:process.platform==='win32'},async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'px-update-apply-'));try{const target=path.join(root,'app with spaces'),staged=path.join(root,'staged'),work=path.join(root,'work'),marker=path.join(root,'restarted'),data=path.join(root,'office.json');for(const folder of [target,staged,work])await mkdir(folder);
    await writeFile(data,'preserved user settings');await writeFile(path.join(target,'version'),'2.1.1');await writeFile(path.join(staged,'version'),'2.1.2');await writeFile(path.join(staged,'px-agents-office'),`#!/bin/sh\nprintf restarted > '${marker.replaceAll("'","'\\''")}'\n`);await chmod(path.join(staged,'px-agents-office'),0o755);
    const child=spawn('/bin/sh',[path.resolve('desktop/update-helper.sh'),work,'2147483647','tar',target,staged],{stdio:'ignore'});assert.equal(await new Promise(r=>child.once('exit',r)),0);
    assert.equal(await readFile(path.join(target,'version'),'utf8'),'2.1.2');assert.equal(await readFile(data,'utf8'),'preserved user settings');for(let i=0;i<100;i++){try{await access(marker);break;}catch{await new Promise(r=>setTimeout(r,10));}}assert.equal(await readFile(marker,'utf8'),'restarted');await assert.rejects(access(target+'.px-update-previous'));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('POSIX updater restores and restarts the original application when replacement fails',{skip:process.platform==='win32'},async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'px-update-rollback-'));
  const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
  try{
    const target=path.join(root,'app'),staged=path.join(root,'staged'),work=path.join(root,'work'),bin=path.join(root,'bin'),marker=path.join(root,'old-restarted');
    for(const folder of [target,staged,work,bin])await mkdir(folder);
    await writeFile(path.join(target,'version'),'original');await writeFile(path.join(staged,'version'),'replacement');
    await writeFile(path.join(target,'px-agents-office'),`#!/bin/sh\nprintf original > ${quote(marker)}\n`);await chmod(path.join(target,'px-agents-office'),0o755);
    const mv=path.join(bin,'mv');await writeFile(mv,`#!/bin/sh\nif [ "$1" = ${quote(target+'.px-update-new')} ]; then exit 1; fi\nexec /bin/mv "$@"\n`);await chmod(mv,0o755);
    const child=spawn('/bin/sh',[path.resolve('desktop/update-helper.sh'),work,'2147483647','tar',target,staged],{stdio:'ignore',env:{...process.env,PATH:bin+path.delimiter+process.env.PATH}});
    assert.equal(await new Promise(r=>child.once('exit',r)),1);
    assert.equal(await readFile(path.join(target,'version'),'utf8'),'original');assert.match(await readFile(path.join(work,'install-error'),'utf8'),/복구/);
    for(let i=0;i<100;i++){try{await access(marker);break;}catch{await new Promise(r=>setTimeout(r,10));}}
    assert.equal(await readFile(marker,'utf8'),'original');
  }finally{await rm(root,{recursive:true,force:true});}
});
