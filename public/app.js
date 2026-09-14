import { FIXED_AGENT_IDS, AGENT_PRESETS, agentPresetValues } from './agent-presets.js';
import { renderSetup } from './setup.js';
import { avatar as characterAvatar, sprite, CHARACTER_CATALOG, icon } from './sprites.js';
import { officeMarkup } from './office.js';
import { projectOffice, officeId } from './offices.js';
import { MODEL_CATALOG, REASONING_LEVELS } from './models.js';

function avatar(id,size=42) {
  const appearance = state?.agents.find(agent=>agent.id===id)?.appearance || id;
  return characterAvatar(appearance,size);
}
function editableName(a) {
  return `<h2 class="editable-agent-name"><span data-agent-heading-name>${esc(a.name)}</span><button type="button" class="icon-button" data-action="edit-character" data-id="${a.id}" aria-label="이름과 캐릭터 수정" title="이름과 캐릭터 수정">${icon('pencil',21.6)}</button></h2>`;
}
function editCharacter(id) {
  const a={...agentById(id),...saveEntry(id)?.draft};
  openModal(`<h2>이름과 캐릭터 수정</h2><form id="character-form" data-id="${id}"><label class="field-label" for="character-name">이름</label><input id="character-name" name="name" value="${esc(a.name)}" maxlength="40" required><label class="field-label">캐릭터</label><div class="character-picker">${Object.entries(CHARACTER_CATALOG).map(([key,label])=>`<label class="character-choice"><input type="radio" name="appearance" value="${key}" ${(a.appearance||id)===key?'checked':''} required><span>${characterAvatar(key,64)}<small>${label}</small></span></label>`).join('')}</div><div class="modal-footer"><button type="button" class="button subtle-button" data-action="agent-details" data-id="${id}">취소</button><button type="submit" class="button primary">저장하기</button></div></form>`);
}
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const profiles = Object.fromEntries(Object.entries(MODEL_CATALOG).map(([key, model])=>[key, model.label]));
const labels = { queued: '대기 중', running: '실행 중', reviewing: '보고 준비', done: '완료', stopped: '중지됨', failed: '오류' };
let rawState, state, view = 'office', selectedAgent = 'chief', query = '', filter = 'all', connected = false;
let setupCleanup;
let events, toastTimer, muted = localStorage.getItem('px-muted') === 'true';
let seenReports = new Set(), modalTaskId = null, modalTaskSignature = '';
let mailboxFilter = 'all', taskStatusFilter = 'all';
let sidebarOpen = localStorage.getItem('px-sidebar-open') !== 'false';
let leftSidebarOpen = localStorage.getItem('px-left-sidebar-open') !== 'false';
let accountUsage=null, accountUsageRequest;
function usageContent() {
  if (!accountUsage) return '<p class="usage-notice">구독 정보를 확인하고 있어요.</p>';
  if (!accountUsage.available) return `<p class="usage-notice">${esc(accountUsage.message)}</p>`;
  return `<div class="usage-account"><b>${esc(accountUsage.planType.toUpperCase())}</b><span>${esc(accountUsage.email)}</span></div>${accountUsage.windows.map(window=>{
    const mins=window.windowDurationMins;
    const period=mins>=1440?`${Math.round(mins/1440)}일`:mins>=60?`${Math.round(mins/60)}시간`:`${mins}분`;
    const used=Math.max(0,Math.min(100,window.usedPercent));
    return `<div class="usage-window"><div><span>${esc(window.name || 'Codex')} · ${period}</span><b>${used}% 사용</b></div><div class="usage-meter"><i style="width:${used}%"></i></div>${window.resetsAt?`<small>${new Date(window.resetsAt*1000).toLocaleString('ko-KR')} 갱신</small>`:''}</div>`;
  }).join('')}<div class="usage-resets"><span>초기화권</span><b>${accountUsage.resetsAvailable===null?'조회 불가':`${accountUsage.resetsAvailable}개`}</b></div><small class="usage-updated">${time(accountUsage.checkedAt)} 확인 · 1분마다 갱신</small>`;
}
function updateAccountUsage() {
  const content=document.querySelector('#account-usage-content');
  if(content) content.innerHTML=usageContent();
  const details=document.querySelector('#usage-details-content');
  if(details) details.innerHTML=usageContent();
}
async function refreshAccountUsage() {
  if(accountUsageRequest) return accountUsageRequest;
  accountUsageRequest=api('codex/usage').then(usage=>{accountUsage=usage;}).catch(()=>{accountUsage={available:false,message:'사용량을 조회하지 못했습니다.'};}).finally(()=>{accountUsageRequest=null;updateAccountUsage();});
  return accountUsageRequest;
}
function usageDetails() {
  openModal(`<h2>구독 사용량</h2><div id="usage-details-content">${usageContent()}</div><div class="modal-footer"><button class="button subtle-button" data-action="refresh-usage">${icon('refresh',16)}새로고침</button></div>`);
}
let selectedComputerId=localStorage.getItem('px-target-computer')||'local';
let computerSelectionRevision=0;
function applyOffice() {
  if(!rawState)return;
  if(rawState.deletedOffices?.[selectedComputerId]) {
    const deleted=selectedComputerId;
    for(const [key,entry] of agentSaves)if(entry.officeId===deleted){clearTimeout(entry.timer);agentSaves.delete(key);}
    modal.close();selectedComputerId='local';localStorage.setItem('px-target-computer','local');selectedAgent='chief';
  }
  state=projectOffice(rawState,selectedComputerId);
  const computer=computerList.computers.find(computer=>computer.id===selectedComputerId);if(computer)state.office.name=computer.name;
}

