import {guestRole,setGuestRole,guestDestination} from './guest-access.js';
import {createLogin,getAccount,authRequest} from './login.js';
import {stages,getStudent,saveStudent,setStudentAccount,studentGradeLabel} from './student-profile.js';
const roles=[{id:'parent',name:'家长',icon:'👨‍👩‍👧',desc:'为孩子找课程、选老师，安排安心接送',action:'填写学生信息',page:'institutions'},{id:'tutor',name:'大学生',icon:'🎓',desc:'进入大学生中心，了解伴学服务并申请伴学入驻',action:'进入大学生中心',page:'student',type:'伴学'},{id:'institution',name:'机构',icon:'🏫',desc:'登记机构信息，申请入驻教育服务平台',action:'填写机构入驻资料',page:'join',type:'机构'},{id:'shuttle',name:'接送',icon:'🚐',desc:'校车线路或家庭同行接送，登记车辆与接送安排',action:'填写接送入驻资料',page:'join',type:'校车'}];
const key='xuelu-visitor-role';
const root=document.querySelector('#app');
const login=createLogin();let account=null,routing=false;
let current=null,prompted=false;
try{current=roles.find(r=>r.id===localStorage.getItem(key))||null;}catch{}
const dialog=document.createElement('dialog');
dialog.className='role-dialog';
dialog.setAttribute('aria-labelledby','role-title');
dialog.innerHTML=`<div class="role-intro"><span class="role-brand">学鹭伴学</span><p class="role-eyebrow">一起陪伴，每一种成长</p><h1 id="role-title">欢迎，请选择你的身份</h1><p>我们将为你找到合适的服务入口</p></div><div class="role-options">${roles.map(r=>`<button type="button" data-role="${r.id}"><span class="role-icon" aria-hidden="true">${r.icon}</span><strong>${r.name}</strong><span class="role-description">${r.desc}</span><span class="role-action">${r.action} →</span></button>`).join('')}</div><p class="role-note">可随时切换身份 · 此选择仅用于访问引导，不是实名认证</p><button type="button" class="role-cancel" hidden>返回网站</button>`;
document.body.append(dialog);
function open(){dialog.querySelector('.role-cancel').hidden=!current;if(!dialog.open)dialog.showModal();}
dialog.addEventListener('cancel',e=>{if(!current)e.preventDefault();});
dialog.querySelector('.role-cancel').addEventListener('click',()=>dialog.close());
function decorate(){
 if(location.hash==='#join'&&current?.id==='parent'){const form=document.querySelector('#join-form');const select=document.querySelector('#join-type');if(select&&select.value!=='校车'){selectType('校车');return;}if(select)select.disabled=true;const mode=form?.querySelector('[name=transportMode]');if(mode){mode.value='family';mode.disabled=true;}const field=form?.querySelector('[name=transportMode]');if(field&&!form.querySelector('[data-family-mode]')){const hidden=document.createElement('input');hidden.type='hidden';hidden.name='transportMode';hidden.value='family';hidden.dataset.familyMode='true';form.append(hidden);}}

 if(location.hash==='#join'&&['tutor','institution','shuttle'].includes(current?.id)){const select=document.querySelector('#join-type'),type=current.id==='tutor'?'伴学':current.id==='shuttle'?'校车':'机构';if(select){if(select.value!==type){selectType(type);return;}select.disabled=true;}}
 if(account?.authenticated&&location.hash==='#join'){const select=document.querySelector('#join-type');if(select)select.disabled=true;const phone=document.querySelector('#join-form [name=phone]');if(phone){phone.value=account.user.phone;phone.readOnly=true;}const genderField=document.querySelector('#join-form [name=gender]');if(genderField)genderField.value=account.application?.gender||'暂不填写';}
 if(account?.application&&['institution','tutor','shuttle'].includes(current?.id)&&location.hash==='#join')queueMicrotask(()=>showAdmission(account));
 const top=root.querySelector('.top-right');if(!top)return;
 let button=top.querySelector('.role-switch');
 if(!button){button=document.createElement('button');button.type='button';button.className='role-switch';button.addEventListener('click',open);top.prepend(button);}
 const label=(current?current.name+(guestRole()?'游客':'')+' · ':'')+'切换身份';if(button.textContent!==label)button.textContent=label;
 let out=top.querySelector('.account-logout');if(!out){out=document.createElement('button');out.className='role-switch account-logout';out.textContent='退出登录';out.onclick=async()=>{await authRequest('logout',{});account=null;current=null;localStorage.removeItem(key);location.reload();};top.append(out);}out.hidden=!account?.authenticated;
 let signIn=top.querySelector('.account-signin');if(!signIn){signIn=document.createElement('button');signIn.type='button';signIn.className='role-switch account-signin';signIn.textContent='登录 / 注册';signIn.onclick=()=>routeRole(current||roles[0],true);top.append(signIn);}signIn.hidden=!!account?.authenticated;
 if(!prompted){prompted=true;if(!current)open();else{const wanted=location.hash.slice(1);routeRole(current,false,true).catch(error=>{console.warn('登录状态检查失败');open();}).then(()=>{if(wanted&&wanted!==location.hash.slice(1)){location.hash=wanted;}});}}
}
async function routeRole(role,forceLogin=false,restore=false){
 if(routing)return;routing=true;
 try{
   if(restore&&!guestRole())account=await getAccount();
   const me=!forceLogin&&guestRole()===role.id?{guest:true}:await login.ensure(role.id,{account:forceLogin?null:account});if(!me){open();return;}
  if(me.guest){account={authenticated:false};current=role;setGuestRole(role.id);setStudentAccount('guest-'+role.id);try{localStorage.setItem(key,role.id);}catch{}const detail={account};window.dispatchEvent(new CustomEvent('xuelu-account-change',{detail}));detail.ready?.catch(error=>console.warn('部分账号资料加载失败'));window.dispatchEvent(new Event('xuelu-role-change'));if(role.id==='shuttle'){go('join');decorate();return;}go(guestDestination(role.id));decorate();return;}
  setGuestRole(null);document.querySelector('#modal')?.close();account=me;current=role;setStudentAccount(me.user.id);try{localStorage.setItem(key,role.id);}catch{}const detail={account};window.dispatchEvent(new CustomEvent('xuelu-account-change',{detail}));detail.ready?.catch(error=>console.warn('部分账号资料加载失败'));
  try{localStorage.setItem(key,role.id);}catch{}
 window.dispatchEvent(new Event('xuelu-role-change'));
  if(role.id==='parent'){if(location.hash==='#join')go('join');else if(!getStudent())openStudent();else go('home');}
  else if(role.id==='institution'){
   if(me.application?.status==='approved'&&me.institutionId)go('institution');
   else {go('join');selectType('机构');showAdmission(me);}
   }else if(role.id==='shuttle'){go('join');selectType('校车');showAdmission(me);decorate();}else{go('student');}
  decorate();
 }finally{routing=false;}
}
function go(page){const button=root.querySelector(`.nav button[data-page="${page}"]`);if(button)button.click();else location.hash=page;window.scrollTo(0,0);}
function selectType(type){const select=document.querySelector('#join-type');if(select){select.value=type;select.dispatchEvent(new Event('change',{bubbles:true}));const currentSelect=document.querySelector('#join-type');if(currentSelect)currentSelect.disabled=true;const phone=document.querySelector('#join-form [name=phone]');if(phone&&account?.user?.phone){phone.value=account.user.phone;phone.readOnly=true;phone.dispatchEvent(new Event('input',{bubbles:true}));}}}
function showAdmission(me){const panel=document.querySelector('#join-panel');if(!panel||!me.application||panel.querySelector('.admission-status'))return;const a=me.application;const note=document.createElement('div');note.className='banner-note admission-status';const statusText=value=>value==='pending'?(current?.id==='institution'?'入驻申请已提交，正在审核中。审核通过后可进入机构工作台。':'伴学入驻申请已提交，正在审核中，无需重复提交。'):value==='approved'?(current?.id==='institution'?'机构入驻申请已审核通过。':'伴学入驻申请已审核通过。'):'当前申请状态：'+value;note.textContent=statusText(a.status);const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary';refresh.textContent='刷新审核状态';refresh.onclick=async()=>{refresh.disabled=true;try{account=await getAccount();if(account.application?.status==='approved'&&account.institutionId)await routeRole(current);else{note.textContent=statusText(account.application?.status||'pending');note.append(refresh);}}catch(e){alert(e.message);}finally{refresh.disabled=false;}};note.append(document.createElement('br'),refresh);panel.prepend(note);if(a.status==='pending'){const form=panel.querySelector('form');if(form){const msg=document.createElement('p');msg.className='description';msg.textContent='请等待平台审核，无需重复提交。';form.replaceWith(msg);}}}
dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-role]');if(!b)return;dialog.close();try{await routeRole(roles.find(r=>r.id===b.dataset.role));}catch(error){alert(error.message);open();}});
 window.addEventListener('xuelu-application-submitted',async()=>{try{account=await getAccount();showAdmission(account);}catch(error){alert('无法获取审核进度，请刷新页面重试');}});
