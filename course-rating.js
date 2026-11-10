// 展示用推荐指数，不代表用户评价；仅预设课程提供确定性的示例值。
export function courseRecommendation(service){
 if(service?.type!=='course'||service.builtin===false)return null;
 let hash=0;for(const c of String(service.id||service.title||''))hash=(hash*31+c.charCodeAt(0))>>>0;
 return {score:(46+hash%4)/10,label:'推荐指数',description:'示例推荐指数，非用户评价'};
}
export function courseRatingHtml(service){
 const value=courseRecommendation(service);if(!value)return '';
 return `<div class="course-recommendation" aria-label="${value.label} ${value.score.toFixed(1)}分，满分5分；${value.description}" title="${value.description}"><span class="recommendation-stars" aria-hidden="true">★★★★★</span><strong>${value.score.toFixed(1)}</strong><span class="recommendation-label">${value.label}</span></div>`;
}
