/** Motor puro: análise de anúncios oficiais Torn. Não executa negociações. */
const N=x=>Number.isFinite(Number(x))?Number(x):0;
export const TORN_GROUPS=['Plushie','Flower','Drug','Medical','Booster','Candy','Alcohol','Energy Drink','Material','Supply Pack','Other'];
const EXCLUDED=new Set(['Weapon','Armor','Car','Clothing','Jewelry','Collectible']);

/** IDs comunitários públicos para testes quando a chave customizada permite apenas market/itemmarket.
 * Esta lista é uma amostra fixa, NÃO contém preços, quantidades, médias ou status de mercado.
 * Fonte: https://www.torn.com/forums.php?f=63&t=16478083
 */
const FLOWERS=[282,617,271,277,263,260,272,267,264,276,385];
const PLUSHIES=[384,273,258,215,281,269,266,274,268,186,618,187,261];
export const FALLBACK_WATCHLIST=[
 ...FLOWERS.map(id=>({id,name:'Flor #'+id,type:'Flower'})),
 ...PLUSHIES.map(id=>({id,name:id===258?'Chamois Plushie':'Pelúcia #'+id,type:'Plushie'})),
 {id:206,name:'Xanax',type:'Drug'}
];
/** Seleciona somente IDs existentes na lista ou informados pelo jogador; não precisa da seleção torn/items. */
export function fallbackScanItems({category='all',count=15,query=''}={}){
 const limit=Math.max(1,Math.min(30,Math.floor(N(count)||15)));
 const q=String(query||'').trim().toLowerCase();
 if(q){
  const parts=q.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean);
  const numberIds=parts.filter(x=>/^\d+$/.test(x)).map(Number).filter(x=>Number.isSafeInteger(x)&&x>0);
  const result=numberIds.map(id=>FALLBACK_WATCHLIST.find(x=>x.id===id)||{id,name:'Item #'+id,type:'Other'});
  const names=FALLBACK_WATCHLIST.filter(x=>parts.some(p=>!/^\d+$/.test(p)&&x.name.toLowerCase().includes(p)));
  const seen=new Set();
  return [...result,...names].filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;}).slice(0,limit);
 }
 const list=category==='all'?FALLBACK_WATCHLIST:FALLBACK_WATCHLIST.filter(x=>x.type===category);
 if(category!=='all')return list.slice(0,limit);
 const groups=[FLOWERS.map(id=>FALLBACK_WATCHLIST.find(x=>x.id===id)),PLUSHIES.map(id=>FALLBACK_WATCHLIST.find(x=>x.id===id)),FALLBACK_WATCHLIST.filter(x=>x.type==='Drug')];
 const mixed=[];
 while(mixed.length<limit&&groups.some(g=>g.length)){
  for(const group of groups){if(group.length&&mixed.length<limit)mixed.push(group.shift());}
 }
 return mixed;
}

