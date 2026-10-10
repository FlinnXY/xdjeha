// Test for 08_trade.js + 09_events.js : run with
//   SANDBOXELS_SRC=/tmp/engine/src node t_events.js
const { setup, terrain } = require('./sim');

(async () => {
  const r = await setup();
  const w = r.w, H2 = w.H2;
  terrain(r);
  w.paused = false; w.manualPaused = false;

  const log = (...a) => console.log(...a);
  const towns = () => H2.cols.filter(c => !c.nomad && c.pop > 0);
  const chronTail = (n) => H2.chron.slice(-n).map(e => (e.major ? '* ' : '  ') + 'd' + e.day + ' ' + e.text);
  const nomads = (k) => H2.people.filter(p => p.nomad === k && !p.dead && !p.del);

  // ---- establish two villages -------------------------------------------
  r.put('hz_azure_party', 20, 40);
  r.put('hz_crimson_party', 135, 40);
  log('booting villages...');
  r.run(3000);
  let ts = towns();
  log('after 3000t, towns:', ts.map(c => c.name + ' fac' + c.fac + ' pop' + c.pop + ' hall' + (c.hall ? 'Y' : 'N')).join(' | '));
  if (ts.length < 2) { r.run(2500); ts = towns(); log('after 5500t, towns:', ts.map(c => c.name + ' pop' + c.pop + ' hall' + (c.hall ? 'Y' : 'N')).join(' | ')); }

  const A = ts[0], B = ts[1] || ts[0];

  // ===================== TRADE ==========================================
  log('\n=== TRADE ===');
  // create a strong surplus/shortage so a caravan is worthwhile
  A.stock.wood = 260; A.stock.stone = 180; A.stock.coin = 300;
  B.stock.wood = 0; B.stock.stone = 2; B.stock.coin = 300; B.stock.bread = 80; B.stock.grain = 60;
  A.stock.bread = 4; A.stock.grain = 2;                       // A is short of food -> should buy
  // make merchants out of two adults in A and let jobThink drive them
  const adultsA = H2.people.filter(p => p.col === A.id && !p.dead && !p.nomad && w.H2.stageOf(p) === 'adult');
  let madeMerch = 0;
  for (const p of adultsA) { if (madeMerch >= 2) break; H2.setJob(p, 'merchant'); p.lastTrade = undefined; madeMerch++; }
  log('merchants made in ' + A.name + ':', madeMerch);
  const m0 = adultsA[0];
  if (m0) log('shouldTrade(merchant,' + A.name + ') =', H2.shouldTrade(m0, A));
  const routes0 = H2.trade.routes.length;
  r.run(4000);
  log('trade.stats:', JSON.stringify(H2.trade.stats));
  log('trade.routes (+' + (H2.trade.routes.length - routes0) + '):', H2.trade.routes.slice(-4).map(x => x.from + '->' + x.to + ' s' + x.sold + ' b' + x.bought + ' coin' + x.coin).join(' | '));
  log('trade.pairs:', JSON.stringify(H2.trade.pairs));
  log('tensionPts A/B:', Math.round(A.tensionPts || 0), Math.round(B.tensionPts || 0));

  // ===================== FESTIVAL =======================================
  log('\n=== FESTIVAL ===');
  const moodBefore = Math.round(A.avgMood || 0);
  const okF = H2.events.trigger('festival', A.x);
  log('trigger festival:', okF, 'A.festival set:', A.festival > w.pixelTicks);
  const festTasks = () => H2.people.filter(p => p.task && p.task.k === 'festival').length;
  r.run(120);
  log('festival-goers:', festTasks());
  r.run(900);
  log('mood A before/after festival:', moodBefore, '->', Math.round(A.avgMood || 0));

  // ===================== WANDERING TRADER ===============================
  log('\n=== WANDERING TRADER ===');
  const okT = H2.events.trigger('trader');
  let maxTraders = 0;
  for (let i = 0; i < 20; i++) { r.run(300); maxTraders = Math.max(maxTraders, nomads('trader').length); }
  log('trigger trader:', okT, 'maxTradersSeen:', maxTraders, 'tradersNow:', nomads('trader').length,
      'traderEvents:', H2.events.last.filter(e => e.name === 'trader').length);

  // ===================== BANDIT RAID ====================================
  log('\n=== BANDIT RAID ===');
  const tgt = towns().sort((a, b) => b.pop - a.pop)[0];
  // give the town some defenders so the fight is real
  const defs = H2.people.filter(p => p.col === tgt.id && !p.dead && !p.nomad && w.H2.stageOf(p) === 'adult').slice(0, 5);
  for (const p of defs) { H2.setJob(p, 'soldier'); p.wpn = 'sword'; p.sk.fight = 6; p.hp = 100; }
  log('defenders in ' + tgt.name + ':', defs.length);
  const okB = H2.events.trigger('bandits', tgt.x);
  let maxBandits = 0, retreatSeen = false;
  for (let i = 0; i < 30; i++) {
    r.run(200);
    maxBandits = Math.max(maxBandits, nomads('bandit').length);
    const raidIds = H2._raids ? Object.keys(H2._raids) : [];
    if (raidIds.some(id => H2._raids[id].retreat)) retreatSeen = true;
    if (nomads('bandit').length === 0 && i > 3) break;
  }
  const heroes = H2.people.filter(p => (p.log || []).some(e => /Fought off bandits/.test(e.text)));
  log('trigger bandits:', okB, 'maxBanditsSeen:', maxBandits, 'banditsNow:', nomads('bandit').length,
      'retreatSeen:', retreatSeen, 'heroes(FoughtOffBandits):', heroes.length);

  // ===================== PLAGUE =========================================
  log('\n=== PLAGUE ===');
  const sickBefore = H2.people.filter(p => p.sick).length;
  const okP = H2.events.trigger('plague', tgt.x);
  r.run(60);
  const sickAfter = H2.people.filter(p => p.sick && p.sick.k === 'plague').length;
  log('trigger plague:', okP, 'plague-sick before/after:', sickBefore, '->', sickAfter);

  // ===================== GOD-EVENT SPAWNER ELEMENTS =====================
  log('\n=== GOD-EVENT ELEMENTS ===');
  const placeAt = (el, x) => {
    const gy = w.groundY ? w.groundY(x, 2, w.height - 3) : 40;
    const yy = Math.max(2, gy - 1);
    const before = H2.events.last.length;
    r.put(el, x, yy);
    const cleared = !w.pixelMap[x][yy] || w.pixelMap[x][yy].element !== el;
    return { el, placed: true, pixelCleared: cleared, eventLogged: H2.events.last.length > before };
  };
  const t2 = towns();
  for (const [el, x] of [['hz_event_festival', t2[0].x], ['hz_event_trader', t2[0].x + 4],
                         ['hz_event_bandits', (t2[1] || t2[0]).x], ['hz_event_plague', t2[0].x]]) {
    const res = placeAt(el, x);
    log(el, '-> pixelCleared:', res.pixelCleared, 'eventLogged:', res.eventLogged);
    r.run(400);
  }
  r.run(2500);   // let the element-spawned events resolve

  // ===================== WRAP UP ========================================
  log('\n=== CHRONICLE TAIL ===');
  chronTail(16).forEach(l => log(l));
  log('\nevents.last:', H2.events.last.map(e => e.name + '@d' + e.day).join(', '));
  log('nomad colonies remaining:', H2.cols.filter(c => c.nomad).length,
      '| live towns:', towns().length,
      '| people:', H2.people.length);

  const errs = r.errors.filter(e => !/style\.css|adsbygoogle/.test(e));
  log('\nLASTERR:', H2.lastError ? String(H2.lastError.stack || H2.lastError).slice(0, 500) : null);
  log('ERR count:', errs.length);
  if (errs.length) errs.slice(0, 6).forEach(e => log('  ', e));

  const ok = !H2.lastError && errs.length === 0;
  log(ok ? '\nEVENTS_OK' : '\nEVENTS_FAIL');
  process.exit(0);
})().catch(e => { console.log('THROWN', e && e.stack); process.exit(1); });
