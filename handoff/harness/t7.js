const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60); w.paused=false;w.manualPaused=false;
 for(let x=86;x<106;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 for(let x=100;x<130;x++) for(let y=57;y<60;y++){ r.put('rock',x,y);} 
 for (const tx of [15,22,60,70,80]) { for(let y=52;y<60;y++) r.put('wood',tx,y); for(let dx=-2;dx<=2;dx++) for(let dy=-3;dy<=0;dy++) r.put('plant',tx+dx,51+dy); }
 r.put('hz_azure_party',40,50);
 for(let b=0;b<14;b++){ r.run(500);
  const c=w.H2.cols[0]; console.log('--',w.pixelTicks,'pop',c.pop,'plans',c.plans.map(p=>p.type+p.i+'/'+p.cells.length+p.state[0]).join(','),'built',JSON.stringify(c.built),'wood',Math.round(c.stock.wood),'stone',Math.round(c.stock.stone),'grain',Math.round(c.stock.grain),'bread',Math.round(c.stock.bread),'jobs',JSON.stringify(c.jobs));
  if(b>=3 && b%2==1) for(const p of w.H2.people) console.log(p.name.padEnd(18),p.job.padEnd(10),'x',p.x,'y',p.y,'th',p.th.toFixed(0),'hu',p.hu.toFixed(0),'task',p.task&&p.task.k,p.task&&JSON.stringify({n:p.task.n,none:p.task.none,nof:p.task.nofind}),'fails',p.fails,'stk',p.stk);
 }
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
