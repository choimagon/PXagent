import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {shellQuote as q} from '../remote-computers.mjs';
import {runCommand,runShell,git} from './tools.mjs';
export function allowedFile(file,scope,allowedFiles=[]) {
  const normalized=file.replaceAll('\\','/');
  if(!normalized||normalized.startsWith('/')||normalized.split('/').some(part=>part==='..'||part==='.git')||/^[A-Za-z]:/.test(normalized))return false;
  if(scope&&normalized!==scope&&!normalized.startsWith(scope.replace(/\/$/,'')+'/'))return false;
  return !allowedFiles.length||allowedFiles.some(pattern=>pattern.endsWith('/**')?normalized.startsWith(pattern.slice(0,-2)):normalized===pattern);
}
export async function validateWorkspace({workspace,signal,commands=[],requireTests=false,maxFiles=100,allowedFiles=[]}) {
  const checks=[],changes=await workspace.changes();
  const record=(name,result)=>checks.push({name,passed:result.exitCode===0,exitCode:result.exitCode,output:(result.stdout+'\n'+result.stderr).slice(-6000)});
  if(workspace.direct){
    for(const file of changes.filter(file=>/\.(mjs|cjs|js|py)$/.test(file))){
      if(workspace.remote){
        const command=file.endsWith('.py')?`python3 -I -S -c ${q('import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())')} ${q(file)}`:`node --check ${q(file)}`;
        record('syntax: '+file,await workspace.run(`if [ -f ${q(file)} ]; then ${command}; fi`));
      }else{
        try{await readFile(file);}catch(error){if(error.code==='ENOENT')continue;throw error;}
        const command=file.endsWith('.py')?'python3':process.execPath;
        const args=file.endsWith('.py')?['-I','-S','-c','import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())',file]:['--check',file];
        try{record('syntax: '+file,await runCommand({command,args,directory:workspace.workDirectory,signal}));}catch(error){if(signal?.aborted)throw error;checks.push({name:'syntax: '+file,passed:false,error:error.message});}
      }
    }
    let project={};try{project=workspace.remote?JSON.parse((await workspace.run('cat package.json')).stdout):JSON.parse(await readFile(path.join(workspace.workDirectory,'package.json'),'utf8'));}catch{}
    const selected=commands.length?commands:Object.keys(project.scripts||{}).filter(name=>['lint','test','test:unit','test:integration','build'].includes(name)).map(name=>`npm run ${name}`);
    for(const command of selected){
      if(typeof command!=='string'||!command.trim()||command.length>8000)throw Error('검증 명령이 올바르지 않습니다.');
      try{record(command,await workspace.run(command,signal,180000));}catch(error){if(signal?.aborted)throw error;checks.push({name:command,passed:false,error:error.message});}
    }
    if(requireTests&&!selected.length)checks.push({name:'실제 테스트 명령',passed:false});
    return {status:checks.every(check=>check.passed)?'PASS':'FAIL',checks,changedFiles:await workspace.changes(),direct:true,checkedAt:Date.now()};
  }
  const scope=workspace.scope.replaceAll(path.sep,'/');
  checks.push({name:'변경 파일 범위',passed:changes.length<=maxFiles&&changes.every(file=>allowedFile(file,scope,allowedFiles)),files:changes});
  if(!checks[0].passed)return {status:'FAIL',checks,changedFiles:changes};
  if(workspace.remote) {
    if(workspace.git)record('git diff --check',await workspace.run(`git diff --check ${workspace.baseline}`));
    else checks.push({name:'원격 Git 격리',passed:true,available:false,scopeVerified:false,note:'Git 프로젝트가 아니어서 직렬 SSH 실행만 사용합니다.'});
    for(const file of changes.filter(file=>/\.(mjs|cjs|js|py)$/.test(file))){const full=path.posix.join(workspace.directory,file),command=file.endsWith('.py')?`python3 -I -S -c ${q('import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())')} ${q(full)}`:`node --check ${q(full)}`;record('syntax: '+file,await workspace.run(`if [ -f ${q(full)} ]; then ${command}; fi`));}
    let project={};try{const result=await workspace.run('cat package.json');if(result.exitCode===0)project=JSON.parse(result.stdout);}catch{}
    const selected=commands.length?commands:Object.keys(project.scripts||{}).filter(name=>['lint','test','test:unit','test:integration','build'].includes(name)).map(name=>`npm run ${name}`);
    for(const command of selected){if(typeof command!=='string'||command.length>8000)throw Error('검증 명령이 올바르지 않습니다.');record(command,await workspace.run(command));}
    if(requireTests&&!selected.length)checks.push({name:'실제 테스트 명령',passed:false});
    const after=await workspace.changes();checks.push({name:'검증 후 변경 범위',passed:after.length<=maxFiles&&after.every(file=>allowedFile(file,scope,allowedFiles)),files:after});
    return {status:checks.every(check=>check.passed)?(workspace.git?'PASS':'LIMITED'):'FAIL',checks,changedFiles:after,checkedAt:Date.now()};
  }
  if(workspace.git)record('git diff --check',await git(workspace.directory,['diff','--check',workspace.baseline],signal));
  for(const file of changes.filter(file=>/\.(mjs|cjs|js)$/.test(file))) {
    try {await readFile(path.join(workspace.directory,file));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    record(`syntax: ${file}`,await runCommand({command:process.execPath,args:['--check',path.join(workspace.directory,file)],directory:workspace.workDirectory,signal}));
  }
  for(const file of changes.filter(file=>/\.py$/.test(file))) {
    try{await readFile(path.join(workspace.directory,file));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    try{record(`syntax: ${file}`,await runCommand({command:'python3',args:['-I','-S','-c','import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())',path.join(workspace.directory,file)],directory:workspace.workDirectory,signal}));}catch(error){checks.push({name:`syntax: ${file}`,passed:false,error:error.message});}
  }
  let project={};try{project=JSON.parse(await readFile(path.join(workspace.workDirectory,'package.json'),'utf8'));}catch{}
  const selected=commands.length?commands:Object.keys(project.scripts||{}).filter(name=>['lint','test','test:unit','test:integration','build'].includes(name)).map(name=>`npm run ${name}`);
  if(!commands.length&&!selected.length) {try{if((await readdir(path.join(workspace.workDirectory,'tests'))).some(file=>file.endsWith('.py')))selected.push('python3 -m pytest');}catch{}}
  for(const command of selected) {
    if(typeof command!=='string'||!command.trim()||command.length>8000)throw Error('검증 명령이 올바르지 않습니다.');
    try{record(command,await (workspace.run?workspace.run(command,signal,180000):runShell(command,workspace.workDirectory,signal,180000)));}catch(error){if(signal?.aborted)throw error;checks.push({name:command,passed:false,error:error.message});}
  }
  if(requireTests&&!selected.length)checks.push({name:'실제 테스트 명령',passed:false,error:'실험 전 validationCommands를 지정하거나 프로젝트 test 스크립트를 추가하세요.'});
  const after=await workspace.changes();checks.push({name:'검증 후 변경 범위',passed:after.length<=maxFiles&&after.every(file=>allowedFile(file,scope,allowedFiles)),files:after});
  return {status:checks.every(check=>check.passed)?'PASS':'FAIL',checks,changedFiles:changes,checkedAt:Date.now()};
}
