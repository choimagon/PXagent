import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';

test('desktop window plays the real keyboard recording throughout Fast work',{timeout:60000,skip:process.platform==='linux'&&!process.env.DISPLAY},async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'px-desktop-audio-'));
  const env={...process.env,PX_DESKTOP_DATA:data,OFFICE_EXECUTOR:'demo'};
  delete env.ELECTRON_RUN_AS_NODE;
  let desktop,diagnostic='';
  try{
    desktop=await electron.launch({args:process.env.PX_AUDIO_EXECUTABLE?[]:['.'],...(process.env.PX_AUDIO_EXECUTABLE?{executablePath:process.env.PX_AUDIO_EXECUTABLE}:{}),env});
    desktop.process().stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-2000);});
    const page=await desktop.firstWindow();
    await page.waitForLoadState();
    const snapshot=await page.evaluate(async()=>await(await fetch('/api/state')).json());
    assert.equal(snapshot.codex.permissions.sandboxMode,'danger-full-access');
    snapshot.settings.setupComplete=true;
    snapshot.offices.local.agents=snapshot.agents;
    snapshot.agents[0].status='running';snapshot.agents[0].phase='coding';snapshot.agents[0].fastMode=true;
    await page.route('**/api/state',route=>route.fulfill({json:snapshot}));
    await page.addInitScript(()=>{
      localStorage.removeItem('px-muted');
      const NativeContext=window.AudioContext;
      window.keyboardStarts=0;
      window.AudioContext=function(){
        const ctx=new NativeContext();window.keyboardContext=ctx;
        const createSource=ctx.createBufferSource.bind(ctx);
        ctx.createBufferSource=()=>{
          const source=createSource(),start=source.start.bind(source);
          source.start=(...args)=>{
            start(...args);window.keyboardStarts++;
            window.keyboardDuration=source.buffer.duration;
            window.keyboardSignal=source.buffer.getChannelData(0).some(sample=>Math.abs(sample)>.001);
          };
          return source;
        };
        return ctx;
      };
      window.EventSource=class {constructor(){window.officeEvents=this;}close(){}};
    });
    await page.reload();
    await page.waitForFunction(()=>typeof window.officeEvents?.onmessage==='function');
    await page.evaluate(snapshot=>window.officeEvents.onmessage({data:JSON.stringify(snapshot)}),snapshot);
    await page.waitForFunction(()=>window.keyboardStarts>0);
    assert.equal(await page.evaluate(()=>window.keyboardContext.state),'running');
    assert.ok(await page.evaluate(()=>window.keyboardDuration>1&&window.keyboardSignal));
    const starts=await page.evaluate(()=>window.keyboardStarts);
    for(const phase of ['thinking','analyzing','testing','reviewing','coding']){
      snapshot.agents[0].phase=phase;
      await page.evaluate(snapshot=>window.officeEvents.onmessage({data:JSON.stringify(snapshot)}),snapshot);
      assert.equal(await page.evaluate(()=>window.keyboardStarts),starts);
    }
    assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isAudioMuted()),false);
  }catch(error){
    error.message+=`\nElectron diagnostic: ${diagnostic}`;throw error;
  }finally{
    if(desktop)await desktop.close();
    await rm(data,{recursive:true,force:true});
  }
});
