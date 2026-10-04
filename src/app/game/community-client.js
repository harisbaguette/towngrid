/** @param {string} path @param {{method?:string,data?:any}} options */
export async function communityRequest(path,{method='GET',data}={}){
 let response;try{response=await fetch('/api/community'+path,{method,credentials:'same-origin',signal:AbortSignal.timeout(30000),headers:method==='GET'?{}:{'Content-Type':'application/json','X-TownGrid':'1'},...(data===undefined?{}:{body:JSON.stringify(data)})});}catch{throw new Error('온라인 서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.');}
 let result;try{result=await response.json();}catch{throw new Error('온라인 서버에 연결할 수 없습니다.');}
 if(!response.ok)throw Object.assign(new Error(result.error||'온라인 요청을 완료하지 못했습니다.'),{status:response.status});return result;
}
