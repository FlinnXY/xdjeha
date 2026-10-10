const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60); w.paused=false;w.manualPaused=false;
 // some trees: wood columns with leaves and rocks
 for (const tx of [15,22,60,70,80]) { for(let y=52;y<60;y++) r.put('wood',tx,y); for(let dx=-2;dx<=2;dx++) for(let dy=-3;dy<=0;dy++) r.put('plant',tx+dx,51+dy); }
 for(let x=100;x<130;x++) for(let y=57;y<60;y++){ const o=w.pixelMap[x][y]; if(o) w.deletePixel(x,y); r.put('rock',x,y);} 
 for(let x=86;x<106;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 r.put('hz_azure_party',40,50);
 for (let b=0;b<24;b++){ r.run(750);
   const c=w.H2.cols[0]; if(!c) continue;
   console.log(w.pixelTicks, 'pop',c.pop,'stock',JSON.stringify(Object.fromEntries(Object.entries(c.stock).map(([k,v])=>[k,Math.round(v)]))), 'plans',c.plans.map(p=>p.type+':'+p.i+'/'+p.cells.length+p.state[0]).join(','), 'built',JSON.stringify(c.built), 'jobs',JSON.stringify(c.jobs));
 }
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 console.log(w.H2.chron.map(c=>c.text).slice(-25));
 process.exit(0);
})();
