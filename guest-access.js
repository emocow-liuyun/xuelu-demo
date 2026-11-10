const key='xuelu-guest-role';
const supported=new Set(['parent','tutor','institution','shuttle']);
export function guestRole(){try{const role=sessionStorage.getItem(key);return supported.has(role)?role:null;}catch{return null;}}
export function setGuestRole(role){try{if(supported.has(role))sessionStorage.setItem(key,role);else sessionStorage.removeItem(key);}catch{}}
export function guestDestination(role){return role==='institution'?'institution':role==='tutor'?'student':'home';}
export function requireAccount(){return new Promise(resolve=>{const event=new CustomEvent('xuelu-login-request',{cancelable:true,detail:{resolve}});if(window.dispatchEvent(event))resolve(false);});}
