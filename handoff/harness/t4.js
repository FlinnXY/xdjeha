const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60); w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',30,50);
 const orig=w.elements.hz_body.tick; let calls=0; let ticksSeen=new Set();
 w.elements.hz_body.tick=function(p){ calls++; return orig(p); };
 const t0=w.pixelTicks; r.run(100); console.log('ticks advanced', w.pixelTicks-t0, 'bodyTick calls', calls, 'people', w.H2.people.length);
 process.exit(0);
})();
