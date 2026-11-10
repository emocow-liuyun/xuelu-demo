export async function optionalAccountData(request,fallback){try{return await request();}catch(error){if(error.status===401||error.status===403)return structuredClone(fallback);throw error;}}
