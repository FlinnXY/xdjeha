// War end-to-end: two grown villages are pushed into war; checks attack -> fighting -> victory/retreat, army systems, elections, life stories.
const {setup,terrain}=require('./sim');
(async()=>{
 const r=await setup(); const w=r.w; terrain(r);
 w.paused=false;w.manualPaused=false;
 r.put('hz_azure_party',20,40); r.put('hz_crimson_party',135,40);
 r.run(2600);
 const H2=w.H2; const A=H2.cols.find(c=>c.fac===0), C=H2.cols.find(c=>c.fac===1);
 if(!A||!C){console.log('FAIL no colonies');process.exit(1);}
 const arm=(c,n,wpn)=>{ for(let i=0;i<n;i++){ const x=Math.max(3,Math.min(w.width-3,c.x+(i-n/2)*2)); const gy=H2.groundY(x,Math.max(0,c.y-15),40); if(gy<2) continue; const p=H2.spawnPerson(x,gy,c.fac,{job:'soldier',col:c.id}); if(p){ p.wpn=i%3===0?'bow':wpn; p.arm=1; p.rng=i%3===0; p.xp=i*9; } } };
 arm(A,14,'sword'); arm(C,7,'spear');
 A.stock.powder=10; A.stock.cannon=1; A.stock.coin+=50;
 for(const [c,o] of [[A,C],[C,A]]){ c.intel.enemy={x:o.x,y:o.y,t:w.pixelTicks,firstT:w.pixelTicks,fac:o.fac,known:true,sold:7,cannons:0,walls:0,towers:0,beds:0,hall:!!o.hall,hx:o.hall?o.hall.x:o.x,hy:o.hall?o.hall.y:o.y,forge:false,people:o.pop,rep:3}; c.tensionPts=100; }
 A.aggr=0.95; C.aggr=0.2;
 H2.setWarState(A,'prepare'); A.war.since=w.pixelTicks-3*2400;
 const states=new Set(); let shown=H2.chron.length;
 for(let t=0;t<9000;t+=300){ r.run(300);
   states.add(A.war.state); states.add('C:'+C.war.state);
   console.log(w.pixelTicks,'A',A.war.state,A.pop,(A.army||{}).strategy,'morale',(A.army||{}).morale,'| C',C.war.state,C.pop,(C.army||{}).strategy,'war',H2.war.on,'battles',H2.stats.battles);
   while(shown<H2.chron.length){ const e=H2.chron[shown++]; if(e.major) console.log('   *',e.text); }
 }
 const lives=H2.people.filter(p=>p.life&&p.life.length>2).length;
 const ranks=H2.people.filter(p=>p.rank>0).map(p=>H2.rankName(p)+' '+p.name).slice(0,6);
 console.log('states',[...states].join(','),'leaders',A.leaderTitle,H2.byId[A.leader]&&H2.byId[A.leader].name,C.leaderTitle,'squads',(A.army.squads||[]).map(s=>s.name+':'+s.role+':'+s.members.length).join(' '),'ranks',ranks.join(', '),'lives>2',lives);
 const ex=H2.people.find(p=>p.life&&p.life.length>3); if(ex) console.log('LIFE of',ex.name, ex.life.map(e=>'d'+e.day+' '+e.text).join(' | '));
 console.log('LASTERR', H2.lastError ? String(H2.lastError.stack).slice(0,500) : null);
 const errs=r.errors.filter(e=>!/style.css|adsbygoogle/.test(e));
 console.log('ERR',errs.slice(0,6));
 const ok=states.has('attack') && H2.stats.battles>0 && A.leader && C.leader && !H2.lastError && !errs.length;
 console.log(ok?'WAR_OK':'WAR_FAIL'); process.exit(0);
})();
