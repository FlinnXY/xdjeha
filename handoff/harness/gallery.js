// builds every blueprint of both factions instantly on flat ground and saves PNGs to /tmp/gal
const {setup}=require('./sim'); const {snap}=require('./png');
(async()=>{
 const r=await setup(); const w=r.w; const H=w.H2;
 console.log('world', w.width, w.height);
 r.ground(70,'dirt'); for(let x=0;x<=w.width;x++) r.put('grass',x,69);
 const types=(process.argv[2]||'hut,house,house,townhouse,townhouse,hall,well,market,forge,bakery,hospital,barracks,tower,wall,lamp,garden,fountain,statue').split(',');
 for (const fac of [0,1]) {
   // clear
   for(let x=0;x<=w.width;x++) for(let y=0;y<69;y++) if(w.pixelMap[x][y]) w.deletePixel(x,y);
   for(let x=0;x<=w.width;x++){ if(!w.pixelMap[x][69]) r.put('grass',x,69); for(let y=70;y<=w.height;y++) if(!w.pixelMap[x][y]) r.put('dirt',x,y); }
   H.cols.length=0; const c={ id:50+fac, fac, x:80, y:68, name:'Test', plans:[], built:{}, stock:{}, war:{state:'peace'}, pop:20 };
   H.cols.push(c);
   let x=3; let n=0;
   for (const t of types) {
     const bp=H.BLUEPRINTS[t](c); const cost={}; for(const cl of bp.cells){ const k={...(w.H2_COST||{})}; }
     const pl=H.queuePlan(c,t,{site:{x0:x+1,y0:68,gys:Array(bp.w).fill(68),ag:[68,68]}, mirror: n%2===1});
     if(!pl){ console.log('fail',t); continue; }
     H.instantBuild(c,pl); x+=bp.w+4; n++;
     if (x > w.width-16) { break; }
   }
   snap(w,'/tmp/gal/'+(process.argv[3]||'a')+'_fac'+fac+'.png',0,Math.min(w.width,x),40,74,6);
   // night
   w.pixelTicks = Math.floor(w.pixelTicks/2400)*2400 + 2400*0.8; for(let i=0;i<60;i++) w.tick();
   snap(w,'/tmp/gal/'+(process.argv[3]||'a')+'_fac'+fac+'_night.png',0,Math.min(w.width,x),40,74,6,[20,26,48]);
   w.pixelTicks += 2400*0.3; for(let i=0;i<60;i++) w.tick();
 }
 console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6), w.H2.lastError);
 process.exit(0);
})();
