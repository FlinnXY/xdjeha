// single/two colony watcher: node watch.js [ticks] [step] [both]
const {setup,terrain}=require('./sim'); const {dump}=require('./map');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r); w.paused=false;
 const both = process.argv[4]==='both';
 r.put('hz_azure_party',20,40); if (both) r.put('hz_crimson_party',135,40);
 const N=+process.argv[2]||6000, step=+process.argv[3]||1000; let shown=0;
 for(let t=0;t<N;t+=step){ r.run(step);
  console.log('==== tick', w.pixelTicks, 'day', Math.floor(w.pixelTicks/2400)+1);
  for (const c of w.H2.cols) console.log(c.name, 'pop', c.pop, 'stock', JSON.stringify(c.stock), 'plans', c.plans.map(p=>p.type+':'+p.i+'/'+p.cells.length+':'+p.state).join(','), 'built', JSON.stringify(c.built));
  for (const p of w.H2.people) console.log('  ', p.name.padEnd(18), (p.job||'').padEnd(10), 'xy', p.x, p.y, 'hp', Math.round(p.hp), 'hu', Math.round(p.hu), 'th', Math.round(p.th), 'en', Math.round(p.en), 'task', p.task&&p.task.k, p.task&&p.task.pri, p.sleeping?'Zz':'', 'inv', JSON.stringify(p.inv));
  while(shown<w.H2.chron.length){ const e=w.H2.chron[shown++]; console.log('   *',e.text); }
  console.log(dump(w, 0, both?152:100, 44, 70));
 }
 console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
