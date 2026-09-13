import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { codexEnvironment } from './codex-runner.mjs';

export function createCodexLogin({getBinary,spawnProcess=spawn,onComplete=async()=>{}}) {
  let current={status:'idle'},child,timer,nextId=0;
  const pending=new Map();
  function cleanup(){clearTimeout(timer);for(const {reject} of pending.values())reject(new Error('로그인 연결이 종료되었습니다.'));pending.clear();const old=child;child=null;old?.kill();}
  function finish(status,error){current={status,...(error?{error}: {})};cleanup();}
  return {
    status:()=>({...current}),
    cancel(){finish('cancelled');return {...current};},
    async start(){
      if(['starting','pending','verifying'].includes(current.status))return {...current};
      const binary=getBinary();if(!binary)throw Object.assign(new Error('Codex 실행 파일을 찾을 수 없습니다.'),{status:409});
      cleanup();current={status:'starting'};
      const processChild=spawnProcess(binary,['app-server','--stdio'],{env:codexEnvironment(),stdio:['pipe','pipe','pipe'],windowsHide:true});child=processChild;
      const lines=createInterface({input:processChild.stdout});processChild.stderr.resume();
      const failed=error=>{if(child===processChild)finish('failed',error.message);};
      processChild.on('error',failed);processChild.stdin.on('error',failed);
      processChild.on('exit',()=>{if(child===processChild)finish('failed','Codex 로그인 연결이 종료되었습니다. 다시 연결해주세요.');});
      lines.on('line',line=>{
        let message;try{message=JSON.parse(line);}catch{return;}
        const request=pending.get(message.id);
        if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message||'Codex 로그인 오류')):request.resolve(message.result);}
        if(message.method==='account/login/completed'&&child===processChild){
          if(message.params.success){current={status:'verifying'};cleanup();void onComplete().then(()=>{current={status:'complete'};}).catch(error=>{current={status:'failed',error:error.message};});}
          else finish('failed',message.params.error||'로그인을 완료하지 못했습니다.');
        }
      });
      function rpc(method,params){return new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});processChild.stdin.write(JSON.stringify({id,method,params})+'\n');});}
      timer=setTimeout(()=>{if(child===processChild)finish('failed','로그인 시간이 초과되었습니다. 다시 연결해주세요.');},300000);timer.unref();
      try {
        await rpc('initialize',{clientInfo:{name:'pxagents',title:'PXagents',version:'1.0.0'}});
        processChild.stdin.write(JSON.stringify({method:'initialized'})+'\n');
        const login=await rpc('account/login/start',{type:'chatgpt'});
        const url=new URL(login.authUrl);
        if(url.protocol!=='https:'||!['chatgpt.com','auth.openai.com'].includes(url.hostname))throw new Error('공식 로그인 주소를 확인하지 못했습니다.');
        if(child===processChild)current={status:'pending',authUrl:login.authUrl};
        return {...current};
      }catch(error){if(child===processChild)finish('failed',error.message);throw error;}
    },
  };
}
