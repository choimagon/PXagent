import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanupPlan,applyCleanup} from '../history-cleanup.mjs';
import {ensureOfficeFeatures} from '../office-features.mjs';
const fixture=()=>({tasks:[{id:'old',status:'done',finishedAt:99,createdAt:1,result:'saved',agentId:'dev'},{id:'boundary',status:'done',finishedAt:100,createdAt:1},{id:'active',status:'running',createdAt:1},{id:'queued',status:'queued',createdAt:1},{id:'remote',machineId:'peer',status:'done',finishedAt:1},{id:'goal-round',goalId:'ongoing',status:'done',finishedAt:1}],goals:[{id:'ongoing',status:'running',createdAt:1}],letters:[{id:'letter',taskId:'old',createdAt:99},{id:'same-day',taskId:'boundary',createdAt:100},{id:'peer-letter',taskId:'remote',machineId:'peer',createdAt:1}],logs:[{id:'log',taskId:'old',officeId:'local',at:99},{id:'boundary-log',officeId:'local',at:100},{id:'peer-log',officeId:'peer',at:1}]});
test('date cleanup excludes the boundary and other offices; deleting letters survives migration',()=>{
 const state=fixture(),plan=cleanupPlan(state,{kind:'letters',cutoff:100});
 assert.deepEqual(plan.letters,['letter']);applyCleanup(state,plan);ensureOfficeFeatures(state);
 assert.ok(!state.letters.some(l=>l.taskId==='old'));assert.equal(state.tasks.find(t=>t.id==='old').result,'saved');
 assert.ok(state.letters.some(l=>l.id==='peer-letter'));
});
test('task cleanup retains queued, active and ongoing Goal rounds and leaves other histories intact',()=>{
 const state=fixture(),plan=cleanupPlan(state,{kind:'tasks',cutoff:100});
 assert.deepEqual(plan.tasks,['old']);applyCleanup(state,plan);
 assert.equal(state.letters.length,3);assert.equal(state.logs.length,3);
 assert.ok(state.tasks.some(t=>t.id==='active'));assert.ok(state.tasks.some(t=>t.id==='goal-round'));
});
test('confirmation deletes only previewed records and rechecks execution status',()=>{
 const state=fixture(),plan=cleanupPlan(state,{kind:'tasks'});
 state.tasks.find(t=>t.id==='old').status='running';state.tasks.push({id:'new',status:'done',finishedAt:1});
 applyCleanup(state,plan);assert.ok(state.tasks.some(t=>t.id==='old'));assert.ok(state.tasks.some(t=>t.id==='new'));
 const logs=cleanupPlan(state,{kind:'logs',cutoff:100});assert.deepEqual(logs.logs,['log']);applyCleanup(state,logs);assert.equal(state.logs.length,2);
});
test('activity cleanup removes previewed events even when their old logs have rolled out, preserving bus history identity',()=>{
 const state=fixture();state.events=[{id:'event-old',officeId:'local',at:1,logId:'already-rolled-out'},{id:'event-boundary',officeId:'local',at:100},{id:'event-peer',officeId:'peer',at:1}];const history=state.events,plan=cleanupPlan(state,{kind:'logs',cutoff:100});
 state.events.push({id:'new-event',officeId:'local',at:2});applyCleanup(state,plan);assert.equal(state.events,history);assert.deepEqual(state.events.map(event=>event.id),['event-boundary','event-peer','new-event']);
});
