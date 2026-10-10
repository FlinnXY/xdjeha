const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r); w.paused=false;
 r.put('hz_azure_party',20,40);
 for(let t=0;t<7000;t+=10){ r.run(10);
  for(const p of w.H2.people){ if(p.task&&p.task.k==='drink'&&p.fails>=6){
      console.log('FAILS',w.pixelTicks,p.name,p.x,p.y,'fails',p.fails,JSON.stringify(p.task).slice(0,180));
      for(let y=p.y-5;y<=p.y+3;y++){let s=y+' ';for(let x=Math.max(0,p.x-10);x<=p.x+12;x++){const q=w.pixelMap[x]&&w.pixelMap[x][y];s+=(q===p?'@':q?(q.element.startsWith('hz_')?q.element[3].toUpperCase():q.element[0]):'.');}console.log(s);}
      process.exit(0);} } }
 console.log('none');process.exit(0);})();
