import {test,expect} from '@playwright/test';
async function changeDetailModel(page,id,model) {
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.locator(`#model-${id}`).selectOption(model);
  await expect(page.locator(`[data-row="${id}"] .agent-model-name`)).toHaveText(model[0].toUpperCase()+model.slice(1));
  await page.locator(`#office-svg [data-agent="${id}"]`).click();
}


test('office controls, real-time sidebar, delegation, model changes and persistence',async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/오피스 뷰/})).toBeVisible();
  await expect(page.locator('#office-svg [data-agent]')).toHaveCount(9);
  await expect(page.locator('#office-svg')).toBeVisible();
  await expect(page.locator('#connection')).toContainText('연결됨');
  await expect(page.locator('.agent-model-summary')).toHaveCount(9);
  await expect(page.locator('[data-row="dev"] .agent-model-name')).toHaveText('Terra');
  await expect(page.locator('[data-row="dev"] .agent-reasoning-summary')).toHaveText('추론 Medium');
  const dot=await page.locator('[data-row="dev"] .agent-dot').boundingBox();expect(dot.width).toBe(24);expect(dot.height).toBe(24);
  await expect(page.locator('#office-svg .agent-indicator').first()).toHaveAttribute('r','6');
  await page.screenshot({path:'test-results/office-desktop.png',fullPage:true});
  await page.locator('#office-svg [data-agent="dev"]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#agent-profile')).toHaveCount(0);
  await changeDetailModel(page,'dev','sol');
  await page.locator('#agent-reasoning').selectOption('high');
  await page.locator('#agent-fixed-prompt').fill('항상 결론부터 보고하고 코드 검증 방법을 함께 제시해줘.');
  await expect(page.locator('#agent-save-status')).toHaveText('자동 저장됨');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.locator('#model-dev')).toHaveValue('sol');
  await expect(page.locator('#reasoning-dev')).toHaveValue('high');
  await expect(page.locator('[data-row="dev"] .agent-model-name')).toHaveText('Sol');
  await expect(page.locator('[data-row="dev"] .agent-reasoning-summary')).toHaveText('추론 High');
  await expect(page.locator('#stats')).toHaveCount(0);
  await expect(page.locator('#chief-message')).toHaveCount(0);
  await expect(page.locator('.rail [data-view="inbox"]')).toBeVisible();
  const second=await context.newPage();await second.goto('/');await expect(second.locator('#connection')).toContainText('연결됨');
  await page.getByRole('button',{name:'일 시키기'}).click();
  await page.locator('#task-description').fill('개발부서에 API 구조 검토를 맡겨줘 UI '+Date.now());
  await page.getByRole('button',{name:'시작하기',exact:true}).click();
  await expect(page.locator('#office-svg [data-agent="chief"]')).toHaveClass(/is-running/);
  await expect(second.locator('#running-count')).not.toHaveText('0');
  await expect(page.locator('[data-row="chief"] .agent-mini')).toBeVisible();
  await page.locator('#model-dev').selectOption('luna');
  await expect(page.locator('#model-dev')).toHaveValue('luna');
  await page.locator('#reasoning-dev').selectOption('max');
  await expect(page.locator('#reasoning-dev')).toHaveValue('max');
  await expect(page.locator('[data-row="dev"] .agent-model-name')).toHaveText('Luna');
  await expect(page.locator('[data-row="dev"] .agent-reasoning-summary')).toHaveText('추론 Max');
  await page.screenshot({path:'test-results/office-running.png',fullPage:true});
  await page.getByRole('button',{name:'작업 현황',exact:true}).click();
  await page.locator('#task-board [data-action="task-details"]').first().click();
  await expect(page.locator('#task-board')).toContainText('완료',{timeout:15000});
  await expect(page.locator('.result-text')).toContainText('개발노예');
  await expect(page.locator('.result-text')).toContainText('데모');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'작업 현황',exact:true}).click();await expect(page.locator('#task-board')).toContainText('완료');
  await page.locator('[data-select-agent=dev]').click();
  await expect(page.locator('#model-dev')).toHaveValue('luna');
  await expect(page.locator('#reasoning-dev')).toHaveValue('max');
  await page.locator('[data-row="dev"] [data-action="agent-details"]').click();
  await expect(page.locator('#agent-fixed-prompt')).toHaveValue('항상 결론부터 보고하고 코드 검증 방법을 함께 제시해줘.');
  await page.screenshot({path:'test-results/agent-settings.png',fullPage:true});
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'작업 현황',exact:true}).click();
  await expect(page.getByRole('heading',{name:'작업 현황',exact:true})).toBeVisible();
  await page.locator('#task-search').fill('zz-no-result-zz');await expect(page.locator('.task-status-list .task-row')).toHaveCount(0);
  await page.getByRole('button',{name:'활동 기록',exact:true}).click();await expect(page.locator('.log-row').first()).toBeVisible();
  await page.getByRole('button',{name:'사무실',exact:true}).click();
  await page.screenshot({path:'test-results/office-working.png',fullPage:true});
  await page.getByRole('button',{name:'사무실 설정',exact:true}).first().click();await expect(page.locator('#api-url')).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
  expect(errors).toEqual([]);await second.close();
});
test('mobile layout has no horizontal overflow and keyboard can open agent settings',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('#office-svg')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/office-mobile.png',fullPage:true});
  const agent=page.locator('#office-svg [data-agent="misc"]');await agent.focus();await page.keyboard.press('Enter');await expect(page.locator('#modal')).toContainText('말똥이');
  await page.keyboard.press('Escape');await expect(page.locator('#modal')).not.toBeVisible();
});
test('Astra excludes none and changing models adjusts unsupported reasoning',async({page})=>{
  await page.goto('/');await page.locator('#office-svg [data-agent="format"]').click();
  await changeDetailModel(page,'format','luna');
  await page.locator('#agent-reasoning').selectOption('none');
  await changeDetailModel(page,'format','astra');
  await expect(page.locator('#agent-reasoning')).toHaveValue('medium');
  await expect(page.locator('#agent-reasoning option')).toHaveText(['낮음 · Low','보통 · Medium','높음 · High','매우 높음 · XHigh','최대 · Max']);
  await page.locator('#agent-reasoning').selectOption('xhigh');
  await expect(page.locator('#agent-save-status')).toHaveText('자동 저장됨');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.locator('#model-format')).toHaveValue('astra');await expect(page.locator('#reasoning-format')).toHaveValue('xhigh');
  await page.locator('#model-format').selectOption('luna');await page.locator('#reasoning-format').selectOption('none');
  await page.locator('#model-format').selectOption('astra');await expect(page.locator('#reasoning-format')).toHaveValue('medium');
  await expect(page.locator('#reasoning-format option[value="none"]')).toHaveCount(0);
});

