/** Calculos puros dos mercados comunitarios. Nenhuma operacao e executada. */
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const moment=v=>{
 if(!v)return null;
 if(typeof v==='number')return v<1e11?v*1000:v;
 const raw=String(v).trim();
 const iso=/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(raw)&&!/(Z|[+-]\d\d:?\d\d)$/.test(raw)?raw.replace(' ','T')+'Z':raw;
 const ms=Date.parse(iso);return Number.isFinite(ms)?ms:null;
};
export const ALBION_CITIES=['Bridgewatch','Martlock','Lymhurst','Thetford','Fort Sterling','Caerleon'];
export const ALBION_IDS=[4,5,6,7,8].flatMap(t=>['ORE','WOOD','HIDE','FIBER','ROCK'].map(res=>'T'+t+'_'+res));
export function calculateAlbion(raw,{capital=1000000,tax=6,transport=0,maxAgeHours=24,source='all',destination='all',positive=true}={},now=Date.now()){
 if(!Array.isArray(raw))throw new Error('Lista de cotacoes Albion invalida');
 const validDate=date=>{const stamp=moment(date);return stamp!==null&&stamp<=now+120000&&stamp>=now-Math.max(1,n(maxAgeHours))*3600000;};
 const points=raw.filter(q=>q&&String(q.quality)==='1'&&q.item_id&&ALBION_CITIES.includes(q.city));
 const byItem=new Map();for(const p of points){const list=byItem.get(p.item_id)||[];list.push(p);byItem.set(p.item_id,list);}
 const candidates=[];
 for(const [id,list] of byItem){
  for(const a of list)for(const b of list){
   if(a.city===b.city||source!=='all'&&source!==a.city||destination!=='all'&&destination!==b.city)continue;
   const buy=n(a.sell_price_min),sell=n(b.buy_price_max);
   if(buy<=0||sell<=0||!validDate(a.sell_price_min_date)||!validDate(b.buy_price_max_date))continue;
   const qty=Math.min(100000,Math.floor(Math.max(0,n(capital))/buy));
   if(qty<1)continue;
   const perUnit=sell*(1-Math.max(0,n(tax))/100)-buy-Math.max(0,n(transport));
   const profit=perUnit*qty,margin=perUnit/buy*100;
   if(positive&&profit<=0)continue;
   candidates.push({id,from:a.city,to:b.city,buy,sell,qty,profit,margin,perUnit,ageHours:Math.max((now-moment(a.sell_price_min_date))/3600000,(now-moment(b.buy_price_max_date))/3600000),quality:1});
  }
 }
 return candidates.sort((a,b)=>b.profit-a.profit);
}
export function calculateFio(raw,{capital=100000,fee=2,transport=0,mode='between',exchange='all',positive=true}={}){
 if(!Array.isArray(raw))throw new Error('Lista de cotacoes FIO invalida');
 const byTicker=new Map();
 for(const row of raw){
  if(!row||!row.MaterialTicker||!row.ExchangeCode)continue;
  const x=byTicker.get(row.MaterialTicker)||[];x.push(row);byTicker.set(row.MaterialTicker,x);
 }
 const results=[];
 for(const [ticker,markets] of byTicker){
  for(const buyAt of markets)for(const sellAt of markets){
   const across=buyAt.ExchangeCode!==sellAt.ExchangeCode;
   if(mode==='between'&&!across||mode==='within'&&across)continue;
   if(exchange!=='all'&&buyAt.ExchangeCode!==exchange&&sellAt.ExchangeCode!==exchange)continue;
   const buy=n(buyAt.Ask),sell=across?n(sellAt.Bid):n(sellAt.Ask);
   const buyTarget=across?buy:n(buyAt.Bid);
   if(buyTarget<=0||sell<=0)continue;
   const qty=Math.min(10000,Math.floor(Math.max(0,n(capital))/buyTarget));
   if(qty<=0)continue;
   const perUnit=sell*(1-Math.max(0,n(fee))/100)-buyTarget-(across?Math.max(0,n(transport)):0);
   const profit=qty*perUnit,margin=perUnit/buyTarget*100;
   if(positive&&profit<=0)continue;
   results.push({ticker,from:buyAt.ExchangeCode,to:sellAt.ExchangeCode,buy:buyTarget,sell,qty,profit,margin,perUnit,ask:buy,bid:n(buyAt.Bid),supply:n(buyAt.Supply),demand:n(sellAt.Demand),mode:across?'cross':'passive'});
  }
 }
 return results.sort((a,b)=>b.profit-a.profit);
}
