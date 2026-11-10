import {visitorRole} from './role-state.js';
import {roleNavigation} from './navigation.js';
export const stages={'早教':['0–1岁','1–2岁','2–3岁'],'幼儿园':['小班','中班','大班'],'小学':['一年级','二年级','三年级','四年级','五年级','六年级'],'初中':['初一','初二','初三'],'高中':['高一','高二','高三']};
export function studentGradeLabel(stage){return stage==='早教'?'年龄段':'年级';}
let accountScope='';
export function setStudentAccount(id){accountScope=id||'';}
export function studentAccountScope(){return accountScope||'visitor';}
const storageKey=()=>accountScope?'xuelu-student-profile:'+accountScope:'xuelu-student-profile';
export function getStudent(){try{const d=JSON.parse(localStorage.getItem(storageKey()));return validStudent(d)?d:null;}catch{return null;}}
export function validStudent(d){return !!d&&!!stages[d.stage]?.includes(d.grade)&&['男','女','暂不填写'].includes(d.gender);}
export function saveStudent(d){if(!validStudent(d))throw Error('请完整选择阶段、年级和性别');localStorage.setItem(storageKey(),JSON.stringify({stage:d.stage,grade:d.grade,gender:d.gender}));}
export function isParent(){return visitorRole()==='parent';}
export function parentNav(){return roleNavigation('parent');}
