'use strict';
// Runs in a Chrome offscreen extension document: holds archive files and fetches public/static resources.
const textEncoder=new TextEncoder();
let archive=null;
let exportedUrl=null;
const validAsset=/\.(?:css|js|mjs|wasm|png|jpe?g|webp|svg|gif|avif|ico|woff2?|ttf|otf|mp4|webm|mp3)(?:$)/i;
const maxAssets=180;
const maxAssetSize=12*1024*1024;
const maxTotalAssets=85*1024*1024;
function cleanName(s){const out=String(s).replace(/[^a-z0-9._-]/gi,'_').slice(0,110);return out==='.'||out==='..'?'_':out;}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function resourcePath(u){
 const uri=new URL(u);
 let parts=uri.pathname.split('/').filter(Boolean).map(x=>cleanName(decodeURIComponent(x))||'_');
 if(!parts.length)parts=['index'];
 if(!/\.[a-z0-9]{1,7}$/i.test(parts.at(-1)))parts[parts.length-1]+='.bin';
 if(uri.search){const last=parts.pop();const pos=last.lastIndexOf('.');parts.push(last.slice(0,pos)+'--q'+hash(uri.search)+last.slice(pos));}
 return 'assets/'+parts.join('/');
}
function rel(from,to){
 const a=from.split('/');a.pop();const b=to.split('/');
 while(a.length&&b.length&&a[0]===b[0]){a.shift();b.shift();}
 return '../'.repeat(a.length)+b.join('/');
}
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function init(origin,includeAssets){
 if(exportedUrl){URL.revokeObjectURL(exportedUrl);exportedUrl=null;}
 archive={origin,includeAssets,pages:[],files:new Map(),pending:new Map(),resourceUrls:new Set(),assets:new Map(),errors:[],designs:new Map()};
}
function addPage(msg){
 const path='source/'+msg.key+'.html';
 archive.files.set(path,msg.html);
 if(msg.design)archive.designs.set(msg.key,msg.design);
 archive.pages.push({url:msg.url,finalUrl:msg.finalUrl,title:msg.title,key:msg.key,depth:msg.depth,mhtml:msg.mhtml,screenshot:msg.screenshot});
}
function addChunk(name,data){
 const pending=archive.pending.get(name);
 if(!pending)throw Error('No existe entrada MHTML: '+name);
 const bin=atob(data),out=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
 pending.push(out);
}
function rewriteCss(text,originalPath,assetMap){
 return text.replace(/url\(\s*(['"]?)([^)"']+)\1\s*\)/g,(full,quote,target)=>{
  try{const url=new URL(target,archive.origin).href;const hit=assetMap.get(url);return hit?`url("${rel(originalPath,hit.path)}")`:full;}catch{return full;}
 });
}
function getCssImports(css,base){
 const found=[];
 for(const m of css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)){
  try{const u=new URL(m[2],base);if(u.origin===archive.origin&&validAsset.test(u.pathname))found.push(u.href);}catch{}
 }
 for(const m of css.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)/g)){
  try{const u=new URL(m[1],base);if(u.origin===archive.origin&&validAsset.test(u.pathname))found.push(u.href);}catch{}
 }
 return found;
}
async function tryFetch(url){
 const controller=new AbortController();
 const t=setTimeout(()=>controller.abort(),6000);
 try{
  const response=await fetch(url,{signal:controller.signal,credentials:'include',cache:'default',redirect:'follow'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>maxAssetSize)throw Error('Archivo demasiado grande');
  if(!response.body){const buf=new Uint8Array(await response.arrayBuffer());if(buf.length>maxAssetSize)throw Error('Archivo demasiado grande');return {bytes:buf,type:response.headers.get('content-type')||''};}
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxAssetSize){await reader.cancel();throw Error('Archivo demasiado grande');}chunks.push(value);}
  const bytes=new Uint8Array(size);let n=0;for(const part of chunks){bytes.set(part,n);n+=part.byteLength;}
  return {bytes,type:response.headers.get('content-type')||''};
 }finally{clearTimeout(t);}
}
async function gatherAssets(){
 if(!archive.includeAssets)return;
 const queued=[...archive.resourceUrls].slice(0,maxAssets),seen=new Set(queued);
 let usedBytes=0;
 const deadline=performance.now()+55000; // Never stall ZIP creation on a broken CDN.
 for(let index=0;index<queued.length&&index<maxAssets;index++){
  if(performance.now()>deadline){archive.errors.push('Límite de 55 segundos para recursos alcanzado');break;}
  if(usedBytes>=maxTotalAssets){archive.errors.push('Límite global de recursos alcanzado');break;}
  const url=queued[index];
  try{
   const result=await tryFetch(url);
   if(usedBytes+result.bytes.length>maxTotalAssets)throw Error('Límite total de archivos alcanzado');
   const path=resourcePath(url);
   archive.assets.set(url,{path,bytes:result.bytes,type:result.type});
   usedBytes+=result.bytes.length;
   if(/\.css(?:$|\?)/i.test(url)){
    const css=new TextDecoder().decode(result.bytes);
    for(const next of getCssImports(css,url)){
     if(!seen.has(next)&&queued.length<maxAssets){queued.push(next);seen.add(next);}
    }
   }
  }catch(e){archive.errors.push(`Recurso ${url}: ${e.message}`);}
 }
}
function mirrorPage(page,map){
 const filename='mirror/'+page.key+'.html',source=archive.files.get('source/'+page.key+'.html');
 if(!source)return null;
 const doc=new DOMParser().parseFromString(source,'text/html');
 // Bases pointing online would defeat offline-relative links.
 doc.querySelectorAll('base').forEach(n=>n.remove());
 for(const el of doc.querySelectorAll('[src], [href], [poster], [srcset], [style]')){
  for(const attr of ['src','href','poster']){
   const raw=el.getAttribute(attr);if(!raw)continue;
   try{
    const absolute=new URL(raw,page.finalUrl||page.url).href;
    const dest=map.get(absolute);
    if(dest)el.setAttribute(attr,rel(filename,dest));
    else if(attr==='href'){
     const known=archive.pages.find(p=>p.url===absolute||p.finalUrl===absolute);
     if(known)el.setAttribute('href',rel(filename,'mirror/'+known.key+'.html'));
    }
   }catch{}
  }
  const srcset=el.getAttribute('srcset');
  if(srcset){
   el.setAttribute('srcset',srcset.split(',').map(part=>{
    const seg=part.trim().split(/\s+/);try{const hit=map.get(new URL(seg[0],page.finalUrl||page.url).href);if(hit)seg[0]=rel(filename,hit);}catch{}return seg.join(' ');
   }).join(', '));
  }
  const st=el.getAttribute('style');
  if(st){
   el.setAttribute('style',st.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(whole,_,raw)=>{
    try{const hit=map.get(new URL(raw,page.finalUrl||page.url).href);return hit?`url("${rel(filename,hit)}")`:whole;}catch{return whole;}
   }));
  }
 }
 for(const el of doc.querySelectorAll('style')){
  el.textContent=el.textContent.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(whole,_,raw)=>{
   try{const hit=map.get(new URL(raw,page.finalUrl||page.url).href);return hit?`url("${rel(filename,hit)}")`:whole;}catch{return whole;}
  });
 }
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
function indexPage(meta){
 const rows=archive.pages.map(p=>`<tr><td>${escapeHtml(p.title)}</td><td><a href="mirror/${escapeHtml(p.key)}.html">HTML offline</a></td><td>${p.mhtml?`<a href="snapshots/${escapeHtml(p.key)}.mhtml">MHTML completo</a>`:'No disponible'}</td><td>${p.screenshot?`<a href="screenshots/${escapeHtml(p.key)}.png">Captura PNG</a>`:'No disponible'}</td><td><a href="${escapeHtml(p.url)}">Original ↗</a></td></tr>`).join('');
 return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SitioGato · ${escapeHtml(meta.origin)}</title><style>body{max-width:940px;padding:30px;margin:auto;background:#fdf7ed;color:#322012;font:15px/1.6 system-ui}h1{font-size:40px}b{color:#a45020}table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #dcc6ac;text-align:left}a{color:#a74b1b}code{background:#eee1d0;padding:3px}aside{border-left:5px solid #c57940;padding:15px;background:#fff0df;margin:25px 0}</style><h1>🐈 SitioGato</h1><p><b>${escapeHtml(meta.origin)}</b> · ${archive.pages.length} páginas · exportado ${escapeHtml(new Date().toLocaleString('es-MX'))}</p><aside>Abre los <b>MHTML</b> con Chrome para ver una copia visual con recursos integrados. La carpeta <code>mirror/</code> ofrece una versión HTML navegable con los archivos recuperados (puede requerir servidor local para funcionalidades dinámicas). <code>source/</code> guarda el DOM al momento de capturar. Algunos sitios con acceso restringido, APIs o contenido protegido no pueden archivarse por completo.</aside><table><thead><tr><th>Página</th><th>Espejo</th><th>Captura MHTML</th><th>PNG</th><th>Origen</th></tr></thead><tbody>${rows}</tbody></table><p>Consulta también <a href="DESIGN.md">DESIGN.md</a> para ver el análisis visual (si habilitaste la opción), y <a href="manifest.json">manifest.json</a> para los errores y metadatos.</p></html>`;
}
// Build a readable DESIGN.md from actual computed styles and observed DOM structure.
// This describes the captured site; it is not a claim to possess the original source/design system.
function md(value,limit=180){
 return String(value??'—').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\|/g,'\\|').replace(/`/g,"'").trim().slice(0,limit)||'—';
}
function mdTable(rows,headers){
 return '| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.map(x=>md(x)).join(' | ')+' |').join('\n')+'\n';
}
function designMarkdown(meta){
 const designs=[...archive.designs.entries()];
 const header=['# DESIGN.md — Guía visual observada',
 '',`Sitio: ${md(meta.origin,300)}`,`Fecha de captura: ${md(meta.finishedAt)}`,
 `Páginas examinadas: ${archive.pages.length}`,`Páginas con estilos analizados: ${designs.length}`,
 '', '> **Importante:** este documento se genera automáticamente leyendo estilos computados en el navegador.',
 '> Describe lo observado en el tamaño de pantalla de la captura. No recupera un archivo fuente Figma,',
 '> los CSS originales privados ni garantiza la apariencia de otros tamaños o estados de la aplicación.',
 '', '## Identidad y referencias',''];
 if(!designs.length)return header.concat(['No se pudieron analizar estilos en las páginas capturadas.']).join('\n');
 const first=designs[0][1];
 header.push('**Vista inicial:** '+md(first.title)+' — '+md(first.url,320));
 header.push('**Viewport registrado:** '+md(first.viewport?.width)+' × '+md(first.viewport?.height)+' px');
 header.push('**Base:** fondo '+md(first.canvas?.background)+', texto '+md(first.canvas?.color)+', fuente '+md(first.canvas?.font)+'.','');
 const allColors=new Map(),allFonts=new Map(),allRadius=new Map(),allFrames=new Map();
 for(const [,d] of designs){
  for(const [data,store] of [[d.colors,allColors],[d.fonts,allFonts],[d.radii,allRadius]]){
   for(const item of data||[])store.set(item.value,(store.get(item.value)||0)+item.count);
  }
  for(const m of d.mediaQueries||[])allFrames.set(m,(allFrames.get(m)||0)+1);
 }
 const tops=(map,n=14)=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
 header.push('## Paleta detectada','',mdTable(tops(allColors),['Color CSS calculado','Frecuencia aproximada']),'',
 '## Tipografías','',mdTable(tops(allFonts,10),['Familia calculada','Frecuencia aproximada']),'',
 '## Bordes, radios y sombras','',mdTable(tops(allRadius,10),['Border radius','Frecuencia aproximada']),'');
 if(first.shadows?.length){header.push('Ejemplos de sombras:',...first.shadows.slice(0,7).map(v=>'- `'+md(v,200)+'`'),'');}
 header.push('## Tipografía representativa (página inicial)','');
 header.push(mdTable((first.typography||[]).map(x=>[x.selector,x.fontSize,x.fontWeight,x.lineHeight,x.letterSpacing,x.font]),
 ['Selector','Tamaño','Peso','Altura de línea','Tracking','Familia']),'');
 header.push('## Componentes y estructura','',
 '- Elementos estructurales en la página inicial: '+Object.entries(first.selectors||{}).map(([k,v])=>`${k}=${v}`).join(', ')+'.','',
 '### Secciones, cabecera y pie','');
 header.push(mdTable((first.sections||[]).map(x=>[x.tag,x.selector,x.display,x.width+' × '+x.height,x.background]),['Elemento','Selector','Display','Tamaño capturado','Fondo']),'');
 header.push('### Controles y botones','',mdTable((first.buttons||[]).map(x=>[x.selector,x.fontSize,x.radius,x.background,x.transition]),['Selector','Texto','Radio','Fondo','Transición']),'');
 header.push('## Diseño adaptable','',
 'Reglas media query legibles durante la captura (pueden faltar las de hojas externas):','',
 ...tops(allFrames,25).map(([rule])=>'- `'+md(rule,180)+'`'),'');
 header.push('## Movimiento y animaciones','',
 'Animaciones activas detectadas en elementos inspeccionados: '+(first.activeAnimations?.map(a=>'`'+md(a)+'`').join(', ')||'Ninguna visible en la muestra.'),'',
 'Keyframes visibles en hojas accesibles: '+(first.keyframes?.map(a=>'`'+md(a)+'`').join(', ')||'No accesibles.'),'');
 header.push('## Variables CSS encontradas','');
 header.push(mdTable((first.variables||[]).map(x=>[x.name,x.value]),['Variable','Valor']),'');
 header.push('## Hojas de estilo cargadas','',...(first.stylesheets||[]).map(x=>'- '+md(x,320)),'');
 header.push('## Análisis por página','');
 for(const [key,d] of designs){
  header.push('### '+md(d.title,100)+' — `'+md(key,90)+'`','',
   '- URL: '+md(d.url,320),
   '- Tamaño de captura: '+md(d.viewport?.width)+' × '+md(d.viewport?.height)+' px',
   '- Fondo: '+md(d.canvas?.background)+'; texto: '+md(d.canvas?.color),
   '- Fuentes frecuentes: '+(d.fonts||[]).slice(0,4).map(x=>md(x.value)).join(' · '),
   '- Colores frecuentes: '+(d.colors||[]).slice(0,5).map(x=>md(x.value)).join(' · '),
   '- Animaciones observadas: '+(d.activeAnimations?.length?d.activeAnimations.map(x=>md(x)).join(', '):'No identificadas en la muestra'),
   '- Captura: `screenshots/'+md(key)+'.png` (si está disponible)',
   '- HTML: `source/'+md(key)+'.html`',
   '');
 }
 header.push('## Limitaciones conocidas','',
 '- Los recursos cargados desde otros orígenes pueden no estar en `assets/`; algunos sí aparecerán en las capturas MHTML.',
 '- Los estados hover, menús cerrados, carruseles y layouts responsive no se pueden reconstruir solo con una captura.',
 '- Los colores son los estilos más repetidos en una muestra de elementos, no una paleta de marca validada.',
 '- Las animaciones WebGL, canvas, WebAssembly o vídeo no se pueden describir completamente mediante estilos CSS.',
 '- Las páginas con CAPTCHA o acceso restringido requieren interacción y autorización normales del usuario.');
 return header.join('\n')+'\n';
}
async function exportArchive(meta){
 await gatherAssets();
 const zip=new SitioGatoZip();
 const map=new Map([...archive.assets].map(([url,a])=>[url,a.path]));
 for(const [url,a] of archive.assets){
  let content=a.bytes;
  if(/\.css(?:$|\?)/i.test(url)){
   const css=new TextDecoder().decode(a.bytes);
   const rewritten=css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(whole,_,raw)=>{
    try{const hit=map.get(new URL(raw,url).href);return hit?`url("${rel(a.path,hit)}")`:whole;}catch{return whole;}
   });
   content=textEncoder.encode(rewritten);
  }
  zip.add(a.path,content);
 }
 for(const page of archive.pages){
  const mirror=mirrorPage(page,map);
  if(mirror)zip.add('mirror/'+page.key+'.html',mirror);
 }
 for(const [name,value] of archive.files){
  if(Array.isArray(value))zip.addChunks(name,value);
  else zip.add(name,value);
 }
 const manifest={format:'SitioGato-1.0',source:'browser-visible pages, not server-side code',...meta,pages:archive.pages,assets:[...archive.assets].map(([url,a])=>({url,path:a.path,size:a.bytes.length,type:a.type})),warnings:archive.errors};
 if(meta.designRequested!==false)zip.add('DESIGN.md',designMarkdown(meta));
  zip.add('manifest.json',JSON.stringify(manifest,null,2));
 zip.add('index.html',indexPage(meta));
 zip.add('LEEME.txt','SITIOGATO · ARCHIVO DE SITIO\n\nAbre index.html después de descomprimir.\nAbre los archivos snapshots/*.mhtml en Chrome para ver capturas completas.\nLos screenshots/*.png muestran la parte visible de cada página.\nLos archivos mirror/*.html intentan conservar enlaces y recursos del mismo dominio.\nDESIGN.md resume los estilos computados, tipografías, colores, componentes y animaciones observadas cuando se habilitó.\nLos archivos source/*.html son copias del DOM renderizado, no código privado del servidor.\nMHTML puede incorporar contenidos externos, pero esto no garantiza que todas las aplicaciones funcionen sin conexión.\nLa herramienta no supera bloqueos, contraseñas ni CAPTCHA.\n');
 const blob=await zip.toBlob();
 exportedUrl=URL.createObjectURL(blob);
 return {ok:true,url:exportedUrl,files:zip.entries.length,bytes:blob.size,warnings:archive.errors.length};
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.target!=='offscreen')return false;
 (async()=>{
  if(msg.action==='INIT'){init(msg.origin,!!msg.includeAssets);return {ok:true};}
  if(!archive)throw Error('Archivador no inicializado');
  if(msg.action==='MHTML_BEGIN'){archive.pending.set(msg.name,[]);return {ok:true};}
  if(msg.action==='MHTML_CHUNK'){addChunk(msg.name,msg.base64);return {ok:true};}
  if(msg.action==='MHTML_END'){
   const pending=archive.pending.get(msg.name);if(!pending)throw Error('MHTML no existe');
   archive.files.set(msg.name,pending);archive.pending.delete(msg.name);return {ok:true};
  }
  if(msg.action==='ADD_PAGE'){addPage(msg);return {ok:true};}
  if(msg.action==='ADD_RESOURCES'){
   if(archive.includeAssets)for(const raw of msg.urls||[]){try{const u=new URL(raw);if(u.origin===archive.origin&&validAsset.test(u.pathname))archive.resourceUrls.add(u.href);}catch{}}
   return {ok:true};
  }
  if(msg.action==='EXPORT')return await exportArchive(msg.meta);
  if(msg.action==='CLEANUP'){if(exportedUrl){URL.revokeObjectURL(exportedUrl);exportedUrl=null;}archive=null;return {ok:true};}
  return {ok:false,error:'Acción desconocida'};
 })().then(reply).catch(e=>reply({ok:false,error:e.message}));
 return true;
});
