const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60);
 for(let x=60;x<80;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure',30,59);
 const p=w.currentPixels.find(q=>q.element==='hz_body'); p.th=20; p.hu=90;
 for(let i=0;i<30;i++){ r.run(40); console.log(w.pixelTicks,'x',p.x,'y',p.y,'th',p.th.toFixed(0),'task',p.task&&p.task.k+JSON.stringify({src:!!p.task.src,n:p.task.n}),'stk',p.stk,'fails',p.fails,'sub',p.sub,'swim',p.swim); if(p.th>80) break; }
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
