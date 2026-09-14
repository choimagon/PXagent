import {randomUUID} from 'node:crypto';
export const EVENT_TYPES=new Set(['task.created','task.planned','task.assigned','task.started','task.completed','task.failed','task.stopped','task.replanned','agent.assigned','agent.started','agent.thinking','agent.coding','agent.testing','agent.reviewing','agent.completed','agent.failed','autoresearch.started','autoresearch.experiment.started','autoresearch.experiment.completed','autoresearch.best.updated','autoresearch.completed','document.analysis.started','document.analysis.completed','validation.started','validation.completed','workspace.created','workspace.merged']);
export function createEventBus({history=[],onEvent=()=>{},limit=2000}={}) {
  const listeners=new Set();
  return {
    history,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    async emit(type,context={}) {
      if(!EVENT_TYPES.has(type))throw Error(`알 수 없는 실행 이벤트: ${type}`);
      const event={...context,id:randomUUID(),type,at:Date.now()};history.push(event);if(history.length>limit)history.splice(0,history.length-limit);
      await onEvent(event);for(const listener of listeners)await listener(event);return event;
    },
  };
}
