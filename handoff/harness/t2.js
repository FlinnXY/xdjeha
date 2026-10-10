const {setup}=require('./sim');
(async()=>{
 const r=await setup();
 const w=r.w;
 console.log('load errors', r.errors.filter(e=>!/style.css|adsbygoogle/.test(e)).slice(0,5));
 console.log('has elems', !!w.elements.hz_body, !!w.elements.hz_azure_party, w.H2.version);
 r.ground(60);
 w.paused=false; w.manualPaused=false;
 r.put('hz_azure_party',30,50);
 r.put('hz_crimson_party',120,50);
 console.log('people after spawn', w.currentPixels.filter(p=>p.element==='hz_body').length);
 r.run(1500);
 const errs=r.errors.filter(e=>!/style.css|adsbygoogle/.test(e));
 console.log('errors', errs.slice(0,6));
 const P=w.H2.people; console.log('alive', P.length, 'cols', w.H2.cols.map(c=>c.name+':'+c.pop));
 console.log(P.slice(0,4).map(p=>[p.name,p.job,p.x,p.y,Math.round(p.hu),Math.round(p.th),p.task&&p.task.k].join(' ')));
 console.log('chron', w.H2.chron.map(c=>c.text));
 process.exit(0);
})();
