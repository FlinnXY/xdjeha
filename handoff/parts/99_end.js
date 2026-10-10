
/* ======================================================================
   REGISTRATION & MAIN LOOP
   ====================================================================== */
function doorsTick() {
  const d = H2.doors; if (!d.length) return;
  for (let i = d.length - 1; i >= 0; i--) {
    const r = d[i];
    if (pixelTicks < r.t) continue;
    if (!inb(r.x, r.y)) { d.splice(i, 1); continue; }
    if (!pixelMap[r.x][r.y]) { createPixel(r.el, r.x, r.y); const n = pixelMap[r.x][r.y]; if (n) { n.fac = r.fac; n.hzb2 = 1; if (r.ay !== undefined) n.ay = r.ay; if (r.color) n.color = r.color; if (r.hp !== undefined) n.hp = r.hp; } d.splice(i, 1); }
    else { r.t = pixelTicks + 8; r.w = (r.w || 0) + 1; if (r.w > 60) d.splice(i, 1); }
  }
}
runEveryTick(function () {
  try {
    if (pixelTicks % 5 === 0) census(pixelTicks % 30 === 0);
    doorsTick();
    runColonies();
    if (pixelTicks % 90 === 45) worldWarCheck();
    if (H2.everyTick) H2.everyTick();
  } catch (e) { if (H2.cfg.verbose) console.error("[Humanitize2]", e); H2.lastError = e; }
});
runAfterReset(function () {
  H2.cols = []; H2.people = []; H2.byId = {}; H2.st = {}; H2.doors = []; H2.corpses = []; H2.crops = []; H2.idSeq = 1; H2.colSeq = 1; H2.chron = [];
  H2.stats = { births: 0, deaths: 0, battles: 0 };
  try { H2.refreshChronicle && H2.refreshChronicle(); } catch (e) {}
});
runAfterLoad(function () { buildFoodTable(); });
console.log("[Humanitize2] v" + H2.version + " loaded");
})();
