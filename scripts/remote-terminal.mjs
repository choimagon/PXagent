// Codex calls this local helper. Credentials stay in the office server.
let raw='';for await(const chunk of process.stdin)raw+=chunk;
try {
  if(!process.env.PX_REMOTE_URL||!process.env.PX_REMOTE_TOKEN)throw new Error('원격 작업 세션이 아닙니다.');
  const response=await fetch(process.env.PX_REMOTE_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.PX_REMOTE_TOKEN}`},body:raw});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'원격 명령을 실행하지 못했습니다.');
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exitCode=result.exitCode===0?0:1;
} catch(error){console.error(error.message);process.exitCode=1;}
