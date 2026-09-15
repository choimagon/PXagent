const https=require('node:https');
const fs=require('node:fs');
const fsp=fs.promises;
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const exec=promisify(execFile);
const REPO='choimagon/PXagent';
const hosts=new Set(['api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com']);
function version(value){const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));if(!match)throw Error('정식 릴리스 버전을 확인하지 못했습니다.');return match.slice(1).map(Number);}
function newer(a,b){const av=version(a),bv=version(b);for(let i=0;i<3;i++){if(av[i]!==bv[i])return av[i]>bv[i];}return false;}
function trustedURL(value){const url=new URL(value);if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.username||url.password||url.port)throw Error('공식 GitHub 다운로드 주소가 아닙니다.');return url;}
function request(url,signal,redirects=0){
  trustedURL(url);if(redirects>5)throw Error('다운로드 리디렉션이 너무 많습니다.');
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{'User-Agent':'PXagents-Updater','Accept':'application/vnd.github+json'},signal},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){res.resume();try{resolve(request(new URL(res.headers.location,url).href,signal,redirects+1));}catch(error){reject(error);}return;}
      if(res.statusCode!==200){res.resume();reject(Error(res.statusCode===403?'GitHub 조회 제한에 도달했습니다. 잠시 후 다시 확인해주세요.':`GitHub 다운로드에 실패했습니다 (${res.statusCode}).`));return;}resolve(res);
    });req.setTimeout(60000,()=>req.destroy(Error('다운로드 응답 시간이 초과됐습니다.')));req.on('error',reject);
  });
}
async function text(url,signal,max=512*1024){const response=await request(url,signal);let size=0;const chunks=[];for await(const chunk of response){size+=chunk.length;if(size>max){response.destroy();throw Error('릴리스 정보가 너무 큽니다.');}chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');}
async function download(url,file,{signal,size,onProgress}){
  const response=await request(url,signal),output=fs.createWriteStream(file,{flags:'wx',mode:0o600}),hash=createHash('sha256');let received=0;
  const meter=new Transform({transform(chunk,_encoding,done){received+=chunk.length;if(received>1024*1024*1024||received>size)return done(Error('설치파일 크기가 올바르지 않습니다.'));hash.update(chunk);onProgress(received,size);done(null,chunk);}});
  try{await pipeline(response,meter,output,{signal});if(received!==size)throw Error('설치파일 다운로드가 불완전합니다.');return hash.digest('hex');}
  catch(error){response.destroy();output.destroy();await fsp.rm(file,{force:true});throw error;}
}
function assetName(platform,arch,mode,tag){if(!['x64','arm64'].includes(arch))throw Error('지원하지 않는 CPU입니다.');if(platform==='win32')return `PXagents-windows-${arch}.exe`;if(platform==='darwin')return `PXagents-mac-${arch}.zip`;if(platform==='linux'){if(mode==='appimage')return `PXagents-${tag.slice(1)}-linux-${arch}.AppImage`;if(mode==='deb')return `PXagents-${tag.slice(1)}-linux-${arch}.deb`;return `PXagents-linux-${arch}.tar.gz`;}throw Error('지원하지 않는 운영체제입니다.');}
function releaseAsset(release,name){const asset=release.assets?.find(a=>a.name===name&&a.state==='uploaded');const expected=`https://github.com/${REPO}/releases/download/${release.tag_name}/${name}`;if(!asset||asset.browser_download_url!==expected||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>1024*1024*1024)throw Error(`${name} 설치파일이 아직 준비되지 않았습니다.`);return asset;}
function checksum(manifest,name){const entries=manifest.split(/\r?\n/).map(line=>/^([a-f0-9]{64})\s+\*?(.+)$/.exec(line)).filter(Boolean).filter(m=>m[2]===name);if(entries.length!==1)throw Error('설치파일 체크섬을 확인하지 못했습니다.');return entries[0][1];}
function validateEntries(list,mode){const root=mode==='mac'?'PXagents.app':'pxagents';for(const line of list.trim().split(/\r?\n/)){const name=line.replace(/\/$/,'');if(name.split('/').includes('..')||name.startsWith('/')||(!name.startsWith(root+'/')&&name!==root&&!(mode==='mac'&&name.startsWith('__MACOSX/'))))throw Error('설치 압축파일 경로가 올바르지 않습니다.');}}
function createUpdater({currentVersion,platform=process.platform,arch=process.arch,mode,target,dataDir,packaged=true,onStatus=()=>{},readText=text,downloadFile=download,run=exec}){
  let state={status:packaged?'idle':'unsupported',currentVersion,message:packaged?'새 버전을 확인해보세요.':'업데이트는 설치된 데스크톱 앱에서 사용할 수 있어요.',progress:0},release,asset,staged,work,controller,busy=false,lastProgress=0;
  const publish=patch=>{state={...state,...patch};onStatus({...state});return {...state};};
  async function check(){if(busy)return {...state};busy=true;publish({status:'checking',message:'GitHub에서 새 버전을 확인하고 있어요.',progress:0,error:null});try{if(!packaged)throw Error('설치된 앱에서 업데이트해주세요.');release=JSON.parse(await readText(`https://api.github.com/repos/${REPO}/releases/latest`,AbortSignal.timeout(30000)));version(release.tag_name);if(release.draft||release.prerelease)throw Error('정식 릴리스가 아닙니다.');if(!newer(release.tag_name,currentVersion))return publish({status:'current',latestVersion:release.tag_name.slice(1),message:'최신 버전을 사용 중이에요.'});asset=releaseAsset(release,assetName(platform,arch,mode,release.tag_name));releaseAsset(release,'SHA256SUMS');return publish({status:'available',latestVersion:release.tag_name.slice(1),message:'새 버전으로 업데이트할 수 있어요.',notes:String(release.body||'').slice(0,16000)});}catch(error){return publish({status:'error',message:error.message});}finally{busy=false;}}
  async function fetchUpdate(){if(busy)return {...state};if(!asset||!['available','error'].includes(state.status))throw Error('먼저 새 버전을 확인해주세요.');busy=true;controller=new AbortController();const timer=setTimeout(()=>controller.abort(Error('업데이트 다운로드 시간이 초과됐습니다.')),10*60*1000);publish({status:'downloading',message:'설치파일을 다운로드하고 있어요.',progress:0});try{
    const cache=path.join(dataDir,'updates');await fsp.mkdir(cache,{recursive:true,mode:0o700});work=await fsp.mkdtemp(path.join(cache,'pending-'));await fsp.chmod(work,0o700);
    const manifest=await readText(releaseAsset(release,'SHA256SUMS').browser_download_url,controller.signal),expected=checksum(manifest,asset.name),file=path.join(work,asset.name);
    const digest=await downloadFile(asset.browser_download_url,file,{signal:controller.signal,size:asset.size,onProgress:(received,total)=>{if(Date.now()-lastProgress>150){lastProgress=Date.now();publish({progress:Math.floor(received/total*100)});}}});if(digest!==expected)throw Error('설치파일 체크섬이 다릅니다. 업데이트를 중단했습니다.');
    if(mode==='mac'||mode==='tar'){
      publish({status:'verifying',progress:100,message:'체크섬과 설치파일을 확인하고 있어요.'});const listed=await run(mode==='mac'?'/usr/bin/unzip':'tar',mode==='mac'?['-Z1',file]:['-tzf',file],{timeout:60000,maxBuffer:16*1024*1024,signal:controller.signal});validateEntries(listed.stdout,mode);const unpack=path.join(work,'unpack');await fsp.mkdir(unpack);
      await run(mode==='mac'?'/usr/bin/ditto':'tar',mode==='mac'?['-x','-k',file,unpack]:['-xzf',file,'-C',unpack],{timeout:180000,maxBuffer:1024*1024,signal:controller.signal});staged=path.join(unpack,mode==='mac'?'PXagents.app':'pxagents');const executable=mode==='mac'?path.join(staged,'Contents','MacOS','PXagents'):path.join(staged,'px-agents-office');await fsp.access(executable,fs.constants.X_OK);
      const packageFile=mode==='mac'?path.join(staged,'Contents','Resources','app','package.json'):path.join(staged,'resources','app','package.json');if(JSON.parse(await fsp.readFile(packageFile,'utf8')).version!==release.tag_name.slice(1))throw Error('설치파일 내부 버전이 릴리스와 다릅니다.');
    }else staged=file;
    await fsp.writeFile(path.join(cache,'pending.json'),JSON.stringify({work,version:state.latestVersion}),{mode:0o600});return publish({status:'ready',progress:100,message:'다운로드가 완료됐어요. 업데이트 후 앱을 다시 시작하세요.'});
  }catch(error){if(work)await fsp.rm(work,{recursive:true,force:true});staged=null;return publish({status:controller.signal.aborted?'available':'error',progress:0,message:controller.signal.aborted?'다운로드를 취소했어요.':error.message});}finally{clearTimeout(timer);busy=false;controller=null;}}
  async function launchInstall(){if(mode==='deb'&&!fs.existsSync('/usr/bin/pkexec'))throw Error('관리자 설치를 위한 PolicyKit이 없습니다. 설치파일 열기를 사용해주세요.');if(mode==='mac'||mode==='tar'||mode==='appimage'){try{await fsp.access(path.dirname(target),fs.constants.W_OK);}catch{throw Error('앱 폴더를 교체할 권한이 없습니다. 설치파일 열기로 기존 앱 위에 설치해주세요.');}}
    const helper=path.join(work,platform==='win32'?'apply.ps1':'apply.sh');await fsp.copyFile(path.join(__dirname,platform==='win32'?'update-helper.ps1':'update-helper.sh'),helper);
    if(platform==='win32')await fsp.writeFile(helper,'\uFEFF'+await fsp.readFile(helper,'utf8'));
    const command=platform==='win32'?path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'):'/bin/sh';
    const args=platform==='win32'?['-NoProfile','-ExecutionPolicy','Bypass','-File',helper,'-ParentId',String(process.pid),'-Installer',staged,'-Target',target,'-Work',work,'-Version',state.latestVersion]:[helper,work,String(process.pid),mode,target,staged];
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    // Each install attempt must wait for its own helper, including retries.
    for(const marker of ['helper-ready','install-error','install-finished'])await fsp.rm(path.join(work,marker),{force:true});
    const child=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:true,env});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
    for(let i=0;i<100;i++){if(fs.existsSync(path.join(work,'helper-ready')))return publish({status:'installing',message:'앱을 종료하고 업데이트하고 있어요.'});await new Promise(resolve=>setTimeout(resolve,100));}
    try{if(platform==='win32')execFile('taskkill',['/PID',String(child.pid),'/T','/F'],()=>{});else process.kill(-child.pid,'SIGKILL');}catch{}
    throw Error('업데이트 설치 도우미를 시작하지 못했습니다.');
  }
  async function install(){if(busy||state.status!=='ready'||!staged)throw Error('설치파일 다운로드를 먼저 완료해주세요.');busy=true;publish({status:'installing',message:'업데이트 설치를 준비하고 있어요.'});try{return await launchInstall();}catch(error){publish({status:'ready',message:error.message});throw error;}finally{busy=false;}}
  async function restore(){try{const cache=path.join(dataDir,'updates'),pending=JSON.parse(await fsp.readFile(path.join(cache,'pending.json'),'utf8')),resolved=await fsp.realpath(pending.work),base=await fsp.realpath(cache);if(!resolved.startsWith(base+path.sep)||!path.basename(resolved).startsWith('pending-'))return;if(fs.existsSync(path.join(resolved,'install-error')))publish({status:'error',message:(await fsp.readFile(path.join(resolved,'install-error'),'utf8')).replace(/^\uFEFF/,'').slice(0,1500)});else if(!newer(pending.version,currentVersion)){await fsp.rm(resolved,{recursive:true,force:true});await fsp.rm(path.join(cache,'pending.json'),{force:true});}}catch{}}
  return {status:()=>({...state}),restore,check,download:fetchUpdate,install,cancel:()=>{controller?.abort();return {...state};},file:()=>work&&asset?path.join(work,asset.name):null};
}
module.exports={createUpdater,newer,assetName,checksum,validateEntries,trustedURL};
