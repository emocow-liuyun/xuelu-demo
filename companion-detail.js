/* 仅展示当前大学生账号自己的申请，按账号切换清空缓存，不按姓名认领服务。 */
export function createCompanionDetail({esc,api,toast,account=()=>({authenticated:false}),render=()=>{}}){
 let mine=null,scope=null,loaded=false,loading=false,error='',seq=0;
 const current=()=>{const me=account();return me?.authenticated&&me.user?.role==='tutor'?me:null;};
 function sync(){const id=current()?.user.id||null;if(scope!==id){seq++;scope=id;mine=null;loaded=false;loading=false;error='';}}
 async function load(force=false){
  sync();if(!scope||loading||(!force&&(loaded||error)))return;
  const request=++seq;loading=true;error='';
  try{const data=await api('/companion-profile');sync();if(request===seq){mine=data?.application||null;loaded=true;}}
  catch(e){sync();if(request===seq)error=e.message||'伴学资料加载失败';}
  finally{if(request===seq){loading=false;render();}}
 }
 const row=(label,value)=>`<div class="tour-row"><span>${esc(label)}</span><strong>${esc(value||'未填写')}</strong></div>`;
 const statusText=status=>({pending:'审核中',approved:'已通过',rejected:'未通过'}[status]||'待审核');
 function page(){
  sync();
  const heading='<div class="section-head"><div><h2>伴学详情</h2><p class="muted">我的伴学入驻资料 · 仅本人可见</p></div><button type="button" class="secondary" data-companion-refresh>刷新</button></div>';
  if(!scope)return heading+'<section class="site-panel"><h3>请先登录大学生账号</h3><p class="body-copy">登录后查看自己的伴学入驻资料。游客不会显示其他大学生的信息。</p><button type="button" class="primary" data-companion-login>登录 / 注册</button></section>';
  if(!loaded&&!error)load();
  if(loading&&!loaded)return heading+'<div class="gk-skeleton" role="status">正在加载伴学资料…</div>';
  if(error)return heading+`<div class="gk-error"><p>${esc(error)}</p><button type="button" class="secondary" data-companion-retry>重试</button></div>`;
  if(!mine)return heading+'<section class="site-panel"><h3>尚未提交伴学入驻</h3><p class="body-copy">提交伴学入驻申请后，可在这里查看本人资料和审核进度。</p><button type="button" class="primary" data-page="join">去填写伴学入驻 →</button></section>';
  const a=mine;
  return heading+`<div class="tour-layout">
    <section class="site-panel tour-card">${a.photo?`<img class="tour-photo" src="${esc(a.photo)}" alt="本人入驻照片">`:'<div class="tour-photo tour-photo-empty" aria-hidden="true">🎓</div>'}<h3>${esc(a.name)}</h3><span class="tour-status tour-${esc(a.status)}">${esc(statusText(a.status))}</span><p class="muted">仅查看本人提交资料；审核通过不等于学籍或资质认证。</p>${a.status==='approved'?'':'<button type="button" class="secondary" data-page="join">查看入驻进度 →</button>'}</section>
   <section class="site-panel"><h3>基本展示信息</h3>${row('姓名',a.name)}${row('性别',a.gender)}${row('专业',a.major)}${row('高校',a.school)}${row('学历 / 年级',[a.education,a.grade].filter(Boolean).join(' / '))}${row('身份',a.identity||'大学生（账号身份）')}${row('标签',a.tags)}${row('简介',a.resume)}</section>
   <section class="site-panel"><h3>个人简介</h3>${row('特长',a.specialty)}${row('经历',a.experience)}${row('出生年份',a.birthYear)}${row('家庭住址',a.address)}${row('学校',a.school)}${row('伴学经验',a.experience)}</section>
   <section class="site-panel"><h3>伴学服务信息</h3>${row('伴学方向 / 科目',a.subjects)}${row('服务方式',a.methods)}${row('服务价格',a.hourlyRate?'¥'+a.hourlyRate+' / 小时':'')}<h3>相册</h3>${a.photo?`<img class="tour-photo" src="${esc(a.photo)}" alt="已提交入驻照片">`:'<p class="muted">未上传</p>'}<p class="muted">当前展示已提交的入驻照片，不自动生成相册。</p></section>
   <section class="site-panel"><h3>申请状态</h3>${row('申请编号',a.id)}${row('审核状态',statusText(a.status))}${row('提交时间',a.createdAt?new Date(a.createdAt).toLocaleString('zh-CN'):'')}<p class="muted">未填写字段不推断、不补造。此页为本人资料查看页，不向本人提供预约自己的入口。</p></section>
  </div>`;
 }
 async function click(button){
  if(button.hasAttribute('data-companion-refresh')||button.hasAttribute('data-companion-retry')){await load(true);return 'render';}
  if(button.hasAttribute('data-companion-login')){window.dispatchEvent(new CustomEvent('xuelu-login-request',{cancelable:true,detail:{resolve:()=>{}}}));return 'none';}
  return false;
 }
 return {load,page,click};
}
