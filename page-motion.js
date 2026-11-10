/* Visual transitions only. DOM rendering, routes and form handlers stay synchronous. */
export const MOTION={fadeOut:220,fadeIn:460,card:720,stagger:120,maxDelay:600,lead:120};
export const CARD_FRAMES=[
 {opacity:0,transform:'translateY(32px) scale(.91)',offset:0},
 {opacity:1,transform:'translateY(-8px) scale(1.035)',offset:.60},
 {opacity:1,transform:'translateY(3px) scale(.99)',offset:.82},
 {opacity:1,transform:'translateY(0) scale(1)',offset:1}
];
export const CARD_SELECTOR='.institution-directory > .site-panel,.cards > .card,.content > .site-panel,.content > .order,.content > .form-page,.quick-grid > .quick,.learning-groups > .learning-card,.institution-course-list > .site-panel,.tour-layout > .site-panel,.gk-grid > .gk-uni,.ex-grid > .ex-card,.stats > .stat';
export function cardDelay(index){return Math.min(Math.max(0,index)*MOTION.stagger,MOTION.maxDelay);}
export function cardKey(el){
 const action=el.querySelector('[data-detail],[data-merchant],[data-gk-uni],[data-ex-item],[data-institution-edit],[data-page]');
 const target=action?['detail','merchant','gkUni','exItem','institutionEdit','page'].map(k=>action.dataset[k]||'').join('|'):'';
 return el.tagName+'|'+target+'|'+(el.querySelector('h2,h3,strong')?.textContent||el.textContent).trim().slice(0,160);
}
export function createPageMotion(root){
 const win=root.ownerDocument.defaultView,doc=root.ownerDocument,reduce=win.matchMedia('(prefers-reduced-motion: reduce)');
 let previous=null,changed=false,seen=new Set(),snapshot=null,contentStart=null;
 const entrances=new Map();
 const running=new Set();
 function animate(el,frames,options,done){
  const animation=el.animate(frames,{...options,fill:'both'});running.add(animation);
  animation.finished.then(()=>{running.delete(animation);animation.cancel();done?.();},()=>{running.delete(animation);done?.();});
 }
 function stop(){for(const animation of running)animation.cancel();running.clear();if(snapshot){snapshot.remove();snapshot=null;}}
 function before(key){
  changed=key!==previous;
  if(!changed)return;
  stop();seen=new Set();entrances.clear();contentStart=null;
  const content=root.querySelector('.content');
  const sameAccount=previous!==null&&previous.split('|').slice(0,2).join('|')===key.split('|').slice(0,2).join('|');
  if(sameAccount&&!win.matchMedia('(max-width: 900px)').matches&&!reduce.matches&&content&&typeof content.animate==='function'){
   const rect=content.getBoundingClientRect(),copy=content.cloneNode(true);
   copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
   copy.classList.add('motion-outgoing-content');
   Object.assign(copy.style,{position:'absolute',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',margin:'0'});
   const layer=doc.createElement('div');layer.className='motion-outgoing';layer.inert=true;layer.setAttribute('aria-hidden','true');
   layer.append(copy);doc.body.append(layer);snapshot=layer;
  }
  previous=key;
 }
 function after(){
  const content=root.querySelector('.content');if(!content)return;
  // Full DOM refreshes on the same page must continue, not silently cancel, entrances.
  for(const animation of running)if(!animation.effect?.target?.isConnected)animation.cancel();
  const now=win.performance.now();
  const cards=[...content.querySelectorAll(CARD_SELECTOR)];
  if(win.matchMedia('(max-width: 900px)').matches||reduce.matches||typeof content.animate!=='function'){for(const card of cards)seen.add(cardKey(card));stop();changed=false;return;}
  if(snapshot){const layer=snapshot;snapshot=null;animate(layer,[{opacity:1},{opacity:0}],{duration:MOTION.fadeOut,easing:'ease-out'},()=>layer.remove());}
  if(changed)contentStart=now;
  if(contentStart!==null&&now<contentStart+MOTION.fadeIn)animate(content,[{opacity:0},{opacity:1}],{duration:MOTION.fadeIn,delay:contentStart-now,easing:'ease-out'});
  let index=0;
  for(const card of cards){
   const key=cardKey(card);
   if(!seen.has(key)){
    seen.add(key);entrances.set(key,now+cardDelay(index++)+(changed?MOTION.lead:0));
   }
   const start=entrances.get(key);
   if(start===undefined||now>=start+MOTION.card)continue;
   animate(card,CARD_FRAMES,{duration:MOTION.card,delay:start-now,easing:'cubic-bezier(.22,.65,.3,1)'});
  }
  changed=false;
 }
 reduce.addEventListener('change',stop);
 return {before,after,destroy(){stop();reduce.removeEventListener('change',stop);}};
}
