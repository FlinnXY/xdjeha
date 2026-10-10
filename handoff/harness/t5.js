const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60); w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',30,50);
 const p=w.H2.people[0]||w.currentPixels.find(q=>q.element==='hz_body');
 let last=p.hu; const log=[];
 for(let i=0;i<40;i++){ r.run(1); if(p.hu!==last){ log.push([w.pixelTicks,(last-p.hu).toFixed(2), p.id]); last=p.hu; } }
 console.log(log.join(' ; '));
 process.exit(0);
})();
