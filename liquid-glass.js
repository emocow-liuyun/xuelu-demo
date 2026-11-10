/* Decorative only: never handles click, submit, focus or navigation actions. */
export const ALL_FILTER_SELECTOR='[data-filter="all"],[data-order-type="all"],[data-order-status="all"],[data-learning-category="全部"],[data-learning-subject="全部"]';
export function glassPoint(rect,x,y){
 return {x:Math.max(0,Math.min(rect.width,x-rect.left)),y:Math.max(0,Math.min(rect.height,y-rect.top))};
}
export function installLiquidGlass(doc=document){
 const win=doc.defaultView;
 const reduce=win.matchMedia('(prefers-reduced-motion: reduce)');
 let moveFrame=0,decorateFrame=0,last=null,active=new Set(),pressed=null;
 function decorate(){
  decorateFrame=0;
  doc.querySelectorAll('.nav,.search').forEach(el=>el.classList.add('glass-surface'));
  doc.querySelectorAll('button').forEach(el=>el.classList.add('glass-button'));
  doc.querySelectorAll(ALL_FILTER_SELECTOR).forEach(el=>el.classList.add('glass-all'));
 }
 function clear(){
  if(moveFrame)win.cancelAnimationFrame(moveFrame);moveFrame=0;last=null;
  for(const el of active)el.classList.remove('glass-tracking');active.clear();
  if(pressed)pressed.classList.remove('glass-pressed');pressed=null;
 }
 function paint(){
  moveFrame=0;if(!last||reduce.matches)return;
  const {target,x,y}=last;
  const button=target.closest?.('.glass-button:not(:disabled)');
  const surface=target.closest?.('.glass-surface');
  const next=new Set([button,surface].filter(el=>el&&el.isConnected));
  for(const el of active)if(!next.has(el))el.classList.remove('glass-tracking');
  for(const el of next){
   const point=glassPoint(el.getBoundingClientRect(),x,y);
   el.style.setProperty('--glass-x',point.x+'px');el.style.setProperty('--glass-y',point.y+'px');
   el.classList.add('glass-tracking');
  }
  active=next;
 }
 function move(event){
  if(reduce.matches||event.pointerType==='touch')return;
  last={target:event.target,x:event.clientX,y:event.clientY};
  if(!moveFrame)moveFrame=win.requestAnimationFrame(paint);
 }
 function down(event){
  if(reduce.matches||event.button!==0)return;
  const button=event.target.closest?.('.glass-button:not(:disabled)');
  if(!button)return;
  if(pressed)pressed.classList.remove('glass-pressed');
  pressed=button;pressed.classList.add('glass-pressed');move(event);
 }
 function up(){if(pressed)pressed.classList.remove('glass-pressed');pressed=null;}
 function out(event){if(!event.relatedTarget){clear();return;}move(event);}
 const observer=new win.MutationObserver(()=>{if(!decorateFrame)decorateFrame=win.requestAnimationFrame(decorate);});
 decorate();observer.observe(doc.body,{childList:true,subtree:true});
 doc.addEventListener('pointermove',move,{passive:true});doc.addEventListener('pointerdown',down,{passive:true});
 doc.addEventListener('pointerup',up,{passive:true});doc.addEventListener('pointercancel',clear,{passive:true});
 doc.addEventListener('pointerout',out,{passive:true});win.addEventListener('blur',clear);reduce.addEventListener('change',clear);
 return ()=>{
  clear();observer.disconnect();if(decorateFrame)win.cancelAnimationFrame(decorateFrame);
  doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerdown',down);doc.removeEventListener('pointerup',up);
  doc.removeEventListener('pointercancel',clear);doc.removeEventListener('pointerout',out);win.removeEventListener('blur',clear);reduce.removeEventListener('change',clear);
 };
}
if(typeof document!=='undefined')installLiquidGlass();
