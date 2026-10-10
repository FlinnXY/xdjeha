const { setup, terrain } = require('./sim');
(async () => {
  const r = await setup(); const w = r.w, H2 = w.H2; terrain(r);
  w.paused=false;w.manualPaused=false;
  r.put('hz_azure_party',20,40); r.put('hz_crimson_party',135,40);
  r.run(3000);
  H2.cfg.war=false; H2.cfg.verbose=false;
  const towns=()=>H2.cols.filter(c=>!c.nomad&&c.pop>0);
  const peace=()=>{H2.war.on=false;for(const c of H2.cols){c.tensionPts=0;c.tension=0;if(c.war)c.war.state='peace';}};
  peace();
  const ts=towns(); const A=ts[0], B=ts[1];
  A.stock.wood=260;A.stock.coin=300;B.stock.wood=0;B.stock.coin=300;B.stock.bread=80;B.stock.grain=60;A.stock.bread=4;
  console.log('A',A.name,A.x,'hall',JSON.stringify(A.hall),'| B',B.name,B.x,'hall',JSON.stringify(B.hall));
  const groundAt=(x)=>{for(let y=2;y<w.height-1;y++){const px=w.pixelMap[x]&&w.pixelMap[x][y];if(px&&px.element!=='water')return y-1;}return 40;};
  r.put('hz_stall',(A.hall?A.hall.x:A.x)+2,Math.max(2,groundAt((A.hall?A.hall.x:A.x))-1));
  r.run(120);
  const p=H2.people.find(q=>q.col===A.id&&!q.dead&&!q.nomad&&H2.stageOf(q)==='adult');
  H2.setJob(p,'merchant'); p._tpid=B.id; H2.setTask(p,'trade',{},55);
  console.log('merchant',p.id,'at',p.x,p.y);
  for(let i=0;i<40;i++){ peace(); if(p.dead){console.log('merchant died');break;} if(!p.task||p.task.k!=='trade'){p._tpid=B.id;H2.setTask(p,'trade',{},55);} r.run(150);
    const cv=p.caravan; console.log('t'+w.pixelTicks,'x'+p.x,'task:'+(p.task&&p.task.k),'cv:'+(cv?('ph'+cv.phase+' f'+(cv.f||0)+' sold'+cv.sold):'none'),'routes'+H2.trade.routes.length); }
  console.log('STATS',JSON.stringify(H2.trade.stats),'routes',H2.trade.routes.length);
  process.exit(0);
})();
