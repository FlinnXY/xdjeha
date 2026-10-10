const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; const T=terrain(r);
 r.put('hz_azure_party',20,40); r.put('hz_crimson_party',135,40);
 const N=+process.argv[2]||6000;
 for(let t=0;t<N;t+=250){ r.run(250);
   const th=w.H2.people.filter(p=>!p.dead && p.th<40);
   for(const p of th) console.log(w.pixelTicks, p.first, 'th'+Math.round(p.th), 'hu'+Math.round(p.hu),'@',p.x,p.y, 'task', p.task&&p.task.k, p.task&&p.task.src?JSON.stringify({x:p.task.src.x,y:p.task.src.y,w:p.task.src.well}):'', 'stk',p.stk,'fails',p.fails,'det',p.detour, 'pri',p.task&&p.task.pri);
   const deaths=w.H2.chron.filter(e=>/thirst/.test(e.text)).length; if(deaths) console.log('DEATHS',deaths);
 }
 console.log('wells', (w.H2.st.well||[]).map(s=>s.x+','+s.y));
 process.exit(0);
})();
