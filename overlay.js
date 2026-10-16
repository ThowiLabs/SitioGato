(()=>{
 'use strict';
 if(document.getElementById('__sitiogato_overlay__'))return;
 const host=document.createElement('div');
 host.id='__sitiogato_overlay__';
 host.style.cssText='position:fixed!important;right:16px!important;bottom:16px!important;width:min(340px,calc(100vw - 20px))!important;height:390px!important;z-index:2147483647!important;pointer-events:none!important;margin:0!important;opacity:1!important;visibility:visible!important';
 const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>
 :host{all:initial;color-scheme:light}*{box-sizing:border-box;margin:0;padding:0}
 .widget{position:relative;width:100%;height:390px;border:1px solid rgba(210,129,61,.6);border-radius:18px;background:rgba(255,247,233,.70);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);box-shadow:0 12px 45px rgba(37,25,16,.18);overflow:hidden;color:#51321c;font-family:system-ui,sans-serif;pointer-events:none}
 .top{padding:13px 15px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:rgba(255,214,152,.53);border-bottom:1px solid rgba(152,93,40,.25)}
 .brand{display:flex;gap:7px;align-items:center;font:800 13px system-ui;letter-spacing:-.025em}.live{width:7px;height:7px;border-radius:50%;background:#e77627;box-shadow:0 0 10px #e77627;animation:blink 1.7s infinite}
 .controls{display:flex;gap:6px}.controls button{pointer-events:auto;padding:5px 8px;border:1px solid rgba(132,77,32,.35);border-radius:6px;background:rgba(255,255,255,.54);color:#744120;cursor:pointer;font:700 11px system-ui}.controls button:hover{background:#fff0d9}
 .stage{height:268px;position:relative;display:grid;place-items:end center;overflow:hidden}
 .room{position:absolute;bottom:-1px;left:50%;margin-left:-210px;width:420px;height:400px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;transform:scale(.68);transform-origin:center bottom}
 .cat{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;animation:headBob 2s infinite ease-in-out}
 .ears{position:absolute;top:-24px;width:140px;display:flex;justify-content:space-between;z-index:0}
 .ear{width:44px;height:48px;background:#f59e0b;clip-path:polygon(50% 0%,0% 100%,100% 100%);position:relative}
 .ear::after{content:'';position:absolute;bottom:0;left:10px;width:24px;height:28px;background:#fca5a5;clip-path:polygon(50% 0%,0% 100%,100% 100%)}
 .ear.left{transform:rotate(-15deg)}.ear.right{transform:rotate(15deg)}
 .head{width:130px;height:110px;background:#f59e0b;border-radius:50% 50% 45% 45%;position:relative;z-index:1;box-shadow:inset 0 -8px 0 rgba(0,0,0,.05)}
 .eyes{position:absolute;top:48px;width:100%;display:flex;justify-content:space-around;padding:0 24px}
 .eye{width:12px;height:6px;background:#1e293b;border-radius:0 0 12px 12px;animation:blink 4s infinite}
 .nose{position:absolute;top:56px;left:50%;transform:translateX(-50%);width:10px;height:6px;background:#fca5a5;border-radius:4px 4px 6px 6px}
 .muzzle{position:absolute;top:60px;left:50%;transform:translateX(-50%);display:flex}
 .muzzle::before,.muzzle::after{content:'';width:14px;height:10px;border-bottom:2px solid #b45309;border-radius:50%;display:inline-block}
 .whiskers{position:absolute;top:58px;width:100%}
 .whisker-left,.whisker-right{position:absolute;width:28px;height:2px;background:#b45309}
 .whisker-left{left:-12px;transform:rotate(-5deg)}.whisker-left.w2{top:8px;transform:rotate(10deg)}
 .whisker-right{right:-12px;transform:rotate(5deg)}.whisker-right.w2{top:8px;transform:rotate(-10deg)}
 .cat-body{width:150px;height:90px;background:#f59e0b;border-radius:60px 60px 0 0;margin-top:-15px;position:relative}
 .desk{position:relative;width:100%;height:150px;background:#78350f;border-radius:12px 12px 0 0;z-index:2;box-shadow:0 -4px 15px rgba(0,0,0,.15);border-top:10px solid #92400e;display:flex;justify-content:center;align-items:flex-start;padding-top:20px}
 .notebook{position:relative;width:170px;height:110px;background:#fef08a;border-radius:6px;box-shadow:4px 6px 12px rgba(0,0,0,.2);padding:14px 16px;display:flex;flex-direction:column;gap:12px;transform:rotate(-3deg)}
 .notebook::before{content:'';position:absolute;left:-8px;top:10px;height:85px;width:10px;background:repeating-linear-gradient(to bottom,#475569 0px,#475569 3px,transparent 3px,transparent 9px)}
 .line{height:3px;background:#cbd5e1;border-radius:2px;width:100%}.line.writing{background:#64748b;width:0;animation:writeLine 1.6s infinite ease-in-out}
 .paw-left{position:absolute;top:24px;left:95px;width:32px;height:24px;background:#fef3c7;border:3px solid #f59e0b;border-radius:16px;z-index:3}
 .paw-right-container{position:absolute;top:18px;right:125px;z-index:3;animation:writeHand 1.6s infinite ease-in-out}
 .paw-right{position:relative;width:34px;height:26px;background:#fef3c7;border:3px solid #f59e0b;border-radius:16px}
 .pencil{position:absolute;top:-26px;left:14px;width:8px;height:52px;background:#ef4444;transform:rotate(35deg);border-radius:2px}
 .pencil::before{content:'';position:absolute;top:0;left:0;width:8px;height:10px;background:#fca5a5;border-radius:2px 2px 0 0}
 .pencil::after{content:'';position:absolute;bottom:-8px;left:0;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:8px solid #fde047}
 .pencil-lead{position:absolute;bottom:-11px;left:2px;width:4px;height:3px;background:#1e293b;border-radius:0 0 2px 2px}
 .bottom{position:relative;z-index:5;background:rgba(255,246,231,.86);height:70px;padding:8px 13px;font:600 11px system-ui;display:flex;flex-direction:column;gap:5px;border-top:1px solid rgba(168,106,49,.27)}
 .meter{height:5px;border-radius:10px;background:#ead5b9;overflow:hidden}.meter span{display:block;width:0;height:100%;background:#e68d38;transition:width .3s}.meter.unlimited span{width:28%!important;animation:meterFlow 1.65s ease-in-out infinite alternate}@keyframes meterFlow{from{transform:translateX(0)}to{transform:translateX(250%)}}
 .counter{display:flex;justify-content:space-between;gap:15px;font-size:10px;color:#775337}.path{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .mini .stage{display:none}.mini{height:122px}.mini .bottom{height:70px}
 @keyframes blink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
 @keyframes writeHand{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(12px,-3px) rotate(4deg)}50%{transform:translate(25px,2px) rotate(-3deg)}75%{transform:translate(38px,-2px) rotate(2deg)}90%{transform:translate(45px,0) rotate(0deg)}100%{transform:translate(0,0)}}
 @keyframes writeLine{0%{width:0;opacity:1}80%{width:75%;opacity:1}95%{opacity:0}100%{width:0;opacity:0}}
 @keyframes headBob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
 /* Animación activada explícitamente, incluso si Chrome reduce movimiento.
    Se puede pausar mediante el control visible de la extensión. */
 .paused .cat,.paused .eye,.paused .paw-right-container,.paused .line.writing,.paused .live{animation-play-state:paused!important}
 @media(max-width:360px){.widget{width:calc(100vw - 20px)}}
 </style><div class="widget"><div class="top"><span class="brand"><i class="live"></i> 🐈 SitioGato <span style="font-size:9px;font-weight:500">CAPTURANDO</span></span><div class="controls"><button type="button" id="motion" title="Pausar animación" aria-label="Pausar animación del gato" aria-pressed="false">Ⅱ</button><button type="button" id="collapse" title="Minimizar">−</button><button type="button" id="stop" title="Detener captura">■</button></div></div>
 <div class="stage"><div class="room"><div class="cat"><div class="ears"><div class="ear left"></div><div class="ear right"></div></div><div class="head"><div class="eyes"><div class="eye left"></div><div class="eye right"></div></div><div class="nose"></div><div class="muzzle"></div><div class="whiskers"><div class="whisker-left"></div><div class="whisker-left w2"></div><div class="whisker-right"></div><div class="whisker-right w2"></div></div></div><div class="cat-body body"></div></div><div class="desk"><div class="paw-left"></div><div class="notebook"><div class="line"></div><div class="line"></div><div class="line writing"></div><div class="line"></div></div><div class="paw-right-container"><div class="paw-right"><div class="pencil"><div class="pencil-lead"></div></div></div></div></div></div></div>
 <div class="bottom"><div class="counter"><span id="counts">0 páginas guardadas</span><span id="activity">● Activo</span></div><div class="meter"><span id="fill"></span></div><div class="path" id="path">Preparando navegación...</div></div></div>`;
 document.documentElement.appendChild(host);
 const el=id=>root.getElementById(id),widget=root.querySelector('.widget');
 el('motion').addEventListener('click',()=>{const paused=widget.classList.toggle('paused');el('motion').textContent=paused?'▶':'Ⅱ';el('motion').setAttribute('aria-pressed',String(paused));el('motion').setAttribute('aria-label',paused?'Reanudar animación del gato':'Pausar animación del gato');});
 el('collapse').addEventListener('click',()=>{
  widget.classList.toggle('mini');el('collapse').textContent=widget.classList.contains('mini')?'+':'−';
  host.style.height=widget.classList.contains('mini')?'122px':'390px';
 });
 el('stop').addEventListener('click',()=>{el('activity').textContent='Deteniendo...';chrome.runtime.sendMessage({type:'STOP'}).catch(()=>{});});
 function paint(job){
  if(!job)return;
  const n=job.done?.length||0,pending=job.queue?.length||0,total=Math.max(1,n+pending);
  el('counts').textContent=`${n} página(s) guardada(s)${job.maxPages===null?' · ∞':''}`;
  root.querySelector('.meter').classList.toggle('unlimited',job.maxPages===null&&job.status==='running');
  el('activity').textContent=job.stopRequested?'● Deteniendo':`● ${job.status}`;
  el('fill').style.width=Math.min(100,Math.round(n/total*100))+'%';
  el('path').textContent=job.current||job.message||'Analizando enlaces...';
  if(['completed','error'].includes(job.status)){
   el('fill').style.width=job.status==='completed'?'100%':el('fill').style.width;
   // The overlay remains on screen after the final navigation so completion is visible.
  }
 }
 chrome.storage.local.get('crawlStatus').then(v=>paint(v.crawlStatus?.job)).catch(()=>{});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.crawlStatus)paint(changes.crawlStatus.newValue?.job);});
})();
