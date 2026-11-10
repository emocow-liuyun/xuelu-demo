export function learningIdSet(data){
 const ids=new Set();
 for(const row of Array.isArray(data?.items)?data.items:[])if(row&&typeof row.id==='string')ids.add(row.id);
 return ids;
}
export function learningDetailBranches(kind){return {gwy:'考公',ky:'考研',sb:'考编'}[kind]||'';}
