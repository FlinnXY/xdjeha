const {setup}=require('./sim');
(async()=>{
 const r=await setup([]); const w=r.w; r.ground(60);
 w.paused=false;w.manualPaused=false;
 const rowCount=(y)=>{let n=0;for(let x=0;x<w.width;x++) if(w.pixelMap[x][y]) n++; return n;};
 r.run(30);
 const rows=[]; for(let y=0;y<w.height;y++) rows.push(rowCount(y)); console.log(rows.join(' '));
 console.log(w.pixelMap.length, w.pixelMap[0].length, w.height, w.width);
 process.exit(0);
})();
