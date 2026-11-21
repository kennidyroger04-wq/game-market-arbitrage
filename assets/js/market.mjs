/** OSRS Grand Exchange calculations. API prices are executed trades, not order book. */
export const TAX_RATE=0.02;
export const TAX_CAP=5_000_000;
const n=x=>Number.isFinite(Number(x))?Number(x):0;

/** Conservative because some item categories are tax exempt. */
export function geTax(price){
 return Math.min(TAX_CAP,Math.floor(Math.max(0,n(price))*TAX_RATE));
}
export function safeQuantity({capital,buyPrice,buyLimit,dailyVolume,volumeFraction=0.01}){
 const price=Math.floor(n(buyPrice));
 if(price<=0)return 0;
 const byCapital=Math.floor(Math.max(0,n(capital))/price);
 const byLimit=n(buyLimit)>0?Math.floor(n(buyLimit)):0;
 const byVolume=Math.floor(Math.max(0,n(dailyVolume))*volumeFraction);
 return Math.max(0,Math.min(byCapital,byLimit,byVolume));
}
export function ageMinutes(timestamp,nowSeconds=Date.now()/1000){
 const t=n(timestamp);return t<=0?Infinity:Math.max(0,(nowSeconds-t)/60);
}
/** Patient BUY near last instant-sell low, patient SELL near last instant-buy high.
 * Neither is currently available for immediate execution at these prices. */
export function evaluate(item,opts={},nowSeconds=Date.now()/1000){
 if(opts.freeOnly!==false&&item.members===true)return null;
 const buy=n(item.low),sell=n(item.high);
 if(buy<=0||sell<=buy)return null;
 const buyAge=ageMinutes(item.lowTime,nowSeconds),sellAge=ageMinutes(item.highTime,nowSeconds);
 const maxAge=n(opts.maxAge??30);
 if(buyAge>maxAge||sellAge>maxAge)return null;
 const vol24=n(item.volume24),vol5=n(item.volume5),vol1h=n(item.volume1h);
 if(vol24<n(opts.minDailyVolume??1000)||vol5<n(opts.minFiveVolume??5))return null;
 const quantity=safeQuantity({capital:n(opts.capital??25000),buyPrice:buy,buyLimit:item.limit,dailyVolume:vol24,volumeFraction:n(opts.volumeFraction??0.01)});
 if(quantity<1)return null;
 const tax=geTax(sell),perUnit=sell-tax-buy;
 const margin=perUnit/buy*100;
 if(perUnit<=0||margin<n(opts.minMargin??2)||perUnit*quantity<n(opts.minProfit??0))return null;
 return {...item,buy,sell,tax,perUnit,margin,quantity,
  totalProfit:quantity*perUnit,requiredCapital:quantity*buy,
  immediateProfit:buy-geTax(buy)-sell,
  buyAge,sellAge,vol24,vol5,vol1h,
  score:Math.round(100*(Math.min(1,Math.log10(1+vol24)/7)*0.5+
    Math.max(0,1-Math.max(buyAge,sellAge)/Math.max(1,maxAge))*0.5))};
}
export function analyze(snapshot,opts={},nowSeconds=Date.now()/1000){
 if(!snapshot||!Array.isArray(snapshot.items))throw new Error('Snapshot sem itens');
 const rows=snapshot.items.map(i=>evaluate(i,opts,nowSeconds)).filter(Boolean);
 const sorting={
  profit:(a,b)=>b.totalProfit-a.totalProfit,
  margin:(a,b)=>b.margin-a.margin,
  volume:(a,b)=>b.vol24-a.vol24,
  perUnit:(a,b)=>b.perUnit-a.perUnit,
  freshness:(a,b)=>Math.max(a.buyAge,a.sellAge)-Math.max(b.buyAge,b.sellAge)
 };
 rows.sort(sorting[opts.sort]||sorting.profit);
 return rows;
}
export function demoSnapshot(now=Date.now()/1000){
 const t=Math.floor(now);
 return {schema_version:1,game:'osrs',fetched_at:new Date(t*1000).toISOString(),source:'DEMONSTRAÇÃO — DADOS FICTÍCIOS',items:[
  {id:1,name:'Item fictício A',members:false,limit:5000,low:100,high:115,lowTime:t-90,highTime:t-120,volume24:80000,volume5:210,volume1h:1200},
  {id:2,name:'Item fictício B',members:false,limit:2000,low:250,high:265,lowTime:t-90,highTime:t-120,volume24:60000,volume5:95,volume1h:800},
  {id:3,name:'Item fictício premium',members:true,limit:5000,low:1000,high:1240,lowTime:t-90,highTime:t-120,volume24:20000,volume5:70,volume1h:600}
 ]};
}
export function csvSafe(v){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function toCsv(rows){
 const heads=['ID','Item','F2P','Compra low','Venda high','Imposto/un','Lucro/un','Margem %','Quantidade','Capital','Lucro potencial','Volume 5m','Volume 1h','Volume 24h','Idade low min','Idade high min','Limite 4h'];
 const lines=rows.map(r=>[r.id,r.name,r.members?'Não':'Sim',r.buy,r.sell,r.tax,r.perUnit,r.margin.toFixed(2),r.quantity,r.requiredCapital,r.totalProfit,r.vol5,r.vol1h,r.vol24,r.buyAge.toFixed(1),r.sellAge.toFixed(1),r.limit]);
 return '\uFEFF'+[heads,...lines].map(row=>row.map(csvSafe).join(';')).join('\r\n');
}
