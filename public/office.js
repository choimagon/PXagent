import { sprite } from './sprites.js';
const rect = (x,y,w,h,fill,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const group = (x,y,html) => `<g transform="translate(${x} ${y})">${html}</g>`;

function plant(x,y,type='green') {
  const leaf = type === 'purple' ? '#909376' : '#69896a';
  return group(x,y, `${rect(2,35,30,6,'#000','opacity=".12"')}${rect(10,22,15,17,'#846550')}${rect(8,22,19,5,'#b38c65')}${rect(13,24,3,12,'#c6a17a')}${rect(16,6,3,18,'#526247')}${rect(6,9,12,9,leaf)}${rect(19,4,10,10,leaf)}${rect(10,0,10,10,'#829a76')}${rect(19,14,12,6,'#5b775c')}${rect(8,11,4,3,'#9bb28b')}`);
}
function desk(x,y,variant='wood') {
  const dark = variant === 'dark';
  return group(x,y, `${rect(2,46,98,8,'#000','opacity=".12"')}${rect(4,13,92,37,dark?'#424b4b':'#9b7959')}${rect(0,8,100,28,dark?'#788282':'#c4a37a')}${rect(0,8,100,3,dark?'#919b99':'#ddbd92')}${rect(0,36,100,6,dark?'#566163':'#b18e66')}${rect(6,42,9,14,dark?'#424b4b':'#86684d')}${rect(85,42,9,14,dark?'#424b4b':'#86684d')}${rect(57,16,25,16,dark?'#68716f':'#b4926c')}${rect(61,20,17,2,dark?'#89928c':'#d2b185')}`);
}
function monitor(x,y,variant='green') {
  const c = {green:'#9ac5a1',blue:'#86bbc5',purple:'#bea7d3',amber:'#d1bb83'}[variant];
  return group(x,y, `${rect(15,27,6,10,'#51585a')}${rect(7,34,22,4,'#636b6b')}${rect(0,0,37,28,'#3a4549')}${rect(3,3,31,20,'#283a3c')}${rect(5,5,27,2,'#486362')}${rect(6,10,13,2,c)}${rect(6,14,20,2,c)}${rect(6,18,9,2,c)}${rect(21,10,6,2,'#657b73')}${rect(29,25,3,1,c)}`);
}
function keyboard(x,y) { return group(x,y,`${rect(0,0,37,9,'#67716c')}${rect(2,2,33,5,'#a9b0a1')}${Array.from({length:8},(_,i)=>rect(4+i*4,2,1,5,'#748075')).join('')}${rect(3,4,30,1,'#748075')}`); }
function chair(x,y,c='#5d6664') { return group(x,y,`${rect(7,0,38,27,'#313a38')}${rect(10,2,32,23,c)}${rect(15,5,22,3,'#fff','opacity=".1"')}${rect(5,27,42,10,c)}${rect(1,19,6,17,'#374340')}${rect(45,19,6,17,'#374340')}${rect(24,37,5,9,'#374340')}${rect(11,45,31,3,'#374340')}`); }
function shelf(x,y,books=true) {
  let contents = '';
  const colors = ['#a2af80','#bf9b7b','#819fa0','#b2939e','#ddc499','#97a28b'];
  for (let row=0;row<2;row++) for (let i=0;i<9;i++) contents+=rect(7+i*8,8+row*32+(i%3)*2,6,22-(i%3)*2,books?colors[(i+row)%6]:'#86948a', (i===1||i===4||i===7) ? 'class="shelf-loose-book"' : '');
  return group(x,y, `${rect(1,4,88,76,'#584f40')}${rect(5,5,80,67,'#675a48')}${contents}${rect(0,0,90,5,'#b0966b')}${rect(0,35,90,5,'#b0966b')}${rect(0,70,90,7,'#a08863')}${rect(0,0,5,77,'#9a815b')}${rect(85,0,5,77,'#9a815b')}`);
}
function server(x,y) {
  return group(x,y, `${rect(2,81,46,8,'#1c292a','opacity=".25"')}${rect(0,0,48,84,'#394d52')}${rect(3,3,42,77,'#536a6e')}${Array.from({length:5},(_,i)=>`${rect(6,7+i*14,36,11,'#283d43')}${rect(10,10+i*14,20,2,'#607779')}${rect(10,14+i*14,20,1,'#50696a')}${rect(35,10+i*14,3,3,i===2?'#d4bd78':'#91bc9d')}`).join('')}${rect(4,0,40,3,'#829391')}`);
}
function papers(x,y) { return group(x,y,`${rect(1,2,24,17,'#9d9782')}${rect(0,0,23,15,'#e5dcc2')}${rect(4,4,15,1,'#a29d8b')}${rect(4,7,12,1,'#a29d8b')}${rect(4,10,16,1,'#a29d8b')}`); }
function mug(x,y,c='#e3d7b7') { return group(x,y,`${rect(0,2,9,10,c)}${rect(9,4,4,6,c)}${rect(10,5,2,3,'#9b7959')}${rect(1,0,7,2,'#765947')}`); }
function windowArt(x,y) {
  return group(x,y,`${rect(0,0,88,56,'#9aa7a0')}${rect(4,4,80,45,'#b6ced0')}${rect(5,29,78,20,'#a6b6a4')}${rect(8,23,18,26,'#8da095')}${rect(31,33,20,16,'#98ab9e')}${rect(56,18,20,31,'#93aaa1')}${rect(42,3,4,49,'#dadbca')}${rect(3,25,82,4,'#dadbca')}${rect(-3,51,94,7,'#c8c9b7')}`);
}
function fastScene(department, html, mode='fast') {
  return `<g data-department-scene="${department}" data-scene-mode="${mode}"${mode==='fast'?' style="display:none"':''}>${html}</g>`;
}
function book(x,y,color,angle=0) {
  return group(x,y,`<g transform="rotate(${angle} 16 6)">${rect(1,3,33,11,'#273127','opacity=".25"')}${rect(0,0,32,11,color)}${rect(3,3,27,5,'#e7dec3')}${rect(0,0,4,11,color)}${rect(5,2,24,1,'#fff','opacity=".3"')}</g>`);
}
function bookStack(x,y) {
  return book(x,y,'#829ea2')+book(x+3,y-10,'#b5987e')+book(x-2,y-20,'#9aa876')+book(x+4,y-30,'#aa899b');
}
function parcel(x,y,w=38,h=28) {
  return group(x,y,`${rect(2,h-1,w,5,'#253025','opacity=".25"')}${rect(0,0,w,h,'#a7875e')}${rect(2,2,w-4,h-4,'#b99a70')}${rect(0,0,w,4,'#d1b486')}${rect(w/2-3,0,6,h,'#d5c399')}${rect(5,9,9,7,'#e4d7b7')}${rect(7,11,5,1,'#96866b')}`);
}
function developmentCooling() {
  return `<path d="M705 91V72H851V122M762 72v50M705 91v31" fill="none" stroke="#24474e" stroke-width="10"/><path d="M705 91V72H851V122M762 72v50M705 91v31" fill="none" stroke="#91e4df" stroke-width="5"/>
    ${[698,755,812].map((x,i)=>group(x,122,`<g transform="scale(.75)">${chiller(0,0)}</g><g class="cooling-air" transform="translate(8 -22)"><path d="M0 15v-7h4V0m11 15V5h4v-8m11 18V8h4V0" fill="none" stroke="#d1ffff" stroke-width="3"/></g>${rect(3,42,42,14,'#243f49')}<text x="24" y="52" text-anchor="middle" fill="#a5f3ef" font-size="9" font-family="monospace">COOL 0${i+1}</text>`)).join('')}
    ${group(788,194,`${rect(0,0,62,46,'#bfd6d0')}${rect(4,4,54,34,'#4b717b')}<circle cx="20" cy="21" r="13" fill="#2e505a"/><g class="cooling-fan"><path d="M20 10v22M9 21h22m-19-8 16 16m0-16-16 16" stroke="#b0eeed" stroke-width="4"/></g>${rect(39,10,13,8,'#93e2dc')}${rect(39,24,13,3,'#a1bfc3')}${rect(6,42,9,7,'#36565a')}${rect(47,42,9,7,'#36565a')}`)}
    <path d="M826 175v12h-9v7" fill="none" stroke="#91e4df" stroke-width="5"/>`;
}
function chiller(x,y) {
  return group(x,y,`<path d="M12 7v-21h-8m43 21v-21h-8" fill="none" stroke="#455e63" stroke-width="5"/>${rect(2,45,63,7,'#263e3d','opacity=".3"')}${rect(0,0,64,48,'#c1cec8')}${rect(3,4,58,39,'#849e9e')}${rect(7,8,28,28,'#3e595e')}<circle cx="21" cy="22" r="11" fill="#607f83"/><path d="M21 12v20m-10-10h20m-17-7 14 14m0-14-14 14" stroke="#afc7c8" stroke-width="3"/>${rect(40,9,16,9,'#294a50')}${rect(43,12,10,3,'#a9e1df')}${[23,28,33].map(y=>rect(40,y,16,2,'#455f64')).join('')}${rect(5,44,8,7,'#445d60')}${rect(51,44,8,7,'#445d60')}`);
}
function lamp(x,y) { return group(x,y,`${rect(9,9,3,35,'#756952')}${rect(2,43,18,3,'#82745d')}${rect(5,2,12,3,'#d5c291')}${rect(2,5,18,13,'#ead8aa')}${rect(0,15,22,4,'#cbb587')}`); }
function room(x,y,w,h,floor,wall,pattern) {
  return `${rect(x+5,y+6,w,h,'#111','opacity=".18"')}${rect(x,y,w,h,wall)}${rect(x+7,y+25,w-14,h-32,floor)}${rect(x+7,y+25,w-14,h-32,`url(#${pattern})`)}${rect(x,y,w,4,'#ede8d0','opacity=".18"')}${rect(x+7,y+20,w-14,6,'#000','opacity=".1"')}${rect(x,y,7,h,'#7a806d','opacity=".25"')}${rect(x+w-7,y,7,h,'#333b34','opacity=".3"')}${rect(x,y+h-7,w,7,wall)}`;
}
const names = {chief:'호문클루스',secretary:'비둘기',dev:'개발노예',junior:'따까리',writer:'글싸게',format:'양식이',misc:'말똥이'};
function worker(id,x,y) {
  return `<g class="office-agent" data-agent="${id}" tabindex="0" role="button" aria-label="${names[id]} 상태 및 모델 설정" transform="translate(${x} ${y})">
    <rect class="agent-halo" x="-13" y="-8" width="77" height="142" rx="5" fill="transparent"/>
    ${chair(1,11,id==='chief'?'#78748a':id==='dev'?'#536f78':id==='misc'?'#5a5950':'#88907a')}
    <g class="agent-fast-flame" data-fast-flame="${id}" style="display:none" transform="translate(15 -39)">
      <g class="pixel-flame">${rect(10,0,4,8,'#ff7338')}${rect(6,6,12,6,'#ff7338')}${rect(2,12,20,8,'#f3532b')}${rect(0,17,24,9,'#f3532b')}${rect(4,25,16,4,'#f3532b')}${rect(8,10,8,7,'#ffb33e')}${rect(4,18,16,7,'#ffb33e')}${rect(8,24,8,3,'#ffb33e')}${rect(10,18,4,8,'#fff0a3')}${rect(18,6,3,4,'#ffb33e')}</g>
    </g>
    <g class="character-bob">${sprite(id,4,-8,2)}</g>
    <g class="typing-hands">${rect(4,34,9,7,'#e5bd94')}${rect(37,34,9,7,'#e5bd94')}</g>

    <g class="work-bubble" transform="translate(40 -20)"><rect width="27" height="17" rx="3" fill="#cde4b6"/><path d="M4 17v4l5-4" fill="#cde4b6"/><text x="5" y="12" fill="#426344" font-size="18">···</text></g>
  </g>`;
}
const positions = {chief:[171,112],secretary:[330,128],dev:[548,115],junior:[684,115],writer:[160,395],format:[278,395],misc:[735,393]};
function nameplate(id) {
  const [x,y]=positions[id], scale=id==='secretary' ? .975 : 1;
  return `<g class="agent-nameplate" data-nameplate="${id}" data-label-agent="${id}" tabindex="0" role="button" aria-label="${names[id]} 상태 및 모델 설정" transform="translate(${x+26*scale-55} ${y+108*scale})"><rect width="110" height="29" rx="3" fill="#2c342e"/><circle class="agent-indicator" cx="10" cy="14" r="6" fill="#92948e"/><text x="20" y="20" fill="#eeecd9" font-size="15" font-family="Galmuri, monospace">${names[id]}</text></g>`;
}
function plate(x,y,name,sub,c='#ede4ce') { return group(x,y,`<text fill="${c}" font-family="Galmuri, monospace" font-size="18">${name}</text><text y="15" fill="${c}" opacity=".6" font-size="12" font-family="monospace" letter-spacing="1.5">${sub}</text>`); }

function speedButton(x, y, department) {
  return `<foreignObject x="${x}" y="${y}" width="84" height="30"><button xmlns="http://www.w3.org/1999/xhtml" class="department-speed" data-action="department-speed" data-id="${department}" aria-pressed="false" aria-label="${department} Fast 모드" title="다음 Codex 호출부터 적용 · Fast는 사용량이 더 많이 차감돼요">Normal</button></foreignObject>`;
}

export function officeMarkup() {
  return `<svg id="office-svg" viewBox="0 0 900 615" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="사장실, 개발부서, 논문부서, 잡다부서가 있는 픽셀 사무실">
  <defs>
    <pattern id="wood" width="76" height="27" patternUnits="userSpaceOnUse"><path d="M0 26h76M38 0v26" stroke="#a29a7b" stroke-width="1" opacity=".45"/><path d="M5 6h19m27 9h17M9 20h21" stroke="#d3c6a1" opacity=".25"/></pattern>
    <pattern id="tiles" width="31" height="31" patternUnits="userSpaceOnUse"><path d="M0 30h31M30 0v31" stroke="#6e8682" stroke-width="1" opacity=".4"/><rect x="2" y="2" width="27" height="27" fill="#a4b0a3" opacity=".07"/></pattern>
    <pattern id="stone" width="42" height="30" patternUnits="userSpaceOnUse"><path d="M0 29h42M21 0v29" stroke="#59655e" stroke-width="1"/><path d="m7 8 4 1 2-3m19 16 4-1" stroke="#636e60" stroke-width="1"/></pattern>
    <pattern id="gravel" width="19" height="19" patternUnits="userSpaceOnUse"><rect x="3" y="7" width="2" height="2" fill="#6e786a"/><rect x="12" y="14" width="1" height="2" fill="#56604f"/></pattern>
  </defs>
  ${rect(8,8,884,599,'#3c443a')}${rect(8,8,884,599,'url(#gravel)')}${rect(23,21,854,567,'#7a826b')}
  ${room(28,27,384,246,'#baaf8d','#949780','wood')}
  ${room(439,27,433,246,'#8b9f93','#6d8480','tiles')}
  ${room(28,302,472,277,'#b4ab88','#95997f','wood')}
  ${room(527,302,345,277,'#596357','#717b69','stone')}
  ${rect(29,279,842,17,'#89907a')}${rect(414,27,19,246,'#89907a')}${rect(503,302,19,277,'#89907a')}
  <path d="M45 286h810" stroke="#a8ad91" stroke-width="1" stroke-dasharray="7 6"/>
  ${plate(48,52,'사장실','THE BOSS ROOM')}${plate(459,52,'개발부서','DEVELOPMENT LAB')}${plate(48,329,'논문부서','PAPER STUDIO')}${plate(547,329,'잡다부서','THE DARK SIDE','#d1d2b7')}
  ${fastScene('사장실',windowArt(302,59),'normal')}${fastScene('사장실',group(302,59,`${rect(0,0,88,56,'#9aa7a0')}${rect(4,4,80,45,'#202d50')}${rect(8,26,18,23,'#344060')}${rect(31,34,20,15,'#384563')}${rect(56,21,20,28,'#2b3957')}${rect(65,9,9,9,'#e8dfaf')}${rect(69,7,7,8,'#202d50')}${rect(15,11,2,2,'#d8e1d9')}${rect(32,18,2,2,'#d8e1d9')}${rect(51,9,2,2,'#d8e1d9')}${rect(42,3,4,49,'#dadbca')}${rect(3,25,82,4,'#dadbca')}${rect(-3,51,94,7,'#c8c9b7')}`))}<g data-department-shelf="사장실">${shelf(49,82,true)}</g>${fastScene('사장실',book(74,176,'#b2939e',-18)+book(103,183,'#819fa0',12)+book(120,244,'#a2af80',-9))}${plant(43,216)}
  <g data-secretary-furniture transform="translate(330 128) scale(.975)">${worker('secretary',0,0)}${desk(-24,50)}${monitor(-4,30,'blue')}${keyboard(-4,70)}</g>
  ${rect(130,133,139,99,'#a29a78')}${rect(134,137,131,91,'#c6bea0')}${rect(137,140,125,85,'#b5ad90')}
  ${worker('chief',171,112)}${desk(147,158)}${monitor(177,139,'purple')}${keyboard(178,178)}${papers(153,170)}${mug(229,171)}
  ${rect(58,205,63,24,'#827966')}${rect(55,201,69,12,'#b8a584')}${rect(66,213,6,16,'#7c735f')}${rect(111,213,6,16,'#7c735f')}${mug(73,195)}${papers(91,197)}
  ${server(698,76)}${server(755,76)}${server(812,76)}${fastScene('개발부서',developmentCooling())}${plant(459,206)}
  ${rect(508,133,140,101,'#718a81')}${rect(512,136,132,95,'#7f958a')}${worker('dev',548,115)}${desk(524,165,'dark')}${monitor(530,144,'blue')}${monitor(570,144,'green')}${keyboard(546,185)}${mug(612,177)}
  ${worker('junior',684,115)}${desk(660,165,'dark')}${monitor(690,144,'green')}${keyboard(690,185)}${mug(746,177)}
  <g data-department-shelf="논문부서">${shelf(50,350)}${shelf(380,350)}</g>${fastScene('논문부서',bookStack(65,467)+bookStack(103,489)+book(76,507,'#b5987e',14)+bookStack(390,465)+bookStack(433,487)+book(391,507,'#829ea2',-12))}${plant(49,505)}${plant(444,509)}
  ${rect(141,407,210,115,'#afa27e')}${rect(145,411,202,107,'#c5bb99')}
  ${worker('writer',160,395)}${worker('format',278,395)}${desk(136,447)}${desk(254,447)}${monitor(166,429,'amber')}${monitor(284,429,'green')}${keyboard(167,467)}${keyboard(285,467)}${papers(141,456)}${papers(312,456)}${mug(222,455)}${mug(263,455)}${lamp(345,435)}
  ${rect(153,539,170,11,'#9c916e')}${rect(157,539,162,3,'#c9bd96')}${Array.from({length:7},(_,i)=>rect(164+i*20,527,16,12,['#9b9e79','#b69777','#839d97'][i%3])).join('')}
  ${rect(558,357,87,91,'#414d44')}${rect(561,360,81,86,'#3b473e')}${Array.from({length:6},(_,i)=>rect(564+i*14,357,5,91,'#8a9580')).join('')}${rect(558,382,87,4,'#929b84')}${rect(558,421,87,4,'#929b84')}
  <g data-department-sign="잡다부서">${rect(723,352,114,28,'#78816a')}${rect(727,356,106,20,'#444f43')}${rect(733,361,94,2,'#b4b18a')}${rect(733,366,67,2,'#8e9478')}</g>
  ${rect(688,407,134,109,'#505a4b')}${rect(692,411,126,101,'#66715a')}${worker('misc',735,393)}${desk(710,446)}${monitor(741,426,'amber')}${keyboard(742,466)}${mug(795,455,'#bbbd9a')}
  ${rect(555,500,42,46,'#535c4c')}${rect(552,496,48,8,'#858d72')}${rect(559,509,34,3,'#69715b')}${rect(559,519,34,3,'#69715b')}${rect(559,529,34,3,'#69715b')}
  ${group(642,515,`${rect(0,0,37,24,'#94805c')}${rect(2,2,33,20,'#b0986d')}${rect(15,0,6,24,'#c4b48d')}${rect(9,-15,34,16,'#8b7856')}${rect(11,-13,30,12,'#b0986d')}${rect(22,-15,5,16,'#c4b48d')}`)}
  ${fastScene('잡다부서',parcel(618,546,42,25)+parcel(662,547,42,25)+parcel(626,517,36,29)+parcel(664,519,36,28)+parcel(645,491,36,27)+parcel(699,536,32,36)+parcel(604,486,33,28))}
  ${group(810,524,`${rect(0,13,20,18,'#434e42')}${rect(2,9,16,9,'#7b8266')}${rect(6,0,5,17,'#9d996e')}${rect(11,7,6,4,'#c3b985')}`)}
  ${rect(389,257,21,15,'#b8af88')}${rect(440,257,21,15,'#b8af88')}${rect(477,302,21,14,'#b8af88')}${rect(530,302,21,14,'#8d9679')}
  <text x="449" y="604" text-anchor="middle" fill="#a3ac94" font-family="monospace" font-size="12" letter-spacing="3">A LITTLE OFFICE. BIG IDEAS.</text>
  ${speedButton(321,32,'사장실')}${speedButton(776,32,'개발부서')}${speedButton(404,308,'논문부서')}${speedButton(776,308,'잡다부서')}
  <g id="office-nameplates">${Object.keys(positions).map(nameplate).join('')}</g>
  </svg>`;
}
