import {HUBS,BASKETS,regionalArbitrage,summarizeHistory} from './eve-regional-core.mjs?v=1';
const $=id=>document.getElementById(id);
const fmt=(x,dec=0)=>Number(x).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=id=>Number($(id).value)||0;
const CACHE_MS=300000;
const PAGE_CAP=12;
const cache=new Map();const historyCache=new Map();
let books=[],resultRows=[],historyData=new Map(),busy=false,lastScan=null,lastIssues=[];
function say(message,ok=false){$('notice').textContent=message;$('notice').className='notice'+(ok?' ok':'');}
function state(msg){$('state').textContent=msg;}
async function api(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('ESI HTTP '+r.status+' ('+new URL(url).pathname+')');
  const data=await r.json();
  return {data,pages:Number(r.headers.get('x-pages'))||1};
 }catch(e){if(e.name==='AbortError')throw new Error('Consulta ESI excedeu 25s');throw e;}
 finally{clearTimeout(timer);}
}
async function marketBook(hub,id){
 const name=HUBS[hub];if(!name)throw new Error('Hub inválido');
 const key=hub+'|'+id;
 const saved=cache.get(key);
 if(saved&&Date.now()-saved.time<CACHE_MS)return saved;
 const base='https://esi.evetech.net/latest/markets/'+name.region+'/orders/?order_type=all&type_id='+id+'&page=';
 const first=await api(base+'1');
 if(!Array.isArray(first.data))throw new Error('ESI retornou ordens em formato inesperado');
 const pages=Math.max(1,first.pages);
 // Excluímos livros incompletos do ranking, para não criar oportunidades artificiais.
 if(pages>PAGE_CAP)throw new Error('Livro com '+pages+' páginas (> '+PAGE_CAP+'); item excluído para evitar preço parcial');
 let orders=[...first.data];
 for(let page=2;page<=pages;page++){
  const response=await api(base+page);
  if(!Array.isArray(response.data))throw new Error('Página '+page+' não retornou lista');
  orders.push(...response.data);
 }
 const result={time:Date.now(),orders,region:name.region,station:name.station,pages};
 cache.set(key,result);
 return result;
}
function cfg(){
 return {sourceStation:HUBS[$('source').value]?.station,
 destinationStation:HUBS[$('destination').value]?.station,
 capital:num('capital'),taxPercent:num('tax'),haulPerUnit:num('haulUnit'),
 haulFlat:num('haulFlat'),maxUnits:num('maxUnits'),minMargin:num('margin')};
}
function selection(){
 const tier=$('tier').value;
 const chosen=tier==='custom'?[]:[...(BASKETS[tier]||[])];
 const extras=$('customIds').value.trim().split(/[\s,;]+/).filter(Boolean);
 if(extras.length>10)throw new Error('Informe até 10 IDs extras.');
 for(const x of extras){const id=Number(x);if(!Number.isSafeInteger(id)||id<=0)throw new Error('ID inválido: '+x);chosen.push([id,'Item #'+id]);}
 const seen=new Set();
 return chosen.filter(([id])=>{if(id===44992)return false;if(seen.has(id))return false;seen.add(id);return true;}).slice(0,20);
}
function render(){
 if(!lastScan)return;
 const opts=cfg(),origin=$('source').value,dest=$('destination').value;
 resultRows=books.map(x=>{
  const r=regionalArbitrage(x.source,x.destination,opts);
  return r?{...r,id:x.id,name:x.name,from:HUBS[origin].name,to:HUBS[dest].name}:null;
 }).filter(Boolean).sort((a,b)=>b.net-a.net);
 const accepted=resultRows.filter(x=>x.status==='candidate');
 const shown=$('positive').checked?accepted:resultRows;
 $('rows').innerHTML=shown.length?shown.map(r=>{
  const his=historyData.get(r.id);
  const vol=his?fmt(his.avgDaily,1)+' ('+his.daysReported+'/14 dias)':'—';
  return '<tr><td>'+esc(r.name)+' <span class="small muted">#'+r.id+'</span></td><td>'+esc(r.from)+'</td><td>'+esc(r.to)+'</td><td>'+fmt(r.bestAsk,2)+'</td><td>'+fmt(r.bestBid,2)+'</td><td>'+fmt(r.count)+'</td><td class="'+(r.roi>0?'positive':'negative')+'">'+fmt(r.roi,2)+'%</td><td class="'+(r.net>0?'positive':'negative')+'">'+fmt(r.net,2)+' ISK</td><td>'+vol+'</td></tr>';
 }).join(''):'<tr><td colspan="9" class="muted">Nenhuma rota com margem suficiente nesta amostra. Experimente outra rota ou capital; isso não significa que todo o mercado não tenha oportunidades.</td></tr>';
 $('summary').textContent='Itens consultados integralmente: '+books.length+' de '+lastScan.count+'. Rotas acima da margem mínima: '+accepted.length+'. '+lastIssues.length+' falhas/exclusões. '+(lastIssues.length?'Motivos: '+lastIssues.slice(0,4).join(' | ')+'. ':'')+'Os resultados não incluem probabilidade de transporte bem-sucedido.';
 $('history').disabled=accepted.length===0||busy;
}
function invalidate(what){
 books=[];resultRows=[];historyData=new Map();lastScan=null;lastIssues=[];
 $('rows').innerHTML='<tr><td colspan="9" class="muted">Parâmetros alterados. Pesquise para consultar os mercados correspondentes.</td></tr>';
 $('summary').textContent='';$('history').disabled=true;
 say(what+' alterado. Clique em Pesquisar rotas agora. Nenhuma consulta automática.');
}
$('tier').addEventListener('change',()=>{
 const suggested={micro:3000000,regional:50000000,premium:1000000000,custom:10000000};
 $('capital').value=suggested[$('tier').value];
 invalidate('Estratégia');
});
for(const id of ['source','destination','customIds'])$(id).addEventListener('input',()=>invalidate('Hub ou cesta de itens'));
for(const id of ['capital','tax','haulUnit','haulFlat','margin','maxUnits','positive'])$(id).addEventListener('input',render);
$('scan').addEventListener('click',async()=>{
 if(busy)return;
 const from=$('source').value,to=$('destination').value;
 if(from===to){say('Selecione hubs distintos. Para compra e venda na mesma estação use a página Flipping de estação.');return;}
 let items;
 try{items=selection();if(!items.length)throw new Error('Escolha uma cesta ou informe IDs extras diferentes de PLEX (44992).');}
 catch(e){say(e.message);return;}
 busy=true;$('scan').disabled=true;$('history').disabled=true;
 const found=[],issues=[];
 books=[];resultRows=[];historyData=new Map();lastScan=null;lastIssues=[];
 say('Consultando dois mercados pela ESI. Livros incompletos serão excluídos.');
 try{
  for(let i=0;i<items.length;i++){
   const [id,name]=items[i];
   state('Consultando '+(i+1)+'/'+items.length+': '+name);
   try{
    const [source,destination]=await Promise.all([marketBook(from,id),marketBook(to,id)]);
    found.push({id,name,source:source.orders,destination:destination.orders});
   }catch(e){issues.push(name+': '+e.message);if(/429/.test(e.message))break;}
  }
  books=found;lastIssues=issues;lastScan={from,to,count:items.length,at:Date.now()};
  render();
  say('Pesquisa concluída: '+found.length+' livros de itens completos nos dois hubs. '+issues.length+' falhas/exclusões. '+(issues.length?issues.slice(0,3).join(' | '):'')+' Nenhuma operação foi executada.',issues.length===0);
  state('Consulta em '+new Date().toLocaleTimeString('pt-BR'));
 }finally{busy=false;$('scan').disabled=false;render();}
});
$('history').addEventListener('click',async()=>{
 if(busy||!lastScan)return;
 busy=true;$('scan').disabled=true;$('history').disabled=true;
 const best=resultRows.filter(x=>x.status==='candidate').slice(0,5);
 const region=HUBS[lastScan.to].region;
 const issues=[];
 try{
  for(let i=0;i<best.length;i++){
   const x=best[i];state('Histórico regional '+(i+1)+'/'+best.length+': '+x.name);
   const cacheKey=region+'|'+x.id;
   try{
    let info=historyCache.get(cacheKey);
    if(!info||Date.now()-info.time>3600000){
     const r=await api('https://esi.evetech.net/latest/markets/'+region+'/history/?type_id='+x.id);
     if(!Array.isArray(r.data))throw new Error('resposta inválida');
     info={time:Date.now(),history:r.data};historyCache.set(cacheKey,info);
    }
    const history=summarizeHistory(info.history);
    if(history)historyData.set(x.id,history);
   }catch(e){issues.push('#'+x.id+': '+e.message);}
  }
  say('Histórico diário de '+(best.length-issues.length)+' itens consultado na região de destino (não na estação específica). '+(issues.length?'Problemas: '+issues.join(' | '):'')+'.',issues.length===0);
  state('Histórico em '+new Date().toLocaleTimeString('pt-BR'));
 }finally{busy=false;$('scan').disabled=false;render();}
});
