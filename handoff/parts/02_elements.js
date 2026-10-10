
/* ======================================================================
   ELEMENTS: building blocks, stations, projectiles, crops
   ====================================================================== */
const ifEl = (n, fb) => (elements[n] ? n : fb);
function def(name, o) {
  o.category = o.category || "village";
  if (o.state === undefined) o.state = "solid";
  if (o.excludeRandom === undefined) o.excludeRandom = true;
  if (o.behavior === undefined && !o.tick) o.behavior = behaviors.WALL;
  elements[name] = o;
  return o;
}
const BLOCK_NAMES = ["hz_plank","hz_stone","hz_roof","hz_door","hz_gate","hz_palisade","hz_cloth"];

def("hz_plank", { color: ["#a67b47","#9c7040","#b08650"], behavior: behaviors.WALL, density: 600, hardness: 0.25,
  burn: 25, burnTime: 250, burnInto: ["ash","ash","fire"], tempHigh: 450, stateHigh: "ash", breakInto: ifEl("sawdust","ash"), bhp: 14, hzb: true,
  desc: "Wooden planks laid by villagers." });
def("hz_stone", { color: ["#8a8d92","#7d8085","#94979c"], behavior: behaviors.WALL, density: 2400, hardness: 0.55,
  tempHigh: 1200, stateHigh: ifEl("magma","molten_slag"), breakInto: ifEl("gravel","rock"), bhp: 45, hzb: true });
def("hz_roof", { color: ["#a8452f","#9a3b28","#b1503a"], behavior: behaviors.WALL, density: 900, hardness: 0.2,
  burn: 12, burnTime: 220, burnInto: "ash", tempHigh: 500, stateHigh: "ash", breakInto: ifEl("brick_rubble", ifEl("clay_soil","dirt")), bhp: 10, hzb: true });
def("hz_cloth", { color: ["#d8cdb0","#cfc3a3","#e0d6bb"], behavior: behaviors.WALL, density: 200, hardness: 0.05,
  burn: 70, burnTime: 80, burnInto: "ash", tempHigh: 300, stateHigh: "ash", bhp: 4, hzb: true, forceSaveColor: true });
def("hz_door", { color: ["#6b4a2b","#5e4025"], behavior: behaviors.WALL, density: 500, hardness: 0.2,
  burn: 20, burnTime: 200, burnInto: "ash", breakInto: ifEl("sawdust","ash"), bhp: 12, hzb: true, door: true, forceSaveColor: true });
def("hz_gate", { color: ["#4a3a2a","#54402d"], behavior: behaviors.WALL, density: 1200, hardness: 0.45,
  burn: 8, burnTime: 300, burnInto: "ash", bhp: 28, hzb: true, door: true, forceSaveColor: true });
// packed earth: building foundations and levelled door approaches (does not crumble like dirt, grass cannot grow on it)
def("hz_earth", { color: ["#7a5a3a","#6f5234","#836141"], behavior: behaviors.WALL, density: 1600, hardness: 0.3, fdn: true, hidden: true,
  breakInto: "dirt", tempHigh: 1200, stateHigh: ifEl("magma","dirt"), desc: "Packed earth laid as a foundation by villagers." });
def("hz_palisade", { color: ["#8a6a3f","#7c5e37","#94744a"], behavior: behaviors.WALL, density: 650, hardness: 0.3,
  burn: 25, burnTime: 250, burnInto: "ash", breakInto: ifEl("sawdust","ash"), bhp: 20, hzb: true });

// ---- stations (function buildings). `st` is the station type used by the AI.
function station(name, stype, o) {
  o.st = stype; o.hzb = true; o.bhp = o.bhp || 20; o.forceSaveColor = true;
  if (!o.behavior && !o.tick) o.behavior = behaviors.WALL;
  return def(name, o);
}
station("hz_bed", "bed", { color: ["#e9dcc0","#d9c7a0"], density: 300, burn: 40, burnTime: 150, burnInto: "ash", hardness: 0.05, bhp: 6,
  hoverStat: (p) => p.owner ? "owner: " + p.owner : "free" });
station("hz_cot", "cot", { color: ["#ffffff","#f0f0f0"], density: 300, burn: 40, burnTime: 150, burnInto: "ash", hardness: 0.05, bhp: 6 });
station("hz_hearth", "hearth", { color: ["#e0661a","#ff9a2e","#c94d0e"], density: 1000, hardness: 0.3, temp: 55, bhp: 20,
  tick: (p) => { if (pixelTicks % 7 === 0) { p.temp = 55; p.color = pick(["#e0661a","#ff9a2e","#c94d0e","#ffb347"]); } doHeat(p); } });
