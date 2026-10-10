const {boot}=require('./boot');
(async()=>{ const {w}=await boot([]); for (const n of ['dirt','rock','grass','sand','water','wood','plant','brick']) console.log(n, w.elements[n].state, w.elements[n].category, w.elements[n].movable, w.elements[n].density); process.exit(0)})();
