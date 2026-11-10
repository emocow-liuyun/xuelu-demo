import {canAccessLearning} from './learning-access.js';
export const assistantPageLabels={ai:'AI 学习',home:'精选',institutions:'精选',course:'学习资源',tutor:'伴学',bus:'接送端',orders:'我的订单',join:'入驻申请',profile:'我的',help:'帮助中心',feedback:'意见反馈',about:'关于平台',gaokao:'学业规划',exam:'考公考研',student:'大学生中心',resources:'学习资源',companion:'伴学详情',institution:'机构工作台'};
export function assistantCanGo(page,role,student,me){
 if(!Object.hasOwn(assistantPageLabels,page)||!canAccessLearning(page,role,student))return false;
 if(['student','resources','companion','exam'].includes(page))return role==='tutor';
 if(page==='institution')return role==='institution';
 if(page==='join')return ['institution','tutor','shuttle'].includes(role)&&me?.application?.status!=='approved';
 if(['home','course','tutor','bus','orders','institutions'].includes(page))return role==='parent';
 return true;
}
