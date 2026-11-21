/** Cálculos puros para arbitragem regional EVE.
 * Compra imediata consome asks na origem; venda imediata consome bids na estação destino.
 * Taxa de venda cobrada do vendedor; corretagem apenas em ordens nao imediatas.
 */
const n=x=>Number.isFinite(Number(x))?Number(x):0;
export const HUBS={
 jita:{name:'Jita 4-4',region:10000002,station:60003760},
 amarr:{name:'Amarr',region:10000043,station:60008494},
 dodixie:{name:'Dodixie',region:10000032,station:60011866},
 rens:{name:'Rens',region:10000030,station:60004588},
 hek:{name:'Hek',region:10000042,station:60005686}
};
export const BASKETS={
 micro:[[210,'Scourge Light Missile'],[23009,'Caldari Navy Antimatter Charge S'],[2456,'Hobgoblin II'],[2488,'Warrior II'],[34,'Tritanium'],[35,'Pyerite'],[36,'Mexallon'],[28668,'Nanite Repair Paste']],
 regional:[[11371,'Wolf (frigata T2)'],[11381,'Harpy (frigata T2)'],[2048,'Damage Control II'],[1319,'Expanded Cargohold II'],[380,'Small Shield Extender II'],[24495,'Scourge Fury Light Missile'],[24501,'Scourge Precision Light Missile'],[28668,'Nanite Repair Paste']],
 premium:[[40520,'Large Skill Injector'],[40519,'Skill Extractor'],[11371,'Wolf (frigata T2)'],[11381,'Harpy (frigata T2)'],[2048,'Damage Control II'],[1319,'Expanded Cargohold II'],[28668,'Nanite Repair Paste']]
};
// PLEX (44992) excluido de rotas entre hubs: logistica/vault diferem de carga comum.
export function regionalArbitrage(sourceOrders,destinationOrders,{
 sourceStation,destinationStation,capital=50000000,taxPercent=7.5,
 haulPerUnit=0,haulFlat=0,maxUnits=1000,minMargin=0
}={}){
 const source=sourceOrders.filter(o=>Number(o.location_id)===Number(sourceStation)&&o.is_buy_order===false&&n(o.price)>0&&n(o.volume_remain)>0)
  .map(o=>({price:n(o.price),remain:Math.floor(n(o.volume_remain))})).sort((a,b)=>a.price-b.price);
 const destination=destinationOrders.filter(o=>Number(o.location_id)===Number(destinationStation)&&o.is_buy_order===true&&n(o.price)>0&&n(o.volume_remain)>0)
  .map(o=>({price:n(o.price),remain:Math.floor(n(o.volume_remain)),minVolume:Math.max(1,Math.floor(n(o.min_volume)||1))})).sort((a,b)=>b.price-a.price);
 if(!source.length||!destination.length)return null;
 const bestAsk=source[0].price,bestBid=destination[0].price;
 const budget=Math.max(0,n(capital))-Math.max(0,n(haulFlat));
 const tax=Math.max(0,Math.min(50,n(taxPercent)))/100;
 const move=Math.max(0,n(haulPerUnit));
 let count=0,spent=0,received=0,i=0,j=0;
 const maxCount=Math.max(1,Math.min(10000000,Math.floor(n(maxUnits)||1)));
 while(i<source.length&&j<destination.length&&count<maxCount){
  const ask=source[i],bid=destination[j];
  // Não assumir que poderemos vender menos unidades que o mínimo exigido na ordem.
  const marginal=bid.price*(1-tax)-ask.price-move;
  if(marginal<=0)break;
  const room=Math.floor((budget-spent)/ask.price);
  if(room<=0)break;
  const amount=Math.min(ask.remain,bid.remain,room,maxCount-count);
  if(amount<bid.minVolume){j++;continue;}
  if(amount<=0)break;
  count+=amount;spent+=amount*ask.price;received+=amount*bid.price;
  ask.remain-=amount;bid.remain-=amount;
  if(ask.remain<=0)i++;if(bid.remain<=0)j++;
 }
 const net=received*(1-tax)-spent-count*move-Math.max(0,n(haulFlat));
 const invested=spent+count*move+Math.max(0,n(haulFlat));
 const roi=invested>0?net/invested*100:0;
 const positive=count>0&&net>0&&roi>=Math.max(0,n(minMargin));
 return {status:positive?'candidate':count===0?'no-depth':'unprofitable',
  bestAsk,bestBid,count,spent,received,net,invested,roi,
  averageBuy:count?spent/count:0,averageSell:count?received/count:0,
  sourceDepth:sourceOrders.filter(o=>Number(o.location_id)===Number(sourceStation)&&o.is_buy_order===false&&n(o.price)===bestAsk).reduce((a,b)=>a+n(b.volume_remain),0),
  destinationDepth:destinationOrders.filter(o=>Number(o.location_id)===Number(destinationStation)&&o.is_buy_order===true&&n(o.price)===bestBid).reduce((a,b)=>a+n(b.volume_remain),0)
 };
}
export function summarizeHistory(data,now=Date.now(),days=14){
 if(!Array.isArray(data))return null;
 const end=new Date(now);end.setUTCHours(0,0,0,0);
 const first=end.getTime()-days*86400000;
 const rows=data.filter(x=>{const d=Date.parse(String(x.date||''));return Number.isFinite(d)&&d>=first&&d<end.getTime();});
 const total=rows.reduce((a,x)=>a+Math.max(0,n(x.volume)),0);
 const avg=total/days;
 const weighted=rows.reduce((a,x)=>a+n(x.average)*n(x.volume),0);
 return {total,avgDaily:avg,days,daysReported:rows.length,weightedAvg:total>0?weighted/total:0};
}
