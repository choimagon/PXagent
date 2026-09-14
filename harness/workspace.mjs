import {mkdtemp,mkdir,readFile,writeFile,cp,rm,lstat,readlink,readdir,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir,homedir} from 'node:os';
import path from 'node:path';
import {git,mustGit,runCommand,runShell} from './tools.mjs';
const ignored=new Set(['.px-runtime','.git','node_modules','.venv','venv','.env','.ssh','.codex','.agents','data','release','release-assets','build','dist','test-results','playwright-report']);
const runtimeFile=file=>file.replaceAll('\\','/').split('/').includes('.px-runtime');
const locks=new Map();
const digest=data=>createHash('sha256').update(data).digest('hex');
export async function fileState(root,file) {
  const full=path.join(root,file);
  try {
    const stat=await lstat(full);
    if(stat.isSymbolicLink())return {kind:'link',data:await readlink(full)};
    if(!stat.isFile())throw Error('일반 파일만 변경할 수 있습니다.');
    const data=await readFile(full);if(data.length>64*1024*1024)throw Error('작업 파일이 64MB를 초과합니다.');
    return {kind:'file',data,mode:stat.mode&0o777};
  }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
const signature=value=>value?digest(value.kind==='link'?Buffer.from(`link:${value.data}`):Buffer.concat([Buffer.from(`${value.mode}:`),value.data])):null;
async function files(root) {
  const probe=await git(root,['rev-parse','--show-toplevel']);
  if(probe.exitCode===0)return (await mustGit(root,['ls-files','-z','--cached','--others','--exclude-standard'])).split('\0').filter(file=>file&&!runtimeFile(file));
  const result=[];
  async function walk(dir,relative='') {
    for(const item of await readdir(dir,{withFileTypes:true})) {
      if(ignored.has(item.name)||item.name.startsWith('.env.'))continue;
      const file=path.join(relative,item.name);if(item.isDirectory())await walk(path.join(dir,item.name),file);else result.push(file);
      if(result.length>10000)throw Error('작업 폴더에 파일이 너무 많습니다. 프로젝트 폴더를 좁혀 주세요.');
    }
  }
  await walk(root);return result;
}
async function capture(root) {
  const snapshot=new Map();let size=0;
  for(const file of await files(root)){const value=await fileState(root,file);if(value){size+=Buffer.byteLength(value.data);if(size>256*1024*1024)throw Error('프로젝트 스냅샷이 256MB를 초과합니다. 작업 폴더를 좁혀 주세요.');snapshot.set(file,value);}}
  return snapshot;
}
async function put(root,file,value) {
  const full=path.join(root,file);await mkdir(path.dirname(full),{recursive:true});await rm(full,{force:true});
  if(!value)return;
  if(value.kind==='link') {
    const resolved=path.resolve(path.dirname(full),value.data);
    if(!resolved.startsWith(root+path.sep))throw Error('작업공간 밖으로 연결되는 심볼릭 링크는 허용하지 않습니다.');
    const {symlink}=await import('node:fs/promises');await symlink(value.data,full);
  }else await writeFile(full,value.data,{mode:value.mode});
}
async function restoreSnapshot(root,snapshot) {
  for(const file of await files(root))if(!snapshot.has(file))await put(root,file,null);
  for(const [file,value] of snapshot)await put(root,file,value);
}
async function checkpoint(root,signal) {
  await mustGit(root,['add','-A','--','.',':!.px-runtime',':!**/.px-runtime/**'],signal);
  const changed=await git(root,['diff','--cached','--quiet'],signal);
  if(changed.exitCode!==0)await mustGit(root,['-c','user.name=PXagents','-c','user.email=pxagents@localhost','commit','--no-verify','-m','PXagents isolated validated result'],signal);
  return (await mustGit(root,['rev-parse','HEAD'],signal)).trim();
}
async function copyDependencies(source,destination) {
  for(const folder of ['node_modules','.venv']) {
    try {await lstat(path.join(source,folder));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    await cp(path.join(source,folder),path.join(destination,folder),{recursive:true,mode:constants.COPYFILE_FICLONE});
  }
}
export async function createWorkspaceSession(directory,{signal,commandRunner=runShell}={}) {
  directory=await realpath(directory);
  const probe=await git(directory,['rev-parse','--show-toplevel'],signal);
  const isGit=probe.exitCode===0&&(await git(directory,['rev-parse','--verify','HEAD'],signal)).exitCode===0;
  const origin=isGit?await realpath(probe.stdout.trim()):directory;
  if(!isGit&&(directory===path.parse(directory).root||directory===homedir()))throw Error('격리 작업에는 홈 폴더 대신 실제 프로젝트 폴더를 선택하세요.');
  const scope=path.relative(origin,directory),initial=await capture(origin);
  const staging=await realpath(await mkdtemp(path.join(tmpdir(),'px-worktrees-'))),coordinator=path.join(staging,'integration');
  const createdRoots=new Set([coordinator]);
  try {
  if(isGit){await mustGit(origin,['worktree','add','--detach',coordinator,'HEAD'],signal);await restoreSnapshot(coordinator,initial);}
  else {await mkdir(coordinator);await restoreSnapshot(coordinator,initial);}
  await copyDependencies(directory,path.join(coordinator,scope));
  const baseline=isGit?await checkpoint(coordinator,signal):await capture(coordinator);
  let mergeChain=Promise.resolve();const nodes=[];
  const create=async id=>{
    if(!/^[A-Za-z0-9_-]+$/.test(id))throw Error('작업공간 ID가 올바르지 않습니다.');
    const root=path.join(staging,id);createdRoots.add(root);
    if(isGit)await mustGit(coordinator,['worktree','add','--detach',root,'HEAD'],signal);else {await mkdir(root);await restoreSnapshot(root,await capture(coordinator));}
    await copyDependencies(path.join(coordinator,scope),path.join(root,scope));
    const nodeBaseline=isGit?(await mustGit(root,['rev-parse','HEAD'],signal)).trim():await capture(root);
    const workspace={directory:root,workDirectory:path.join(root,scope),scope,git:isGit,baseline:nodeBaseline,measure:(command,commandSignal=signal,timeoutMs)=>commandRunner(command,path.join(root,scope),commandSignal,timeoutMs,{readOnly:true}),run:(command,commandSignal=signal,timeoutMs)=>commandRunner(command,path.join(root,scope),commandSignal,timeoutMs),
      async changes(){
        if(isGit){const changed=(await mustGit(root,['diff','--name-only','-z',nodeBaseline])).split('\0').filter(Boolean);const untracked=(await mustGit(root,['ls-files','-z','--others','--exclude-standard'])).split('\0').filter(Boolean);return [...new Set([...changed,...untracked])].filter(file=>!runtimeFile(file));}
        const next=await capture(root);return [...new Set([...nodeBaseline.keys(),...next.keys()])].filter(file=>signature(nodeBaseline.get(file))!==signature(next.get(file)));
      },
      diff:()=>isGit?mustGit(root,['diff','--stat',nodeBaseline]):Promise.resolve('스냅샷 비교: 변경 파일 목록 참조'),
      async save(){return isGit?checkpoint(root,signal):capture(root);},
      async restore(saved){if(isGit){await mustGit(root,['reset','--hard',saved]);await mustGit(root,['clean','-fd']);}else await restoreSnapshot(root,saved);},
    };
    nodes.push(workspace);return workspace;
  };
  async function merge(workspace) {
    const operation=mergeChain.catch(()=>{}).then(async()=>{
      if(isGit){await mustGit(workspace.directory,['reset','--soft',workspace.baseline],signal);const commit=await workspace.save();workspace.commit=commit;if(commit!==workspace.baseline){const result=await git(coordinator,['-c','user.name=PXagents','-c','user.email=pxagents@localhost','cherry-pick',commit],signal);if(result.exitCode!==0){await git(coordinator,['cherry-pick','--abort']);throw Error('병렬 작업 변경 충돌: 실패 작업을 다시 계획해야 합니다.');}}}
      else {const changed=await workspace.changes(),backup=new Map();for(const file of changed){const before=await fileState(coordinator,file);if(signature(before)!==signature(workspace.baseline.get(file)))throw Error(`병렬 작업 변경 충돌: ${file}`);backup.set(file,before);}const applied=[];try{for(const file of changed){applied.push(file);await put(coordinator,file,await fileState(workspace.directory,file));}}catch(error){for(const file of applied)await put(coordinator,file,backup.get(file));throw error;}}
    });mergeChain=operation;await operation;
  }
  async function integrate() {
    await mergeChain;const final=await capture(coordinator);
    const changes=[...new Set([...initial.keys(),...final.keys()])].filter(file=>signature(initial.get(file))!==signature(final.get(file)));
    const previous=locks.get(origin)||Promise.resolve();let release;const lock=new Promise(resolve=>{release=resolve;});locks.set(origin,previous.then(()=>lock));await previous;
    try {
      for(const file of changes)if(signature(await fileState(origin,file))!==signature(initial.get(file)))throw Error(`원본 파일이 작업 중 변경되었습니다. 덮어쓰지 않았습니다: ${file}`);
      if(isGit) {
        const patch=await mustGit(coordinator,['diff','--binary',baseline,'HEAD'],signal);
        if(patch){const patchFile=path.join(staging,'result.patch');await writeFile(patchFile,patch);const check=await git(origin,['apply','--check',patchFile],signal);if(check.exitCode!==0)throw Error('원본에 안전하게 통합할 수 없습니다.');await mustGit(origin,['apply',patchFile],signal);}
      }else {
        const applied=[];
        try{for(const file of changes){applied.push(file);await put(origin,file,final.get(file));}}
        catch(error){for(const file of applied)await put(origin,file,initial.get(file));throw error;}
      }
      return changes;
    }finally{release();}
  }
  async function dispose() {
    if(isGit)for(const root of createdRoots)await git(origin,['worktree','remove','--force',root]);
    await rm(staging,{recursive:true,force:true});
  }
  const changes=async()=>{const next=await capture(coordinator);return [...new Set([...initial.keys(),...next.keys()])].filter(file=>signature(initial.get(file))!==signature(next.get(file)));};
  return {origin,scope,directory:coordinator,workDirectory:path.join(coordinator,scope),git:isGit,baseline,create,merge,integrate,dispose,changes,run:(command,commandSignal=signal,timeoutMs)=>commandRunner(command,path.join(coordinator,scope),commandSignal,timeoutMs)};
  }catch(error){if(isGit)for(const root of createdRoots)await git(origin,['worktree','remove','--force',root]);await rm(staging,{recursive:true,force:true});throw error;}
}
