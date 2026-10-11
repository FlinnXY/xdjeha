// A thirsty villager inside a full townhouse (every bed taken by sleepers, children among them) gets out to drink.
const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r); const H2=w.H2; H2.cfg.events=false; H2.cfg.birth=false;
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40); r.run(60);
 const c=H2.cols[0]; c.stock.wood=500; c.stock.stone=500;
 let pl=null; for(let k=0;k<20&&!pl;k++){ pl=H2.queuePlan(c,'townhouse',{cx:112,range:8,mirror:k%2===1}); }
 if(!pl){ console.log('HOUSE_FAIL no site'); process.exit(0); }
 c.plans.splice(c.plans.indexOf(pl),1);
 for(const cell of pl.cells){ const x=pl.x0+cell[0], y=pl.y0+cell[1]; if(!w.pixelMap[x]) continue; const o=w.pixelMap[x][y];
   if(cell[2]==='__dig'){ if(o && !(w.elements[o.element].hzb)) w.deletePixel(x,y); continue; }
   if(o) w.deletePixel(x,y); H2.placeCell(c,pl,cell); }
 r.run(5);
 const beds=w.currentPixels.filter(p=>p.element==='hz_bed'&&p.x>=pl.x0&&p.x<=pl.x1).sort((a,b)=>a.x-b.x||b.y-a.y);
 const maxY=Math.max(...beds.map(b=>b.y)), minY=Math.min(...beds.map(b=>b.y)); const ground=beds.filter(b=>b.y===(process.argv[2]==='up'?minY:maxY));
 // the tester stands on the bed furthest from the left door, the others are asleep (children on every other bed)
 const sleepers=[]; let tester=null;
 const far=ground[ground.length-1];
 for(const b of beds){ const x=b.x, y=b.y-1; if(w.pixelMap[x][y]&&w.pixelMap[x][y].element!=='hz_interior'&&w.pixelMap[x][y].element!=='hz_backwin') continue;
   const kid = (b.x%2===0) && b!==far;
   if(w.pixelMap[x][y]) w.deletePixel(x,y); if(!kid&&w.pixelMap[x][y-1]) w.deletePixel(x,y-1);
   if(kid){ w.createPixel('hz_child',x,y); } else { H2.spawnPerson(x,y,0,{job:'laborer',age:7000}); }
   const q=w.pixelMap[x][y]; if(b===far) tester=q; else sleepers.push(q); }
 r.run(2);
 for(const q of sleepers){ q.sleeping=true; q.en=10; q.th=100; q.hu=100; q.task=null; }
 for(const q of H2.people) if(q!==tester && sleepers.indexOf(q)<0){ q.th=100; }
 tester.th=12; tester.en=100; tester.hu=100; tester.task=null;
 const sx=tester.x, sy=tester.y; let ok=false, maxTh=tester.th;
 for(let t=0;t<2500;t+=10){ r.run(10); for(const q of sleepers){ if(!q.dead){ q.sleeping=true; q.en=10; } } maxTh=Math.max(maxTh,tester.th); if(tester.th>=60){ ok=true; break; } if(tester.dead) break; }
 console.log('house',pl.x0,pl.x1,'beds',beds.length,'sleepers',sleepers.length,'start',sx,sy,'now',tester.x,tester.y,'th',tester.th.toFixed(0),'task',tester.task&&tester.task.k,'dead',!!tester.dead);
 const errs=r.errors.filter(e=>!/style.css|adsbygoogle/.test(e));
 console.log('ERR',errs.slice(0,4));
 console.log(ok && !errs.length ? 'HOUSE_OK' : 'HOUSE_FAIL');
 process.exit(0);
})();
