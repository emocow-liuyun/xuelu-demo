export const DEFAULT_CITY='哈尔滨';
export const DEFAULT_LOCATION='哈尔滨市南岗区';
export function locationLabel(value){const city=value?.city||DEFAULT_CITY;const district=value?.district||'';return district&&!city.endsWith(district)?city+district:city;}
export const DEFAULT_PROVINCE='黑龙江';
export const DEFAULT_DISTRICTS=['道里区','南岗区'];
export function initialCity(saved){
 if(!saved||typeof saved.city!=='string'||!saved.city.trim())return {city:DEFAULT_CITY,source:'演示城市'};
 // 只迁移旧预设；用户手动选择或真实定位的城市仍予保留。
 if(['杭州','杭州市','哈尔滨','哈尔滨市'].includes(saved.city)&&!saved.district&&(!saved.source||['演示城市','默认区域'].includes(saved.source)))return {city:DEFAULT_CITY,source:'演示城市'};
 return {city:saved.city,source:saved.source==='腾讯地图'?'上次选择':saved.source||'手动选择'};
}
