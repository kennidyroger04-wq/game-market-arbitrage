import {normalizeCatalog,chooseScanItems,fallbackScanItems,analyzeItemMarket,csvTorn} from './torn-market.mjs?v=3';
/** Torn API v2 - nenhuma pesquisa agendada, chave somente em memória do campo. */
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:0});
const decimal=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1});
const value=id=>Number($(id).value)||0;
let working=false,catalog=null,allResults=[],scanIds=[],fetchErrors=[],lastScan=0,lastRecords=0;
const snapshots=new Map();
function key(){
 const token=$('tornApiKey').value.trim();
 if(!/^[a-z0-9]{16}$/i.test(token))throw new Error('Informe sua chave Torn de 16 caracteres.');
 return token;
}
function notice(id,message,success=false){
 const el=$(id);el.textContent=message;el.className='notice'+(success?' ok':'');
}
function setBusy(b){working=b;for(const id of ['scan','single','testKey'])$(id).disabled=b;}
async function api(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
  const response=await fetch('https://api.torn.com/v2/'+path,{
   method:'GET',signal:controller.signal,cache:'no-store',credentials:'omit',
   redirect:'error',referrerPolicy:'no-referrer',
   headers:{Accept:'application/json',Authorization:'ApiKey '+key()}
  });
  if(!response.ok){
   if(response.status===401||response.status===403)throw new Error('Chave inválida ou sem permissão: HTTP '+response.status);
   if(response.status===429)throw new Error('Limite de consultas da API atingido (429).');
   throw new Error('API Torn: HTTP '+response.status);
  }
  const data=await response.json();
  if(data?.error){
   const n=Number(data.error.code);
   if(n===16){
    const location=path.startsWith('torn/items')?'Torn → Items':path.includes('/itemmarket')?'Market → Item Market':'a seleção consultada';
    const error=new Error('Permissão insuficiente para '+location+' (erro 16). Configure a chave Custom conforme indicado na página.');
    error.code=16;error.apiPath=path;throw error;
   }
   const error=new Error('API Torn: erro'+(Number.isFinite(n)?' código '+n:'')+' — confira permissões e item.');
   error.code=n;error.apiPath=path;throw error;
  }
  return data;
 }catch(e){
  if(e.name==='AbortError')throw new Error('Tempo de consulta excedeu 22 segundos.');
  if(e instanceof TypeError)throw new Error('Falha de rede/CORS na API Torn. Verifique conexão e tente novamente.');
  throw e;
 }finally{clearTimeout(timer);}
}
async function run(task){
 if(working)return;
 setBusy(true);
 try{await task();}
 finally{setBusy(false);}
}
const marketPath=id=>'market/'+id+'/itemmarket?limit=100&offset=0';
async function getMarket(id){
 const saved=snapshots.get(id);
 if(saved&&Date.now()-saved.fetched<60000)return saved.payload;
 const payload=await api(marketPath(id));
 if(!payload?.itemmarket||!Array.isArray(payload.itemmarket.listings)){
  throw new Error('Formato desconhecido do mercado para o item #'+id);
 }
 snapshots.set(id,{fetched:Date.now(),payload});
 return payload;
}
function options(){return {capital:value('capital'),feePercent:value('fee'),minMargin:value('minMargin'),maxUnits:value('maxUnits'),maxAgeMinutes:value('maxAge')};}
function analyze(){
 const opts=options(),items=[];
 const counters={invalid:0,stale:0,variable:0,thin:0,'no-reference':0,'no-spread':0,margin:0,capital:0};
 for(const id of scanIds){
  const s=snapshots.get(id);
  if(!s)continue;
  const r=analyzeItemMarket(s.payload,opts);
  if(r.status==='candidate')items.push(r);
  else counters[r.status]=(counters[r.status]||0)+1;
 }
 const sort=$('sort').value;
 items.sort((a,b)=>sort==='margin'?b.margin-a.margin:sort==='unit'?b.unitNet-a.unitNet:sort==='age'?a.cacheAge-b.cacheAge:b.totalProfit-a.totalProfit);
 allResults=items;
 $('checked').textContent=fmt(lastRecords);
 $('found').textContent=fmt(items.length);
 $('best').textContent=items.length?fmt(Math.max(...items.map(x=>x.totalProfit)))+' T$':'—';
 $('csv').disabled=items.length===0;
 $('opportunities').innerHTML=items.length?items.map(r=>
 '<tr><td><button type="button" data-detail="'+r.id+'" title="Ver anúncios deste item">'+esc(r.name)+'</button><div class="small muted">#'+r.id+' · '+esc(r.type)+'</div></td>'+
 '<td>'+fmt(r.lowestPrice)+'</td><td>'+fmt(r.target)+'</td><td>'+fmt(r.avg)+'</td>'+
 '<td class="positive">+'+decimal(r.margin)+'%</td><td>'+fmt(r.qty)+'</td>'+
 '<td class="positive">+'+fmt(r.totalProfit)+' T$</td><td>'+esc(r.risk)+'</td></tr>').join(''):
 '<tr><td colspan="8" class="muted">Nenhuma oportunidade atende aos filtros nesta amostra. Tente outra categoria, mais itens ou uma margem mínima menor.</td></tr>';
 $('summary').textContent='Anúncios consultados de '+lastRecords+' item(ns). '+items.length+
 ' oportunidades hipotéticas; '+counters.stale+' cotações antigas, '+counters.variable+
 ' itens com atributos individuais, '+counters.margin+' sem margem suficiente, '+
 counters['no-spread']+' sem diferença útil, '+counters['no-reference']+' sem referência confiável. '+
 (fetchErrors.length?fetchErrors.length+' itens com erro de consulta. ':'')+
 'Não indica volume efetivamente negociado nem venda garantida.';
}
function detail(id){
 const saved=snapshots.get(id);
 if(!saved){notice('marketNotice','Sem dados deste item na consulta atual.');return;}
 const m=saved.payload.itemmarket,r=analyzeItemMarket(saved.payload,{...options(),minMargin:0});
 const listings=m.listings.filter(x=>Number(x.price)>0&&Number(x.amount)>0).sort((a,b)=>Number(a.price)-Number(b.price));
 $('itemId').value=id;
 const time=Number(m.cache_timestamp)>0?new Date(Number(m.cache_timestamp)*1000).toLocaleString('pt-BR'):'não informado';
 $('itemDetail').textContent='Item: '+String(m.item?.name||('Item #'+id))+
 ' · Média informada pela API: '+fmt(Number(m.item?.average_price)||0)+' T$'+
 ' · Cache de: '+time+
 ' · '+listings.length+' anúncios recebidos.'+
 (r.status==='candidate'?' Compra simulada: '+fmt(r.lowestPrice)+'; revenda alvo hipotética: '+fmt(r.target)+'; margem após taxa: '+decimal(r.margin)+'%.':' Nenhuma margem de revenda validada para os critérios atuais.');
 $('rows').innerHTML=listings.length?listings.slice(0,30).map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+fmt(x.price)+'</td><td>'+fmt(x.amount)+'</td><td>'+fmt(Number(x.price)*Number(x.amount))+'</td></tr>').join(''):'<tr><td colspan="4" class="muted">Nenhum anúncio disponível.</td></tr>';
}
$('opportunities').addEventListener('click',e=>{
 const btn=e.target.closest('[data-detail]');
 if(!btn)return;
 const id=Number(btn.dataset.detail);detail(id);
 $('itemDetail').scrollIntoView({behavior:'smooth',block:'center'});
});
$('tornApiKey').addEventListener('input',()=>{
 snapshots.clear();catalog=null;scanIds=[];allResults=[];lastRecords=0;
 $('csv').disabled=true;$('keyState').textContent='Chave alterada, acesso ainda não testado.';
 notice('keyNotice','Chave editada. Consulte somente quando desejar.');
});
$('clearKey').addEventListener('click',()=>{
 $('tornApiKey').value='';snapshots.clear();catalog=null;scanIds=[];allResults=[];lastRecords=0;
 $('keyState').textContent='Chave apagada.';
 $('opportunities').innerHTML='<tr><td colspan="8" class="muted">Informe outra chave para pesquisar.</td></tr>';
 $('rows').innerHTML='<tr><td colspan="4" class="muted">Sem dados.</td></tr>';
 $('itemDetail').textContent='Nenhum item selecionado.';$('csv').disabled=true;
 $('checked').textContent='—';$('found').textContent='—';$('best').textContent='—';
 notice('keyNotice','Campo limpo. Nenhuma chave foi armazenada.',true);
});
$('testKey').addEventListener('click',()=>run(async()=>{
 try{
  await api('key/info');
  $('keyState').textContent='Chave autenticada.';
  notice('keyNotice','Autenticação concluída. A permissão para dados do mercado será verificada na primeira consulta.',true);
 }catch(e){$('keyState').textContent='Não validada.';notice('keyNotice',e.message);}
}));
async function getCatalog(){
 if(catalog)return catalog;
 const raw=await api('torn/items');
 const items=normalizeCatalog(raw);
 if(items.length<100)throw new Error('O catálogo oficial retornou poucos itens ou formato inesperado.');
 catalog=items;return items;
}
$('scan').addEventListener('click',()=>run(async()=>{
 const q=$('custom').value.trim(),count=Math.min(30,Math.max(1,value('scanCount')));
 const mode=$('sourceMode').value,category=$('category').value;
 const opts={category,count,query:q,capital:value('capital')};
 let selected=[],warning='',sourceLabel='';
 fetchErrors=[];lastRecords=0;
 $('scanState').textContent='Preparando lista de itens…';
 notice('marketNotice','Iniciando pesquisa manual. Os preços virão diretamente da API oficial do Torn.');
 try{
  // A lista pronta usa somente IDs conhecidos: nunca tenta o endpoint torn/items.
  if(mode==='watchlist'){
   selected=fallbackScanItems(opts);
   sourceLabel='lista pronta de IDs públicos';
  }else{
   try{
    const items=await getCatalog();
    selected=chooseScanItems(items,opts);
    sourceLabel='catálogo oficial';
   }catch(e){
    if(e.code!==16)throw new Error('Não foi possível obter o catálogo oficial: '+e.message);
    // Chave customizada liberou market/itemmarket, mas não torn/items.
    selected=fallbackScanItems(opts);
    sourceLabel='lista pronta de IDs públicos';
    warning='A chave não tem permissão para Torn → Items (erro 16). Usei a lista pronta de itens sem consultar o catálogo; a pesquisa de preços continua funcionando. ';
   }
  }
  if(!selected.length){
   const explanation=mode==='catalog'?'Inclua Torn → Items na chave personalizada para varrer esta categoria ou digite IDs numéricos.':'A lista pronta cobre flores, pelúcias e Xanax. Para outras categorias, habilite o Catálogo completo com Torn → Items ou digite IDs numéricos.';
   throw new Error('Nenhum item disponível para este filtro. '+explanation);
  }
  scanIds=selected.map(x=>x.id);
  for(let i=0;i<selected.length;i++){
   const item=selected[i];
   $('scanState').textContent='Consultando '+(i+1)+'/'+selected.length+': '+item.name;
   try{await getMarket(item.id);lastRecords++;}
   catch(e){
    fetchErrors.push({id:item.id,error:e.message});
    if(e.code===16||e.code===5||/limite de consultas|\(429\)/i.test(e.message))break;
   }
  }
  lastScan=Date.now();analyze();
  $('scanState').textContent='Pesquisa concluída às '+new Date().toLocaleTimeString('pt-BR')+'.';
  const problems=fetchErrors.length?' Falhas: '+fetchErrors.slice(0,2).map(x=>'#'+x.id+': '+x.error).join(' | ')+'.':'';
  notice('marketNotice',warning+'Fonte da seleção: '+sourceLabel+'. Preços consultados em '+lastRecords+' de '+selected.length+
     ' itens; '+allResults.length+' oportunidades hipotéticas após os filtros. '+problems+
     ' Verifique ofertas e riscos no jogo antes de operar.',fetchErrors.length===0&&!warning);
 }catch(e){$('scanState').textContent='Busca não concluída.';notice('marketNotice',e.message);}
}));
$('single').addEventListener('click',()=>run(async()=>{
 const id=Number($('itemId').value);
 if(!Number.isSafeInteger(id)||id<=0){notice('marketNotice','Informe um ID de item válido.');return;}
 $('scanState').textContent='Conferindo item #'+id+'…';
 try{
  const data=await getMarket(id);
  detail(id);
  $('scanState').textContent='Consulta individual concluída.';
  notice('marketNotice','Anúncios do item #'+id+' obtidos da API oficial. Confira o cache e a quantidade no jogo.',true);
 }catch(e){$('scanState').textContent='Falha na consulta individual.';notice('marketNotice',e.message);}
}));
for(const id of ['capital','minMargin','fee','maxUnits','maxAge','sort'])$(id).addEventListener('input',()=>{
 if(scanIds.length)analyze();
});
for(const id of ['sourceMode','category','scanCount','custom'])$(id).addEventListener('input',()=>{
 if(scanIds.length)notice('marketNotice','Seleção de itens alterada. Clique em Pesquisar oportunidades agora para obter o novo conjunto. Nada é consultado automaticamente.');
});
$('csv').addEventListener('click',()=>{
 if(!allResults.length)return;
 const blob=new Blob([csvTorn(allResults)],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='torn-oportunidades-hipoteticas.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