new MutationObserver(decorate).observe(root,{childList:true});queueMicrotask(decorate);

const studentDialog=document.createElement('dialog');studentDialog.className='student-dialog';studentDialog.setAttribute('aria-labelledby','student-title');document.body.append(studentDialog);
function openStudent(){const d=getStudent()||{stage:'小学',grade:'一年级',gender:'暂不填写'};studentDialog.innerHTML=`<div class="dialog-head"><h2 id="student-title">完善学生信息</h2></div><p class="description">用于展示学生档案和填写服务资料，不代表平台已经提供个性化推荐。</p><form id="student-form"><label>阶段<select name="stage">${Object.keys(stages).map(v=>`<option ${v===d.stage?'selected':''}>${v}</option>`).join('')}</select></label><label><span id="student-grade-label">${studentGradeLabel(d.stage)}</span><select name="grade">${stages[d.stage].map(v=>`<option ${v===d.grade?'selected':''}>${v}</option>`).join('')}</select></label><label>性别<select name="gender">${['男','女','暂不填写'].map(v=>`<option ${v===d.gender?'selected':''}>${v}</option>`).join('')}</select></label><p class="muted">仅保存在此浏览器。无需填写姓名、身份证或学校。</p><p id="student-error" class="error" role="status"></p><button class="primary">保存并进入</button><button class="secondary" type="button" id="student-back">返回身份选择</button></form>`;studentDialog.showModal();}
studentDialog.addEventListener('cancel',e=>e.preventDefault());
studentDialog.addEventListener('change',e=>{if(e.target.name==='stage'){const grade=studentDialog.querySelector('[name=grade]');studentDialog.querySelector('#student-grade-label').textContent=studentGradeLabel(e.target.value);grade.innerHTML=stages[e.target.value].map(v=>`<option>${v}</option>`).join('');}});
studentDialog.addEventListener('click',e=>{if(e.target.id==='student-back'){studentDialog.close();open();}});
studentDialog.addEventListener('submit',e=>{e.preventDefault();try{saveStudent(Object.fromEntries(new FormData(e.target)));studentDialog.close();location.hash='home';window.dispatchEvent(new Event('xuelu-role-change'));decorate();window.scrollTo(0,0);}catch(error){studentDialog.querySelector('#student-error').textContent=error.message;}});
document.addEventListener('click',e=>{if(e.target.closest('[data-edit-student]'))openStudent();});

window.addEventListener('hashchange',async()=>{
 if(location.hash!=='#institution'||routing||guestRole())return;
 try{const me=await getAccount();if(me.authenticated&&me.user?.role==='institution'&&me.application?.status==='approved'&&me.institutionId)return;if(current?.id==='institution')await routeRole(current);else open();}catch{open();}
});

window.addEventListener('xuelu-login-request',async e=>{e.preventDefault();try{await routeRole(current||roles[0],true);e.detail.resolve(!!account?.authenticated);}catch{e.detail.resolve(false);}});
document.addEventListener('submit',async e=>{
 if(!guestRole()||!['join-form','booking-form','profile-form','feedback-form','institution-profile-form','institution-course-form','service-form'].includes(e.target.id))return;
 e.preventDefault();e.stopImmediatePropagation();
 const detail={resolve:ok=>{if(ok)alert('登录成功，请确认资料后重新提交。');}};
 window.dispatchEvent(new CustomEvent('xuelu-login-request',{cancelable:true,detail}));
},true);
