import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,access,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validatePlan,localPlan,runGraph} from '../harness/planner.mjs';
import {loadSkills,composePrompt} from '../harness/skills.mjs';
import {createEventBus} from '../harness/events.mjs';
import {createRemoteWorkspaceSession} from '../harness/remote-workspace.mjs';
import {createWorkspaceSession} from '../harness/workspace.mjs';
import {validateWorkspace} from '../harness/validator.mjs';
import {researchConfig,runAutoResearch} from '../harness/autoresearch.mjs';
import {mustGit,createSandboxRunner,runShell} from '../harness/tools.mjs';
import {codexEnvironment} from '../codex-runner.mjs';
import {runOfficeTask} from '../harness/runtime.mjs';
import {ADDITIONAL_AGENTS,AGENT_CAPABILITIES} from '../agents/definitions.mjs';
const node=(id,agentId,dependsOn=[])=>({id,agentId,dependsOn,instruction:id,skills:[]});
const controller=()=>new AbortController();
async function project(){
  const directory=await mkdtemp(path.join(tmpdir(),'px-harness-project-'));
  await writeFile(path.join(directory,'.gitignore'),'node_modules/\n');
  await writeFile(path.join(directory,'value.json'),'{"value":5}\n');
  await writeFile(path.join(directory,'metric.cjs'),"console.log(JSON.stringify({metric:require('./value.json').value}));\n");
  await writeFile(path.join(directory,'test.cjs'),"require('node:assert/strict').ok(require('./value.json').value<=10);\n");
  await writeFile(path.join(directory,'package.json'),JSON.stringify({scripts:{test:'node test.cjs'}}));
  await mustGit(directory,['init']);await mustGit(directory,['add','-A']);await mustGit(directory,['-c','user.name=Test','-c','user.email=test@localhost','commit','-m','baseline']);
  return directory;
}
test('planning rejects cycles, missing IDs, secretaries and direct AutoResearch',()=>{
  for(const tasks of [[node('T1','dev',['T2']),node('T2','writer',['T1'])],[node('T1','dev',['missing'])],[node('T1','dev'),node('T1','writer')],[node('T1','secretary')],[node('T1','autoresearch')]])assert.throws(()=>validatePlan({summary:'bad',tasks}));
  assert.deepEqual(localPlan('PDF 문서 분석 후 보고서 작성하고 형식 정리').tasks.map(item=>item.agentId),['analyzer','writer','format']);
  assert.deepEqual(localPlan('PDF 파일 분석').tasks.map(item=>item.agentId),['analyzer']);
});
test('graph starts independent agents together, serializes one agent and waits for dependencies',async()=>{
  const graph=validatePlan({summary:'graph',tasks:[node('T1','dev'),node('T2','writer'),node('T3','dev'),node('T4','format',['T1','T2','T3'])]});
  const running=new Set(),finished=new Set();let parallel=false;
  await runGraph(graph,{signal:controller().signal,runTask:async item=>{assert.ok(!running.has(item.agentId));item.dependsOn.forEach(id=>assert.ok(finished.has(id)));running.add(item.agentId);parallel ||= running.size>1;await new Promise(resolve=>setTimeout(resolve,30));running.delete(item.agentId);finished.add(item.id);return item.id;}});
  assert.equal(parallel,true);assert.equal(graph.tasks.every(item=>item.status==='done'),true);
});
test('failed tasks block dependents and Homunculus replans only remaining work',async()=>{
  const graph=validatePlan({summary:'graph',tasks:[node('T1','dev'),node('T2','writer'),node('T3','format',['T1'])]});let successes=0;
  await runGraph(graph,{signal:controller().signal,runTask:async item=>{if(item.id==='T1')throw Error('actual failure');if(item.id==='T2')successes++;return 'result';},replan:async current=>{assert.equal(current.tasks.find(item=>item.id==='T3').status,'blocked');return {summary:'repair',tasks:[node('T1','dev'),node('T3','format',['T1'])]};}});
  assert.equal(successes,1);assert.equal(graph.replans,1);assert.equal(graph.history[0][0].status,'failed');
});
test('skills load only supported abilities and prompts preserve separated sections',async()=>{
  const skills=await loadSkills('analyzer',['pdf-analysis']);assert.deepEqual(skills.map(skill=>skill.id),['document-analysis','pdf-analysis']);
  await assert.rejects(loadSkills('analyzer',['react']));await assert.rejects(loadSkills('dev',['../../secret']));
  const prompt=composePrompt({basePrompt:'rules',agentRole:'role',task:'task',skills,projectContext:'project',constraints:'bounds',outputFormat:'JSON'});
  for(const title of ['BASE SYSTEM RULES','AGENT ROLE','CURRENT TASK','SELECTED SKILLS','PROJECT CONTEXT','CONSTRAINTS','OUTPUT FORMAT'])assert.ok(prompt.includes(`[${title}]`));assert.ok(!prompt.includes('# react'));
});
test('events are bounded, persistent and delivered to subscribers',async()=>{
  const history=[],seen=[],bus=createEventBus({history,limit:2});const unsubscribe=bus.subscribe(event=>seen.push(event.type));
  for(const type of ['task.created','agent.testing','task.completed'])await bus.emit(type,{taskId:'task',officeId:'local'});
  assert.equal(history.length,2);assert.equal(seen.length,3);unsubscribe();await assert.rejects(bus.emit('invented.event'));
});
test('worktrees preserve user changes, merge independent nodes and refuse concurrent original edits',async()=>{
  const root=await project();let session;
  try {
    await writeFile(path.join(root,'value.json'),'{"value":4}\n');session=await createWorkspaceSession(root);const left=await session.create('T1'),right=await session.create('T2');
    await writeFile(path.join(left.directory,'left.txt'),'left');await writeFile(path.join(right.directory,'right.txt'),'right');await session.merge(left);await session.merge(right);await session.integrate();
    assert.equal(await readFile(path.join(root,'value.json'),'utf8'),'{"value":4}\n');assert.equal(await readFile(path.join(root,'left.txt'),'utf8'),'left');
    await session.dispose();session=await createWorkspaceSession(root);const work=await session.create('T3');await writeFile(path.join(work.directory,'value.json'),'{"value":3}\n');await session.merge(work);await writeFile(path.join(root,'value.json'),'{"value":2}\n');await assert.rejects(session.integrate(),/원본 파일/);assert.equal(await readFile(path.join(root,'value.json'),'utf8'),'{"value":2}\n');
  }finally{await session?.dispose();await rm(root,{recursive:true,force:true});}
});
test('Validator runs actual tests and rejects syntax errors and file scope changes',async()=>{
  const root=await project(),session=await createWorkspaceSession(root);try{const workspace=await session.create('T1');
    await writeFile(path.join(workspace.directory,'value.json'),'{"value":15}\n');let result=await validateWorkspace({workspace,signal:controller().signal});assert.equal(result.status,'FAIL');assert.ok(result.checks.some(check=>check.name==='npm run test'&&!check.passed));
    await writeFile(path.join(workspace.directory,'broken.mjs'),'const = invalid;');result=await validateWorkspace({workspace,signal:controller().signal});assert.ok(result.checks.some(check=>check.name==='syntax: broken.mjs'&&!check.passed));
    result=await validateWorkspace({workspace,signal:controller().signal,allowedFiles:['value.json']});assert.equal(result.status,'FAIL');assert.equal(result.checks.length,1);
  }finally{await session.dispose();await rm(root,{recursive:true,force:true});}
});
test('AutoResearch measures actual metrics, keeps the best and rolls back failures and worse results',async()=>{
  const root=await project(),session=await createWorkspaceSession(root);try{const workspace=await session.create('T1');const config=researchConfig({metricCommand:'node metric.cjs',direction:'minimize',maxIterations:3,allowedFiles:['value.json'],validationCommands:['node test.cjs']});
    const events=[],result=await runAutoResearch({workspace,config,signal:controller().signal,emit:async type=>events.push(type),act:async({iteration})=>{await writeFile(path.join(workspace.directory,'value.json'),JSON.stringify({value:[3,8,15][iteration-1]})+'\n');return {hypothesis:`candidate ${iteration}`};}});
    assert.equal(result.baselineMetric,5);assert.equal(result.bestMetric,3);assert.deepEqual(result.experiments.map(item=>item.status),['accepted','discarded','rejected']);assert.ok(events.includes('autoresearch.best.updated'));await session.merge(workspace);await session.integrate();assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,3);
  }finally{await session.dispose();await rm(root,{recursive:true,force:true});}
});
test('AutoResearch token exhaustion stops further experiments and discards over-budget changes',async()=>{
  const root=await project(),session=await createWorkspaceSession(root);try{const workspace=await session.create('T1');let tokens=0,calls=0;const config=researchConfig({metricCommand:'node metric.cjs',direction:'minimize',maxTokens:100,allowedFiles:['value.json'],validationCommands:['node test.cjs']});
    const result=await runAutoResearch({workspace,config,signal:controller().signal,usage:()=>tokens,act:async()=>{calls++;tokens=105;await writeFile(path.join(workspace.directory,'value.json'),'{"value":1}\n');return 'hypothesis';}});assert.equal(calls,1);assert.equal(result.bestMetric,5);assert.match(result.stopReason,/토큰/);assert.equal(JSON.parse(await readFile(path.join(workspace.directory,'value.json'))).value,5);
  }finally{await session.dispose();await rm(root,{recursive:true,force:true});}
});
test('stopping AutoResearch restores the previous best in its isolated workspace',async()=>{
  const root=await project(),session=await createWorkspaceSession(root);try{const workspace=await session.create('T1'),control=controller(),config=researchConfig({metricCommand:'node metric.cjs',direction:'minimize',allowedFiles:['value.json'],validationCommands:['node test.cjs']});
    await assert.rejects(runAutoResearch({workspace,config,signal:control.signal,act:async()=>{await writeFile(path.join(workspace.directory,'value.json'),'{"value":1}\n');control.abort(Error('user stop'));throw control.signal.reason;}}),/user stop/);assert.equal(JSON.parse(await readFile(path.join(workspace.directory,'value.json'))).value,5);assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,5);
  }finally{await session.dispose();await rm(root,{recursive:true,force:true});}
});
test('AutoResearch rejects changing fixed measurements even inside the allowed file list',async()=>{
  const root=await project(),session=await createWorkspaceSession(root);try{const workspace=await session.create('T1'),config=researchConfig({metricCommand:'node metric.cjs',direction:'minimize',maxIterations:1,allowedFiles:['value.json','metric.cjs'],validationCommands:['node test.cjs']});
    const result=await runAutoResearch({workspace,config,signal:controller().signal,act:async()=>{await writeFile(path.join(workspace.directory,'metric.cjs'),'console.log(JSON.stringify({metric:0}));');return 'cheating';}});
    assert.equal(result.bestMetric,5);assert.equal(result.experiments[0].status,'rejected');assert.match(result.experiments[0].error,/고정된/);
  }finally{await session.dispose();await rm(root,{recursive:true,force:true});}
});
test('native Codex sandbox permits workspace writes and denies original and sibling writes',{skip:process.platform!=='darwin'},async t=>{
  const binary=path.resolve('build/codex/bin/codex');try{await access(binary);}catch{t.skip('bundle not prepared');return;}
  const root=await project(),run=createSandboxRunner(binary,codexEnvironment()),session=await createWorkspaceSession(root,{commandRunner:run});try{
    const workspace=await session.create('T1'),outside=path.join(root,'outside.txt');
    const allowed=await workspace.run('node -e "require(\'fs\').writeFileSync(\'inside.txt\',\'inside\')"',controller().signal);assert.equal(allowed.exitCode,0,allowed.stderr);
    const denied=await workspace.run(`node -e 'require("fs").writeFileSync(${JSON.stringify(outside)},"outside")'`,controller().signal);assert.notEqual(denied.exitCode,0);await assert.rejects(readFile(outside),{code:'ENOENT'});
    const measurement=await workspace.measure('node metric.cjs',controller().signal);assert.equal(measurement.exitCode,0,measurement.stderr);
    const mutation=await workspace.measure('node -e "require(\'fs\').writeFileSync(\'value.json\',\'{}\')"',controller().signal);assert.notEqual(mutation.exitCode,0);assert.equal(JSON.parse(await readFile(path.join(workspace.directory,'value.json'))).value,5);
    const validated=await validateWorkspace({workspace,signal:controller().signal});assert.equal(validated.status,'PASS',JSON.stringify(validated));assert.deepEqual(await workspace.changes(),['inside.txt']);
  }finally{await session.dispose();await rm(root,{recursive:true,force:true});}
});
const officeAgents=()=>Object.entries(AGENT_CAPABILITIES).map(([id,capability])=>({id,name:id,department:id,profile:'terra',prompt:capability.role}));
test('runtime delegates AutoResearch through developer, validates actual tests and reviews best before integration',async()=>{
  const root=await project(),task={agentId:'chief',description:'improve actual metric',runMode:'codex',workingDirectory:root,codexRuns:[],steps:[]},calls=[],events=[],reserved=new Set();
  try{
    const result=await runOfficeTask({task,agents:officeAgents(),signal:controller().signal,wait:async()=>{},emit:async(type,detail)=>events.push({type,...detail}),useAgent:async id=>{assert.ok(!reserved.has(id));reserved.add(id);},releaseAgent:id=>reserved.delete(id),createSession:()=>createWorkspaceSession(root),ask:async(agent,rules,request,options)=>{
      calls.push({agent:agent.id,phase:options.phase,readOnly:options.readOnly});
      if(options.phase==='작업 계획')return JSON.stringify({summary:'optimize',tasks:[node('T1','dev')]});
      if(options.phase==='개발 방법 판단')return JSON.stringify({method:'autoresearch',instruction:'compare fixed benchmark',research:{metricCommand:'node metric.cjs',direction:'minimize',maxIterations:2,allowedFiles:['value.json'],validationCommands:['node test.cjs']}});
      if(options.phase==='실험 가설'){await writeFile(path.join(options.workspace.directory,'value.json'),JSON.stringify({value:calls.filter(call=>call.phase==='실험 가설').length===1?3:8})+'\n');return JSON.stringify({hypothesis:'actual candidate'});}
      assert.ok(['개발 팀장 검토','검토 및 보고'].includes(options.phase));assert.equal(task.graph.tasks[0].validation.status,'PASS');assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,5,'original untouched before review');return JSON.stringify({approved:true,summary:'verified best',nextInstruction:''});
    }});
    assert.equal(result,'verified best');assert.deepEqual(calls.map(call=>call.agent),['chief','dev','autoresearch','autoresearch','dev','chief']);assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,3);assert.equal(reserved.size,0);assert.equal(task.validation.status,'PASS');assert.ok(events.some(event=>event.type==='autoresearch.best.updated'));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('runtime passes generated documents through the integration workspace to dependent Analyzer',async()=>{
  const root=await project(),task={agentId:'chief',description:'write document and implement independent feature, then analyze',runMode:'codex',workingDirectory:root,codexRuns:[],steps:[]},reserved=new Set(),active=new Set();let parallel=false;
  try{
    await runOfficeTask({task,agents:officeAgents(),signal:controller().signal,wait:async()=>{},emit:async()=>{},useAgent:async id=>{assert.ok(!reserved.has(id));reserved.add(id);},releaseAgent:id=>reserved.delete(id),createSession:()=>createWorkspaceSession(root),ask:async(agent,rules,request,options)=>{
      if(options.phase==='작업 계획')return JSON.stringify({summary:'parallel with dependency',tasks:[node('T1','writer'),node('T2','dev'),node('T3','analyzer',['T1'])]});
      if(options.phase==='개발 방법 판단')return JSON.stringify({method:'direct',instruction:'write independent feature',research:null});
      if(options.phase==='검토 및 보고')return JSON.stringify({approved:true,summary:'verified documents and feature',nextInstruction:''});
      if(agent.id==='analyzer'){assert.equal(options.readOnly,true);assert.equal(await readFile(path.join(options.workspace.workDirectory,'brief.md'),'utf8'),'document evidence');assert.ok(request.includes('written brief.md'));return JSON.stringify({documentType:'markdown',summary:'analyzed actual file',keyClaims:['evidence'],methods:[],results:[],sources:['brief.md'],findings:[],tables:[],figures:[],equations:[],limitations:[]});}
      active.add(agent.id);parallel ||= active.size>1;await new Promise(resolve=>setTimeout(resolve,30));const file=agent.id==='writer'?'brief.md':'feature.txt';await writeFile(path.join(options.workspace.workDirectory,file),agent.id==='writer'?'document evidence':'feature');active.delete(agent.id);return 'written '+file;
    }});
    assert.equal(parallel,true);assert.equal(task.validation.status,'PASS');assert.equal(await readFile(path.join(root,'brief.md'),'utf8'),'document evidence');assert.equal(reserved.size,0);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('runtime never merges Validator failures; replan retains successful work and references its result',async()=>{
  const root=await project(),task={agentId:'chief',description:'repair while preserving successful document',runMode:'codex',workingDirectory:root,codexRuns:[],steps:[]};let plans=0,writes=0;
  try{
    await runOfficeTask({task,agents:officeAgents(),signal:controller().signal,wait:async()=>{},emit:async()=>{},useAgent:async()=>{},releaseAgent:()=>{},createSession:()=>createWorkspaceSession(root),ask:async(agent,rules,request,options)=>{
      if(['작업 계획','실패 재계획'].includes(options.phase)){plans++;return JSON.stringify(plans===1?{summary:'initial',tasks:[node('T1','dev'),node('T2','writer')]}:{summary:'repair failure only',tasks:[node('T3','dev',['T2'])]});}
      if(options.phase==='개발 방법 판단')return JSON.stringify({method:'direct',instruction:'fix actual test',research:null});
      if(options.phase==='검토 및 보고')return JSON.stringify({approved:true,summary:'verified repair',nextInstruction:''});
      if(agent.id==='writer'){writes++;await writeFile(path.join(options.workspace.workDirectory,'success.md'),'retained evidence');return 'retained evidence';}
      if(plans>1)assert.ok(request.includes('retained evidence'));
      await writeFile(path.join(options.workspace.workDirectory,'value.json'),JSON.stringify({value:plans===1?15:3})+'\n');return 'claimed completion';
    }});
    assert.equal(plans,2);assert.equal(writes,1);assert.equal(task.graph.history[0].find(item=>item.id==='T1').validation.status,'FAIL');assert.equal(task.validation.status,'PASS');assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,3);assert.equal(await readFile(path.join(root,'success.md'),'utf8'),'retained evidence');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('SSH workspace adapter preserves dirty originals and validates isolated Git changes before integration',async()=>{
 const root=await project();let session;try{await writeFile(path.join(root,'value.json'),'{"value":4}\n');await writeFile(path.join(root,'user-note.txt'),'keep user note');session=await createRemoteWorkspaceSession(await realpath(root),{signal:controller().signal,run:(command,directory)=>runShell(command,directory)});const workspace=await session.create('T1');await writeFile(path.join(workspace.directory,'value.json'),'{"value":3}\n');assert.equal((await validateWorkspace({workspace,signal:controller().signal})).status,'PASS');assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,4);await session.merge(workspace);await session.integrate();assert.equal(JSON.parse(await readFile(path.join(root,'value.json'))).value,3);assert.equal(await readFile(path.join(root,'user-note.txt'),'utf8'),'keep user note');
 }finally{await session?.dispose();await rm(root,{recursive:true,force:true});}
});
test('remote fallback records LIMITED validation rather than claiming Git scope verification',async()=>{
 const result=await validateWorkspace({workspace:{remote:true,git:false,scope:'',changes:async()=>[],run:async()=>({exitCode:0,stdout:'{}',stderr:''})},signal:controller().signal});assert.equal(result.status,'LIMITED');assert.equal(result.checks.find(check=>check.name==='원격 Git 격리').scopeVerified,false);
});
