const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r); w.paused=false;
 for(let y=56;y<=65;y++){let s=y+' ';for(let x=0;x<14;x++){const q=w.pixelMap[x][y];s+=q?q.element[0]:'.';}console.log(s);}
 console.log(Object.keys(w.pixelMap[1]).length, w.pixelMap[1][64]&&w.pixelMap[1][64].element);
 r.put('hz_azure',3,62);
 for(let i=0;i<10;i++){ r.run(30); const p=w.H2.people[0]; console.log(w.pixelTicks,p&&[p.x,p.y,p.task&&p.task.k,p.fails,p.stk]); }
 process.exit(0);})();
