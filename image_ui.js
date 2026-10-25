/* Approved artwork + lossless visible-state snapshots. No experiment state access. */
(()=>{
 'use strict';
 const VERSION='20261025-atomic-views',BASE=new URL('.',document.baseURI),url=p=>new URL(p,BASE).href;
 const blobCache=new Map(),images=new Map(),renderCache=new Map(),lastKey=new WeakMap();
 let manifest,fontData,queued=false,running=false,again=false,lastError=null;
 const cacheLimit=180;
 const ROOTS='.stone-tile,.potion-tile,.history-card,.stat,#historyToggle,#actionDetails,#actionSub,#completeSummary,.resource-loader-meta,#resourceLoaderStatus,#noticeMessage,#participantError,.history-empty';
 const presentations=new WeakMap(),decodedBackgrounds=new Map();
 const frame=()=>new Promise(requestAnimationFrame);
 const rootsIn=scope=>[...(scope.matches?.(ROOTS)?[scope]:[]),...scope.querySelectorAll(ROOTS)].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
 const props=('box-sizing display position z-index top right bottom left width height min-width min-height max-width max-height margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left gap row-gap column-gap grid-template-columns grid-template-rows grid-column-start grid-column-end grid-row-start grid-row-end grid-auto-flow align-items justify-items justify-content align-content align-self justify-self flex-direction flex-wrap flex-grow flex-shrink flex-basis order font-family font-size font-weight font-style letter-spacing line-height text-align text-decoration text-shadow white-space word-break overflow-wrap writing-mode text-orientation color background-color background-image background-size background-position background-repeat border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius border-image-source border-image-slice border-image-width border-image-outset border-image-repeat box-shadow opacity transform transform-origin overflow overflow-x overflow-y object-fit object-position filter vertical-align').split(' ');
 function dataURI(path){
  if(!path||path.startsWith('data:'))return Promise.resolve(path);
  const absolute=url(path);
  if(!blobCache.has(absolute))blobCache.set(absolute,fetch(absolute).then(r=>{if(!r.ok)throw Error('Image UI asset HTTP '+r.status);return r.blob();}).then(b=>new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(b);})));return blobCache.get(absolute);
 }
 async function embedded(value){
  const matches=[...value.matchAll(/url\((['"]?)(.*?)\1\)/g)];
  for(const m of matches){if(m[2].startsWith('data:'))continue;value=value.replace(m[0],`url("${await dataURI(m[2])}")`);}return value;
 }
 async function copyStyle(source,target,pseudo){
  const style=getComputedStyle(source,pseudo);
  for(const key of props){let value=style.getPropertyValue(key);if(value.includes('url('))value=await embedded(value);if(value)target.style.setProperty(key,value);}
  target.style.setProperty('visibility','visible','important');
  target.style.setProperty('-webkit-text-fill-color','currentColor','important');
  target.style.setProperty('color',source.classList.contains('image-ui-label')||source.classList.contains('image-ui-button')?'transparent':'#ead09a','important');
  target.style.animation='none';target.style.transition='none';return style;
 }
 async function cloneVisible(source,isRoot=false){
  if(source.nodeType===Node.TEXT_NODE)return document.createTextNode(source.textContent);
  if(source.nodeType!==Node.ELEMENT_NODE||source.classList.contains('image-ui-layer'))return null;
  const copy=source.cloneNode(false);copy.removeAttribute('id');copy.removeAttribute('autofocus');copy.removeAttribute('aria-live');
  await copyStyle(source,copy);
  if(copy.tagName==='IMG'){copy.removeAttribute('srcset');copy.src=await dataURI(source.currentSrc||source.src);copy.loading='eager';}
  const before=getComputedStyle(source,'::before');
  if(before.content!=='none'&&before.content!=='normal'&&before.display!=='none'){
   const node=document.createElement('span');await copyStyle(source,node,'::before');node.style.pointerEvents='none';node.textContent=before.content.replace(/^['"]|['"]$/g,'');copy.append(node);
  }
  for(const child of source.childNodes){const c=await cloneVisible(child);if(c)copy.append(c);}
  const after=getComputedStyle(source,'::after');
  if(after.content!=='none'&&after.content!=='normal'&&after.display!=='none'){
   const node=document.createElement('span');await copyStyle(source,node,'::after');node.style.pointerEvents='none';node.textContent=after.content.replace(/^['"]|['"]$/g,'');copy.append(node);
  }
  if(isRoot){const r=source.getBoundingClientRect();Object.assign(copy.style,{position:'relative',top:'0',left:'0',right:'auto',bottom:'auto',width:r.width+'px',height:r.height+'px',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',margin:'0',transform:'none',filter:'none',opacity:'1',overflow:'hidden'});}
  return copy;
 }
 const escape=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 async function paint(el,key){
  const r=el.getBoundingClientRect(),w=Math.max(1,Math.round(r.width*2)),h=Math.max(1,Math.round(r.height*2));
  if(el.matches('.stat,.potion-tile')){
   const label=el.querySelector('span')?.textContent.trim(),entry=el.matches('.stat')?manifest.status[label]:manifest.potionCards[label];
   if(!entry)throw Error('Missing integrated card: '+label);
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(images.get(entry.file),0,0,w,h);
   if(el.matches('.stat')){
    const value=el.querySelector('strong').textContent.trim();await document.fonts.load('850 32px "Alchemy Serif"');
    const size=Math.min(h*.34,w*.17);ctx.font=`850 ${size}px "Alchemy Serif"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.shadowOffsetY=2;
    const gold=ctx.createLinearGradient(0,h*.59,0,h*.90);gold.addColorStop(0,'#fff2cf');gold.addColorStop(.6,'#edcd8e');gold.addColorStop(1,'#c48b3e');ctx.fillStyle=gold;ctx.fillText(value,w*.5,h*.746,w*.76);
   }
   if(el.matches('.potion-tile.selected')){ctx.strokeStyle='#ffe4a2';ctx.lineWidth=Math.max(2,w*.018);ctx.shadowColor='#e0b253';ctx.shadowBlur=9;ctx.strokeRect(w*.022,h*.018,w*.956,h*.964);}
   return canvas.toDataURL('image/png');
  }
  const clone=await cloneVisible(el,true);if(!el.isConnected)return null;
  const html=new XMLSerializer().serializeToString(clone);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${r.width} ${r.height}"><style>@font-face{font-family:'Alchemy Serif';font-style:normal;font-weight:100 900;src:url('${fontData}') format('woff2');}</style><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await im.decode();
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(im,0,0);return canvas.toDataURL('image/png');
 }
 function contentKey(el){
  const r=el.getBoundingClientRect(),body=[...el.childNodes].filter(n=>!(n.nodeType===1&&n.classList.contains('image-ui-layer'))).map(n=>n.outerHTML||n.textContent).join('');
  const classes=[...el.classList].filter(n=>!n.startsWith('image-ui-')&&!n.startsWith('fx-')).sort().join(' ');
  return [el.tagName,classes,el.getAttribute('disabled'),el.getAttribute('aria-expanded'),Math.round(r.width*10),Math.round(r.height*10),body].join('|');
 }
 async function raster(el){
  const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;
  const key=contentKey(el);if(lastKey.get(el)===key&&el.querySelector(':scope>.image-ui-layer'))return;
  if(!renderCache.has(key)){renderCache.set(key,paint(el,key).catch(error=>{renderCache.delete(key);throw error;}));if(renderCache.size>cacheLimit)renderCache.delete(renderCache.keys().next().value);}
  const result=await renderCache.get(key);if(!result||!el.isConnected||contentKey(el)!==key){again=true;return;}
  // Decode off-DOM. Never clear a visible image's src while preparing its replacement.
  const previous=el.querySelector(':scope>.image-ui-layer');
  if(!previous||previous.src!==result){
   const layer=Object.assign(new Image(),{className:'image-ui-layer',alt:'',draggable:false});
   layer.setAttribute('aria-hidden','true');layer.src=result;await layer.decode();
   if(!el.isConnected||contentKey(el)!==key){again=true;return;}
   if(previous)previous.replaceWith(layer);else el.append(layer);
  }
  el.classList.add('image-ui-snapshot');lastKey.set(el,contentKey(el));
  if(el.tagName!=='BUTTON'||el.id==='historyToggle'||!el.hasAttribute('aria-label')){
   const text=el.textContent.trim().replace(/\s+/g,' '),values=[...el.querySelectorAll('.thermometer[aria-label]')].map(n=>n.getAttribute('aria-label'));
   el.setAttribute('aria-label',[text,...values].filter(Boolean).join('；'));
   if(el.tagName!=='BUTTON'&&!el.hasAttribute('role'))el.setAttribute('role','img');
  }
 }
 function artwork(el,entry,type,label){
  if(!entry||el.dataset.imageUiLabel===label&&el.classList.contains(type))return;el.classList.add(type);el.style.setProperty('--image-ui-art',`url("${url(entry.file)}")`);
  if(type==='image-ui-label'){
   for(const [name,value] of Object.entries({'background':`transparent url("${url(entry.file)}") center / 100% 100% no-repeat`,'border-image':'none','border':'0','padding':'0','min-height':'0','min-width':'0','color':'transparent','text-shadow':'none'}))el.style.setProperty(name,value,'important');
  }
  el.style.setProperty('font-size','0px','important');el.style.setProperty('line-height','0px','important');
  if(type==='image-ui-button'){el.style.aspectRatio=`${entry.width}/${entry.height}`;el.setAttribute('aria-label',label);}
  else if(el.matches('h1,h2')){const width=label.length>5?280:label.length>3?215:150;el.style.setProperty('width',`min(100%,${width}px)`,'important');el.style.setProperty('height',(width*entry.height/entry.width)+'px','important');}
  el.dataset.imageUiLabel=label;
 }
 function fixed(){
  document.querySelectorAll('button.button').forEach(el=>{const label=el.textContent.trim().replace(/\s+/g,' ');artwork(el,manifest.buttons[label],'image-ui-button',label);});
  document.querySelectorAll('.game-grid h2,.intro-dialog h2,#actionTitle,#resourceLoaderTitle,.compare-label,.detail-label,.stone-copy strong,#mode').forEach(el=>{
   const label=el.textContent.trim().replace(/\s+/g,' ');artwork(el,manifest.tags[label],'image-ui-label',label);
  });
  document.querySelectorAll('.history-potion-label').forEach(el=>artwork(el,manifest.verticalPotion,'image-ui-label','药水'));
 }
 async function refresh(){
  if(running){again=true;return;}
  running=true;
  try{
   await ready;fixed();
   const roots=[...document.querySelectorAll(ROOTS)];
   await Promise.all(roots.map(raster));lastError=null;
  }catch(error){lastError=String(error);console.error('Image UI rendering failed',error);throw error;}
  finally{running=false;if(again){again=false;schedule();}}
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh().catch(()=>{});});}
 function isCurrent(el){const im=el.querySelector(':scope>.image-ui-layer');return !!im&&im.complete&&im.naturalWidth>0&&lastKey.get(el)===contentKey(el);}
 async function flush(scope=document){
  await ready;
  for(let attempt=0;attempt<40;attempt++){
   while(running)await new Promise(r=>setTimeout(r,5));
   await refresh();
   if(rootsIn(scope).every(isCurrent))return;
   await frame();
  }
  throw Error('Visible image composition did not settle');
 }
 async function prepare(scope){
  await ready;fixed();await document.fonts.ready;
  await Promise.all([...scope.querySelectorAll('img')].map(im=>im.decode()));
  const backgrounds=new Set();
  for(const el of [scope,...scope.querySelectorAll('*')])for(const pseudo of [null,'::before','::after']){
   const style=getComputedStyle(el,pseudo);
   for(const property of ['background-image','border-image-source'])for(const match of style.getPropertyValue(property).matchAll(/url\((["']?)(.*?)\1\)/g))backgrounds.add(match[2]);
  }
  await Promise.all([...backgrounds].map(src=>{
   if(!decodedBackgrounds.has(src)){const im=new Image();im.src=url(src);decodedBackgrounds.set(src,im.decode().catch(error=>{decodedBackgrounds.delete(src);throw error;}));}
   return decodedBackgrounds.get(src);
  }));
  await flush(scope);await frame();
  // Recheck after layout/font changes have reached a rendering opportunity.
  await flush(scope);
 }
 async function recoverPreparation(scope,error){
  lastError=String(error);
  await new Promise(resolve=>document.dispatchEvent(new CustomEvent('alchemy:visual-error',{detail:{error:String(error),retry:async()=>{
   for(const im of scope.querySelectorAll('img'))if(im.complete&&!im.naturalWidth)im.src=im.src;
   await prepare(scope);resolve();
  }}})));
 }
 async function presentDialog(dialog,show=()=>dialog.showModal()){
  const token={};presentations.set(dialog,token);dialog.classList.add('image-ui-staging');
  show();const focus=dialog.contains(document.activeElement)?document.activeElement:null;
  try{await prepare(dialog);}catch(error){if(presentations.get(dialog)!==token||!dialog.open)return false;await recoverPreparation(dialog,error);}
  if(presentations.get(dialog)!==token||!dialog.open)return false;
  dialog.classList.remove('image-ui-staging');presentations.delete(dialog);
  (focus&&!focus.disabled?focus:dialog.querySelector('input,button:not(:disabled),[tabindex="0"]'))?.focus({preventScroll:true});
  return true;
 }
 async function presentHistory(list,show){
  const token={};presentations.set(list,token);const panel=list.closest('.history-panel');
  panel.style.setProperty('--image-ui-collapsed-height',panel.getBoundingClientRect().height+'px');panel.classList.add('image-ui-history-preparing');list.classList.add('image-ui-staging');show();
  try{await prepare(list);}catch(error){if(presentations.get(list)!==token)return false;await recoverPreparation(list,error);}
  if(presentations.get(list)!==token)return false;
  list.classList.remove('image-ui-staging');panel.classList.remove('image-ui-history-preparing');presentations.delete(list);return true;
 }
 async function presentSection(scope,show){
  const token={};presentations.set(scope,token);scope.classList.add('image-ui-staging','image-ui-section-preparing');show();
  try{await prepare(scope);}catch(error){if(presentations.get(scope)!==token)return false;await recoverPreparation(scope,error);}
  if(presentations.get(scope)!==token)return false;
  scope.classList.remove('image-ui-staging','image-ui-section-preparing');presentations.delete(scope);return true;
 }
 function cancelPresentation(scope){presentations.delete(scope);scope.classList.remove('image-ui-staging','image-ui-section-preparing');scope.closest('.history-panel')?.classList.remove('image-ui-history-preparing');}
 async function initialize(){
  const response=await fetch(url('assets/image_ui/manifest.json?v='+VERSION));if(!response.ok)throw Error('Image UI manifest unavailable');manifest=await response.json();
  const entries=[...Object.values(manifest.buttons),...Object.values(manifest.tags),manifest.verticalPotion,...Object.values(manifest.status),...Object.values(manifest.potionCards)];
  await Promise.all(entries.map(async e=>{const im=new Image();im.src=url(e.file);await im.decode();images.set(e.file,im);await dataURI(e.file);}));
  fontData=await dataURI('assets/fonts/alchemy-serif-ui.woff2');await document.fonts.ready;
 }
 let ready=initialize();
 const observer=new MutationObserver(records=>{
  const visualClasses=value=>(value||'').split(/\s+/).filter(n=>n&&!n.startsWith('image-ui-')&&!n.startsWith('fx-')).sort().join(' ');
  if(records.some(r=>{
   if(r.type==='attributes')return r.attributeName==='class'?visualClasses(r.oldValue)!==visualClasses(r.target.getAttribute('class')):r.oldValue!==r.target.getAttribute(r.attributeName);
   return r.type==='characterData'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType!==1||!n.classList.contains('image-ui-layer'));
  }))schedule();
 });
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['class','disabled','aria-expanded']});
 document.addEventListener('click',schedule,true);document.addEventListener('focusin',schedule,true);window.addEventListener('resize',schedule);
 window.AlchemyImageUI=Object.freeze({get ready(){return ready;},refresh,prepare,presentDialog,presentHistory,presentSection,cancelPresentation,isCurrent,retry:()=>{blobCache.clear();renderCache.clear();decodedBackgrounds.clear();ready=initialize();ready.then(()=>{lastError=null;schedule();}).catch(error=>{lastError=String(error);});return ready;},flush,status:()=>({version:VERSION,cache:renderCache.size,error:lastError,running,queued})});
 ready.then(schedule).catch(error=>{lastError=String(error);console.error(error);});
})();
