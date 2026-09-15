import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
export const CODEX_PERMISSIONS = Object.freeze({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' });
// Reuse Codex's own account storage; never copy tokens into the office app.
export function codexEnvironment() {
  const allowed = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT', 'PATH', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'CODEX_HOME', 'ELECTRON_RUN_AS_NODE', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'];
  return Object.fromEntries(allowed.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
}

export async function findCodex() {
  const name = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const candidates = process.env.CODEX_BIN ? [process.env.CODEX_BIN] : [
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, name)),
    path.join(homedir(), '.local', 'bin', name), ...(process.env.PX_BUNDLED_CODEX?[process.env.PX_BUNDLED_CODEX]:[]), '/Applications/Codex.app/Contents/Resources/codex',
    '/Applications/ChatGPT.app/Contents/Resources/codex',
  ];
  const binaries = [];
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); const binary = await realpath(candidate); if (!binaries.includes(binary)) binaries.push(binary); } catch {}
  }
  if (process.env.CODEX_BIN || binaries.length < 2) return binaries[0] || null;
  const versions = await Promise.all(binaries.map(async binary => {
    try {
      const result = await exec(binary, ['--version'], { env: codexEnvironment(), timeout: 5000, maxBuffer: 64000, windowsHide: true });
      const match = result.stdout.match(/(\d+)\.(\d+)\.(\d+)/);
      return { binary, version: match ? match.slice(1).map(Number) : [0, 0, 0] };
    } catch { return { binary, version: [0, 0, 0] }; }
  }));
  versions.sort((a, b) => b.version[0]-a.version[0] || b.version[1]-a.version[1] || b.version[2]-a.version[2]);
  return versions[0]?.binary || null;
}

export async function codexStatus(binary) {
  if (!binary) return { installed: false, ready: false, auth: 'missing', message: '실행 PC에 Codex CLI를 설치해주세요.' };
  try {
    const options = { env: codexEnvironment(), timeout: 10_000, maxBuffer: 64_000, windowsHide: true };
    const version = (await exec(binary, ['--version'], options)).stdout.trim();
    let login;
    try { const result = await exec(binary, ['login', 'status'], options); login = result.stdout + result.stderr; }
    catch (error) { login = (error.stdout || '') + (error.stderr || ''); }
    const ready = /Logged in using ChatGPT/i.test(login);
    const auth = ready ? 'chatgpt' : /API key/i.test(login) ? 'api-key' : 'logged-out';
    return { installed: true, ready, version, auth, message: ready ? 'ChatGPT 구독 로그인 연결됨' : '실행 PC에서 codex login으로 ChatGPT 계정에 로그인해주세요.' };
  } catch {
    return { installed: true, ready: false, auth: 'error', message: 'Codex를 실행할 수 없습니다. 설치 또는 CODEX_BIN 경로를 확인해주세요.' };
  }
}

export async function workingDirectory(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || value.includes('\0')) throw new Error('작업 폴더의 절대 경로를 입력해주세요.');
  const expanded = value.trim().replace(/^~(?=[/\\]|$)/, homedir());
  if (!path.isAbsolute(expanded)) throw new Error('작업 폴더는 실행 PC의 절대 경로여야 합니다.');
  let directory;
  try { directory = await realpath(expanded); if (!(await stat(directory)).isDirectory()) throw new Error(); }
  catch { throw new Error('실행 PC에 존재하는 작업 폴더를 입력해주세요.'); }
  return directory;
}

export function foldersOverlap(a, b) {
  if (!a || !b) return false;
  const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
  return inside(a, b) || inside(b, a);
}

