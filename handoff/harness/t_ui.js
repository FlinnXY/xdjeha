// UI / UX layer test for Humanitize 2.
// Boots the sim, grows a world, then drives H2.ui.* and asserts the DOM.
// Run: cd handoff/harness && SANDBOXELS_SRC=/tmp/engine/src node t_ui.js
const { setup, terrain } = require('./sim');

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }

(async () => {
  const r = await setup(); const w = r.w;
  terrain(r);
  w.paused = false; w.manualPaused = false;

  // place two settler bands
  r.put('hz_azure_party', 20, 40);
  r.put('hz_crimson_party', 135, 40);

  // grow the world
  r.run(600);

  const H2 = w.H2;
  assert(H2 && H2.ui, 'H2.ui must exist');
  const UI = H2.ui;

  // the inspector tool element must be registered and must not place pixels
  assert(w.elements.hz_inspect, 'hz_inspect tool element registered');
  assert(w.elements.hz_inspect.canPlace === false, 'hz_inspect must not place pixels');
  assert(typeof w.elements.hz_inspect.tool === 'function', 'hz_inspect has a tool function');

  // make sure UI built its DOM
  UI.open('hud');
  assert(w.document.getElementById('h2-root'), 'h2-root injected');
  assert(w.document.getElementById('h2-style'), 'h2-style injected');

  // find a living person to inspect
  let person = (H2.people || []).find(p => !p.dead && p.id !== undefined);
  assert(person, 'at least one living person exists after 600 ticks');

  // add a few fake life-story entries to verify the timeline renders
  person.life = person.life || [];
  person.life.push({ t: w.pixelTicks, day: 1, text: 'Was born on a bright morning.', k: 'birth', big: 1 });
  person.life.push({ t: w.pixelTicks, day: 2, text: 'Took up the trade of farming.', k: 'job' });
  person.life.push({ t: w.pixelTicks, day: 3, text: 'Became a celebrated hero of the realm.', k: 'hero', big: 1 });

  // select via the inspector API
  const ok = UI.select(person);
  assert(ok, 'UI.select returned true');
  assert(UI.selId === person.id, 'selected id matches');

  const insp = w.document.getElementById('h2-inspector');
  assert(insp && insp.style.display !== 'none', 'inspector panel is open');
  let itext = insp.textContent;
  assert(itext.indexOf(person.first) !== -1, 'inspector shows person name (' + person.first + ')');
  assert(itext.indexOf('Life story') !== -1, 'inspector shows Life story section');
  assert(itext.indexOf('celebrated hero') !== -1, 'inspector shows fake life-story entry');
  assert(itext.indexOf('Condition') !== -1, 'inspector shows condition bars');

  // open every panel and verify content
  assert(UI.open('dashboard'), 'open dashboard');
  const dash = w.document.getElementById('h2-dashboard');
  const dtext = dash.textContent;
  assert(dtext.indexOf('Azure') !== -1 && dtext.indexOf('Crimson') !== -1, 'dashboard lists both factions');
  // settlement names
  const colNames = (H2.cols || []).map(c => c.name).filter(Boolean);
  assert(colNames.length > 0, 'at least one settlement exists');
  const sawCol = colNames.some(n => dtext.indexOf(n) !== -1);
  assert(sawCol, 'dashboard shows a settlement name (' + colNames.join(',') + ')');

  assert(UI.open('chronicle'), 'open chronicle');
  const chr = w.document.getElementById('h2-chronicle');
  assert((H2.chron || []).length > 0, 'chronicle has entries');
  assert(chr.textContent.indexOf('Day') !== -1, 'chronicle panel shows day-stamped entries');

  assert(UI.open('settings'), 'open settings');
  const setp = w.document.getElementById('h2-settings');
  assert(setp.textContent.indexOf('names') !== -1 || setp.textContent.toLowerCase().indexOf('name') !== -1, 'settings shows names control');

  assert(UI.open('help'), 'open help');
  const help = w.document.getElementById('h2-help');
  const htext = help.textContent;
  assert(htext.indexOf('azure_party') !== -1 && htext.indexOf('crimson_party') !== -1, 'help mentions the party elements');
  assert(htext.indexOf('nekonico') !== -1, 'help credits nekonico');

  // chronicle refresh hook works
  assert(typeof H2.refreshChronicle === 'function', 'H2.refreshChronicle defined');
  H2.chronicle && H2.chronicle('A test chronicle event occurs.', true, 0);
  UI._lastChron = 0; // bypass throttle
  H2.refreshChronicle();
  assert(chr.textContent.indexOf('test chronicle event') !== -1, 'refreshChronicle shows new entry');

  // toggle a setting and check it persists to localStorage
  H2.cfg.events = true;
  // simulate clicking the events toggle via API
  H2.cfg.events = !H2.cfg.events;
  H2.cfg.names = 'always';
  // trigger a save through the change handler path
  const sel = setp.querySelector('[data-names]');
  assert(sel, 'names <select> present');
  sel.value = 'always';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  const stored = JSON.parse(w.localStorage.getItem('H2.settings') || '{}');
  assert(stored.names === 'always', 'localStorage persisted names=always');
  assert(H2.cfg.nameMode === 'always', 'nameMode synced to always');

  // numeric setting clamp + persist
  const numInput = setp.querySelector('[data-num="maxPerFaction"]');
  assert(numInput, 'maxPerFaction input present');
  numInput.value = '999';
  numInput.dispatchEvent(new w.Event('change', { bubbles: true }));
  const stored2 = JSON.parse(w.localStorage.getItem('H2.settings') || '{}');
  assert(stored2.maxPerFaction === 500, 'maxPerFaction clamped to 500 and persisted');

  // family navigation: pick someone with a spouse or child, click the link
  let withFam = (H2.people || []).find(p => !p.dead && (p.sp || (p.kids && p.kids.length) || (p.par && p.par.some(x => x))));
  if (withFam) {
    UI.select(withFam);
    const link = insp.querySelector('[data-pid]');
    if (link) {
      const beforeId = UI.selId;
      link.dispatchEvent(new w.Event('click', { bubbles: true }));
      assert(UI.selId !== null, 'family link click keeps a valid selection');
    }
  }

  // outline overlay must not throw (headless ctx is a no-op proxy)
  let threw = false;
  try { w.renderPostPixelList && w.renderPostPixelList.forEach(fn => fn(w.ctx)); } catch (e) { threw = true; console.error(e); }
  assert(!threw, 'renderPostPixel overlay does not throw in headless');

  // run more ticks with panels open to exercise live refresh + history sampling
  r.run(400);
  assert(UI.hist[0].length > 0 || UI.hist[1].length > 0, 'population history sampled');

  // close via Escape
  UI.open('help');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  assert(w.document.getElementById('h2-help').style.display === 'none', 'Escape closed the help panel');

  // no Humanitize2 errors (ignore ad/style load noise)
  const errs = r.errors.filter(e => !/style\.css|adsbygoogle|googlesyndication|googletag/.test(e));
  if (errs.length) { console.error('ERRORS:', errs.slice(0, 8)); }
  assert(errs.length === 0, 'no runtime errors from Humanitize2');

  console.log('panels built:', Object.keys(UI.panels).join(', '));
  console.log('settlements:', colNames.join(', '));
  console.log('chronicle entries:', (H2.chron || []).length);
  console.log('UI_OK');
  process.exit(0);
})().catch(e => { console.error('EXC', e); process.exit(1); });
