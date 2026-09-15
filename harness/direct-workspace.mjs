import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {runShell} from './tools.mjs';

// Sessions track reported edits for validation; all work happens in the real directory.
export async function createDirectSession(directory,{signal,remote=false,run}={}) {
  if(!remote)directory=await realpath(directory);
  const paths=remote?path.posix:path,all=new Set();
  const commandRunner=run||((command,commandSignal=signal,timeoutMs)=>runShell(command,directory,commandSignal,timeoutMs));
  const make=()=>{
    const changed=new Set();
    return {directory,workDirectory:directory,scope:'',git:false,remote,direct:true,
      recordChanges(files){for(const file of files){if(typeof file!=='string'||!file)continue;const full=paths.resolve(directory,file);changed.add(full);all.add(full);}},
      changes:async()=>[...changed],run:commandRunner,measure:commandRunner};
  };
  return {...make(),changes:async()=>[...all],create:async()=>make(),merge:async()=>{},integrate:async()=>[...all],dispose:async()=>{}};
}