function selectOffice(id) {
  flushAgentForm();modal.close();
  selectedComputerId=id;localStorage.setItem('px-target-computer',id);
  selectedAgent='chief';query='';filter='all';mailboxFilter='all';taskStatusFilter='all';
  applyOffice();renderView();update();updateSidebar();
}
let computerList={computers:[],message:'컴퓨터를 확인하고 있어요.'},computersRequest;
function updateComputers() {
  const localSelected=selectedComputerId==='local';
  const statusDot=online=>`<i class="computer-status ${online?'online':'offline'}" role="img" aria-label="${online?'온라인':'오프라인'}"></i>`;
  const rows=`<div class="computer-row ${localSelected?'selected':''}"><button class="computer-select" data-action="select-computer" data-id="local" aria-pressed="${localSelected}" title="${esc(state.computer.name)}">${statusDot(true)}${icon('monitor',18)}<span><b>${esc(state.computer.name)}</b><small>이 컴퓨터 · 온라인</small></span></button></div>`+computerList.computers.map(computer=>{
    const platform=({linux:'Linux',windows:'Windows',macos:'macOS',darwin:'macOS'})[computer.platform]||computer.platform;
    const credentials=[computer.username,computer.hasSudoPassword?'비번 저장됨':''].filter(Boolean).join('_')||'None';
    return `<div class="computer-row ${selectedComputerId===computer.id?'selected':''}"><button class="computer-select" data-action="select-computer" data-id="${esc(computer.id)}" aria-pressed="${selectedComputerId===computer.id}" ${!computer.terminalSupported?'disabled':''} title="${esc(computer.name)}">${statusDot(computer.online)}${icon('monitor',18)}<span><b>${esc(computer.name)}</b><small>${esc(platform)} · <em class="computer-state ${computer.online?'online':'offline'}">${computer.online?'온라인':'오프라인'}</em> | ${esc(credentials)}${!computer.terminalSupported?' · 터미널 미지원':''}</small></span></button><button class="icon-button computer-settings" data-action="computer-settings" data-id="${esc(computer.id)}" aria-label="${esc(computer.name)} 접속 설정" title="접속 설정">${icon('settings',18)}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-computer-list]').forEach(list=>{list.innerHTML=rows+(!computerList.computers.length?`<p class="computer-list-notice">${esc(computerList.message || 'Tailscale에 연결된 다른 컴퓨터가 없어요.')}</p>`:'');});
  const selected=computerList.computers.find(computer=>computer.id===selectedComputerId);
  const name=document.querySelector('#computer-name');
  if(name) {name.textContent=localSelected?state.computer.name:selected?.name||'선택한 컴퓨터 확인 중';name.parentElement.title=localSelected?'이 컴퓨터에서 작업':`${selected?.name||selectedComputerId} · Tailscale 터미널로 작업`;}
}
async function refreshComputers() {
  if(computersRequest)return computersRequest;
  computersRequest=api('computers').then(result=>{computerList=result;}).catch(()=>{computerList={computers:[],message:'컴퓨터 목록을 조회하지 못했습니다.'};}).finally(()=>{computersRequest=null;applyOffice();if(document.querySelector('#main'))update();else updateComputers();});
  return computersRequest;
}
function computerSettings(id) {
  const computer=computerList.computers.find(computer=>computer.id===id);if(!computer)return;
  openModal(`<h2>${esc(computer.name)} 접속 설정</h2><form id="computer-settings-form" data-id="${esc(id)}"><label class="field-label" for="remote-username">계정 이름</label><input id="remote-username" name="username" value="${esc(computer.username)}" required maxlength="64" autocomplete="username" placeholder="이 컴퓨터에 로그인할 계정"><label class="field-label" for="remote-sudo-password">sudo 비밀번호</label><input id="remote-sudo-password" type="password" name="sudoPassword" maxlength="1024" autocomplete="new-password" placeholder="${computer.hasSudoPassword?'저장됨 · 비워두면 유지':'SSH 비밀번호 로그인·관리자 권한에 사용'}">${computer.hasSudoPassword?'<label class="clear-sudo-password"><input type="checkbox" name="clearSudoPassword">저장된 sudo 비밀번호 삭제</label>':''}<div class="modal-footer"><button class="button primary" type="submit">저장하기</button></div></form>`);
}
function letterBody(content) {
  let body = esc(content);
  for (const agent of state.agents) body = body.split(esc(agent.name)).join(`<strong class="letter-agent-name">${esc(agent.name)}</strong>`);
  return body;
}
function updateSidebar() {
  const sidebar = document.querySelector('#agent-sidebar');
  sidebar.hidden = !sidebarOpen;
  const button = document.querySelector('[data-action="toggle-sidebar"]');
  button.setAttribute('aria-expanded',String(sidebarOpen));
  button.setAttribute('aria-label',sidebarOpen?'오른쪽 사이드바 닫기':'오른쪽 사이드바 열기');
  button.title = button.getAttribute('aria-label');
  document.querySelector('#navigation-sidebar').hidden = !leftSidebarOpen;
  document.querySelector('.layout').classList.toggle('rail-collapsed',!leftSidebarOpen);
  const leftButton = document.querySelector('[data-action="toggle-left-sidebar"]');
  leftButton.setAttribute('aria-expanded',String(leftSidebarOpen));
  leftButton.setAttribute('aria-label',leftSidebarOpen?'왼쪽 사이드바 닫기':'왼쪽 사이드바 열기');
  leftButton.title = leftButton.getAttribute('aria-label');
}
let modalGoalId = null, modalGoalSignature = '';
const agentSaves = new Map();
function saveEntry(id,scope=selectedComputerId){return agentSaves.get(`${scope}:${id}`);}
const editSession = crypto.randomUUID();
let editRevision = 0;
const goalLabels = { queued:'대기 중', running:'목표 진행 중', reviewing:'달성 검토', done:'목표 달성', stopped:'중지됨', blocked:'진행 중단' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const time = date => new Date(date).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false });
const running = task => ['running', 'reviewing'].includes(task.status);
const agentById = id => state.agents.find(a => a.id === id);
function duration(task) {
  if (!task.startedAt) return '아직 시작 전';
  const s = Math.floor(((task.finishedAt || Date.now()) - task.startedAt) / 1000);
  return s < 60 ? `${Math.max(0,s)}초` : `${Math.floor(s/60)}분 ${s%60}초`;
}
function toast(message, error = false) {
  const el = document.querySelector('#toast'); clearTimeout(toastTimer);
  el.textContent = message; el.className = `visible${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => { el.className = ''; }, 3500);
}
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api/${path}`, { method, keepalive: method === 'PATCH' && path.startsWith('agents/'), headers: { 'Content-Type':'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'auth') { events?.close(); loginScreen(); }
    throw new Error(result.error || '요청에 실패했습니다.');
  }
  return result;
}
let audioContext, keyboardBuffer, keyboardBufferRequest, keyboardPlayback;
function officeAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume().then(updateKeyboardSound).catch(() => {});
    return audioContext;
  } catch { return null; }
}
function sound() {
  if (muted) return;
  const ctx = officeAudio(); if (!ctx || ctx.state !== 'running') return;
  [0,.16,.32].forEach((offset,i) => {
    const oscillator=ctx.createOscillator(), gain=ctx.createGain(), start=ctx.currentTime+offset;
    oscillator.type='sine'; oscillator.frequency.value=[523,659,784][i];
    gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.45,start+.012);
    gain.gain.exponentialRampToValueAtTime(.001,start+.22);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start+.23);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  });
}
function stopKeyboardSound() {
  if(!keyboardPlayback)return;
  const {source,gain}=keyboardPlayback;keyboardPlayback=null;
  gain.gain.setValueAtTime(gain.gain.value,audioContext.currentTime);
  gain.gain.linearRampToValueAtTime(0,audioContext.currentTime+.025);
  source.stop(audioContext.currentTime+.03);
}
function updateKeyboardSound() {
  if (muted || document.hidden || view!=='office' || !connected || !state?.agents.some(agent=>agent.status==='running')) {stopKeyboardSound();return;}
  const ctx=officeAudio();if(!ctx||ctx.state!=='running'||keyboardPlayback)return;
  if(!keyboardBuffer) {
    keyboardBufferRequest ||= fetch('/assets/keyboard-typing-grcekh-546164.mp3').then(response=>{
      if(!response.ok)throw new Error('키보드 녹음을 불러올 수 없습니다.');
      return response.arrayBuffer();
    }).then(bytes=>ctx.decodeAudioData(bytes)).then(buffer=>{keyboardBuffer=buffer;updateKeyboardSound();}).catch(()=>{toast('키보드 소리를 불러오지 못했어요. 새로고침해주세요.',true);}).finally(()=>{keyboardBufferRequest=null;});
    return;
  }
  const source=ctx.createBufferSource(),gain=ctx.createGain();
  source.buffer=keyboardBuffer;source.loop=true;gain.gain.value=.55;
  source.connect(gain);gain.connect(ctx.destination);keyboardPlayback={source,gain};
  source.onended=()=>{source.disconnect();gain.disconnect();};source.start(ctx.currentTime);
}
document.addEventListener('pointerdown',()=>{if(!muted){officeAudio();updateKeyboardSound();}});
document.addEventListener('keydown',()=>{if(!muted){officeAudio();updateKeyboardSound();}});
document.addEventListener('visibilitychange',updateKeyboardSound);
function options(value) { return Object.entries(profiles).map(([id,label])=>`<option value="${id}"${id===value?' selected':''}>${label}</option>`).join(''); }
function reasoningOptions(profile, value) {
  const efforts = MODEL_CATALOG[profile].efforts;
  const selected = efforts.includes(value) ? value : 'medium';
  return efforts.map(effort=>`<option value="${effort}"${effort===selected?' selected':''}>${REASONING_LEVELS[effort]}</option>`).join('');
}
function modelSummary(agent) {
  const model = profiles[agent.profile];
  const effort = REASONING_LEVELS[agent.reasoningEffort].split(' · ')[1];
  return `<span class="agent-model-summary" aria-label="모델 ${model}, 추론 ${effort}"><span class="agent-model-name">${model}</span><span class="agent-reasoning-summary">추론 ${effort}</span></span>`;
}
function saveStatus(id, message, error = false,scope=selectedComputerId) {
  if(scope!==selectedComputerId)return;
  const el = id==='secretary'?document.querySelector('#secretary-save-status'):document.querySelector(`#agent-form[data-id="${id}"] #agent-save-status`);
  if (el) { el.textContent = message; el.classList.toggle('save-error', error); }
}
function queueAgentSave(form, immediate = false) {
  const id = form.dataset.id;
  const patch = Object.fromEntries(new FormData(form));
  if (!patch.name.trim()) { saveStatus(id, '이름을 입력하면 자동 저장돼요.'); return; }
  if (!patch.prompt.trim()) { saveStatus(id, '역할 지침을 입력하면 자동 저장돼요.'); return; }
  queueAgentPatch(id, patch, immediate);
}
function queueAgentPatch(id, patch, immediate = false) {
  const entry = saveEntry(id) || {agentId:id,officeId:selectedComputerId};
  if (patch.profile && !MODEL_CATALOG[patch.profile].efforts.includes(entry.draft?.reasoningEffort || agentById(id).reasoningEffort)) patch.reasoningEffort = 'medium';
  entry.draft = { ...(entry.draft || {}), ...patch };
  entry.pending = { ...(entry.pending || {}), ...patch, editSession, editRevision: ++editRevision };
  clearTimeout(entry.timer); agentSaves.set(`${selectedComputerId}:${id}`, entry); saveStatus(id, '변경 사항 저장 대기 중…');
  if (immediate) void flushAgentSave(id);
  else entry.timer = setTimeout(() => void flushAgentSave(id,entry.officeId), 450);
}
async function flushAgentSave(id,scope=selectedComputerId) {
  const entry = saveEntry(id,scope);
  if (!entry) return;
  clearTimeout(entry.timer);
  if (entry.inflight) return entry.inflight;
  if (!entry.pending) return;
  const patch = entry.pending; entry.pending = null;
  saveStatus(id, '저장 중…',false,scope);
  entry.inflight = api(`agents/${id}`, 'PATCH', {...patch,officeId:scope}).then(result => {
    const agents=rawState.offices?.[scope]?.agents||(scope==='local'?rawState.agents:[]);
    const saved=agents.find(agent=>agent.id===id);if(saved)Object.assign(saved,result.agent);
    if(scope===selectedComputerId)Object.assign(agentById(id),result.agent);
    if (!entry.pending) { entry.draft = null; entry.failed = null; saveStatus(id, '자동 저장됨',false,scope); }
    if(scope===selectedComputerId){updateAgents();updateOffice();const heading=modal.querySelector('[data-agent-heading-name]');if(heading&&(modal.querySelector(`#agent-form[data-id="${id}"]`)||(id==='secretary'&&modal.querySelector('#secretary-name'))))heading.textContent=result.agent.name;}
  }).catch(error => {
    entry.failed = patch; saveStatus(id, `저장 실패 · ${error.message}`, true,scope); toast(error.message, true);
  }).finally(() => { entry.inflight = null; if (entry.pending) void flushAgentSave(id,scope); });
  return entry.inflight;
}
function flushAgentForm() {
  if(modal.querySelector('#secretary-name') && saveEntry('secretary')?.pending) void flushAgentSave('secretary');
  const form = modal.querySelector('#agent-form');
  if (form && saveEntry(form.dataset.id)?.pending) void flushAgentSave(form.dataset.id);
}
window.addEventListener('pagehide', () => {
  for (const [id, entry] of agentSaves) {
    clearTimeout(entry.timer);
    if (entry.pending) { const patch = entry.pending; entry.pending = null; void api(`agents/${entry.agentId}`, 'PATCH', {...patch,officeId:entry.officeId}).catch(() => {}); }
  }
});
modal.addEventListener('close', flushAgentForm);
function pill(task) { return `<span class="status-pill ${task.status}"><i></i>${labels[task.status]}</span>`; }
function navItem(id,label,ico) { return `<button class="nav-item ${id==='inbox'?'mailbox-heading ':''}${view===id?'active':''}" data-view="${id}" aria-label="${label}">${icon(ico)}<span>${label}</span>${id==='tasks'?'<span class="nav-count" id="nav-task-count">0</span>':id==='inbox'?'<span class="unread-count" id="sidebar-unread-count">0</span>':''}</button>`; }

function updateMailbox() {
  const letters = [...(state.letters || [])].sort((a,b)=>b.createdAt-a.createdAt);
  const count = document.querySelector('#sidebar-unread-count');
  if (!count) return;
  const unread = letters.filter(letter=>!letter.readAt).length;
  document.querySelectorAll('.office-mail-button').forEach(button=>{
    button.querySelector('.mail-alert').hidden = unread===0;
    button.setAttribute('aria-label',`편지함 열기${unread?` · 안 읽은 편지 ${unread}개`:''}`);
  });
  count.textContent = unread; count.classList.toggle('has-unread',unread>0);
  document.querySelector('.mailbox-heading').setAttribute('aria-label',`편지함 · 안 읽은 편지 ${unread}개`);

}
function updateInbox() {
  const lists = document.querySelectorAll('#inbox-list,#modal-inbox-list'); if (!lists.length) return;
  document.querySelectorAll('[data-action="mailbox-filter"]').forEach(button=>button.classList.toggle('active',button.dataset.filter===mailboxFilter));
  const letters = [...(state.letters || [])].filter(letter=>mailboxFilter!=='unread'||!letter.readAt).sort((a,b)=>b.createdAt-a.createdAt);
  const markup = letters.length ? letters.map(letter=>`<button class="letter-card ${letter.readAt?'read':'unread'}" data-action="letter-details" data-id="${letter.id}"><span class="letter-stamp">${avatar(letter.senderId,36)}</span><span class="letter-card-top">${icon(letter.readAt?'mail-open':'mail',23)}${letter.goalId?'<span class="letter-goal-tag">GOAL</span>':''}<small>${new Date(letter.createdAt).toLocaleDateString('ko-KR')} · ${time(letter.createdAt)}</small></span><span class="letter-sender">FROM. <strong>${esc(agentById(letter.senderId)?.name || '에이전트')}</strong></span><h2>${esc(letter.subject)}</h2><p>${esc(letter.body.slice(0,170))}</p><span class="letter-card-bottom">TO. 사장님 <b>${letter.readAt?'읽은 편지':'새 편지가 도착했어요'}</b></span></button>`).join('') : `<div class="inbox-empty">${icon('mail-open',42)}<h2>${mailboxFilter==='unread'?'안 읽은 편지가 없어요':'아직 도착한 편지가 없어요'}</h2><p>작업을 맡기면 동료들이 결과를 편지로 보내요.</p></div>`;
  lists.forEach(list=>{list.innerHTML=markup;});
}
function openMailbox() {
  openModal(`<div class="mailbox-title-row"><h2>편지함</h2>${historyTrash('letters')}</div><div class="inbox-toolbar"><div class="inbox-filters"><button data-action="mailbox-filter" data-filter="all">모든 편지</button><button data-action="mailbox-filter" data-filter="unread">안 읽은 편지</button></div><button class="small-button" data-action="read-all-letters">${icon('check',15)}모두 읽음</button></div><div id="modal-inbox-list" class="inbox-list"></div>`, 'mailbox-modal');
  updateInbox();
}
async function letterDetails(id) {
  const returnToMailbox=!!modal.querySelector('.mailbox-modal');
  let letter = state.letters?.find(letter=>letter.id===id); if (!letter) return;
  if (!letter.readAt) {
    const result = await api(`letters/${id}`, 'PATCH', {read:true});
    Object.assign(state.letters.find(letter=>letter.id===id),result.letter);
    letter = result.letter; updateMailbox(); updateInbox();
  }
  openModal(`<div class="letter-modal-heading"><span class="modal-eyebrow">A LETTER FOR THE BOSS</span><span class="letter-stamp">${avatar(letter.senderId,44)}</span><h2>${esc(letter.subject)}</h2><p>보낸 이 <b>${esc(agentById(letter.senderId)?.name || '에이전트')}</b><span>${new Date(letter.createdAt).toLocaleString('ko-KR')}</span></p></div><div class="letter-greeting">사장님께,</div>${letter.runMode==='demo'?'<p class="letter-demo-note">데모 실행 보고예요.</p>':''}<pre class="letter-text">${letterBody(letter.body)}</pre>${letter.tailWebUrl?`<a class="tail-web-link button primary" href="${esc(letter.tailWebUrl)}" target="_blank" rel="noopener noreferrer">${icon('monitor',18)}웹사이트 열기</a>`:''}${letter.tailWebError?`<p class="task-error">${esc(letter.tailWebError)}</p>`:''}<div class="letter-signature">${esc(agentById(letter.senderId)?.name || '에이전트')} 드림</div><div class="letter-attachments">${letter.workingDirectory?`<span>${icon('monitor',14)}${esc(letter.computerName || state.computer.name)}<code>${esc(letter.workingDirectory)}</code></span>`:''}<button class="small-button" data-action="task-details" data-id="${letter.taskId}">${icon('tasks',14)}작업·실행 기록</button>${letter.goalId?`<button class="small-button" data-action="goal-details" data-id="${letter.goalId}">${icon('target',14)}Goal 보기</button>`:''}</div><div class="modal-footer"><button class="text-button" data-action="mark-letter-unread" data-id="${id}">${icon('mail',14)}안 읽음으로 표시</button><button class="button subtle-button" data-action="continue-task" data-id="${letter.taskId}">${icon('arrow',15)}이어서 작업</button><button class="button subtle-button" data-action="${returnToMailbox?'open-mailbox':'close-modal'}">편지 닫기</button></div>`, 'letter-modal');
}
function goalCard(goal) {
  const task = state.tasks.find(task=>task.id===goal.currentTaskId);
  return `<article class="goal-card ${goal.status}"><button class="goal-card-open" data-action="goal-details" data-id="${goal.id}"><div>${icon('target',20)}<span class="goal-status">${goalLabels[goal.status]}</span><small>${goal.round}회차</small></div><h3>${esc(goal.title)}</h3><p>${esc(task?.lastActivity || goal.lastSummary || agentById('chief').name+'가 목표를 맡았어요.')}</p>${task&&running(task)?`<div class="progress"><i style="width:${task.progress}%"></i></div>`:''}</button><div class="goal-card-actions"><span>${esc(agentById('chief').name)} · 실패 ${goal.consecutiveFailures}/3</span>${['queued','running','reviewing'].includes(goal.status)?`<button data-action="stop-goal" data-id="${goal.id}">${icon('stop',12)}중지</button>`:['stopped','blocked'].includes(goal.status)?`<button data-action="resume-goal" data-id="${goal.id}">${icon('play',12)}재개</button>`:'<span>달성 완료</span>'}</div></article>`;
}
function goalSignature(goal) {
  const task = state.tasks.find(task=>task.id===goal.currentTaskId);
  return `${goal.status}:${goal.round}:${goal.lastSummary}:${goal.error}:${task?.status}:${task?.progress}`;
}
function goalDetails(id) {
  const goal = state.goals?.find(goal=>goal.id===id); if (!goal) return;
  const task = state.tasks.find(task=>task.id===goal.currentTaskId);
  const letters = (state.letters || []).filter(letter=>letter.goalId===id).sort((a,b)=>b.createdAt-a.createdAt);
  openModal(`<div class="modal-eyebrow">ONE GOAL, UNTIL IT'S DONE</div><h2>${esc(goal.title)}</h2><div class="goal-detail-meta"><span>${icon('target',18)}${goalLabels[goal.status]}</span><span>${goal.round}회차 · 연속 실패 ${goal.consecutiveFailures}/3</span></div><label class="field-label">목표와 완료 기준</label><div class="task-description">${esc(goal.description)}\n\n완료 기준: ${esc(goal.successCriteria || '요청한 모든 작업의 실제 수행 및 검증')}</div>${goal.error?`<div class="task-error">${esc(goal.error)}</div>`:''}${task?`<button class="current-goal-task" data-action="task-details" data-id="${task.id}">${pill(task)}<span>${esc(task.title)}</span>${icon('arrow',16)}</button>`:''}${goal.lastSummary?`<label class="field-label">최근 검토 보고</label><pre class="result-text">${esc(goal.lastSummary)}</pre>`:''}<div class="goal-letter-history"><h3>회차별 보고 편지</h3>${letters.map(letter=>`<button data-action="letter-details" data-id="${letter.id}">${icon(letter.readAt?'mail-open':'mail',17)}<span>${esc(letter.subject)}</span>${icon('chevron',13)}</button>`).join('') || '<p>첫 보고를 기다리고 있어요.</p>'}</div><div class="modal-footer"><span>달성까지 반복 · 실패 3회면 중단</span>${['queued','running','reviewing'].includes(goal.status)?`<button class="button danger" data-action="stop-goal" data-id="${id}">${icon('stop',15)}Goal 중지</button>`:['stopped','blocked'].includes(goal.status)?`<button class="button primary" data-action="resume-goal" data-id="${id}">${icon('play',15)}Goal 재개</button>`:`<button class="button subtle-button" data-action="close-modal">Goal 닫기</button>`}</div>`, 'wide-modal');
  modalGoalId = id; modalGoalSignature = goalSignature(goal);
}

function shell() {
  app.innerHTML = `
    <div class="layout">
      <aside class="rail" id="navigation-sidebar">
        <a class="brand" href="/" aria-label="PX Office 사무실"><span class="brand-symbol">${icon('office',24)}</span><span>PX<span class="brand-light"> OFFICE</span><small>PERSONAL AGENT WORKSPACE</small></span></a>
        <div class="workspace-tag"><i class="tiny-square"></i><b id="office-label">${esc(state.office.name)} 사무실</b> <span>v2.0</span></div>
        <div class="rail-label">WORKSPACE</div>
        <nav aria-label="주 메뉴">${navItem('office','사무실','office')}${navItem('inbox','편지함','mail')}${navItem('tasks','작업 현황','tasks')}${navItem('logs','활동 기록','logs')}</nav>
        <div class="rail-bottom"><button class="account-usage" data-action="usage-details" aria-label="구독 사용량과 초기화권 보기" title="구독 사용량과 초기화권"><span class="usage-heading">${icon('tasks',20)}<b>구독 사용량</b></span><span id="account-usage-content"></span></button><div class="owner"><span class="owner-avatar">B</span><div><b>사장님</b><span>이 사무실의 유일한 인간</span></div><span class="owner-crown">♛</span></div></div>
      </aside>
      <div class="workspace">
        <header class="topbar"><div class="breadcrumb">내 워크스페이스 ${icon('chevron',13)} <b id="view-label">사무실</b></div><div class="topbar-right"><span class="connection" id="connection"><i></i>연결 중</span><button class="computer-button" data-action="computer">${icon('monitor',16)}<span id="computer-name">작업 PC</span>${icon('down',12)}</button><span class="topbar-divider"></span><button class="icon-button" data-action="settings" title="사무실 설정" aria-label="사무실 설정">${icon('settings',18)}</button></div></header>
        <div class="workspace-body"><main id="main"></main><aside class="agent-sidebar" id="agent-sidebar"><div class="sidebar-heading"><div><span class="eyebrow">YOUR LITTLE TEAM</span><h2>에이전트 <span>${state.agents.length}</span></h2></div><span class="sidebar-spark">${icon('spark',21)}</span></div><div class="team-summary"><span><i class="dot green"></i><b id="running-count">0</b> 실행 중</span><span><i class="dot"></i><b id="idle-count">${state.agents.length}</b> 대기 중</span></div><div id="agent-list"></div><div class="sidebar-bottom"><div class="host-box"><span class="host-icon">${icon('monitor',21)}</span><div><span>이 사무실의 작업 대상</span><b id="sidebar-host"></b><small id="host-detail"></small></div><i class="dot green"></i></div><p>${icon('link',12)} 같은 사무실에 접속하면 작업도 그대로.</p></div></aside></div>
        <footer class="footer"><span><i class="footer-dot"></i> ALL SYSTEMS COZY</span><span>Made for one human & ${state.agents.length} little agents.<span class="footer-heart">♥</span></span><span id="footer-clock"></span></footer>
      </div>
    </div>`;
  renderView(); update(); updateSidebar(); updateAccountUsage(); updateComputers();
}
function officeTabsMarkup() {
  const tabs=rawState?.officeTabs||['local'];
  return tabs.filter(id=>!rawState.deletedOffices?.[id]).map(id=>{
    const name=id==='local'?state.computer.name:computerList.computers.find(computer=>computer.id===id)?.name||rawState.offices?.[id]?.name||id;
    return `<button class="office-computer-button ${selectedComputerId===id?'active':''}" data-action="open-office" data-id="${esc(id)}" title="${esc(name)}" aria-label="${esc(name)} 사무실 열기" aria-pressed="${selectedComputerId===id}">${icon('monitor',22)}</button>`;
  }).join('');
}
function updateOfficeTabs() {
  const tabs=document.querySelector('#office-tabs');if(!tabs)return;
  const markup=officeTabsMarkup();if(tabs.innerHTML!==markup)tabs.innerHTML=markup;
}
let officeMenu;
function closeOfficeMenu(){officeMenu?.remove();officeMenu=null;}
async function removeOffice(id) {
  await api(`offices/${encodeURIComponent(id)}`,'DELETE');
  rawState=await api('state');applyOffice();renderView();update();
  toast('사무실을 삭제했어요. Tailscale 목록에서 다시 접속하면 새로 만들어져요.');
}
document.addEventListener('contextmenu',event=>{
  const button=event.target.closest('.office-computer-button');if(!button||button.dataset.id==='local')return;
  event.preventDefault();closeOfficeMenu();
  officeMenu=document.createElement('div');officeMenu.className='office-context-menu';officeMenu.setAttribute('role','menu');
  const remove=document.createElement('button');remove.textContent='사무실 삭제';remove.setAttribute('role','menuitem');
  const id=button.dataset.id;
  remove.addEventListener('click',async()=>{closeOfficeMenu();try{await removeOffice(id);}catch(error){toast(error.message,true);}});
  officeMenu.append(remove);document.body.append(officeMenu);
  const box=button.getBoundingClientRect();
  officeMenu.style.left=`${Math.max(8,Math.min(event.clientX||box.x,innerWidth-officeMenu.offsetWidth-8))}px`;
  officeMenu.style.top=`${Math.max(8,Math.min(event.clientY||box.bottom,innerHeight-officeMenu.offsetHeight-8))}px`;
  remove.focus();
});
document.addEventListener('pointerdown',event=>{if(officeMenu&&!officeMenu.contains(event.target))closeOfficeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeOfficeMenu();});
window.addEventListener('resize',closeOfficeMenu);window.addEventListener('scroll',closeOfficeMenu,true);
function leftSidebarControl() {
  return `<button class="icon-button sidebar-toggle left-sidebar-toggle" data-action="toggle-left-sidebar" aria-controls="navigation-sidebar" aria-expanded="${leftSidebarOpen}" aria-label="왼쪽 사이드바 ${leftSidebarOpen?'닫기':'열기'}"><span aria-hidden="true">◀</span></button>`;
}
function historyTrash(kind) {
  return `<button class="button subtle-button history-trash" data-action="history-cleanup" data-id="${kind}" aria-label="${{letters:'편지함',tasks:'작업 현황',logs:'활동 기록'}[kind]} 삭제" title="기록 비우기"><span aria-hidden="true">🗑️</span><span>비우기</span></button>`;
}
function historyCleanup(kind) {
  const name={letters:'편지함',tasks:'작업 현황',logs:'활동 기록'}[kind];
  const today=new Date(), date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  openModal(`<h2>${name} 삭제</h2><p class="field-hint">현재 사무실의 ${name}만 삭제해요.${kind==='tasks'?' 실행·대기 중인 작업과 진행 중인 Goal은 유지돼요. 종료 날짜를 기준으로 정리해요.':''}</p><div class="cleanup-options"><button class="button subtle-button" data-action="preview-history-delete" data-id="${kind}" data-range="all">전체 삭제</button><label class="field-label" for="cleanup-date">기준 날짜</label><input id="cleanup-date" type="date" value="${date}" required><p class="field-hint">선택한 날짜의 00:00 이전 기록을 삭제해요. 해당 날짜의 기록은 남아요.</p><button class="button subtle-button" data-action="preview-history-delete" data-id="${kind}" data-range="before">선택한 날짜 이전 삭제</button></div><div id="cleanup-preview" role="status"></div>`, 'history-cleanup-modal');
}
async function previewHistoryDelete(button) {
  const kind=button.dataset.id,range=button.dataset.range,scope=selectedComputerId;
  const date=modal.querySelector('#cleanup-date');
  if(range==='before'&&!date.reportValidity())return;
  const cutoff=range==='before'?new Date(`${date.value}T00:00:00`).getTime():undefined;
  button.disabled=true;
  try {
    const result=await api('history/preview','POST',{kind,range,cutoff,officeId:scope});
    const counts=result.counts,total=Object.values(counts).reduce((a,b)=>a+b,0);
    const description=kind==='tasks'?`작업 ${counts.tasks}개 · Goal ${counts.goals}개`:`${kind==='letters'?'편지':'활동 기록'} ${total}개`;
    modal.querySelector('#cleanup-preview').innerHTML=`<div class="cleanup-confirm"><p>${range==='all'?'전체':esc(date.value)+' 이전'} 삭제 대상: <b>${description}</b></p><p class="field-hint">삭제하면 복구할 수 없어요.</p><button class="button danger" data-action="confirm-history-delete" data-token="${result.token}" data-scope="${esc(scope)}" ${total?'':'disabled'}>확인 후 삭제</button></div>`;
  } finally {button.disabled=false;}
}
function viewControls() {
  return `<div class="view-controls">${view==='office'?`<button class="icon-button agent-presets-button" data-action="agent-presets" aria-label="에이전트 모델 추론 프리셋" title="에이전트 모델 추론 프리셋"><span aria-hidden="true">🤖</span></button>`:''}<button class="button primary office-mail-button" ${view==='office'?'data-action="open-mailbox"':'data-view="inbox"'} aria-label="편지함 열기" title="편지함 열기">${icon('mail',22)}<span class="mail-alert" hidden aria-hidden="true"></span></button><button class="icon-button sidebar-toggle" data-action="toggle-sidebar" aria-controls="agent-sidebar" aria-expanded="${sidebarOpen}" aria-label="오른쪽 사이드바 ${sidebarOpen?'닫기':'열기'}" title="오른쪽 사이드바 ${sidebarOpen?'닫기':'열기'}"><span aria-hidden="true">▶</span></button></div>`;
}
function heading(title, subtitle, button = true) {
  const trash={inbox:'letters',tasks:'tasks',logs:'logs'}[view];
  return `<div class="page-heading">${leftSidebarControl()}<div><span class="eyebrow">${view==='office'?'A GOOD DAY TO MAKE THINGS':view==='tasks'?'ONE THING AT A TIME':'EVERY LITTLE STEP'}</span><h1>${title}<span class="heading-pixel" aria-hidden="true">✦</span></h1><p>${subtitle}</p></div>${button?`<button class="button primary" data-action="new-task">${icon('plus',17)}일 시키기<span class="shortcut" aria-hidden="true">N</span></button>`:''}${trash?historyTrash(trash):''}${viewControls()}</div>`;
}
function renderView() {
  updateKeyboardSound();
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  document.querySelector('#view-label').textContent = { office:'사무실', tasks:'작업 현황', inbox:'편지함', logs:'활동 기록' }[view];
  const main = document.querySelector('#main');
  if (view==='office') {
    main.innerHTML = `<div class="office-actions"><div class="office-start-controls">${leftSidebarControl()}<button class="button primary" data-action="new-task">${icon('plus',17)}일 시키기</button></div><div id="office-tabs" class="office-tabs" role="group" aria-label="컴퓨터 사무실">${officeTabsMarkup()}</div>${viewControls()}</div>
      <section class="office-panel"><div class="panel-heading"><div class="panel-title"><i class="dot green"></i><h2 id="office-view-heading">[${esc(state.office.name)}] 오피스 뷰</h2><span class="subtle">LIVE</span></div><div class="office-tools"><span class="mode-badge" id="mode-badge">DEMO</span><button class="icon-button" data-action="sound" aria-label="사무실 소리 ${muted?'켜기':'끄기'}" title="사무실 소리">${icon(muted?'mute':'volume',16)}</button><button class="icon-button" data-action="expand" aria-label="사무실 크게 보기" title="사무실 크게 보기">${icon('expand',16)}</button></div></div><div class="office-stage">${officeMarkup()}<span class="map-corner top-left"></span><span class="map-corner bottom-right"></span></div><div class="office-caption"><span>${icon('monitor',13)} 동료를 클릭해 작업과 모델을 관리하세요.</span><span><i class="dot green"></i>실행 중<i class="dot"></i>대기 중</span></div></section>
      `;
  } else if (view==='tasks') {
    main.innerHTML = `${heading('작업 현황','진행 중인 작업과 Goal을 한눈에 확인해요.')}<div class="board-toolbar"><div class="search-box">${icon('search',16)}<input type="search" id="task-search" placeholder="작업 검색..." value="${esc(query)}" aria-label="작업 검색"></div><select id="task-filter" aria-label="담당자 필터"><option value="all">모든 에이전트</option>${state.agents.map(a=>`<option value="${a.id}"${filter===a.id?' selected':''}>${esc(a.name)}</option>`).join('')}</select><button class="button subtle-button" data-action="pause-queue" id="queue-button">${icon('pause',15)}대기열 일시정지</button></div><section id="goal-list" class="goal-list"></section><div id="status-filters" class="status-filters"></div><div id="task-board" class="task-status-list"></div>`;
  } else if (view==='inbox') {
    main.innerHTML = `${heading('편지함','동료들이 사장님께 보낸 진행 보고와 결과예요.',false)}<div class="inbox-toolbar"><div class="inbox-filters"><button data-action="mailbox-filter" data-filter="all" class="active">모든 편지</button><button data-action="mailbox-filter" data-filter="unread">안 읽은 편지</button></div><button class="small-button" data-action="read-all-letters">${icon('check',15)}모두 읽음</button></div><div id="inbox-list" class="inbox-list"></div>`;
  } else {
    main.innerHTML = `${heading('활동 기록','누가, 언제, 무엇을 했는지 한눈에 확인하세요.',false)}<div class="log-toolbar"><span class="live-label"><i class="dot green"></i>실시간으로 기록하고 있어요</span><a class="button subtle-button" href="/api/export" download>${icon('download',15)}데이터 내보내기</a></div><section class="log-panel"><div class="log-table-head"><span>시간</span><span>에이전트</span><span>활동 내용</span></div><div id="activity-list"></div></section>`;
  }
  updateMain(); updateOffice(); updateSidebar(); updateMailbox();
}
function updateConnection() {
  const el = document.querySelector('#connection'); if (!el) return;
  el.innerHTML = `<i class="${connected?'online':''}"></i>${connected?'사무실 연결됨':'재연결 중'}`;
  el.classList.toggle('offline',!connected);
}
function update() {
  if (!document.querySelector('#main')) return;
  updateConnection();
  const active = state.agents.filter(a=>a.status==='running').length;
  document.querySelector('#running-count').textContent = active;
  document.querySelector('#idle-count').textContent = state.agents.length-active;
  document.querySelector('#nav-task-count').textContent = state.tasks.filter(t=>running(t)||t.status==='queued').length;
  updateComputers();
  document.querySelector('#sidebar-host').textContent = state.office.name;
  document.querySelector('#office-label').textContent = `${state.office.name} 사무실`;
  document.querySelector('#office-label').title = `${state.office.name} 사무실`;
  const officeHeading=document.querySelector('#office-view-heading');if(officeHeading)officeHeading.textContent=`[${state.office.name}] 오피스 뷰`;
  const target=computerList.computers.find(computer=>computer.id===selectedComputerId);
  document.querySelector('#host-detail').textContent = selectedComputerId==='local'?`${{darwin:'macOS',win32:'Windows',linux:'Linux'}[state.computer.platform]||state.computer.platform} · 로컬 작업`:`${target?.platform||'원격'} · Tailscale ${target?.ip||''}`;
  updateAgents(); updateMain(); updateOffice(); updateClock(); updateMailbox(); updateInbox(); updateKeyboardSound(); updateAssignmentButtons(); updateSecretary();updateOfficeTabs();
  if (modal.open && modalTaskId) {
    const task = state.tasks.find(t=>t.id===modalTaskId);
    const signature = task ? `${task.status}:${task.progress}:${task.result}:${task.error}:${state.logs.filter(l=>l.taskId===task.id).length}` : '';
    if (signature !== modalTaskSignature) {
      const scroll = modal.scrollTop;
      taskDetails(modalTaskId); modal.scrollTop = scroll;
    }
  }
  if (modal.open && modalGoalId) {
    const goal = state.goals?.find(goal=>goal.id===modalGoalId);
    if (goal && goalSignature(goal)!==modalGoalSignature) { const scroll=modal.scrollTop; goalDetails(goal.id); modal.scrollTop=scroll; }
  }
}
function updateClock() {
  const el = document.querySelector('#footer-clock');
  if (el) el.textContent = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})+' · '+time(Date.now());
}
function updateAgents() {
  const list = document.querySelector('#agent-list');
  // Do not replace a select while the user is choosing an option.
  if (list.contains(document.activeElement) && document.activeElement.tagName==='SELECT') {
    state.agents.forEach(a=>{
      const row = list.querySelector(`[data-row="${a.id}"]`); if (!row) return;
      row.querySelector('.agent-dot').classList.toggle('green',a.status==='running');
      const status = row.querySelector('.agent-state');
      status.textContent = a.status==='running'?'실행 중':'대기 중'; status.classList.toggle('working',a.status==='running');
      row.querySelector('.agent-model-summary').outerHTML = modelSummary(a);
      const modelSelect = row.querySelector('[data-model]');
      if (modelSelect && modelSelect!==document.activeElement) modelSelect.value = a.profile;
      const reasoningSelect = row.querySelector('[data-reasoning]');
      if (reasoningSelect && reasoningSelect!==document.activeElement) reasoningSelect.innerHTML = reasoningOptions(a.profile,a.reasoningEffort);
      const current = row.querySelector('.agent-current');
      if (current) current.innerHTML = currentMarkup(a);
      else {
        let mini = row.querySelector('.agent-mini');
        if (a.activeTaskId) {
          if (!mini) { mini = document.createElement('div'); mini.className = 'agent-mini'; row.append(mini); }
          mini.innerHTML = currentMarkup(a);
        } else mini?.remove();
      }
    }); return;
  }
  list.innerHTML = state.agents.map((a,i)=>{
    const selected = a.id===selectedAgent;
    const task = state.tasks.find(t=>t.id===a.activeTaskId);
    const section = i===0 ? '<div class="agent-section-label">총괄 에이전트</div>' : a.id==='dev' ? '<div class="agent-section-label department-label">부서 에이전트</div>' : '';
    const expanded = selected ? `
      <div class="agent-expanded">
        <div class="agent-current">${currentMarkup(a)}</div>
        <label class="model-label" for="model-${a.id}">${icon('spark',13)} 모델 <span>${FIXED_AGENT_IDS.includes(a.id)?'고정':'변경 가능'}</span></label>
        <select class="model-select" id="model-${a.id}" data-model="${a.id}" ${FIXED_AGENT_IDS.includes(a.id)?'disabled':''}>${options(a.profile)}</select>
        <label class="model-label reasoning-label" for="reasoning-${a.id}">${icon('spark',13)} 추론 레벨</label>
        <select class="model-select" id="reasoning-${a.id}" data-reasoning="${a.id}" ${FIXED_AGENT_IDS.includes(a.id)?'disabled':''}>${reasoningOptions(a.profile,a.reasoningEffort)}</select>
        <div class="agent-actions">
          <button class="small-button" data-action="${a.id==='secretary'?'secretary':'assign'}" data-id="${a.id}" ${a.status==='running'?'disabled':''}>${icon('plus',13)}${a.id==='secretary'?'진행 상황 묻기':'작업 배정'}</button>
          <button class="small-button" data-action="agent-details" data-id="${a.id}">${icon('settings',13)}상세 설정</button>
        </div>
      </div>` : task ? `<div class="agent-mini">${currentMarkup(a)}</div>` : '';
    return `${section}
      <article class="agent-row ${selected?'selected':''} ${a.reportsTo==='dev'?'junior-agent':''}" data-row="${a.id}">
        <button class="agent-select" data-select-agent="${a.id}" aria-expanded="${selected}">
          <span class="avatar" style="--avatar-color:${a.color}">${avatar(a.id,40)}<i class="dot agent-dot ${a.status==='running'?'green':''}"></i></span>
          <span class="agent-info"><b>${esc(a.name)}${a.id==='chief'?'<span class="chief-tag">LEAD</span>':''}</b><small>${a.role}</small>${modelSummary(a)}</span>
          <span class="agent-state ${a.status==='running'?'working':''}">${a.status==='running'?'실행 중':'대기 중'}</span>${icon('down',12)}
        </button>
        ${expanded}
      </article>`;
  }).join('');
}
function updateDepartmentSpeed() {
  document.querySelectorAll('[data-fast-flame]').forEach(flame => {
    flame.style.display = state.agents.find(agent => agent.id === flame.dataset.fastFlame)?.fastMode === true ? '' : 'none';
  });
  document.querySelectorAll('.department-speed').forEach(button => {
    const agents = state.agents.filter(agent => agent.department === button.dataset.id);
    const fast = agents.length > 0 && agents.every(agent => agent.fastMode === true);
    button.textContent = fast ? 'Fast' : 'Normal';
    button.setAttribute('aria-pressed', String(fast));
    const department = button.dataset.id;
    document.querySelectorAll('[data-department-scene]').forEach(scene => {
      if(scene.dataset.departmentScene === department) scene.style.display = (scene.dataset.sceneMode === 'fast') === fast ? '' : 'none';
    });
    document.querySelectorAll('[data-department-shelf]').forEach(shelf => {
      if(shelf.dataset.departmentShelf === department) shelf.classList.toggle('fast-shelf', fast);
    });
    document.querySelectorAll('[data-department-sign]').forEach(sign => {
      if(sign.dataset.departmentSign === department) sign.setAttribute('transform', fast ? 'rotate(5 780 366)' : 'rotate(0 780 366)');
    });
  });
}
function updateMain() {
  if (view==='office') {
    updateDepartmentSpeed();
    const badge = document.querySelector('#mode-badge'); badge.textContent = state.mode==='codex'?'CODEX · 구독':state.mode==='demo'?'DEMO MODE':'MODEL API'; badge.classList.toggle('api-mode',state.mode!=='demo');
  } else if (view==='inbox') {
    updateInbox();
  } else if (view==='tasks') {
    document.querySelector('#goal-list').innerHTML = state.goals?.length ? `<div class="section-heading"><h2>Goal <span>${state.goals.length}</span></h2></div><div class="goal-grid">${[...state.goals].reverse().map(goalCard).join('')}</div>` : '';
    const tasks = state.tasks.filter(t=>!t.goalId&&(filter==='all'||t.agentId===filter)&&(!query || (t.title+' '+t.description).toLowerCase().includes(query.toLowerCase())));
    const matches = (task,key) => key==='all'||(key==='active'?running(task):key==='closed'?['stopped','failed'].includes(task.status):task.status===key);
    document.querySelector('#status-filters').innerHTML = [['all','모든 작업'],['active','진행 중'],['queued','대기 중'],['done','완료'],['closed','중지 · 오류']].map(([key,label])=>`<button class="${taskStatusFilter===key?'active':''}" data-action="task-status-filter" data-filter="${key}">${label}<span>${tasks.filter(task=>matches(task,key)).length}</span></button>`).join('');
    const visible = tasks.filter(task=>matches(task,taskStatusFilter)).sort((a,b)=>Number(running(b)||b.status==='queued')-Number(running(a)||a.status==='queued') || b.createdAt-a.createdAt);
    document.querySelector('#task-board').innerHTML = visible.length ? `<div class="task-status-heading"><span>작업 · 담당자</span><span>상태</span></div>${visible.map(taskRow).join('')}` : `<div class="inbox-empty">${icon('tasks',35)}<h2>${query?'검색 결과가 없어요':'표시할 작업이 없어요'}</h2><p>새 작업이나 Goal을 맡겨보세요.</p></div>`;
    const queue = document.querySelector('#queue-button'); queue.innerHTML = `${icon(state.settings.paused?'play':'pause',15)}${state.settings.paused?'대기열 다시 시작':'대기열 일시정지'}`;
  } else if (view==='logs') {
    document.querySelector('#activity-list').innerHTML = state.logs.length ? [...state.logs].reverse().map(l=>`<div class="log-row ${l.level==='error'?'log-error':''}"><time>${time(l.at)}</time><span class="log-agent">${l.agentId==='system'?icon('office',18):avatar(l.agentId,24)}${agentById(l.agentId)?.name || '사무실'}</span>${l.taskId?`<button data-action="task-details" data-id="${l.taskId}">${esc(l.message)}</button>`:`<span>${esc(l.message)}</span>`}</div>`).join('') : `<div class="log-empty">${icon('logs',30)}<b>사무실의 첫 번째 이야기를 기다려요.</b><p>작업을 만들면 모든 활동이 여기에 기록돼요.</p></div>`;
  }
}
function taskRow(t) {
  const a = agentById(t.agentId);
  return `<div class="task-row"><button class="task-row-main" data-action="task-details" data-id="${t.id}"><span class="task-type-icon ${t.status==='done'?'complete':''}">${icon(t.status==='done'?'check':running(t)?'play':'tasks',16)}</span><span><b>${esc(t.title)}</b><small>${esc(a.name)} · ${time(t.createdAt)}${t.runMode==='demo'?' · 데모':''}</small></span></button>${pill(t)}${running(t)?`<span class="task-percent">${t.progress}%</span>`:'<span class="task-percent">—</span>'}<button class="icon-button" data-action="task-details" data-id="${t.id}" aria-label="작업 상세 보기">${icon('chevron',16)}</button></div>`;
}
function currentMarkup(a) {
  const task = state.tasks.find(t=>t.id===a.activeTaskId);
  const queued = state.tasks.filter(t=>t.agentId===a.id && t.status==='queued').length;
  return task ? `<span class="working-line"><i class="dot green"></i>${esc(task.title)}</span>${task.runMode==='codex'?`<span class="agent-live-activity" title="${esc(task.lastActivity || '')}">${esc(task.lastActivity || 'Codex 실행 준비 중')}</span>`:''}<div class="progress"><i style="width:${task.progress}%"></i></div><div class="progress-label"><span>${labels[task.status]}</span><b>${task.progress}%</b></div>` : `<span class="idle-line">${icon('moon',13)}${queued?`${queued}개 작업이 대기 중이에요`:'다음 일을 기다리고 있어요'}</span>`;
}
function updateOffice() {
  state.agents.forEach(a=>{
    const el = document.querySelector(`#office-svg [data-agent="${a.id}"]`); if (!el) return;
    const character=el.querySelector('.character-bob');
    const appearance=a.appearance||a.id;
    if(character.dataset.appearance!==appearance){character.innerHTML=sprite(appearance,4,-8,2);character.dataset.appearance=appearance;}
    el.classList.toggle('is-running', a.status==='running'); el.classList.toggle('is-selected',a.id===selectedAgent);
    document.querySelector(`[data-nameplate="${a.id}"] .agent-indicator`).setAttribute('fill',a.status==='running'?'#9ad985':'#92948e');
    el.setAttribute('aria-label',`${a.name} · ${a.status==='running'?'실행 중':'대기 중'} · ${profiles[a.profile]} · 추론 ${REASONING_LEVELS[a.reasoningEffort]} · 설정 열기`);
    const nameText=document.querySelector(`[data-nameplate="${a.id}"] text`);if(nameText){nameText.textContent=a.name;if(a.name.length>6){nameText.setAttribute('textLength','84');nameText.setAttribute('lengthAdjust','spacingAndGlyphs');}else nameText.removeAttribute('textLength');}
    document.querySelector(`[data-nameplate="${a.id}"]`)?.setAttribute('aria-label',el.getAttribute('aria-label'));
  });
}
function openModal(content, className='') {
  flushAgentForm();
  modalTaskId = null; modalGoalId = null;
  modal.innerHTML = `<div class="modal-body ${className}"><button class="modal-close icon-button" data-action="close-modal" aria-label="닫기">${icon('close',20)}</button>${content}</div>`;
  if (!modal.open) modal.showModal();
}
function updateAssignmentButtons() {
  document.querySelectorAll('[data-action="assign"]').forEach(button=>{
    button.disabled=agentById(button.dataset.id)?.status==='running';
    button.title=button.disabled?'현재 사용 중인 에이전트입니다.':'이 에이전트에게 별도 작업 배정';
  });
}
function updateSecretary() {
  const live=document.querySelector('#secretary-live');if(!live)return;
  const tasks=state.tasks.filter(task=>['running','reviewing'].includes(task.status));
  live.innerHTML=tasks.length?tasks.map(task=>`<button class="secretary-task" data-action="task-details" data-id="${task.id}"><b>${esc(task.title)}</b><span>${esc(agentById(task.activeAgentId)?.name||'담당자 배정 중')} · ${labels[task.status]} · ${task.progress}%</span><small>${esc(task.lastActivity||task.steps.at(-1)?.label||'작업 준비 중')}</small></button>`).join(''):'<p>현재 진행 중인 작업이 없어요.</p>';
}
function secretaryDetails() {
  const a={...agentById('secretary'),...saveEntry('secretary')?.draft};
  selectedAgent='secretary';updateAgents();updateOffice();
  openModal(`<div class="modal-agent-heading"><span class="avatar">${avatar('secretary',52)}</span><div><div class="modal-eyebrow">사장실 비서</div>${editableName(a)}<p>사장님, 지금 무슨 일이 진행 중인지 알려드릴게요.</p></div></div><div class="secretary-model-settings"><label class="field-label" for="secretary-name">이름</label><input id="secretary-name" value="${esc(a.name)}" maxlength="40" required><label class="field-label" for="secretary-reasoning">추론 레벨</label><select id="secretary-reasoning" disabled>${reasoningOptions(a.profile,a.reasoningEffort)}</select><p class="field-hint">사장님 전용 비서 · ${esc(agentById('chief').name)}가 배정하거나 제어할 수 없어요.</p><span id="secretary-save-status" role="status">변경하면 자동 저장돼요</span></div><div id="secretary-live" class="secretary-live"></div><div class="secretary-questions"><button class="button subtle-button" data-action="ask-secretary" data-question="${esc(agentById('chief').name)} 지금 무슨 일 하고 있어?">무슨 일 하고 있어?</button><button class="button subtle-button" data-action="ask-secretary" data-question="현재 작업 진행 상황 어때?">진행 상황 어때?</button></div><form id="secretary-form"><label class="field-label" for="secretary-question">${esc(a.name)}에게 물어보기</label><input id="secretary-question" name="question" required maxlength="2000" placeholder="${esc(agentById('chief').name)} 작업 진행 상황 어때?"><button class="button primary" type="submit">물어보기</button></form><pre id="secretary-answer" class="result-text" aria-live="polite"></pre>`, 'secretary-modal');
  updateSecretary();
}
async function askSecretary(question) {
  const scope=selectedComputerId, answer=document.querySelector('#secretary-answer');
  if(!answer||answer.getAttribute('aria-busy')==='true')return;
  const panel=answer.closest('.secretary-modal');
  const controls=[...panel.querySelectorAll('#secretary-question,#secretary-form button,[data-action="ask-secretary"],#secretary-profile,#secretary-reasoning')];
  controls.forEach(control=>{control.disabled=true;});
  answer.setAttribute('aria-busy','true');answer.classList.add('loading');
  answer.textContent=`${agentById('secretary').name} · 답변을 준비하고 있어요 · 결과 로딩 중…`;
  try {
    while(saveEntry('secretary',scope)?.pending||saveEntry('secretary',scope)?.inflight) await flushAgentSave('secretary',scope);
    if(saveEntry('secretary',scope)?.failed)throw new Error('비서 설정을 저장하지 못했습니다. 저장을 다시 시도해주세요.');
    const result=await api('secretary','POST',{question,officeId:scope});
    if(scope===selectedComputerId&&answer===document.querySelector('#secretary-answer'))answer.textContent=result.answer;
  } catch(error) {
    if(scope===selectedComputerId&&answer===document.querySelector('#secretary-answer'))answer.textContent=`답변을 불러오지 못했어요. ${error.message}`;
    throw error;
  } finally {
    answer.setAttribute('aria-busy','false');answer.classList.remove('loading');
    controls.forEach(control=>{control.disabled=false;});
  }
}

