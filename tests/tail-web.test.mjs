import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTailWeb, reportHtml } from '../tail-web.mjs';
import { goalTask, continuationContext, postTaskReport } from '../office-features.mjs';

test('tail websites serve only selected reports, persist links and revoke deleted reports',async()=>{
  const tasks=[{id:'a',title:'연구 결과',description:'실험 실행',status:'done',result:'<script>alert(1)</script> 실제 결과',computerName:'연구실',finishedAt:Date.now(),tailWeb:true}];
  const make=()=>createTailWeb({port:0,getTasks:()=>tasks,getAddress:async()=> '127.0.0.1'});
  let service=make();
  try {
    const url=await service.publish(tasks[0]);
    assert.match(url,/\/tailweb\/[a-f0-9]{48}$/);
    const page=await fetch(url);assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);
    const html=await page.text();assert.match(html,/연구 결과/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
    assert.equal((await fetch(new URL('/api/state',url))).status,404);
    assert.equal((await fetch(url,{method:'POST'})).status,404);
    const token=tasks[0].tailWebToken;await service.close();service=make();await service.ready();
    assert.equal(tasks[0].tailWebToken,token);assert.equal((await fetch(tasks[0].tailWebUrl)).status,200);
    const newUrl=tasks[0].tailWebUrl;tasks.length=0;assert.equal((await fetch(newUrl)).status,404);
  } finally {await service.close();}
});

test('sharing failure is reported separately from a successful task and flags survive Goals and continuation',async()=>{
  const task={id:'source',title:'작업',description:'연구',status:'done',result:'성공 결과',tailWeb:true,steps:[]};
  const service=createTailWeb({port:0,getTasks:()=>[task],getAddress:async()=>{throw new Error('오프라인');}});
  await assert.rejects(service.publish(task),/오프라인/);await service.close();
  task.tailWebError='tail웹 공유 실패: 오프라인';
  const state={tasks:[task],letters:[]};const letter=postTaskReport(state,task);
  assert.equal(letter.body,'성공 결과');assert.equal(letter.tailWebError,task.tailWebError);assert.equal(letter.tailWebUrl,null);
  assert.equal(continuationContext(state,task.id).tailWeb,true);
  assert.equal(goalTask({id:'goal',round:0,title:'목표',description:'연구',tailWeb:true}).tailWeb,true);
  assert.match(reportHtml({...task,runMode:'demo'}),/데모 결과/);
});