station("hz_campfire", "campfire", { color: ["#ff8c1a","#ffb347","#e0661a"], density: 400, hardness: 0.1, temp: 60, bhp: 6,
  tick: (p) => { p.temp = 60; if (pixelTicks % 5 === 0) p.color = pick(["#ff8c1a","#ffb347","#e0661a","#ffd27a"]); doHeat(p);
    if (isEmpty(p.x, p.y - 1) && rnd() < 0.02) createPixel("smoke", p.x, p.y - 1); } });
station("hz_well", "well", { color: ["#4aa3df","#3b8fc7"], density: 1000, state: "solid", hardness: 0.4, bhp: 30, hazard: false,
  tick: (p) => { /* decorative shimmer */ if (pixelTicks % 11 === 0) p.color = pick(["#4aa3df","#3b8fc7","#5bb4ee"]); } });
station("hz_stall", "market", { color: ["#e8b84a","#d9a73a","#f0c85a"], density: 500, burn: 30, burnTime: 150, burnInto: "ash", hardness: 0.1, bhp: 8,
  hoverStat: (p) => "market" });
station("hz_banner", "hall", { color: "#3b82f6", density: 300, burn: 30, burnTime: 150, burnInto: "ash", hardness: 0.1, bhp: 10,
  hoverStat: (p) => (FAC[p.fac] ? FAC[p.fac].name + " banner" : "banner") });
station("hz_anvil", "forge", { color: ["#3f4247","#34373b"], density: 7800, hardness: 0.8, bhp: 60 });
station("hz_forgefire", "forgefire", { color: ["#ff6a00","#ffa31a","#ff3b00"], density: 800, hardness: 0.4, temp: 130, bhp: 25,
  tick: (p) => { p.temp = 130; if (pixelTicks % 4 === 0) p.color = pick(["#ff6a00","#ffa31a","#ff3b00","#ffd24a"]); doHeat(p);
    if (isEmpty(p.x, p.y - 1) && rnd() < 0.03) createPixel("smoke", p.x, p.y - 1); } });
station("hz_oven", "oven", { color: ["#9b5a3c","#8a4e33"], density: 1500, hardness: 0.4, temp: 80, bhp: 25,
  tick: (p) => { p.temp = 80; doHeat(p); } });
station("hz_rack", "rack", { color: ["#6b6f78","#5a5e66"], density: 1200, hardness: 0.3, bhp: 15 });
station("hz_dummy", "dummy", { color: ["#c9a96b","#b99a5e"], density: 400, burn: 25, burnTime: 150, burnInto: "ash", hardness: 0.1, bhp: 10 });
station("hz_post", "post", { color: ["#7a5a36","#6c4f30"], density: 500, burn: 25, burnTime: 150, burnInto: "ash", hardness: 0.2, bhp: 14 });
station("hz_medcross", "hospital", { color: ["#ffffff","#f4f4f4"], density: 500, hardness: 0.1, bhp: 8 });
station("hz_scarecrow", "scarecrow", { color: ["#d9b44a","#c9a53e"], density: 200, burn: 50, burnTime: 100, burnInto: "ash", hardness: 0.05, bhp: 4 });
station("hz_mill", "mill", { color: ["#d8cfb6","#c8bfa6"], density: 600, burn: 20, burnTime: 200, burnInto: "ash", hardness: 0.2, bhp: 16 });
station("hz_chest", "chest", { color: ["#8a5a2b","#7a4e24"], density: 700, burn: 15, burnTime: 220, burnInto: "ash", hardness: 0.2, bhp: 16 });

def("hz_gravestone", { color: ["#9a9ea5","#8c9097"], behavior: behaviors.WALL, density: 2300, hardness: 0.5, bhp: 40, hzb: true, st: "grave", forceSaveColor: true,
  hoverStat: (p) => p.epitaph || "Here lies someone." });

// ---- cannon: loaded/fired by the war module
def("hz_cannon", { color: ["#2e3135","#25282b"], behavior: behaviors.WALL, density: 7000, hardness: 0.8, bhp: 50, hzb: true, st: "cannon", forceSaveColor: true,
  hoverStat: (p) => (FAC[p.fac] ? FAC[p.fac].name + " cannon " : "cannon ") + (p.ammo > 0 ? "(loaded)" : "(empty)"),
  tick: (p) => { try { cannonTick(p); } catch (e) { if (H2.cfg.verbose) console.error(e); } } });

