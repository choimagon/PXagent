import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('Linux installer verifies downloads, installs into paths with spaces, and safely uninstalls', {skip:process.platform==='win32'}, async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'px-install-'));
 try {
 const root=path.join(dir,'user space');const source=path.join(dir,'source');const downloads=path.join(dir,'downloads');
 await mkdir(path.join(source,'pxagents','resources','app','build'),{recursive:true});await mkdir(downloads);
 await writeFile(path.join(source,'pxagents','px-agents-office'),'#!/bin/sh\nexit 0\n',{mode:0o755});
 await writeFile(path.join(source,'pxagents','resources','app','build','icon.png'),'icon');
 const asset='PXagents-linux-x64.tar.gz';execFileSync('tar',['-czf',path.join(downloads,asset),'-C',source,'pxagents']);
 const sha=createHash('sha256').update(await readFile(path.join(downloads,asset))).digest('hex');
 await writeFile(path.join(downloads,'SHA256SUMS'),`${sha}  ${asset}\n`);
 const env={...process.env,PXAGENT_OS:'Linux',PXAGENT_ARCH:'x86_64',PXAGENT_INSTALL_HOME:root,PXAGENT_DOWNLOAD_BASE:'file://'+downloads};
 execFileSync('sh',['install.sh','i'],{env,stdio:'pipe'});
 await access(path.join(root,'.local/bin/pxagents'));await access(path.join(root,'.local/share/applications/pxagents.desktop'));
 await writeFile(path.join(downloads,'SHA256SUMS'),`${'0'.repeat(64)}  ${asset}\n`);
 assert.throws(()=>execFileSync('sh',['install.sh','i'],{env,stdio:'pipe'}));await access(path.join(root,'.local/bin/pxagents'));
 execFileSync('sh',['install.sh','c'],{env,stdio:'pipe'});
 await assert.rejects(access(path.join(root,'.local/opt/pxagents')));await assert.rejects(access(path.join(root,'.local/bin/pxagents')));
 await mkdir(path.join(root,'.local/opt/pxagents'),{recursive:true});
 assert.throws(()=>execFileSync('sh',['install.sh','c'],{env,stdio:'pipe'}));await access(path.join(root,'.local/opt/pxagents'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
