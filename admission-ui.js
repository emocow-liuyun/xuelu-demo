export function companionApproved(account){return account?.authenticated===true&&account.user?.role==='tutor'&&account.application?.status==='approved';}
export function companionAdmissionCard(account){
 if(companionApproved(account))return '';
 const pending=account?.authenticated&&account.user?.role==='tutor'&&account.application?.status==='pending';
 return `<section class="site-panel"><h3>${pending?'伴学入驻审核中':'伴学入驻'}</h3><p class="body-copy">${pending?'申请已提交，请等待平台审核，无需重复填写。':'填写个人背景、伴学方向、服务费与简历，申请提供阅读陪伴、习惯培养、时间规划等伴学服务。'}</p><p class="muted">大学生身份仅用于访问引导，不代表学籍或服务资质已认证。提交申请时需登录。</p><button type="button" class="primary" data-page="join">${pending?'查看审核进度':'进入伴学入驻'} →</button></section>`;
}
