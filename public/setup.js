import { icon } from './sprites.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function renderSetup({app,api,onComplete}) {
  let status,timer,disposed=false,busy=false;
  const dispose=()=>{disposed=true;clearTimeout(timer);};
  app.innerHTML=`<main class="setup-screen"><section class="setup-card"><span class="brand-symbol">${icon('office',36)}</span><span class="eyebrow">WELCOME, BOSS</span><h1>내 사무실 연결하기</h1><p>본인 Codex 계정으로 일하고, Tailscale로 다른 컴퓨터에 연결해요.</p><div id="setup-steps"></div><p id="setup-status" role="status" aria-live="polite">연결 상태를 확인하고 있어요…</p><div class="setup-footer"><button class="button primary" data-setup="start" disabled>내 컴퓨터로 시작</button><button class="button subtle-button" data-setup="computers" disabled>컴퓨터 선택하기</button></div></section></main>`;
  const message=value=>{if(!disposed)app.querySelector('#setup-status').textContent=value;};
  function draw(){
    app.querySelector('#setup-steps').innerHTML=`<div class="setup-step"><span class="setup-number done">1</span><div><b>앱 실행 완료</b><p>작업 기록과 설정은 이 컴퓨터에 저장해요.</p></div></div><div class="setup-step"><span class="setup-number ${status.codex.ready?'done':''}">2</span><div><b>Codex 계정 연결</b><p>${escape(status.codex.message)}</p><button class="button ${status.codex.ready?'subtle-button':'primary'}" data-action="connect-codex" data-setup="codex" ${busy?'disabled':''}>${status.codex.ready?'다른 계정 연결':'Codex 연결'}</button></div></div><div class="setup-step"><span class="setup-number ${status.tailscale.connected?'done':''}">3</span><div><b>Tailscale 연결 확인</b><p>${status.tailscale.connected?'연결됐어요. 다른 컴퓨터에서 작업할 수 있어요.':status.tailscale.installed?'Tailscale 앱에서 로그인하고 연결해주세요.':'다른 컴퓨터에서 작업하려면 Tailscale을 설치해주세요.'}</p>${!status.tailscale.connected?'<button class="button subtle-button" data-setup="tailscale">Tailscale 설치·연결 안내</button>':''}<button class="small-button" data-setup="refresh" ${busy?'disabled':''}>다시 확인</button></div></div><div class="setup-step"><span class="setup-number">4</span><div><b>컴퓨터 선택 후 일 시키기</b><p>내 컴퓨터는 Tailscale 없이도 사용할 수 있어요.</p></div></div>`;
    app.querySelectorAll('[data-setup="start"],[data-setup="computers"]').forEach(button=>{button.disabled=!status.codex.ready||busy;});
  }
  async function refresh(){status=await api('setup');if(!disposed)draw();}
  async function poll(){
    if(disposed)return;
    try {
      const login=await api('codex/login');
      if(login.status==='complete'){busy=false;await refresh();message('Codex 계정이 연결됐어요. 작업할 컴퓨터를 선택해주세요.');return;}
      if(['failed','cancelled'].includes(login.status)){busy=false;await refresh();message(login.error||'로그인을 취소했어요.');return;}
      timer=setTimeout(poll,1000);
    }catch(error){busy=false;await refresh().catch(()=>{});message(error.message);}
  }
  app.querySelector('.setup-card').addEventListener('click',async event=>{
    const button=event.target.closest('[data-setup]');if(!button||button.disabled)return;
    try {
      const action=button.dataset.setup;
      if(action==='tailscale'){await window.pxDesktop.openExternal('https://tailscale.com/download');return;}
      if(action==='refresh'){await api('codex/status','POST',{});await refresh();message('연결 상태를 다시 확인했어요.');return;}
      if(action==='codex'){
        busy=true;draw();message('ChatGPT 로그인 창을 여는 중…');
        const login=await api('codex/login','POST',{});
        if(login.authUrl)await window.pxDesktop.openExternal(login.authUrl);
        message('브라우저에서 ChatGPT 로그인을 완료해주세요.');timer=setTimeout(poll,1000);return;
      }
      if(action==='start'||action==='computers'){busy=true;draw();await api('setup/complete','POST',{});dispose();await onComplete(action==='computers');}
    }catch(error){busy=false;if(status&&!disposed)draw();message(error.message);}
  });
  try{await refresh();message(status.codex.ready?'계정 연결을 확인했어요. 시작할 수 있어요.':'Codex 연결 버튼으로 ChatGPT 계정에 로그인해주세요.');}catch(error){message(error.message);}
  return dispose;
}
