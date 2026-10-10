const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; const T=terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_crimson_party',135,40);
 r.run(2100-w.pixelTicks);
 const p=w.H2.people.find(q=>q.task&&q.task.k==='drink');
 if(!p){ console.log('no drinker'); process.exit(0);} 
 console.log('drinker',p.job,p.x,p.y,JSON.stringify(p.task,(k,v)=>k==='src'?undefined:v));
 console.log('del',p.del,'dead',p.dead,'sleep',p.sleeping,'inMap',w.pixelMap[p.x][p.y]===p,'element',p.element,'th',p.th,'src',p.task.src&&[p.task.src.x,p.task.src.y,p.task.src.well],'head',w.pixelMap[p.x][p.y-1]&&w.pixelMap[p.x][p.y-1].element, 'faint',p.faint,'jail',p.jail,'leg',p.leg);
 for(let i=0;i<3;i++){ r.run(6); const ahead=[0,-1].map(dy=>{const o=w.pixelMap[p.x-1]&&w.pixelMap[p.x-1][p.y+dy]; return o?o.element:'.';}); const under=w.pixelMap[p.x][p.y+1]&&w.pixelMap[p.x][p.y+1].element; console.log(w.pixelTicks,'x',p.x,'y',p.y,'task',p.task&&p.task.k,'ahead(body,head)',ahead.join(','),'under',under,'stk',p.stk,'det',p.detour,'dd',p.dd,'fails',p.fails); }
 process.exit(0);
})();
