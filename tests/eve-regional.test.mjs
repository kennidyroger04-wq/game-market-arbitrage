import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalArbitrage,summarizeHistory,HUBS,BASKETS} from '../assets/js/eve-regional-core.mjs';

const source=[
 {location_id:HUBS.jita.station,is_buy_order:false,price:100,volume_remain:10},
 {location_id:HUBS.jita.station,is_buy_order:false,price:120,volume_remain:10},
 {location_id:HUBS.amarr.station,is_buy_order:false,price:1,volume_remain:500}
];
const dest=[
 {location_id:HUBS.amarr.station,is_buy_order:true,price:180,volume_remain:5,min_volume:1},
 {location_id:HUBS.amarr.station,is_buy_order:true,price:160,volume_remain:10,min_volume:1},
 {location_id:HUBS.jita.station,is_buy_order:true,price:999,volume_remain:100}
];
test('Arbitragem entre hubs desconta imposto e frete e respeita livro de ordens',()=>{
 const r=regionalArbitrage(source,dest,{sourceStation:HUBS.jita.station,destinationStation:HUBS.amarr.station,capital:5000,taxPercent:7.5,haulPerUnit:10,haulFlat:50,maxUnits:10,minMargin:2});
 assert.equal(r.status,'candidate');
 assert.equal(r.count,10);
 assert.equal(r.bestAsk,100);
 assert.equal(r.bestBid,180);
 assert.equal(r.spent,1000);
 assert.equal(r.received,1700);
 assert.ok(Math.abs(r.net-422.5)<0.001);
});
test('Arbitragem respeita capital e quantidade',()=>{
 const r=regionalArbitrage(source,dest,{sourceStation:HUBS.jita.station,destinationStation:HUBS.amarr.station,capital:250,taxPercent:7.5,maxUnits:100});
 assert.equal(r.count,2);
 assert.equal(r.spent,200);
});
test('Arbitragem nao marca margem negativa como oportunidade',()=>{
 const r=regionalArbitrage(source,dest,{sourceStation:HUBS.jita.station,destinationStation:HUBS.amarr.station,capital:5000,taxPercent:40,haulPerUnit:30,maxUnits:10});
 assert.equal(r.status,'no-depth');
});
test('Nao mistura as ordens de outras estacoes e respeita minimo do bid',()=>{
 const onlyBad=[{location_id:HUBS.amarr.station,is_buy_order:true,price:200,volume_remain:10,min_volume:11}];
 assert.equal(regionalArbitrage(source,onlyBad,{sourceStation:HUBS.jita.station,destinationStation:HUBS.amarr.station,capital:5000,maxUnits:10}).status,'no-depth');
 assert.equal(regionalArbitrage(source,[],{sourceStation:HUBS.jita.station,destinationStation:HUBS.amarr.station}),null);
});
test('Historico calcula volume diario apenas nos 14 dias fechados',()=>{
 const now=Date.parse('2026-11-21T14:00:00Z');
 const info=summarizeHistory([{date:'2026-11-20',volume:140,average:100},{date:'2026-11-19',volume:140,average:200},{date:'2026-11-21',volume:100000,average:1000},{date:'2026-10-01',volume:100000,average:1000}],now,14);
 assert.equal(info.total,280);
 assert.equal(info.avgDaily,20);
 assert.equal(info.daysReported,2);
 assert.equal(info.weightedAvg,150);
});
test('Cestas variam por capital e nao transportam PLEX',()=>{
 assert.ok(BASKETS.micro.length>0&&BASKETS.regional.length>0&&BASKETS.premium.length>0);
 assert.ok(Object.values(BASKETS).flat().every(x=>x[0]!==44992));
});
