import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, chmod, mkdir, rm, realpath, stat } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { findCodex, runCodex } from '../codex-runner.mjs';

let server, root, base, binary, workspace, other;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(route, method = 'GET', body) {
  const response = await fetch(base + '/api/' + route, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function poll(id, status = 'done') {
  for (let i = 0; i < 300; i++) {
    const state = (await request('state')).data, task = state.tasks.find(task => task.id === id);
    if (task.status === status) return { task, state };
    await sleep(20);
  }
  throw new Error(`Task did not reach ${status}`);
}
const fixture = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('codex-cli test');process.exit(0);}
if(args[0]==='login'){console.log(fs.existsSync(new URL('./api-login',import.meta.url))?'Logged in using an API key':'Logged in using ChatGPT');process.exit(0);}
if(args[0]==='sandbox'){console.log('trusted test fixture has no model-generated shell commands');process.exit(0);}
if(args[0]==='app-server'){
  const {createInterface}=await import('node:readline');
  for await(const line of createInterface({input:process.stdin})){
    const request=JSON.parse(line);if(!request.id)continue;
    const result=request.method==='initialize'?{}:request.method==='account/read'?{account:{type:'chatgpt',email:'usage@example.test',planType:'pro'}}:{rateLimits:{limitId:'codex',primary:{usedPercent:23,windowDurationMins:300,resetsAt:1789300000},secondary:null},rateLimitResetCredits:{availableCount:4,credits:[{status:"available",expiresAt:1893456000},{status:"available",expiresAt:null},{status:"redeemed",expiresAt:1893456000}]}};
    console.log(JSON.stringify({id:request.id,result}));
  }
  process.exit(0);
}
let prompt='';for await(const chunk of process.stdin)prompt+=chunk;
const capture={args,prompt,pid:process.pid,cwd:process.cwd(),envKeys:Object.keys(process.env)};
fs.appendFileSync(new URL('./calls.jsonl',import.meta.url),JSON.stringify(capture)+'\\n');
const emit=value=>console.log(JSON.stringify(value));
emit({type:'thread.started',thread_id:'thread-'+process.pid});emit({type:'turn.started'});
if(prompt.includes('[SECRETARY_STATUS]')){emit({type:'item.completed',item:{id:'message',type:'agent_message',text:'사장님, 비둘기입니다. 제공된 현황을 확인했습니다.'}});emit({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}});process.exit(0);}
if(prompt.includes('fail-job')){emit({type:'turn.failed',error:{message:'선택한 모델을 사용할 수 없습니다.'}});process.exit(1);}
if(prompt.includes('remote-job')&&prompt.includes('[DEVELOPMENT_METHOD]')){emit({type:'item.completed',item:{id:'message',type:'agent_message',text:JSON.stringify({method:'direct',instruction:'원격 작업 수행',research:null})}});emit({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}});process.exit(0);}
if(prompt.includes('remote-job')){
  const finish=text=>{emit({type:'item.completed',item:{id:'message',type:'agent_message',text}});emit({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}});};
  if(args.some(arg=>arg.endsWith('codex-plan.schema.json'))){finish(JSON.stringify({agentId:'dev',instruction:'remote-job 작업'}));process.exit(0);}
  if(prompt.includes('[GOAL_REVIEW]')){finish(JSON.stringify({achieved:true,blocked:false,summary:'remote verification completed',nextInstruction:''}));process.exit(0);}
  if(prompt.includes('검토와 보고만 하세요')){finish(JSON.stringify({approved:true,summary:'remote verification completed',nextInstruction:''}));process.exit(0);}
  const response=await fetch(process.env.PX_REMOTE_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.PX_REMOTE_TOKEN},body:JSON.stringify({command:'printf remote-verification',directory:'/remote/project with spaces',sudo:true})});
  const result=await response.json();
  if(!response.ok){emit({type:'turn.failed',error:{message:result.error}});process.exit(1);}
  emit({type:'item.completed',item:{id:'message',type:'agent_message',text:result.stdout}});emit({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}});process.exit(0);
}

