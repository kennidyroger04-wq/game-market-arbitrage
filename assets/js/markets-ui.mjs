import {eveOpportunity,gw2Opportunity} from './market-platforms.mjs';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
const num=id=>Number($(id).value)||0;
const hubs={jita:{region:10000002,station:60003760},amarr:{region:10000043,station:60008494},dodixie:{region:10000032,station:60011866},rens:{region:10000030,station:60004588},hek:{region:10000042,station:60005686}};
const minerals=[[34,'Tritanium'],[35,'Pyerite'],[36,'Mexallon'],[37,'Isogen'],[38,'Nocxium'],[39,'Zydrine'],[40,'Megacyte']];
const diverse=[[44992,'PLEX'],[40520,'Large Skill Injector'],[40519,'Skill Extractor'],[28668,'Nanite Repair Paste'],[23009,'Caldari Navy Antimatter Charge S'],[2456,'Hobgoblin II'],[2488,'Warrior II'],[2048,'Damage Control II'],[1319,'Expanded Cargohold II'],[380,'Small Shield Extender II'],[210,'Scourge Light Missile'],[24495,'Scourge Fury Light Missile'],[24501,'Scourge Precision Light Missile']];
let eveData=[],eveScanned=0,eveBooks=[],eveStation=null;
const gate=5*60*1000;
let lastKey='',lastAt=0,latestRows=[];
function message(s,ok=false){$('notice').textContent=s;$('notice').className='notice'+(ok?' ok':'');}
function state(s){$('state').textContent=s;}
function tdClass(n){return n>0?'positive':'negative';}
function render(rows,unit){
 const suffix=unit==='ISK'?' ISK':' c';
 $('rows').innerHTML=rows.length?rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+fmt(r.bid,unit==='ISK'?2:0)+'</td><td>'+fmt(r.ask,unit==='ISK'?2:0)+'</td><td>'+fmt(r.bidDepth)+'</td><td>'+fmt(r.askDepth)+'</td><td class="'+tdClass(r.margin)+'">'+fmt(r.margin,2)+'%</td><td>'+fmt(r.quantity)+'</td><td class="'+tdClass(r.totalProfit)+'">'+fmt(r.totalProfit,unit==='ISK'?2:0)+suffix+'</td></tr>').join(''):'<tr><td colspan="8" class="muted">Nenhum par de ordens válido encontrado. Experimente outros itens ou locais.</td></tr>';
 latestRows=rows;
}
async function getJson(url){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),30000);
 try{
  const r=await fetch(url,{signal:ac.signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('HTTP '+r.status+' em '+new URL(url).pathname);
  const j=await r.json();if(j?.error)throw new Error('A fonte respondeu com erro');
  return {data:j,pages:Number(r.headers.get('x-pages'))||1,pageTotal:Number(r.headers.get('x-page-total'))||0};
 }catch(e){if(e.name==='AbortError')throw new Error('A consulta excedeu 30 segundos');throw e;}
 finally{clearTimeout(timer);}
}
async function eveOrders(region,id){
 let all=[],partial=false,base='https://esi.evetech.net/latest/markets/'+region+'/orders/?order_type=all&type_id='+id;
 const first=await getJson(base+'&page=1');
 if(!Array.isArray(first.data))throw new Error('Resposta de ordens ESI invalida para item '+id);
 all=first.data;
 // Limite conservador evita varreduras indiscriminadas e respeita ESI.
 const maxPages=Math.min(4,Math.max(1,first.pages));partial=first.pages>maxPages;
 for(let page=2;page<=maxPages;page++){const x=await getJson(base+'&page='+page);if(!Array.isArray(x.data))throw new Error('Pagina ESI invalida');all.push(...x.data);}
 return {orders:all,partial};
}

function chosenEveItems(){
 const group=$('group').value;
 if(group==='minerals')return minerals;
 if(group==='all')return [...diverse,...minerals];
 if(group==='diverse')return diverse;
 if(group==='custom'){
  const ids=[...new Set($('customIds').value.split(/[;,\s]+/).map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>0))].slice(0,20);
  if(!ids.length)throw new Error('Informe ao menos um ID válido em IDs personalizados');
  return ids.map(id=>[id,'Item #'+id]);
 }
 return minerals.filter(x=>String(x[0])===group);
}
function recalculateEve(){
 if(!eveBooks.length||eveStation===null)return;
 eveData=eveBooks.map(x=>{const r=eveOpportunity(x.orders,eveStation,num('capital'),num('tax'),num('broker'));return r?{...r,id:x.id,name:x.name,partial:x.partial}:null}).filter(Boolean).sort((a,b)=>b.totalProfit-a.totalProfit);
 renderEveRows();
}
function renderEveRows(){
 const source=($('positiveOnly')?.checked)?eveData.filter(x=>x.quantity>0&&x.totalProfit>0):eveData;
 render(source,'ISK');
 const positive=eveData.filter(x=>x.quantity>0&&x.totalProfit>0).length;
 $('summary').textContent='Itens da cesta examinados: '+eveScanned+'. Com par de ofertas: '+eveData.length+'. Positivos: '+positive+'. Negativos ou zerados: '+(eveData.length-positive)+'. '+(positive?'Resultados estimados e sujeitos à execução das ordens.':'Nenhuma margem positiva encontrada nesta amostra com as taxas e capital configurados; isso não significa que todo o mercado esteja sem oportunidades.');
}
async function scanEve(){
 const chosen=chosenEveItems();
 const key=['eve',$('hub').value,...chosen.map(x=>x[0])].join('/'),now=Date.now();
 if(key===lastKey&&now-lastAt<gate){recalculateEve();message('Consulta ESI recente. Mantivemos os dados existentes; você pode alternar a exibição sem novas requisições. Pesquise novamente após a janela de cache.');return;}
 const b=hubs[$('hub').value];
 const results=[],problems=[],partial=[],books=[];
 for(let i=0;i<chosen.length;i++){
  const [id,name]=chosen[i];
  state('Consultando ESI: '+name+' ('+(i+1)+'/'+chosen.length+')');
  try{
   const {orders,partial:p}=await eveOrders(b.region,id);
   books.push({id,name,orders,partial:p});
   if(p)partial.push(name);
   const r=eveOpportunity(orders,b.station,num('capital'),num('tax'),num('broker'));
   if(r)results.push({...r,name,id,partial:p});else problems.push(name+': sem par de ordens na estação');
  }catch(e){problems.push(name+': '+e.message);}
 }
 eveScanned=chosen.length;eveBooks=books;eveStation=b.station;
 recalculateEve();
 const complete=problems.length===0&&partial.length===0;
 if(books.length){lastKey=key;lastAt=Date.now();}
 message((complete?'Consulta ESI concluída. ':'Dados obtidos parcialmente. ')+(problems.length?'Pendências: '+problems.join(' | ')+'. ':'')+(partial.length?'Alguns livros tinham mais de quatro páginas; resultados podem omitir ordens melhores, e não devem ser tratados como ranking completo. ':'')+'Somente operações de lucro positivo são exibidas por padrão. Nenhuma negociação foi executada.',complete);
 state('Pesquisa concluída às '+new Date().toLocaleTimeString('pt-BR'));
}
let gw2Data=null;
function renderGw2(){
 if(!gw2Data)return;
 const q=$('itemSearch').value.trim().toLocaleLowerCase('pt-BR'),cap=num('capital'),min=num('margin'),depth=num('depth');
 let rows=gw2Data.map(p=>{const r=gw2Opportunity(p,cap);return r?{...r,name:p.name||('Item #'+p.id)}:null}).filter(Boolean);
 const total=rows.length;
 rows=rows.filter(r=>r.margin>=min&&r.bidDepth>=depth&&r.askDepth>=depth&&r.quantity>=1&&(r.name.toLocaleLowerCase('pt-BR').includes(q)||String(r.id)===q));
 rows.sort((a,b)=>b.totalProfit-a.totalProfit);
 render(rows.slice(0,80),'c');
 $('summary').textContent=total+' itens com duas cotações válidas. '+rows.length+' atendem aos filtros; exibindo os primeiros '+Math.min(80,rows.length)+'. Lucro teórico, não garantido.';
}
async function getGw2Json(url){
 try{return await getJson(url);}
 catch(first){
  if(!/HTTP (429|502|503|504)|Failed to fetch|NetworkError|fetch failed/i.test(first.message))throw first;
  await new Promise(resolve=>setTimeout(resolve,900));
  return getJson(url);
 }
}
async function scanGw2(){
 const now=Date.now();
 if(gw2Data&&now-lastAt<60000){message('Consulta recente: os filtros estão disponíveis sem novas requisições por um minuto.',true);renderGw2();return;}
 const limit=Math.max(1,Math.min(12,Number($('pages')?.value)||6));
 const base='https://api.guildwars2.com/v2/commerce/prices?page=';
 const all=[],issues=[],visited=new Set();
 state('GW2: consultando primeira página de preços…');
 let first;
 try{first=await getGw2Json(base+'0&page_size=200');}
 catch(e){throw new Error('Página 0: '+e.message+'. O endpoint pode estar temporariamente indisponível; tente o link de teste da API.');}
 if(!Array.isArray(first.data)||!first.data.length)throw new Error('A primeira página não retornou lista de preços.');
 all.push(...first.data);visited.add(0);
 const total=first.pageTotal||0;
 // Amostragem distribuída entre as páginas quando o cabeçalho permite.
 const pages=total>limit?Array.from({length:limit},(_,i)=>Math.floor(i*(total-1)/Math.max(1,limit-1))):Array.from({length:total||limit},(_,i)=>i);
 for(const page of pages){
  if(visited.has(page))continue;
  state('GW2: consultando página '+page+' ('+visited.size+'/'+pages.length+')');
  try{
   const r=await getGw2Json(base+page+'&page_size=200');
   if(!Array.isArray(r.data))throw new Error('Resposta inválida');
   all.push(...r.data);visited.add(page);
   if(!r.data.length)break;
  }catch(e){issues.push('Página '+page+': '+e.message);if(issues.length>=2)break;}
 }
 gw2Data=[...new Map(all.filter(p=>p&&Number.isInteger(Number(p.id))).map(p=>[Number(p.id),p])).values()];
 state('GW2: identificando nomes dos itens…');
 const candidates=gw2Data.map(p=>gw2Opportunity(p,num('capital'))).filter(Boolean).filter(r=>r.quantity>=1&&r.unitProfit>0).sort((a,b)=>b.totalProfit-a.totalProfit).slice(0,120);
 let nameCount=0;
 if(candidates.length){
   const idBatches=[];for(let i=0;i<candidates.length;i+=100)idBatches.push(candidates.slice(i,i+100).map(c=>c.id));
   const nameMap=new Map();
   for(const ids of idBatches){
    try{
     const named=await getGw2Json('https://api.guildwars2.com/v2/items?ids='+ids.join(',')+'&lang=en');
     if(Array.isArray(named.data))for(const x of named.data)nameMap.set(Number(x.id),String(x.name));
    }catch(e){issues.push('Nomes: '+e.message);}
   }
   nameCount=nameMap.size;
   gw2Data=gw2Data.map(p=>({...p,name:nameMap.get(Number(p.id))||('Item #'+p.id)}));
 }
 lastAt=Date.now();renderGw2();
 const partial=!total||visited.size<total||issues.length>0;
 message('GW2: '+fmt(gw2Data.length)+' itens consultados em '+visited.size+' página(s); '+nameCount+' nomes identificados. '+(partial?'Amostra parcial do mercado; não representa todas as oportunidades. ':'')+(issues.length?'Problemas: '+issues.join(' | ')+'. ':'')+'Pesquisa exclusivamente manual.',issues.length===0);
 state('GW2: consulta finalizada às '+new Date().toLocaleTimeString('pt-BR'));
}
async function onScan(){
 $('scan').disabled=true;message('Consultando a API oficial…');const isEve=document.body.dataset.market==='eve';
 try{if(isEve)await scanEve();else await scanGw2();}
 catch(e){message('Falha da API: '+e.message+'. Verifique sua conexão, CORS e disponibilidade da fonte. Não há dados fictícios.');state('Consulta falhou');}
 finally{$('scan').disabled=false;}
}
if(['eve','gw2'].includes(document.body.dataset.market)){
 $('scan').addEventListener('click',onScan);
 if(document.body.dataset.market==='gw2')for(const id of ['capital','margin','depth','itemSearch'])$(id).addEventListener('input',renderGw2);
 else {
  $('positiveOnly').addEventListener('change',renderEveRows);
  for(const id of ['capital','tax','broker'])$(id).addEventListener('input',()=>{recalculateEve();message('Capital e taxas recalculados localmente com as últimas ordens obtidas. Para atualizar os preços, clique em Pesquisar ordens agora.');});
  for(const id of ['group','hub','customIds'])$(id).addEventListener('input',()=>{message('Mercado ou estação alterados: clique em Pesquisar ordens agora. Nenhuma consulta automática.');});
 }
}