function newTask(agentId='chief', sample='', parentTaskId='') {
  if(agentId==='secretary'){secretaryDetails();return;}
  if(agentById(agentId)?.status==='running'){toast('이 에이전트는 현재 사용 중이에요. 쉬고 있는 동료에게 배정해주세요.',true);return;}
  const parent=state.tasks.find(task=>task.id===parentTaskId);
  const machineId=parentTaskId?(parent?.machineId||'local'):selectedComputerId;
  const remoteDirectory=parentTaskId?parent?.remoteDirectory:computerList.computers.find(computer=>computer.id===machineId)?.homeDirectory;
  openModal(`<h2>무슨 일을 맡길까요?</h2>
    <form id="task-form"><label class="field-label" for="task-description">작업 내용</label><textarea id="task-description" name="description" rows="5" required maxlength="12000" placeholder="할 일과 작업할 폴더를 적어주세요">${esc(sample)}</textarea>
      ${parentTaskId?`<input type="hidden" name="parentTaskId" value="${esc(parentTaskId)}">`: ''}
      <input type="hidden" name="machineId" value="${esc(machineId)}">${remoteDirectory?`<input type="hidden" name="remoteDirectory" value="${esc(remoteDirectory)}">`: ''}
      <input type="hidden" name="agentId" value="${esc(agentId)}">${window.pxDesktop&&machineId==='local'?'<input type="hidden" name="workingDirectory"><button class="small-button" type="button" data-action="choose-folder">작업 폴더 선택</button><span id="chosen-folder" class="field-hint"></span>':''}
      <div class="task-options"><button class="button ${parent?.tailWeb?'primary':'subtle-button'} tail-web-toggle" type="button" data-action="toggle-tail-web" aria-pressed="${parent?.tailWeb?'true':'false'}">${icon('monitor',17)}tail웹</button>
      <button class="button subtle-button goal-toggle" type="button" data-action="toggle-goal" aria-pressed="false">${icon('target',17)}Goal</button></div>
      <div class="modal-footer"><button class="button primary" type="submit">${icon('arrow',16)}시작하기</button></div>
    </form>`);
  document.querySelector('#task-description').focus();
}
function agentDetails(id) {
  if(id==='secretary'){secretaryDetails();return;}
  const a = { ...agentById(id), ...saveEntry(id)?.draft }; selectedAgent=id; updateAgents(); updateOffice();
  const task = state.tasks.find(t=>t.id===a.activeTaskId);
  openModal(`<div class="agent-assign-top"><button type="button" class="button subtle-button" data-action="assign" data-id="${id}" ${a.status==='running'?'disabled':''}>${icon('plus',15)}작업 배정</button></div><div class="modal-agent-heading"><span class="avatar" style="--avatar-color:${a.color}">${avatar(id,60)}</span><div><div class="modal-eyebrow">${a.department}</div>${editableName(a)}<span class="agent-state ${a.status==='running'?'working':''}"><i class="dot agent-status-dot ${a.status==='running'?'green':''}"></i>${a.status==='running'?'실행 중':'대기 중'}</span></div></div>${task?`<div class="current-task-note">현재 작업: ${esc(task.title)}</div>`:''}<form id="agent-form" data-id="${id}"><label class="field-label" for="agent-name">이름</label><input id="agent-name" name="name" value="${esc(a.name)}" maxlength="40" required><label class="field-label" for="agent-reasoning">추론 레벨</label><select id="agent-reasoning" name="reasoningEffort" ${FIXED_AGENT_IDS.includes(id)?'disabled':''}>${reasoningOptions(a.profile,a.reasoningEffort)}</select><p class="field-hint">추론 레벨은 다음 모델 호출부터 적용돼요.</p><label class="field-label" for="agent-prompt">역할과 작업 지침</label><textarea id="agent-prompt" name="prompt" rows="6" maxlength="4000" required>${esc(a.prompt)}</textarea><label class="field-label" for="agent-fixed-prompt">고정 프롬프트</label><textarea id="agent-fixed-prompt" name="fixedPrompt" rows="4" maxlength="12000" placeholder="예: 모든 답변은 한국어로 작성하고, 결론을 먼저 보고해줘.">${esc(a.fixedPrompt)}</textarea><p class="field-hint">이 에이전트의 모든 작업에 함께 적용할 지침이에요. 저장하면 다음 모델 호출부터 적용돼요.</p><div class="agent-history"><h3>최근 작업</h3>${[...state.tasks].reverse().filter(t=>t.agentId===id).slice(0,3).map(t=>`<button type="button" data-action="task-details" data-id="${t.id}">${pill(t)}<span>${esc(t.title)}</span>${icon('chevron',13)}</button>`).join('')||'<p>아직 맡긴 작업이 없어요.</p>'}</div><div class="modal-footer"><div class="autosave-indicator"><span id="agent-save-status" role="status">변경하면 자동 저장돼요</span><button class="text-button" type="button" data-action="retry-agent-save" data-id="${id}">저장 재시도</button></div></div></form>`);
}
function taskDetails(id) {
  const task = state.tasks.find(t=>t.id===id); if(!task) return;
  const logs = state.logs.filter(l=>l.taskId===id);
  openModal(`<div class="modal-eyebrow">MISSION DETAILS ${task.runMode==='codex'?'· CODEX':task.runMode==='demo'?'· DEMO':''}</div><h2 class="task-modal-title">${esc(task.title)}</h2><div class="task-meta">${pill(task)}<span>${avatar(task.agentId,24)}${esc(agentById(task.agentId).name)}</span><span>${icon('clock',14)}${duration(task)}</span></div>${running(task)?`<div class="progress detail-progress"><i style="width:${task.progress}%"></i></div><p class="field-hint">${task.runMode==='codex'?'단계별 진행률이에요. 실제 실행 명령과 파일 변경은 아래 타임라인에 표시돼요.':'진행 상황은 사이드바에서 실시간으로 볼 수 있어요.'}</p>`:''}${task.runMode==='codex'?`<div class="task-execution-facts"><span>작업 대상 <b>${esc(task.computerName || state.computer.name)}</b></span><span>작업 폴더 <code>${esc(task.remoteDirectory || task.workingDirectory)}</code></span></div>`:''}<label class="field-label">요청 내용</label><div class="task-description">${esc(task.description)}</div>${task.error?`<div class="task-error">${esc(task.error)}</div>`:''}${task.result?`<div class="result-heading"><label class="field-label">${task.agentId==='chief'?esc(agentById('chief').name)+'의 보고':'작업 결과'}</label><button class="small-button" data-action="copy-result" data-id="${id}">${icon('copy',13)}복사</button><button class="small-button" data-action="download-result" data-id="${id}">${icon('download',13)}저장</button></div><pre class="result-text">${esc(task.result)}</pre>`:''}${task.workerResult && task.agentId==='chief' && task.runMode==='codex'?`<details class="worker-result"><summary>담당 에이전트 원본 결과</summary><pre class="result-text">${esc(task.workerResult)}</pre></details>`:''}<div class="task-timeline"><h3>작업 타임라인</h3>${logs.map(l=>`<div><i class="timeline-dot"></i><time>${time(l.at)}</time><span>${esc(l.message)}</span></div>`).join('')||'<p>아직 실행 전이에요.</p>'}</div><div class="modal-footer"><span>${task.modelUsed?'사용 모델: '+esc(task.modelUsed)+(task.reasoningUsed?' · 추론 '+esc(task.reasoningUsed):''):task.runMode==='demo'?'데모 실행 결과':'서버에 저장되는 작업'}</span>${['done','failed','stopped'].includes(task.status)?`<button class="button subtle-button" data-action="continue-task" data-id="${id}">${icon('arrow',15)}이어서 작업</button>`:''}${task.goalId?`<button class="button primary" data-action="goal-details" data-id="${task.goalId}">${icon('target',15)}Goal 보기</button>`:running(task)||task.status==='queued'?`<button class="button danger" data-action="stop-task" data-id="${id}">${icon('stop',15)}작업 중지</button>`:`<button class="button primary" data-action="retry-task" data-id="${id}">${icon('refresh',15)}다시 실행</button>`}</div>`, 'wide-modal');
  modalTaskId = id; modalTaskSignature = `${task.status}:${task.progress}:${task.result}:${task.error}:${logs.length}`;
}
function presetSummary(values) {
  return `<div class="preset-summary">${state.agents.map(a=>{const value=FIXED_AGENT_IDS.includes(a.id)?{profile:'luna',reasoningEffort:'medium'}:values[a.id];return `<div><span>${esc(a.name)}</span><b>${profiles[value.profile]} / ${value.reasoningEffort[0].toUpperCase()+value.reasoningEffort.slice(1)}</b></div>`;}).join('')}</div>`;
}
function agentPresets() {
  const current=agentPresetValues(state.agents);
  const matches=values=>state.agents.every(a=>{const value=FIXED_AGENT_IDS.includes(a.id)?{profile:'luna',reasoningEffort:'medium'}:values[a.id];return value&&a.profile===value.profile&&a.reasoningEffort===value.reasoningEffort;});
  const card=(id,preset,custom=false)=>`<article class="preset-card ${matches(preset.agents)?'active':''}"><div class="preset-card-heading"><h3>${esc(preset.name)}</h3>${matches(preset.agents)?'<span>현재 설정</span>':''}</div>${presetSummary(preset.agents)}<div class="preset-card-actions"><button class="button primary" data-action="apply-agent-preset" data-id="${id}">적용하기</button>${custom?`<button class="text-button" data-action="delete-agent-preset" data-id="${id}">삭제</button>`:''}</div></article>`;
  openModal(`<h2>에이전트 모델 추론 프리셋</h2><p class="field-hint">선택하면 다음 모델 호출부터 적용돼요. 따까리·말똥이·비둘기는 항상 Luna / Medium이에요.</p><div class="preset-grid">${Object.entries(AGENT_PRESETS).map(([id,preset])=>card(id,preset)).join('')}</div><h3>내 프리셋</h3><form id="agent-preset-form"><label class="field-label" for="agent-preset-name">현재 설정 저장</label><div class="preset-save-row"><input id="agent-preset-name" name="name" maxlength="40" required placeholder="프리셋 이름"><button class="button primary" type="submit">저장하기</button></div><details><summary>현재 모델·추론 레벨 보기</summary>${presetSummary(current)}</details></form><div class="preset-grid custom-preset-grid">${(state.agentPresets||[]).map(preset=>card(preset.id,preset,true)).join('')||'<p class="field-hint">현재 조합을 저장해 나만의 프리셋을 만들어보세요.</p>'}</div>`, 'agent-presets-modal');
}
async function changeAgentPreset(action,presetId,name) {
  const scope=selectedComputerId;
  for(const agent of state.agents){let entry=saveEntry(agent.id,scope);while(entry?.pending||entry?.inflight){await flushAgentSave(agent.id,scope);entry=saveEntry(agent.id,scope);}if(entry?.failed)throw new Error('에이전트 설정 저장을 재시도해주세요.');}
  await api('agent-presets','POST',{action,presetId,name,officeId:scope});
  rawState=await api('state');applyOffice();update();agentPresets();
  toast(action==='apply'?'프리셋을 적용했어요.':action==='save'?'내 프리셋을 저장했어요.':'내 프리셋을 삭제했어요.');
}
function settings() {
  openModal(`<div class="modal-eyebrow">MAKE YOURSELF AT HOME</div><h2>사무실 설정</h2><p class="modal-intro">PC에 로그인된 Codex로 동료들이 실제 작업을 수행해요.</p>${window.pxDesktop?'<button class="button subtle-button" data-action="desktop-setup">Codex 계정·연결 설정</button>':''}
    <form id="settings-form">
      <label class="field-label" for="executor">작업 실행 방식</label>
      <select id="executor" name="executor"><option value="codex"${state.mode==='codex'?' selected':''}>Codex · ChatGPT 구독</option><option value="api"${state.mode==='api'?' selected':''}>모델 API</option><option value="demo"${state.mode==='demo'?' selected':''}>데모 · 실행 흐름 체험</option></select>
      <div class="codex-connection"><div><b>PC의 Codex 연결</b><p id="codex-status">${esc(state.codex.message)}</p><small>${esc(state.codex.version || '')}</small></div><button type="button" class="small-button" data-action="refresh-codex">${icon('refresh',13)}다시 확인</button></div>
      ${!state.codex.ready?'<p class="field-hint">실행 PC에서 <code>codex login</code>을 실행하고 ChatGPT 계정으로 로그인한 뒤 다시 확인하세요.</p>':''}
      <label class="field-label" for="working-directory">기본 작업 폴더</label><input id="working-directory" name="workingDirectory" value="${esc(state.settings.workingDirectory)}" required maxlength="4096"><p class="field-hint">실행 PC의 작업 시작 경로예요. 새 작업을 만들 때 따로 지정할 수 있어요.</p>
      <div class="form-notice">모든 에이전트가 전체 접근 권한으로 파일·명령·네트워크 작업을 승인 없이 실행해요. Codex는 기존 ChatGPT 로그인을 사용해요. 모델·추론 레벨·고정 프롬프트는 에이전트 상세 설정에서 바꿀 수 있어요.</div>
      <details class="advanced-connection" id="advanced-connection"${state.mode==='codex'?'':' open'}><summary>고급 연결 · 모델 ID 및 API</summary>
        <div class="model-settings">${Object.entries(profiles).map(([id,label])=>`<div><label class="field-label" for="setting-${id}">${label} 모델 ID</label><input id="setting-${id}" name="${id}" value="${esc(state.settings.models[id])}" placeholder="${MODEL_CATALOG[id].id}"></div>`).join('')}</div>
        <label class="field-label" for="api-url">모델 API 기본 주소</label><input type="url" id="api-url" name="baseUrl" value="${esc(state.settings.baseUrl)}" placeholder="http://localhost:1234/v1"><p class="field-hint">모델 API 방식에서만 사용하는 Chat Completions 기본 주소예요.</p>
        <label class="field-label" for="api-key">API 키</label><input type="password" id="api-key" name="apiKey" autocomplete="new-password" placeholder="${state.settings.hasApiKey?'저장된 키가 있어요 · 비워두면 유지':'모델 API 연결에만 사용'}"><p class="field-hint">Codex 구독 방식에는 API 키가 필요하지 않아요. API 방식은 텍스트 응답을 제공해요.</p>
      </details>
      <div class="settings-divider"></div><div class="settings-row"><div><b>대기열 ${state.settings.paused?'일시정지 중':'정상 실행 중'}</b><p>실행 중인 작업을 유지하고 다음 작업의 시작을 제어해요.</p></div><button type="button" class="small-button" data-action="pause-queue">${icon(state.settings.paused?'play':'pause',13)}${state.settings.paused?'계속 실행':'일시정지'}</button></div>
      <div class="settings-row"><div><b>이 사무실 작업 중지</b><p>실행 중인 Codex를 종료하고 대기열도 일시정지해요.</p></div><button type="button" class="small-button danger-text" data-action="stop-all">${icon('stop',13)}사무실 중지</button></div>
      <div class="settings-row"><div><b>작업·설정 백업</b><p>작업, 결과, 로그를 JSON으로 저장해요.</p></div><a href="/api/export" class="small-button" download>${icon('download',13)}내보내기</a></div>
      <div class="modal-footer"><span>${esc(state.computer.name)}에서 실행</span><button class="button primary" type="submit">설정 저장 ${icon('check',15)}</button></div>
    </form>`, 'settings-modal');
}
function computerDetails() {
  openModal(`<h2>작업할 컴퓨터</h2><p class="field-hint">Codex는 ${esc(state.computer.name)}에서 실행하고, 다른 컴퓨터에는 Tailscale 터미널로 접속해 작업해요.</p><div data-computer-list class="computer-picker"></div>`);
  updateComputers();void refreshComputers();
}

