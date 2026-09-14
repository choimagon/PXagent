import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

let child, data, port, base, mock, mockPort;
const mockCalls = [];
const mockMessages = [];
let goalReviews = [];
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function start(extra={}) {
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,OFFICE_EXECUTOR:'demo',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:data,DEMO_STEP_MS:'40',LLM_BASE_URL:'',LLM_API_KEY:'',MODEL_HIGH:'',MODEL_BALANCED:'',MODEL_FAST:'',MODEL_LUNA:'',MODEL_TERRA:'',MODEL_SOL:'',MODEL_ASTRA:'',OFFICE_PASSWORD:'',...extra},stdio:['ignore','pipe','pipe','ipc']});
  child.on('message',message=>{
    if(message?.type==='secret-request')child.send({type:'secret-response',id:message.id,value:message.operation==='encrypt'?Buffer.from(message.value).toString('base64'):Buffer.from(message.value,'base64').toString('utf8')});
  });
  let output=''; child.stderr.on('data',d=>{output+=d;});
  for(let i=0;i<400;i++) {
    if(child.exitCode!==null) throw new Error(`Server exited: ${output}`);
    try {const res=await fetch(base+'/api/auth');if(res.ok)return;}catch{}
    await sleep(20);
  }
  throw new Error('Server startup timed out '+output);
}
async function stop() { if(!child||child.exitCode!==null)return; const ended=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await ended; }
async function request(route,method='GET',body,headers={}) {
  const response=await fetch(base+'/api/'+route,{method,headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
async function poll(id,expected='done') {
  for(let i=0;i<200;i++){const s=(await request('state')).data;const t=s.tasks.find(t=>t.id===id);if(t?.status===expected)return {task:t,state:s};await sleep(20);}
  throw new Error(`Task did not reach ${expected}`);
}
async function pollGoal(id, expected='done') {
  const deadline=Date.now()+60_000;
  let latest;
  while(Date.now()<deadline){const state=(await request('state')).data;const goal=state.goals.find(g=>g.id===id);latest=goal;if(goal?.status===expected&&!state.tasks.some(t=>t.goalId===id&&['running','reviewing'].includes(t.status)))return {goal,state};await sleep(20);}
  throw new Error(`Goal did not reach ${expected}: ${JSON.stringify(latest)}`);
}
before(async()=>{
  data=await mkdtemp(path.join(tmpdir(),'px-office-test-'));
  const probe=http.createServer(); await new Promise(r=>probe.listen(0,'127.0.0.1',r)); port=probe.address().port;await new Promise(r=>probe.close(r)); base=`http://127.0.0.1:${port}`;
  mock=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    const input=JSON.parse(body);
    assert.equal(req.url,'/v1/chat/completions');
    assert.equal(req.headers.authorization,'Bearer secret-test-key');
    assert.ok(['local-luna','local-terra','local-sol','local-astra'].includes(input.model));
    assert.ok(['none','low','medium','high','xhigh','max'].includes(input.reasoning_effort));
    mockCalls.push({ model: input.model, effort: input.reasoning_effort });
    mockMessages.push(input.messages);
    const review=input.messages[0].content.includes('[GOAL_REVIEW]');
    const plan=!review&&input.messages[0].content.includes('[PLANNING_GRAPH]');
    const assessment=review?(goalReviews.shift()||{achieved:true,blocked:false,summary:'실제 검증을 완료했습니다.',nextInstruction:''}):null;
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:review?(typeof assessment==='string'?assessment:JSON.stringify(assessment)):plan?JSON.stringify({agentId:'dev',instruction:'코드 구조를 검토해주세요.'}):'실제 API 응답을 통한 검토 결과입니다.'}}]}));
  }); await new Promise(r=>mock.listen(0,'127.0.0.1',r));mockPort=mock.address().port;
  await start();
});
after(async()=>{await stop();await new Promise(r=>mock.close(r));await rm(data,{recursive:true,force:true});});