test('Codex subscription screen exposes workspace, live commands and login without API credentials',async({page,request})=>{
  const state=await (await request.get('/api/state')).json();
  state.offices.local.agents=state.agents;
  state.mode='codex';state.settings.executor='codex';state.codex={ready:true,installed:true,auth:'chatgpt',version:'codex-cli test',message:'ChatGPT 구독 로그인 연결됨'};
  const task={id:'codex-ui-task',title:'실제 개발 작업',description:'파일 생성과 검증',agentId:'dev',activeAgentId:'dev',status:'running',runMode:'codex',progress:40,createdAt:Date.now(),startedAt:Date.now(),result:'',error:null,workingDirectory:state.settings.workingDirectory,computerName:state.computer.name,lastActivity:'명령 실행 · node verify.mjs'};
  state.tasks.push(task);state.logs.push({id:'codex-ui-log',at:Date.now(),agentId:'dev',taskId:task.id,message:'파일 변경 · add: artifact.txt'});
  Object.assign(state.agents.find(agent=>agent.id==='dev'),{status:'running',phase:'coding',activeTaskId:task.id,progress:40});
  await page.route('**/api/state',route=>route.fulfill({json:state}));
  await page.route('**/api/events',route=>route.abort());
  let submitted;
  await page.route('**/api/tasks',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'submitted'}});});
  await page.goto('/');await expect(page.locator('#mode-badge')).toHaveText('CODEX · 구독');
  await expect(page.locator('[data-row="dev"]')).toContainText('명령 실행 · node verify.mjs');
  await page.getByRole('button',{name:'작업 현황',exact:true}).click();
  await page.locator('#task-board [data-action="task-details"]').first().click();
  await expect(page.locator('#modal')).toContainText('artifact.txt');await expect(page.locator('.task-execution-facts')).toContainText(state.settings.workingDirectory);
  await page.screenshot({path:'test-results/codex-execution.png',fullPage:true});
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'일 시키기'}).click();
  await expect(page.locator('#task-directory')).toHaveCount(0);
  const goalButton=page.getByRole('button',{name:'Goal',exact:true});
  await expect(goalButton).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#task-form textarea')).toHaveCount(2);
  await expect(page.locator('#task-form button')).toHaveCount(3);
  await goalButton.click();await expect(goalButton).toHaveAttribute('aria-pressed','true');
  expect(submitted).toBeUndefined();
  await goalButton.click();await expect(goalButton).toHaveAttribute('aria-pressed','false');
  await page.locator('#task-description').fill('/Users/example/project with spaces 폴더에서 구독으로 실제 작업');
  await page.getByRole('button',{name:'시작하기',exact:true}).click();
  expect(submitted.agentId).toBe('chief');expect(submitted.description).toBe('/Users/example/project with spaces 폴더에서 구독으로 실제 작업');
  await page.getByRole('button',{name:'사무실 설정',exact:true}).first().click();
  await expect(page.locator('#executor')).toHaveValue('codex');await expect(page.locator('#codex-status')).toHaveText('ChatGPT 구독 로그인 연결됨');
  await expect(page.locator('#api-key')).not.toBeVisible();await expect(page.locator('#working-directory')).toBeVisible();
  await expect(page.locator('#settings-form')).toContainText('격리된 프로젝트 폴더');
  await page.screenshot({path:'test-results/codex-settings.png',fullPage:true});
});

