/* 大学生“学习资源”目录：优先展示已审核入驻机构发布的课程；目录为空时回退到明确的示例课程。 */
import {SAMPLE_LEARNING_COURSES} from './learning-samples.js';
const ALL='全部';
export function createLearningResources({esc,api,toast,render=()=>{}}){

 let items=null,loading=false,error='',seq=0,category=ALL,subject=ALL;
 // 分类与科目取自服务端目录，不用页面文字推断课程归属。
 const names=[],branches=[];
 const hasBranch=kind=>branches.some(b=>b.id===kind);
 const subjectsOf=kind=>branches.find(b=>b.id===kind)?.subjects||[];
 async function load(force=false){
  if(!force&&(loading||items||error))return;
  const current=++seq;loading=true;error='';
  try{
   const data=await api('/learning/resources');
   if(current!==seq)return;
   // 目录完全来自服务端；缺失时回退为空，不在前端猜测课程归属。
   const directory=Array.isArray(data?.kinds)?data.kinds.filter(k=>k&&k.id&&k.name):[];
   branches.splice(0,branches.length,...directory.map(k=>({id:k.id,name:k.name,subjects:Array.isArray(k.subjects)?k.subjects:[]})));
   names.splice(0,names.length,...branches);
   items=Array.isArray(data?.items)?data.items:[];
  }catch(e){if(current===seq)error=e.message||'课程加载失败';}
   finally{if(current===seq){loading=false;render();}}
 }
 function reset(){seq++;items=null;loading=false;error='';category=ALL;subject=ALL;names.length=0;branches.length=0;}
  // 无真实课程时回退到示例课程并加标识；真实课程一旦存在即完全接管。
  const rowsOf=()=>{
   const real=(items||[]).filter(row=>hasBranch(row.kind));
   const source=real.length?real:SAMPLE_LEARNING_COURSES;
   return source.filter(row=>(category===ALL||row.kind===category)&&(category===ALL||subject===ALL||row.subject===subject));
  };
 function card(row){
  return `<article class="learning-card" data-learning-kind="${esc(row.kind)}">
   <div class="learning-icon ${esc(row.tone)}">${esc(row.icon)}</div>
   <div class="learning-body">
    <div class="learning-path"><span>${esc(row.kindName)}</span><i aria-hidden="true">›</i><strong>${esc(row.subject)}</strong></div>
    <h3>${esc(row.title)}</h3>
    <p class="muted">${esc(row.description||'课程介绍待完善')}</p>
    <div class="learning-meta"><span>🏫 ${esc(row.merchant)}</span>${row.location?`<span>⌖ ${esc(row.location)}</span>`:''}<span>${row.packages>0?esc(row.packages)+' 个套餐':'默认套餐'}</span></div>
    <div class="learning-bottom"><span class="price">¥${esc(row.price)}<small> / ${esc(row.unit||'课时')}</small></span>${row.sample?'<span class="sample-tag">示例课程 · 待机构发布</span>':`<button class="secondary" data-detail="${esc(row.id)}">查看课程 →</button>`}</div>
   </div>
  </article>`;
 }
 function view(){
  load();
   const active=category;
   const tabs=[{id:ALL,name:'全部'},...branches.map(b=>({id:b.id,name:b.name}))];
   const subjectList=category===ALL?[]:subjectsOf(category);
   const rows=rowsOf();
  const fail=pill=>`<div class="gk-error"><strong>加载失败</strong><p>${esc(error)}</p>${pill?'<button class="secondary" data-learning-retry>重试</button>':''}</div>`;
  const notice=error&&items?fail(false):'';
  let content;
  const usingSamples=!(items||[]).length;
  const sampleNotice=usingSamples?'<div class="banner-note">以下为示例课程，用于展示学习资源样式；机构入驻并通过审核、发布课程后，这里将替换为真实课程。示例数据不支持报名。</div>':'';
  if(loading&&!items)content='<div class="gk-skeleton" aria-live="polite"><span class="gk-spinner" aria-hidden="true"></span><span>正在加载学习资源…</span></div>';
  else if(error&&!items)content=fail(true);
  else if(!rows.length)content='<div class="empty">这个分类下暂无已入驻机构的课程。</div>';
  else content=sampleNotice+`<div class="learning-groups">${rows.map(card).join('')}</div>`;
  return `<div class="section-head"><div><h2>学习资源</h2><div class="muted">按考公、考研、考编及科目浏览已入驻机构的课程</div></div><button class="secondary" data-learning-refresh>刷新</button></div>
   <p class="banner-note">仅展示服务人群含大学生且通过入驻审核的机构课程；考试方向未设置时归入其他课程。资料与交易当前仍为演示。</p>
   ${notice}
   <div class="learning-tabs" role="tablist" aria-label="考试分类">${tabs.map(tab=>`<button type="button" role="tab" aria-selected="${active===tab.id}" class="${active===tab.id?'active':''}" data-learning-category="${esc(tab.id)}">${esc(tab.name)}</button>`).join('')}</div>
   ${subjectList.length?`<div class="learning-subjects" aria-label="科目">${[{id:ALL,name:'全部科目'},...subjectList.map(name=>({id:name,name}))].map(s=>`<button type="button" class="${subject===s.id?'active':''}" data-learning-subject="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>`:''}
   ${content}`;
 }
 function click(button){
  const kind=button.dataset.learningCategory;
  if(kind!==undefined&&kind!==''){category=kind;subject=ALL;return 'render';}
  const name=button.dataset.learningSubject;
  if(name!==undefined&&name!==''){subject=name;return 'render';}
  if(button.hasAttribute('data-learning-retry')){items=null;error='';load(true);return 'render';}
  if(button.hasAttribute('data-learning-refresh')){load(true);toast?.('正在刷新学习资源');return 'render';}
  return false;
 }
 return {load,reset,page:view,click,kinds:()=>names.map(k=>({id:k.id,name:k.name,subjects:[...(k.subjects||[])]}))};
}