test('all nine agents begin idle; machine identity and local assets are available',async()=>{
  const r=await request('state');assert.equal(r.status,200);assert.equal(r.data.agents.length,9);assert.equal(r.data.mode,'demo');assert.ok(r.data.computer.name);assert.ok(r.data.agents.every(a=>a.status==='idle'));
  for(const file of ['index.html','app.js','office.js','sprites.js','styles.css','assets/Galmuri11.woff2'])assert.equal((await fetch(base+'/'+file)).status,200,file);
});
test('chief delegates a development task and reports; states converge to idle',async()=>{
  const r=await request('tasks','POST',{description:'API 서버 개발 구조 검토',agentId:'chief'});assert.equal(r.status,201);
  const {task,state}=await poll(r.data.id);assert.ok(task.result.includes('호문클루스'));assert.ok(task.result.includes('개발노예'));assert.equal(task.progress,100);assert.equal(task.runMode,'demo');assert.ok(state.agents.every(a=>a.status==='idle'));
});
test('direct agents run in parallel while their own queues serialize',async()=>{
  await request('settings','PATCH',{paused:true});
  const ids=[];
  for(const agentId of ['dev','dev','writer'])ids.push((await request('tasks','POST',{description:'병렬 작업 테스트 '+agentId,agentId})).data.id);
  await request('settings','PATCH',{paused:false});
  const s=(await request('state')).data;
  assert.equal(s.tasks.find(t=>t.id===ids[0]).status,'running');assert.equal(s.tasks.find(t=>t.id===ids[1]).status,'queued');assert.equal(s.tasks.find(t=>t.id===ids[2]).status,'running');
  await Promise.all(ids.map(id=>poll(id)));
});
test('stop aborts work; retry completes; queue pause preserves pending work',async()=>{
  const r=await request('tasks','POST',{description:'취소 테스트',agentId:'misc'});
  assert.equal((await request(`tasks/${r.data.id}/stop`,'POST',{})).status,200);await poll(r.data.id,'stopped');
  await request('settings','PATCH',{paused:true});await request(`tasks/${r.data.id}/retry`,'POST',{});
  assert.equal((await request('state')).data.tasks.find(t=>t.id===r.data.id).status,'queued');
  await request('settings','PATCH',{paused:false});await poll(r.data.id);
});
test('model edits persist, invalid edits are rejected, and cross-site mutation is blocked',async()=>{
  assert.equal((await request('agents/dev','PATCH',{profile:'sol',reasoningEffort:'high'})).status,200);
  assert.equal((await request('agents/dev','PATCH',{profile:'invalid'})).status,400);
  assert.equal((await request('tasks','POST',{description:''})).status,400);
  assert.equal((await request('tasks','POST',{description:'x',agentId:'nope'})).status,400);
  assert.equal((await request('settings','PATCH',{baseUrl:'https://example.com/v1',models:{luna:12}})).status,400);
  assert.equal((await request('state')).data.settings.baseUrl,'');
  assert.equal((await request('tasks','POST',{description:'cross-site'}, {Origin:'https://evil.example'})).status,403);
});
test('reasoning options respect model support and invalid updates are atomic',async()=>{
  await request('agents/format','PATCH',{profile:'luna',reasoningEffort:'none'});
  assert.equal((await request('agents/format','PATCH',{profile:'astra',reasoningEffort:'none'})).status,400);
  let agent=(await request('state')).data.agents.find(a=>a.id==='format');
  assert.equal(agent.profile,'luna');assert.equal(agent.reasoningEffort,'none');
  assert.equal((await request('agents/format','PATCH',{profile:'astra'})).status,200);
  agent=(await request('state')).data.agents.find(a=>a.id==='format');
  assert.equal(agent.profile,'astra');assert.equal(agent.reasoningEffort,'medium');
  assert.equal((await request('agents/format','PATCH',{reasoningEffort:'ultra'})).status,400);
  assert.equal((await request('agents/format','PATCH',{profile:'sol',prompt:''})).status,400);
  assert.equal((await request('state')).data.agents.find(a=>a.id==='format').profile,'astra');
});
test('API mode calls real endpoint for chief plan, worker result and final report; no secret leaks',async()=>{
  const r=await request('settings','PATCH',{executor:'api',baseUrl:`http://127.0.0.1:${mockPort}/v1`,apiKey:'secret-test-key',models:{luna:'local-luna',terra:'local-terra',sol:'local-sol',astra:'local-astra'}});assert.equal(r.status,200);
  await request('agents/chief','PATCH',{profile:'astra',reasoningEffort:'max',fixedPrompt:'chief-fixed: 한국어로 간결하게 보고하세요.'});
  await request('agents/dev','PATCH',{profile:'luna',reasoningEffort:'low',fixedPrompt:'dev-fixed: 코드 검증 방법을 함께 제시하세요.'});
  mockCalls.length=0;
  mockMessages.length=0;
  const t=await request('tasks','POST',{description:'개발 작업 계획',agentId:'chief'});const result=await poll(t.data.id);
  assert.deepEqual(mockCalls,[{model:'local-astra',effort:'max'},{model:'local-luna',effort:'low'},{model:'local-luna',effort:'low'},{model:'local-astra',effort:'max'}]);
  assert.ok(mockMessages[0][0].content.includes('chief-fixed:'));
  assert.ok(mockMessages[3][0].content.includes('chief-fixed:'));
  assert.ok(mockMessages[1][0].content.includes('dev-fixed:'));
  assert.ok(!mockMessages[1][0].content.includes('chief-fixed:'));
  assert.ok(!mockMessages[0][0].content.includes('dev-fixed:'));
  assert.equal(result.task.runMode,'api');assert.ok(result.task.result.includes('실제 API 응답'));
  assert.equal(result.state.settings.hasApiKey,true);assert.ok(!JSON.stringify(result.state).includes('secret-test-key'));
  const backup=await request('export');assert.ok(!JSON.stringify(backup.data).includes('secret-test-key'));
  await request('settings','PATCH',{executor:'demo',baseUrl:''});
  await request('agents/dev','PATCH',{profile:'sol',reasoningEffort:'high'});
});
test('server restart preserves tasks and model preferences',async()=>{
  const old=(await request('state')).data;await stop();await start();const current=(await request('state')).data;
  assert.equal(current.tasks.length,old.tasks.length);assert.equal(current.agents.find(a=>a.id==='dev').profile,'sol');
  const saved=JSON.parse(await readFile(path.join(data,'office.json'),'utf8'));assert.equal(saved.tasks.length,current.tasks.length);
  assert.equal(current.agents.find(a=>a.id==='dev').reasoningEffort,'high');
  assert.equal(current.agents.find(a=>a.id==='chief').reasoningEffort,'max');
  assert.equal(current.agents.find(a=>a.id==='chief').fixedPrompt,'chief-fixed: 한국어로 간결하게 보고하세요.');
  assert.equal(current.agents.find(a=>a.id==='dev').fixedPrompt,'dev-fixed: 코드 검증 방법을 함께 제시하세요.');
});
test('fixed prompts can be cleared and invalid edits preserve existing settings',async()=>{
  const original=(await request('state')).data.agents.find(a=>a.id==='dev');
  assert.equal((await request('agents/dev','PATCH',{profile:'terra',fixedPrompt:'x'.repeat(12001)})).status,400);
  assert.equal((await request('agents/dev','PATCH',{fixedPrompt:123})).status,400);
  let current=(await request('state')).data.agents.find(a=>a.id==='dev');
  assert.equal(current.profile,original.profile);assert.equal(current.fixedPrompt,original.fixedPrompt);assert.equal(current.prompt,original.prompt);
  assert.equal((await request('agents/dev','PATCH',{fixedPrompt:''})).status,200);
  current=(await request('state')).data.agents.find(a=>a.id==='dev');assert.equal(current.fixedPrompt,'');assert.equal(current.prompt,original.prompt);
});
test('Goal continues after partial completion and delivers a separate report per round',async()=>{
  const created=await request('goals','POST',{description:'개발 Goal 반복 실행',successCriteria:'파일 생성과 검증 완료'});assert.equal(created.status,201);
  const {goal,state}=await pollGoal(created.data.id);
  assert.equal(goal.round,2);assert.equal(goal.consecutiveFailures,0);assert.equal(goal.successCriteria,'파일 생성과 검증 완료');
  const rounds=state.tasks.filter(t=>t.goalId===goal.id);assert.equal(rounds.length,2);assert.ok(rounds.every(t=>t.agentId==='chief'&&t.status==='done'));
  assert.ok(rounds[1].description.includes('남은 데모 작업'));assert.ok(rounds[1].description.includes('이전 회차 검토'));
  const letters=state.letters.filter(l=>l.goalId===goal.id);assert.equal(letters.length,2);assert.ok(letters[0].subject.includes('1차 진행 보고'));assert.ok(letters[1].subject.includes('Goal 달성'));assert.ok(letters.every(l=>l.senderId==='chief'&&!l.readAt));
  assert.equal((await request(`tasks/${rounds[0].id}/retry`,'POST',{})).status,409);
});
test('mail read state persists and retry adds a letter without overwriting the old report',async()=>{
  const original=(await request('state')).data.letters.find(l=>!l.goalId&&l.status==='done');assert.ok(original);
  const body=original.body;
  assert.equal((await request(`letters/${original.id}`,'PATCH',{read:'yes'})).status,400);
  assert.equal((await request(`letters/${original.id}`,'PATCH',{read:true})).status,200);
  await request(`tasks/${original.taskId}/retry`,'POST',{});await poll(original.taskId);
  let state=(await request('state')).data;
  assert.equal(state.letters.filter(l=>l.taskId===original.taskId).length,2);assert.equal(state.letters.find(l=>l.id===original.id).body,body);assert.ok(state.letters.find(l=>l.id===original.id).readAt);
  await stop();await start();state=(await request('state')).data;assert.ok(state.letters.find(l=>l.id===original.id).readAt);
  await request(`letters/${original.id}`,'PATCH',{read:false});assert.equal((await request('state')).data.letters.find(l=>l.id===original.id).readAt,null);
  await request('letters/read-all','POST',{});assert.ok((await request('state')).data.letters.every(l=>l.readAt));
});
test('automatic settings ignore stale edits while preserving complete prompts',async()=>{
  const current=(await request('state')).data.agents.find(a=>a.id==='dev');
  const latest={profile:'terra',reasoningEffort:'high',prompt:'자동 저장 역할',fixedPrompt:'자동 저장 고정 지침',editSession:'test-session',editRevision:2};
  assert.equal((await request('agents/dev','PATCH',latest)).status,200);
  const stale=await request('agents/dev','PATCH',{...latest,profile:'luna',fixedPrompt:'stale',editRevision:1});assert.equal(stale.data.ignored,true);
  const saved=(await request('state')).data.agents.find(a=>a.id==='dev');assert.equal(saved.profile,'terra');assert.equal(saved.prompt,latest.prompt);assert.equal(saved.fixedPrompt,latest.fixedPrompt);
  assert.equal((await request('agents/dev','PATCH',{editSession:'test-session',editRevision:0})).status,400);
  await request('agents/dev','PATCH',current);
  assert.equal((await request('goals','POST',{description:''})).status,400);assert.equal((await request('goals','POST',{description:'x',successCriteria:123})).status,400);
  assert.equal((await request('goals','POST',{description:'x'},{Origin:'https://evil.example'})).status,403);
});
test('Goal stop and resume preserve history; stopping an old round cannot stop its new round',async()=>{
  await request('settings','PATCH',{paused:true});
  const created=await request('goals','POST',{description:'중지 재개 Goal'});
  await request(`goals/${created.data.id}/stop`,'POST',{});let {goal,state}=await pollGoal(created.data.id,'stopped');assert.equal(state.tasks.find(t=>t.id===created.data.taskId).status,'stopped');
  assert.equal((await request(`goals/${goal.id}/resume`,'POST',{})).status,200);
  assert.equal((await request(`tasks/${created.data.taskId}/stop`,'POST',{})).status,409);
  goal=(await request('state')).data.goals.find(g=>g.id===goal.id);assert.equal(goal.status,'queued');assert.equal(goal.round,2);
  await request('settings','PATCH',{paused:false});await pollGoal(goal.id);
  const active=await request('goals','POST',{description:'실행 중 Goal 중지'});
  await request(`goals/${active.data.id}/stop`,'POST',{});({goal,state}=await pollGoal(active.data.id,'stopped'));assert.ok(state.agents.every(a=>a.status==='idle'));assert.equal(goal.round,1);
  assert.ok(state.letters.some(l=>l.goalId===goal.id&&l.goalOutcome==='stopped'));
});
test('Goal stops after three consecutive failures, resets failures on progress and has no round limit',async()=>{
  await request('settings','PATCH',{executor:'api',baseUrl:`http://127.0.0.1:${mockPort}/v1`});
  const blocked={achieved:false,blocked:true,summary:'의존성을 확인하지 못했습니다.',nextInstruction:''};
  const partial={achieved:false,blocked:false,summary:'일부 검증을 완료했습니다.',nextInstruction:'남은 검증을 실행하세요.'};
  goalReviews=[blocked,blocked,blocked];
  const failed=await request('goals','POST',{description:'연속 실패 Goal'});let {goal,state}=await pollGoal(failed.data.id,'blocked');assert.equal(goal.round,3);assert.equal(goal.consecutiveFailures,3);assert.equal(state.tasks.filter(t=>t.goalId===goal.id).length,3);assert.ok(state.letters.find(l=>l.goalId===goal.id&&l.goalOutcome==='blocked').subject.includes('진행 중단'));
  goalReviews=[blocked,blocked,partial,partial,{achieved:true,blocked:false,summary:'남은 검증까지 완료했습니다.',nextInstruction:''}];
  await request(`goals/${goal.id}/resume`,'POST',{});({goal,state}=await pollGoal(goal.id));assert.equal(goal.round,8);assert.equal(goal.consecutiveFailures,0);assert.equal(state.letters.filter(l=>l.goalId===goal.id).length,8);
  goalReviews=['invalid JSON','invalid JSON','invalid JSON'];
  const invalid=await request('goals','POST',{description:'잘못된 검토 Goal'});({goal,state}=await pollGoal(invalid.data.id,'blocked'));assert.equal(goal.round,3);assert.ok(state.tasks.filter(t=>t.goalId===goal.id).every(t=>t.status==='failed'));assert.ok(goal.lastSummary.includes('해석할 수 없습니다'));
  await request('settings','PATCH',{executor:'demo',baseUrl:''});
});
test('restart stops pending Goals and preserves report letters without duplicating them',async()=>{
  await request('settings','PATCH',{paused:true});const created=await request('goals','POST',{description:'서버 재시작 Goal'});
  const old=(await request('state')).data;await stop();await start();let state=(await request('state')).data;
  assert.equal(state.goals.find(g=>g.id===created.data.id).status,'stopped');assert.equal(state.tasks.find(t=>t.id===created.data.taskId).status,'stopped');assert.equal(state.letters.length,old.letters.length+1);assert.ok(state.letters.some(l=>l.goalId===created.data.id&&l.goalOutcome==='stopped'));
  await stop();await start();assert.equal((await request('state')).data.letters.length,state.letters.length);
  await request(`goals/${created.data.id}/resume`,'POST',{});await pollGoal(created.data.id);
});
test('legacy preferences and custom model IDs migrate without losing tasks or logs',async()=>{
  const old=(await request('state')).data;await stop();
  old.settings.models={high:'old-custom-strong',balanced:'old-custom-balanced',fast:'old-custom-fast'};
  old.agents[0].profile='balanced';old.agents[1].profile='high';old.agents[2].profile='fast';
  for(const agent of old.agents) { delete agent.reasoningEffort; delete agent.fixedPrompt; }
  await writeFile(path.join(data,'office.json'),JSON.stringify(old));await start();
  const current=(await request('state')).data;
  assert.equal(current.tasks.length,old.tasks.length);assert.equal(current.logs.length,old.logs.length);
  assert.equal(current.agents[0].profile,'terra');assert.equal(current.agents[1].profile,'luna');assert.equal(current.agents[2].profile,'luna');
  assert.equal(current.settings.models.sol,'old-custom-strong');assert.equal(current.settings.models.terra,'old-custom-balanced');assert.equal(current.settings.models.luna,'old-custom-fast');
  assert.equal(current.settings.models.astra,'gpt-6-astra');assert.ok(current.agents.every(a=>a.reasoningEffort==='medium'));
  assert.equal(current.schemaVersion,6);assert.ok(current.agents.every(a=>a.fixedPrompt===''));
});
test('continuing tasks carries prior requests, results and folder into tasks and Goals', async () => {
  await request('settings', 'PATCH', { executor: 'demo', paused: false });
  const first = await request('tasks', 'POST', { description: '이전 작업 기억 검증', agentId: 'chief' });
  const { task: source } = await poll(first.data.id);
  const next = await request('tasks', 'POST', { description: '이어서 수정해줘', parentTaskId: source.id });
  assert.equal(next.status, 201);
  const { task } = await poll(next.data.id);
  assert.equal(task.parentTaskId, source.id);
  assert.equal(task.workingDirectory, source.workingDirectory);
  assert.ok(task.previousContext.includes(source.description));
  assert.ok(task.previousContext.includes(source.result));
  const goal = await request('goals', 'POST', { description: '남은 작업 완료', parentTaskId: task.id });
  assert.equal(goal.status, 201);
  const round = (await request('state')).data.tasks.find(item => item.id === goal.data.taskId);
  assert.ok(round.previousContext.includes('이전 작업 기억 검증'));
  assert.ok(round.previousContext.includes('이어서 수정해줘'));
  assert.equal((await request('tasks', 'POST', { description: '없는 작업', parentTaskId: 'missing' })).status, 404);
  await request(`goals/${goal.data.id}/stop`, 'POST', {});
});

