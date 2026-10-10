const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; const T=terrain(r);
 w.paused=false;w.manualPaused=false; if(process.env.NOEV) w.H2.cfg.events=false;
 r.put('hz_azure_party',20,40); r.put('hz_crimson_party',135,40);
 const N=+process.argv[2]||10000; const step=500; let shown=0; const causes={};
 for(let t=0;t<N;t+=step){ r.run(step);
   const line=w.H2.cols.map(c=>c.name+'['+(c.fac?'C':'A')+'] pop'+c.pop+' '+c.war.state+' T'+Math.round(c.tensionPts)+' w'+Math.round(c.stock.wood)+' s'+Math.round(c.stock.stone)+' f'+Math.round(c.stock.bread+c.stock.grain)+' coin'+Math.round(c.stock.coin)+' beds'+c.beds+' '+Object.entries(c.built).map(([k,v])=>k[0]+v).join('')+' j:'+Object.entries(c.jobs).map(([k,v])=>k[0]+v).join('')).join(' | ');
   console.log(w.pixelTicks, line);
   while(shown<w.H2.chron.length){ const e=w.H2.chron[shown++]; if(e.major) console.log('   *',e.text); }
 }
 console.log('LASTERR', w.H2.lastError ? String(w.H2.lastError.stack).slice(0,400) : null); console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
