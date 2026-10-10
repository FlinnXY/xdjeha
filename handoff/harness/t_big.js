// Growth on a large map (like Sandboxels' "large" canvas setting): two parties far apart, many trees, a lake in the middle.
// Usage: node t_big.js [ticks] [width]
const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w;
 const W=+process.argv[3]||450;
 w.width=W-1; w.height=99; w.clearAll();
 const trees=[]; for(let x=8;x<W-8;x+=13+(x%7)) trees.push(x);
 const mid=Math.round(W/2);
 terrain(r,{lake:[mid-10,mid+10],trees});
 r.put('hz_azure_party',40,40); r.put('hz_crimson_party',W-40,40);
 const H2=w.H2; const N=+process.argv[2]||24000;
 for(let t=0;t<N;t+=1000){ r.run(1000);
   const facs=[0,1].map(f=>H2.cols.filter(c=>c.fac===f&&!c.nomad));
   console.log(w.pixelTicks, facs.map((cs,f)=>'F'+f+' pop'+cs.reduce((n,c)=>n+c.pop,0)+' ['+cs.map(c=>c.name+':'+c.pop+' b'+c.beds+' w'+(c.stock.wood|0)+' s'+(c.stock.stone|0)+' f'+((c.stock.bread+c.stock.grain*0.5)|0)+' '+c.war.state).join(', ')+']').join(' | '));
   for(const e of H2.chron.slice(-40)) if(/died|abandon|founded|settlers|elect/.test(e.text) && e.t>w.pixelTicks-1000) console.log('   *',e.text);
 }
 console.log('LASTERR', H2.lastError ? String(H2.lastError.stack).slice(0,400) : null);
 console.log('ERR',r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,6));
 process.exit(0);
})();
