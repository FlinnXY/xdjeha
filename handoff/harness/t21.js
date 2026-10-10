const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40);
 const seen={}; let n=0;
 for(let t=0;t<7000 && n<12;t+=40){ r.run(40);
  for(const p of w.H2.people){ if(p.th<12 && !seen[p.id+Math.floor(w.pixelTicks/200)] ){ seen[p.id+Math.floor(w.pixelTicks/200)]=1; n++;
    const water=w.currentPixels.filter(q=>q.element==='water'&&!q.del).length;
    console.log(w.pixelTicks,p.name,p.job,'x',p.x,'y',p.y,'th',p.th.toFixed(0),'task',p.task&&p.task.k,'pri',p.task&&p.task.pri,JSON.stringify(p.task&&p.task.src?[p.task.src.x,p.task.src.y,p.task.src.well]:null),'sleep',p.sleeping,'fails',p.fails,'stk',p.stk,'det',p.detour,'waterPx',water); } } }
 process.exit(0);
})();
