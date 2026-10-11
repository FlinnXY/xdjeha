// A villager stuck at the bottom of a deep pit climbs the quarry ladder to reach a well on the surface.
const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r); w.H2.cfg.events=false; w.H2.cfg.birth=false;
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40); r.run(60);
 const P=w.H2.people.filter(p=>!p.dead);
 const p=P[0]; const c=w.H2.cols[0];
 // dig a 10-deep, 5-wide vertical shaft away from town and put a quarry-style ladder against its right wall
 const X=50, g=w.H2.groundY ? null : null;
 let gy=0; while(!w.pixelMap[X][gy+1]) gy++;           // standing row at X
 for(let x=X;x<X+5;x++) for(let y=gy-6;y<=gy+10;y++) if(w.pixelMap[x][y]) w.deletePixel(x,y);
 const Q={x0:X,dir:1,cells:[],i:0,L:4}; for(let x=X;x<X+5;x++) for(let y=gy+1;y<=gy+10;y++) Q.cells.push([x,y]); Q.i=Q.cells.length;
 w.H2.ladderQuarry(Q);
 let lad=0; for(let y=0;y<w.height;y++) if(w.pixelMap[X+4][y]&&w.pixelMap[X+4][y].element==='hz_ladder') lad++;
 // move the villager to the pit floor
 const h=w.pixelMap[p.x][p.y-1]; w.deletePixel(p.x,p.y-1); w.movePixel(p,X+1,gy+10); w.createPixel('hz_head',X+1,gy+9); const nh=w.pixelMap[X+1][gy+9]; Object.assign(nh,{fac:p.fac,color:p.skin});
 p.task=null; p.th=20; for(const q of P) if(q!==p){ q.th=100; }
 const y0=p.y; let out=false, minY=p.y;
 for(let t=0;t<1500;t+=10){ r.run(10); minY=Math.min(minY,p.y); if(p.y<=gy+1 && (p.x<X||p.x>X+4)){ out=true; break; } if(p.dead) break; }
 console.log('ladder cells',lad,'start y',y0,'min y',minY,'now',p.x,p.y,'task',p.task&&p.task.k,'th',p.th.toFixed(0),'dead',!!p.dead);
 const errs=r.errors.filter(e=>!/style.css|adsbygoogle/.test(e));
 console.log('ERR',errs.slice(0,4));
 console.log(lad>=8 && out && !errs.length ? 'LADDER_OK' : 'LADDER_FAIL');
 process.exit(0);
})();
