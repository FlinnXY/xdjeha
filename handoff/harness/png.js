// tiny PNG writer for visual checks of the world (no dependencies)
const zlib = require('zlib'), fs = require('fs');
function crc32(buf){ let c, crc=0xffffffff; for(let n=0;n<buf.length;n++){ c=(crc^buf[n])&0xff; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; crc=(crc>>>8)^c; } return (crc^0xffffffff)>>>0; }
function chunk(t,d){ const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const td=Buffer.concat([Buffer.from(t),d]); const c=Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l,td,c]); }
function parse(col){ if(!col) return [255,0,255]; let m=String(col).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if(m) return [+m[1],+m[2],+m[3]]; m=String(col).match(/^#?([0-9a-f]{6})$/i); if(m){ const h=m[1]; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; } return [255,0,255]; }
function snap(w, file, x0, x1, y0, y1, s, sky){
  s=s||6; sky=sky||[150,200,240];
  const W=(x1-x0+1)*s, H=(y1-y0+1)*s; const raw=Buffer.alloc((W*3+1)*H);
  for(let y=0;y<H;y++){ raw[y*(W*3+1)]=0; for(let x=0;x<W;x++){ const gx=x0+Math.floor(x/s), gy=y0+Math.floor(y/s); const col=w.pixelMap[gx]&&w.pixelMap[gx][gy]; const p=col&&!col.del?parse(col.color):sky; const o=y*(W*3+1)+1+x*3; raw[o]=p[0];raw[o+1]=p[1];raw[o+2]=p[2]; } }
  const ih=Buffer.alloc(13); ih.writeUInt32BE(W,0); ih.writeUInt32BE(H,4); ih[8]=8; ih[9]=2; ih[10]=0; ih[11]=0; ih[12]=0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',ih), chunk('IDAT',zlib.deflateSync(raw)), chunk('IEND',Buffer.alloc(0))]));
}
module.exports={snap};
