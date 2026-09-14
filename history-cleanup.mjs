import { officeId } from './public/offices.js';
const terminalTasks = new Set(['done','failed','stopped']);
const terminalGoals = new Set(['done','blocked','stopped']);
export function cleanupPlan(state, {officeId:scope='local',kind,cutoff=null}, activeIds=new Set()) {
  const tasks=new Map(state.tasks.map(t=>[t.id,t]));
  const belongs=item=>officeId(tasks.get(item.taskId)||item.machineId||item.officeId)==scope;
  const old=timestamp=>cutoff===null||Number(timestamp)<cutoff;
  const safeTask=t=>terminalTasks.has(t.status)&&!activeIds.has(t.id)&&(!t.goalId||terminalGoals.has(state.goals.find(g=>g.id===t.goalId)?.status));
  const plan={scope,kind,cutoff,letters:[],tasks:[],goals:[],logs:[]};
  if(kind==='letters') plan.letters=state.letters.filter(l=>belongs(l)&&old(l.createdAt)).map(l=>l.id);
  else if(kind==='logs') plan.logs=state.logs.filter(l=>belongs(l)&&old(l.at)).map(l=>l.id);
  else if(kind==='tasks') {
    plan.tasks=state.tasks.filter(t=>officeId(t)===scope&&safeTask(t)&&old(t.finishedAt||t.createdAt)).map(t=>t.id);
    const removed=new Set(plan.tasks);
    plan.goals=state.goals.filter(g=>officeId(g)===scope&&terminalGoals.has(g.status)&&old(g.finishedAt||g.createdAt)&&state.tasks.filter(t=>t.goalId===g.id).every(t=>removed.has(t.id))).map(g=>g.id);
  }
  return plan;
}
export function cleanupCounts(plan) {return Object.fromEntries(['letters','tasks','goals','logs'].map(key=>[key,plan[key].length]));}
export function applyCleanup(state,plan,activeIds=new Set()) {
  const eligible=cleanupPlan(state,{officeId:plan.scope,kind:plan.kind,cutoff:plan.cutoff},activeIds);
  const removed={...plan};
  for(const key of ['letters','tasks','goals','logs']) {
    const allowed=new Set(eligible[key]);
    removed[key]=plan[key].filter(id=>allowed.has(id));
  }
  if(plan.kind==='letters') {
    const ids=new Set(removed.letters);
    const taskIds=new Set(state.letters.filter(l=>ids.has(l.id)).map(l=>l.taskId));
    for(const task of state.tasks)if(taskIds.has(task.id))task.reportDeleted=true;
  }
  for(const key of ['letters','tasks','goals','logs']){const ids=new Set(removed[key]);state[key]=state[key].filter(item=>!ids.has(item.id));}
  return cleanupCounts(removed);
}
