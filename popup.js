'use strict';
const $=id=>document.getElementById(id);
let activeTab=null;
const number=(id,lo,hi)=>Math.min(hi,Math.max(lo,Number($(id).value)||lo));
function draw(status){
 const job=status?.job;
 const running=!!(job&&['running','finalizing','stopping'].includes(job.status));
 $('start').disabled=running||!activeTab||!/^https?:/.test(activeTab.url||'');
 $('stop').disabled=!running;
 $('status').textContent=job?.status?.toUpperCase()||'ESPERANDO';
 const done=job?.done?.length||0,pending=job?.queue?.length||0;
 $('progress').textContent=`${done} capturadas · ${pending} pendientes${job?.maxPages===null?' · sin límite':''}`;
 $('current').textContent=job?.current||job?.message||'';
 const limit=job?.maxPages;
 // There is no meaningful end percentage for unlimited discovery.
 $('meterFill').style.width=limit===null&&job?.status==='running' ? '12%' : Math.round(done/Math.max(1,limit||done+pending)*100)+'%';
 if(job?.status==='completed')$('meterFill').style.width='100%';
}
function toggleUnlimited(){
 const on=$('unlimited').checked,field=$('maxPages');
 field.disabled=on;field.setAttribute('aria-disabled',String(on));
 field.title=on?'Sin tope de páginas: detén la captura cuando quieras.':'';
}
$('unlimited').addEventListener('change',toggleUnlimited);toggleUnlimited();
(async()=>{
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  activeTab=tab||null;
  $('hostname').textContent=tab?.url?new URL(tab.url).hostname:'No hay una pestaña web activa';
  if(!/^https?:/.test(tab?.url||''))$('hostname').textContent='Abre una página http:// o https://';
 }catch(e){$('hostname').textContent='No se pudo leer la pestaña';}
 const state=await chrome.storage.local.get('crawlStatus');draw(state.crawlStatus);
})();
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.crawlStatus)draw(changes.crawlStatus.newValue);});
$('start').addEventListener('click',async()=>{
 if(!activeTab)return;
 $('status').textContent='SOLICITANDO PERMISOS';
 try{
  const u=new URL(activeTab.url),pattern=`${u.protocol}//${u.hostname}/*`;
  const assetAccess=!$('assets').checked || await chrome.permissions.request({origins:[pattern]});
  const result=await chrome.runtime.sendMessage({type:'START',tabId:activeTab.id,
   maxPages:$('unlimited').checked?null:number('maxPages',1,100000),
   unlimited:$('unlimited').checked,maxDepth:number('depth',1,5),
   delayMs:number('delay',500,5000),includeAssets:$('assets').checked&&assetAccess,
   includeDesign:$('design').checked});
  if(!result?.ok)throw Error(result?.error||'No se pudo iniciar');
  window.close();
 }catch(error){$('status').textContent='ERROR';$('current').textContent=error.message;}
});
$('stop').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'STOP'});});
