const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; const T=terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40);
 r.run(2300);
 const c=w.H2.cols[0]; const H=w.H2;
 console.log('hall',c.hall,'center',c.x,c.y,'plans',c.plans.map(p=>p.type+p.i+'/'+p.cells.length+p.state), 'built',c.built,'stock',JSON.stringify(c.stock));
 console.log('campfires',(H.st.campfire||[]).map(s=>[s.x,s.y,s.fac]), 'beds',(H.st.bed||[]).length,'halls',(H.st.hall||[]).map(s=>[s.x,s.y,s.ay,s.fac]));
 const site=H.findSite(c,5,{}); console.log('hut site',site);
 const site2=H.findSite(c,9,{}); console.log('hall-size site',site2);
 // column grounds
 const out=[]; for(let x=0;x<60;x++){ let y=0; for(;y<=w.height;y++) if(w.pixelMap[x][y]) break; out.push(x+':'+(w.pixelMap[x][y]?w.pixelMap[x][y].element[0]+y:'-')); } console.log(out.join(' '));
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