test('closing settings saves prompts; Goal progress arrives as readable letters and survives reload',async({page,request})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('#office-svg [data-agent="writer"]').click();
  await page.locator('#agent-prompt').fill('자동 저장할 논문 작성 역할');
  await page.locator('#agent-fixed-prompt').fill('닫아도 유지되는 고정 프롬프트');
  await page.keyboard.press('Escape');
  await expect.poll(async()=>{const state=await(await request.get('/api/state')).json();return state.agents.find(a=>a.id==='writer').fixedPrompt;}).toBe('닫아도 유지되는 고정 프롬프트');
  await page.reload();await page.locator('#office-svg [data-agent="writer"]').click();
  await expect(page.locator('#agent-prompt')).toHaveValue('자동 저장할 논문 작성 역할');await expect(page.locator('#agent-fixed-prompt')).toHaveValue('닫아도 유지되는 고정 프롬프트');
  await page.locator('#agent-fixed-prompt').fill('새로고침 직전 입력도 저장');await page.reload();
  await expect.poll(async()=>{const state=await(await request.get('/api/state')).json();return state.agents.find(a=>a.id==='writer').fixedPrompt;}).toBe('새로고침 직전 입력도 저장');
  await page.locator('#office-svg [data-agent="writer"]').click();await expect(page.locator('#agent-fixed-prompt')).toHaveValue('새로고침 직전 입력도 저장');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'일 시키기'}).click();
  await expect(page.getByRole('heading',{name:'무슨 일을 맡길까요?'})).toBeVisible();
  await expect(page.getByRole('button',{name:'시작하기',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Goal',exact:true})).toHaveAttribute('aria-pressed','false');
  const title='보고 편지 Goal '+Date.now();await page.locator('#task-description').fill(title);
  await page.getByRole('button',{name:'Goal',exact:true}).click();
  await expect(page.getByRole('button',{name:'Goal',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#modal')).toBeVisible();
  await page.getByRole('button',{name:'시작하기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'작업 현황',exact:true})).toBeVisible();
  const card=page.locator('.goal-card').filter({hasText:title});await expect(card).toContainText('달성 완료',{timeout:15000});await expect(card).toContainText('2회차');
  await expect(page.locator('#sidebar-unread-count')).not.toHaveText('0');
  await page.screenshot({path:'test-results/goal-status.png',fullPage:true});
  await card.locator('[data-action="goal-details"]').click();await expect(page.locator('.goal-letter-history button')).toHaveCount(2);await expect(page.locator('#modal')).toContainText(title);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.locator('.mailbox-heading').click();await expect(page.getByRole('heading',{name:'편지함',exact:true})).toBeVisible();
  const letter=page.locator('.letter-card').filter({hasText:'Goal 달성 · '+title});await expect(letter).toHaveClass(/unread/);
  await page.screenshot({path:'test-results/inbox-desktop.png',fullPage:true});
  await letter.click();await expect(page.locator('.letter-text')).toContainText('데모 Goal 검토');await expect(page.locator('.letter-signature')).toHaveText('호문클루스 드림');
  await page.screenshot({path:'test-results/report-letter.png',fullPage:true});
  await page.getByRole('button',{name:'편지 닫기',exact:true}).click();await expect(letter).toHaveClass(/\bread\b/);
  await page.reload();await page.locator('.mailbox-heading').click();await expect(letter).toHaveClass(/\bread\b/);
  await letter.click();await page.getByRole('button',{name:'안 읽음으로 표시'}).click();await expect(letter).toHaveClass(/unread/);
  await page.setViewportSize({width:390,height:844});await expect(letter).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/inbox-mobile.png',fullPage:true});await letter.click();expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'편지 닫기',exact:true}).click();await page.getByRole('button',{name:'모두 읽음'}).click();await expect(page.locator('#sidebar-unread-count')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('continue button opens a fresh request and submits the previous task id',async({page,request})=>{
  const state=await(await request.get('/api/state')).json();
  const source={id:'continue-source',title:'이전 작업',description:'첫 요청',result:'첫 결과',agentId:'chief',status:'done',progress:100,createdAt:Date.now(),workingDirectory:state.settings.workingDirectory};
  state.tasks.push(source);
  await page.route('**/api/state',route=>route.fulfill({json:state}));
  await page.route('**/api/events',route=>route.abort());
  let submitted;
  await page.route('**/api/tasks',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'continued'}});});
  await page.goto('/');
  await page.getByRole('button',{name:'작업 현황',exact:true}).click();
  await page.locator('[data-action="task-details"][data-id="continue-source"]').first().click();
  await page.getByRole('button',{name:'이어서 작업',exact:true}).click();
  await expect(page.locator('#task-description')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Goal',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.locator('#task-description').fill('이어서 두 번째 수정');
  await page.getByRole('button',{name:'시작하기',exact:true}).click();
  expect(submitted.parentTaskId).toBe(source.id);
  expect(submitted.description).toBe('이어서 두 번째 수정');
});

test('office stays simple, mailbox sits left, and the team sidebar can close and reopen',async({page,request})=>{
  const state=await(await request.get('/api/state')).json();
  state.letters.push({id:'bold-letter',taskId:'bold-task',senderId:'chief',subject:'담당자 표시 확인',body:'담당: 개발노예\n호문클루스가 검토했습니다. <script>실행되지 않음</script>',createdAt:Date.now(),readAt:null,status:'done'});
  await page.route('**/api/state',route=>route.fulfill({json:state}));
  await page.route('**/api/events',route=>route.abort());
  await page.route('**/api/letters/bold-letter',route=>{state.letters.find(l=>l.id==='bold-letter').readAt=Date.now();return route.fulfill({json:{letter:state.letters.find(l=>l.id==='bold-letter')}});});
  await page.goto('/');
  await expect(page.locator('.office-mail-button .mail-alert')).toBeVisible();
  const actions=await page.locator('.office-actions').boundingBox();
  const newButton=await page.locator('.office-actions [data-action="new-task"]').boundingBox();
  const leftButton=await page.locator('.office-actions .left-sidebar-toggle').boundingBox();
  expect(leftButton.x).toBe(actions.x);
  expect(newButton.x).toBeGreaterThan(leftButton.x);
  await expect(page.locator('.view-controls .sidebar-toggle')).toHaveText('▶');
  const controls=await page.locator('.view-controls').boundingBox();
  expect(Math.round(controls.x+controls.width)).toBe(Math.round(actions.x+actions.width));
  await expect(page.locator('.left-sidebar-toggle')).toHaveText('◀');
  const mailBackground=await page.locator('.office-mail-button').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(mailBackground).toBe(await page.locator('.office-actions [data-action="new-task"]').evaluate(el=>getComputedStyle(el).backgroundColor));
  for (const toggle of await page.locator('.sidebar-toggle').all()) {
    expect(await toggle.evaluate(el=>getComputedStyle(el).borderTopColor)).toBe(mailBackground);
    expect(await toggle.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  }
  const workspaceWidth=(await page.locator('.workspace').boundingBox()).width;
  await page.getByRole('button',{name:'왼쪽 사이드바 닫기',exact:true}).click();
  await expect(page.locator('#navigation-sidebar')).toBeHidden();
  expect((await page.locator('.workspace').boundingBox()).width).toBeGreaterThan(workspaceWidth);
  await page.reload();await expect(page.locator('#navigation-sidebar')).toBeHidden();
  await page.getByRole('button',{name:'왼쪽 사이드바 열기',exact:true}).click();
  await expect(page.locator('#navigation-sidebar')).toBeVisible();
  await expect(page.locator('#main>section')).toHaveCount(1);
  await expect(page.locator('#stats')).toHaveCount(0);
  await expect(page.locator('#sidebar-letters')).toHaveCount(0);
  await expect(page.locator('.rail .account-usage')).toBeVisible();
  await expect(page.locator('.agent-sidebar .sidebar-mailbox')).toHaveCount(0);
  const before=(await page.locator('#main').boundingBox()).width;
  await page.getByRole('button',{name:'오른쪽 사이드바 닫기',exact:true}).click();
  await expect(page.locator('#agent-sidebar')).toBeHidden();
  expect((await page.locator('#main').boundingBox()).width).toBeGreaterThan(before);
  await page.reload();await expect(page.locator('#agent-sidebar')).toBeHidden();
  await page.getByRole('button',{name:'오른쪽 사이드바 열기',exact:true}).click();
  await expect(page.locator('#agent-sidebar')).toBeVisible();
  await page.screenshot({path:'test-results/office-simplified.png',fullPage:true});
  await page.locator('.office-mail-button').click();
  await expect(page.locator('#modal .mailbox-modal')).toBeVisible();
  await expect(page.getByRole('heading',{name:/오피스 뷰/})).toBeVisible();
  await expect(page.locator('#view-label')).toHaveText('사무실');
  await expect(page.getByRole('heading',{name:'편지함',exact:true})).toBeVisible();
  await page.locator('.letter-card').filter({hasText:'담당자 표시 확인'}).click();
  await expect(page.locator('.letter-text strong')).toHaveText(['개발노예','호문클루스']);
  expect(await page.locator('.letter-text strong').first().evaluate(el=>getComputedStyle(el).fontWeight)).toBe('700');
  await expect(page.locator('.letter-text script')).toHaveCount(0);
  await page.screenshot({path:'test-results/letter-bold-names.png',fullPage:true});
  await page.getByRole('button',{name:'편지 닫기',exact:true}).click();
  await expect(page.locator('#modal .mailbox-modal')).toBeVisible();
  await page.locator('.inbox-filters [data-filter="all"]').click();
  await page.getByRole('button',{name:'모두 읽음',exact:true}).click();
  await expect(page.locator('.office-mail-button .mail-alert')).toBeHidden();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'오른쪽 사이드바 닫기',exact:true}).click();
  await expect(page.locator('#agent-sidebar')).toBeHidden();
  await page.getByRole('button',{name:'오른쪽 사이드바 열기',exact:true}).click();
  await expect(page.locator('#agent-sidebar')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('subscription replaces the rail settings and shows quota and reset credits',async({page})=>{
  await page.route('**/api/codex/usage',route=>route.fulfill({json:{available:true,email:'usage@example.test',planType:'pro',windows:[{name:'',bucket:'codex',usedPercent:23,windowDurationMins:300,resetsAt:1789300000}],resetsAvailable:4,checkedAt:Date.now()}}));
  await page.goto('/');
  await expect(page.locator('.rail [data-action="settings"]')).toHaveCount(0);
  await expect(page.locator('#sidebar-letters')).toHaveCount(0);
  await expect(page.locator('#account-usage-content')).toContainText('23% 사용');
  await expect(page.locator('#account-usage-content')).toContainText('4개');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'구독 사용량과 초기화권 보기',exact:true}).click();
  await expect(page.locator('#usage-details-content')).toContainText('usage@example.test');
  await expect(page.locator('#usage-details-content')).toContainText('4개');
});

test('Tailscale computer gear saves private credentials and selection routes a new task',async({page})=>{
  const computer={id:'ui-remote',name:'연구실 컴퓨터',ip:'100.64.1.2',platform:'linux',online:true,terminalSupported:true,username:'',homeDirectory:'',hasSudoPassword:false};
  await page.route('**/api/computers',route=>route.fulfill({json:{available:true,computers:[computer]}}));
  let settings,submitted;
  await page.route('**/api/computers/ui-remote',route=>{settings=route.request().postDataJSON();Object.assign(computer,{username:settings.username,hasSudoPassword:true});return route.fulfill({json:{ok:true,computer}});});
  await page.route('**/api/computers/ui-remote/connect',route=>{computer.homeDirectory='/home/researcher';return route.fulfill({json:{ok:true,computer}});});
  await page.route('**/api/tasks',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'ui-remote-task'}});});
  await page.goto('/');
  await expect(page.locator('.rail [data-computer-list]')).toHaveCount(0);
  await page.locator('[data-action="computer"]').click();
  const remoteRow=page.locator('.computer-picker .computer-row').filter({has:page.locator('[data-id="ui-remote"]')});
  await expect(remoteRow).toContainText('Linux · 온라인 | None');
  await expect(remoteRow.locator('.computer-status.online')).toBeVisible();
  expect(await remoteRow.locator('.computer-settings').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(34);
  await page.getByRole('button',{name:'연구실 컴퓨터 접속 설정',exact:true}).click();
  await page.locator('#remote-username').fill('researcher');await page.locator('#remote-sudo-password').fill('dummy-sudo-ui');
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(page.locator('#modal')).toBeHidden();expect(settings.username).toBe('researcher');expect(settings.sudoPassword).toBe('dummy-sudo-ui');
  await page.locator('[data-action="computer"]').click();
  await expect(remoteRow).toContainText('Linux · 온라인 | researcher_비번 저장됨');
  await expect(page.locator('body')).not.toContainText('dummy-sudo-ui');
  if(!await page.locator('.computer-picker').isVisible())await page.locator('[data-action="computer"]').click();
  await page.locator('.computer-picker [data-action="select-computer"][data-id="ui-remote"]').click();
  await expect(page.locator('#computer-name')).toHaveText('연구실 컴퓨터');
  await page.getByRole('button',{name:'일 시키기',exact:true}).click();
  await page.locator('#task-description').fill('원격 파일 목록 확인');await page.getByRole('button',{name:'시작하기',exact:true}).click();
  expect(submitted.machineId).toBe('ui-remote');expect(submitted.remoteDirectory).toBe('/home/researcher');expect(JSON.stringify(submitted)).not.toContain('dummy-sudo-ui');
  await page.locator('[data-action="computer"]').click();
  await page.getByRole('button',{name:'연구실 컴퓨터 접속 설정',exact:true}).click();await expect(page.locator('#remote-sudo-password')).toHaveValue('');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="computer"]').click();
  await expect(page.getByRole('button',{name:'연구실 컴퓨터 접속 설정',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('Tailscale device additions and name/IP changes appear automatically',async({page})=>{
  const computers=[{id:'auto-one',name:'기존 컴퓨터',ip:'100.64.1.2',platform:'linux',online:true,terminalSupported:true,username:'user',hasSudoPassword:true}];
  await page.clock.install();
  await page.route('**/api/computers',route=>route.fulfill({json:{available:true,computers}}));
  await page.goto('/');await page.locator('[data-action="computer"]').click();await expect(page.locator('.computer-picker [data-id="auto-one"]').first()).toContainText('기존 컴퓨터');
  computers[0].name='변경된 컴퓨터';computers[0].ip='100.64.1.4';computers[0].online=false;
  computers.push({id:'auto-two',name:'추가된 컴퓨터',ip:'100.64.1.3',platform:'linux',online:true,terminalSupported:true,username:'',hasSudoPassword:false});
  await page.clock.fastForward(31000);
  await expect(page.locator('.computer-picker [data-id="auto-one"]').first()).toContainText('변경된 컴퓨터');
  await expect(page.locator('.computer-picker [data-id="auto-one"] .computer-status.offline')).toBeVisible();
  await expect(page.locator('.computer-picker [data-id="auto-one"]').first()).toContainText('오프라인');
  await expect(page.getByRole('button',{name:'추가된 컴퓨터 접속 설정',exact:true})).toBeVisible();
});


test('office audio plays typing only during work and louder report chimes, with persistent mute',async({page,request})=>{
  const snapshot=await(await request.get('/api/state')).json();
  snapshot.offices.local.agents=snapshot.agents;
  snapshot.agents[0].status='running';snapshot.agents[0].phase='coding';
  await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
  await page.addInitScript(()=>{
    localStorage.removeItem('px-muted');
    window.audioEvents={taps:0,notes:0,peak:0,stops:0};
    class Context {
      state='running';currentTime=0;sampleRate=44100;destination={};
      resume(){return Promise.resolve();}
      createBuffer(_,size){return {getChannelData:()=>new Float32Array(size)};}
      createBufferSource(){return {playbackRate:{value:1},connect(){},disconnect(){},start(){window.audioEvents.taps++;},stop(){window.audioEvents.stops++;}};}
      decodeAudioData(){return Promise.resolve({duration:63.2});}
      createBiquadFilter(){return {frequency:{value:0},Q:{value:0},connect(){},disconnect(){}};}
      createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(value){window.audioEvents.peak=Math.max(window.audioEvents.peak,value);},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
      createOscillator(){return {frequency:{value:0},connect(){},disconnect(){},start(){window.audioEvents.notes++;},stop(){}};}
    }
    window.AudioContext=Context;
    window.EventSource=class {constructor(){window.officeEvents=this;}close(){}};
  });
  await page.goto('/');
  await page.waitForFunction(()=>typeof window.officeEvents?.onmessage==='function');
  await page.evaluate(snapshot=>window.officeEvents.onmessage({data:JSON.stringify(snapshot)}),snapshot);
  await expect.poll(()=>page.evaluate(()=>window.audioEvents.taps)).toBeGreaterThan(0);
  await page.locator('.rail [data-view="logs"]').click();
  const paused=await page.evaluate(()=>window.audioEvents.taps);
  await page.waitForTimeout(1100);expect(await page.evaluate(()=>window.audioEvents.taps)).toBe(paused);expect(await page.evaluate(()=>window.audioEvents.stops)).toBeGreaterThan(0);
  await page.locator('.rail [data-view="office"]').click();
  await expect.poll(()=>page.evaluate(()=>window.audioEvents.taps)).toBeGreaterThan(paused);
  snapshot.agents[0].status='idle';
  snapshot.letters.push({id:'audio-test-report',senderId:'chief',subject:'소리 확인',body:'완료',createdAt:Date.now(),read:false});
  await page.evaluate(snapshot=>window.officeEvents.onmessage({data:JSON.stringify(snapshot)}),snapshot);
  expect(await page.evaluate(()=>window.audioEvents.notes)).toBe(3);
  expect(await page.evaluate(()=>window.audioEvents.peak)).toBe(.45);
  const completed=await page.evaluate(()=>window.audioEvents.taps);
  await page.waitForTimeout(1100);expect(await page.evaluate(()=>window.audioEvents.taps)).toBe(completed);
  await page.locator('[data-action="sound"]').click();
  expect(await page.evaluate(()=>localStorage.getItem('px-muted'))).toBe('true');
  snapshot.agents[0].status='running';snapshot.agents[0].phase='coding';
  await page.evaluate(snapshot=>window.officeEvents.onmessage({data:JSON.stringify(snapshot)}),snapshot);
  await page.waitForTimeout(1100);expect(await page.evaluate(()=>window.audioEvents.taps)).toBe(completed);
});


test('development team shows the junior beside its lead with independent Luna settings',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#office-svg [data-agent]')).toHaveCount(9);
  await expect(page.locator('[data-row="dev"] .agent-info small')).toContainText('팀장');
  await expect(page.locator('[data-row="junior"]')).toHaveClass(/junior-agent/);
  await expect(page.locator('[data-row="junior"] .agent-info')).toContainText('개발노예 후배');
  await expect(page.locator('[data-row="junior"] .agent-model-name')).toHaveText('Luna');
  await page.locator('#office-svg [data-agent="junior"]').click();
  await expect(page.locator('#modal h2')).toHaveText('따까리');
  await expect(page.locator('#model-junior')).toHaveValue('luna');
  await expect(page.locator('#agent-prompt')).toHaveValue(/개발 팀장 개발노예의 후배/);
  await page.locator('#modal').getByRole('button',{name:'작업 배정',exact:true}).click();
  await expect(page.locator('#task-form [name="agentId"]')).toHaveValue('junior');
});


test('busy agents block assignment while idle coworkers and the secretary remain accessible',async({page,request})=>{
  const snapshot=await(await request.get('/api/state')).json();
  snapshot.offices.local.agents=snapshot.agents;
  const task={id:'ongoing-chief',agentId:'chief',activeAgentId:'dev',title:'서버 개발 작업',description:'서버 개발 작업',status:'running',progress:40,createdAt:Date.now(),steps:[{label:'코드 수정 중'}],lastActivity:'파일 수정 중'};
  snapshot.tasks.push(task);
  for(const id of ['chief','dev'])Object.assign(snapshot.agents.find(a=>a.id===id),{status:'running',phase:'coding',activeTaskId:task.id,progress:40});
  await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
  await page.addInitScript(()=>{window.EventSource=class {constructor(){window.testEvents=this;}close(){}};});
  await page.goto('/');
  await page.locator('#office-svg [data-agent="dev"]').click();
  await expect(page.locator('#modal [data-action="assign"]')).toBeDisabled();
  await page.locator('#modal [data-action="close-modal"]').click();
  await page.locator('#office-svg [data-agent="writer"]').click();
  await expect(page.locator('#modal [data-action="assign"]')).toBeEnabled();
  await page.locator('#modal [data-action="assign"]').click();
  await expect(page.locator('#task-form [name="agentId"]')).toHaveValue('writer');
  let payload;
  await page.route('**/api/tasks',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:201,json:{id:'independent-writer'}});});
  await page.locator('#task-description').fill('따로 글 작성해줘');
  await page.locator('#task-form').getByRole('button',{name:'시작하기'}).click();
  expect(payload.agentId).toBe('writer');expect(payload.requireIdle).toBe(true);
  await page.locator('#office-svg [data-agent="secretary"]').click();
  await expect(page.locator('#modal h2')).toHaveText('비둘기');
  await expect(page.locator('#secretary-live')).toContainText('서버 개발 작업');
  await expect(page.locator('#secretary-live')).toContainText('40%');
  let question;
  await page.route('**/api/secretary',async route=>{question=route.request().postDataJSON().question;await route.fulfill({json:{answer:'사장님, 비둘기입니다. 서버 개발 작업을 개발노예가 진행 중입니다.',checkedAt:Date.now()}});});
  await page.getByRole('button',{name:'무슨 일 하고 있어?',exact:true}).click();
  expect(question).toContain('호문클루스');
  await expect(page.locator('#secretary-answer')).toContainText('개발노예');
  task.progress=75;task.lastActivity='테스트 실행 중';
  await page.evaluate(snapshot=>window.testEvents.onmessage({data:JSON.stringify(snapshot)}),snapshot);
  await expect(page.locator('#secretary-live')).toContainText('75%');
  await expect(page.locator('#secretary-live')).toContainText('테스트 실행 중');
  await page.locator('#secretary-question').fill('진행 상황 어때?');
  await page.locator('#secretary-form').getByRole('button',{name:'물어보기',exact:true}).click();
  await expect.poll(()=>question).toBe('진행 상황 어때?');
});


