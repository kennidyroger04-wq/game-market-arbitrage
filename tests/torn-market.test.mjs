import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog,chooseScanItems,analyzeItemMarket,csvTorn} from '../assets/js/torn-market.mjs';
const NOW=Date.parse('2026-11-21T17:00:00Z');
const market=({type='Plushie',avg=200,price=100,second=160,qty=2,cacheAge=1,detail=null}={})=>({
 itemmarket:{
  item:{id:206,name:'Synthetic Item',type,average_price:avg},
  listings:[{price,amount:qty,...(detail?{item_details:detail}:{})},{price:second,amount:30},{price:second+10,amount:40}],
  cache_timestamp:Math.floor(NOW/1000)-cacheAge*60
 }
});
test('API itemmarket: lucro desconta 5% e limita quantidade ao anuncio e capital',()=>{
 const r=analyzeItemMarket(market(),{capital:1000,feePercent:5,minMargin:2,maxUnits:10},NOW);
 assert.equal(r.status,'candidate');assert.equal(r.target,159);assert.equal(r.qty,2);
 assert.ok(Math.abs(r.totalProfit-102.1)<0.00001);
});
test('Torn: preço médio baixo ou taxa alta impede falso lucro',()=>{
 assert.notEqual(analyzeItemMarket(market({avg:105}),{capital:1000,feePercent:5,minMargin:2},NOW).status,'candidate');
 assert.notEqual(analyzeItemMarket(market({avg:115}),{capital:1000,feePercent:20,minMargin:2},NOW).status,'candidate');
});
test('Torn: protege equipamentos com atributos individuais',()=>{
 const r=analyzeItemMarket(market({type:'Weapon'}),{},NOW);
 assert.equal(r.status,'variable');
 const r2=analyzeItemMarket(market({detail:{uid:'x'}}),{},NOW);
 assert.equal(r2.status,'variable');
});
test('Torn: ignora dados antigos e precos sem proximo concorrente',()=>{
 assert.equal(analyzeItemMarket(market({cacheAge:150}),{maxAgeMinutes:90},NOW).status,'stale');
 const same=market();same.itemmarket.listings.forEach(x=>{x.price=100;});
 assert.equal(analyzeItemMarket(same,{},NOW).status,'no-reference');
});
test('Torn: catálogo usa metadata real, escolhe sem pedir dezenas de IDs',()=>{
 const data=normalizeCatalog({items:[
 {id:206,name:'Synthetic Item',type:'Plushie',circulation:1000,is_tradable:true,value:{market_price:200}},
 {id:258,name:'Flower 1',type:'Flower',circulation:500,is_tradable:true,value:{market_price:500}},
 {id:300,name:'Weapon',type:'Weapon',circulation:10000,is_tradable:true,value:{market_price:100}}
 ]});
 assert.equal(data.length,3);
 assert.deepEqual(chooseScanItems(data,{category:'all',capital:1000,count:15}).map(x=>x.id),[206,258]);
 assert.deepEqual(chooseScanItems(data,{query:'206',capital:1000,count:15}).map(x=>x.id),[206]);
 assert.deepEqual(chooseScanItems(data,{category:'Flower',capital:1000,count:15}).map(x=>x.id),[258]);
});
test('Torn: CSV preserva campos e escapa fórmulas',()=>{
 const r=analyzeItemMarket(market(),{capital:1000,feePercent:5},NOW);
 const content=csvTorn([{...r,name:'=INVALID()'}]);
 assert.ok(content.includes('"\'=INVALID()"'));
 assert.ok(content.includes('Lucro liquido hipotetico'));
});