if(prompt.includes('[DEVELOPMENT_METHOD]')){emit({type:'item.completed',item:{id:'message',type:'agent_message',text:JSON.stringify({method:'direct',instruction:'artifact 파일을 생성하고 검증하세요.',research:null})}});emit({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}});process.exit(0);}
if(args.some(arg=>arg.endsWith('codex-analysis.schema.json'))){const source=path.join(prompt.match(/문서·프로젝트 폴더: ([^\\n]+)/)[1],'notes.md');const contents=fs.readFileSync(source,'utf8');fs.mkdirSync('.px-runtime',{recursive:true});fs.writeFileSync('.px-runtime/analysis-cache',contents);emit({type:'item.completed',item:{id:'message',type:'agent_message',text:JSON.stringify({documentType:'markdown',summary:contents,keyClaims:[contents],methods:[],results:[],sources:[source],findings:[{topic:'actual file',claim:contents,evidence:contents,source,locator:'line 1'}],tables:[],figures:[],equations:[],limitations:[]})}});emit({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}});process.exit(0);}
const plan=args.some(arg=>arg.endsWith('codex-plan.schema.json'));
const goalReview=prompt.includes('[GOAL_REVIEW]');
const report=prompt.includes('검토와 보고만 하세요');
if(!plan&&!report&&!goalReview)emit({type:'item.started',item:{id:'command',type:'command_execution',command:'node verify.mjs',status:'in_progress'}});
await new Promise(resolve=>setTimeout(resolve,prompt.includes('slow-job')?10000:180));
if(!plan&&!report&&!goalReview){fs.writeFileSync(path.join(process.cwd(),'artifact.txt'),'actual fixture file');emit({type:'item.completed',item:{id:'file',type:'file_change',changes:[{kind:'add',path:'artifact.txt'}]}});emit({type:'item.completed',item:{id:'command',type:'command_execution',command:'node verify.mjs',exit_code:0,aggregated_output:'verification passed'}});}
const achieved=!prompt.includes('현재 회차: 1');
emit({type:'item.completed',item:{id:'message',type:'agent_message',text:goalReview?JSON.stringify({achieved,blocked:false,summary:achieved?'파일 생성과 검증 완료':'파일 생성 완료, 추가 검증 필요',nextInstruction:achieved?'':'추가 검증 실행'}):plan?JSON.stringify({agentId:'dev',instruction:'artifact 파일 생성 개발 작업'}):report?JSON.stringify({approved:true,summary:'사장님, 개발노예가 artifact.txt를 만들고 검증했습니다.',nextInstruction:''}):'artifact.txt 생성, verification passed'}});
emit({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}});
`;

before(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'px-codex-test-')));
  workspace = path.join(root, 'project with spaces'); other = path.join(root, 'other');
  await mkdir(workspace); await mkdir(other); await mkdir(path.join(workspace, 'nested'));
  binary = path.join(root, 'codex'); await writeFile(binary, fixture); await chmod(binary, 0o755);
  const tailscale = path.join(root,'tailscale'), ssh = path.join(root,'ssh');
  await writeFile(tailscale,`#!/usr/bin/env node
console.log(JSON.stringify({BackendState:'Running',Self:{ID:'self'},Peer:{one:{ID:'remote-one',HostName:'remote-linux',OS:'linux',Online:true,TailscaleIPs:['100.88.10.2']},off:{ID:'offline-one',HostName:'offline-linux',OS:'linux',Online:false,TailscaleIPs:['100.88.10.3']}}}));
`);await chmod(tailscale,0o755);
  await writeFile(ssh,`#!/usr/bin/env node
