export function createUpdateUI({modal,openModal,esc,beforeApply=async()=>{}}) {
  let state={status:'unsupported',message:'업데이트는 설치된 데스크톱 앱에서 사용할 수 있어요.',progress:0};
  function render(next=state) {
    state=next;
    const badge=document.querySelector('[data-update-badge]');if(badge)badge.hidden=!['available','downloading','verifying','ready'].includes(next.status);
    const panel=modal.querySelector('[data-update-content]');if(!panel)return;
    const working=['checking','downloading','verifying','installing'].includes(next.status),progress=Math.max(0,Math.min(100,Number(next.progress)||0));
    panel.innerHTML=`${next.currentVersion?`<p class="update-version">현재 ${esc(next.currentVersion)}${next.latestVersion?` → 최신 ${esc(next.latestVersion)}`:''}</p>`:''}<p role="status" class="update-message">${esc(next.message)}</p>${['downloading','verifying'].includes(next.status)?`<div class="update-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><small>${progress}%</small>`:''}${next.notes?`<details class="update-notes"><summary>이번 버전 변경 사항</summary><pre>${esc(next.notes)}</pre></details>`:''}<p class="field-hint">설정·작업 기록·고정 프롬프트는 유지돼요. 업데이트 설치 전에는 진행 중이거나 대기 중인 작업과 Goal을 완료하거나 중지해주세요.</p><div class="modal-footer">${next.status==='unsupported'?'<a class="button primary" href="https://github.com/choimagon/PXagent/releases/latest" target="_blank" rel="noopener">설치파일 다운로드</a>':`<button class="button subtle-button" data-action="update-check" ${working?'disabled':''}>다시 확인</button>${next.status==='available'?'<button class="button primary" data-action="update-download">업데이트 다운로드</button>':''}${next.status==='ready'?'<button class="button subtle-button" data-action="update-open-file">설치파일 열기</button><button class="button primary" data-action="update-install">업데이트하고 재시작</button>':''}${['downloading','verifying'].includes(next.status)?'<button class="button subtle-button" data-action="update-cancel">다운로드 취소</button>':''}`}</div>`;
  }
  async function action(action='status') {
    if(action==='status'){openModal('<div class="modal-eyebrow">PXAGENTS UPDATE</div><h2>앱 업데이트</h2><div data-update-content></div>');render();}
    const methods={status:'updateStatus',check:'checkUpdate',download:'downloadUpdate',cancel:'cancelUpdate',install:'installUpdate','open-file':'openUpdateFile'},method=window.pxDesktop?.[methods[action]];if(!method)return;
    try{if(action==='install'||action==='open-file')await beforeApply();const next=await method();if(next)render(next);if(action==='status'&&['idle','current','error'].includes(state.status))void actionCheck();}
    catch(error){render({...state,message:error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'')});}
  }
  const actionCheck=()=>action('check');
  if(window.pxDesktop?.onUpdateStatus)window.pxDesktop.onUpdateStatus(render);
  async function refresh(){if(window.pxDesktop?.updateStatus){render(await window.pxDesktop.updateStatus());await actionCheck();}}
  return {action,refresh};
}
