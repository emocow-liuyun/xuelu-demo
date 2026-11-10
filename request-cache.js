// Session-local request coalescing. Writes and identity changes invalidate every entry.
export function createRequestCache(load,{now=()=>Date.now()}={}){
 let generation=0;const cache=new Map(),pending=new Map();
 const ttl=p=>/^\/(services|content|merchants|institutions|learning\/resources)(\?|$)/.test(p)?15000:0;
 function clear(){generation++;cache.clear();pending.clear();}
 async function request(path,method='GET',body){
  if(method!=='GET'){clear();try{return await load(path,method,body);}finally{clear();}}
  const hit=cache.get(path);if(hit&&hit.until>now())return structuredClone(hit.data);
  if(pending.has(path))return structuredClone(await pending.get(path));
  const current=generation;const task=Promise.resolve().then(()=>load(path,method,body));pending.set(path,task);
  try{const data=await task;if(current===generation&&ttl(path))cache.set(path,{data:structuredClone(data),until:now()+ttl(path)});return structuredClone(data);}
  finally{if(pending.get(path)===task)pending.delete(path);}
 }
 return {request,clear};
}
