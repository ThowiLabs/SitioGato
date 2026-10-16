'use strict';
// SitioGato's crawler runs only after an explicit click and stays on the tab's origin.
const JOB_KEY='crawlStatus';
const ALARM='sitiogato-resume';
let processing=false;
let downloading=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const goodUrl=value=>{
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol);}catch{return false;}
};
function canonical(value,origin){
 try{
  const u=new URL(value);
  if(u.origin!==origin||!['http:','https:'].includes(u.protocol))return null;
  u.hash='';
  const remove=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'];
  remove.forEach(p=>u.searchParams.delete(p));
  u.searchParams.sort();
  if(/\.(?:pdf|zip|7z|rar|jpe?g|png|gif|svg|webp|avif|ico|css|js|mjs|json|xml|txt|woff2?|ttf|otf|wasm|mp[34]|webm|ogg|mp3|mov|exe|dmg|apk)(?:$)/i.test(u.pathname))return null;
  return u.href;
 }catch{return null;}
}
async function getJob(){return (await chrome.storage.local.get(JOB_KEY))[JOB_KEY]?.job||null;}
async function saveJob(job){await chrome.storage.local.set({[JOB_KEY]:{job}});}
async function sendOffscreen(action,data={}){
 return await chrome.runtime.sendMessage({target:'offscreen',action,...data});
}
async function ensureOffscreen(){
 if(await chrome.offscreen.hasDocument())return;
 try{await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'Montar un ZIP local con copias MHTML y recursos descargados.'});}
 catch(e){if(!(await chrome.offscreen.hasDocument()))throw e;}
}
function waitForNavigation(tabId,timeoutMs=28000){
 return new Promise(resolve=>{
  let done=false;
  const finish=async()=>{
   if(done)return;done=true;clearTimeout(timeout);chrome.tabs.onUpdated.removeListener(listener);
   try{resolve(await chrome.tabs.get(tabId));}catch{resolve(null);}
  };
  const listener=(id,change)=>{if(id===tabId&&change.status==='complete')finish();};
  chrome.tabs.onUpdated.addListener(listener);
  const timeout=setTimeout(finish,timeoutMs);
 });
}
async function navigate(tabId,url){
 const ready=waitForNavigation(tabId);
 await chrome.tabs.update(tabId,{url,active:true});
 return ready;
}
async function injectCat(tabId){
 try{await chrome.scripting.executeScript({target:{tabId},files:['overlay.js']});return true;}catch{return false;}
}
async function setOverlayVisible(tabId,visible){
 try{await chrome.scripting.executeScript({target:{tabId},func:(v)=>{
  const host=document.getElementById('__sitiogato_overlay__');if(host)host.style.visibility=v?'visible':'hidden';
 },args:[visible]});}catch{}
}
// Executed in the site's own tab, after scripts and lazy images have had time to load.
async function inspectPage(tabId){
 const [result]=await chrome.scripting.executeScript({target:{tabId},func:async()=>{
  const pageHeight=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0);
  const increment=Math.max(400,window.innerHeight*.75);
  for(let y=increment;y<Math.min(pageHeight,window.innerHeight*7);y+=increment){
   window.scrollTo({top:y,behavior:'instant'});
   await new Promise(r=>setTimeout(r,160));
  }
  window.scrollTo({top:0,behavior:'instant'});
  await new Promise(r=>setTimeout(r,350));
  const origin=location.origin;
  const links=[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(Boolean);
  const resources=new Set();
  const okFile=/\.(?:css|js|mjs|wasm|png|jpe?g|webp|svg|gif|avif|ico|woff2?|ttf|otf|mp4|webm|mp3)(?:$|\?)/i;
  function include(raw){try{const u=new URL(raw,location.href);u.hash='';if(u.origin===origin&&okFile.test(u.pathname))resources.add(u.href);}catch{}}
  for(const item of performance.getEntriesByType('resource'))include(item.name);
  for(const el of document.querySelectorAll('[src],[href],[poster],[srcset]')){
   for(const attr of ['src','href','poster']){const val=el.getAttribute(attr);if(val)include(val);}
   const sets=el.getAttribute('srcset');if(sets)sets.split(',').forEach(v=>include(v.trim().split(/\s+/)[0]));
  }
  // DESIGN.md: a bounded observation of computed, browser-visible design rules.
  // It is not source CSS decompilation and cannot access cross-origin CSS rules.
  const style=(el)=>el?getComputedStyle(el):null;
  const view={width:innerWidth,height:innerHeight};
  const bodyStyle=style(document.body),rootStyle=style(document.documentElement);
  const colorCounts=new Map(),fonts=new Map(),radius=new Map(),shadows=new Set(),animations=new Set();
  const selectors=['header','nav','main','section','article','aside','footer','h1','h2','h3','p','a','button','input','form','img'];
  const selectorCounts=Object.fromEntries(selectors.map(sel=>[sel,document.querySelectorAll(sel).length]));
  // Sample bounded representative DOM nodes, ignoring the SitioGato overlay entirely.
  const elements=Array.from(document.body?.querySelectorAll('h1,h2,h3,p,a,button,header,nav,section,article,main,footer,form,input,[class]')||[])
    .filter(el=>!el.closest('#__sitiogato_overlay__')).slice(0,450);
  function count(map,val){if(!val||['transparent','none','rgba(0, 0, 0, 0)','rgb(0, 0, 0, 0)'].includes(val))return;map.set(val,(map.get(val)||0)+1);}
  for(const el of elements){
   const st=style(el);if(!st)continue;
   count(colorCounts,st.color);count(colorCounts,st.backgroundColor);count(colorCounts,st.borderTopColor);
   count(fonts,st.fontFamily);count(radius,st.borderRadius);
   if(st.boxShadow!=='none'&&shadows.size<12)shadows.add(st.boxShadow.slice(0,160));
   if(st.animationName!=='none')for(const a of st.animationName.split(','))if(animations.size<40)animations.add(a.trim());
  }
  const top=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,16).map(([value,count])=>({value,count}));
  const sample=sel=>[...document.querySelectorAll(sel)].filter(el=>!el.closest('#__sitiogato_overlay__')).slice(0,5).map(el=>{
   const st=style(el),r=el.getBoundingClientRect();
   return {tag:el.tagName.toLowerCase(),selector:el.id?'#'+el.id:el.classList.length?'.'+Array.from(el.classList).slice(0,3).join('.'):el.tagName.toLowerCase(),
    font:st.fontFamily,fontSize:st.fontSize,fontWeight:st.fontWeight,lineHeight:st.lineHeight,letterSpacing:st.letterSpacing,
    color:st.color,background:st.backgroundColor,radius:st.borderRadius,display:st.display,
    width:Math.round(r.width),height:Math.round(r.height),animation:st.animationName,transition:st.transitionDuration};
  });
  const vars=[];
  for(const prop of rootStyle){
   if(prop.startsWith('--')&&vars.length<65){const val=rootStyle.getPropertyValue(prop).trim();if(val&&val.length<200)vars.push({name:prop,value:val});}
  }
  const media=[],keyframes=[];
  for(const sheet of [...document.styleSheets]){
   let rules;try{rules=sheet.cssRules;}catch{continue;}
   const todo=[...rules].slice(0,550);
   for(const rule of todo){
    if(rule.type===CSSRule.MEDIA_RULE&&media.length<25)media.push(rule.conditionText);
    if(rule.type===CSSRule.KEYFRAMES_RULE&&keyframes.length<25)keyframes.push(rule.name);
   }
  }
  const design={viewport:view,title:document.title||'',url:location.href,
   canvas:{background:bodyStyle?.backgroundColor,color:bodyStyle?.color,font:bodyStyle?.fontFamily,bodyMargin:bodyStyle?.margin,
    rootFontSize:rootStyle?.fontSize},
   colors:top(colorCounts),fonts:top(fonts),radii:top(radius),shadows:[...shadows],
   selectors:selectorCounts,typography:sample('h1,h2,h3'),buttons:sample('button,[role="button"],input[type="submit"]'),
   sections:sample('header,main,section,footer'),navigation:sample('nav'),images:sample('img'),
   variables:vars,mediaQueries:[...new Set(media)],keyframes:[...new Set(keyframes)],
   activeAnimations:[...animations],stylesheets:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.href).slice(0,30),
   inlineStyles:document.querySelectorAll('style').length};
  const clone=document.documentElement.cloneNode(true);
  clone.querySelector('#__sitiogato_overlay__')?.remove();
  // Source is a rendered DOM snapshot, not private server-side source.
  return {url:location.href,title:document.title||location.pathname,links,resources:[...resources],design,html:'<!doctype html>\n'+clone.outerHTML,checkpoint:/failed to verify your browser|vercel security checkpoint|access denied|captcha/i.test(document.body?.innerText?.slice(0,2500)||'')};
 }});
 return result.result;
}
function uniqueFilename(url,index){
 let name;
 try{name=new URL(url).pathname.replace(/\/+$/,'').replace(/^\/+/, '').replace(/[^a-z0-9._-]+/gi,'-').slice(0,76);}catch{name='page';}
 if(!name)name='home';
 return `p${String(index).padStart(3,'0')}-${name.replace(/^\.+/,'')||'page'}`;
}
async function pushScreenshot(tabId,filename){
 try{
  await setOverlayVisible(tabId,false);
  const tab=await chrome.tabs.get(tabId);
  const dataUrl=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});
  if(!dataUrl?.startsWith('data:image/png;base64,'))return false;
  const encoded=dataUrl.split(',')[1];
  let result=await sendOffscreen('MHTML_BEGIN',{name:filename});
  if(!result?.ok)throw Error('No se pudo iniciar captura PNG');
  // Every slice is a multiple of four, so each fragment is independently valid base64.
  for(let pos=0;pos<encoded.length;pos+=192*1024){
   result=await sendOffscreen('MHTML_CHUNK',{name:filename,base64:encoded.slice(pos,pos+192*1024)});
   if(!result?.ok)throw Error(result?.error||'No se pudo guardar PNG');
  }
  result=await sendOffscreen('MHTML_END',{name:filename});
  return !!result?.ok;
 }catch(e){console.warn('[SitioGato] screenshot',e);return false;}
 finally{await setOverlayVisible(tabId,true);}
}
async function pushMhtml(tabId,filename){
 try{
  await setOverlayVisible(tabId,false);
  const blob=await chrome.pageCapture.saveAsMHTML({tabId});
  if(!blob||!blob.size)return false;
  const res=await sendOffscreen('MHTML_BEGIN',{name:filename});
  if(!res?.ok)throw Error('No se pudo crear entrada MHTML');
  // 192 KiB avoids message-size limits and binary JSON serialization issues.
  const chunkSize=192*1024;
  for(let pos=0;pos<blob.size;pos+=chunkSize){
   const buf=new Uint8Array(await blob.slice(pos,pos+chunkSize).arrayBuffer());
   let ascii='';
   for(let i=0;i<buf.length;i+=8192)ascii+=String.fromCharCode(...buf.subarray(i,i+8192));
   const answer=await sendOffscreen('MHTML_CHUNK',{name:filename,base64:btoa(ascii)});
   if(!answer?.ok)throw Error(answer?.error||'Error transmitiendo MHTML');
  }
  return (await sendOffscreen('MHTML_END',{name:filename}))?.ok||false;
 }catch(e){console.warn('[SitioGato] MHTML',e);return false;}
 finally{await setOverlayVisible(tabId,true);}
}
async function finalizeJob(job,reason){
 job.status='finalizing';job.message=reason||'Empaquetando el archivo ZIP';job.current='';await saveJob(job);
 try{
  await ensureOffscreen();
  const result=await sendOffscreen('EXPORT',{meta:{origin:job.origin,startedAt:job.startedAt,finishedAt:new Date().toISOString(),done:job.done,errors:job.errors,stopped:job.stopRequested,assetPermission:job.includeAssets,designRequested:job.includeDesign,maxPages:job.maxPages,maxDepth:job.maxDepth,delayMs:job.delayMs}});
  if(!result?.ok||!result.url)throw Error(result?.error||'No se pudo crear el ZIP');
  const host=new URL(job.origin).hostname.replace(/[^a-z0-9.-]+/gi,'-');
  const date=new Date().toISOString().slice(0,10);
  const filename=`SitioGato/${host}_${date}.zip`;
  downloading=true;
  const id=await chrome.downloads.download({url:result.url,filename,saveAs:false,conflictAction:'uniquify'});
  job.status='completed';job.message=`ZIP preparado para descarga (ID ${id}).`;
  job.downloadId=id;job.downloadFilename=filename;
  await saveJob(job);
 }catch(e){job.status='error';job.message='Error al generar ZIP: '+e.message;job.errors.push(job.message);await saveJob(job);}
 finally{await chrome.alarms.clear(ALARM);}
}
async function crawl(){
 if(processing)return;
 processing=true;
 try{
  let job=await getJob();
  if(!job||job.status!=='running')return;
  await ensureOffscreen();
  await chrome.alarms.create(ALARM,{periodInMinutes:0.5});
  for(;;){
   job=await getJob();
   if(!job||job.status!=='running')break;
   if(job.stopRequested||!job.queue.length||(job.maxPages!==null&&job.done.length>=job.maxPages)){await finalizeJob(job,job.stopRequested?'Captura detenida por el usuario':'Captura terminada');break;}
   const page=job.queue[0];
   const normal=canonical(page.url,job.origin);
   if(!normal||job.done.some(p=>p.url===normal)){
    job.queue.shift();await saveJob(job);continue;
   }
   job.current=page.url;job.message='Navegando...';await saveJob(job);
   let actual;
   try{
    actual=await navigate(job.tabId,page.url);
    if(!actual||new URL(actual.url).origin!==job.origin)throw Error('Redirección fuera del dominio');
    await injectCat(job.tabId);
    await pause(job.delayMs);
    let info=await inspectPage(job.tabId);
    if(info.checkpoint){
     job.errors.push(`${page.url}: página de verificación de acceso; no se puede capturar automáticamente.`);
     job.queue.shift();await saveJob(job);continue;
    }
    const key=uniqueFilename(page.url,job.done.length+1);
    const mhtml=await pushMhtml(job.tabId,`snapshots/${key}.mhtml`);
    const screenshot=await pushScreenshot(job.tabId,`screenshots/${key}.png`);
    const answer=await sendOffscreen('ADD_PAGE',{key,url:page.url,finalUrl:info.url,title:info.title,html:info.html,depth:page.depth,mhtml,screenshot,design:job.includeDesign?info.design:null});
    if(!answer?.ok)throw Error(answer?.error||'Error guardando HTML');
    if(job.includeAssets)await sendOffscreen('ADD_RESOURCES',{urls:info.resources});
    job.done.push({url:page.url,finalUrl:info.url,title:info.title,key,mhtml,screenshot});
    job.queue.shift();
    if(page.depth<job.maxDepth){
     const seen=new Set([...job.done.map(p=>p.url),...job.queue.map(p=>p.url)]);
     for(const candidate of info.links){
      const u=canonical(candidate,job.origin);
      if(u&&!seen.has(u)&&(job.maxPages===null?job.queue.length<8000:job.done.length+job.queue.length<job.maxPages*4)){
       job.queue.push({url:u,depth:page.depth+1});seen.add(u);
      }
     }
    }
   }catch(e){
    job.errors.push(`${page.url}: ${e.message}`);
    job.queue.shift();
   }
   // Stop can be requested by the overlay while this page is being processed.
   // Merge the latest stop flag instead of overwriting it with a stale job copy.
   const recent=await getJob();
   if(recent?.stopRequested)job.stopRequested=true;
   job.current='';job.message=`${job.done.length} página(s) guardada(s)`;await saveJob(job);
  }
 }catch(e){
  console.error('[SitioGato] crawl failed',e);
  const job=await getJob();
  if(job){job.status='error';job.message=e.message;job.errors.push(e.message);await saveJob(job);}
 }finally{processing=false;}
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(!msg||msg.target==='offscreen')return false;
 if(msg.type==='START'){
  (async()=>{
   const existing=await getJob();
   if(existing&&['running','finalizing','stopping'].includes(existing.status))return {ok:false,error:'Ya hay una captura activa.'};
   const tab=await chrome.tabs.get(msg.tabId);
   if(!goodUrl(tab.url))return {ok:false,error:'Solo se permiten páginas HTTP(S).'};
   const url=new URL(tab.url);url.hash='';
   const maxPages=msg.unlimited===true?null:Math.min(100000,Math.max(1,Number(msg.maxPages)||30));
   const job={id:Date.now().toString(36),tabId:tab.id,origin:url.origin,startUrl:url.href,maxPages,maxDepth:Math.min(5,Math.max(1,Number(msg.maxDepth)||2)),delayMs:Math.min(5000,Math.max(500,Number(msg.delayMs)||1500)),includeAssets:!!msg.includeAssets,includeDesign:msg.includeDesign!==false,queue:[{url:url.href,depth:0}],done:[],errors:[],current:'',startedAt:new Date().toISOString(),status:'running',stopRequested:false,message:'Iniciando captura'};
   await ensureOffscreen();
   const init=await sendOffscreen('INIT',{origin:job.origin,includeAssets:job.includeAssets});
   if(!init?.ok)throw Error(init?.error||'No se pudo iniciar archivador');
   await saveJob(job);
   crawl();
   return {ok:true};
  })().then(reply).catch(e=>reply({ok:false,error:e.message}));
  return true;
 }
 if(msg.type==='STOP'){
  (async()=>{const job=await getJob();if(job&&job.status==='running'){job.stopRequested=true;job.message='Deteniendo después de esta página';await saveJob(job);}return {ok:true};})().then(reply);return true;
 }
 if(msg.type==='GET_STATUS'){
  getJob().then(job=>reply({ok:true,job}));return true;
 }
 return false;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM&&!processing)crawl();});
chrome.downloads.onChanged.addListener(async delta=>{
 if(!delta.state?.current)return;
 const job=await getJob();
 if(job?.downloadId!==delta.id)return;
 if(delta.state.current==='interrupted'){
  job.status='error';job.message='Descarga interrumpida por Chrome.';await saveJob(job);
 }
 try{await sendOffscreen('CLEANUP');}catch{}
 downloading=false;
});
chrome.tabs.onRemoved.addListener(async id=>{
 const job=await getJob();
 if(job?.tabId===id&&job.status==='running'){
  job.stopRequested=true;job.message='La pestaña fue cerrada';await saveJob(job);
 }
});
// Recover an interrupted crawl after a service-worker suspension or extension refresh.
chrome.runtime.onStartup.addListener(async()=>{
 const job=await getJob();
 if(job?.status==='running'){
  // The old offscreen ZIP state is not retained across full browser restarts.
  job.status='interrupted';
  job.message='El navegador se reinició. Vuelve a iniciar la captura.';
  await saveJob(job);
 }
});
