/* Floating chat adapted from the user-supplied widget; survives page redraw, not account changes. */
import {FAQ,answer} from './assistant-knowledge.js';
import {visitorRole} from './role-state.js';
import {getStudent} from './student-profile.js';
import {assistantCanGo,assistantPageLabels as labels} from './assistant-access.js';
import {getAccount} from './login.js';
const picture=new URL('./assistant-egret.webp',import.meta.url).href;
const base=typeof location!=='undefined'&&location.pathname.startsWith('/education/')?'/education/api':'/api';
export function createAssistant(){
 if(document.getElementById('lu-assistant'))return null;
 const root=document.createElement('div');root.id='lu-assistant';
 root.innerHTML=`<button class="lu-ball" type="button" aria-label="打开学鹭助手" aria-expanded="false" aria-controls="lu-panel"><img src="${picture}" alt="" width="48" height="48"><span class="lu-ball-dot" aria-hidden="true"></span></button>
 <section class="lu-panel" id="lu-panel" role="dialog" aria-label="学鹭助手对话" aria-modal="false" hidden>
  <header class="lu-head"><img class="lu-avatar" src="${picture}" alt="" width="36" height="36"><div class="lu-head-text"><strong>学鹭助手 · 鹭鹭</strong><small id="lu-status">常见问题 · 本地问答</small></div><button class="lu-gear" type="button" aria-label="AI设置" aria-expanded="false">⚙</button><button class="lu-close" type="button" aria-label="关闭学鹭助手">×</button></header>
  <div class="lu-setup" id="lu-setup" hidden><label>自己的 DeepSeek Key（可选）<input id="lu-key" type="password" placeholder="sk-…" autocomplete="off" spellcheck="false" maxlength="203"></label><label>模型（可选）<input id="lu-model" type="text" placeholder="deepseek-chat" autocomplete="off" spellcheck="false" maxlength="60"></label><p class="lu-setup-tip" id="lu-setup-tip">Key仅在当前页面内存使用，不写浏览器存储；AI问题、最近6条对话及Key会经本站后端发送至DeepSeek。请勿提交敏感信息。不填Key可使用常见问题。</p><div class="lu-setup-actions"><button type="button" class="lu-btn-primary" id="lu-save">本次使用</button><button type="button" class="lu-btn-ghost" id="lu-clear">清除</button></div></div>
  <div class="lu-body" id="lu-body" role="log" aria-live="polite" aria-relevant="additions text" aria-label="聊天消息"></div><div class="lu-quick" id="lu-quick" aria-label="常见问题"></div>
  <p class="lu-privacy">常见问题不发送第三方 · AI回复仅供参考</p><form class="lu-form" id="lu-form"><input id="lu-input" name="question" type="text" maxlength="500" placeholder="输入问题，例如：怎么预约伴学？" aria-label="向学鹭助手提问"><button type="submit" aria-label="发送消息">发送</button></form>
 </section>`;
 document.body.append(root);
 const $=s=>root.querySelector(s),panel=$('.lu-panel'),ball=$('.lu-ball'),log=$('#lu-body'),input=$('#lu-input'),quick=$('#lu-quick'),setup=$('#lu-setup'),keyInput=$('#lu-key'),modelInput=$('#lu-model'),tip=$('#lu-setup-tip'),send=$('.lu-form button');
 let me=null,scope='',generation=0,controller=null,history=[],busy=false,key='',model='',greeted=false;
 const canGo=page=>assistantCanGo(page,visitorRole(),getStudent(),me);
 function status(text){$('#lu-status').textContent=text;}
 function bubble(text,who='bot'){const el=document.createElement('div');el.className='lu-msg '+who;el.textContent=text;log.append(el);log.scrollTop=log.scrollHeight;return el;}
 function setBusy(value){busy=value;send.disabled=value;quick.querySelectorAll('button').forEach(b=>b.disabled=value);$('#lu-form').setAttribute('aria-busy',String(value));}
 function close(){panel.hidden=true;root.classList.remove('open');ball.setAttribute('aria-expanded','false');ball.focus({preventScroll:true});}
 function reset(){generation++;controller?.abort();controller=null;history=[];me=null;scope='';key='';model='';keyInput.value='';modelInput.value='';input.value='';log.replaceChildren();quick.replaceChildren();greeted=false;setup.hidden=true;$('.lu-gear').setAttribute('aria-expanded','false');setBusy(false);panel.hidden=true;root.classList.remove('open');ball.setAttribute('aria-expanded','false');status('常见问题 · 本地问答');}
 async function identify(){
  const expected=generation;let account;try{account=await getAccount();}catch{account={authenticated:false};}
  if(expected!==generation)return false;
  const next=(visitorRole()||'none')+'|'+(account.authenticated?account.user.id:'guest');
  if(scope&&scope!==next)reset();
  scope=next;me=account;return true;
 }
 function chips(rows){quick.replaceChildren();for(const [question] of rows.slice(0,5)){const b=document.createElement('button');b.type='button';b.className='lu-chip';b.textContent=question;b.addEventListener('click',()=>ask(question));quick.append(b);}}
 function greet(){if(greeted)return;greeted=true;bubble('你好，我是鹭鹭。可以问我课程、伴学、校车或账号使用问题。未配置AI时，我会用本站常见问题回答；请勿发送密码或真实学生隐私。');chips(visitorRole()==='tutor'?FAQ.filter(row=>['student','resources','companion','exam'].includes(row[2])):visitorRole()==='institution'?FAQ.filter(row=>['institution','join','help'].includes(row[2])):FAQ.slice(0,5));}
 function goButton(page){
  if(!page)return;
  if(page==='join'&&me?.application?.status==='approved')page=visitorRole()==='tutor'?'companion':'institution';
  if(!canGo(page))return;
  const target=page,b=document.createElement('button');b.type='button';b.className='lu-go';b.textContent='去「'+labels[target]+'」 →';
  b.addEventListener('click',async()=>{if(!await identify())return;if(!canGo(target)){bubble('当前身份、年级或审核状态不符合此入口要求。请从对应身份的导航进入。');return;}location.hash=target;close();});
  log.append(b);log.scrollTop=log.scrollHeight;
 }
 function local(text){const result=answer(text);bubble(result.a);history.push({role:'bot',text:result.a});if(result.choices)for(const choice of result.choices)detailButton(choice.id,choice.label);else if(result.id)detailButton(result.id);else goButton(result.page);if(result.related?.length)chips(result.related.map(row=>[row.q]));status('常见问题 · 本地问答');}
 // 指定课程：直接打开该课程详情，避免跳到列表后再自己找。
 function detailButton(id,label='进入数学精品课'){const b=document.createElement('button');b.type='button';b.className='lu-go';b.dataset.courseId=id;b.textContent=label+' →';b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();sessionStorage.setItem('selectedService',id);close();if(typeof window.__xueluOpenDetail==='function')window.__xueluOpenDetail(id);else location.hash='detail';});log.append(b);log.scrollTop=log.scrollHeight;}
 async function request(path,body,signal){const response=await fetch(base+'/assistant/'+path,{method:body?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json',...(key?{'X-AI-Key':key}:{}),...(model?{'X-AI-Model':model}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});let data;try{data=await response.json();}catch{data={};}return {ok:response.ok,data};}
 async function ask(text){
  text=String(text||'').trim().slice(0,500);if(!text||busy)return;
  const preset=answer(text);if(preset.matched){greet();input.value='';bubble(text,'me');history.push({role:'me',text});local(text);history=history.slice(-12);return;}
  setBusy(true);if(!await identify()){setBusy(false);return;}
  greet();const current=generation;setBusy(true);input.value='';const prior=history.slice(-6);bubble(text,'me');history.push({role:'me',text});
  controller=new AbortController();const pending=controller,timer=setTimeout(()=>pending.abort(),23000);let typing=null;
  try{
   if(answer(text).id){local(text);return;}
   const available=await request('status',null,controller.signal);if(current!==generation)return;
   if(!available.ok||!available.data.configured||(!me?.authenticated&&!key)){local(text);return;}
   typing=bubble('鹭鹭正在想…');typing.classList.add('lu-typing');
   const result=await request('chat',{question:text,history:prior},controller.signal);if(current!==generation)return;
   typing.remove();typing=null;
   if(!result.ok||typeof result.data.answer!=='string'){bubble('AI暂时不可用，以下为常见问题回答。');local(text);return;}
   bubble(result.data.answer);history.push({role:'bot',text:result.data.answer});goButton(result.data.page);status('AI对话 · DeepSeek');
  }catch{if(current===generation){typing?.remove();bubble('AI连接未完成，以下为常见问题回答。');local(text);}}
  finally{clearTimeout(timer);if(current===generation){typing?.remove();setBusy(false);history=history.slice(-12);controller=null;input.focus({preventScroll:true});}}
 }
 ball.addEventListener('click',()=>{if(!panel.hidden){close();return;}greet();panel.hidden=false;root.classList.add('open');ball.setAttribute('aria-expanded','true');input.focus({preventScroll:true});identify().catch(()=>{});});
 $('.lu-close').addEventListener('click',close);
 $('.lu-gear').addEventListener('click',()=>{setup.hidden=!setup.hidden;$('.lu-gear').setAttribute('aria-expanded',String(!setup.hidden));if(!setup.hidden){keyInput.value='';modelInput.value=model;keyInput.focus({preventScroll:true});}});
 $('#lu-save').addEventListener('click',()=>{if(busy)return;const value=keyInput.value.trim(),chosen=modelInput.value.trim();if(value&&!/^sk-[A-Za-z0-9_-]{16,200}$/.test(value)){tip.textContent='Key格式不正确，请输入sk-开头的Key；不填写也可使用常见问题。';return;}if(chosen&&!/^[a-z0-9._-]{2,60}$/i.test(chosen)){tip.textContent='模型名称格式不正确。';return;}key=value;model=chosen;keyInput.value='';setup.hidden=true;$('.lu-gear').setAttribute('aria-expanded','false');bubble(key?'已启用本次页面的个人Key；刷新或切换账号后清除。':'未设置个人Key，将优先使用平台已配置AI（需登录），否则使用常见问题。');});
 $('#lu-clear').addEventListener('click',()=>{generation++;controller?.abort();controller=null;key='';model='';history=[];log.replaceChildren();quick.replaceChildren();greeted=false;keyInput.value='';modelInput.value='';setup.hidden=true;$('.lu-gear').setAttribute('aria-expanded','false');setBusy(false);greet();bubble('个人Key和本次聊天已清除。');status('常见问题 · 本地问答');});
 $('#lu-form').addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();ask(input.value);});
 root.addEventListener('click',event=>event.stopPropagation());root.addEventListener('change',event=>event.stopPropagation());root.addEventListener('input',event=>event.stopPropagation());
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.stopPropagation();close();}});
 window.addEventListener('xuelu-account-change',reset);window.addEventListener('xuelu-role-change',reset);
 window.addEventListener('storage',event=>{if(event.key==='xuelu-visitor-role')reset();});
 // Re-check a visible panel when returning from another tab, where cookies may have changed.
 window.addEventListener('focus',()=>{if(!panel.hidden)identify();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!panel.hidden)identify();});
 return {ask,reset};
}
if(typeof document!=='undefined')createAssistant();
