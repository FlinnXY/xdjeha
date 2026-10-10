const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60);
 for(let x=86;x<106;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 for(let x=100;x<130;x++) for(let y=57;y<60;y++){ r.put('rock',x,y);} 
 for (const tx of [15,22,60,70,80]) { for(let y=52;y<60;y++) r.put('wood',tx,y); for(let dx=-2;dx<=2;dx++) for(let dy=-3;dy<=0;dy++) r.put('plant',tx+dx,51+dy); }
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',40,50);
 let shown=0; const last={};
 for(let b=0;b<60;b++){ r.run(150);
  const c=w.H2.cols[0]; if(!c) continue; const pl=c.plans.find(p=>{ const L=last[p.id]; const stuck=L&&L.i===p.i&&w.pixelTicks-L.t>500; if(!L||L.i!==p.i) last[p.id]={i:p.i,t:w.pixelTicks}; return stuck; });
  if(pl && shown<4){ shown++; console.log(w.pixelTicks,'plan',pl.type,'x0',pl.x0,'y0',pl.y0,'cell0',JSON.stringify(pl.cells[0]),'state',pl.state,'cellsN',pl.cells.length);
    for(const p of w.H2.people) if(p.job==='builder') console.log('  builder',p.x,p.y,JSON.stringify(p.task), 'cool', p.buildCool, 'sleeping',p.sleeping);
    const cell=pl.cells[0]; console.log('  occupant', w.pixelMap[pl.x0+cell[0]][pl.y0+cell[1]]&&w.pixelMap[pl.x0+cell[0]][pl.y0+cell[1]].element);
  }
 }
 process.exit(0);
})();
