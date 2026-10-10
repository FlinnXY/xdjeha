const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60);
 for(let x=60;x<80;x++) for(let y=60;y<64;y++){ w.deletePixel(x,y); r.put('water',x,y);} 
 for(let x=100;x<125;x++) for(let y=56;y<60;y++){ r.put('rock',x,y);} for(let x=10;x<30;x++) for(let y=56;y<60;y++){ r.put('rock',x,y);}
 for (const tx of [8,33,50,95,128,140]) { for(let y=52;y<60;y++) r.put('wood',tx,y); for(let dx=-2;dx<=2;dx++) for(let dy=-3;dy<=0;dy++) r.put('plant',tx+dx,51+dy); }
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,50); r.put('hz_crimson_party',130,50);
 const N=+process.argv[2]||12000; const step=250; let shown=0;
 for(let t=0;t<N;t+=step){ r.run(step);
   const line=w.H2.cols.map(c=>c.name+'['+FACN(c)+'] pop'+c.pop+' w:'+c.war.state+' T'+Math.round(c.tensionPts)+' own'+Math.round(c.ownPow||0)+' est'+Math.round(c.estPow||0)+' built:'+Object.entries(c.built).map(([k,v])=>k[0]+v).join('')+' sold'+c.sold).join(' | ');
   console.log(w.pixelTicks, line);
   if(w.pixelTicks>=3000) for(const p of w.H2.people) if(p.th<25) console.log('     THIRSTY',p.name,p.job,'x',p.x,'y',p.y,'th',p.th.toFixed(0),'task',p.task&&p.task.k,p.task&&p.task.pri,'sleep',p.sleeping,'panic',p.panic, 'jail',p.jail,'bt',p.bt.toFixed(1));
   while(shown<w.H2.chron.length){ const e=w.H2.chron[shown++]; if(e.major) console.log('   *',e.text); }
 }
 function FACN(c){return c.fac===0?'A':'C'}
 console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
