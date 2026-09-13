// The desktop parent owns OS credential encryption; tokens never enter the renderer.
let sequence=0;
const pending=new Map();
process.on('message',message=>{
  if(message?.type!=='secret-response')return;
  const request=pending.get(message.id);if(!request)return;
  clearTimeout(request.timer);pending.delete(message.id);
  message.error?request.reject(new Error(message.error)):request.resolve(message.value);
});
export function secretCodec(operation,value) {
  if(!process.send)throw new Error('앱 보안 저장소에 연결할 수 없습니다.');
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('앱 보안 저장소 응답 시간이 초과되었습니다.'));},15000);
    pending.set(id,{resolve,reject,timer});
    process.send({type:'secret-request',id,operation,value});
  });
}
