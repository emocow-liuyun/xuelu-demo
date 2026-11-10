/* 学业规划（全部为模拟数据）前端模块。

   数据来自服务端 /api/gaokao/*，本模块只负责呈现与交互：
     · 院校列表（筛选 / 排序 / 分页）
     · 院校详情（十年折线图 + 专业参考分表 + 各省参考线表）
     · 冲稳保推荐

   页面是同步渲染的：page() 只返回 HTML，异步数据在后台取到后再调用外部传入的
   render() 重绘。所有请求都带序号（seq）与 loading 标志，避免 render → page →
   render 递归，也避免旧响应覆盖新筛选的结果。*/

const TIERS=['985','211','本科','专科'];
const ALL='全部';

export function createGaokao({esc,toast,api,render,storageScope=()=> 'visitor'}){
 const S={
  meta:null,metaLoading:false,metaError:'',
  view:'list',
  f:{q:'',province:ALL,tier:ALL,type:ALL,alliance:ALL,sort:'rank',scoreProvince:'黑龙江',year:2025},
  page:1,size:12,
  list:null,listLoading:false,listError:'',listSeq:0,
  uni:null,detail:null,detailLoading:false,detailError:'',detailSeq:0,
  majorSort:{key:'line',dir:'desc'},
  rec:{open:true,score:'',subject:'物理',province:'黑龙江',tier:ALL,type:ALL,alliance:ALL,result:null,loading:false,error:'',seq:0},
  plan:{items:[],loaded:false}
 };

 /* ---------------- 小工具 ---------------- */
 const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
 const fmtScore=v=>num(v)===null?'—':(Math.round(num(v)*10)/10).toFixed(1);
 const fmtInt=v=>num(v)===null?'—':String(Math.round(num(v)));
 const tierClass=t=>({'985':'gk-985','211':'gk-211','本科':'gk-ben','专科':'gk-zhuan'}[t]||'gk-ben');
 const sub=(a,b)=>a<b?-1:a>b?1:0;

 function skeleton(text){
  return `<div class="gk-skeleton" aria-live="polite"><span class="gk-spinner" aria-hidden="true"></span><span>${esc(text)}</span></div>`;
 }
 function errorBox(text,retry){
  return `<div class="gk-error"><strong>加载失败</strong><p>${esc(text||'请稍后重试')}</p>${retry?`<button class="secondary" ${retry}>重试</button>`:''}</div>`;
 }
 function emptyBox(text){return `<div class="empty">${esc(text)}</div>`;}

 /* ---------------- 取数 ---------------- */
 function ensureMeta(){
  if(S.meta||S.metaLoading||S.metaError)return;
  S.metaLoading=true;
  api('/gaokao/meta').then(meta=>{
   S.meta=meta;S.metaLoading=false;
   const provinces=Array.isArray(meta.provinces)?meta.provinces:[];
   if(provinces.length&&!provinces.some(p=>p.name===S.f.scoreProvince))S.f.scoreProvince=provinces[0].name;
   if(!S.rec.province||S.rec.province===ALL)S.rec.province=S.f.scoreProvince;
   if(Array.isArray(meta.years)&&meta.years.length&&!meta.years.includes(S.f.year))S.f.year=Math.max(...meta.years);
   if(!S.list&&!S.listLoading)loadList();
   render();
  }).catch(error=>{
   S.metaLoading=false;S.metaError=error?.message||'院校基础数据加载失败';
   render();
  });
 }

 function ensureList(){
  if(S.list||S.listLoading||S.listError)return;
  loadList();
 }

 function listQuery(){
  const q=new URLSearchParams();
  const f=S.f;
  q.set('province',f.province===ALL?'':f.province);
  q.set('tier',f.tier===ALL?'':f.tier);
  q.set('type',f.type===ALL?'':f.type);
  q.set('alliance',f.alliance===ALL?'':f.alliance);
  q.set('q',f.q.trim());
  q.set('sort',f.sort);
  q.set('page',String(S.page));
  q.set('size',String(S.size));
  q.set('scoreProvince',f.scoreProvince);
  q.set('year',String(f.year));
  return '/gaokao/universities?'+q.toString();
 }

 function loadList(){
  const seq=++S.listSeq;
  S.listLoading=true;S.listError='';
  api(listQuery()).then(data=>{
   if(seq!==S.listSeq)return;
   S.list=data;S.listLoading=false;
   if(num(data.page)&&data.page!==S.page)S.page=num(data.page);
   render();
  }).catch(error=>{
   if(seq!==S.listSeq)return;
   S.listLoading=false;S.listError=error?.message||'院校列表加载失败';
   render();
  });
 }

 function loadDetail(id){
  const seq=++S.detailSeq;
  S.detailLoading=true;S.detailError='';
   api(`/gaokao/universities/${encodeURIComponent(id)}?province=${encodeURIComponent(S.f.scoreProvince)}&year=${S.f.year}`).then(data=>{
   if(seq!==S.detailSeq)return;
   S.detail=data;S.detailLoading=false;
   render();
  }).catch(error=>{
   if(seq!==S.detailSeq)return;
   S.detailLoading=false;S.detailError=error?.message||'院校详情加载失败';
   render();
  });
 }

 function runRecommend(values){
  const scoreText=String(values.score??S.rec.score??'').trim();
  const score=Number(scoreText);
  const province=values.province||S.rec.province;
  const subject=values.subject||S.rec.subject;
  const tier=values.tier||S.rec.tier||ALL;
  const type=values.type||S.rec.type||ALL;
  const alliance=values.alliance||S.rec.alliance||ALL;
  S.rec.province=province;S.rec.subject=subject;S.rec.score=scoreText;
  S.rec.tier=tier;S.rec.type=type;S.rec.alliance=alliance;
  S.rec.error='';S.rec.result=null;
  if(!scoreText||!Number.isFinite(score)||score<=0){S.rec.error='请输入有效的分数';S.rec.loading=false;render();return;}
  const seq=++S.rec.seq;
  S.rec.loading=true;S.rec.open=true;
  render();
  const q=new URLSearchParams({province,score:String(score),subject,year:String(S.f.year),limit:'12'});
  if(tier&&tier!==ALL)q.set('tier',tier);
  if(type&&type!==ALL)q.set('type',type);
  if(alliance&&alliance!==ALL)q.set('alliance',alliance);
  api('/gaokao/recommend?'+q.toString()).then(result=>{
   if(seq!==S.rec.seq)return;
   S.rec.result=result;S.rec.loading=false;
   render();
  }).catch(error=>{
   if(seq!==S.rec.seq)return;
   S.rec.loading=false;S.rec.error=error?.message||'推荐请求失败';
   render();
  });
 }

 /* ---------------- 列表页 ---------------- */
 // filterAttr 为 false 时不挂 data-gk-filter：推荐面板里的下拉不能触发列表筛选
 function selectField(name,label,values,current,all,filterAttr=true){
  const options=(all?[all]:[]).concat(values);
  const attr=filterAttr?` data-gk-filter="${name}"`:'';
  return `<label class="gk-field">${label}<select${attr} name="${name}">${options.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
 }

 function filterBar(){
  const m=S.meta||{};
  const provinces=(m.provinces||[]).map(p=>p.name);
  const years=(m.years||[]).slice().sort((a,b)=>b-a);
  return `<form id="gk-filter-form" class="gk-filters">
   <div class="gk-filter-row">
    <label class="gk-field gk-keyword">关键词<input id="gk-q" name="q" type="search" value="${esc(S.f.q)}" maxlength="30" placeholder="校名或城市，如 清华 / 哈尔滨" autocomplete="off"></label>
    ${selectField('province','所在省份',provinces,S.f.province,ALL)}
    ${selectField('tier','院校层次',TIERS,S.f.tier,ALL)}
    ${selectField('type','院校类型',m.types||[],S.f.type,ALL)}
    ${selectField('alliance','所属联盟',m.alliances||[],S.f.alliance,ALL)}
    <label class="gk-field">排序<select data-gk-filter="sort" name="sort">
     ${[['rank','综合排名'],['line-desc','参考分数线从高到低'],['line-asc','参考分数线从低到高'],['name','校名']].map(([v,t])=>`<option value="${v}" ${S.f.sort===v?'selected':''}>${t}</option>`).join('')}
    </select></label>
    ${selectField('scoreProvince','分数参考省份',provinces,S.f.scoreProvince)}
    <label class="gk-field">参考年份<select data-gk-filter="year" name="year">${(years.length?years:[S.f.year]).map(y=>`<option value="${y}" ${Number(S.f.year)===Number(y)?'selected':''}>${y}</option>`).join('')}</select></label>
    <button class="primary gk-apply" type="submit">筛选</button>
   </div>
  </form>`;
 }

 function uniCard(u){
  return `<button type="button" class="gk-uni" data-gk-uni="${esc(u.id)}">
   <span class="gk-uni-head"><span class="gk-uni-name">${esc(u.name)}</span><span class="gk-tier ${tierClass(u.tier)}">${esc(u.tier)}</span></span>
   <span class="gk-uni-meta">${esc(u.province)}${u.city&&u.city!==u.province?' · '+esc(u.city):''} · ${esc(u.type)}</span>
   <span class="gk-uni-alliance">${esc(u.alliance&&u.alliance!=='—'?u.alliance:'暂无联盟标签')}</span>
   <span class="gk-uni-ranks"><span>校友会 <b>${fmtInt(u.alumniRank)}</b></span><span>软科 <b>${fmtInt(u.ruankeRank)}</b></span><span>专业 <b>${fmtInt(u.majorsCount)}</b> 个</span></span>
   <span class="gk-uni-line"><span class="gk-line-value">${fmtScore(u.line)}</span><span class="gk-line-label">${esc(u.provinceName||S.f.scoreProvince)} ${esc(u.year??S.f.year)} 参考线 · 位次 ${fmtInt(u.rank)}</span></span>
  </button>`;
 }

 function pager(){
  const list=S.list;
  if(!list||!(num(list.pages)>1))return '';
  const pages=num(list.pages)||1,page=num(list.page)||1;
  return `<div class="gk-pager">
   <button class="secondary" data-gk-page="${page-1}" ${page<=1?'disabled':''}>← 上一页</button>
   <span>第 ${page} / ${pages} 页<span class="muted">　共 ${fmtInt(list.total)} 所</span></span>
   <button class="secondary" data-gk-page="${page+1}" ${page>=pages?'disabled':''}>下一页 →</button>
  </div>`;
 }

  /* ---------------- 规划表（模拟规划，只存在本机浏览器） ---------------- */
  const planKey=()=> 'xuelu-gk-plan-v1:'+storageScope();
  let planScope=null;
 const PLAN_MAX=60;

 function loadPlan(){
  try{
    const raw=(typeof localStorage!=='undefined'&&localStorage)?localStorage.getItem(planKey()):'';
   const arr=raw?JSON.parse(raw):[];
   S.plan.items=Array.isArray(arr)?arr.filter(row=>row&&row.id&&row.name).slice(0,PLAN_MAX):[];
  }catch(_){S.plan.items=[];}
 }

 function savePlan(){
   try{if(typeof localStorage!=='undefined'&&localStorage)localStorage.setItem(planKey(),JSON.stringify(S.plan.items));}catch(_){}
 }

 function makePlan(){
  const result=S.rec.result;
  if(!result){toast('请先做一次冲稳保推荐');return;}
  const order=[...(result.buckets?.chong||[]),...(result.buckets?.wen||[]),...(result.buckets?.bao||[])];
  if(!order.length){toast('当前推荐结果为空，无法生成规划表');return;}
  S.plan.items=order.slice(0,PLAN_MAX).map(u=>({
   id:u.id,name:u.name,tier:u.tier,type:u.type,province:u.province,
   line:u.line,diff:u.diff,probability:u.probability,rank:u.rank
  }));
  savePlan();
  toast('已生成 '+S.plan.items.length+' 个目标，可拖动或用箭头排序');
  render();
 }

 function movePlan(index,dir){
  const items=S.plan.items,j=index+dir;
  if(!Number.isInteger(index)||index<0||index>=items.length||j<0||j>=items.length)return;
  const temp=items[index];items[index]=items[j];items[j]=temp;
  savePlan();render();
 }

 function movePlanTo(from,to){
  const items=S.plan.items;
  if(!Number.isInteger(from)||!Number.isInteger(to))return;
  if(from<0||to<0||from>=items.length||to>=items.length||from===to)return;
  const moved=items.splice(from,1)[0];
  items.splice(to,0,moved);
  savePlan();render();
 }

 function removePlan(index){
  if(!Number.isInteger(index)||index<0||index>=S.plan.items.length)return;
  S.plan.items.splice(index,1);savePlan();render();
 }

 // HTML5 拖拽要真实 DOM 事件：page() 渲染完用 setTimeout 挂上去；触屏端用上下箭头
 let dragFrom=null;
 function setupPlanDrag(){
  if(typeof document==='undefined'||!document.getElementById)return;
  const list=document.getElementById('gk-plan-list');
  if(!list||!list.querySelectorAll)return;
  const rows=list.querySelectorAll('[data-gk-plan-row]');
  if(!rows||typeof rows.forEach!=='function')return;
  rows.forEach(row=>{
   row.addEventListener('dragstart',event=>{
    dragFrom=Number(row.getAttribute('data-gk-plan-row'));
    row.classList.add('gk-dragging');
    if(event.dataTransfer){event.dataTransfer.effectAllowed='move';try{event.dataTransfer.setData('text/plain',String(dragFrom));}catch(_){}}
   });
   row.addEventListener('dragend',()=>{row.classList.remove('gk-dragging');dragFrom=null;});
   row.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';});
   row.addEventListener('drop',event=>{
    event.preventDefault();
    const to=Number(row.getAttribute('data-gk-plan-row'));
    if(dragFrom===null||Number.isNaN(to))return;
    const from=dragFrom;dragFrom=null;
    movePlanTo(from,to);
   });
  });
 }

 function planPanel(){
  const items=S.plan.items||[];
  return `<section class="site-panel gk-plan">
   <div class="gk-plan-head">
    <div><h3>我的规划表</h3><p class="muted">模拟规划：拖动行或点箭头调整顺序，行序就是目标顺序</p></div>
    <div class="gk-plan-actions">
     <span class="gk-plan-count">已填 ${items.length} / ${PLAN_MAX}</span>
     ${items.length?'<button class="secondary" data-gk-plan-clear>清空</button>':''}
    </div>
   </div>
   ${items.length?`<ol class="gk-plan-list" id="gk-plan-list">${items.map((it,index)=>{
    const prob=num(it.probability),diff=num(it.diff);
    return `<li class="gk-plan-row" draggable="true" data-gk-plan-row="${index}">
     <span class="gk-plan-grip" aria-hidden="true">⠿</span>
     <span class="gk-plan-order">${index+1}</span>
     <span class="gk-plan-uni"><button type="button" class="gk-plan-name" data-gk-uni="${esc(it.id)}">${esc(it.name)}</button><small>${esc(it.province||'')} · ${esc(it.type||'')}</small></span>
     <span class="gk-tier ${tierClass(it.tier)}">${esc(it.tier||'')}</span>
     <span class="gk-plan-line">参考线 <b>${fmtScore(it.line)}</b></span>
     <span class="gk-plan-diff ${diff!==null&&diff<0?'neg':'pos'}">${diff===null?'—':(diff>0?'+':'')+fmtScore(diff)}</span>
     <span class="gk-plan-prob">匹配 <b>${prob===null?'—':Math.round(prob)+'%'}</b></span>
     <span class="gk-plan-ops">
      <button type="button" class="secondary" data-gk-plan-up="${index}" ${index===0?'disabled':''} aria-label="上移">↑</button>
      <button type="button" class="secondary" data-gk-plan-down="${index}" ${index===items.length-1?'disabled':''} aria-label="下移">↓</button>
      <button type="button" class="secondary" data-gk-plan-del="${index}" aria-label="删除这一行">×</button>
     </span>
    </li>`;
   }).join('')}</ol>
   <p class="gk-plan-tip muted">顺序建议：冲刺在前、稳妥居中、保底在后。规划表只保存在这台电脑的浏览器里，不上传服务器。</p>`
   :'<p class="gk-plan-empty muted">还没有目标。先在上方做一次「冲稳保推荐」，再点「生成规划表」。</p>'}
  </section>`;
 }

 function recPanel(){
  const m=S.meta||{},rec=S.rec;
  const provinces=(m.provinces||[]).map(p=>p.name);
  const subjects=(m.subjects||['物理','历史']);
  const total=(m.provinces||[]).find(p=>p.name===rec.province)?.total??750;
  return `<section class="site-panel gk-rec">
   <div class="gk-rec-head">
    <div><h3>冲稳保推荐</h3><p class="muted">按「${esc(rec.province)}」${esc(S.f.year)} 年参考线估算匹配度，仅供演示</p></div>
    <button class="secondary" data-gk-rec-toggle>${rec.open?'收起':'展开'}</button>
   </div>
   ${rec.open?`<form id="gk-rec-form" class="gk-rec-form">
    ${selectField('province','生源省份',provinces,rec.province,'',false)}
    ${selectField('subject','科类',subjects,rec.subject,'',false)}
    <label class="gk-field">我的分数<input name="score" type="number" inputmode="numeric" min="1" max="${total}" step="1" value="${esc(rec.score)}" placeholder="如 640" ></label>
    ${selectField('tier','层次',TIERS,rec.tier,ALL,false)}
    ${selectField('type','类型',m.types||[],rec.type,ALL,false)}
    ${selectField('alliance','所属联盟',m.alliances||[],rec.alliance,ALL,false)}
    <button class="primary" type="submit" data-gk-recommend>开始推荐</button><button class="secondary gk-makeplan" type="button" data-gk-makeplan>生成规划表</button>
   </form>
   <p class="gk-rec-tip muted">${esc(rec.province)} 满分 ${total} 分。冲：低于参考线；稳：高出 0–12 分；保：高出 12 分以上。</p>
   ${rec.loading?skeleton('正在计算冲稳保…'):''}
   ${rec.error?`<div class="gk-recommend-error">${esc(rec.error)}</div>`:''}
   ${!rec.loading&&!rec.error&&rec.result?renderRecommend(rec.result):''}
   `:'<p class="muted gk-rec-fold">展开后可按分数查看冲刺、稳妥与保底院校。</p>'}
  </section>`;
 }

 function recCard(u){
  const diff=num(u.diff),prob=num(u.probability);
  const diffText=(diff===null?'—':(diff>0?'+':'')+fmtScore(diff));
  return `<button type="button" class="gk-rec-card" data-gk-uni="${esc(u.id)}">
   <span class="gk-uni-head"><span class="gk-uni-name">${esc(u.name)}</span><span class="gk-tier ${tierClass(u.tier)}">${esc(u.tier)}</span></span>
   <span class="gk-uni-meta">${esc(u.province)} · ${esc(u.type)}</span>
   <span class="gk-rec-nums"><span>参考线 <b>${fmtScore(u.line)}</b></span><span>位次 ${fmtInt(u.rank)}</span></span>
   <span class="gk-diff ${diff!==null&&diff<0?'neg':'pos'}">与我的分差 ${diffText}</span>
   <span class="gk-prob"><i style="width:${Math.max(0,Math.min(100,prob??0))}%"></i></span>
   <span class="gk-prob-text"><b class="gk-prob-num">${prob===null?'—':Math.round(prob)+'%'}</b><span class="gk-prob-label">模拟匹配度</span></span>
  </button>`;
 }

 function renderRecommend(result){
  const buckets=result.buckets||{},counts=result.counts||{};
  const defs=[['chong','冲','冲刺院校：分数略低于往年参考线'],['wen','稳','稳妥院校：分数与参考线相近'],['bao','保','保底院校：分数明显高于参考线']];
  const all=defs.every(([key])=>(buckets[key]||[]).length===0);
  if(all){
   return `<div class="empty">该分数段暂时没有匹配院校，可换一个分数或省份再试。</div>${result.disclaimer?`<p class="gk-disclaimer">${esc(result.disclaimer)}</p>`:''}`;
  }
  return `<div class="gk-buckets">${defs.map(([key,label,hint])=>{
   const items=buckets[key]||[],count=num(counts[key])??items.length;
   return `<div class="gk-bucket gk-bucket-${key}">
    <div class="gk-bucket-head"><strong>${label}</strong><span class="muted">${count} 所</span></div>
    <p class="gk-bucket-hint">${hint}</p>
    ${items.length?items.map(recCard).join(''):emptyBox(`没有${label}一档的院校`)}
    ${count>items.length?`<p class="gk-bucket-more muted">共 ${count} 所，此处显示前 ${items.length} 所</p>`:''}
   </div>`;
  }).join('')}</div>${result.disclaimer?`<p class="gk-disclaimer">${esc(result.disclaimer)}</p>`:''}`;
 }

 function listView(){
  const list=S.list;
  let body;
  if(S.listError){
   body=errorBox(S.listError,'data-gk-retry');
  }else if(!list||S.listLoading){
   body=skeleton(S.listLoading?'正在加载院校数据…':'正在准备院校数据…');
  }else if(!list.items||!list.items.length){
   body=emptyBox('没有符合条件的院校，试试放宽省份或层次筛选。');
  }else{
   body=`<div class="gk-grid">${list.items.map(uniCard).join('')}</div>${pager()}`;
  }
  const total=list?fmtInt(list.total):'—';
  return `<div class="section-head"><div><h2>学业规划 · 院校库</h2><div class="muted">模拟数据 · 共 ${total} 所院校，含 985 / 211 / 本科 / 专科</div></div></div>
   ${recPanel()}${planPanel()}
   ${filterBar()}
   <div class="gk-result-bar">${list?`参考 ${esc(list.scoreProvince||S.f.scoreProvince)} ${esc(list.year??S.f.year)} 年参考线，共 ${fmtInt(list.total)} 所院校`:'按条件筛选院校'}</div>
   ${body}
   <p class="gk-disclaimer">全部院校、排名、参考分数线与匹配度均为模拟数据，仅供功能演示，不作为升学依据。</p>`;
 }

 /* ---------------- 详情页 ---------------- */
 function formatGap(gap){
  const v=num(gap);
  if(v===null)return '<span class="muted">—</span>';
  const cls=v>0?'gk-gap-up':v<0?'gk-gap-down':'gk-gap-flat';
  return `<span class="${cls}">${v>0?'+':''}${fmtScore(v)}</span>`;
 }

 function chart(d){
  const national=(d.lines?.national||[]).filter(p=>num(p.line)!==null);
  const prov=(d.lines?.provinceSeries||[]).filter(p=>num(p.line)!==null);
  const all=[...national,...prov];
  if(all.length<2)return '<p class="muted">历年参考分数线数据不足，暂无法绘制趋势图。</p>';
  const W=640,H=220,P={l:42,r:14,t:20,b:30};
  const years=[...new Set(all.map(p=>p.year))].sort((a,b)=>a-b);
  let min=Math.min(...all.map(p=>num(p.line))),max=Math.max(...all.map(p=>num(p.line)));
  if(max-min<2){max+=1;min-=1;}
  const pad=(max-min)*0.14;min-=pad;max+=pad;
  const innerW=W-P.l-P.r,innerH=H-P.t-P.b;
  const x=year=>{const i=years.indexOf(year);return P.l+(years.length>1?innerW*(i/(years.length-1)):innerW/2);};
  const y=value=>P.t+innerH*(1-(value-min)/(max-min));
  const path=list=>list.filter(p=>years.includes(p.year)).map(p=>`${x(p.year)},${y(num(p.line))}`).join(' ');
  const grid=[0,.5,1].map(t=>{const value=max-(max-min)*t;return `<line x1="${P.l}" y1="${y(value)}" x2="${W-P.r}" y2="${y(value)}" class="gk-grid-line"/><text x="${P.l-8}" y="${y(value)+4}" class="gk-axis" text-anchor="end">${value.toFixed(0)}</text>`;}).join('');
  const ticks=years.map(year=>`<text x="${x(year)}" y="${H-8}" class="gk-axis" text-anchor="middle">${year}</text>`).join('');
  const marks=list=>{
   if(!list.length)return '';
   const top=list.reduce((a,b)=>num(b.line)>num(a.line)?b:a),low=list.reduce((a,b)=>num(b.line)<num(a.line)?b:a);
   return [top,low].map(p=>`<circle cx="${x(p.year)}" cy="${y(num(p.line))}" r="4.5" class="gk-mark"/><text x="${x(p.year)}" y="${y(num(p.line))-10}" class="gk-mark-text" text-anchor="middle">${p.year}</text>`).join('');
  };
  return `<div class="gk-chart">
   <div class="gk-chart-legend"><span class="gk-legend gk-legend-nat">全国校线</span><span class="gk-legend gk-legend-prov">${esc(d.lines?.province||'')}参考线</span></div>
   <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="近十年参考分数线趋势" preserveAspectRatio="xMidYMid meet">
    ${grid}
    <polyline class="gk-line gk-line-nat" points="${path(national)}"/>
    <polyline class="gk-line gk-line-prov" points="${path(prov)}"/>
    ${marks(national)}${marks(prov)}
    ${ticks}
   </svg>
  </div>`;
 }

 function chartSummary(d){
  const nat=(d.lines?.national||[]).filter(p=>num(p.line)!==null);
  const prov=(d.lines?.provinceSeries||[]).filter(p=>num(p.line)!==null);
  const parts=[];
  const trend=(list,label)=>{
   if(list.length<2)return '';
   const first=list[0],last=list[list.length-1];
   const delta=num(last.line)-num(first.line);
   const top=list.reduce((a,b)=>num(b.line)>num(a.line)?b:a);
   const word=delta>0.05?'上涨':delta<-0.05?'下降':'基本持平';
   return `${label}从 ${first.year} 年的 ${fmtScore(first.line)} 分${word}到 ${last.year} 年的 ${fmtScore(last.line)} 分（${delta>=0?'+':''}${fmtScore(delta)}），最高点在 ${top.year} 年`;
  };
  const a=trend(nat,'全国校线'),b=trend(prov,`${d.lines?.province||''}参考线`);
  if(a)parts.push(a);if(b)parts.push(b);
  return parts.length?parts.join('；')+'。':'';
 }

 function majorsTable(d){
  const rows=(d.majors||[]).slice();
  const key=S.majorSort.key,dir=S.majorSort.dir==='asc'?1:-1;
  rows.sort((a,b)=>key==='name'?sub(String(a.name),String(b.name))*dir:sub(num(a[key])??0,num(b[key])??0)*dir);
  const arrow=k=>S.majorSort.key===k?(S.majorSort.dir==='asc'?' ↑':' ↓'):'';
  const th=(k,label)=>`<th><button type="button" class="gk-th" data-gk-msort="${k}">${label}${arrow(k)}</button></th>`;
  return `<div class="gk-table-wrap">
   <table class="gk-table">
    <thead><tr>${th('name','专业名称')}<th>门类</th>${th('line','最低分')}${th('rank','位次')}${th('plan','招生计划')}${th('gap','与校线差')}</tr></thead>
    <tbody>${rows.map(m=>`<tr>
     <td class="gk-td-name">${esc(m.name)}</td>
     <td class="muted">${esc(m.category||'—')}</td>
     <td><b>${fmtScore(m.line)}</b></td>
     <td class="muted">${fmtInt(m.rank)}</td>
     <td class="muted">${fmtInt(m.plan)}</td>
     <td>${formatGap(m.gap)}</td>
    </tr>`).join('')||'<tr><td colspan="6" class="muted">暂无专业数据</td></tr>'}</tbody>
   </table>
  </div>`;
 }

 function provinceTable(d){
  const rows=(d.provinceLines?.rows||[]).slice();
  const current=d.lines?.province||'';
  return `<div class="gk-table-wrap gk-scroll">
   <table class="gk-table">
    <thead><tr><th>省份</th><th>满分</th><th>参考线</th><th>位次</th></tr></thead>
    <tbody>${rows.map(r=>`<tr class="${r.province===current?'gk-current-row':''}">
     <td>${esc(r.province)}${r.province===current?'<span class="gk-current-tag">参考</span>':''}</td>
     <td class="muted">${fmtInt(r.total)}</td>
     <td><b>${fmtScore(r.line)}</b></td>
     <td class="muted">${fmtInt(r.rank)}</td>
    </tr>`).join('')||'<tr><td colspan="4" class="muted">暂无分省数据</td></tr>'}</tbody>
   </table>
  </div>`;
 }

 function detailView(){
  const uni=S.uni;
  if(!uni)return emptyBox('尚未选择院校');
  const d=S.detail;
  const back=`<button class="secondary gk-back" data-gk-back>← 返回院校列表</button>`;
  if(S.detailError)return back+errorBox(S.detailError,'data-gk-dretry');
  if(!d||S.detailLoading){
   return back+`<div class="gk-detail-head"><div class="gk-detail-title"><h2>${esc(uni.name||'院校详情')}</h2>${uni.tier?`<div class="gk-badges"><span class="gk-tier ${tierClass(uni.tier)}">${esc(uni.tier)}</span></div>`:''}</div></div>`+skeleton('正在加载院校详情…');
  }
  const ranks=d.ranks||{};
  const badges=[d.tier,d.type,`${d.province}${d.city&&d.city!==d.province?' · '+d.city:''}`,`建校 ${d.founded} 年`,d.alliance&&d.alliance!=='—'?d.alliance:''].filter(Boolean);
  return `${back}
   <div class="gk-detail-head">
    <div class="gk-detail-title"><h2>${esc(d.name)}</h2><div class="gk-badges">${badges.map(b=>`<span class="gk-badge">${esc(b)}</span>`).join('')}</div></div>
   </div>
   <p class="gk-intro">${esc(d.intro||'')}</p>
   <div class="gk-ranks">
    <div class="gk-rank-card"><small>校友会排名（模拟）</small><strong>${fmtInt(ranks.alumni?.rank??d.alumniRank)}</strong></div>
    <div class="gk-rank-card"><small>软科中国排名（模拟）</small><strong>${fmtInt(ranks.ruanke?.rank??d.ruankeRank)}</strong></div>
    <div class="gk-rank-card"><small>开设专业</small><strong>${fmtInt(d.majorsCount)}</strong><span class="muted">个</span></div>
    <div class="gk-rank-card"><small>${esc(d.lines?.province||S.f.scoreProvince)} 招生计划</small><strong>${fmtInt(d.lines?.plan)}</strong><span class="muted">人</span></div>
   </div>
   <section class="site-panel"><h3>近十年参考分数线</h3>${chart(d)}<p class="gk-summary">${esc(chartSummary(d))}</p></section>
   <section class="site-panel"><h3>专业参考分（${esc(d.lines?.province||S.f.scoreProvince)}口径 · ${esc(d.provinceLines?.year??'最新')} 年）</h3>${majorsTable(d)}<p class="muted gk-table-hint">点击表头可切换排序；「与校线差」为该专业最低分减去当年校线。</p></section>
   <section class="site-panel"><h3>各省参考线（${esc(d.provinceLines?.year??S.f.year)} 年）</h3>${provinceTable(d)}</section>
   <p class="gk-disclaimer">${esc(d.disclaimer||'全部院校、排名与参考分数线均为模拟数据，仅用于功能演示。')}</p>`;
 }

 /* ---------------- 对外 ---------------- */
  function pageBody(){
   if(!S.plan.loaded||planScope!==storageScope()){loadPlan();S.plan.loaded=true;planScope=storageScope();}
   if(S.metaError)return errorBox(S.metaError,'data-gk-mretry');
  if(S.view==='detail'&&S.uni)return detailView();
  ensureMeta();
  if(S.meta)ensureList();
  return listView();
 }

 // 对外 page()：HTML 落地后再挂拖拽事件（innerHTML 更新是异步的）
 function page(){
  const html=pageBody();
  if(typeof setTimeout==='function')setTimeout(setupPlanDrag,0);
  return html;
 }

  function applyFilters(data){
   const f=S.f;
   if(data.year!==undefined&&Number(data.year)!==f.year){S.rec.seq++;S.rec.result=null;S.rec.loading=false;S.rec.error='';}
  if(data.q!==undefined)f.q=String(data.q||'').slice(0,30);
  if(data.province!==undefined)f.province=data.province||ALL;
  if(data.tier!==undefined)f.tier=data.tier||ALL;
  if(data.type!==undefined)f.type=data.type||ALL;
  if(data.alliance!==undefined)f.alliance=data.alliance||ALL;
  if(data.sort!==undefined)f.sort=data.sort||'rank';
  if(data.scoreProvince!==undefined)f.scoreProvince=data.scoreProvince||f.scoreProvince;
  if(data.year!==undefined)f.year=Number(data.year)||f.year;
  S.page=1;
  S.list=null;S.listError='';S.listSeq++;
  loadList();
  render();
 }

  function click(b){
   if(b.hasAttribute('data-gk-mretry')){S.metaError='';ensureMeta();render();return;}
  if(b.dataset.gkUni){
   const id=b.dataset.gkUni;
   const known=(S.list?.items||[]).find(item=>item.id===id)||(S.rec.result?.buckets?.chong||[]).concat(S.rec.result?.buckets?.wen||[],S.rec.result?.buckets?.bao||[]).find(item=>item.id===id)||{};
   S.view='detail';S.uni={id,name:known.name||'',tier:known.tier||''};S.detail=null;S.detailError='';
   S.majorSort={key:'line',dir:'desc'};
   loadDetail(id);
   render();
   return;
  }
  if(b.hasAttribute('data-gk-back')){S.view='list';S.uni=null;S.detail=null;S.detailError='';render();return;}
  if(b.hasAttribute('data-gk-retry')){S.listError='';S.list=null;loadList();render();return;}
  if(b.hasAttribute('data-gk-dretry')&&S.uni){S.detailError='';loadDetail(S.uni.id);render();return;}
  if(b.dataset.gkPage){
   const target=Number(b.dataset.gkPage);
   if(!Number.isInteger(target)||target<1)return;
   const pages=num(S.list?.pages)||1;
   if(target>pages)return;
   S.page=target;S.list=null;loadList();render();
   return;
  }
  if(b.dataset.gkMsort){
   const key=b.dataset.gkMsort;
   S.majorSort=S.majorSort.key===key?{key,dir:S.majorSort.dir==='asc'?'desc':'asc'}:{key,dir:key==='name'?'asc':'desc'};
   render();
   return;
  }
  if(b.hasAttribute('data-gk-rec-toggle')){S.rec.open=!S.rec.open;render();return;}
  if(b.hasAttribute('data-gk-makeplan')){makePlan();return;}
  if(b.dataset.gkPlanUp){movePlan(Number(b.dataset.gkPlanUp),-1);return;}
  if(b.dataset.gkPlanDown){movePlan(Number(b.dataset.gkPlanDown),1);return;}
  if(b.dataset.gkPlanDel){removePlan(Number(b.dataset.gkPlanDel));return;}
  if(b.hasAttribute('data-gk-plan-clear')){S.plan.items=[];savePlan();toast('规划表已清空');render();return;}
 }

 function change(el){
  const field=el?.dataset?.gkFilter;
  if(!field)return false;
  const value=el.value;
  const f=S.f;
   if(field==='year'){f.year=Number(value)||f.year;S.rec.seq++;S.rec.result=null;S.rec.loading=false;S.rec.error='';}
  else if(field==='sort')f.sort=value||'rank';
  else if(field==='scoreProvince'){
   f.scoreProvince=value||f.scoreProvince;
   if(S.rec.province===ALL||!S.rec.province)S.rec.province=f.scoreProvince;
   if(S.detail&&S.view==='detail'&&S.uni)loadDetail(S.uni.id);
  }else if(field in f){
   f[field]=value||ALL;
  }else{
   return false;
  }
  S.page=1;
  S.list=null;S.listError='';S.listSeq++;
  loadList();
  render();
  return true;
 }

 /* 表单提交走这里（app.js 已经把 FormData 解析成普通对象传进来）：
    gk-rec-form  → 冲稳保推荐
    gk-filter-form → 应用筛选（含关键词，按回车也能生效） */
 function submit(form,data){
  if(!form||!form.id)return false;
  if(form.id==='gk-rec-form'){runRecommend(data||{});return true;}
  if(form.id==='gk-filter-form'){applyFilters(data||{});return true;}
  return false;
 }

 return {page,click,change,submit};
}
