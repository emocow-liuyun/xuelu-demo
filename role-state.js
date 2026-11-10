import {guestRole} from './guest-access.js';
export function visitorRole(){
 const guest=guestRole();if(guest)return guest;
 try{const role=localStorage.getItem('xuelu-visitor-role');return ['parent','tutor','institution','shuttle'].includes(role)?role:null;}catch{return null;}
}
