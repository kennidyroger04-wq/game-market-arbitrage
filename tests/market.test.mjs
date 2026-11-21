import test from 'node:test';
import assert from 'node:assert/strict';
import {geTax,safeQuantity,ageMinutes,evaluate,analyze,toCsv,demoSnapshot} from '../assets/js/market.mjs';

const NOW=2_000_000_000;
const item={id:42,name:'Teste',members:false,limit:1000,low:100,high:115,lowTime:NOW-60,highTime:NOW-120,volume24:10000,volume5:100,volume1h:1000};
const opts={capital:10000,minMargin:2,maxAge:30,minDailyVolume:1000,minFiveVolume:5};

test('Taxa GE: 2% arredondado para baixo, teto 5 milhões',()=>{
 assert.equal(geTax(49),0);assert.equal(geTax(115),2);
 assert.equal(geTax(250000000),5000000);assert.equal(geTax(300000000),5000000);
});
test('Quantidade limitada pelo capital, limite 4h e volume',()=>{
 assert.equal(safeQuantity({capital:10000,buyPrice:100,buyLimit:500,dailyVolume:10000}),100);
 assert.equal(safeQuantity({capital:100000,buyPrice:100,buyLimit:5,dailyVolume:10000}),5);
 assert.equal(safeQuantity({capital:100000,buyPrice:100,buyLimit:500,dailyVolume:20}),0);
});
test('Flip limite não equivale a lucro de compra e venda imediatas',()=>{
 const v=evaluate(item,opts,NOW);
 assert.equal(v.perUnit,13);assert.equal(v.quantity,100);
 assert.equal(v.totalProfit,1300);assert.ok(v.immediateProfit<0);
});
test('Preço low e high precisam ser recentes independentemente',()=>{
 assert.equal(evaluate({...item,highTime:NOW-3600},opts,NOW),null);
 assert.equal(evaluate({...item,lowTime:NOW-3600},opts,NOW),null);
});
test('Filtrar itens premium e ausência de liquidez',()=>{
 assert.equal(evaluate({...item,members:true},opts,NOW),null);
 assert.equal(evaluate({...item,volume5:0},opts,NOW),null);
 assert.equal(evaluate({...item,high:100},opts,NOW),null);
});
test('Ordenação e exportação CSV protegem fórmulas',()=>{
 const snap={items:[item,{...item,id:43,name:'=HYPERLINK("x")',high:140}]};
 const rows=analyze(snap,opts,NOW);
 assert.equal(rows.length,2);assert.equal(rows[0].id,43);
 assert.match(toCsv(rows),/"'=HYPERLINK/);
});
test('Dados de demonstração explicitamente marcados',()=>{
 const demo=demoSnapshot(NOW);
 assert.match(demo.source,/FICTÍCIOS/);
 assert.equal(analyze(demo,opts,NOW).length,2);
});
