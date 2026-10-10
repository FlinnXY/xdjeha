const {setup}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; r.ground(60); w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',30,50);
 console.log('airTemp',w.airTemp, w.settings && w.settings.airTemp);
 for(let i=0;i<8;i++){ r.run(100); const p=w.H2.people[0]; console.log(i, p&&[p.temp.toFixed(1),p.hp.toFixed(0),p.hu.toFixed(0),p.th.toFixed(0),p.dead,p.x,p.y].join(' ')); }
 console.log(r.errors.filter(e=>!/style.css|adsbygoogle|pregnancy/.test(e)).slice(0,5));
 process.exit(0);
})();