app.addEventListener('click', handleClick); modal.addEventListener('click', handleClick);
async function handleClick(event) {
  const nav = event.target.closest('[data-view]');
  if(nav) { view=nav.dataset.view; renderView(); return; }
  const select = event.target.closest('[data-select-agent]');
  if(select) { selectedAgent=selectedAgent===select.dataset.selectAgent?null:select.dataset.selectAgent; updateAgents(); updateOffice(); return; }
  const worker = event.target.closest('[data-agent],[data-label-agent]'); if(worker) { agentDetails(worker.dataset.agent||worker.dataset.labelAgent); return; }
  const button = event.target.closest('[data-action]'); if(!button) return;
  const action=button.dataset.action, id=button.dataset.id;
  try {
    if(action==='toggle-left-sidebar') { leftSidebarOpen=!leftSidebarOpen; localStorage.setItem('px-left-sidebar-open',String(leftSidebarOpen)); updateSidebar(); }
    if(action==='toggle-sidebar') { sidebarOpen=!sidebarOpen; localStorage.setItem('px-sidebar-open',String(sidebarOpen)); updateSidebar(); }
    if(action==='open-mailbox') openMailbox();
    if(action==='new-task') newTask();
    if(action==='continue-task') newTask('chief','',id);
    if(action==='assign') newTask(id);
    if(action==='secretary') secretaryDetails();
    if(action==='ask-secretary'){button.disabled=true;try{await askSecretary(button.dataset.question);}finally{button.disabled=false;}}
    if(action==='sample') newTask('chief','개발부서에 픽셀 사무실 대시보드 구조 검토를 맡기고 결과를 보고해줘');
    if(action==='agent-details') agentDetails(id);
    if(action==='task-details') taskDetails(id);
    if(action==='letter-details') await letterDetails(id);
    if(action==='goal-details') goalDetails(id);
    if(action==='stop-goal'||action==='resume-goal') { button.disabled=true; await api(`goals/${id}/${action==='stop-goal'?'stop':'resume'}`,'POST',{}); modal.close(); toast(action==='stop-goal'?'Goal을 중지했어요.':'Goal을 이어서 실행해요.'); }
    if(action==='read-all-letters') { await api('letters/read-all','POST',{officeId:selectedComputerId}); state.letters.forEach(letter=>letter.readAt ||= Date.now()); updateMailbox(); updateInbox(); }
    if(action==='task-status-filter') { taskStatusFilter=button.dataset.filter; updateMain(); }
    if(action==='mailbox-filter') { mailboxFilter=button.dataset.filter; updateInbox(); }
    if(action==='mark-letter-unread') { const result=await api(`letters/${id}`,'PATCH',{read:false}); Object.assign(state.letters.find(letter=>letter.id===id),result.letter); modal.close(); updateMailbox(); updateInbox(); }
    if(action==='retry-agent-save') { const entry=saveEntry(id); if(entry?.failed) { entry.pending={...entry.failed,editRevision:++editRevision}; await flushAgentSave(id); } }
    if(action==='usage-details') usageDetails();
    if(action==='refresh-usage') { button.disabled=true; await refreshAccountUsage(); button.disabled=false; }
    if(action==='department-speed') {
      if(button.disabled) return;
      const scope = selectedComputerId;
      const fastMode = button.getAttribute('aria-pressed') !== 'true';
      button.disabled = true;
      try {
        await api(`departments/${encodeURIComponent(id)}/speed`, 'PATCH', {officeId:scope, fastMode});
        rawState = await api('state'); applyOffice(); update();
      } finally { button.disabled = false; }
    }
    if(action==='edit-character') editCharacter(id);
    if(action==='agent-presets') agentPresets();
    if(action==='apply-agent-preset'||action==='delete-agent-preset'){button.disabled=true;try{await changeAgentPreset(action==='apply-agent-preset'?'apply':'delete',id);}finally{button.disabled=false;}}
    if(action==='history-cleanup') historyCleanup(id);
    if(action==='preview-history-delete') await previewHistoryDelete(button);
    if(action==='confirm-history-delete'){button.disabled=true;try{await api('history/delete','POST',{token:button.dataset.token,officeId:button.dataset.scope});rawState=await api('state');applyOffice();modal.close();update();toast('선택한 기록을 삭제했어요.');}finally{button.disabled=false;}}
    if(action==='settings') settings();
    if(action==='desktop-setup'){modal.close();events?.close();setupCleanup=await renderSetup({app,api,onComplete:async chooseComputer=>{if(!chooseComputer){selectedComputerId='local';localStorage.setItem('px-target-computer','local');}await initialize();if(chooseComputer)computerDetails();}});}
    if(action==='computer') computerDetails();
    if(action==='choose-folder'){const folder=await window.pxDesktop.chooseFolder();if(folder){document.querySelector('#task-form [name="workingDirectory"]').value=folder;document.querySelector('#chosen-folder').textContent=folder;}}
    if(action==='open-office'){rawState=await api('state');selectOffice(id);}
    if(action==='computer-settings') computerSettings(id);
    if(action==='select-computer') {
      const revision=++computerSelectionRevision;
      if(id!=='local') { const computer=computerList.computers.find(computer=>computer.id===id); if(computer?.online){if(!computer.username){computerSettings(id);return;}button.disabled=true;const result=await api(`computers/${encodeURIComponent(id)}/connect`,'POST',{});Object.assign(computer,result.computer);}else await api(`offices/${encodeURIComponent(id)}/open`,'POST',{}); }
      if(id==='local')await api('offices/local/open','POST',{});
      if(revision!==computerSelectionRevision)return;
      rawState=await api('state');if(revision!==computerSelectionRevision)return;
      selectOffice(id);toast(`${state.office.name} 사무실로 이동했어요.`);
    }
    if(action==='toggle-goal'||action==='toggle-tail-web') { const selected=button.getAttribute('aria-pressed')!=='true'; button.setAttribute('aria-pressed',String(selected)); button.classList.toggle('primary',selected); button.classList.toggle('subtle-button',!selected); }
    if(action==='close-modal') { flushAgentForm(); modal.close(); }
    if(action==='stop-task') { button.disabled=true; await api(`tasks/${id}/stop`,'POST',{}); modal.close(); toast('작업을 중지했어요.'); }
    if(action==='retry-task') { button.disabled=true; await api(`tasks/${id}/retry`,'POST',{}); modal.close(); toast('다시 실행하도록 대기열에 넣었어요.'); }
    if(action==='pause-queue') { await api('settings','PATCH',{ paused:!state.settings.paused,officeId:selectedComputerId }); if(modal.open) { modal.close(); } toast('대기열 설정을 변경했어요.'); }
    if(action==='stop-all') { await api('stop-all','POST',{officeId:selectedComputerId}); modal.close(); toast('이 사무실 작업을 중지하고 대기열을 일시정지했어요.'); }
    if(action==='sound') { muted=!muted; localStorage.setItem('px-muted',String(muted)); button.innerHTML=icon(muted?'mute':'volume',16); button.setAttribute('aria-label',muted?'사무실 소리 켜기':'사무실 소리 끄기'); toast(muted?'사무실 소리를 껐어요.':'사무실 소리를 켰어요.'); sound(); updateKeyboardSound(); }
    if(action==='refresh-codex') { button.disabled=true; state.codex=await api('codex/status','POST',{}); document.querySelector('#codex-status').textContent=state.codex.message; button.disabled=false; toast(state.codex.message,!state.codex.ready); }
    if(action==='expand') { document.querySelector('.office-panel').classList.toggle('expanded-office'); button.title=document.querySelector('.office-panel').classList.contains('expanded-office')?'크게 보기 닫기':'사무실 크게 보기'; }
    if(action==='copy-result') { const value=state.tasks.find(t=>t.id===id).result; if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value); else { const area=document.createElement('textarea'); area.value=value; modal.append(area); area.select(); if(!document.execCommand('copy')) throw new Error('브라우저가 복사를 허용하지 않았어요. 결과를 저장해주세요.'); area.remove(); } toast('결과를 복사했어요.'); }
    if(action==='download-result') { const t=state.tasks.find(t=>t.id===id); const blob=new Blob([t.result],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${t.title.replace(/[\\/:*?"<>|]/g,'_')}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  } catch(error) { button.disabled=false; toast(error.message,true); }
}
app.addEventListener('change', async event=>{
  if(event.target.matches('[data-model], [data-reasoning]')) {
    const isModel = event.target.matches('[data-model]');
    const id = isModel ? event.target.dataset.model : event.target.dataset.reasoning;
    const field = isModel ? 'profile' : 'reasoningEffort';
    queueAgentPatch(id, { [field]: event.target.value }, true);
  }
  if(event.target.id==='task-filter') { filter=event.target.value; updateMain(); }
});
modal.addEventListener('change', event=>{
  if(event.target.id==='cleanup-date')modal.querySelector('#cleanup-preview').innerHTML='';
  if(event.target.id==='secretary-reasoning') {
    const profile=agentById('secretary').profile;
    let effort=document.querySelector('#secretary-reasoning').value;
    if(!MODEL_CATALOG[profile].efforts.includes(effort))effort='medium';
    document.querySelector('#secretary-reasoning').innerHTML=reasoningOptions(profile,effort);
    queueAgentPatch('secretary',{profile,reasoningEffort:effort},true);
  }

  if(event.target.id==='executor') document.querySelector('#advanced-connection').open=event.target.value==='api';
  const form=event.target.closest('#agent-form'); if(form) queueAgentSave(form,true);
});
modal.addEventListener('input',event=>{if(event.target.id==='secretary-name'){const name=event.target.value.trim();if(name)queueAgentPatch('secretary',{name});else saveStatus('secretary','이름을 입력하면 자동 저장돼요.');}const form=event.target.closest('#agent-form');if(form) queueAgentSave(form);});
modal.addEventListener('focusout',event=>{const form=event.target.closest('#agent-form');if(form) flushAgentForm();});
app.addEventListener('input',event=>{ if(event.target.id==='task-search') { query=event.target.value; updateMain(); } });
modal.addEventListener('click',event=>{if(event.target===modal) { const r=modal.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) modal.close(); }});
modal.addEventListener('submit',async event=>{
  event.preventDefault(); const form=event.target, button=event.submitter || form.querySelector('[type="submit"]');
  if(!form.reportValidity()) return;
  const data=Object.fromEntries(new FormData(form)); if(button) button.disabled=true;
  try {
    if(form.id==='secretary-form'){try{await askSecretary(data.question);}finally{if(button)button.disabled=false;}}
    if(form.id==='task-form') { const isGoal=form.querySelector('[data-action="toggle-goal"]').getAttribute('aria-pressed')==='true'; await api(isGoal?'goals':'tasks','POST',{...data,tailWeb:form.querySelector('[data-action="toggle-tail-web"]').getAttribute('aria-pressed')==='true',...(!isGoal?{requireIdle:true}:{})}); modal.close(); if(isGoal) { view='tasks'; renderView(); } toast(isGoal?'Goal을 맡겼어요. 달성까지 이어서 진행해요.':'작업을 맡겼어요. 보고는 편지함으로 도착해요.'); }
    if(form.id==='agent-preset-form') await changeAgentPreset('save',undefined,data.name);
    if(form.id==='character-form') {
      const id=form.dataset.id, scope=selectedComputerId;
      await flushAgentSave(id);
      const entry=saveEntry(id);if(entry?.failed)throw new Error('설정 저장을 재시도한 뒤 변경해주세요.');
      await api(`agents/${id}`,'PATCH',{name:data.name,appearance:data.appearance,officeId:scope});
      rawState=await api('state');applyOffice();update();agentDetails(id);toast('이름과 캐릭터를 저장했어요.');
    }
    if(form.id==='computer-settings-form') { await api(`computers/${encodeURIComponent(form.dataset.id)}`,'PATCH',{username:data.username,...(data.sudoPassword?{sudoPassword:data.sudoPassword}:{}),clearSudoPassword:data.clearSudoPassword==='on'});await refreshComputers();modal.close();toast('컴퓨터 접속 설정을 저장했어요.'); }
    if(form.id==='agent-form') { queueAgentSave(form,true); }
    if(form.id==='settings-form') {
      await api('settings','PATCH',{executor:data.executor, workingDirectory:data.workingDirectory, baseUrl:data.baseUrl, models:Object.fromEntries(Object.keys(profiles).map(key=>[key,data[key]])), ...(data.apiKey.trim()?{apiKey:data.apiKey}:{})});
      modal.close(); toast(data.executor==='codex'?'Codex 구독 연결 설정을 저장했어요.':data.executor==='api'?'모델 API 연결 설정을 저장했어요.':'데모 모드로 설정했어요.');
    }
  } catch(error) { toast(error.message,true); if(button) button.disabled=false; }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape') document.querySelector('.expanded-office')?.classList.remove('expanded-office');
  const worker=event.target.closest('[data-agent],[data-label-agent]'); if(worker && ['Enter',' '].includes(event.key)) { event.preventDefault(); agentDetails(worker.dataset.agent||worker.dataset.labelAgent); }
  if(event.key.toLowerCase()==='n'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!modal.open&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&state) {event.preventDefault(); newTask();}
});
function loginScreen() {
  app.innerHTML=`<div class="login-screen"><div class="login-card"><span class="brand-symbol">${icon('office',36)}</span><span class="eyebrow">WELCOME BACK, BOSS</span><h1>나의 작은 사무실</h1><p>사무실 비밀번호를 입력해주세요.</p><form id="login-form"><input type="password" name="password" placeholder="비밀번호" aria-label="사무실 비밀번호" autocomplete="current-password" required><button class="button primary" type="submit">사무실 입장 ${icon('arrow',16)}</button><p id="login-error" role="alert"></p></form></div></div>`;
  document.querySelector('#login-form').addEventListener('submit',async e=>{e.preventDefault(); try {await api('auth','POST',Object.fromEntries(new FormData(e.target))); await initialize();}catch(error){document.querySelector('#login-error').textContent=error.message;}});
}
async function initialize() {
  setupCleanup?.();setupCleanup=null;
  try {
    const auth=await api('auth'); if(!auth.authenticated) {loginScreen();return;}
    rawState=await api('state');applyOffice();
    if(window.pxDesktop&&!rawState.settings.setupComplete){events?.close();setupCleanup=await renderSetup({app,api,onComplete:async chooseComputer=>{if(!chooseComputer){selectedComputerId='local';localStorage.setItem('px-target-computer','local');}await initialize();if(chooseComputer)computerDetails();}});return;}
    void refreshAccountUsage();void refreshComputers(); seenReports=new Set((rawState.letters || []).map(letter=>letter.id)); shell();
    events?.close(); events=new EventSource('/api/events');
    events.onmessage=event=>{
      const next=JSON.parse(event.data);
      const currentOffice=projectOffice(next,selectedComputerId);
      const newReport=currentOffice.letters.find(letter=>!seenReports.has(letter.id));
      (next.letters || []).forEach(letter=>seenReports.add(letter.id));
      rawState=next;applyOffice(); connected=true; update();
      if(newReport) {toast(`${agentById(newReport.senderId).name}의 보고 편지가 도착했어요.`);sound();}
    };
    events.onerror=()=>{connected=false;updateConnection();updateKeyboardSound();};
  } catch(error) { app.innerHTML=`<div class="boot"><span class="boot-mark">PX</span><h2>사무실에 연결할 수 없어요.</h2><p>터미널에서 npm start로 서버를 실행해주세요.</p><button class="button primary" data-action="reload">다시 연결</button></div>`; document.querySelector('[data-action="reload"]').onclick=initialize; }
}
setInterval(()=>{updateClock();},30_000);
initialize();

setInterval(()=>{if(state && document.querySelector('#account-usage-content')) void refreshAccountUsage();},60000);

setInterval(()=>{if(state)void refreshComputers();},30000);
