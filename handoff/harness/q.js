const {boot}=require('./boot');
boot().then(({w})=>{
  const names=process.argv.slice(2);
  const E=w.elements;
  const out={};
  const cands="wheat_seed wheat dirt rock gravel limestone basalt granite marble slate brick concrete glass iron steel copper gold silver tin lead bronze brass zinc coal charcoal sulfur saltpeter gunpowder wood tree_branch branchless_tree plant sapling grass grass_seed flower_seed potato_seed corn_seed pumpkin_seed egg flour bread dough meat cooked_meat rotten_meat frozen_meat bone blood fish bird rat frog snail slug ant bee worm firefly fly cloth wool sheep cow chicken torch lamp light_bulb ladder rope water salt_water dirty_water ice snow mud sand wet_sand clay clay_soil mud clay_soil hay straw cellulose sawdust paper cheese milk beer wine alcohol juice soda tea coffee honey sugar cake cookie coconut apple orange lemon strawberry blueberry carrot potato tomato corn lettuce pumpkin watermelon grape mushroom_cap mushroom_spore nut nut_meat popcorn  pickle yolk batter butter melted_butter hard_yolk tnt dynamite bomb nuke c4 napalm fire smoke steam ash explosion plasma lava magma molten_iron radiation fallout rad_steam poison cyanide infection plague antidote cancer cell antibody soap bleach acid neutral_acid vinegar ammonia chlorine fluorine bromine uranium plutonium thorium radium head body human firework flash spray_paint paint glue gold_coin silver_coin metal_scrap pipe wall steel_plate door window flower_petal petal pistil seed root vine evergreen pine_tree pinecone fiber leaf dead_plant rock_wall oil gasoline diesel methane hydrogen oxygen carbon_dioxide".split(/\s+/);
  const has={};
  for(const n of cands) if(E[n]) has[n]=[E[n].category||'',E[n].state||'',E[n].behavior?'beh':'',E[n].tick?'tick':''].join('|');
  const missing=cands.filter(n=>!E[n]);
  console.log('HAS',JSON.stringify(has));
  console.log('MISSING',missing.join(' '));
  for(const n of ['wheat_seed','wheat','head','body','human','tree_branch','plant','sapling','fire','ash']) if(E[n]){ const e=E[n]; console.log('---',n, JSON.stringify({color:e.color,beh:e.behavior,state:e.state,density:e.density,tempHigh:e.tempHigh,stateHigh:e.stateHigh,burn:e.burn, hardness:e.hardness, reactions: e.reactions&&Object.keys(e.reactions).slice(0,12), tick:e.tick&&e.tick.toString().slice(0,600)})); }
  process.exit(0);
});