test('nameplates stay in front with equal size and secretary model controls persist independently',async({page})=>{
  await page.goto('/');
  const names=['secretary','chief','writer','format'];
  const boxes=await Promise.all(names.map(id=>page.locator(`[data-nameplate="${id}"]`).boundingBox()));
  for(const box of boxes){expect(Math.abs(box.width-boxes[1].width)).toBeLessThan(.1);expect(Math.abs(box.height-boxes[1].height)).toBeLessThan(.1);}
  for(const id of ['writer','format']) {
    const label=page.locator(`[data-nameplate="${id}"]`);await label.scrollIntoViewIfNeeded();
    const onTop=await label.evaluate(el=>{const box=el.getBoundingClientRect();return document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest('[data-nameplate]')?.dataset.nameplate;});
    expect(onTop).toBe(id);
  }
  await page.locator('[data-nameplate="secretary"]').click();
  await expect(page.locator('#model-secretary')).toHaveValue('luna');
  await expect(page.locator('#secretary-reasoning')).toBeDisabled();
  await expect(page.locator('#secretary-reasoning')).toHaveValue('medium');
  await expect(page.locator('.secretary-model-settings')).toContainText('호문클루스가 배정하거나 제어할 수 없어요');
  await page.locator('#modal [data-action="close-modal"]').click();
  await page.reload();
  await page.locator('[data-nameplate="secretary"]').click();
  await expect(page.locator('#model-secretary')).toHaveValue('luna');
  await expect(page.locator('#secretary-reasoning')).toHaveValue('medium');
  await page.locator('#modal [data-action="close-modal"]').click();
  await page.screenshot({path:'test-results/office-nameplates.png',fullPage:true});
});


