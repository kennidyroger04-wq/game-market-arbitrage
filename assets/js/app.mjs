import {analyze,geTax,ageMinutes,demoSnapshot,toCsv} from './market.mjs';
import {fetchLiveSnapshot} from './api.mjs';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const fmt=x=>Math.round(num(x)).toLocaleString('pt-BR');
const dec=x=>num(x).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
let snapshot=null,rows=[],visible=30,demo=false;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
let favorites=new Set(read('gma.favorites',[])),trades=read('gma.trades',[]);
function notice(message,kind='neutral'){$('notice').className='alert '+kind;$('notice').textContent=message;}
function status(message,bad=false){$('dataStatus').textContent=message;$('dataStatus').className='chip'+(bad?' warn':'');}
function options(){return {capital:num($('capital').value),minMargin:num($('margin').value),minDailyVolume:num($('volume').value),minFiveVolume:num($('volume5').value),maxAge:num($('age').value),freeOnly:$('f2p').checked,sort:$('sort').value};}
function update(){
 if(!snapshot)return;
 try{
  rows=analyze(snapshot,options());
  const search=$('search').value.trim().toLocaleLowerCase('pt-BR');
  if(search)rows=rows.filter(x=>x.name.toLocaleLowerCase('pt-BR').includes(search)||String(x.id)===search);
  if($('favoritesOnly').checked)rows=rows.filter(x=>favorites.has(x.id));
  $('observedCount').textContent=fmt(snapshot.items.length);
  $('resultCount').textContent=fmt(rows.length);
  $('bestProfit').textContent=rows.length?fmt(Math.max(...rows.map(r=>r.totalProfit)))+' GP':'—';
  $('lastFetch').textContent=new Date(snapshot.fetched_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  $('sourceTag').textContent=demo?'DADOS FICTÍCIOS':'Fonte: OSRS Wiki v2';
  $('csv').disabled=rows.length===0;
  render();
 }catch(error){notice('Falha no processamento: '+error.message,'warning');}
}
function itemButtons(r){return '<button class="star '+(favorites.has(r.id)?'active':'')+'" data-star="'+r.id+'" title="Favorito">'+(favorites.has(r.id)?'★':'☆')+'</button><button class="item-link" data-item="'+r.id+'">'+esc(r.name)+'</button>';}
function render(){
 const shown=rows.slice(0,visible);
 $('rows').innerHTML=shown.length?shown.map(r=>'<tr><td><div class="item-cell">'+itemButtons(r)+'</div></td><td>'+fmt(r.buy)+'</td><td>'+fmt(r.sell)+'</td><td class="positive">+'+fmt(r.perUnit)+'</td><td>'+dec(r.margin)+'%</td><td>'+fmt(r.vol24)+'</td><td>'+fmt(r.quantity)+'</td><td class="positive">+'+fmt(r.totalProfit)+'</td><td>'+Math.ceil(Math.max(r.buyAge,r.sellAge))+'min</td></tr>').join(''):'<tr><td colspan="9" class="empty">Nenhum item atende aos filtros. Considere aumentar o capital ou reduzir os mínimos de volume e margem.</td></tr>';
 $('cards').innerHTML=shown.map(r=>'<article class="result-card"><div class="card-top"><div>'+itemButtons(r)+'<div class="meta">Volume 24h '+fmt(r.vol24)+' · Limite 4h '+fmt(r.limit)+'</div></div><strong class="positive">+'+dec(r.margin)+'%</strong></div><div class="numbers"><div><span>Compra / Venda alvo</span><strong>'+fmt(r.buy)+' / '+fmt(r.sell)+'</strong></div><div><span>Lucro hipotético</span><strong class="positive">+'+fmt(r.totalProfit)+' GP</strong></div><div><span>Qtd. estimada</span><strong>'+fmt(r.quantity)+'</strong></div><div><span>Idade máxima</span><strong>'+Math.ceil(Math.max(r.buyAge,r.sellAge))+' min</strong></div></div></article>').join('')||'<p class="subtle">Nenhum resultado.</p>';
 $('resultsText').textContent='Exibindo '+Math.min(visible,rows.length)+' de '+fmt(rows.length)+' resultados';
 $('more').hidden=visible>=rows.length;
}
function details(id){
 const r=rows.find(x=>x.id===id);if(!r)return;
 const fields=[['Compra limite estimada',fmt(r.buy)+' GP'],['Venda limite estimada',fmt(r.sell)+' GP'],['Imposto por unidade',fmt(r.tax)+' GP'],['Lucro/unidade',fmt(r.perUnit)+' GP'],['Quantidade heurística',fmt(r.quantity)],['Capital estimado',fmt(r.requiredCapital)+' GP'],['Lucro hipotético total',fmt(r.totalProfit)+' GP'],['Volume 5m / 1h',fmt(r.vol5)+' / '+fmt(r.vol1h)],['Volume 24h',fmt(r.vol24)],['Limite de compra 4h',fmt(r.limit)],['Idade low / high',Math.ceil(r.buyAge)+' / '+Math.ceil(r.sellAge)+' min'],['Comprando e vendendo imediatamente',fmt(r.immediateProfit)+' GP/un.']];
 $('detailContent').innerHTML='<div class="eyebrow">ANÁLISE DE FLIP · ITEM #'+r.id+'</div><h2>'+esc(r.name)+'</h2><div class="detail-grid">'+fields.map(f=>'<div><span>'+esc(f[0])+'</span><strong>'+esc(f[1])+'</strong></div>').join('')+'</div><p class="disclaimer">Últimos preços observados, não ordens abertas. Para tentar a margem, você precisa esperar a execução de duas ordens limitadas. Comece com 1 unidade para medir tempo de execução e risco.</p><p><a target="_blank" rel="noopener" href="https://oldschool.runescape.wiki/w/Special:Search?search='+encodeURIComponent(r.name)+'">Pesquisar na OSRS Wiki ↗</a></p>';
 $('detail').showModal();
}
function clickResult(e){
 const star=e.target.closest('[data-star]');if(star){const id=Number(star.dataset.star);favorites.has(id)?favorites.delete(id):favorites.add(id);save('gma.favorites',[...favorites]);update();return;}
 const item=e.target.closest('[data-item]');if(item)details(Number(item.dataset.item));
}
function simulate(){
 const buy=num($('simBuy').value),sell=num($('simSell').value),qty=Math.floor(num($('simQty').value));
 const tax=geTax(sell),profit=(sell-tax-buy)*Math.max(0,qty);
 $('simTax').textContent=fmt(tax)+' GP';
 $('simResult').textContent=(profit>=0?'+':'')+fmt(profit)+' GP';
 $('simResult').className=profit<0?'negative':'positive';
}
function renderTrades(){
 const total=trades.reduce((s,t)=>s+(t.sell-geTax(t.sell)-t.buy)*t.qty,0);
 $('journalTotal').textContent=(total>=0?'+':'')+fmt(total)+' GP';
 $('journalList').innerHTML=trades.length?trades.slice().reverse().map(t=>'<div class="journal-item"><div><strong>'+esc(t.item)+'</strong><br><span class="subtle">'+esc(t.date)+' · '+fmt(t.qty)+'un · '+fmt(t.buy)+' → '+fmt(t.sell)+' GP</span></div><div><b>'+fmt((t.sell-geTax(t.sell)-t.buy)*t.qty)+' GP</b><button title="Excluir" data-remove="'+esc(t.id)+'">✕</button></div></div>').join(''):'<span class="subtle">Nenhuma negociação registrada.</span>';
}
let lastSuccess=0;
async function load(){
 if($('reload').disabled)return;
 const elapsed=Date.now()-lastSuccess;
 if(lastSuccess&&elapsed<60_000){
   notice('Preços consultados recentemente. Aguarde '+Math.ceil((60_000-elapsed)/1000)+'s antes de outra pesquisa. Os filtros funcionam imediatamente.','neutral');
   return;
 }
 status('Consultando API…');$('reload').disabled=true;$('searchNow').disabled=true;
 try{
   const data=await fetchLiveSnapshot();
   snapshot=data;demo=false;visible=30;lastSuccess=Date.now();
   status('Atualizado agora');
   notice('Consulta direta à OSRS Wiki realizada: '+fmt(data.items.length)+' itens. Sem GitHub Actions. Atenção: high/low são NEGÓCIOS EXECUTADOS, não ordens disponíveis para venda imediata.','success');
   update();
 }catch(e){
   if(!snapshot||demo){
     snapshot=null;rows=[];$('rows').innerHTML='<tr><td colspan="9" class="empty">Sem consulta válida. Tente novamente pelo botão Pesquisar agora.</td></tr>';
     $('cards').innerHTML='';
     $('csv').disabled=true;
   }
   status('Falha na API',true);
   notice('Não foi possível acessar a OSRS Wiki diretamente: '+e.message+'. Confirme a conexão e tente Pesquisar agora. Nenhum dado fictício foi utilizado.','warning');
 }finally{$('reload').disabled=false;$('searchNow').disabled=false;}
}

function exportCSV(){
 const blob=new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='osrs-oportunidades'+(demo?'-DEMO':'')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const id of ['capital','margin','volume','volume5','age','sort','f2p','favoritesOnly','search'])$(id).addEventListener('input',()=>{visible=30;update();});
$('reload').addEventListener('click',load);
$('searchNow').addEventListener('click',load);
$('demo').addEventListener('click',()=>{snapshot=demoSnapshot();demo=true;visible=30;status('DEMONSTRAÇÃO',true);notice('ATENÇÃO: todos os preços e itens desta demonstração são fictícios. Não utilize para operar.','warning');update();});
$('goResults').addEventListener('click',()=>$('results').scrollIntoView({behavior:'smooth'}));
$('reset').addEventListener('click',()=>{$('capital').value=25000;$('margin').value=2;$('volume').value=1000;$('volume5').value=5;$('age').value=30;$('sort').value='profit';$('f2p').checked=true;$('favoritesOnly').checked=false;$('search').value='';update();});
$('rows').addEventListener('click',clickResult);$('cards').addEventListener('click',clickResult);
$('more').addEventListener('click',()=>{visible+=50;render();});
$('csv').addEventListener('click',exportCSV);
for(const id of ['simBuy','simSell','simQty'])$(id).addEventListener('input',simulate);
$('tradeForm').addEventListener('submit',e=>{
 e.preventDefault();const form=new FormData(e.target),item=String(form.get('item')||'').trim(),buy=num(form.get('buy')),sell=num(form.get('sell')),qty=Math.floor(num(form.get('qty')));
 if(!item||buy<=0||sell<=0||qty<=0)return;
 trades.push({id:(globalThis.crypto?.randomUUID?.()||String(Date.now())),date:new Date().toLocaleDateString('pt-BR'),item,buy,sell,qty});
 save('gma.trades',trades);e.target.reset();renderTrades();
});
$('journalList').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(!btn)return;trades=trades.filter(t=>t.id!==btn.dataset.remove);save('gma.trades',trades);renderTrades();});
simulate();renderTrades();load();