import {AGENT_CAPABILITIES} from '../agents/definitions.mjs';
export const PLAN_AGENT_IDS=['dev','junior','analyzer','writer','format','misc'];
export function parseJSON(value) {return JSON.parse(value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}
export function validatePlan(value,{allowLegacy=true,externalIds=[]}={}) {
  if(allowLegacy&&value?.agentId&&value.instruction&&!value.tasks)value={summary:'단일 작업',tasks:[{id:'T1',agentId:value.agentId,instruction:value.instruction,skills:[],dependsOn:[]}]};
  if(!value||typeof value.summary!=='string'||!value.summary.trim()||!Array.isArray(value.tasks)||!value.tasks.length||value.tasks.length>24)throw Error('작업 계획에는 설명과 1~24개의 작업이 필요합니다.');
  const ids=new Set(),external=new Set(externalIds);
  const tasks=value.tasks.map(node=>{
    if(typeof node.id!=='string'||!/^T[A-Za-z0-9_-]{1,63}$/.test(node.id)||ids.has(node.id)||external.has(node.id))throw Error('작업 ID는 고유해야 합니다.');ids.add(node.id);
    if(!PLAN_AGENT_IDS.includes(node.agentId))throw Error('총괄은 전문 담당자를 선택해야 합니다. AutoResearch는 개발 팀장만 위임합니다.');
    if(typeof node.instruction!=='string'||!node.instruction.trim()||node.instruction.length>16000||!Array.isArray(node.skills)||node.skills.length>8||!Array.isArray(node.dependsOn))throw Error('작업 지시·Skill·의존성이 올바르지 않습니다.');
    const capability=AGENT_CAPABILITIES[node.agentId];if(node.skills.some(skill=>!capability.availableSkills.includes(skill)))throw Error('작업에 지정한 Skill을 담당자가 사용할 수 없습니다.');
    return {id:node.id,agentId:node.agentId,instruction:node.instruction.trim(),skills:[...new Set(node.skills)],dependsOn:[...new Set(node.dependsOn)],status:'pending',attempt:0,result:'',error:null};
  });
  for(const node of tasks)if(node.dependsOn.some(id=>(!ids.has(id)&&!external.has(id))||id===node.id))throw Error('의존 작업을 찾을 수 없거나 자기 자신을 참조합니다.');
  const visited=new Set();
  while(visited.size<tasks.length){const ready=tasks.filter(node=>!visited.has(node.id)&&node.dependsOn.every(id=>visited.has(id)||external.has(id)));if(!ready.length)throw Error('작업 계획에 순환 의존성이 있습니다.');ready.forEach(node=>visited.add(node.id));}
  return {summary:value.summary.trim().slice(0,4000),tasks};
}
export function localPlan(content) {
  const document=/논문|문서|보고서|제안서|발표|PDF|DOCX|PPTX|Markdown|CSV|TXT|paper/i.test(content);
  const analysis=/분석|비교|읽|주장|근거|요약|analysis|analy[sz]e/i.test(content);
  const writing=/작성|집필|초안|만들|보고서|제안서|write/i.test(content);
  const formatting=/양식|편집|포맷|참고문헌|서식|형식|format/i.test(content);
  const tasks=[];
  const add=agentId=>tasks.push({id:`T${tasks.length+1}`,agentId,instruction:content,skills:[],dependsOn:tasks.length?[tasks.at(-1).id]:[]});
  if(document){if(analysis)add('analyzer');if(writing)add('writer');if(formatting)add('format');if(!tasks.length)add('analyzer');}
  else add(/(?:간단|가벼운|작은|단순).*(?:개발|코드|버그|UI|스타일|CSS|테스트|문구)|(?:UI|CSS|스타일|문구).*(?:수정|변경)|따까리/i.test(content)?'junior':/개발|코드|버그|서버|API|테스트|프로그램|알고리즘|성능|code|bug/i.test(content)?'dev':'misc');
  return validatePlan({summary:'요청의 전문 담당자와 실행 순서',tasks});
}
export async function runGraph(graph,{runTask,replan,onChange=async()=>{},signal,maxParallel=3,maxReplans=2}) {
  graph.replans??=0;graph.history??=[];
  while(true) {
    if(signal.aborted){for(const node of graph.tasks)if(['pending','running'].includes(node.status))node.status='stopped';throw signal.reason;}
    const nodes=graph.tasks,byId=new Map(nodes.map(node=>[node.id,node]));
    let ready=nodes.filter(node=>node.status==='pending'&&node.dependsOn.every(id=>byId.get(id)?.status==='done'));
    if(ready.length){
      const selected=[],agents=new Set();for(const node of ready)if(!agents.has(node.agentId)&&selected.length<maxParallel){selected.push(node);agents.add(node.agentId);}
      await Promise.all(selected.map(async node=>{
        node.status='running';node.startedAt=Date.now();node.attempt++;await onChange(node,'started');
        try {node.result=await runTask(node,node.dependsOn.map(id=>byId.get(id)));if(signal.aborted)throw signal.reason;node.status='done';node.finishedAt=Date.now();await onChange(node,'completed');}
        catch(error){node.status=signal.aborted?'stopped':'failed';node.error=error.message;node.finishedAt=Date.now();await onChange(node,'failed');}
      }));continue;
    }
    if(signal.aborted){for(const node of nodes)if(node.status==='pending')node.status='stopped';throw signal.reason;}
    if(nodes.every(node=>node.status==='done'))return nodes.map(node=>`[${node.id} · ${node.agentId}]\n${node.result}`).join('\n\n');
    for(const node of nodes)if(node.status==='pending')node.status='blocked';
    await onChange(null,'blocked');
    if(!replan||graph.replans>=maxReplans)throw Error('작업 그래프에 실패 또는 검증되지 않은 작업이 남았습니다. '+nodes.filter(node=>node.error).map(node=>`${node.id}: ${node.error}`).join('; ').slice(-2000));
    const replacement=validatePlan(await replan(graph),{externalIds:nodes.filter(node=>node.status==='done').map(node=>node.id)});
    graph.history.push(structuredClone(nodes));graph.replans++;
    const prefix=`TR${graph.replans}_`,mapping=new Map(replacement.tasks.map(node=>[node.id,prefix+node.id]));
    graph.tasks=[...nodes.filter(node=>node.status==='done'),...replacement.tasks.map(node=>({...node,id:mapping.get(node.id),dependsOn:node.dependsOn.map(id=>mapping.get(id)||id)}))];
    await onChange(null,'replanned');
  }
}