test('computer switching opens separate offices with independent agents, mailbox and settings',async({page,request})=>{
  const snapshot=await(await request.get('/api/state')).json();
  snapshot.tasks=[];snapshot.goals=[];snapshot.letters=[];snapshot.logs=[];
  const localTask={id:'local-office-task',title:'내 컴퓨터 개발 작업',description:'개발',machineId:null,agentId:'chief',activeAgentId:'dev',status:'running',progress:40,createdAt:Date.now(),steps:[{label:'로컬 코드 수정'}],lastActivity:'로컬 코드 수정 중'};
  const remoteTask={...localTask,id:'remote-office-task',title:'다른 컴퓨터 개발 작업',machineId:'office-peer',progress:70,lastActivity:'원격 테스트 중'};
  snapshot.tasks.push(localTask,remoteTask);
  const localAgents=snapshot.agents.map(agent=>({...agent,profile:agent.id==='writer'?'terra':agent.profile,status:['chief','dev'].includes(agent.id)?'running':'idle',activeTaskId:['chief','dev'].includes(agent.id)?localTask.id:null}));
  const remoteAgents=localAgents.map(agent=>({...agent,activeTaskId:['chief','dev'].includes(agent.id)?remoteTask.id:null,profile:agent.id==='writer'?'luna':agent.profile}));
  snapshot.agents=localAgents;snapshot.offices={local:{id:'local',name:snapshot.computer.name,agents:localAgents,paused:false},'office-peer':{id:'office-peer',name:'원격 개발 PC',agents:remoteAgents,paused:false}};
  snapshot.letters=[{id:'local-letter',taskId:localTask.id,senderId:'chief',subject:'로컬 사무실 편지',body:'로컬 결과',createdAt:Date.now(),readAt:null},{id:'remote-letter',taskId:remoteTask.id,machineId:'office-peer',senderId:'chief',subject:'원격 사무실 편지',body:'원격 결과',createdAt:Date.now(),readAt:null}];
  await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
  await page.route('**/api/computers',route=>route.fulfill({json:{available:true,computers:[{id:'office-peer',name:'원격 개발 PC',ip:'100.88.10.2',platform:'linux',online:false,terminalSupported:true,username:'remoteuser',homeDirectory:'/home/remoteuser'}]}}));
  await page.route('**/api/offices/office-peer/open',route=>route.fulfill({json:{ok:true}}));
  await page.addInitScript(()=>{localStorage.setItem('px-target-computer','local');window.EventSource=class {constructor(){window.officeTestEvents=this;}close(){}};});
  await page.goto('/');
  await expect(page.locator('[data-row="dev"]')).toContainText('내 컴퓨터 개발 작업');
  await page.locator('[data-action="open-mailbox"]').click();
  await expect(page.locator('#modal-inbox-list')).toContainText('로컬 사무실 편지');await expect(page.locator('#modal-inbox-list')).not.toContainText('원격 사무실 편지');
  await page.locator('#modal [data-action="close-modal"]').click();
  if(!await page.locator('.computer-picker').isVisible())await page.locator('[data-action="computer"]').click();
  await page.locator('.computer-picker [data-action="select-computer"][data-id="office-peer"]').click();
  await expect(page.locator('#office-label')).toHaveText('원격 개발 PC 사무실');
  await expect(page.locator('[data-row="dev"]')).toContainText('다른 컴퓨터 개발 작업');await expect(page.locator('[data-row="dev"]')).not.toContainText('내 컴퓨터 개발 작업');
  await page.locator('[data-action="open-mailbox"]').click();
  await expect(page.locator('#modal-inbox-list')).toContainText('원격 사무실 편지');await expect(page.locator('#modal-inbox-list')).not.toContainText('로컬 사무실 편지');
  await page.locator('#modal [data-action="close-modal"]').click();
  let patch;
  await page.route('**/api/agents/writer',async route=>{patch=route.request().postDataJSON();const agent=snapshot.offices[patch.officeId].agents.find(a=>a.id==='writer');Object.assign(agent,patch);await route.fulfill({json:{agent}});});
  await page.locator('#office-svg [data-agent="writer"]').click();
  await page.locator('#agent-prompt').fill('원격 담당자 설정 변경');
  await expect(page.locator('#agent-save-status')).toHaveText('자동 저장됨');expect(patch.officeId).toBe('office-peer');
  await page.locator('#modal [data-action="close-modal"]').click();
  if(!await page.locator('.computer-picker').isVisible())await page.locator('[data-action="computer"]').click();
  await page.locator('.computer-picker [data-action="select-computer"][data-id="local"]').click();
  await expect(page.locator('[data-row="dev"]')).toContainText('내 컴퓨터 개발 작업');
  expect(snapshot.offices.local.agents.find(a=>a.id==='writer').prompt).not.toBe('원격 담당자 설정 변경');
  if(!await page.locator('.computer-picker').isVisible())await page.locator('[data-action="computer"]').click();
  await page.locator('.computer-picker [data-action="select-computer"][data-id="office-peer"]').click();
  await expect(page.locator('[data-row="writer"] .agent-model-name')).toHaveText('Luna');
  expect(snapshot.offices['office-peer'].agents.find(a=>a.id==='writer').prompt).toBe('원격 담당자 설정 변경');
  let query;
  await page.route('**/api/secretary',async route=>{query=route.request().postDataJSON();await route.fulfill({json:{answer:'이 사무실의 원격 개발 작업은 진행 중입니다.'}});});
  await page.locator('#office-svg [data-agent="secretary"]').click();
  await expect(page.locator('#secretary-live')).toContainText('다른 컴퓨터 개발 작업');await expect(page.locator('#secretary-live')).not.toContainText('내 컴퓨터 개발 작업');
  await page.getByRole('button',{name:'진행 상황 어때?',exact:true}).click();await expect(page.locator('#secretary-answer')).toContainText('원격 개발');expect(query.officeId).toBe('office-peer');
});


