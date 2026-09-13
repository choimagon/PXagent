import { randomUUID } from 'node:crypto';

export function ensureOfficeFeatures(state) {
  state.goals ||= [];
  state.letters ||= [];
  for (const task of state.tasks) {
    if (['done', 'failed', 'stopped'].includes(task.status) && (task.result || task.error) && !state.letters.some(letter => letter.taskId === task.id)) postTaskReport(state, task, state.goals.find(goal => goal.id === task.goalId));
  }
  state.schemaVersion = 5;
}

export function postTaskReport(state, task, goal = null) {
  const outcome = goal?.status;
  const subject = goal ? `${outcome === 'done' ? 'Goal 달성' : outcome === 'blocked' ? 'Goal 진행 중단' : outcome === 'stopped' ? 'Goal 중지' : `Goal ${task.goalRound}차 진행 보고`} · ${goal.title}` : `${task.status === 'done' ? '작업 완료' : task.status === 'failed' ? '작업 오류' : '작업 중지'} · ${task.title}`;
  const content = task.result || `${task.error || '작업을 중지했습니다.'}${task.workerResult ? '\n\n담당 에이전트의 결과:\n' + task.workerResult : ''}`;
  const letter = { machineId:task.machineId||null, id: randomUUID(), taskId: task.id, goalId: goal?.id || task.goalId || null, senderId: goal ? 'chief' : task.agentId, subject, body: content, tailWebUrl:task.tailWebUrl||null, tailWebError:task.tailWebError||null, status: task.status, goalOutcome: outcome || null, runMode: task.runMode, modelUsed: task.modelUsed || null, reasoningUsed: task.reasoningUsed || null, workingDirectory: task.remoteDirectory || task.workingDirectory, computerName: task.computerName || null, createdAt: task.finishedAt || Date.now(), readAt: null };
  state.letters.push(letter);
  return letter;
}

export function goalTask(goal) {
  const round = ++goal.round;
  const description = `[Goal · ${round}차 실행]\n목표: ${goal.description}\n완료 기준: ${goal.successCriteria || '사장님 요청의 모든 요구 사항을 실제 수행하고 검증할 것'}\n${goal.nextInstruction ? '\n이번 회차 지시: ' + goal.nextInstruction : ''}${goal.lastSummary ? '\n이전 회차 검토: ' + goal.lastSummary.slice(-6000) : ''}\n목표 달성을 위해 필요한 작업을 수행하고 실제 결과와 검증 근거를 보고하세요.`;
  const task = { id: randomUUID(), goalId: goal.id, goalRound: round, tailWeb:goal.tailWeb===true, title: `${goal.title} · Goal ${round}차`, description, agentId: 'chief', machineId:goal.machineId,remoteComputer:goal.remoteComputer,remoteDirectory:goal.remoteDirectory,parentTaskId: goal.parentTaskId, previousContext: goal.previousContext, workingDirectory: goal.workingDirectory, status: 'queued', progress: 0, createdAt: Date.now(), priority: 'normal', result: '', steps: [] };
  goal.currentTaskId = task.id;
  return task;
}

export function parseGoalAssessment(value) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let result;
  try { result = JSON.parse(cleaned); } catch { throw new Error('호문클루스의 Goal 달성 검토를 해석할 수 없습니다.'); }
  if (typeof result.achieved !== 'boolean' || typeof result.blocked !== 'boolean' || (result.achieved && result.blocked) || typeof result.summary !== 'string' || !result.summary.trim() || typeof result.nextInstruction !== 'string' || (!result.achieved && !result.blocked && !result.nextInstruction.trim())) throw new Error('Goal 검토 결과에 달성 여부·보고·후속 지시가 필요합니다.');
  return { achieved: result.achieved, blocked: result.blocked, summary: result.summary.trim(), nextInstruction: result.nextInstruction.trim() };
}

export function continuationContext(state, taskId) {
  if (!taskId) return {};
  const source = state.tasks.find(task => task.id === taskId);
  if (!source) throw Object.assign(new Error('이전 작업을 찾을 수 없습니다.'), { status: 404 });
  if (!['done', 'failed', 'stopped'].includes(source.status)) throw Object.assign(new Error('이전 작업이 종료된 뒤 이어서 작업할 수 있습니다.'), { status: 409 });
  const history = [], seen = new Set();
  let task = source;
  while (task && history.length < 6 && !seen.has(task.id)) {
    seen.add(task.id);
    history.unshift(`[이전 작업: ${task.title}]\n작업 대상: ${task.remoteComputer?.name||task.computerName||'이 컴퓨터'}\n작업 폴더: ${task.remoteDirectory || task.workingDirectory}\n요청: ${task.description.slice(0, 2000)}\n결과: ${(task.result || task.workerResult || task.error || '결과 없음').slice(-4000)}`);
    task = state.tasks.find(item => item.id === task.parentTaskId);
  }
  return { tailWeb:source.tailWeb===true, machineId:source.machineId,remoteDirectory:source.remoteDirectory,parentTaskId: source.id, previousContext: history.join('\n\n').slice(-24000), workingDirectory: source.workingDirectory };
}
