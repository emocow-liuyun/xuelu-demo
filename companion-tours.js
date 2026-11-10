export const TUTOR_STATUS={pending:'审核中',approved:'已通过',rejected:'未通过'};
const companion=(a)=>{
 if(!a||a.type!=='家教')return null;
 return {
   id:a.id,name:a.name,status:a.status,statusLabel:TUTOR_STATUS[a.status]||'待审核',
   gender:a.gender||'',major:a.major||'',identity:a.identity||'',tags:a.tags||'',
   specialty:a.specialty||'',experience:a.experience||'',birthYear:a.birthYear||'',address:a.address||'',
   methods:a.methods||'',
  education:a.education||'',school:a.school||'',grade:a.grade||'',subjects:a.subjects||'',
  hourlyRate:Number(a.hourlyRate)||0,resume:a.resume||'',photo:a.photo||'',
  createdAt:a.createdAt||null,verified:a.status==='approved'
 };
};
export function unapprovedCompanionTour(application){return companion(application);}