test('computer toolbar shows names, switches offices, deletes with right click and reconnect restores its icon',async({page,request})=>{
  const snapshot=await(await request.get('/api/state')).json();
  snapshot.officeTabs=['local'];snapshot.deletedOffices={};snapshot.tasks=[];snapshot.letters=[];snapshot.goals=[];snapshot.logs=[];
  snapshot.offices.local.agents=snapshot.agents;
  const peer={id:'toolbar-peer',name:'개발용 컴퓨터',ip:'100.88.10.2',platform:'linux',online:true,terminalSupported:true,username:'developer',homeDirectory:'/home/developer'};
  const fresh=()=>({id:peer.id,name:peer.name,paused:false,agents:snapshot.agents.map(agent=>({...agent,status:'idle',activeTaskId:null}))});
  let connections=0,deletions=0;
  await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
  await page.route('**/api/computers',route=>route.fulfill({json:{available:true,computers:[peer]}}));
  await page.route('**/api/computers/toolbar-peer/connect',route=>{connections++;snapshot.offices[peer.id] ||= fresh();if(!snapshot.officeTabs.includes(peer.id))snapshot.officeTabs.push(peer.id);delete snapshot.deletedOffices[peer.id];return route.fulfill({json:{computer:peer}});});
  await page.route('**/api/offices/toolbar-peer',route=>{expect(route.request().method()).toBe('DELETE');deletions++;delete snapshot.offices[peer.id];snapshot.officeTabs=snapshot.officeTabs.filter(id=>id!==peer.id);snapshot.deletedOffices[peer.id]=Date.now();return route.fulfill({json:{ok:true}});});
  await page.addInitScript(()=>{if(!sessionStorage.getItem('toolbar-test-started')){localStorage.setItem('px-target-computer','local');sessionStorage.setItem('toolbar-test-started','true');}window.EventSource=class{close(){}};});
  await page.goto('/');
  const remoteIcon=page.locator('#office-tabs [data-id="toolbar-peer"]');
  await expect(remoteIcon).toHaveCount(0);
  if(!await page.locator('.computer-picker').isVisible())await page.locator('[data-action="computer"]').click();
  await page.locator('.computer-picker [data-action="select-computer"][data-id="toolbar-peer"]').click();
  await expect(remoteIcon).toBeVisible();await expect(remoteIcon).toHaveAttribute('title','개발용 컴퓨터');
  await remoteIcon.hover();
  await expect(page.locator('#office-view-heading')).toHaveText('[개발용 컴퓨터] 오피스 뷰');await expect(page.locator('.panel-title .subtle')).toHaveText('LIVE');
  const start=await page.locator('.office-actions [data-action="new-task"]').boundingBox(), tabs=await page.locator('#office-tabs').boundingBox(), mail=await page.locator('.office-actions [data-action="open-mailbox"]').boundingBox();
  expect(tabs.x).toBeGreaterThan(start.x+start.width);expect(tabs.x+tabs.width).toBeLessThan(mail.x+1);
  await page.locator('#office-tabs [data-id="local"]').click();
  await expect(page.locator('#office-label')).toContainText(snapshot.computer.name);
  await remoteIcon.click();expect(connections).toBe(1);await expect(page.locator('#office-view-heading')).toContainText('개발용 컴퓨터');
  await remoteIcon.click({button:'right'});await expect(page.getByRole('menuitem',{name:'사무실 삭제'})).toBeVisible();
  await page.getByRole('menuitem',{name:'사무실 삭제'}).click();
  await expect(remoteIcon).toHaveCount(0);expect(deletions).toBe(1);await expect(page.locator('#office-view-heading')).toContainText(snapshot.computer.name);
  await page.locator('[data-action="computer"]').click();
  await expect(page.locator('.computer-picker [data-action="select-computer"][data-id="toolbar-peer"]')).toBeVisible();
  if(!await page.locator('.computer-picker').isVisible())await page.locator('[data-action="computer"]').click();
  await page.locator('.computer-picker [data-action="select-computer"][data-id="toolbar-peer"]').click();
  await expect(remoteIcon).toBeVisible();expect(connections).toBe(2);
  await page.reload();await expect(remoteIcon).toBeVisible();await expect(page.locator('#office-view-heading')).toHaveText('[개발용 컴퓨터] 오피스 뷰');
  await page.setViewportSize({width:390,height:844});await expect(remoteIcon).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});


test('tail website selection accompanies task and Goal submissions and letters open the shared link',async({page,request})=>{
  let submitted;
  await page.route('**/api/tasks',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'tail-task'}});});
  await page.route('**/api/goals',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'tail-goal',taskId:'tail-task'}});});
  const snapshot=await(await request.get('/api/state')).json();
  snapshot.letters.push({id:'tail-letter',taskId:'tail-task',machineId:null,senderId:'chief',subject:'웹 공유 결과',body:'실제 연구 결과',status:'done',readAt:Date.now(),createdAt:Date.now(),tailWebUrl:'http://100.64.1.2:3212/tailweb/'+'a'.repeat(48)});
  await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
  await page.addInitScript(()=>{window.EventSource=class{close(){}};});
  await page.goto('/');
  await page.getByRole('button',{name:'일 시키기',exact:true}).click();
  const toggle=page.getByRole('button',{name:'tail웹',exact:true});
  await expect(toggle).toHaveAttribute('aria-pressed','false');await toggle.click();
  await page.locator('#task-description').fill('연구 결과 공유');await page.getByRole('button',{name:'시작하기',exact:true}).click();
  expect(submitted.tailWeb).toBe(true);
  await page.getByRole('button',{name:'일 시키기',exact:true}).click();
  await page.getByRole('button',{name:'tail웹',exact:true}).click();await page.getByRole('button',{name:'Goal',exact:true}).click();
  await page.locator('#task-description').fill('연구 목표 공유');await page.getByRole('button',{name:'시작하기',exact:true}).click();expect(submitted.tailWeb).toBe(true);
  await page.locator('.rail [data-view="office"]').click();
  await page.locator('[data-action="open-mailbox"]').first().click();
  await page.locator('[data-action="letter-details"][data-id="tail-letter"]').click();
  const link=page.getByRole('link',{name:/웹사이트 열기/});await expect(link).toHaveAttribute('href',snapshot.letters.at(-1).tailWebUrl);await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveText('웹사이트 열기');await expect(page.locator('#modal')).not.toContainText(snapshot.letters.at(-1).tailWebUrl);
});


