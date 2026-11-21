/**
 * Leitor direto da OSRS Wiki Prices API v2.
 * Requisicoes browser CORS; nao usa tokens, proxy, Actions ou arquivo do GitHub.
 * high/low sao ultimas negociacoes, nao ordens abertas.
 */
export const API_BASE = 'https://prices.runescape.wiki/api/v2/osrs';
const ENDPOINTS = ['mapping','latest','5m','1h','24h'];

export function makeSnapshot(payloads,at=new Date()){
 const [mappingRaw,latestRaw,fiveRaw,hourRaw,dayRaw]=payloads;
 const mapping=Array.isArray(mappingRaw)?mappingRaw:mappingRaw?.data;
 if(!Array.isArray(mapping))throw new Error('Metadata de itens: formato invalido');
 const extracts=[latestRaw,fiveRaw,hourRaw,dayRaw].map((r,i)=>{
   if(!r||typeof r.data!=='object'||!r.data||Array.isArray(r.data))
     throw new Error('Dados '+ENDPOINTS[i+1]+': formato invalido');
   return r.data;
 });
 const [latest,five,hour,day]=extracts;
 const m=new Map(mapping.filter(x=>x&&Number.isFinite(Number(x.id))).map(x=>[String(x.id),x]));
 const v=(data,key)=>{
   const x=data[key]; if(!x||typeof x!=='object')return 0;
   return Math.max(0,Math.trunc(Number(x.highPriceVolume)||0))
      + Math.max(0,Math.trunc(Number(x.lowPriceVolume)||0));
 };
 const items=[];
 for(const [key,p] of Object.entries(latest)){
   const meta=m.get(key);
   if(!meta||!p)continue;
   const lo=Number(p.low),hi=Number(p.high);
   if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<=0||hi<=0)continue;
   const vol24=v(day,key);if(vol24<=0)continue;
   items.push({
     id:Number(key),
     name:String(meta.name||('Item '+key)),
     members:meta.members===true,
     limit:Math.max(0,Math.trunc(Number(meta.limit)||0)),
     low:Math.trunc(lo),high:Math.trunc(hi),
     lowTime:Math.trunc(Number(p.lowTime)||0),
     highTime:Math.trunc(Number(p.highTime)||0),
     volume5:v(five,key),volume1h:v(hour,key),volume24:vol24
   });
 }
 if(items.length<100)throw new Error('API devolveu somente '+items.length+' itens validos; resultado descartado');
 return {
   schema_version:1,game:'osrs',api_version:'v2',
   source:API_BASE, fetched_at:at.toISOString(),
   notes:'Cotacoes high/low sao negocios executados, nao ordens abertas.',
   items
 };
}

export async function fetchLiveSnapshot(fetcher=fetch){
 const abort=typeof AbortController==='function'?new AbortController():null;
 const timeout=abort?setTimeout(()=>abort.abort(),25000):null;
 try{
   const json=await Promise.all(ENDPOINTS.map(async endpoint=>{
     let response;
     try{
       response=await fetcher(API_BASE+'/'+endpoint,{
         cache:'no-store',signal:abort?.signal,headers:{Accept:'application/json'}
       });
     }catch(error){
       throw new Error('Conexao com OSRS Wiki ('+endpoint+'): '+(error?.message||error));
     }
     if(!response.ok)throw new Error('OSRS Wiki '+endpoint+': HTTP '+response.status);
     return response.json();
   }));
   return makeSnapshot(json);
 }finally{
   if(timeout!==null)clearTimeout(timeout);
 }
}
