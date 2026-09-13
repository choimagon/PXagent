import { spawn } from 'node:child_process';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.env.PORT || '3210';
const url = `http://127.0.0.1:${port}`;
const data = process.env.DATA_DIR || path.join(root, 'data');
const lock = path.join(data, '.launcher-lock');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready() {
  try {
    const response = await fetch(`${url}/api/auth`, { signal: AbortSignal.timeout(800) });
    const auth = await response.json();
    const page = await fetch(url, { signal: AbortSignal.timeout(800) });
    return response.ok && typeof auth.authenticated === 'boolean' && (await page.text()).includes('PX');
  } catch { return false; }
}
let ownsLock = false;
try {
  await mkdir(data, { recursive: true });
  if (!await ready()) {
    for (let i = 0; i < 150; i++) {
      try { await mkdir(lock); ownsLock = true; break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() - (await stat(lock)).mtimeMs > 60000) await rm(lock, { recursive: true, force: true });
        if (await ready()) break;
        await sleep(200);
      }
    }
    if (ownsLock && !await ready()) {
      const log = await open(path.join(data, 'launcher.log'), 'a');
      const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'server.mjs'], {
        cwd: root, env: process.env, detached: true, stdio: ['ignore', log.fd, log.fd],
      });
      child.unref();
      await log.close();
    }
    for (let i = 0; i < 150 && !await ready(); i++) await sleep(200);
    if (!await ready()) throw new Error(`서버를 시작하지 못했습니다. ${path.join(data, 'launcher.log')}를 확인하세요.`);
  }
  const browser = spawn('/usr/bin/open', [url], { stdio: 'ignore' });
  await new Promise((resolve, reject) => { browser.on('error', reject); browser.on('exit', code => code === 0 ? resolve() : reject(new Error('사이트를 열지 못했습니다.'))); });
} catch (error) {
  console.error(error.message);
  const dialog = spawn('/usr/bin/osascript', ['-e', `display alert "PXagents 실행 오류" message ${JSON.stringify(error.message)}`], { stdio: 'ignore' });
  await new Promise(resolve => dialog.on('exit', resolve));
  process.exitCode = 1;
} finally {
  if (ownsLock) await rm(lock, { recursive: true, force: true });
}
