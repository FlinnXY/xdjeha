const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r); w.paused=false;
 r.put('hz_azure_party',20,40);
 let k=0;
 for(let t=0;t<6000&&k<10;t+=20){ r.run(20);
  for(const p of w.H2.people){ if(p.th<20&&p.task&&p.task.k==='drink'){k++;const s=p.task.src;
   console.log(w.pixelTicks,p.name,'pos',p.x,p.y,'th',p.th|0,'src',s&&[s.x,s.y,s.well],'nofind',p.task.nofind,'n',p.task.n,'stk',p.stk,'fails',p.fails, 'below', JSON.stringify([1,2].map(d=>{const q=w.pixelMap[p.x]&&w.pixelMap[p.x][p.y+d];return q&&q.element})));} } }
 process.exit(0);})();