test('development junior handles light work and gets team lead review',async()=>{
  const before=(await request('state')).data;
  assert.equal(before.agents.find(a=>a.id==='junior').reportsTo,'dev');
  assert.equal(before.agents.find(a=>a.id==='junior').profile,'luna');
  assert.match(before.agents.find(a=>a.id==='dev').role,/팀장/);
  const created=await request('tasks','POST',{description:'간단한 UI 문구 수정',agentId:'chief'});
  assert.equal(created.status,201);
  const {task}=await poll(created.data.id);
  assert.ok(task.workerResult.includes('따까리'));
  assert.ok(task.teamLeadReview.includes('개발노예'));
  assert.ok(task.result.includes('따까리'));
  const assigned=await request('tasks','POST',{description:'단순 CSS 스타일 수정',agentId:'dev'});
  assert.equal(assigned.status,201);
  const {task:helped}=await poll(assigned.data.id);
  assert.ok(helped.workerResult.includes('따까리'));assert.ok(helped.teamLeadReview.includes('개발노예'));
});

test('idle agents remain available during chief work; busy agents reject direct assignments and secretary reports real status',async()=>{
  await stop();await start({DEMO_STEP_MS:'200'});
  const dev=await request('tasks','POST',{description:'개발 팀장 직접 작업',agentId:'dev',requireIdle:true});
  assert.equal(dev.status,201);
  let busy=false;for(let index=0;index<100;index++){const state=(await request('state')).data,agent=state.agents.find(item=>item.id==='dev');if(agent.activeTaskId===dev.data.id&&agent.phase==='coding'){busy=true;break;}await sleep(20);}assert.equal(busy,true);
  assert.equal((await request('tasks','POST',{description:'중복 배정',agentId:'dev',requireIdle:true})).status,409);
  const chief=await request('tasks','POST',{description:'서버 개발 검토',agentId:'chief',requireIdle:true});assert.equal(chief.status,201);
  const writer=await request('tasks','POST',{description:'독립적인 글 초안',agentId:'writer',requireIdle:true});assert.equal(writer.status,201);
  let current=(await request('state')).data;
  assert.equal(current.tasks.find(t=>t.id===chief.data.id).status,'running');
  assert.equal(current.tasks.find(t=>t.id===writer.data.id).status,'running');
  assert.equal(current.agents.find(a=>a.id==='format').status,'idle');
  const report=await request('secretary','POST',{question:'호문클루스 지금 무슨 일 하고 있어?'});
  assert.equal(report.status,200);assert.match(report.data.answer,/비둘기/);assert.match(report.data.answer,/서버 개발 검토/);
  assert.equal((await request('secretary','POST',{question:''})).status,400);
  assert.equal((await request('tasks','POST',{description:'비서에게 작업',agentId:'secretary'})).status,400);
  await request(`tasks/${chief.data.id}/stop`,'POST',{});await poll(chief.data.id,'stopped');
  await poll(dev.data.id);await poll(writer.data.id);
  current=(await request('state')).data;assert.ok(current.agents.every(a=>a.status==='idle'));
  assert.match((await request('secretary','POST',{question:'진행 상황 어때?'})).data.answer,/호문클루스는 지금 쉬고/);
});