export function normalizeCatalog(payload){
 const data=Array.isArray(payload?.items)?payload.items:[];
 return data.filter(x=>x&&Number.isSafeInteger(Number(x.id))&&Number(x.id)>0)
 .map(x=>({id:Number(x.id),name:String(x.name||('Item #'+x.id)),type:String(x.type||'Other'),circulation:Math.max(0,N(x.circulation)),marketPrice:Math.max(0,N(x.value?.market_price)),tradable:x.is_tradable!==false,details:x.details||null}));
}
/** Seleção distribuída entre tipos e faixas de preço; circulação não equivale a volume. */
export function chooseScanItems(items,{category='all',capital=5000000,count=15,query=''}={}){
 const limit=Math.max(1,Math.min(30,Math.floor(N(count)||15)));
 const budget=Math.max(1,N(capital));
 const q=String(query||'').trim().toLowerCase();
 if(q){
  const parts=q.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean);
  const ids=parts.filter(x=>/^\d+$/.test(x)).map(Number);
  const matches=items.filter(x=>ids.includes(x.id)||parts.some(p=>!/^\d+$/.test(p)&&x.name.toLowerCase().includes(p)));
  const seen=new Set();return matches.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;}).slice(0,limit);
 }
 const safe=items.filter(x=>x.tradable&&x.marketPrice>=100&&x.marketPrice<=budget*2&&TORN_GROUPS.includes(x.type)&& !EXCLUDED.has(x.type));
 const filtered=category==='all'?safe:safe.filter(x=>x.type===category);
 filtered.sort((a,b)=>b.circulation-a.circulation||a.marketPrice-b.marketPrice);
 if(category!=='all')return filtered.slice(0,limit);
 const buckets=new Map();
 for(const x of filtered){
  const band=x.marketPrice<10000?0:x.marketPrice<100000?1:x.marketPrice<1000000?2:3;
  const key=x.type+'|'+band,arr=buckets.get(key)||[];arr.push(x);buckets.set(key,arr);
 }
 const keys=[...buckets.keys()].sort((a,b)=>{
  const [ta,pa]=a.split('|'),[tb,pb]=b.split('|');
  const order=TORN_GROUPS;
  return order.indexOf(ta)-order.indexOf(tb)||Number(pa)-Number(pb);
 });
 const selected=[],seen=new Set();
 while(selected.length<limit){
  let progressed=false;
  for(const key of keys){
   const arr=buckets.get(key);
   if(!arr.length)continue;
   const x=arr.shift();if(seen.has(x.id))continue;
   seen.add(x.id);selected.push(x);progressed=true;
   if(selected.length>=limit)break;
  }
  if(!progressed)break;
 }
 return selected;
}
export function analyzeItemMarket(payload,{capital=5000000,feePercent=5,minMargin=2,maxUnits=10,maxAgeMinutes=90}={},now=Date.now()){
 const m=payload?.itemmarket;
 const id=Number(m?.item?.id);
 const name=String(m?.item?.name||('Item #'+id));
 const typ=String(m?.item?.type||'Other');
 const avg=N(m?.item?.average_price);
 if(!m||!Number.isSafeInteger(id)||!Array.isArray(m.listings))return {status:'invalid',id,name};
 const stamped=N(m.cache_timestamp);
 const cacheAge=stamped>0?Math.max(0,(now-stamped*1000)/60000):null;
 if(cacheAge===null||cacheAge>Math.max(1,N(maxAgeMinutes)))return {status:'stale',id,name,cacheAge};
 // Itens com atributos individuais podem ser incomparáveis, mesmo com mesmo item_id.
 const raws=m.listings.filter(x=>x&&N(x.price)>0&&N(x.amount)>0);
 const variable=EXCLUDED.has(typ)||raws.some(x=>x.item_details!=null);
 if(variable)return {status:'variable',id,name,cacheAge};
 const listings=raws.map(x=>({price:N(x.price),amount:Math.floor(N(x.amount))})).sort((a,b)=>a.price-b.price);
 if(listings.length<2)return {status:'thin',id,name,cacheAge};
 const cheapest=listings[0].price;
 const cheapQty=listings.filter(x=>x.price===cheapest).reduce((s,x)=>s+x.amount,0);
 const nextDistinct=listings.find(x=>x.price>cheapest)?.price;
 if(!nextDistinct||avg<=0)return {status:'no-reference',id,name,cacheAge,cheapest,avg,cheapQty,listingCount:listings.length};
 const target=Math.floor(Math.min(avg,nextDistinct-1));
 if(target<=cheapest)return {status:'no-spread',id,name,cacheAge,cheapest,target,avg,cheapQty,listingCount:listings.length};
 const fee=Math.max(0,Math.min(20,N(feePercent)))/100;
 const unitNet=target*(1-fee)-cheapest;
 const margin=unitNet/cheapest*100;
 const budget=Math.max(0,N(capital));
 const quantity=Math.max(0,Math.floor(Math.min(cheapQty,budget/cheapest,Math.max(1,Math.floor(N(maxUnits))))));
 if(quantity<1)return {status:'capital',id,name,cacheAge,cheapest,target,avg,cheapQty};
 if(unitNet<=0||margin<N(minMargin))return {status:'margin',id,name,cacheAge,cheapest,target,avg,cheapQty,margin};
 // Quanto maior a pilha mais barata, maior pode ser a fila concorrente até seu preço alvo.
 const aheadQty=listings.filter(x=>x.price<target).reduce((s,x)=>s+x.amount,0);
 const ratio=target/cheapest;
 const risk=(aheadQty>100||ratio>2||cacheAge>60)?'alto':(aheadQty>10||ratio>1.25||cacheAge>30)?'médio':'moderado';
 return {status:'candidate',id,name,type:typ,cacheAge,lowestPrice:cheapest,target,avg,cheapQty,nextDistinct,qty:quantity,unitNet,margin,totalProfit:unitNet*quantity,cost:cheapest*quantity,feePercent:fee*100,listingCount:listings.length,aheadQty,risk,cacheTimestamp:stamped,source:'Torn API v2'};
}
export function csvTorn(rows){
 const heads=['ID','Item','Tipo','Comprar T$','Revenda hipotetica T$','Media oficial T$','Qtd simulada','Custo T$','Lucro liquido hipotetico T$','Margem %','Idade do cache min','Risco','Qtd a frente'];
 const sanitize=x=>{let s=String(x??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[heads,...rows.map(x=>[x.id,x.name,x.type,x.lowestPrice,x.target,x.avg,x.qty,Math.round(x.cost),Math.round(x.totalProfit),x.margin.toFixed(2),x.cacheAge.toFixed(1),x.risk,x.aheadQty])].map(a=>a.map(sanitize).join(';')).join('\r\n');
}
