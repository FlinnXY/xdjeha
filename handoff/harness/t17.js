const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; const T=terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40);
 r.run(2300);
 console.log([3,6,9,13,48,49].map(x=>{ let y=0; for(;y<=w.height;y++) if(w.pixelMap[x][y]) break; return x+':'+w.pixelMap[x][y].element+y; }).join(' '));
 const cnt={}; for(const p of w.currentPixels) if(!p.del) cnt[p.element]=(cnt[p.element]||0)+1; console.log(JSON.stringify(cnt));
 process.exit(0);
})();
