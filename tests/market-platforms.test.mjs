import test from 'node:test';
import assert from 'node:assert/strict';
import {eveOpportunity,gw2Opportunity} from '../assets/js/market-platforms.mjs';
test('EVE filtra apenas ordens da mesma estacao e desconta 2 ordens e imposto',()=>{
 const orders=[
  {location_id:60003760,is_buy_order:true,price:100,volume_remain:40},
  {location_id:60003760,is_buy_order:false,price:125,volume_remain:30},
  {location_id:60008494,is_buy_order:false,price:1,volume_remain:300}
 ];
 const r=eveOpportunity(orders,60003760,1100,7.5,3);
 assert.equal(r.bid,100);assert.equal(r.ask,125);
 assert.equal(r.quantity,10);
 assert.ok(Math.abs(r.unitProfit-12.625)<0.0001);
 assert.equal(r.totalProfit,126.25);
});
test('EVE ignora itens sem par de ordens',()=>{
 assert.equal(eveOpportunity([{location_id:1,is_buy_order:true,price:100,volume_remain:10}],1),null);
});
test('GW2 deduz 15% e limita quantidade por capital e ordens',()=>{
 const r=gw2Opportunity({id:10,buys:{unit_price:100,quantity:30},sells:{unit_price:150,quantity:12}},1000);
 assert.equal(r.unitProfit,27);assert.equal(r.quantity,10);assert.equal(r.totalProfit,270);
});
test('GW2 nao cria oportunidade sem duas cotacoes',()=>{
 assert.equal(gw2Opportunity({id:10,buys:{unit_price:100,quantity:30}}),null);
});