const base=location.pathname.startsWith('/education/')?'/education/api':'/api';
export async function authRequest(path,body){if(body)accountPending=null;const response=await fetch(base+'/auth/'+path,{method:body?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(body)accountPending=null;if(!response.ok)throw Error(data.error||'登录失败');return data;}
let accountPending=null;
export function getAccount(){if(accountPending)return accountPending;const task=readAccount();accountPending=task;task.finally(()=>{if(accountPending===task)accountPending=null;});return task;}
export async function readAccount(){
 // 未登录会话由后端返回 401，这是正常状态而非失败；按未登录处理，避免控制台整片报红。
 try{return await authRequest('me');}
 catch{return {authenticated:false,user:null,application:null};}
}
export function createLogin(){
 let resolveLogin=null,role='parent',mode='login',busy=false,sessionReady=Promise.resolve();
 const dialog=document.createElement('dialog');dialog.className='login-dialog';dialog.setAttribute('aria-label','账号登录');document.body.append(dialog);
 function render(){dialog.innerHTML=`<div class="dialog-head"><h2>${mode==='login'?'登录':'注册'}${{parent:'家长',tutor:'大学生',institution:'机构',shuttle:'接送'}[role]}账号</h2></div><p class="description">可先游客浏览，提交入驻、订单或保存资料时再登录。</p><form id="account-form"><label>手机号<input name="phone" type="tel" inputmode="numeric" required pattern="1[0-9]{10}" maxlength="11" autocomplete="username"></label><label>密码<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${mode==='login'?'current-password':'new-password'}" placeholder="至少8位密码"></label><p id="login-error" class="error" role="status"></p><button class="primary" type="submit">${mode==='login'?'登录并继续':'注册并继续'}</button><button type="button" class="secondary" id="login-guest">游客访问，暂不登录</button><button type="button" class="secondary" id="login-mode">${mode==='login'?'没有账号？注册':'已有账号？登录'}</button><button type="button" class="secondary" id="login-back">返回身份选择</button></form><p class="muted">当前为手机号＋密码登录，尚未接入短信验证或微信登录；请勿使用其他平台的密码。</p>`;}
 function finish(value){dialog.close();resolveLogin?.(value);resolveLogin=null;}
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(!busy)finish(null);});
 dialog.addEventListener('click',e=>{if(busy)return;if(e.target.id==='login-mode'){const phone=dialog.querySelector('[name=phone]').value;mode=mode==='login'?'register':'login';render();dialog.querySelector('[name=phone]').value=phone;}if(e.target.id==='login-back')finish(null);if(e.target.id==='login-guest')finish({guest:true});});
 dialog.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;const form=e.target,button=form.querySelector('.primary');button.disabled=true;try{const sessionError=await sessionReady;if(sessionError)throw sessionError;await authRequest(mode,{...Object.fromEntries(new FormData(form)),role});const me=await getAccount();if(!me.authenticated||me.user?.role!==role){await authRequest('logout',{});throw Error('该账号与所选身份不匹配，请切换身份后登录');}finish(me);}catch(error){dialog.querySelector('#login-error').textContent=error.message;}finally{busy=false;button.disabled=false;}});
 async function ensure(selectedRole,{account}={}){
  if(account?.authenticated&&account.user?.role===selectedRole)return account;
  role=selectedRole;mode='login';render();
  const result=new Promise(resolve=>{resolveLogin=resolve;dialog.showModal();});
  // Show the UI first. Reconcile cookies before any register/login or guest transition.
  sessionReady=(async()=>{const me=await getAccount();if(me.authenticated)await authRequest('logout',{});})().then(()=>null,error=>error);
  const value=await result;if(!value)return value;const error=await sessionReady;if(error)throw error;return value;
 }
 return {ensure};
}
