const {boot}=require('./boot');
async function setup(mods, opts){
  const r = await boot(mods||['Humanitize2.js'], opts||{});
  const w=r.w; w.H2 && (w.H2.cfg.verbose=true);
  r.run=(n)=>{ for(let i=0;i<n;i++){ try{ w.pixelTicks = w.pixelTicks; w.tick(); }catch(e){ r.errors.push('TICKERR '+e.stack.split('\n').slice(0,4).join(' | ')); if(r.errors.length>30) break; } } };
  r.ground=(y0=60,mat='dirt')=>{ for(let x=0;x<=w.width;x++) for(let y=y0;y<=w.height;y++) if(!w.pixelMap[x][y]) w.createPixel(mat,x,y); w.createPixel; };
  r.put=(el,x,y)=>{ w.createPixel(el,x,y); return w.pixelMap[x][y]; };
  return r;
}
module.exports={setup};
// natural-looking test terrain: rolling hills, grass top, rock below, a lake and trees
module.exports.terrain = function(r, opt){
  opt = opt||{}; const w=r.w;
  const hOf = (x)=> 62 + Math.round(2.2*Math.sin(x/19) + 1.5*Math.sin(x/7+1));
  const lakeA = opt.lake || [66,84];
  for (let x=0;x<=w.width;x++){
    const h=hOf(x); const inLake = x>=lakeA[0] && x<=lakeA[1];
    const top = inLake ? h+3 : h;
    for (let y=top;y<=w.height;y++){
      let el = y===top ? 'grass' : (y<top+3 ? 'dirt' : 'rock');
      if (inLake) el='rock';
      r.put(el,x,y);
    }
    if (inLake){ for(let y=h;y<top;y++) r.put('water',x,y); }
    if (x===lakeA[0]-1||x===lakeA[1]+1){ }
  }
  const trees = opt.trees || [12,38,55,100,118,140];
  for (const tx of trees){ if (tx>=lakeA[0]-2&&tx<=lakeA[1]+2) continue; const h=hOf(tx); const H=5+(tx%3);
    for(let y=h-H;y<h;y++) r.put('wood',tx,y);
    for(let dx=-2;dx<=2;dx++) for(let dy=-3;dy<=0;dy++) if(Math.abs(dx)+Math.abs(dy)<4) { const o=w.pixelMap[tx+dx]&&w.pixelMap[tx+dx][h-H+dy]; if(!o) r.put('plant',tx+dx,h-H+dy); } }
  return {hOf};
};
