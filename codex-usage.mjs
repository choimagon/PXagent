import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { codexEnvironment } from './codex-runner.mjs';

export function resetCreditDetails(summary) {
  const count=summary?.availableCount;
  const credits=Array.isArray(summary?.credits)?summary.credits.filter(credit=>credit?.status==='available').map(credit=>({
    expiresAt:credit.expiresAt===null?null:Number.isInteger(credit.expiresAt)&&credit.expiresAt>0?credit.expiresAt:undefined,
  })):null;
  return {resetsAvailable:Number.isInteger(count)&&count>=0?count:null,resetCredits:credits};
}

// Read-only RPCs: Codex manages authentication; no tokens leave the child process.
export async function readCodexUsage(binary, { timeoutMs = 15000 } = {}) {
  if (!binary) throw new Error('Codex가 설치되어 있지 않습니다.');
  const child = spawn(binary, ['app-server', '--stdio'], {
    env: codexEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  let nextId = 0;
  const pending = new Map();
  const rejectAll = error => { for (const request of pending.values()) request.reject(error); pending.clear(); };
  child.on('error', rejectAll);
  child.on('exit', () => rejectAll(new Error('사용량 조회 연결이 종료되었습니다.')));
  child.stdin.on('error', rejectAll);
  child.stderr.resume();
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error('구독 사용량을 조회하지 못했습니다.'));
    else request.resolve(message.result);
  });
  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }) + '\n');
    });
  }
  const timer = setTimeout(() => { rejectAll(new Error('사용량 조회 시간이 초과되었습니다.')); child.kill(); }, timeoutMs);
  try {
    await rpc('initialize', { clientInfo: { name: 'pxagents', title: 'PX Office', version: '1.0.0' }, capabilities: { experimentalApi: true } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const account = (await rpc('account/read', { refreshToken: false })).account;
    if (account?.type !== 'chatgpt') throw new Error('ChatGPT 구독 계정으로 로그인해주세요.');
    const limits = await rpc('account/rateLimits/read');
    const buckets = limits.rateLimitsByLimitId && Object.keys(limits.rateLimitsByLimitId).length ? Object.values(limits.rateLimitsByLimitId) : [limits.rateLimits];
    const windows = buckets.filter(Boolean).flatMap(bucket => ['primary', 'secondary'].flatMap(key => {
      const window = bucket[key];
      if (!window || !Number.isFinite(window.usedPercent)) return [];
      return [{ bucket: bucket.limitId || 'codex', name: bucket.limitName || '', usedPercent: window.usedPercent, windowDurationMins: window.windowDurationMins, resetsAt: window.resetsAt }];
    }));
    return { available: true, email: account.email || '', planType: account.planType || '', windows, ...resetCreditDetails(limits.rateLimitResetCredits), checkedAt: Date.now() };
  } finally {
    clearTimeout(timer); lines.close(); child.stdin.end(); child.kill();
  }
}
