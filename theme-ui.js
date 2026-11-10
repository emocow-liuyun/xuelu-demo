const mascot=new URL('./brand-mascot.webp',import.meta.url).href;
export function brandLogoMark(){return `<span class="mark mark-egret" aria-hidden="true"><img src="${mascot}" alt="" width="46" height="46" decoding="async"></span>`;}
const pages={
 institutions:['陪伴成长，从这里出发。','发现身边的机构与好课，让孩子的每一份好奇，都被认真对待。','FIND A LITTLE WONDER'],
 student:['向着热爱，慢慢发光。','伴学、学习与未来的方向。和学鹭一起，找到属于你的成长节奏。','YOUR NEXT CHAPTER'],
 institution:['用心的课程，值得被看见。','把专业与热爱带给更多家庭，让每一次相遇，都成为成长的开始。','GROW BETTER TOGETHER'],
 profile:['成长的每一步，都在这里。','把陪伴留成记录，把每一份期待，放进下一段旅程。','MY LITTLE JOURNEY'],
 home:['每一种成长，都有温暖陪伴。','发现好课，遇见同行者。让好奇出发，让热爱生长。','A WARMER WAY TO GROW']
};
export function themeWelcome(role,page){
 const copy=pages[page];if(!copy)return '';
 const mode={parent:'家长',tutor:'大学生',institution:'机构'}[role]||'家长';
 return `<section class="brand-welcome" aria-label="学鹭品牌欢迎区"><div class="brand-welcome-copy"><span class="brand-overline">XUELU LEARNING <i></i> ${mode}服务</span><h2>${copy[0]}</h2><p>${copy[1]}</p><span class="brand-signature">${copy[2]} <b aria-hidden="true">↗</b></span></div><div class="brand-mascot-stage" aria-hidden="true"><span class="brand-orbit"></span><img class="brand-mascot" src="${mascot}" alt="" width="800" height="674"><span class="brand-spark brand-spark-one">✦</span><span class="brand-spark brand-spark-two">✧</span><span class="brand-mascot-caption">陪你，向光生长</span></div></section>`;
}
