import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAlbion,calculateFio,ALBION_IDS} from '../assets/js/community-core.mjs';

const NOW=Date.parse('2026-11-21T18:00:00Z');
const goodDate='2026-11-21T17:55:00Z';
const ancientDate='2026-11-20T00:00:00Z';
const albionPair=date=>[
 {item_id:'T4_ORE',city:'Bridgewatch',quality:1,sell_price_min:100,sell_price_min_date:date,buy_price_max:70,buy_price_max_date:date},
 {item_id:'T4_ORE',city:'Martlock',quality:1,sell_price_min:170,sell_price_min_date:date,buy_price_max:150,buy_price_max_date:date}
];
test('Albion compara cidades do mesmo servidor com custos e datas recentes',()=>{
 const rows=calculateAlbion(albionPair(goodDate),{capital:1000,tax:5,transport:10,maxAgeHours:24},NOW);
 assert.equal(rows.length,1);
 assert.equal(rows[0].from,'Bridgewatch');
 assert.equal(rows[0].to,'Martlock');
 assert.equal(rows[0].qty,10);
 assert.equal(rows[0].profit,325);
});
test('Albion descarta cotacoes antigas e qualidade diferente',()=>{
 assert.equal(calculateAlbion(albionPair(ancientDate),{maxAgeHours:6},NOW).length,0);
 const mixed=albionPair(goodDate);mixed[1].quality=2;
 assert.equal(calculateAlbion(mixed,{},NOW).length,0);
 assert.equal(ALBION_IDS.length,25);
});
const fio=[
 {MaterialTicker:'FE',ExchangeCode:'AI1',Bid:90,Ask:100,Supply:1000,Demand:1000},
 {MaterialTicker:'FE',ExchangeCode:'CI1',Bid:155,Ask:165,Supply:1000,Demand:1000}
];
test('FIO entre bolsas usa ask na compra e bid na venda',()=>{
 const rows=calculateFio(fio,{capital:1000,fee:2,transport:10,mode:'between'});
 assert.equal(rows.length,1);
 assert.equal(rows[0].from,'AI1');
 assert.equal(rows[0].to,'CI1');
 assert.ok(rows[0].profit>0);
});
test('FIO na mesma bolsa faz somente simulacao com duas ordens passivas',()=>{
 const rows=calculateFio(fio,{capital:1000,fee:2,mode:'within'});
 assert.equal(rows.length,2);
 assert.ok(rows.every(x=>x.mode==='passive'&&x.from===x.to));
});
test('Nao anunciar prejuizo como oportunidade no filtro padrao',()=>{
 const rows=calculateFio([{MaterialTicker:'H2O',ExchangeCode:'AI1',Bid:100,Ask:100}],{mode:'within',fee:5});
 assert.equal(rows.length,0);
});
