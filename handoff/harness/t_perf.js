// Performance: ~300 villagers (two factions, several settlements) — measures ms per tick.
const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40); r.put('hz_crimson_party',135,40);
 r.run(600);
 const H2=w.H2; H2.cfg.verbose=true;
 let n=0; for(let x=2;x<w.width-2;x++){ const fac=x<76?0:1; const gy=H2.groundY(x,10,70); if(gy<2) continue; if(H2.spawnPerson(x,gy,fac,{})) n++; }
 console.log('spawned',n,'people',H2.people.length,'cols',H2.cols.length);
 const t0=Date.now(); r.run(1000); const ms=(Date.now()-t0)/1000;
 console.log('ms/tick',ms.toFixed(2),'alive',H2.people.filter(p=>!p.dead).length,'cols',H2.cols.map(c=>c.name+':'+c.pop).join(' '));
 console.log('LASTERR', H2.lastError ? String(H2.lastError.stack).slice(0,400) : null);
 console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 console.log(ms<40?'PERF_OK':'PERF_SLOW'); process.exit(0);
})();
