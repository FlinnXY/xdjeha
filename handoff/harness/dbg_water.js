const { setup, terrain } = require('./sim');
(async () => {
  const r = await setup(); const w = r.w, H2 = w.H2;
  // flat ground y=60..82, with a water trench x60..70
  for(let x=0;x<=w.width;x++) for(let y=61;y<=w.height;y++){ let el='rock'; if(y===61)el='grass'; w.createPixel(el,x,y); }
  // carve trench and fill water
  for(let x=60;x<=70;x++){ for(let y=58;y<=63;y++){ const p=w.pixelMap[x]&&w.pixelMap[x][y]; if(p)w.deletePixel(x,y); } for(let y=60;y<=63;y++) w.createPixel('water',x,y); }
  w.paused=false;w.manualPaused=false;
  const b=H2.spawnPerson?null:null;
  // spawn via element
  w.createPixel('hz_body',20,60); w.createPixel('hz_head',20,59); H2.census && H2.census(true);
  r.run(5); const ppl=H2.people; console.log('people',ppl.length);
  const p=ppl[0]; if(!p){console.log('no person');process.exit(0);} 
  H2.setTask(p,'wander',{},1);
  // manually drive goTo to x=100 each tick
  let arrived=false;
  for(let i=0;i<600;i++){ const res=H2.goTo(p,100,60,2,4); if(i%40===0)console.log('i'+i,'x'+p.x,'y'+p.y,res); if(res==='arrive'){arrived=true;break;} if(p.dead){console.log('died');break;} w.tick(); }
  console.log('final x'+p.x,'arrived',arrived);
  process.exit(0);
})();
