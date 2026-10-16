'use strict';
// Browser-native ZIP writer. Uses ZIP32 "store" entries, no third-party library/WASM.
(function(){
const enc=new TextEncoder();
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}
const crc=(start,data)=>{let c=start;for(const b of data)c=table[(c^b)&255]^(c>>>8);return c>>>0;};
function u16(dv,o,n){dv.setUint16(o,n,true);}function u32(dv,o,n){dv.setUint32(o,n>>>0,true);}
function stamp(date=new Date()){
 const year=Math.max(1980,date.getFullYear());
 return {date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate(),time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>>1)};
}
class Zipper{
 constructor(){this.entries=[];}
 add(name,content){
  const bytes=typeof content==='string'?enc.encode(content):(content instanceof Uint8Array?content:new Uint8Array(content));
  this.addChunks(name,[bytes]);
 }
 addChunks(name,chunks){
  if(!name||name.includes('..')||name.startsWith('/'))throw Error('Nombre de ZIP inválido: '+name);
  let size=0,c=0xffffffff;
  for(const chunk of chunks){size+=chunk.byteLength;c=crc(c,chunk);}
  this.entries.push({name,chunks,size,checksum:(c^0xffffffff)>>>0});
 }
 async toBlob(){
  if(this.entries.length>65535)throw Error('Demasiados archivos para ZIP32');
  let offset=0,central=[],body=[],when=stamp();
  for(const entry of this.entries){
   const name=enc.encode(entry.name);
   if(entry.size>0xffffffff||offset>0xffffffff)throw Error('El ZIP supera el límite de 4 GiB');
   const local=new Uint8Array(30+name.length),h=new DataView(local.buffer);
   u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0x0800);u16(h,8,0);
   u16(h,10,when.time);u16(h,12,when.date);
   u32(h,14,entry.checksum);u32(h,18,entry.size);u32(h,22,entry.size);
   u16(h,26,name.length);u16(h,28,0);local.set(name,30);
   body.push(local,...entry.chunks);
   const cd=new Uint8Array(46+name.length),v=new DataView(cd.buffer);
   u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0800);u16(v,10,0);
   u16(v,12,when.time);u16(v,14,when.date);u32(v,16,entry.checksum);
   u32(v,20,entry.size);u32(v,24,entry.size);u16(v,28,name.length);u16(v,30,0);u16(v,32,0);
   u16(v,34,0);u16(v,36,0);u32(v,38,0);u32(v,42,offset);cd.set(name,46);
   central.push(cd);offset+=local.length+entry.size;
  }
  let cdSize=0;for(const c of central)cdSize+=c.length;
  if(offset+cdSize>0xffffffff)throw Error('ZIP demasiado grande');
  const end=new Uint8Array(22),dv=new DataView(end.buffer);
  u32(dv,0,0x06054b50);u16(dv,4,0);u16(dv,6,0);u16(dv,8,this.entries.length);u16(dv,10,this.entries.length);
  u32(dv,12,cdSize);u32(dv,16,offset);u16(dv,20,0);
  return new Blob([...body,...central,end],{type:'application/zip'});
 }
}
self.SitioGatoZip=Zipper;
})();
