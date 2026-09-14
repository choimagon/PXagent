import path from 'node:path';
import {shellQuote as q} from '../remote-computers.mjs';
export async function createRemoteWorkspaceSession(directory,{run,signal}={}) {
  const execute=async(command,cwd=directory)=>{if(signal?.aborted)throw signal.reason;const result=await run(command.replace(/\bgit /g,'git -c core.hooksPath=/dev/null -c commit.gpgsign=false '),cwd);if(result.exitCode!==0)throw Error(result.stderr||'원격 Git 작업이 실패했습니다.');return result.stdout;};
  const origin=(await execute('git rev-parse --show-toplevel')).trim();
  if(!origin.startsWith('/')||/[\r\n]/.test(origin))throw Error('원격 격리 작업에는 Git 프로젝트 폴더가 필요합니다.');
  const actual=(await execute('pwd -P')).trim(),scope=path.posix.relative(origin,actual);
  if(scope==='..'||scope.startsWith('../'))throw Error('원격 프로젝트 경로를 확인해주세요.');
  const staging=(await execute('mktemp -d /tmp/px-remote-worktrees.XXXXXX')).trim();
  if(!/^\/tmp\/px-remote-worktrees\.[A-Za-z0-9]+$/.test(staging))throw Error('원격 임시 작업공간을 생성하지 못했습니다.');
  const coordinator=staging+'/integration',initialPatch=await execute('git diff --binary HEAD',origin);
  const save=async root=>{await execute("git -c core.hooksPath=/dev/null -c commit.gpgsign=false add -A && if ! git diff --cached --quiet; then git -c user.name=PXagents -c user.email=pxagents@localhost commit --no-verify -m 'PXagents validated isolated result'; fi",root);return (await execute('git rev-parse HEAD',root)).trim();};
  const children=[];
  try {
    await execute(`git worktree add --detach ${q(coordinator)} HEAD`,origin);
    await execute(`git diff --binary HEAD > ${q(staging+'/initial.patch')}; if [ -s ${q(staging+'/initial.patch')} ]; then git -C ${q(coordinator)} apply ${q(staging+'/initial.patch')}; fi; git ls-files -z --others --exclude-standard > ${q(staging+'/files')}; tar --null -T ${q(staging+'/files')} -cf ${q(staging+'/extra.tar')}; tar -xf ${q(staging+'/extra.tar')} -C ${q(coordinator)}`,origin);
    const baseline=await save(coordinator);
    for(const dependency of ['node_modules','.venv'])await execute(`if [ -d ${q(actual+'/'+dependency)} ]; then cp -R ${q(actual+'/'+dependency)} ${q(coordinator+'/'+scope+'/'+dependency)}; fi`,origin);
    let merges=Promise.resolve();
    const create=async id=>{
      if(!/^[A-Za-z0-9_-]+$/.test(id))throw Error('원격 작업 ID를 확인해주세요.');
      const root=staging+'/'+id;await execute(`git worktree add --detach ${q(root)} HEAD`,coordinator);children.push(root);
      for(const dependency of ['node_modules','.venv'])await execute(`if [ -d ${q(coordinator+'/'+scope+'/'+dependency)} ]; then cp -R ${q(coordinator+'/'+scope+'/'+dependency)} ${q(root+'/'+scope+'/'+dependency)}; fi`,origin);
      const nodeBaseline=(await execute('git rev-parse HEAD',root)).trim();
      return {directory:root,workDirectory:path.posix.join(root,scope),scope,git:true,remote:true,baseline:nodeBaseline,run:(command)=>run(command,path.posix.join(root,scope)),
        changes:async()=>[...new Set((await execute(`git diff --name-only -z ${q(nodeBaseline)}; git ls-files -z --others --exclude-standard`,root)).split('\0').filter(Boolean))],
        diff:()=>execute(`git diff --stat ${q(nodeBaseline)}`,root),save:()=>save(root),restore:saved=>execute(`git reset --hard ${q(saved)} && git clean -fd`,root),
      };
    };
    const merge=async workspace=>{const operation=merges.catch(()=>{}).then(async()=>{await execute(`git reset --soft ${q(workspace.baseline)}`,workspace.directory);const commit=await workspace.save();workspace.commit=commit;if(commit!==workspace.baseline){try{await execute(`git -c user.name=PXagents -c user.email=pxagents@localhost cherry-pick ${q(commit)}`,coordinator);}catch(error){await execute('git cherry-pick --abort',coordinator);throw error;}}});merges=operation;await operation;};
    const integrate=async()=>{await merges;if((await execute('git diff --binary HEAD',origin))!==initialPatch)throw Error('원격 원본이 작업 중 변경되어 통합을 중지했습니다.');const patch=staging+'/result.patch';const changed=(await execute(`git diff --name-only -z ${q(baseline)} HEAD`,coordinator)).split('\0').filter(Boolean);await execute(`git diff --binary ${q(baseline)} HEAD > ${q(patch)}`,coordinator);await execute(`if [ -s ${q(patch)} ]; then git apply --check ${q(patch)} && git apply ${q(patch)}; fi`,origin);return changed;};
    const dispose=async()=>{for(const root of [...children,coordinator])await run(`git -c core.hooksPath=/dev/null worktree remove --force ${q(root)}`,origin,{cleanup:true});await run(`rm -rf ${q(staging)}`,origin,{cleanup:true});};
    return {origin,scope,directory:coordinator,workDirectory:path.posix.join(coordinator,scope),git:true,remote:true,baseline,create,merge,integrate,dispose,run:command=>run(command,path.posix.join(coordinator,scope)),changes:async()=>(await execute(`git diff --name-only -z ${q(baseline)} HEAD`,coordinator)).split('\0').filter(Boolean)};
  }catch(error){await run(`git -c core.hooksPath=/dev/null worktree remove --force ${q(coordinator)}; rm -rf ${q(staging)}`,origin,{cleanup:true});throw error;}
}
