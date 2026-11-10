import {visitorRole,roleNavigation,activeNavigation,roleHome} from './navigation.js';
const root=document.querySelector('#app');
const compact=window.matchMedia('(max-width: 900px)');
function sync(){
 if(!root.querySelector('.shell'))return;
 let nav=root.querySelector('.mobile-bottom-nav');
 if(!nav){nav=document.createElement('nav');nav.className='mobile-bottom-nav';nav.setAttribute('aria-label','手机主导航');root.append(nav);}
 const role=visitorRole(),page=root.dataset.page||roleHome(role);
 const ids=role==='shuttle'?['join','provider','ai','profile']:role==='institution'?['institution','join','ai','profile']:role==='tutor'?['student','resources','ai','profile']:['home','course','orders','profile'];
 const labels={home:['⌂','首页'],course:['▦','学习'],orders:['▤','订单'],profile:['◉','我的'],student:['⌂','首页'],resources:['▦','学习'],ai:['✦','AI 学习'],institution:['▧','工作台'],join:['＋','入驻'],provider:['▤','接单'],verification:['✓','核验']};
 const active=activeNavigation(page,role,'desktop',root.dataset.serviceType);
 const selected=ids.includes(active)?active:(page==='companion'||page==='exam'?'student':page==='tutor'||page==='bus'||page==='gaokao'?'home':roleHome(role));
 nav.style.gridTemplateColumns=`repeat(${ids.length},minmax(0,1fr))`;
 const markup=ids.map(id=>`<button type="button" data-page="${id}" class="${selected===id?'active':''}" ${selected===id?'aria-current="page"':''}><span aria-hidden="true">${(labels[id]||['•','页面'])[0]}</span><small>${(labels[id]||['','页面'])[1]}</small></button>`).join('');
 if(nav.innerHTML!==markup)nav.innerHTML=markup;
 nav.hidden=!compact.matches;
 let brand=root.querySelector('.mobile-brand');
 if(!brand){brand=document.createElement('a');brand.className='mobile-brand';root.querySelector('.topbar').prepend(brand);}
 brand.href='#'+roleHome(role);brand.textContent='学鹭伴学';
 let shortcuts=root.querySelector('.mobile-shortcuts');
 if(!shortcuts){shortcuts=document.createElement('nav');shortcuts.className='mobile-shortcuts';shortcuts.setAttribute('aria-label','更多服务');root.querySelector('.greeting')?.after(shortcuts);}
 shortcuts.hidden=page==='ai';
 const shortcutMarkup=roleNavigation(role).filter(([id])=>!ids.includes(id)).map(([id,,label])=>`<button type="button" data-page="${id}" ${page===id?'aria-current="page"':''}>${label}</button>`).join('');
 if(shortcuts.innerHTML!==shortcutMarkup)shortcuts.innerHTML=shortcutMarkup;
}
new MutationObserver(sync).observe(root,{childList:true});
compact.addEventListener('change',sync);window.addEventListener('hashchange',sync);window.addEventListener('xuelu-role-change',sync);sync();
if(window.visualViewport){const viewport=window.visualViewport;const update=()=>{const keyboard=window.innerHeight-viewport.height>150&&/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'');document.documentElement.classList.toggle('mobile-keyboard-open',keyboard);document.documentElement.style.setProperty('--visible-height',viewport.height+'px');document.documentElement.style.setProperty('--mobile-viewport-height',viewport.height+'px');document.documentElement.style.setProperty('--mobile-keyboard-inset',Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)+'px');};viewport.addEventListener('resize',update);document.addEventListener('focusout',update);}
