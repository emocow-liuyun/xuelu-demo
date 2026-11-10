export const learningPages=['gaokao','exam'];
export function canAccessLearning(page,role,student){
 if(page==='gaokao')return role==='parent'&&student?.stage==='高中'&&student?.grade==='高三';
 if(page==='exam'||page==='resources'||page==='companion')return role==='tutor';
 if(page==='ai')return true; // AI 学习页：三种身份均可见，跳转按钮按身份过滤。
 return true;
}