import fs from 'node:fs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const args=process.argv.slice(2);fs.appendFileSync(new URL('./ssh-calls.jsonl',import.meta.url),JSON.stringify({args,input})+'\\n');
if(args.at(-1).includes('__PX_REMOTE__')) console.log('__PX_REMOTE__\\nremoteuser\\n/home/remoteuser');
else console.log('remote verification passed '+input.trim());
`);await chmod(ssh,0o755);
  const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, HOST:'127.0.0.1', PORT:String(port), DATA_DIR:path.join(root,'data'), OFFICE_EXECUTOR:'codex', CODEX_BIN:binary, TAILSCALE_BIN:tailscale, SSH_BIN:ssh, CODEX_WORKDIR:workspace, LLM_BASE_URL:'', OFFICE_PASSWORD:'', OPENAI_API_KEY:'must-not-inherit', CODEX_API_KEY:'must-not-inherit', CODEX_THREAD_ID:'must-not-inherit' }, stdio:['ignore','pipe','pipe'] });
  let output=''; server.stderr.on('data',chunk=>output+=chunk);
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw new Error(output);try{if((await request('auth')).status===200)return;}catch{}await sleep(20);}
  throw new Error('Startup timed out: '+output);
});
after(async () => {
  if(server?.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exited;}
  await rm(root,{recursive:true,force:true});
});

test('subscription login, per-agent settings, chief delegation and actual file/log results', async () => {
  const initial=(await request('state')).data;
  assert.equal(initial.mode,'codex'); assert.equal(initial.codex.ready,true); assert.equal(initial.codex.auth,'chatgpt');
  assert.deepEqual(initial.codex.permissions,{sandboxMode:'danger-full-access',approvalPolicy:'never'});
  assert.ok(initial.agents.every(agent=>agent.permissions.sandboxMode==='danger-full-access'&&agent.permissions.approvalPolicy==='never'));
  await request('agents/chief','PATCH',{profile:'sol',reasoningEffort:'high',fixedPrompt:'chief-fixed'});
  await request('agents/dev','PATCH',{profile:'terra',reasoningEffort:'max',fixedPrompt:'dev-fixed'});
  const created=await request('tasks','POST',{description:'개발 파일 생성',agentId:'chief',workingDirectory:workspace});assert.equal(created.status,201);
  const {task,state}=await poll(created.data.id);
  const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length,4);
  assert.ok(calls[0].args.includes('gpt-5.6-sol'));assert.ok(calls[0].args.includes('model_reasoning_effort="high"'));assert.ok(calls[0].args.includes('--output-schema'));
  assert.ok(calls[1].args.includes('gpt-5.6-terra'));assert.ok(calls[1].args.includes('model_reasoning_effort="max"'));
  for(const [index,call] of calls.entries()){assert.equal(call.cwd,task.codexRuns[index].directory);assert.equal(call.args[call.args.indexOf('--sandbox')+1],'danger-full-access');assert.ok(!call.args.includes('--ignore-user-config'));assert.ok(call.args.includes('model_provider="openai"'));assert.ok(call.args.includes('approval_policy="never"'));assert.ok(call.args.includes('forced_login_method="chatgpt"'));assert.ok(call.prompt.includes('[SKILL USAGE]'));assert.ok(!call.envKeys.includes('OPENAI_API_KEY'));assert.ok(!call.envKeys.includes('CODEX_API_KEY'));assert.ok(!call.envKeys.includes('CODEX_THREAD_ID'));}
  assert.ok(calls[1].prompt.includes('[AVAILABLE SKILLS]'));assert.ok(calls[2].prompt.includes('## python'));
  assert.ok(calls[0].prompt.includes('chief-fixed'));assert.ok(calls[3].prompt.includes('chief-fixed'));assert.ok(!calls[1].prompt.includes('chief-fixed'));assert.ok(calls[1].prompt.includes('dev-fixed'));
  assert.equal(await readFile(path.join(workspace,'artifact.txt'),'utf8'),'actual fixture file');
  assert.ok(task.result.includes('사장님'));assert.ok(task.workerResult.includes('verification passed'));assert.equal(task.codexRuns.length,4);assert.ok(task.codexRuns.every(run=>run.threadId&&run.usage));assert.ok(task.computerName);
  assert.ok(task.codexRuns.every(run=>run.sandboxMode==='danger-full-access'&&run.approvalPolicy==='never'));
  assert.ok(state.logs.some(log=>log.taskId===task.id&&log.message.includes('파일 변경')));assert.ok(state.logs.some(log=>log.taskId===task.id&&log.message.includes('verification passed')));assert.ok(state.agents.every(agent=>agent.status==='idle'));
});

test('a directly assigned writer receives an explicit installed skill request and its role skills',async()=>{
  const before=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').length;
  const created=await request('tasks','POST',{description:'$webppt 스킬로 발표 자료를 만들어주세요.',agentId:'writer',workingDirectory:other});
  assert.equal(created.status,201);const {task}=await poll(created.data.id);assert.equal(task.status,'done');
  const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).slice(before);
  const worker=calls.find(call=>call.args[call.args.indexOf('--sandbox')+1]==='danger-full-access');
  assert.ok(worker.prompt.includes('$webppt'));assert.ok(worker.prompt.includes('## writing'));assert.ok(worker.prompt.includes('## latex'));
  assert.ok(!worker.args.includes('--ignore-user-config'));assert.equal(await readFile(path.join(other,'artifact.txt'),'utf8'),'actual fixture file');
});

test('workers run directly in the selected folder with full file access', async () => {
  const old=(await request('state')).data.settings.workingDirectory;
  for(const directory of [homedir(),path.parse(workspace).root]){
    assert.equal((await request('settings','PATCH',{workingDirectory:directory})).status,200);
  }
  await request('settings','PATCH',{workingDirectory:old});
  assert.equal((await request('agents/misc','PATCH',{profile:'astra',reasoningEffort:'low'})).status,400);
  for(const agentId of ['dev','writer','format','misc']){
    const created=await request('tasks','POST',{description:'전체 접근 권한 실행 확인',agentId,workingDirectory:workspace});
    const {task}=await poll(created.data.id);
    assert.equal(task.codexRuns[0].agentId,agentId);assert.equal(task.codexRuns[0].sandboxMode,'danger-full-access');assert.equal(task.codexRuns[0].approvalPolicy,'never');
  }
  const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).filter(call=>!call.prompt.includes('[FINAL_REVIEW]')&&!call.prompt.includes('[DEVELOPER_REVIEW]')&&!call.prompt.includes('[DEVELOPMENT_METHOD]')).slice(-4);
  for(const call of calls){assert.equal(call.args[call.args.indexOf('--sandbox')+1],'danger-full-access');assert.ok(call.args.includes('approval_policy="never"'));assert.ok(call.prompt.includes('실제 파일'));
    assert.ok(!call.args.some(arg=>arg.startsWith('sandbox_workspace_write.')));
  }
  assert.ok(calls[3].args.includes('gpt-5.6-luna'));assert.ok(calls[3].args.includes('model_reasoning_effort="medium"'));
});

test('project overlap serializes file work while independent folders run in parallel', async () => {
  await request('settings','PATCH',{paused:true});
  const a=(await request('tasks','POST',{description:'first',agentId:'dev',workingDirectory:workspace})).data.id;
  const b=(await request('tasks','POST',{description:'nested',agentId:'writer',workingDirectory:path.join(workspace,'nested')})).data.id;
  const c=(await request('tasks','POST',{description:'independent',agentId:'misc',workingDirectory:other})).data.id;
  await request('settings','PATCH',{paused:false});
  const state=(await request('state')).data;
  assert.equal(state.tasks.find(task=>task.id===a).status,'running');assert.equal(state.tasks.find(task=>task.id===b).status,'queued');assert.equal(state.tasks.find(task=>task.id===c).status,'running');
  await Promise.all([a,b,c].map(id=>poll(id)));
});

test('explicit idle coworker assignments execute during chief work in the same starting folder',async()=>{
  const chief=await request('tasks','POST',{description:'chief concurrent verification',agentId:'chief'});
  assert.equal(chief.status,201);
  const worker=await request('tasks','POST',{description:'independent writing verification',agentId:'writer',requireIdle:true});
  assert.equal(worker.status,201);
  const current=(await request('state')).data;
  assert.equal(current.tasks.find(task=>task.id===chief.data.id).status,'running');
  assert.equal(current.tasks.find(task=>task.id===worker.data.id).status,'running');
  let writerBusy=false;
  for(let i=0;i<100;i++){
    const writer=(await request('state')).data.agents.find(agent=>agent.id==='writer');
    if(writer.activeTaskId===worker.data.id&&writer.phase==='coding'){writerBusy=true;break;}
    await sleep(10);
  }
  assert.ok(writerBusy,'writer must be executing before testing an idle-only assignment');
  assert.equal((await request('tasks','POST',{description:'duplicate writer',agentId:'writer',requireIdle:true})).status,409);
  await Promise.all([chief.data.id,worker.data.id].map(id=>poll(id)));
});

test('stop terminates the live Codex process before freeing the agent', async () => {
  const created=await request('tasks','POST',{description:'slow-job',agentId:'dev',workingDirectory:workspace});
  let pid;
  for(let i=0;i<100;i++){const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);pid=calls.find(call=>call.prompt.includes('slow-job')&&!call.prompt.includes('[DEVELOPMENT_METHOD]'))?.pid;if(pid)break;await sleep(20);}
  assert.ok(pid);assert.equal((await request('settings','PATCH',{executor:'demo'})).status,409);
  assert.equal((await request(`tasks/${created.data.id}/stop`,'POST',{})).status,200);
  const {state}=await poll(created.data.id,'stopped');assert.equal(state.agents.find(agent=>agent.id==='dev').status,'idle');
  assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});

test('a stopped request never starts a Codex process',async()=>{
  const before=await readFile(path.join(root,'calls.jsonl'),'utf8'),controller=new AbortController(),reason=new Error('Stop during preparation');
  controller.abort(reason);
  const pending=runCodex({binary,directory:workspace,model:'gpt-5.6-terra',reasoningEffort:'high',prompt:'abort-preparation-only',signal:controller.signal});
  await assert.rejects(pending,error=>error===reason);
  assert.equal(await readFile(path.join(root,'calls.jsonl'),'utf8'),before);
});

test('subscription Goal reviews use structured output and pass remaining work into the next execution', async () => {
  const before=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').length;
  const created=await request('goals','POST',{description:'artifact 개발 Goal',successCriteria:'파일 생성과 추가 검증',workingDirectory:workspace});assert.equal(created.status,201);
  let state,goal;
  for(let i=0;i<300;i++){state=(await request('state')).data;goal=state.goals.find(g=>g.id===created.data.id);if(goal.status==='done')break;await sleep(20);}
  assert.equal(goal.status,'done');assert.equal(goal.round,2);
  const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).slice(before);assert.equal(calls.length,10);
  for(const index of [4,9]){assert.ok(calls[index].args.some(arg=>arg.endsWith('codex-goal-review.schema.json')));assert.ok(calls[index].prompt.includes('chief-fixed'));assert.ok(calls[index].args.includes('gpt-5.6-sol'));assert.equal(calls[index].args[calls[index].args.indexOf('--sandbox')+1],'danger-full-access');}
  assert.ok(calls[5].prompt.includes('추가 검증 실행'));assert.ok(calls[5].prompt.includes('이전 회차 검토'));assert.ok(calls[6].prompt.includes('dev-fixed'));
  const letters=state.letters.filter(l=>l.goalId===goal.id);assert.equal(letters.length,2);assert.equal(letters[1].body,'파일 생성과 검증 완료');assert.equal(letters[1].goalOutcome,'done');
});
test('invalid folders and API-key login are rejected atomically; Codex failures stay visible', async () => {
  const old=(await request('state')).data;
  assert.equal((await request('tasks','POST',{description:'x',workingDirectory:'relative'})).status,400);
  assert.equal((await request('tasks','POST',{description:'x',workingDirectory:root+'/missing'})).status,400);
  assert.equal((await request('settings','PATCH',{executor:'demo',workingDirectory:'relative'})).status,400);
  assert.equal((await request('settings','PATCH',{executor:'api',baseUrl:''})).status,400);
  assert.equal((await request('settings','PATCH',{baseUrl:123})).status,400);
  assert.equal((await request('state')).data.mode,old.mode);
  const created=await request('tasks','POST',{description:'fail-job',agentId:'misc',workingDirectory:other});
  const {task}=await poll(created.data.id,'failed');assert.ok(task.error.includes('모델'));assert.equal(task.result,'');
  await writeFile(path.join(root,'api-login'),'');
  const status=await request('codex/status','POST',{});assert.equal(status.data.auth,'api-key');assert.equal(status.data.ready,false);
  assert.equal((await request('settings','PATCH',{executor:'codex'})).status,409);
  assert.equal((await request('tasks','POST',{description:'x'})).status,409);
  await rm(path.join(root,'api-login'));assert.equal((await request('codex/status','POST',{})).data.ready,true);
});

test('subscription usage reads account quota and authoritative reset count', async () => {
  const response = await request('codex/usage');
  assert.equal(response.status, 200);
  assert.equal(response.data.available, true);
  assert.equal(response.data.email, 'usage@example.test');
  assert.equal(response.data.windows[0].usedPercent, 23);
  assert.equal(response.data.windows[0].windowDurationMins, 300);
  assert.equal(response.data.resetsAvailable, 4);
  assert.deepEqual(response.data.resetCredits,[{expiresAt:1893456000},{expiresAt:null}]);
  assert.equal(JSON.stringify(response.data).includes('access_token'), false);
});

test('Codex discovery selects the newest version and respects an explicit binary', async () => {
  const dirs = [path.join(root, 'old-cli'), path.join(root, 'new-cli')];
  for (let i = 0; i < dirs.length; i++) {
    await mkdir(dirs[i]);
    const file = path.join(dirs[i], 'codex');
    await writeFile(file, `#!/bin/sh\necho codex-cli 999.${i}.0\n`);
    await chmod(file, 0o755);
  }
  const oldPath = process.env.PATH, oldBinary = process.env.CODEX_BIN;
  try {
    delete process.env.CODEX_BIN;
    process.env.PATH = dirs.join(path.delimiter);
    assert.equal(await findCodex(), path.join(dirs[1], 'codex'));
    process.env.CODEX_BIN = path.join(dirs[0], 'codex');
    assert.equal(await findCodex(), path.join(dirs[0], 'codex'));
  } finally {
    process.env.PATH = oldPath;
    if (oldBinary === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = oldBinary;
  }
});

