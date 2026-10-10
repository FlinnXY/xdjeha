const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_crimson_party',135,40); r.put('hz_azure_party',20,40);
 const last={}; const seen={}; let rep=0;
 for(let t=0;t<9000 && rep<8;t+=30){ r.run(30);
   for(const p of w.H2.people){ const L=last[p.id]; if(!L||L.x!==p.x||L.y!==p.y||L.k!==(p.task&&p.task.k)||p.sleeping){ last[p.id]={x:p.x,y:p.y,t:w.pixelTicks,k:p.task&&p.task.k}; continue; }
     if(w.pixelTicks-L.t>300 && !seen[p.id+':'+L.t] && p.task && ['drink','eat','chop','build','mine','farm','deposit','warm'].includes(p.task.k)){ seen[p.id+':'+L.t]=1; rep++;
       const cell=(dx,dy)=>{const o=w.pixelMap[p.x+dx]&&w.pixelMap[p.x+dx][p.y+dy]; return o?o.element+(o.fac!==undefined?'#'+o.fac:''):'.';};
       console.log('STUCK t',w.pixelTicks,p.name,p.job,'at',p.x,p.y,'task',JSON.stringify(p.task,(k,v)=>(k==='src'||k==='px'||k==='base'||k==='rock'||k==='crop'||k==='o')?(v&&[v.x,v.y,v.element]):v).slice(0,200),'stk',p.stk,'det',p.detour,'fails',p.fails);
       console.log('   row-1:',[-2,-1,0,1,2].map(d=>cell(d,-1)).join(' '),'| row0:',[-2,-1,0,1,2].map(d=>cell(d,0)).join(' '),'| row+1:',[-2,-1,0,1,2].map(d=>cell(d,1)).join(' '));
     } } }
 console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
