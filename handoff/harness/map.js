// ASCII map of a world region: people = A/C (azure/crimson body), h = head, k = child, buildings by first letter after hz_
const CH = { hz_plank:'=', hz_stone:'#', hz_roof:'^', hz_door:'D', hz_gate:'G', hz_palisade:'|', hz_cloth:'~', hz_bed:'b', hz_cot:'c', hz_hearth:'H', hz_campfire:'f',
  hz_well:'W', hz_stall:'$', hz_banner:'F', hz_anvil:'n', hz_forgefire:'x', hz_oven:'o', hz_rack:'r', hz_dummy:'y', hz_post:'P', hz_medcross:'+', hz_scarecrow:'s',
  hz_mill:'m', hz_chest:'C', hz_gravestone:'t', hz_cannon:'K', hz_crop:'"', hz_earth:'e', hz_arrow:'-', hz_ball:'o',
  dirt:':', grass:',', rock:'%', water:'w', wood:'T', plant:'*', sapling:'i', glass:'g', sand:'.', blood:'!', ash:'a', smoke:' ', fire:'^' };
function dump(w, x0, x1, y0, y1) {
  const out = [];
  for (let y = y0; y <= y1; y++) { let s = String(y).padStart(3) + ' ';
    for (let x = x0; x <= x1; x++) { const q = w.pixelMap[x] && w.pixelMap[x][y];
      if (!q) { s += ' '; continue; }
      if (q.element === 'hz_body') s += q.dead ? 'X' : (q.fac ? 'C' : 'A');
      else if (q.element === 'hz_head') s += 'h';
      else if (q.element === 'hz_child') s += 'k';
      else s += CH[q.element] || '?'; }
    out.push(s); }
  let ruler = '    '; for (let x = x0; x <= x1; x++) ruler += (x % 10 === 0) ? String((x / 10) % 10) : ' ';
  out.push(ruler);
  return out.join('\n');
}
module.exports = { dump };
