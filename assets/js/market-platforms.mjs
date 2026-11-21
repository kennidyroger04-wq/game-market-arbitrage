/** Funcoes puras. Nao fazem consultas e nao executam trades. */
const valid=x=>Number.isFinite(Number(x))?Number(x):0;
export function eveOpportunity(orders,stationId,capital=10000000,tax=7.5,broker=3){
  if(!Array.isArray(orders))throw new Error('Lista de ordens EVE invalida');
  const inStation=orders.filter(o=>Number(o.location_id)===Number(stationId)&&valid(o.price)>0&&valid(o.volume_remain)>0);
  const buys=inStation.filter(o=>o.is_buy_order===true).sort((a,b)=>b.price-a.price);
  const sells=inStation.filter(o=>o.is_buy_order===false).sort((a,b)=>a.price-b.price);
  if(!buys.length||!sells.length)return null;
  const bid=valid(buys[0].price),ask=valid(sells[0].price);
  const bidDepth=buys.filter(o=>valid(o.price)===bid).reduce((s,o)=>s+valid(o.volume_remain),0);
  const askDepth=sells.filter(o=>valid(o.price)===ask).reduce((s,o)=>s+valid(o.volume_remain),0);
  const buyCost=bid*(1+Math.max(0,valid(broker))/100);
  const unitProfit=ask*(1-(Math.max(0,valid(tax))+Math.max(0,valid(broker)))/100)-buyCost;
  const quantity=Math.max(0,Math.floor(Math.min(Math.floor(Math.max(0,valid(capital))/buyCost),bidDepth,askDepth)));
  return {bid,ask,bidDepth,askDepth,quantity,unitProfit,margin:buyCost>0?unitProfit/buyCost*100:0,totalProfit:quantity*unitProfit,orderCount:inStation.length};
}
export function gw2Opportunity(p,capital=50000){
  const bid=valid(p?.buys?.unit_price),ask=valid(p?.sells?.unit_price);
  if(bid<=0||ask<=0)return null;
  const bidDepth=Math.max(0,Math.floor(valid(p?.buys?.quantity))),askDepth=Math.max(0,Math.floor(valid(p?.sells?.quantity)));
  const unitProfit=Math.floor(ask*0.85)-bid; // arredondamento conservador
  const quantity=Math.max(0,Math.min(Math.floor(Math.max(0,valid(capital))/bid),bidDepth,askDepth));
  return {id:Number(p.id),bid,ask,bidDepth,askDepth,quantity,unitProfit,margin:unitProfit/bid*100,totalProfit:unitProfit*quantity};
}