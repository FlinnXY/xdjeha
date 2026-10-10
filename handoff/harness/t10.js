const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60);
 for(let x=86;x<106;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 for(let x=100;x<130;x++) for(let y=57;y<60;y++){ r.put('rock',x,y);} 
 for (const tx of [15,22,60,70,80]) { for(let y=52;y<60;y++) r.put('wood',tx,y); for(let dx=-2;dx<=2;dx++) for(let dy=-3;dy<=0;dy++) r.put('plant',tx+dx,51+dy); }
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',40,50);
 for(let b=0;b<10;b++){ r.run(100);
  const c=w.H2.cols[0];
  console.log(w.pixelTicks,'wood',Math.round(c.stock.wood),'plans',c.plans.map(p=>p.type+p.i+'/'+p.cells.length+p.state[0]).join(','), w.H2.people.map(p=>p.job[0]+':'+(p.task?p.task.k:'-')+'@'+p.x+(p.sleeping?'z':'')).join(' '));
 }
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