export async function runCodex({ binary, directory, model, reasoningEffort, fastMode = false, prompt, signal, schema, extraEnv = {}, sandboxMode = CODEX_PERMISSIONS.sandboxMode, onEvent = () => {}, timeoutMs = 30 * 60_000, maxTokens }) {
  if (signal.aborted) throw signal.reason;
  // Load installed skills/plugins and their MCP dependencies from the user's Codex config.
  // Office execution settings still override the corresponding user preferences.
  const args = ['exec', '--json', '--color', 'never', '--skip-git-repo-check', '--sandbox', sandboxMode, '-C', directory, '-m', model,
    '-c', 'model_provider="openai"', '-c', `approval_policy=${JSON.stringify(CODEX_PERMISSIONS.approvalPolicy)}`, '-c', 'forced_login_method="chatgpt"', '-c', `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`];
  args.push('-c', `features.fast_mode=${fastMode}`, '-c', `service_tier=${fastMode ? '"fast"' : '"default"'}`);
  if (schema) args.push('--output-schema', schema);
  args.push('-');
  if (signal.aborted) throw signal.reason;
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: directory, env: { ...codexEnvironment(), ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true });
    let buffer = '', stderr = '', result = '', failure = '', threadId = null, usage = null, completed = false, stopReason, killTimer;
    let eventChain = Promise.resolve();
    function kill(force = false) {
      if (!child.pid) return;
      try { if (process.platform === 'win32') execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{}); else process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); } catch {}
    }
    function stop(reason) { if (stopReason) return; stopReason = reason; kill(); killTimer = setTimeout(() => kill(true), 2000); }
    const onAbort = () => stop(signal.reason || new Error('작업이 중지되었습니다.'));
    signal.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => stop(new Error(`Codex 작업 시간이 ${Math.ceil(timeoutMs/60000)}분을 초과했습니다. 작업을 나누어 다시 맡겨주세요.`)), timeoutMs);
    function event(line) {
      let value; try { value = JSON.parse(line); } catch { return; }
      if (value.type === 'thread.started') threadId = value.thread_id;
      if (value.type === 'item.completed' && value.item?.type === 'agent_message') result = value.item.text || result;
      if (value.type === 'turn.completed') { completed = true; usage = value.usage;if(maxTokens!==undefined&&(usage?.input_tokens||0)+(usage?.output_tokens||0)>maxTokens)stop(new Error('AutoResearch 토큰 제한에 도달했습니다.')); }
      if (value.type === 'turn.failed' || value.type === 'error') failure = value.error?.message || value.message || 'Codex 실행 오류';
      eventChain = eventChain.then(() => onEvent(value)).catch(error => stop(error));
    }
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let index; while ((index = buffer.indexOf('\n')) >= 0) { event(buffer.slice(0, index)); buffer = buffer.slice(index + 1); }
      if (buffer.length > 2_000_000) stop(new Error('Codex 출력이 너무 큽니다. 출력 범위를 줄여주세요.'));
    });
    child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16_000); });
    child.stdin.on('error', () => {});
    child.stdin.end(`${prompt}\n\n[SKILL USAGE]\n사용자가 $skill-name으로 지정한 설치된 Skill은 해당 SKILL.md를 읽고 적용하세요. 현재 요청에 맞는 설치된 Skill도 설명과 호출 정책에 따라 선택하세요. Skill의 scripts·references·assets 경로는 그 SKILL.md가 있는 폴더를 기준으로 해석하세요. 사용한 Skill과 실제 실행 결과를 보고하세요. 사용자가 지정한 실제 파일 경로와 수정 요청을 따르세요. 작업 폴더 밖의 파일도 요청에 필요하면 직접 읽고 수정할 수 있습니다. 연결 도구 실행이 실패하면 실제 오류를 보고하세요.`);
    child.on('error', error => { failure = error.code === 'ENOENT' ? 'Codex 실행 파일을 찾을 수 없습니다.' : 'Codex 프로세스를 시작할 수 없습니다.'; });
    child.on('close', async code => {
      if (stopReason) kill(true);
      clearTimeout(timeout); clearTimeout(killTimer); signal.removeEventListener('abort', onAbort);
      if (buffer.trim()) event(buffer);
      await eventChain;
      if (stopReason || signal.aborted) return reject(stopReason || signal.reason);
      if (code !== 0 || !completed || !result.trim()) {
        // Authentication credentials are never included in the error response.
        const diagnostic = (failure || stderr.split('\n').find(line => /^error:/i.test(line)) || 'Codex가 결과를 반환하지 않았습니다. 로그인·모델 설정을 확인해주세요.')
          .replace(/(?:Bearer\s+)[\w.\-]+|sk-[\w-]+/gi, '[비공개]').slice(0, 1800);
        return reject(new Error(diagnostic));
      }
      resolve({ text: result, threadId, usage });
    });
  });
}