// ---- crops
def("hz_crop", { color: "#5cae3a", density: 300, hardness: 0.02, burn: 60, burnTime: 80, burnInto: "ash", bhp: 2, forceSaveColor: true,
  behavior: behaviors.WALL, properties: { g: 0 },
  hoverStat: (p) => p.g >= 1 ? "ripe" : Math.floor(p.g * 100) + "%",
  tick: (p) => {
    doBurning(p);
    const b = at(p.x, p.y + 1);
    if (!b || !(b.element === "dirt" || b.element === "soil" || b.element === "mud" || b.element === "farmland" || b.element === "grass")) {
      if (!b) { if (!tryMove(p, p.x, p.y + 1)) {} } else if (kindOf(b) !== 2) { /* floating on water: ruin */ if (rnd() < 0.05) deletePixel(p.x, p.y); }
      else if (rnd() < 0.01) deletePixel(p.x, p.y);
      return;
    }
    if (p.g < 1) {
      let rate = 0.0007;
      if (p.temp < 5) rate *= 0.2; else if (p.temp > 40) rate *= 0.4;
      const w = at(p.x - 1, p.y + 0), w2 = at(p.x + 1, p.y);
      if ((w && w.element === "water") || (w2 && w2.element === "water") || (b.moist > 20)) rate *= 2;
      p.g = Math.min(1, p.g + rate);
      if (pixelTicks % 20 === 0) p.color = p.g < 0.35 ? "#6dbb43" : p.g < 0.7 ? "#9bc13a" : p.g < 1 ? "#d3b83a" : "#e6bf3c";
    }
  } });

// ---- forestry: villagers plant saplings that grow into modest trees made of ordinary wood + leaves
const TREE_SOIL = { dirt: 1, grass: 1, soil: 1, mud: 1, clay_soil: 1, mycelium: 1 };
def("hz_sapling", { color: ["#3f8f2a","#4a9e33"], behavior: behaviors.WALL, density: 300, hardness: 0.02, burn: 60, burnTime: 60, burnInto: "ash", bhp: 2,
  forceSaveColor: true, properties: { g: 0 }, desc: "A young tree planted by a woodcutter. Grows into a small tree.",
  hoverStat: (p) => "growing " + Math.floor((p.g || 0) * 100) + "%",
  tick: (p) => {
    doBurning(p); if (p.del) return;
    const b = at(p.x, p.y + 1);
    if (!b) { tryMove(p, p.x, p.y + 1); return; }
    if (!TREE_SOIL[b.element]) { if (rnd() < 0.002) deletePixel(p.x, p.y); return; }
    if (pixelTicks % 10 !== 0) return;
    p.g = (p.g || 0) + (p.temp < 3 || p.temp > 45 ? 0.0006 : 0.0035);
    if (p.g < 1) return;
    growTree(p);
  } });
function growTree(p) {
  const x = p.x, y = p.y, H = 4 + (x * 7 + y) % 3;
  for (let k = 0; k <= H + 2; k++) if (!inb(x, y - k) || (k > 0 && pixelMap[x][y - k])) { p.g = 0.9; return false; }   // no room yet
  changePixel(p, "wood", false);
  for (let k = 1; k <= H; k++) createPixel("wood", x, y - k);
  const top = y - H;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) {
    if (Math.abs(dx) + Math.abs(dy) > 2 || (!dx && !dy)) continue;
    const xx = x + dx, yy = top + dy; if (inb(xx, yy) && !pixelMap[xx][yy]) createPixel("plant", xx, yy);
  }
  if (inb(x, top - 1) && !pixelMap[x][top - 1]) createPixel("plant", x, top - 1);
  return true;
}

// ---- projectiles
def("hz_arrow", { color: "#6b5436", behavior: behaviors.WALL, density: 300, hardness: 0, bhp: 1, hidden: true, forceSaveColor: true,
  tick: (p) => { try { projectileTick(p, "arrow"); } catch (e) { deletePixel(p.x, p.y); } } });
def("hz_ball", { color: "#1f2124", behavior: behaviors.WALL, density: 7000, hardness: 0, bhp: 1, hidden: true, forceSaveColor: true,
  tick: (p) => { try { projectileTick(p, "ball"); } catch (e) { deletePixel(p.x, p.y); } } });
