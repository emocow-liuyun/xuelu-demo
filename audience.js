// Service-audience cards adapted from the provided 20261024 update; preserve existing theme.
export const AUDIENCE_OPTIONS=[['家长','课程展示在家长端精选与学习资源'],['大学生','课程展示在大学生端学习资源']];
export function audienceValues(value){
 if(value===undefined||value===null)return ['家长'];
 const list=Array.isArray(value)?value:typeof value==='string'?value.split(/[,，]/):[];
 const picked=list.filter(v=>typeof v==='string').map(v=>v.trim());
 return AUDIENCE_OPTIONS.map(([name])=>name).filter(name=>picked.includes(name));
}
export function audienceText(value){return audienceValues(value).join(' / ');}
export function audienceField(d,esc){
 const selected=audienceValues(d?.audience);
 return `<fieldset class="join-audience"><legend>服务人群 <span>可多选，至少选择一项</span></legend><p class="muted">选择机构课程面向的人群，决定家长课程页与大学生学习资源的展示分区。</p><div class="audience-options">${AUDIENCE_OPTIONS.map(([value,hint])=>`<label class="audience-option"><input type="checkbox" name="audience" value="${value}" ${selected.includes(value)?'checked':''}><span><strong>${value}</strong><small>${hint}</small></span></label>`).join('')}</div></fieldset>`;
}
export function collectAudience(form){return [...form.querySelectorAll('[name="audience"]:checked')].map(input=>input.value);}
export function requireAudience(form){const values=collectAudience(form);if(!values.length)throw Error('请至少选择一个服务人群：家长 / 大学生');return values;}
export function parentAudience(value){return audienceValues(value).includes('家长');}
export function visibleServices(services,role){
 if(role==='institution')return services||[];
 const audience=role==='tutor'?'大学生':'家长';
 return (services||[]).filter(row=>row.type!=='course'||audienceValues(row.audience).includes(audience));
}
