import {visibleServices} from './audience.js';

export const DISCOVERY_TABS=[['all','精选'],['course','课程'],['tutor','伴学'],['bus','接送端']];
export function discoveryItems(services,{role='parent',tab='all',search=''}={}){
 const q=String(search).trim().toLocaleLowerCase();
 return visibleServices(services,role).filter(s=>['course','tutor','bus'].includes(s.type)&&(tab==='all'||s.type===tab)&&(!q||[s.title,s.merchant,s.category,s.location,s.description].join(' ').toLocaleLowerCase().includes(q)));
}
export function discoveryView({services,role,tab='all',search='',esc,card}){
 const selected=DISCOVERY_TABS.some(([id])=>id===tab)?tab:'all';
 const list=discoveryItems(services,{role,tab:selected,search});
 const sections=selected==='all'?[['course','成长课程','按课程内容找服务，详情中查看提供方、套餐和视频。'],['tutor','伴学服务','阅读陪伴、作业陪伴、习惯培养与时间管理。'],['bus','接送服务','保留现有接送线路，查看起终点、经停点和接送时间。']]:[[selected,DISCOVERY_TABS.find(([id])=>id===selected)[1],selected==='bus'?'沿用现有线路，详情中查看路线与站点。':'按当前身份与服务人群展示，点击卡片查看详情。']];
 return `<section class="discovery-intro site-panel"><div class="eyebrow">FIND YOUR NEXT STEP</div><h2>学习与陪伴，从这里开始</h2><p class="muted">课程、伴学与接送，提供方信息在详情中查看。</p><div class="discovery-paths"><button type="button" data-page="demands">✎ 发布我的需求</button><button type="button" data-page="favorites">♡ 我的收藏</button><button type="button" data-page="course">▦ 学习资源</button><button type="button" data-page="ai">✦ AI 学习</button><button type="button" data-page="tutor">♧ 伴学服务</button><button type="button" data-page="bus">▱ 接送服务</button></div></section>
 <section class="discovery" aria-label="服务精选"><div class="discovery-lead"><p class="muted">${search?'搜索结果 · '+list.length+' 项':'发现课程、伴学与接送服务'}</p></div><nav class="site-tabs discovery-tabs" aria-label="服务分类">${DISCOVERY_TABS.map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${selected===id}" class="${selected===id?'active':''}">${label}</button>`).join('')}</nav>
 ${sections.map(([type,title,hint])=>{const rows=list.filter(s=>s.type===type);return `<section class="discovery-section" data-discovery-section="${type}"><div class="section-head"><div><h3>${title}</h3><p class="muted">${hint}</p></div><button type="button" class="secondary" data-page="${type}">筛选与查看全部 →</button></div><div class="cards">${rows.length?rows.map(card).join(''):`<div class="empty">${search?'没有匹配的服务，请调整关键词。':'暂无可展示的'+title+'，后续发布后会显示在这里。'}</div>`}</div></section>`;}).join('')}</section>`;
}