test('remote targets use local Codex, SSH terminal and private sudo credentials', async () => {
  let list=(await request('computers')).data;
  assert.equal(list.computers.length,2);assert.equal(list.computers[0].online,true);
  assert.equal((await request('computers/remote-one','PATCH',{username:'bad;name',sudoPassword:'secret-remote-test'})).status,400);
  const saved=await request('computers/remote-one','PATCH',{username:'remoteuser',sudoPassword:'secret-remote-test'});
  assert.equal(saved.status,200);assert.equal(saved.data.computer.hasSudoPassword,true);
  assert.equal(JSON.stringify(saved.data).includes('secret-remote-test'),false);
  const connected=await request('computers/remote-one/connect','POST',{});
  assert.equal(connected.status,200);assert.equal(connected.data.computer.homeDirectory,'/home/remoteuser');
  assert.equal((await request('tasks','POST',{description:'remote-job',agentId:'misc',machineId:'offline-one'})).status,409);
  const created=await request('tasks','POST',{description:'remote-job',agentId:'misc',machineId:'remote-one',remoteDirectory:'/remote/project with spaces'});
  assert.equal(created.status,201);
  const {task,state}=await poll(created.data.id);
  assert.equal(task.machineId,'remote-one');assert.equal(task.remoteDirectory,'/remote/project with spaces');
  assert.ok(task.codexRuns[0].directory.includes('px-remote-proxy-'));
  assert.ok(task.result.includes('remote verification passed'));assert.ok(task.result.includes('[비밀번호 숨김]'));
  const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(calls.at(-1).prompt.includes('원격 컴퓨터에서 Codex 실행·설치 금지'));
  assert.ok(!calls.at(-1).prompt.includes('secret-remote-test'));
  const sshCalls=(await readFile(path.join(root,'ssh-calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(sshCalls.at(-1).args.includes('remoteuser@100.88.10.2'));
  const sudoCall=sshCalls.find(call=>call.args.at(-1).includes('sudo -S')&&call.args.at(-1).includes('remote-verification'));assert.ok(sudoCall);
  assert.equal(sudoCall.input,'secret-remote-test\n');
  assert.equal(JSON.stringify(state).includes('secret-remote-test'),false);
  assert.equal(JSON.stringify((await request('export')).data).includes('secret-remote-test'),false);
  assert.equal((await request(`tasks/${task.id}/terminal`,'POST',{command:'pwd'})).status,403);
  const next=await request('tasks','POST',{description:'remote-job next',parentTaskId:task.id,agentId:'misc'});
  assert.equal(next.status,201);const {task:continued}=await poll(next.data.id);assert.equal(continued.machineId,task.machineId);
  const goal=await request('goals','POST',{description:'remote-job goal',parentTaskId:continued.id});assert.equal(goal.status,201);
  const {task:round,state:goalState}=await poll(goal.data.taskId);assert.equal(round.machineId,task.machineId);
  assert.equal(goalState.goals.find(item=>item.id===goal.data.id).status,'done');
  assert.ok(round.codexRuns.every(run=>run.directory.includes('px-remote-proxy-')));
});

test('computer offices reserve agents separately and isolate history, controls and model settings',async()=>{
  const localAgent=(await request('state')).data.agents.find(a=>a.id==='chief');
  assert.equal((await request('agents/chief','PATCH',{officeId:'remote-one',profile:'luna',reasoningEffort:'high'})).status,200);
  assert.equal((await request('state')).data.agents.find(a=>a.id==='chief').profile,localAgent.profile);
  assert.equal((await request('agents/chief','PATCH',{officeId:'missing-office',profile:'luna'})).status,404);
  const local=await request('tasks','POST',{description:'local office parallel verification',agentId:'chief',requireIdle:true});
  const remote=await request('tasks','POST',{description:'remote-job separate office',agentId:'chief',machineId:'remote-one',remoteDirectory:'/remote/project with spaces',requireIdle:true});
  assert.equal(local.status,201);assert.equal(remote.status,201);
  const current=(await request('state')).data;
  assert.equal(current.offices.local.agents.find(a=>a.id==='chief').activeTaskId,local.data.id);
  assert.equal(current.offices['remote-one'].agents.find(a=>a.id==='chief').activeTaskId,remote.data.id);
  assert.equal((await request('tasks','POST',{description:'remote duplicate',agentId:'chief',machineId:'remote-one',requireIdle:true})).status,409);
  assert.equal((await request('stop-all','POST',{officeId:'remote-one'})).status,200);
  await poll(remote.data.id,'stopped');
  const localResult=await poll(local.data.id);assert.equal(localResult.task.status,'done');
  let snapshot=(await request('state')).data;assert.equal(snapshot.offices.local.paused,false);assert.equal(snapshot.offices['remote-one'].paused,true);
  assert.equal((await request('settings','PATCH',{officeId:'remote-one',paused:false})).status,200);
  const localView=(await request('state?officeId=local')).data;
  const remoteView=(await request('state?officeId=remote-one')).data;
  assert.ok(localView.tasks.some(t=>t.id===local.data.id));assert.ok(!localView.tasks.some(t=>t.id===remote.data.id));
  assert.ok(remoteView.tasks.some(t=>t.id===remote.data.id));assert.ok(!remoteView.tasks.some(t=>t.id===local.data.id));
  assert.ok(remoteView.letters.every(letter=>remoteView.tasks.some(task=>task.id===letter.taskId)));
  assert.equal((await request('letters/read-all','POST',{officeId:'remote-one'})).status,200);
  snapshot=(await request('state')).data;
  assert.ok(snapshot.letters.find(letter=>letter.taskId===remote.data.id).readAt);
  assert.equal(snapshot.letters.find(letter=>letter.taskId===local.data.id).readAt,null);
  const remoteRetry=await request('tasks','POST',{description:'remote-job completed separate office',agentId:'chief',machineId:'remote-one',remoteDirectory:'/remote/project with spaces'});
  assert.equal(remoteRetry.status,201);const {task:done}=await poll(remoteRetry.data.id);
  assert.equal(done.status,'done');assert.equal(done.codexRuns[0].model,'gpt-5.6-luna');
});

test('owner secretary uses fixed Luna Medium and full file access without chief control',async()=>{
  const before=(await request('state')).data.agents.find(a=>a.id==='secretary');
  assert.equal(before.ownerOnly,true);assert.equal(before.reportsTo,null);
  assert.equal((await request('agents/secretary','PATCH',{profile:'sol',reasoningEffort:'high'})).status,400);
  const captures=async()=> (await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  const offset=(await captures()).length;
  const response=await request('secretary','POST',{question:'호문클루스 진행 상황 어때?'});
  assert.equal(response.status,200);assert.match(response.data.answer,/비둘기/);
  assert.equal(response.data.model,'gpt-5.6-luna');assert.equal(response.data.reasoningEffort,'medium');
  const call=(await captures())[offset];
  assert.equal(call.args[call.args.indexOf('--sandbox')+1],'danger-full-access');assert.ok(call.args.includes('gpt-5.6-luna'));assert.ok(call.args.includes('model_reasoning_effort="medium"'));
  assert.match(call.prompt,/다른 에이전트를 배정·중지·제어/);assert.ok(!call.envKeys.includes('PX_REMOTE_TOKEN'));
  assert.equal((await request('tasks','POST',{description:'비둘기 작업',agentId:'secretary'})).status,400);
  await request('agents/secretary','PATCH',{profile:before.profile,reasoningEffort:before.reasoningEffort});
});

test('remote account and sudo credentials persist across server restart without exposure', async () => {
  const saved=await Promise.all([
    request('computers/remote-one','PATCH',{username:'remoteuser',sudoPassword:'secret-remote-test'}),
    request('computers/offline-one','PATCH',{username:'offlineuser',sudoPassword:'second-test-secret'}),
  ]);
  assert.ok(saved.every(result=>result.status===200));
  await sleep(80);
  const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exited;
  server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:new URL(base).port,DATA_DIR:path.join(root,'data'),OFFICE_EXECUTOR:'codex',CODEX_BIN:binary,TAILSCALE_BIN:path.join(root,'tailscale'),SSH_BIN:path.join(root,'ssh'),CODEX_WORKDIR:workspace,LLM_BASE_URL:'',OFFICE_PASSWORD:''},stdio:['ignore','pipe','pipe']});
  let ready=false;for(let i=0;i<150;i++){try{if((await request('auth')).status===200){ready=true;break;}}catch{}await sleep(20);}assert.ok(ready);
  let computer=(await request('computers')).data.computers.find(item=>item.id==='remote-one');
  assert.equal(computer.username,'remoteuser');assert.equal(computer.hasSudoPassword,true);assert.equal(computer.homeDirectory,'/home/remoteuser');
  const secretFile=path.join(root,'data','secrets.json'),stored=JSON.parse(await readFile(secretFile,'utf8'));
  assert.equal(stored.remoteMachines['remote-one'].sudoPassword,'secret-remote-test');assert.equal((await stat(secretFile)).mode&0o777,0o600);
  assert.equal(stored.remoteMachines['offline-one'].sudoPassword,'second-test-secret');
  assert.equal((await request('state')).data.offices['remote-one'].agents.find(a=>a.id==='chief').profile,'luna');
  assert.equal((await request('computers')).data.computers.find(item=>item.id==='offline-one').username,'offlineuser');
  assert.equal((await request('computers/remote-one','PATCH',{username:'remoteuser'})).status,200);
  computer=(await request('computers')).data.computers.find(item=>item.id==='remote-one');assert.equal(computer.hasSudoPassword,true);
  assert.equal((await request('computers/remote-one','PATCH',{username:'remoteuser',clearSudoPassword:true})).status,200);
  computer=(await request('computers')).data.computers.find(item=>item.id==='remote-one');assert.equal(computer.hasSudoPassword,false);
});


test('office deletion stops only its work, stays deleted across discovery/restart and reconnect creates a fresh office',async()=>{
  assert.equal((await request('computers/remote-one','PATCH',{username:'remoteuser',sudoPassword:'secret-remote-test'})).status,200);
  assert.equal((await request('computers/remote-one/connect','POST',{})).status,200);
  assert.ok((await request('state')).data.officeTabs.includes('remote-one'));
  const local=await request('tasks','POST',{description:'slow-job retained local office',agentId:'misc'});assert.equal(local.status,201);
  const remote=await request('tasks','POST',{description:'remote-job office deletion',agentId:'chief',machineId:'remote-one',remoteDirectory:'/remote/project with spaces'});assert.equal(remote.status,201);
  assert.equal((await request('offices/remote-one','DELETE')).status,200);
  let state=(await request('state')).data;
  assert.ok(!state.offices['remote-one']);assert.ok(!state.officeTabs.includes('remote-one'));
  assert.ok(state.deletedOffices['remote-one']);assert.ok(!state.tasks.some(task=>task.machineId==='remote-one'));
  assert.ok(!state.letters.some(letter=>letter.machineId==='remote-one'));
  assert.equal(state.tasks.find(task=>task.id===local.data.id).status,'running');
  assert.equal((await request('computers')).status,200);assert.ok(!(await request('state')).data.offices['remote-one']);
  assert.equal((await request('offices/remote-one/open','POST',{})).status,404);
  assert.equal((await request('tasks','POST',{description:'deleted office work',agentId:'chief',machineId:'remote-one'})).status,409);
  await request(`tasks/${local.data.id}/stop`,'POST',{});await poll(local.data.id,'stopped');
  const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exited;
  server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:new URL(base).port,DATA_DIR:path.join(root,'data'),OFFICE_EXECUTOR:'codex',CODEX_BIN:binary,TAILSCALE_BIN:path.join(root,'tailscale'),SSH_BIN:path.join(root,'ssh'),CODEX_WORKDIR:workspace,LLM_BASE_URL:'',OFFICE_PASSWORD:''},stdio:['ignore','pipe','pipe']});
  let ready=false;for(let i=0;i<150;i++){try{if((await request('auth')).status===200){ready=true;break;}}catch{}await sleep(20);}assert.ok(ready);
  await request('computers');state=(await request('state')).data;
  assert.ok(!state.offices['remote-one']);assert.ok(!state.officeTabs.includes('remote-one'));
  assert.equal((await request('computers/remote-one/connect','POST',{})).status,200);
  state=(await request('state')).data;assert.ok(state.offices['remote-one']);assert.ok(state.officeTabs.includes('remote-one'));assert.ok(!state.deletedOffices['remote-one']);
  assert.equal(state.offices['remote-one'].agents.find(agent=>agent.id==='chief').profile,state.agents.find(agent=>agent.id==='chief').profile);
  assert.ok(!state.tasks.some(task=>task.machineId==='remote-one'));
  assert.equal((await request('computers')).data.computers.find(item=>item.id==='remote-one').hasSudoPassword,true);
});