test('password protects API and SSE while allowing session login',async()=>{
  await stop();await start({OFFICE_PASSWORD:'test-password'});
  assert.equal((await request('state')).status,401);assert.equal((await fetch(base+'/api/events')).status,401);
  assert.equal((await request('auth','POST',{password:'wrong'})).status,401);
  const login=await request('auth','POST',{password:'test-password'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Strict'));
  const s=await request('state','GET',undefined,{Cookie:cookie.split(';')[0]});assert.equal(s.status,200);
});


test('all agent names persist and invalid names do not change settings',async()=>{
  await stop();await start();
  const original=(await request('state')).data.agents;
  try {
    for(const agent of original) {
      const renamed=await request(`agents/${agent.id}`,'PATCH',{name:`  새 이름 ${agent.id}  `});
      assert.equal(renamed.status,200);assert.equal(renamed.data.agent.name,`새 이름 ${agent.id}`);
    }
    await stop();await start();
    const saved=(await request('state')).data.agents;
    for(const agent of saved)assert.equal(agent.name,`새 이름 ${agent.id}`);
    for(const name of ['', '   ', 'x'.repeat(41), 123, null]) {
      assert.equal((await request('agents/dev','PATCH',{name,profile:'luna'})).status,400);
      assert.deepEqual((await request('state')).data.agents.find(a=>a.id==='dev'),saved.find(a=>a.id==='dev'));
    }
  } finally {for(const agent of original)await request(`agents/${agent.id}`,'PATCH',{name:agent.name});}
});


test('character appearance is validated atomically and persisted',async()=>{
  const before=(await request('state')).data.agents.find(a=>a.id==='dev');
  assert.equal((await request('agents/dev','PATCH',{name:'invalid-change',appearance:'unknown'})).status,400);
  assert.equal((await request('state')).data.agents.find(a=>a.id==='dev').name,before.name);
  assert.equal((await request('agents/dev','PATCH',{appearance:'cat'})).status,200);
  await stop();await start();
  assert.equal((await request('state')).data.agents.find(a=>a.id==='dev').appearance,'cat');
});


test('tier presets and custom presets persist per office and enforce fixed models',async()=>{
  for(const presetId of ['upper','middle','lower']) {
    assert.equal((await request('agent-presets','POST',{action:'apply',presetId})).status,200);
    const state=(await request('state')).data;
    for(const id of ['junior','misc','secretary']){const a=state.agents.find(a=>a.id===id);assert.equal(a.profile,'luna');assert.equal(a.reasoningEffort,'medium');}
  }
  assert.equal((await request('agents/misc','PATCH',{profile:'sol'})).status,400);
  assert.equal((await request('agent-presets','POST',{action:'save',name:'내 프리셋'})).status,200);
  const saved=(await request('state')).data.offices.local.agentPresets.at(-1);
  assert.equal((await request('agent-presets','POST',{action:'apply',presetId:'upper'})).status,200);
  assert.equal((await request('agent-presets','POST',{action:'apply',presetId:saved.id})).status,200);
  assert.equal((await request('state')).data.agents.find(a=>a.id==='chief').profile,'terra');
  await stop();await start();
  assert.equal((await request('state')).data.offices.local.agentPresets.at(-1).id,saved.id);
});


test('history previews isolate confirmed deletion and deleted mail stays deleted after restart',async()=>{
  assert.equal((await request('history/preview','POST',{kind:'letters',range:'before',cutoff:'bad'})).status,400);
  assert.equal((await request('history/delete','POST',{token:'invalid'})).status,400);
  const before=(await request('state')).data;
  const preview=await request('history/preview','POST',{kind:'letters',range:'all'});
  assert.equal(preview.status,200);assert.equal(preview.data.counts.letters,before.letters.length);
  const removed=await request('history/delete','POST',{token:preview.data.token});assert.equal(removed.status,200);
  assert.equal((await request('state')).data.letters.length,0);
  assert.equal((await request('state')).data.tasks.length,before.tasks.length);
  await stop();await start();assert.equal((await request('state')).data.letters.length,0);
  const logs=await request('history/preview','POST',{kind:'logs',range:'all'});
  await request('history/delete','POST',{token:logs.data.token});assert.equal((await request('state')).data.logs.length,0);
});

test('desktop update preparation rejects queued work and freezes new mutations until cancelled',async()=>{
  assert.equal((await request('update/prepare','POST',{})).status,400);
  await stop();await start({PX_DESKTOP:'1'});
  await request('settings','PATCH',{paused:true});
  const queued=await request('tasks','POST',{description:'update protection test',agentId:'misc'});
  assert.equal(queued.status,201);
  assert.equal((await request('update/prepare','POST',{})).status,409);
  await request(`tasks/${queued.data.id}/stop`,'POST',{});await poll(queued.data.id,'stopped');
  assert.equal((await request('update/prepare','POST',{})).status,200);
  assert.equal((await request('state')).status,200);
  assert.equal((await request('tasks','POST',{description:'must not start',agentId:'misc'})).status,409);
  assert.equal((await request('agents/dev','PATCH',{name:'must not change'})).status,409);
  assert.equal((await request('update/cancel','POST',{})).status,200);
  const resumed=await request('tasks','POST',{description:'allowed after cancellation',agentId:'misc'});
  assert.equal(resumed.status,201);await request(`tasks/${resumed.data.id}/stop`,'POST',{});
});
