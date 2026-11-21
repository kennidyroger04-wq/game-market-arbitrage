import test from 'node:test';
import assert from 'node:assert/strict';
import {FALLBACK_WATCHLIST,fallbackScanItems,analyzeItemMarket} from '../assets/js/torn-market.mjs';
test('Lista pronta permite procurar 15 produtos sem acessar torn/items',()=>{
 assert.equal(FALLBACK_WATCHLIST.length,25);
 const rows=fallbackScanItems({category:'all',count:15});
 assert.equal(rows.length,15);
 assert.equal(new Set(rows.map(x=>x.id)).size,15);
 assert.ok(rows.some(x=>x.type==='Flower'));
 assert.ok(rows.some(x=>x.type==='Plushie'));
 assert.ok(rows.some(x=>x.id===206));
});
test('Filtros por categoria funcionam sem catálogo',()=>{
 assert.equal(fallbackScanItems({category:'Plushie',count:30}).length,13);
 assert.equal(fallbackScanItems({category:'Flower',count:30}).length,11);
 assert.deepEqual(fallbackScanItems({category:'Drug',count:30}).map(x=>x.id),[206]);
 assert.deepEqual(fallbackScanItems({category:'Medical',count:30}),[]);
});
test('IDs digitados funcionam mesmo fora da lista pronta, sem dados inventados',()=>{
 const rows=fallbackScanItems({query:'206,258,99999,206',count:30});
 assert.deepEqual(rows.map(x=>x.id),[206,258,99999]);
 assert.equal(rows.at(-1).name,'Item #99999');
});
test('Query por nomes de itens conhecidos funciona sem catálogo',()=>{
 assert.deepEqual(fallbackScanItems({query:'Xanax',count:10}).map(x=>x.id),[206]);
 assert.deepEqual(fallbackScanItems({query:'Chamois',count:10}).map(x=>x.id),[258]);
});
test('A lista não fabrica dados: ranking só ocorre com anúncios e cache reais',()=>{
 const r=analyzeItemMarket({itemmarket:{item:{id:206,name:'Xanax',type:'Drug',average_price:1000},listings:[{price:600,amount:2},{price:1000,amount:5}],cache_timestamp:1800000000}},{capital:3000,minMargin:2,maxUnits:2,maxAgeMinutes:90},1800000000000);
 assert.equal(r.status,'candidate');
 assert.equal(r.lowestPrice,600);
 assert.ok(r.totalProfit>0);
 assert.equal(analyzeItemMarket({itemmarket:{item:{id:206,name:'Xanax',type:'Drug',average_price:1000},listings:[],cache_timestamp:1800000000}}, {},1800000000000).status,'thin');
});
