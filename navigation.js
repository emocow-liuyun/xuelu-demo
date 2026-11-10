import {visitorRole} from './role-state.js';
import {getStudent} from './student-profile.js';
import {canAccessLearning} from './learning-access.js';
export {visitorRole} from './role-state.js';

const menus={
 parent:{
  desktop:[['home','⌂','精选'],['course','▦','学习资源'],['tutor','♧','伴学'],['bus','▱','接送端'],['ai','✦','AI 学习'],['profile','◉','我的'],['orders','▤','我的订单'],['help','?','帮助中心']],
  mobile:[['home','⌂','精选'],['course','▦','学习资源'],['tutor','♧','伴学'],['bus','▱','接送端'],['ai','✦','AI 学习'],['profile','◉','我的']],
  shortcuts:[['orders','▤','我的订单'],['ai','✦','AI 学习'],['help','?','帮助中心']],
  profile:[['help','?','常见问题与联系我们'],['ai','✦','AI 学习'],['feedback','✎','意见反馈与我的反馈'],['about','ⓘ','关于平台']]
 },
 tutor:{
  desktop:[['student','◈','大学生中心'],['companion','◐','伴学详情'],['resources','▤','学习资源'],['ai','✦','AI 学习'],['profile','◉','我的'],['help','?','帮助中心']],
   mobile:[['student','◈','大学生'],['companion','◐','伴学详情'],['resources','▤','学习资源'],['ai','✦','AI 学习'],['profile','◉','我的'],['help','?','帮助']],
  shortcuts:[['student','◈','大学生中心'],['companion','◐','伴学详情'],['resources','▤','学习资源'],['ai','✦','AI 学习'],['help','?','帮助中心']],
  profile:[['student','◈','大学生中心 · 伴学入驻'],['companion','◐','伴学详情'],['resources','▤','学习资源'],['ai','✦','AI 学习'],['help','?','常见问题与联系我们'],['feedback','✎','意见反馈与我的反馈'],['about','ⓘ','关于平台']]
 },
 institution:{
  desktop:[['institution','▧','机构工作台'],['join','＋','入驻申请'],['ai','✦','AI 学习'],['profile','◉','我的'],['help','?','帮助中心']],
  mobile:[['institution','▧','工作台'],['join','＋','入驻申请'],['ai','✦','AI 学习'],['profile','◉','我的'],['help','?','帮助']],
  shortcuts:[['institution','▧','机构工作台'],['join','＋','入驻申请'],['ai','✦','AI 学习'],['help','?','帮助中心']],
  profile:[['institution','▧','机构工作台'],['join','＋','入驻申请与审核进度'],['ai','✦','AI 学习'],['help','?','常见问题与联系我们'],['feedback','✎','意见反馈与我的反馈'],['about','ⓘ','关于平台']]
 },
 shuttle:{
  desktop:[['join','＋','接送入驻'],['provider','▤','接送接单台'],['verification','✓','核验档案'],['ledger','▦','佣金记录'],['ai','✦','AI 学习'],['profile','◉','我的'],['help','?','帮助中心']],
  mobile:[['join','＋','接送入驻'],['provider','▤','接单台'],['ai','✦','AI 学习'],['profile','◉','我的']],
  shortcuts:[['join','＋','接送入驻'],['provider','▤','接送接单台'],['verification','✓','核验档案'],['ledger','▦','佣金记录'],['ai','✦','AI 学习'],['help','?','帮助中心']],
  profile:[['join','＋','接送入驻与审核进度'],['provider','▤','接送接单台'],['verification','✓','核验档案'],['ledger','▦','佣金记录'],['help','?','常见问题与联系我们'],['feedback','✎','意见反馈与我的反馈'],['about','ⓘ','关于平台']]
 }
};
// 仅控制页面导航展示；写权限始终由后端登录会话及入驻审核校验。
export function roleNavigation(role=visitorRole(),surface='desktop',student=getStudent()){
 const requestedRole=role;
 role=Object.hasOwn(menus,role)?role:'parent';
 const menu=menus[role];
 const items=Object.hasOwn(menu,surface)?menu[surface].map(item=>[...item]):[];
 if(Object.hasOwn(menu,surface)&&['desktop','profile','shortcuts'].includes(surface)){
  if(role==='parent')items.push(['demands','✎','发布需求'],['favorites','♡','我的收藏']);
  if(['tutor','institution'].includes(role))items.push(['provider','▤','服务接单台'],['verification','✓','核验档案'],['ledger','▦','佣金记录']);
 }
 if(requestedRole==='parent'&&surface!=='mobile'&&Object.hasOwn(menu,surface)&&canAccessLearning('gaokao',role,student))items.splice(surface==='desktop'?3:0,0,['gaokao','✎','学业规划']);
 return items;
}
export function roleHome(role=visitorRole()){return role==='tutor'?'student':role==='institution'?'institution':role==='shuttle'?'join':'home';}
export function navigationTitle(page,role=visitorRole()){if(page==='join'&&role==='tutor')return '大学生中心 / 伴学入驻';return roleNavigation(role).find(([id])=>id===page)?.[2];}
export function activeNavigation(page,role=visitorRole(),surface='desktop',serviceType='course',learning=false){
 const items=roleNavigation(role,surface),has=id=>items.some(([value])=>value===id);
 if(has(page))return page;
 if(['exam','join'].includes(page)&&role==='tutor')return 'student';
 if(page==='gaokao'&&role==='parent')return has('gaokao')?'gaokao':'profile';
 if(page==='detail'&&role==='tutor'&&learning)return 'resources';
 if(page==='detail')return has(serviceType)?serviceType:has('institutions')?'institutions':roleHome(role);
 if(page==='merchant'||page==='institutions')return has('course')?'course':roleHome(role);
 if(['help','feedback','about'].includes(page))return has('help')?'help':'profile';
 if(['orders','profile','join'].includes(page))return 'profile';
 return roleHome(role);
}
