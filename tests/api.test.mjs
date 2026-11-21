import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSnapshot,fetchLiveSnapshot} from '../assets/js/api.mjs';

function fixtures(){
 const mapping=Array.from({length:110},(_,i)=>({id:i+1,name:'Item '+(i+1),members:i===0,limit:1000}));
 const latest={data:{}}, five={data:{}}, hour={data:{}},day={data:{}};
 for(let i=1;i<=110;i++){
   const k=String(i);
   latest.data[k]={low:100,high:120,lowTime:1800000,highTime:1800020};
   five.data[k]={lowPriceVolume:10,highPriceVolume:10};
   hour.data[k]={lowPriceVolume:100,highPriceVolume:100};
   day.data[k]={lowPriceVolume:1000,highPriceVolume:1000};
 }
 return [mapping,latest,five,hour,day];
}
test('Parser usa metadata, v2 high/low e volume sem fabricar ordens',()=>{
 const s=makeSnapshot(fixtures(),new Date('2026-11-21T14:00:00Z'));
 assert.equal(s.items.length,110);
 assert.equal(s.items[0].members,true);
 assert.equal(s.items[0].high,120);
 assert.equal(s.items[0].volume24,2000);
 assert.equal(s.fetched_at,'2026-11-21T14:00:00.000Z');
 assert.match(s.notes,/nao ordens/i);
});
test('Parser rejeita feeds incompletos',()=>{
 const f=fixtures();
 f[4]={data:{}};
 assert.throws(()=>makeSnapshot(f),/somente 0 itens/i);
});
test('Leitor browser consulta cinco endpoints e nao depende de snapshot',async()=>{
 const [mapping,latest,five,hour,day]=fixtures();
 const payloads={mapping,latest,'5m':five,'1h':hour,'24h':day};
 const calls=[];
 const fetcher=async(url,opts)=>{
   const ep=url.split('/').at(-1);calls.push(ep);
   assert.equal(opts.cache,'no-store');
   return {ok:true,json:async()=>payloads[ep]};
 };
 const s=await fetchLiveSnapshot(fetcher);
 assert.equal(s.items.length,110);
 assert.deepEqual(calls.sort(),['mapping','latest','5m','1h','24h'].sort());
});
test('Falha de rede e erro HTTP sao informados',async()=>{
 const bad=async()=>({ok:false,status:429});
 await assert.rejects(()=>fetchLiveSnapshot(bad),/HTTP 429/);
});