test('secretary locks questions and shows loading until success or failure',async({page})=>{
  let finish;
  await page.route('**/api/secretary',async route=>{await new Promise(resolve=>{finish=resolve;});await route.fulfill({json:{answer:'현재 작업을 확인했어요.'}});});
  await page.goto('/');await page.locator('#office-svg [data-agent="secretary"]').click();
  await page.locator('#secretary-question').fill('진행 상황 어때?');
  await page.locator('#secretary-form button').click();
  await expect(page.locator('#secretary-question')).toBeDisabled();
  await expect(page.locator('#secretary-form button')).toBeDisabled();
  await expect(page.getByRole('button',{name:'무슨 일 하고 있어?',exact:true})).toBeDisabled();
  await expect(page.locator('#secretary-answer')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#secretary-answer')).toContainText('결과 로딩 중');
  await expect.poll(()=>typeof finish).toBe('function');finish();
  await expect(page.locator('#secretary-answer')).toHaveText('현재 작업을 확인했어요.');
  await expect(page.locator('#secretary-question')).toBeEnabled();
  await expect(page.locator('#secretary-form button')).toBeEnabled();
  await page.route('**/api/secretary',route=>route.fulfill({status:500,json:{error:'연결 오류'}}));
  await page.getByRole('button',{name:'무슨 일 하고 있어?',exact:true}).click();
  await expect(page.locator('#secretary-answer')).toContainText('답변을 불러오지 못했어요');
  await expect(page.locator('#secretary-question')).toBeEnabled();
  await expect(page.locator('#secretary-answer')).toHaveAttribute('aria-busy','false');
});

test('desktop first launch connects Codex and permits local work without Tailscale',async({page})=>{
  let connected=false,completed=false;
  await page.addInitScript(()=>{window.pxDesktop={openExternal:async url=>{window.openedLogin=url;},chooseFolder:async()=>'/tmp/work'};window.EventSource=class{close(){}};});
  await page.route('**/api/setup',route=>route.fulfill({json:{desktop:true,complete:completed,codex:{installed:true,ready:connected,message:connected?'ChatGPT 구독 로그인 연결됨':'ChatGPT 계정을 연결해주세요.'},tailscale:{installed:false,connected:false}}}));
  await page.route('**/api/codex/login',route=>{
    if(route.request().method()==='POST')return route.fulfill({json:{status:'pending',authUrl:'https://auth.openai.com/test-login'}});
    connected=true;return route.fulfill({json:{status:'complete'}});
  });
  await page.route('**/api/setup/complete',route=>{completed=true;return route.fulfill({json:{ok:true}});});
  await page.goto('/');await expect(page.locator('.setup-screen')).toBeVisible();
  await expect(page.getByRole('button',{name:'내 컴퓨터로 시작',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Codex 연결',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.openedLogin)).toBe('https://auth.openai.com/test-login');
  await expect(page.getByRole('button',{name:'내 컴퓨터로 시작',exact:true})).toBeEnabled();
  await expect(page.locator('.setup-screen')).toContainText('Tailscale을 설치');
  // The real state fixture lacks setupComplete; complete the first-launch contract.
  await page.route('**/api/state',async route=>{const response=await route.fetch();const snapshot=await response.json();snapshot.settings.setupComplete=true;await route.fulfill({json:snapshot});});
  await page.getByRole('button',{name:'내 컴퓨터로 시작',exact:true}).click();
  await expect(page.getByRole('button',{name:'일 시키기',exact:true})).toBeVisible();expect(completed).toBe(true);
  await page.getByRole('button',{name:'일 시키기',exact:true}).click();await page.getByRole('button',{name:'작업 폴더 선택',exact:true}).click();
  await expect(page.locator('#task-form [name="workingDirectory"]')).toHaveValue('/tmp/work');
});


test('every agent can be renamed from its settings and names survive reload',async({page,request})=>{
  const original=(await(await request.get('/api/state')).json()).agents;
  await page.goto('/');
  try {
    for(const agent of original) {
      await page.locator(`#office-svg [data-agent="${agent.id}"]`).click();
      await page.locator(agent.id==='secretary'?'#secretary-name':'#agent-name').fill(`새 이름 ${agent.id}`);
      await page.keyboard.press('Escape');
      await expect.poll(async()=>{const state=await(await request.get('/api/state')).json();return state.agents.find(a=>a.id===agent.id).name;}).toBe(`새 이름 ${agent.id}`);
      await expect(page.locator(`[data-nameplate="${agent.id}"] text`)).toHaveText(`새 이름 ${agent.id}`);
    }
    await page.reload();
    for(const agent of original)await expect(page.locator(`[data-nameplate="${agent.id}"] text`)).toHaveText(`새 이름 ${agent.id}`);
    await page.locator('#office-svg [data-agent="writer"]').click();
    await page.locator('#agent-name').fill('<b>연구원</b>');
    await expect(page.locator('#agent-save-status')).toHaveText('자동 저장됨');
    await expect(page.locator('.modal-agent-heading h2')).toHaveText('<b>연구원</b>');
    await expect(page.locator('.modal-agent-heading h2 b')).toHaveCount(0);
  } finally {for(const agent of original)await request.patch(`/api/agents/${agent.id}`,{data:{name:agent.name}});}
});


test('department Fast buttons toggle independently and persist', async ({page}) => {
  await page.goto('/');
  const buttons=page.locator('.department-speed');
  await expect(buttons).toHaveCount(4);
  const dev=page.getByRole('button',{name:'개발부서 Fast 모드',exact:true});
  await expect(dev).toHaveText('Normal');
  await dev.click();
  await expect(dev).toHaveText('Fast');
  await expect(dev).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'논문부서 Fast 모드',exact:true})).toHaveText('Normal');
  await page.reload();
  await expect(dev).toHaveText('Fast');
  await dev.click();
  await expect(dev).toHaveText('Normal');
  await page.reload();
  await expect(dev).toHaveText('Normal');
});


test('Fast changes each department scene and Normal restores it', async ({page}) => {
  await page.goto('/');
  for(const department of ['사장실','개발부서','논문부서','잡다부서']) {
    const button=page.getByRole('button',{name:department+' Fast 모드',exact:true});
    const scene=page.locator(`[data-department-scene="${department}"][data-scene-mode="fast"]`);
    for(const item of await scene.all()) await expect(item).toBeHidden();
    await button.click();
    await expect(button).toHaveText('Fast');
    for(const item of await scene.all()) await expect(item).toBeVisible();
  }
  for(const flame of await page.locator('[data-fast-flame]').all()) await expect(flame).toBeVisible();
  await expect(page.locator('[data-department-sign]')).toHaveAttribute('transform','rotate(5 780 366)');
  await page.screenshot({path:'test-results/office-fast-scenes.png',fullPage:true});
  for(const department of ['사장실','개발부서','논문부서','잡다부서']) {
    await page.getByRole('button',{name:department+' Fast 모드',exact:true}).click();
    for(const item of await page.locator(`[data-department-scene="${department}"][data-scene-mode="fast"]`).all()) await expect(item).toBeHidden();
  }
  for(const flame of await page.locator('[data-fast-flame]').all()) await expect(flame).toBeHidden();
  await expect(page.locator('[data-department-sign]')).toHaveAttribute('transform','rotate(0 780 366)');
});


test('pencil edits character and name, persists, and keeps pencil after autosave',async({page})=>{
  await page.goto('/');
  await page.locator('#office-svg [data-agent="dev"]').click();
  await page.getByRole('button',{name:'이름과 캐릭터 수정',exact:true}).click();
  await expect(page.locator('.character-choice')).toHaveCount(26);
  await page.screenshot({path:'test-results/character-picker-26.png',fullPage:true});
  await page.locator('#character-name').fill('냥개발');
  await page.locator('.character-choice').filter({has:page.locator('input[value="cat"]')}).click();
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(page.locator('[data-agent-heading-name]')).toHaveText('냥개발');
  await expect(page.locator('#office-svg [data-agent="dev"] .character-bob')).toHaveAttribute('data-appearance','cat');
  await page.locator('#agent-name').fill('냥개발2');
  await expect(page.locator('#agent-save-status')).toHaveText('자동 저장됨');
  await expect(page.getByRole('button',{name:'이름과 캐릭터 수정',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.reload();
  await expect(page.locator('[data-nameplate="dev"] text')).toHaveText('냥개발2');
  await expect(page.locator('#office-svg [data-agent="dev"] .character-bob')).toHaveAttribute('data-appearance','cat');
  await page.locator('#office-svg [data-agent="secretary"]').click();
  await page.getByRole('button',{name:'이름과 캐릭터 수정',exact:true}).click();
  await page.locator('.character-choice').filter({has:page.locator('input[value="robot"]')}).click();
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(page.locator('#office-svg [data-agent="secretary"] .character-bob')).toHaveAttribute('data-appearance','robot');
});


test('agent presets apply tiers, save custom settings and keep fixed workers locked',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'에이전트 모델 추론 프리셋',exact:true}).click();
  const modal=page.locator('#modal');
  for(const [name,chiefModel,chiefEffort] of [['상급','astra','high'],['중급','sol','xhigh'],['하급','terra','high']]) {
    await modal.locator('.preset-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'적용하기'}).click();
    await expect(page.locator('#model-chief')).toHaveValue(chiefModel);
    await expect(page.locator('#reasoning-chief')).toHaveValue(chiefEffort);
  }
  await page.locator('#agent-preset-name').fill('내 설정');
  await modal.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(modal.locator('.custom-preset-grid')).toContainText('내 설정');
  await modal.locator('.preset-card').filter({has:page.getByRole('heading',{name:'상급',exact:true})}).getByRole('button',{name:'적용하기'}).click();
  await modal.locator('.custom-preset-grid').getByRole('button',{name:'적용하기'}).click();
  await expect(page.locator('#model-chief')).toHaveValue('terra');
  await modal.getByRole('button',{name:'닫기',exact:true}).click();
  for(const id of ['junior','misc','secretary']) {
    await page.locator(`[data-select-agent="${id}"]`).click();
    await expect(page.locator(`#model-${id}`)).toHaveValue('luna');
    await expect(page.locator(`#model-${id}`)).toBeDisabled();
    await expect(page.locator(`#reasoning-${id}`)).toHaveValue('medium');
    await expect(page.locator(`#reasoning-${id}`)).toBeDisabled();
  }
  await page.reload();
  await page.getByRole('button',{name:'에이전트 모델 추론 프리셋',exact:true}).click();
  await expect(modal.locator('.custom-preset-grid')).toContainText('내 설정');
});


test('history trash previews all and date deletion and requires confirmation',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'일 시키기',exact:true}).click();await page.locator('#task-description').fill('삭제 확인 작업');
  const created=page.waitForResponse(response=>response.url().endsWith('/api/tasks')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'시작하기',exact:true}).click();
  const {id}=await(await created).json();
  await expect.poll(async()=>{const snapshot=await(await page.request.get('/api/state')).json();return snapshot.tasks.find(task=>task.id===id)?.status;},{timeout:15000}).toBe('done');
  await page.getByRole('button',{name:'작업 현황',exact:true}).click();await expect(page.locator('#task-board')).toContainText('삭제 확인 작업');
  await page.getByRole('button',{name:'작업 현황 삭제',exact:true}).click();
  await page.getByRole('button',{name:'전체 삭제',exact:true}).click();await expect(page.locator('#cleanup-preview')).toContainText(/작업 [1-9]\d*개/);
  await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(page.locator('#task-board')).toContainText('삭제 확인 작업');
  await page.locator('.rail [data-view="inbox"]').click();await page.getByRole('button',{name:'편지함 삭제',exact:true}).click();
  await page.locator('#cleanup-date').fill('2000-01-01');await page.getByRole('button',{name:'선택한 날짜 이전 삭제',exact:true}).click();
  await expect(page.getByRole('button',{name:'확인 후 삭제',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'전체 삭제',exact:true}).click();await expect(page.locator('#cleanup-preview')).toContainText(/편지 [1-9]\d*개/);
  await page.getByRole('button',{name:'확인 후 삭제',exact:true}).click();await expect(page.locator('#inbox-list .letter-card')).toHaveCount(0);
  await page.getByRole('button',{name:'작업 현황',exact:true}).click();await expect(page.locator('#task-board')).toContainText('삭제 확인 작업');
  await page.getByRole('button',{name:'작업 현황 삭제',exact:true}).click();await page.getByRole('button',{name:'전체 삭제',exact:true}).click();await page.getByRole('button',{name:'확인 후 삭제',exact:true}).click();await expect(page.locator('#task-board')).not.toContainText('삭제 확인 작업');
  await page.getByRole('button',{name:'활동 기록',exact:true}).click();await page.getByRole('button',{name:'활동 기록 삭제',exact:true}).click();await page.getByRole('button',{name:'전체 삭제',exact:true}).click();await page.getByRole('button',{name:'확인 후 삭제',exact:true}).click();await expect(page.locator('#activity-list .log-row')).toHaveCount(0);
});

