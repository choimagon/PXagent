import {stat} from 'node:fs/promises';
import path from 'node:path';
import {AGENT_CAPABILITIES} from '../agents/definitions.mjs';
import {localPlan,parseJSON,validatePlan,runGraph} from './planner.mjs';
import {validateWorkspace} from './validator.mjs';
import {researchConfig,runAutoResearch} from './autoresearch.mjs';

const plannerRules=`[PLANNING_GRAPH]
최상위 총괄은 사용자 요청을 분류하고 단일/복합 작업을 판단하여 필요한 부서·Agent·작업·의존성을 계획합니다. 전문 담당자의 세부 방법론은 대신 결정하지 마세요.
dev=개발부 기술 판단·구현, junior=가벼운 개발, analyzer=논문/PDF/DOCX/PPTX/MD/TXT/CSV/일반 파일 읽기·분석, writer=작성, format=형식, misc=잡무.
분석만: analyzer. 분석 후 작성: analyzer→writer. 형식까지: analyzer→writer→format. 독립 작업만 dependsOn=[]로 병렬 배정하세요. 같은 결과를 소비하는 작업에는 의존성을 지정하세요.
AutoResearch는 개발 팀장이 실제 코드와 metric을 확인해 선택합니다. 총괄은 autoresearch나 secretary에 직접 작업을 배정하지 마세요.
재계획에서는 완료한 기존 작업 ID를 dependsOn으로 참조할 수 있습니다. 완료한 ID를 새 작업 ID로 재사용하지 마세요.
JSON만 반환: {"summary":"설명","tasks":[{"id":"T1","agentId":"dev","skills":["backend","testing"],"instruction":"정확한 작업과 검증 요구","dependsOn":[]}]}. 1~24개 작업, 고유 ID, 순환 없는 의존성.`;
export async function runOfficeTask({task,agents,ask,useAgent:reserveAgent,releaseAgent:unreserveAgent,emit,signal,wait,createSession,onUpdate=async()=>{}}) {
  const chief=agents.find(agent=>agent.id==='chief'),lead=agents.find(agent=>agent.id==='dev');
  const leases=new Map();
  const useAgent=async(id,owner)=>{while(leases.has(id)){if(signal.aborted)throw signal.reason;await new Promise(resolve=>setTimeout(resolve,10));}leases.set(id,owner);try{await reserveAgent(id);}catch(error){leases.delete(id);throw error;}};
  const releaseAgent=(id,owner)=>{if(leases.get(id)===owner){leases.delete(id);unreserveAgent(id);}};
  const content=task.previousContext?`[이전 결과]\n${task.previousContext}\n\n[현재 요청]\n${task.description}`:task.description;
  let session,sessionRequest;
  const getSession=()=>sessionRequest||=createSession().then(value=>session=value);
  const event=(type,agentId,nodeId,detail={})=>emit(type,{agentId,nodeId,...detail});
  const plan=async(reason='')=>{
    if(task.runMode==='demo'){await wait();return localPlan(reason||content);}
    await useAgent(chief.id,'plan');await event('agent.thinking','chief',null);
    try {
      const text=await ask(chief,plannerRules+(reason?'\n[REPLAN]\n이미 완료한 작업은 반복하지 말고 실패·누락만 해결하는 새 그래프를 만드세요.':''),`요청: ${content}${reason?'\n실패 및 검수 기록: '+reason:''}`,{phase:reason?'실패 재계획':'작업 계획',readOnly:true});
      return validatePlan(parseJSON(text),{externalIds:reason?(task.graph?.tasks||[]).filter(node=>node.status==='done').map(node=>node.id):[]});
    }finally{releaseAgent(chief.id,'plan');}
  };
  task.graph=task.agentId==='chief'?await plan():validatePlan({summary:'지정 담당자 작업',tasks:[{id:'T1',agentId:task.agentId,instruction:content,skills:[],dependsOn:[]}]});
  unreserveAgent(task.agentId);
  task.graph.replans=0;task.graph.history=[];await event('task.planned','chief',null,{summary:task.graph.summary});
  const review=async(agent,node,result,workspace,phase)=>{
    await useAgent(agent.id,'review-'+(node?.id||'final'));await event('agent.reviewing',agent.id,node?.id);
    try {
      if(task.runMode==='demo'){await wait();return {approved:true,summary:`${agent.name} 검토 (데모)\n\n${result}`,nextInstruction:''};}
      const text=await ask(agent,`${phase==='개발 팀장 검토'?'[DEVELOPER_REVIEW]':'[FINAL_REVIEW]'}\n요청과 실제 결과·diff·Validator 검사 근거를 대조하세요. 완료 발언만 근거로 승인하지 마세요. 추가 작업은 실행하지 말고 검토와 보고만 하세요. JSON만 반환: {"approved":true 또는 false,"summary":"한국어 검수·보고","nextInstruction":"미승인 시 필요한 추가 작업"}`,`요청: ${content}\n담당 결과:\n${result}\n실제 검증 기록:\n${JSON.stringify(node?.validation||task.validation)}\n작업공간: ${workspace?.workDirectory||task.workingDirectory}`,{phase,readOnly:true,workspace,node});
      try {const value=parseJSON(text);if(typeof value.approved!=='boolean'||typeof value.summary!=='string'||!value.summary.trim()||typeof value.nextInstruction!=='string'||(!value.approved&&!value.nextInstruction.trim()))throw Error('검수 형식 오류');return value;}
      catch(error){if(task.runMode==='api')return {approved:true,summary:text,nextInstruction:''};throw Error('실제 검수 승인 여부를 해석하지 못했습니다.');}
    }finally{releaseAgent(agent.id,'review-'+(node?.id||'final'));}
  };
  const runNode=async(node,dependencies)=>{
    let agent=agents.find(agent=>agent.id===node.agentId),workspace;
    const dependencyContext=dependencies.map(dependency=>`[${dependency.id} · ${dependency.agentId}]\n${dependency.result}`).join('\n\n');
    let request=`원래 요청: ${content}\n\n담당 작업: ${node.instruction}\n\n선행 작업의 실제 결과:\n${dependencyContext}`;
    node.phase='thinking';await useAgent(agent.id,node.id);await event('task.assigned',agent.id,node.id);await event('agent.started',agent.id,node.id);
    try {
      if(task.runMode==='codex'&&agent.id!=='analyzer'){workspace=await (await getSession()).create(`${node.id}_${node.attempt}`);node.workspace={directory:workspace.workDirectory,isolated:workspace.git||!workspace.remote};await event('workspace.created',agent.id,node.id,node.workspace);}
      if(agent.id==='analyzer'&&session)workspace=session;
      if(agent.id==='dev') {
        await event('agent.thinking',agent.id,node.id);
        const text=task.runMode==='demo'?JSON.stringify({method:localPlan(content).tasks[0]?.agentId==='junior'?'junior':'direct',instruction:node.instruction}):await ask(agent,`[DEVELOPMENT_METHOD]\n먼저 실제 코드와 문제를 확인한 다음 direct/junior/autoresearch를 판단하세요. 단순 버그·UI 색상·오타·API 하나·리팩터링·파일 이동은 direct 또는 junior입니다. 여러 구현·알고리즘·하이퍼파라미터를 반복 비교하고 실제 objective metric과 자동 실행이 가능할 때만 autoresearch입니다.\nJSON만: {"method":"direct 또는 junior 또는 autoresearch","instruction":"수행 지시","research":null 또는 {"metricCommand":"실제 측정 후 JSON {metric:숫자} 출력 명령","direction":"minimize 또는 maximize","maxIterations":5,"maxMinutes":10,"maxTokens":20000,"maxFiles":10,"allowedFiles":["수정할 상대 파일"],"validationCommands":["실제 테스트 명령"]}}`,request,{phase:'개발 방법 판단',readOnly:true,workspace,node,skills:node.skills});
        let method;try{method=parseJSON(text);}catch{method={method:'direct',instruction:node.instruction};}
        if(!['direct','junior','autoresearch'].includes(method.method)||typeof method.instruction!=='string'||!method.instruction.trim())throw Error('개발 팀장 판단이 올바르지 않습니다.');
        node.developmentMethod=method.method;
        request+=`\n개발 팀장 지시: ${method.instruction}`;
        if(method.method==='junior'){releaseAgent('dev',node.id);agent=agents.find(agent=>agent.id==='junior');await useAgent(agent.id,node.id);await event('agent.assigned',agent.id,node.id);}
        if(method.method==='autoresearch') {
          if(task.runMode!=='codex'||!workspace?.git)throw Error('AutoResearch는 Codex와 격리된 Git 프로젝트에서 실행합니다.');
          if(workspace.remote)throw Error('원격 AutoResearch는 OS 파일 접근 범위를 강제할 수 없어 현재 로컬 Git 프로젝트에서만 실행합니다.');
          const config=researchConfig(method.research,task.researchLimits);
          config.allowedFiles=config.allowedFiles.map(file=>workspace.scope?`${workspace.scope.replaceAll('\\','/')}/${file}`:file);
          node.research={config,experiments:[]};releaseAgent('dev',node.id);agent=agents.find(agent=>agent.id==='autoresearch');await useAgent(agent.id,node.id);
          const firstRun=task.codexRuns.length;
          const usage=()=>task.codexRuns.slice(firstRun).filter(run=>run.agentId==='autoresearch').reduce((total,run)=>total+(run.usage?.input_tokens||0)+(run.usage?.output_tokens||0),0);
          const result=await runAutoResearch({workspace,config,signal,usage,experiments:node.research.experiments,emit:(type,detail)=>event(type,agent.id,node.id,detail),act:async context=>{
            const text=await ask(agent,`[AUTORESEARCH_EXPERIMENT]\n가설 한 개를 만들고 허용 파일에 변경을 실제 적용하세요. 테스트나 metric 명령을 수정해 점수를 속이지 마세요. 범위: ${JSON.stringify(config.allowedFiles)}. 서버가 실제 테스트와 metric을 실행하고 나쁜 결과는 되돌립니다. JSON만 {"hypothesis":"이번 변경 가설"}.`,`${request}\n개발 팀장 지시: ${method.instruction}\n회차: ${context.iteration}\n현재 best metric: ${context.bestMetric}\n이전 실험: ${JSON.stringify(context.experiments.slice(0,-1))}`,{phase:'실험 가설',workspace,node,skills:node.skills.filter(skill=>AGENT_CAPABILITIES.autoresearch.availableSkills.includes(skill)),signal:context.signal,timeoutMs:context.timeoutMs,maxTokens:context.remainingTokens});
            const hypothesis=parseJSON(text).hypothesis;if(typeof hypothesis!=='string'||!hypothesis.trim())throw Error('실험 가설이 없습니다.');return {hypothesis};
          }});
          node.research.result=result;node.validation=await validateWorkspace({workspace,signal,commands:config.validationCommands,maxFiles:config.maxFiles,allowedFiles:config.allowedFiles,requireTests:true});if(node.validation.status!=='PASS')throw Error('최적 실험 결과의 최종 검증 실패');releaseAgent(agent.id,node.id);const reviewed=await review(lead,node,JSON.stringify(result),workspace,'개발 팀장 검토');if(!reviewed.approved)throw Error(reviewed.nextInstruction);await (await getSession()).merge(workspace);await event('workspace.merged','dev',node.id);return reviewed.summary;
        }
      }
      let result,feedback='';
      for(let attempt=1;attempt<=2;attempt++) {
        node.validationAttempt=attempt;
        await event(agent.id==='analyzer'?'document.analysis.started':'agent.coding',agent.id,node.id);
        if(task.runMode==='demo'){for(const label of ['요청 내용 확인','작업 진행','결과 정리']){await wait();await event('agent.thinking',agent.id,node.id,{message:`${agent.name} · ${label} (데모)`});}result=`[데모 결과]\n담당: ${agent.name} (${agent.department})\n요청: ${node.instruction}\n작업 배정·검수·보고 흐름만 확인했습니다. 실제 AI 실행·파일 생성·테스트 통과 결과가 아닙니다.`;}
        else result=await ask(agent,'요청을 실제 수행하고 결과와 근거를 한국어로 보고하세요. Analyzer는 원본 수정 없이 JSON {documentType,summary,keyClaims:[문자열],methods:[문자열],results:[문자열],findings:[{topic,claim,evidence,source,locator}],sources:[문서 절대 경로 또는 user-request],tables:[문자열],figures:[문자열],equations:[문자열],limitations:[문자열]}로 분석하세요. 확인한 파일·페이지·절 근거를 포함하세요. 확인 못한 이미지와 수식은 limitations에 명시하세요.',request+(feedback?'\n[VALIDATOR_REWORK]\n'+feedback:''),{phase:'담당 작업',workspace,node,readOnly:agent.id==='analyzer',skills:node.skills});
        node.workerResult=result;
        if(agent.id==='analyzer'){
          const checks=[{name:'읽기·분석 결과',passed:!!result.trim()}];
          if(task.runMode==='codex'){
            node.analysis=parseJSON(result);const analysis=node.analysis;
            checks.push({name:'구조화된 주장·근거·한계',passed:typeof analysis.summary==='string'&&!!analysis.summary.trim()&&['findings','sources','tables','figures','equations','limitations'].every(key=>Array.isArray(analysis[key]))});
            if(!checks.at(-1).passed)throw Error('Analyzer의 구조화된 분석 형식이 올바르지 않습니다.');
            for(const source of analysis.sources){if(source==='user-request')continue;let exists=false;if(task.machineId)exists=true;else try{exists=(await stat(path.resolve(workspace?.workDirectory||task.workingDirectory,source))).isFile();}catch{}checks.push({name:'분석 원본: '+source,passed:exists});}
          }
          node.validation={status:task.runMode==='codex'?(checks.every(check=>check.passed)?'PASS':'FAIL'):task.runMode==='demo'?'SIMULATED':'TEXT_ONLY',checks};if(node.validation.status==='FAIL')throw Error('Analyzer 근거 검증 실패');await event('document.analysis.completed',agent.id,node.id);break;
        }
        await event('validation.started',agent.id,node.id);await event('agent.testing',agent.id,node.id);
        node.validation=task.runMode==='codex'?await validateWorkspace({workspace,signal,commands:task.validationCommands||[]}):{status:task.runMode==='demo'?'SIMULATED':'TEXT_ONLY',checks:[]};
        await event('validation.completed',agent.id,node.id,node.validation);
        if(node.validation.status==='FAIL'){feedback=JSON.stringify(node.validation);if(attempt===2)throw Error('Validator FAIL: 실제 검사 또는 변경 범위를 통과하지 못했습니다.');continue;}
        if(agent.id==='junior'){releaseAgent(agent.id,node.id);const reviewed=await review(lead,node,result,workspace,'개발 팀장 검토');task.teamLeadReview=reviewed.summary;node.review={agentId:lead.id,...reviewed};if(!reviewed.approved){feedback=reviewed.nextInstruction;if(attempt===2)throw Error(feedback);await useAgent(agent.id,node.id);continue;}result=reviewed.summary;}
        if(workspace&&task.agentId!=='chief'&&agent.id!=='junior'){releaseAgent(agent.id,node.id);const reviewer=['dev','autoresearch'].includes(agent.id)?lead:chief;const reviewed=await review(reviewer,node,result,workspace,reviewer.id==='dev'?'개발 팀장 검토':'검토 및 보고');node.review={agentId:reviewer.id,...reviewed};if(!reviewed.approved){feedback=reviewed.nextInstruction;if(attempt===2)throw Error(feedback);await useAgent(agent.id,node.id);continue;}}
        break;
      }
      if(workspace&&agent.id!=='analyzer'){node.changedFiles=await workspace.changes();node.diff=workspace.diff?await workspace.diff():null;await (await getSession()).merge(workspace);node.commit=workspace.commit||null;await event('workspace.merged',agent.id,node.id);}
      return result;
    }finally{releaseAgent(agent.id,node.id);releaseAgent('dev',node.id);}
  };
  try {
    let result;
    for(let finalRound=0;finalRound<=2;finalRound++) {
      result=await runGraph(task.graph,{signal,runTask:runNode,maxParallel:task.machineId?1:3,replan:task.agentId==='chief'?graph=>plan(JSON.stringify(graph)):undefined,onChange:async(node,kind)=>{
        const completed=task.graph.tasks.filter(item=>item.status==='done').length;task.progress=20+Math.round(completed/task.graph.tasks.length*60);
        if(node)await event(kind==='started'?'agent.assigned':kind==='completed'?'agent.completed':'agent.failed',node.agentId,node.id,{message:node.error||`${node.id} · ${kind}`});
        else if(kind==='replanned')await event('task.replanned','chief',null);await onUpdate();
      }});
      task.workerResult=result;
      task.validation=session?await validateWorkspace({workspace:session,signal,commands:task.validationCommands||[]}):{status:task.runMode==='demo'?'SIMULATED':task.runMode==='api'?'TEXT_ONLY':'PASS',checks:task.graph.tasks.flatMap(node=>node.validation?.checks||[])};
      if(task.validation.status==='FAIL')throw Error('통합 Validator FAIL: 원본에 반영하지 않았습니다.');
      if(task.agentId!=='chief')break;
      task.status='reviewing';task.progress=90;await onUpdate();
      const reviewed=await review(chief,null,result,session,'검토 및 보고');task.finalReview=reviewed;
      if(reviewed.approved){result=reviewed.summary;break;}
      if(finalRound===2)throw Error(`최종 검수 미통과: ${reviewed.nextInstruction}`);
      const next=await plan(`${reviewed.nextInstruction}\n이미 검증된 결과: ${result}`),prefix=`TF${finalRound+1}_`;
      task.graph.tasks.push(...next.tasks.map(node=>({...node,id:prefix+node.id,dependsOn:node.dependsOn.map(id=>next.tasks.some(item=>item.id===id)?prefix+id:id)})));await event('task.replanned','chief',null);task.status='running';
    }
    if(session){task.mergedFiles=await session.integrate();await event('workspace.merged',task.agentId,null,{files:task.mergedFiles});}
    return result;
  }finally{if(session)await session.dispose();}
}
