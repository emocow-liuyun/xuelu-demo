/* 「AI 学习」整页：源自用户提供的 AI 学习页源码，复用本站学鹭助手接口与常见问题库。 */
import {FAQ,answer,rankFaq} from './assistant-knowledge.js';
import {assistantCanGo,assistantPageLabels as PAGE_LABELS} from './assistant-access.js';
import {visitorRole} from './role-state.js';
import {getStudent} from './student-profile.js';
import {getAccount} from './login.js';
const picture=new URL('./assistant-egret.webp',import.meta.url).href;
const base=typeof location!=='undefined'&&location.pathname.startsWith('/education/')?'/education/api':'/api';
const SUGGESTIONS=['怎么预约课程？','伴学怎么选时间？','接送端怎么看线路和站点？','学业规划的冲稳保怎么用？','大学生怎么看待考公考研？','账号和聊天记录存在哪里？'];
const ROLE_SUGGESTIONS={tutor:['大学生中心有什么？','伴学入驻怎么提交？','学习资源里的课程从哪来？','考公考研模块怎么用？','审核通过后还能改资料吗？','怎么切换身份？'],institution:['机构怎么发布或修改课程？','入驻审核要多久？','课程怎么进入大学生学习资源？','机构能自己改价格吗？','审核通过后还能改机构介绍吗？','怎么查看审核进度？']};
export function createAi({state,api,esc,render,toast,go}={}){
 const S={messages:[],loading:false,keyOpen:false,key:'',model:'',generation:0,pending:null};
 let account=null;
 async function goPage(page){
  if(!page)return;
  // 跳转按钮只对当前身份、年级与审核状态可进入的页面出现，与右下角助手一致。
  try{account=await getAccount();}catch{account={authenticated:false};}
  if(!assistantCanGo(page,visitorRole(),getStudent(),account)){toast('当前身份、年级或审核状态不符合这个页面的进入要求，请从对应身份的导航进入');return;}
  if(typeof go==='function')go(page);else location.hash=page;
 }
 function bubbleHtml(m){
  const target=m.page&&Object.hasOwn(PAGE_LABELS,m.page)&&m.page!=='ai'?m.page:'';
  const jump=m.choices?m.choices.map(c=>`<button class="ai-go" type="button" data-ai-course="${esc(c.id)}">${esc(c.label)} →</button>`).join(''):m.id?`<button class="ai-go" type="button" data-ai-course="${esc(m.id)}">进入数学精品课 →</button>`:target?`<button class="ai-go" type="button" data-ai-goto="${esc(target)}">去「${esc(PAGE_LABELS[target])}」→</button>`:'';
  return `<div class="ai-row ${m.who}">${m.who==='bot'?`<img class="ai-mini" src="${picture}" alt="" width="30" height="30">`:''}<div class="ai-bubble">${esc(m.text)}${jump}</div></div>`;
 }
 function page(){
  if(state.page!=='ai')return null;
  const empty=S.messages.length===0,role=visitorRole();
  const suggests=(ROLE_SUGGESTIONS[role]||SUGGESTIONS);
  const body=empty
   ?`<div class="ai-welcome"><img src="${picture}" alt="鹭鹭"><h2>你好，欢迎来到学鹭伴学</h2><p>我是鹭鹭，你的学习与服务助手。</p><p>${role==='tutor'?'大学生中心、伴学入驻、学习资源、考公考研，都可以问我。':role==='institution'?'入驻审核、机构工作台、课程与套餐，都可以问我。':'机构、伴学、接送端、学业规划，都可以问我。'}</p><div class="ai-suggests">${suggests.map(s=>`<button type="button" data-ai-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div><p class="ai-note">从上方问题开始，或告诉我你想了解什么。</p></div>`
   :S.messages.map(bubbleHtml).join('')+(S.loading?'<div class="ai-row bot"><img class="ai-mini" src="'+picture+'" alt="" width="30" height="30"><div class="ai-bubble ai-typing">鹭鹭正在想…</div></div>':'');
  return `<div class="ai-page">
   <header class="ai-head"><img class="ai-avatar" src="${picture}" alt="" width="42" height="42"><div class="ai-head-text"><h2>AI 学习助手</h2><p>学习规划 · 课程推荐 · 服务指引</p></div><button type="button" class="ai-icon-btn" data-ai="clear" ${empty?'disabled':''}>清空</button><button type="button" class="ai-icon-btn" data-ai="key" aria-expanded="${S.keyOpen}">⚙ 设置</button></header>
   ${S.keyOpen?`<div class="ai-keybox" id="ai-keybox"><label>自己的 DeepSeek Key（可选）<input id="ai-key" type="password" value="${esc(S.key)}" placeholder="sk-..." autocomplete="off" spellcheck="false" maxlength="203"></label><label>模型（可选）<input id="ai-model" type="text" value="${esc(S.model)}" placeholder="deepseek-chat" autocomplete="off" spellcheck="false" maxlength="60"></label><div class="ai-keyactions"><button type="button" class="primary" data-ai="key-save">本次使用</button><button type="button" class="secondary" data-ai="key-clear">清除</button></div><p class="ai-tip" id="ai-key-tip">Key 只在当前页面内存使用，不写浏览器存储；提问与最近对话会经本站后端发送至 DeepSeek。不填 Key 也可使用常见问题。</p></div>`:''}
   <div class="ai-body" id="ai-body" role="log" aria-live="polite" aria-label="对话消息">${body}</div>
   <form class="ai-form" id="ai-form"><input id="ai-input" name="q" type="text" maxlength="500" placeholder="问点什么，比如：学习资源里的课程从哪来？" autocomplete="off" aria-label="输入问题"><button type="submit" class="primary" ${S.loading?'disabled':''}>发送</button></form>
  </div>`;
 }
 function scroll(){setTimeout(()=>{const box=document.getElementById('ai-body');if(box)box.scrollTop=box.scrollHeight;},30);}
 function localReply(text,prefix=''){
  const result=answer(text);S.messages.push({who:'bot',text:prefix+result.a,page:result.matched?result.page:'',id:result.id,choices:result.choices});return result;
 }
 async function send(text){
  const question=String(text||'').trim().slice(0,500);if(!question||S.loading)return;
  S.messages.push({who:'me',text:question});if(answer(question).matched){localReply(question);render();scroll();return;}S.loading=true;render();scroll();
  const current=S.generation,history=S.messages.slice(-8,-1).map(m=>({role:m.who,text:m.text.slice(0,400)}));
  S.pending=new AbortController();const pending=S.pending,timer=setTimeout(()=>pending.abort(),23000);
  const headers={'Content-Type':'application/json',...(S.key?{'X-AI-Key':S.key}:{}),...(S.model?{'X-AI-Model':S.model}:{})};
  try{
   const response=await fetch(base+'/assistant/chat',{method:'POST',cache:'no-store',signal:pending.signal,headers,body:JSON.stringify({question,history})});
   if(current!==S.generation)return;
   let data={};try{data=await response.json();}catch{}
   if(!response.ok){
    const notice=data?.source==='api'?'AI 暂时不可用，以下为本站常见问题回答。':'未启用平台 AI，以下为本站常见问题回答。';
    if(data?.code==='NO_KEY'&&!S.key)S.keyOpen=true;
    localReply(question,notice+'\n');
   }else if(typeof data.answer==='string'&&data.answer.trim()){
    S.messages.push({who:'bot',text:data.answer,page:data.page||''});
   }else if(response.ok){localReply(question,'AI 没有返回内容，以下为本站常见问题回答。\n');}
   else localReply(question,'AI 暂时不可用，以下为本站常见问题回答。\n');
  }catch{
   if(current===S.generation)localReply(question,'AI 连接未完成，以下为本站常见问题回答。\n');
  }finally{
   clearTimeout(timer);S.pending=null;
   if(current===S.generation){S.loading=false;render();scroll();}
  }
 }
 function click(b){
  if(state.page!=='ai'||!b)return false;
  // 局部重绘会替换整张页面，键盘/读屏用户需要焦点回到同一个按钮。
  const focus=b;
  if(b.dataset.aiCourse){sessionStorage.setItem('selectedService',b.dataset.aiCourse);if(typeof window.__xueluOpenDetail==='function')window.__xueluOpenDetail(b.dataset.aiCourse);else go('detail');return true;}
  if(b.dataset.aiGoto){goPage(b.dataset.aiGoto);return true;}
  if(b.dataset.aiSuggest){send(b.dataset.aiSuggest);return true;}
  const act=b.dataset.ai;
  if(act==='clear'){S.generation++;S.pending?.abort();S.pending=null;S.messages=[];S.loading=false;render(focus);return true;}
  if(act==='key'){S.keyOpen=!S.keyOpen;render(focus);return true;}
  if(act==='key-save'){
   const key=String(document.getElementById('ai-key')?.value||'').trim(),model=String(document.getElementById('ai-model')?.value||'').trim();
   if(key&&!/^sk-[A-Za-z0-9_-]{16,200}$/.test(key)){toast('Key 格式不正确，通常以 sk- 开头；不填也能使用常见问题');return true;}
   if(model&&!/^[a-z0-9._-]{2,60}$/i.test(model)){toast('模型名称格式不正确');return true;}
   S.key=key;S.model=model;S.keyOpen=false;toast(key?'已启用本次页面的个人 Key；刷新或切换账号后清除':'未设置个人 Key，将使用平台配置或常见问题');render(focus);return true;
  }
  if(act==='key-clear'){S.key='';S.model='';S.keyOpen=false;toast('个人 Key 已清除');render(focus);return true;}
  return false;
 }
 function submit(form,data){
  if(state.page!=='ai'||!form||form.id!=='ai-form')return false;
  send(data&&data.q);return true;
 }
 function reset(){S.generation++;S.pending?.abort();S.pending=null;S.messages=[];S.loading=false;S.keyOpen=false;S.key='';S.model='';}
 return {page,click,submit,send,reset,faq:()=>rankFaq};
}
