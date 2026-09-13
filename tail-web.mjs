import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
const exec=promisify(execFile);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function tailscaleAddress(binary) {
  if(!binary)throw new Error('Tailscale가 설치되어 있지 않습니다.');
  const {stdout}=await exec(binary,['ip','-4'],{timeout:8000,maxBuffer:4096});
  const ip=stdout.trim().split(/\s+/).find(value=>/^100\.(?:\d{1,3}\.){2}\d{1,3}$/.test(value)&&Number(value.split('.')[1])>=64&&Number(value.split('.')[1])<=127);
  if(!ip)throw new Error('Tailscale 연결을 확인해주세요.');
  return ip;
}

export function reportHtml(task) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(task.title)} · tail웹</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f6f0;color:#233029;font-family:system-ui,sans-serif;line-height:1.8}main{max-width:1000px;margin:auto;padding:48px 24px}header{margin-bottom:32px}h1{font-size:clamp(24px,5vw,40px);line-height:1.4;overflow-wrap:anywhere}h2{font-size:20px}section{background:white;border:1px solid #dce4d6;border-radius:16px;padding:24px;margin:20px 0}.badge{display:inline-block;border-radius:30px;background:#dfecd5;padding:4px 14px;font-size:13px;font-weight:700}.meta,footer{color:#647064;font-size:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:0}footer{margin-top:32px}@media print{body{background:white}main{padding:0}section{break-inside:avoid}}</style></head><body><main><header><span class="badge">tail웹 · ${task.runMode==='demo'?'데모 결과':'연구·실행 결과'}</span><h1>${escape(task.title)}</h1><p class="meta">${escape(task.computerName)} · ${escape(new Date(task.finishedAt||Date.now()).toLocaleString('ko-KR'))} · ${{done:'완료',failed:'오류',stopped:'중지'}[task.status]||'진행 중'}</p></header><section><h2>작업 요청</h2><pre>${escape(task.description)}</pre></section><section><h2>결과 보고</h2><pre>${escape(task.result||task.error||'결과 없음')}</pre></section>${task.workerResult&&task.workerResult!==task.result?`<section><h2>담당자 실행 결과</h2><pre>${escape(task.workerResult)}</pre></section>`:''}<footer>PX OFFICE · Tailscale 공유 보고서</footer></main></body></html>`;
}

export function createTailWeb({binary,port,getTasks,getAddress=()=>tailscaleAddress(binary),onAddressChange=()=>{}}) {
  let server,address,pending,closed=false;
  async function listen() {
    if(closed)throw new Error('공유 서버가 종료되었습니다.');
    const next=await getAddress();
    if(server?.listening&&next===address)return;
    if(server)await new Promise(resolve=>server.close(resolve));
    const candidate=http.createServer((req,res)=>{
      const token=/^\/tailweb\/([a-f0-9]{48})\/?$/.exec((req.url||'').split('?')[0])?.[1];
      const task=token&&getTasks().find(task=>task.tailWebToken===token);
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
      res.setHeader('Cache-Control','no-store');
      if(!task||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('공유 페이지를 찾을 수 없습니다.');return;}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end(req.method==='HEAD'?undefined:reportHtml(task));
    });
    await new Promise((resolve,reject)=>{candidate.once('error',reject);candidate.listen(port,next,resolve);});
    candidate.on('error',()=>{});
    server=candidate;address=next;
    let updated=false;
    for(const task of getTasks())if(task.tailWebToken){const url=link(task.tailWebToken);if(task.tailWebUrl!==url){task.tailWebUrl=url;updated=true;}}
    if(updated)await onAddressChange();
  }
  function link(token){return `http://${address}:${server.address().port}/tailweb/${token}`;}
  function ready(){return pending||=(listen().finally(()=>{pending=null;}));}
  const timer=setInterval(()=>{if(getTasks().some(task=>task.tailWebToken))ready().catch(()=>{});},30000);timer.unref();
  return {
    ready,
    async publish(task){await ready();task.tailWebToken||=randomBytes(24).toString('hex');task.tailWebUrl=link(task.tailWebToken);task.tailWebError=null;return task.tailWebUrl;},
    async close(){closed=true;clearInterval(timer);if(pending)await pending.catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));},
  };
}
