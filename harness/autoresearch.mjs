import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {runShell} from './tools.mjs';
import {validateWorkspace,allowedFile} from './validator.mjs';
export const RESEARCH_LIMITS=Object.freeze({maxIterations:5,maxMinutes:10,maxTokens:20000,maxFiles:10});
export function researchConfig(value,userLimits={}) {
  if(!value||typeof value.metricCommand!=='string'||!value.metricCommand.trim()||value.metricCommand.length>8000||!['minimize','maximize'].includes(value.direction)||!Array.isArray(value.allowedFiles)||!value.allowedFiles.length||value.allowedFiles.some(file=>typeof file!=='string'||!allowedFile(file,'')))throw Error('AutoResearch에는 실제 metric 명령·방향·허용 파일이 필요합니다.');
  const limits={};
  for(const [key,ceiling] of Object.entries(RESEARCH_LIMITS)) {
    const requested=value[key]??ceiling,user=userLimits[key]??ceiling;
    if(!Number.isFinite(requested)||requested<=0||!Number.isFinite(user)||user<=0)throw Error('AutoResearch 제한은 양수여야 합니다.');
    limits[key]=Math.min(Math.floor(requested),Math.floor(user),ceiling);if(limits[key]<1)throw Error('AutoResearch 제한이 너무 작습니다.');
  }
  if(value.validationCommands!==undefined&&(!Array.isArray(value.validationCommands)||value.validationCommands.some(command=>typeof command!=='string'||!command.trim()||command.length>8000)))throw Error('실험 검증 명령이 올바르지 않습니다.');
  return {...limits,metricCommand:value.metricCommand.trim(),direction:value.direction,allowedFiles:[...new Set(value.allowedFiles)],validationCommands:value.validationCommands||[]};
}
export function metricValue(stdout) {
  const lines=stdout.trim().split('\n').reverse();
  for(const line of lines){try{const value=JSON.parse(line);if(typeof value.metric==='number'&&Number.isFinite(value.metric))return value.metric;}catch{}}
  throw Error('metric 명령은 실제 측정한 숫자를 마지막 JSON 줄 {"metric": 숫자}로 출력해야 합니다.');
}
export async function runAutoResearch({workspace,config,act,signal,emit=async()=>{},usage=()=>0,experiments=[]}) {
  const startedAt=Date.now(),deadline=startedAt+config.maxMinutes*60000;
  const controller=new AbortController();let timer;const startTimer=()=>timer=setTimeout(()=>controller.abort(Error('AutoResearch 시간 제한에 도달했습니다.')),Math.max(1,deadline-Date.now()));
  const bounded=AbortSignal.any([signal,controller.signal]);
  let best=await workspace.save(),bestMetric,stopReason='반복 횟수 제한';
  const protectedFiles=new Map(),hash=data=>createHash('sha256').update(data).digest('hex');
  const protect=async file=>{try{protectedFiles.set(file,hash(await readFile(path.join(workspace.workDirectory,file))));}catch(error){if(error.code!=='ENOENT')throw error;}};
  await protect('package.json');
  const commands=[config.metricCommand,...config.validationCommands];for(const command of commands)for(const match of command.matchAll(/(?:^|[\s"'])([A-Za-z0-9_./-]+\.(?:[cm]?js|py|sh|json))(?=$|[\s"'])/g)){const file=match[1].replace(/^\.\//,'');if(file.startsWith('/')||file.split('/').includes('..'))continue;await protect(file);}
  const tests=async(directory='tests')=>{try{for(const item of await readdir(path.join(workspace.workDirectory,directory),{withFileTypes:true})){const file=directory+'/'+item.name;if(item.isDirectory())await tests(file);else await protect(file);}}catch(error){if(error.code!=='ENOENT')throw error;}};await tests();
  const protectedCheck=async()=>{for(const [file,expected] of protectedFiles){let actual;try{actual=hash(await readFile(path.join(workspace.workDirectory,file)));}catch{}if(actual!==expected)throw Error('고정된 테스트·측정 파일을 변경할 수 없습니다: '+file);}};
  const validate=()=>validateWorkspace({workspace,signal:bounded,commands:config.validationCommands,requireTests:true,maxFiles:config.maxFiles,allowedFiles:config.allowedFiles});
  const measure=async()=>{const timeout=Math.max(1,Math.min(180000,deadline-Date.now()));const result=await (workspace.measure?workspace.measure(config.metricCommand,bounded,timeout):workspace.run?workspace.run(config.metricCommand,bounded,timeout):runShell(config.metricCommand,workspace.workDirectory,bounded,timeout));if(result.exitCode!==0)throw Error(`metric 측정 실패: ${result.stderr.slice(-2000)}`);return metricValue(result.stdout);};
  try {
    startTimer();await emit('autoresearch.started',{config,startedAt});
    const initial=await validate();if(initial.status!=='PASS')throw Error('실험 기준선 테스트가 실패했습니다. 먼저 개발 팀장이 기준선을 해결해야 합니다.');
    bestMetric=await measure();const baselineMetric=bestMetric;
    for(let iteration=1;iteration<=config.maxIterations;iteration++) {
      if(signal.aborted)throw signal.reason;
      if(Date.now()>=deadline){stopReason='시간 제한';break;}
      if(usage()>=config.maxTokens){stopReason='토큰 제한';break;}
      const entry={experimentId:`exp-${String(iteration).padStart(3,'0')}`,iteration,hypothesis:'',changes:[],metricBefore:bestMetric,metricAfter:null,status:'running',startedAt:Date.now()};experiments.push(entry);
      await emit('autoresearch.experiment.started',entry);
      try {
        const result=await act({iteration,bestMetric,experiments,signal:bounded,remainingTokens:config.maxTokens-usage(),timeoutMs:deadline-Date.now()});
        entry.hypothesis=typeof result==='string'?result:result.hypothesis;entry.changes=await workspace.changes();entry.tokens=usage();
        if(usage()>config.maxTokens)throw Error('AutoResearch 토큰 제한에 도달했습니다.');
        await protectedCheck();entry.validation=await validate();
        if(entry.validation.status!=='PASS')throw Error('실험 테스트 또는 변경 범위 검증 실패');
        entry.metricAfter=await measure();await protectedCheck();
        const improved=config.direction==='minimize'?entry.metricAfter<bestMetric:entry.metricAfter>bestMetric;
        if(improved){bestMetric=entry.metricAfter;best=await workspace.save();entry.status='accepted';await emit('autoresearch.best.updated',{metric:bestMetric,experimentId:entry.experimentId});}
        else {entry.status='discarded';await workspace.restore(best);}
      }catch(error){entry.status=bounded.aborted?'stopped':'rejected';entry.error=error.message;await workspace.restore(best);if(bounded.aborted||usage()>=config.maxTokens){stopReason=error.message;entry.finishedAt=Date.now();await emit('autoresearch.experiment.completed',entry);break;}}
      entry.finishedAt=Date.now();await emit('autoresearch.experiment.completed',entry);
    }
    if(signal.aborted)throw signal.reason;
    const result={bestCommit:typeof best==='string'?best:null,baselineMetric,bestMetric,improved:config.direction==='minimize'?bestMetric<baselineMetric:bestMetric>baselineMetric,stopReason,tokens:usage(),experiments,finishedAt:Date.now()};
    await emit('autoresearch.completed',result);return result;
  }catch(error){await workspace.restore(best);await emit('autoresearch.completed',{error:error.message,stopped:true,bestMetric});throw error;}
  finally{clearTimeout(timer);}
}
