// Analisador local; nenhuma chamada de rede ao cliente DOFUS.
const $=id=>document.getElementById(id);
const key='gma.dofus.observations.v1', sizes=[1,10,100,1000];
const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1});
const num=id=>Number($(id).value)||0;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(){try{const r=JSON.parse(localStorage.getItem(key));return Array.isArray(r)?r:[]}catch{return []}}
function save(list){try{localStorage.setItem(key,JSON.stringify(list.slice(-50)));return true}catch{return false}}
export function computeLots(prices,capital,taxPercent,maxAds){
 const candidates=[];
 const budget=Math.max(0,Number(capital)||0),rate=Math.max(0,Number(taxPercent)||0)/100;
 for(const buySize of sizes){
  const buyPrice=Number(prices[buySize]);if(!(buyPrice>0))continue;
  for(const sellSize of sizes){
   if(sellSize>=buySize||buySize%sellSize!==0)continue;
   const sellPrice=Number(prices[sellSize]);if(!(sellPrice>0))continue;
   const listings=buySize/sellSize;
   if(listings>Math.max(0,Math.floor(Number(maxAds)||0)))continue;
   // Taxa estimada paga sobre a colocacao de cada anuncio, antes da venda.
   const perListingTax=Math.ceil(sellPrice*rate);
   const totalTax=listings*perListingTax;
   const required=buyPrice+totalTax;
   if(required>budget)continue;
   const revenue=listings*sellPrice;
   const profit=revenue-required;
   const roi=required>0?profit/required*100:0;
   candidates.push({buySize,sellSize,buyPrice,sellPrice,listings,totalTax,required,revenue,profit,roi});
  }
 }
 return candidates.sort((a,b)=>b.profit-a.profit);
}
function capture(){return {date:new Date().toISOString(),version:$('version').value,server:$('server').value.trim(),item:$('item').value.trim(),capital:num('capital'),tax:num('tax'),prices:Object.fromEntries(sizes.map(n=>[n,num('p'+n)]))};}
function compute(){
 const o=capture(),r=computeLots(o.prices,o.capital,o.tax,num('maxAds'));
 $('results').innerHTML=r.length?r.map(x=>'<tr><td>x'+x.buySize+'</td><td>x'+x.sellSize+'</td><td>'+fmt(x.buyPrice)+'</td><td>'+fmt(x.revenue)+'</td><td>'+fmt(x.listings)+'</td><td>'+fmt(x.totalTax)+'</td><td class="'+(x.profit>0?'positive':'negative')+'">'+fmt(x.profit)+'</td><td class="'+(x.roi>0?'positive':'negative')+'">'+fmt(x.roi)+'%</td></tr>').join(''):'<tr><td colspan="8" class="muted">Nenhuma combinação dentro do capital e do limite de anúncios. Informe pelo menos dois preços em tamanhos de lote compatíveis.</td></tr>';
 const positive=r.filter(x=>x.profit>0);
 $('state').textContent=positive.length+' combinações positivas entre '+r.length+' válidas';
 $('summary').textContent=positive.length?'Maior lucro teórico por lote comprado: '+fmt(positive[0].profit)+' kamas. Não garante que todos os anúncios sejam vendidos.':'Não há lucro positivo comprovado pelo cálculo com os valores informados.';
 $('notice').textContent='Cálculo manual concluído. Preços e demanda precisam ser confirmados no seu servidor; a taxa é cobrada ao anunciar e pode ser perdida em caso de venda não realizada.';
 $('notice').className='notice'+(positive.length?' ok':'');
}
function renderSaved(){
 const rows=read().slice().reverse();
 $('savedRows').innerHTML=rows.length?rows.map(o=>'<tr><td>'+escapeHTML(new Date(o.date).toLocaleString('pt-BR'))+'</td><td>'+escapeHTML(o.version)+' / '+escapeHTML(o.server)+'</td><td>'+escapeHTML(o.item)+'</td>'+sizes.map(n=>'<td>'+(o.prices?.[n]>0?fmt(o.prices[n]):'—')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="7" class="muted">Nenhuma observação salva.</td></tr>';
}
function exportCSV(){
 const data=read();
 if(!data.length){$('notice').textContent='Ainda não há observações para exportar.';return;}
 const csvSafe=s=>{let x=String(s??'');if(/^[=+@\-\t\r]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"';};
 const rows=[['Data','Versao','Servidor','Item','Capital','Taxa','x1','x10','x100','x1000'],...data.map(o=>[o.date,o.version,o.server,o.item,o.capital,o.tax,...sizes.map(n=>o.prices?.[n]??'')])];
 const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvSafe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dofus-cotacoes-manuais.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('calc').addEventListener('click',compute);
$('save').addEventListener('click',()=>{const o=capture();if(!o.server||!o.item){$('notice').textContent='Informe servidor e nome do item antes de salvar.';return;}if(!sizes.some(n=>o.prices[n]>0)){$('notice').textContent='Informe ao menos um preço antes de salvar.';return;}const existing=read();existing.push(o);$('notice').textContent=save(existing)?'Observação salva neste navegador.':'Não foi possível salvar no armazenamento local.';renderSaved();});
$('csv').addEventListener('click',exportCSV);
$('clear').addEventListener('click',()=>{if(confirm('Deseja excluir todas as observações de DOFUS salvas neste navegador?')){localStorage.removeItem(key);renderSaved();$('notice').textContent='Observações locais excluídas.';}});
renderSaved();