test('분석이 and 카파시 open independent settings; experiment requests are assigned through developer',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#office-svg [data-agent="analyzer"]')).toBeVisible();
  await page.locator('#office-svg [data-agent="analyzer"]').click();
  await expect(page.locator('#modal')).toContainText('분석이');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.locator('#office-svg [data-agent="autoresearch"]').click();
  await page.getByRole('button',{name:'개발 팀장에게 실험 요청',exact:true}).click();
  await expect(page.locator('#task-form [name="agentId"]')).toHaveValue('dev');
  await page.locator('.execution-options summary').click();
  await expect(page.locator('[name="maxIterations"]')).toHaveValue('5');
  await expect(page.locator('[name="maxTokens"]')).toHaveValue('20000');
  await expect(page.locator('.execution-options')).toContainText('진행 중인 턴은 예산을 넘길 수');
});

test('task graph shows dependencies, actual validation and accepted or discarded experiment metrics',async({page,request})=>{
  const snapshot=await(await request.get('/api/state')).json();
  const validation={status:'PASS',checks:[{name:'node test.cjs',passed:true,output:'actual test output',exitCode:0}],changedFiles:['train.py']};
  const task={id:'graph-visual-test',title:'실험 그래프 확인',description:'실험과 문서 분석',agentId:'chief',status:'done',runMode:'codex',progress:100,createdAt:Date.now(),startedAt:Date.now()-1000,finishedAt:Date.now(),result:'검수 완료',validation,mergedFiles:['train.py'],graph:{summary:'독립 분석과 개발 실험',replans:1,tasks:[{id:'T1',agentId:'analyzer',instruction:'문서 근거 분석',dependsOn:[],skills:['pdf-analysis'],status:'done',validation},{id:'T2',agentId:'dev',instruction:'고정 metric 개선',dependsOn:['T1'],skills:['python','testing'],status:'done',developmentMethod:'autoresearch',validation,research:{experiments:[{experimentId:'exp-001',status:'accepted',hypothesis:'실제 후보 A',metricBefore:5,metricAfter:3,changes:['train.py']},{experimentId:'exp-002',status:'discarded',hypothesis:'실제 후보 B',metricBefore:3,metricAfter:8,changes:['train.py']}],result:{baselineMetric:5,bestMetric:3,stopReason:'반복 횟수 제한'}}}]} };
  snapshot.tasks.push(task);
  await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
  await page.route('**/api/events',route=>route.abort());
  await page.goto('/');await page.getByRole('button',{name:'작업 현황',exact:true}).click();
  await page.locator('#task-board .task-row-main[data-id="graph-visual-test"]').click();
  await expect(page.locator('.planning-graph')).toContainText('선행: T1');
  await expect(page.locator('.planning-graph')).toContainText('pdf-analysis');
  await expect(page.locator('.experiment-history')).toContainText('기준선 5 → best 3');
  await expect(page.locator('.experiment-history')).toContainText('exp-001 · accepted');
  await expect(page.locator('.experiment-history')).toContainText('exp-002 · discarded');
  await page.locator('.validation-record').first().locator('summary').click();
  await expect(page.locator('.validation-record').first()).toContainText('actual test output');
});
