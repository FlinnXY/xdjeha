const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60);
 for(let x=86;x<106;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 w.paused=false;w.manualPaused=false; w.pixelTicks=300;
 r.put('hz_azure_party',40,50);
 const c=w.H2.cols[0]; c.stock.wood=200; c.stock.stone=100;
 r.run(5);
 const pl=w.H2.queuePlan(c,'house',{});
 console.log('plan',pl&&[pl.x0,pl.y0,pl.cells.length]);
 for(const p of w.H2.people) { w.H2.setJob(p,'builder'); p.task=null; }
 for(let b=0;b<12;b++){ r.run(60);
   console.log(w.pixelTicks,'i',pl.i,'/',pl.cells.length,pl.state, w.H2.people.slice(0,3).map(p=>(p.task?p.task.k:'-')+'@'+p.x+','+p.y).join(' '), 'plans',c.plans.length);
 }
 process.exit(0);
})();
