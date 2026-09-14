import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverComputers, parseComputers, runRemoteTerminal } from '../remote-computers.mjs';

test('Tailscale status has ignored stdin and bounded, validated output',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'px-tailscale-status-'));
  let index=0;
  const fixture=async source=>{
    const binary=path.join(dir,`tailscale-${index++}.cjs`);
    await writeFile(binary,`#!${process.execPath}\n${source}\n`);await chmod(binary,0o755);return binary;
  };
  const status={BackendState:'Running',Peer:{remote:{ID:'remote',HostName:'remote-mac',OS:'macos',Online:true,TailscaleIPs:['100.64.1.2']}}};
  try {
    await t.test('a CLI that rejects piped stdin can list computers',async()=>{
      const binary=await fixture(`const fs=require('node:fs');if(!fs.fstatSync(0).isCharacterDevice())process.exit(42);if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['status','--json']))process.exit(43);process.stderr.write('diagnostic warning');process.stdout.write(${JSON.stringify(JSON.stringify(status))});`);
      const result=await discoverComputers(binary);assert.equal(result.available,true);assert.equal(result.computers[0].name,'remote-mac');
    });
    for(const [name,source] of [
      ['nonzero exit',`process.stdout.write(${JSON.stringify(JSON.stringify(status))});process.exitCode=1;`],
      ['invalid JSON',`process.stdout.write('invalid JSON');`],
      ['oversized stdout',`process.stdout.write(Buffer.alloc(2*1024*1024+1));`],
      ['oversized stderr',`process.stderr.write(Buffer.alloc(2*1024*1024+1));`],
      ['timeout',`setInterval(()=>{},1000);`]
    ])await t.test(name,async()=>{
      const result=await discoverComputers(await fixture(source));assert.equal(result.available,false);assert.deepEqual(result.computers,[]);assert.match(result.message,/조회하지 못했습니다/);
    });
    assert.equal((await discoverComputers(path.join(dir,'missing'))).available,false);
    assert.deepEqual(await discoverComputers(null),{available:false,computers:[],message:'Tailscale가 설치되어 있지 않습니다.'});
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Tailscale discovery accepts only tailnet peers and preserves online/support status',()=>{
  const result=parseComputers({BackendState:'Running',Self:{ID:'self'},Peer:{self:{ID:'self',TailscaleIPs:['100.64.1.1']},remote:{ID:'remote',OS:'linux',Online:true,TailscaleIPs:['100.64.1.2']},other:{ID:'other',OS:'iOS',Online:false,TailscaleIPs:['100.64.1.3']},bad:{ID:'bad',TailscaleIPs:['192.168.1.1']}}});
  assert.equal(result.length,2);assert.equal(result[0].id,'remote');assert.equal(result[0].terminalSupported,true);assert.equal(result[1].terminalSupported,false);
  assert.deepEqual(parseComputers({BackendState:'Stopped',Peer:{}}),[]);
});
test('remote commands reject Codex use and invalid remote paths before opening SSH',async()=>{
  const base={computer:{ip:'100.64.1.2'},username:'remoteuser'};
  await assert.rejects(runRemoteTerminal({...base,command:'codex exec task'}),/원격 컴퓨터에서 Codex/);
  await assert.rejects(runRemoteTerminal({...base,command:'npm install -g @openai/codex'}),/원격 컴퓨터에서 Codex/);
  await assert.rejects(runRemoteTerminal({...base,command:'pwd',directory:'relative/path'}),/절대 경로/);
  await assert.rejects(runRemoteTerminal({...base,command:'pwd',sudo:true}),/sudo 비밀번호/);
});
test('cancelling a remote command terminates its local SSH process',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'px-remote-cancel-')),binary=path.join(dir,'ssh'),pidFile=path.join(dir,'pid');
  const old=process.env.SSH_BIN;
  await writeFile(binary,`#!/usr/bin/env node\nimport fs from 'node:fs';fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setTimeout(()=>{},30000);\n`);await chmod(binary,0o755);
  process.env.SSH_BIN=binary;
  const controller=new AbortController();
  try {
    const pending=runRemoteTerminal({computer:{ip:'100.64.1.2'},username:'remoteuser',command:'sleep 30',signal:controller.signal});
    const rejected=assert.rejects(pending,/cancel-test/);
    let pid;
    for(let i=0;i<100;i++){try{pid=Number(await readFile(pidFile,'utf8'));break;}catch{}await new Promise(resolve=>setTimeout(resolve,20));}
    assert.ok(pid);controller.abort(new Error('cancel-test'));await rejected;
    assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
  }finally{controller.abort();if(old===undefined)delete process.env.SSH_BIN;else process.env.SSH_BIN=old;await rm(dir,{recursive:true,force:true});}
});
