const {JSDOM, VirtualConsole, requestInterceptor} = require('jsdom');
const intercept = requestInterceptor((req)=>{ const m=req.url.match(/^http:\/\/localhost\/mods\/(.+)$/); if(!m) return; for(const c of ['/home/claude/engine/src/mods/'+m[1],'/home/claude/'+m[1]]) if(fs.existsSync(c)) return new Response(fs.readFileSync(c),{headers:{'Content-Type':'application/javascript'}}); console.log('MISSING MOD',m[1]); return new Response('',{status:404}); });
const fs = require('fs');
const path = require('path');
async function boot(modFiles=[], opts={}) {
  const html = fs.readFileSync('/home/claude/engine/src/index.html','utf8')
    // drop external scripts and ads
    .replace(/<script async src="https:\/\/www\.googletagmanager[^>]*><\/script>/g,'');
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => errors.push('JSDOM: '+(e.detail&&e.detail.stack||e.message)));
  vc.on('error', (...a)=> errors.push('console.error: '+a.join(' ')));
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts:'dangerously', resources:{interceptors:[intercept]}, pretendToBeVisual:true, virtualConsole: vc,
    beforeParse(w){
      const ctxProxy = () => new Proxy(function(){}, {get:(t,p)=> p==='canvas'?{width:100,height:100}: (p==='measureText'?()=>({width:10}):(p==='createLinearGradient'?()=>({addColorStop(){}}):(p==='getImageData'?()=>({data:new Uint8ClampedArray(4)}):()=>{}))), set:()=>true});
      w.HTMLCanvasElement.prototype.getContext = function(){ return ctxProxy(); };
      w.matchMedia = w.matchMedia || (()=>({matches:false,addListener(){},addEventListener(){}}));
      w.requestAnimationFrame = ()=>0;
      w.AudioContext = function(){};
      w.localStorage.setItem && 0;
      w.alert=()=>{}; w.prompt=()=>null; w.confirm=()=>true;
      w.scrollTo=()=>{};
      w.eval0 = w.eval; w.structuredClone = (o)=>JSON.parse(JSON.stringify(o));
      if(modFiles.length) w.localStorage.setItem('enabledMods', JSON.stringify(modFiles.map(f=>'mods/'+f)));
    }
  });
  const w = dom.window;
  await new Promise(r=>setTimeout(r,opts.wait||2500));
  return {dom, w, errors};
}
module.exports = {boot};
if (require.main===module) {
  boot().then(({w,errors})=>{
    console.log('errors:', errors.slice(0,8));
    console.log('elements:', Object.keys(w.elements||{}).length, 'width/height', w.width, w.height);
    console.log(typeof w.createPixel, typeof w.tryMove, typeof w.explodeAt, typeof w.runAfterLoad, typeof w.doElectricity);
    process.exit(0);
  });
}
