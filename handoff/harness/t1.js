const {boot}=require('./boot');
boot(['weapons.js','human_friendly_design.js','chem.js']).then(({w,errors})=>{
 console.log(errors.slice(0,5), Object.keys(w.elements).length, w.loadedMods);
 console.log(typeof w.tickPixels, typeof w.mainTick, typeof w.currentPixels);
 process.exit(0)});
