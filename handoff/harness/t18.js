const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; const T=terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_crimson_party',135,40);
 for(const T0 of [900,1500,2100,2700]){ r.run(T0-w.pixelTicks+ (w.pixelTicks<T0?0:0));
  const c=w.H2.cols[0]; console.log('==',w.pixelTicks,'plans',c.plans.map(p=>p.type+p.i+'/'+p.cells.length+p.state+'@'+p.x0), 'stock w',Math.round(c.stock.wood),'hall',JSON.stringify(c.hall),'center',c.x,c.y);
  for(const p of w.H2.people) console.log('  ',p.job.padEnd(10),'x',p.x,'y',p.y,'task',p.task&&p.task.k,p.task&&JSON.stringify({n:p.task.n,none:p.task.none,tx:p.task.tx}),'fails',p.fails,'stk',p.stk,'det',p.detour,'sl',p.sleeping,'inv',JSON.stringify(p.inv)); }
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