test('department speed applies to every member and Codex toggles back to Normal', async () => {
  assert.equal((await request('departments/'+encodeURIComponent('개발부서')+'/speed','PATCH',{fastMode:'yes'})).status,400);
  for (const fastMode of [true, false]) {
    assert.equal((await request('departments/'+encodeURIComponent('개발부서')+'/speed','PATCH',{fastMode})).status,200);
    const state=(await request('state')).data;
    assert.ok(state.agents.filter(a=>a.department==='개발부서').every(a=>a.fastMode===fastMode));
    assert.notEqual(state.agents.find(a=>a.id==='writer').fastMode,true);
    const created=await request('tasks','POST',{description:'speed verification',agentId:'dev',workingDirectory:workspace});
    assert.equal(created.status,201);
    const {task}=await poll(created.data.id);
    assert.equal(task.codexRuns[0].fastMode,fastMode);
    const calls=(await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    const call=calls.at(-1);
    assert.ok(call.args.includes(`features.fast_mode=${fastMode}`));
    assert.ok(call.args.includes(`service_tier="${fastMode?'fast':'default'}"`));
  }
});

test('Analyzer reads documents and creates image caches in the real working folder',async()=>{
 await writeFile(path.join(workspace,'notes.md'),'original analysis evidence');const created=await request('tasks','POST',{agentId:'analyzer',description:'notes.md 문서 분석',workingDirectory:workspace});assert.equal(created.status,201);const {task}=await poll(created.data.id);assert.equal(task.validation.status,'PASS');assert.ok(task.result.includes('original analysis evidence'));assert.equal(await readFile(path.join(workspace,'notes.md'),'utf8'),'original analysis evidence');const run=task.codexRuns[0];assert.equal(run.agentId,'analyzer');assert.equal(run.readOnly,true);assert.equal(run.sandboxMode,'danger-full-access');assert.equal(run.directory,workspace);assert.ok((await stat(run.directory)).isDirectory());
});
test('an explicit project path in the request resolves the default home directory without copying home',async()=>{
 const previous=(await request('state')).data.settings.workingDirectory;try{await request('settings','PATCH',{workingDirectory:homedir()});const created=await request('tasks','POST',{agentId:'dev',description:`"${workspace}" 폴더에서 artifact 파일을 만들어줘`});assert.equal(created.status,201);const {task}=await poll(created.data.id);assert.equal(task.workingDirectory,workspace);assert.equal(task.validation.status,'PASS');assert.ok(task.codexRuns.every(run=>run.directory!==homedir()));}finally{await request('settings','PATCH',{workingDirectory:previous});}
});
