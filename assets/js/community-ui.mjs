import {ALBION_IDS,calculateAlbion,calculateFio} from './community-core.mjs';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=id=>Number($(id).value)||0;
const fmt=(n,max=2)=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:max});
const kind=document.body.dataset.community;
let cache=null,cacheKey='',cacheTime=0;
const setNotice=(s,good=false)=>{$('notice').textContent=s;$('notice').className='notice'+(good?' ok':'');};
const setState=s=>$('state').textContent=s;
async function getData(url){
 const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),25000);
 try{
  const response=await fetch(url,{signal:ac.signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('HTTP '+response.status+' em '+new URL(url).pathname);
  const obj=await response.json();
  if(!Array.isArray(obj))throw new Error('Formato inesperado: a API não retornou uma lista');
  return obj;
 }catch(e){if(e.name==='AbortError')throw new Error('Tempo de consulta excedeu 25s');throw e;}
 finally{clearTimeout(timeout);}
}
function optionsAlbion(){
 const raw=$('custom').value.toUpperCase().split(/[\s,;]+/).map(x=>x.trim()).filter(x=>/^T[2-9]_[A-Z0-9_@]+$/.test(x)).slice(0,25);
 const items=[...new Set([...ALBION_IDS,...raw])];
 return {items,region:$('region').value,source:$('source').value,destination:$('destination').value,capital:val('capital'),tax:val('tax'),transport:val('transport'),maxAgeHours:val('age'),positive:$('positiveOnly').checked};
}
function recalcAlbion(){
 if(!cache)return;
 const o=optionsAlbion();
 let results=calculateAlbion(cache.data,o);
 $('rows').innerHTML=results.length?results.slice(0,100).map(x=>'<tr><td>'+esc(x.id)+'</td><td>'+esc(x.from)+'</td><td>'+esc(x.to)+'</td><td>'+fmt(x.buy)+'</td><td>'+fmt(x.sell)+'</td><td class="'+(x.margin>0?'positive':'negative')+'">'+fmt(x.margin)+'%</td><td>'+fmt(x.qty)+'</td><td class="'+(x.profit>0?'positive':'negative')+'">'+fmt(x.profit)+'</td><td>'+fmt(x.ageHours,1)+'h</td></tr>').join(''):'<tr><td colspan="9" class="muted">Nenhuma rota com duas cotações recentes atende aos filtros. Tente outra idade ou outros itens.</td></tr>';
 $('summary').textContent=results.length+' combinações da amostra. Mostrando até 100 rotas. '+cache.data.length+' registros da comunidade; só qualidade 1. Quantidade é simulação pelo capital, não profundidade real.';
}
function recalcFio(){
 if(!cache)return;
 let data=calculateFio(cache.data,{capital:val('capital'),fee:val('fee'),transport:val('transport'),mode:$('mode').value,exchange:$('exchange').value,positive:$('positiveOnly').checked});
 const q=$('material').value.trim().toUpperCase();
 if(q)data=data.filter(x=>x.ticker.toUpperCase().includes(q));
 $('rows').innerHTML=data.length?data.slice(0,100).map(x=>'<tr><td>'+esc(x.ticker)+'</td><td>'+esc(x.from)+'</td><td>'+esc(x.to)+'</td><td>'+fmt(x.buy)+'</td><td>'+fmt(x.sell)+'</td><td class="'+(x.margin>0?'positive':'negative')+'">'+fmt(x.margin)+'%</td><td>'+fmt(x.qty)+'</td><td class="'+(x.profit>0?'positive':'negative')+'">'+fmt(x.profit)+'</td><td>'+(x.mode==='cross'?'Entre bolsas':'Duas ordens')+'</td></tr>').join(''):'<tr><td colspan="9" class="muted">Nenhuma combinação atende aos filtros. Confira as bolsas e os custos usados na estimativa.</td></tr>';
 $('summary').textContent=data.length+' combinações no conjunto FIO ('+cache.data.length+' cotações). Exibindo até 100. Não há validação da liquidez executável.';
}
async function scan(){
 $('scan').disabled=true;setState('Consultando a API comunitária…');setNotice('Obtendo dados mediante solicitação manual…');
 try{
  if(kind==='albion'){
   const opts=optionsAlbion();
   const key=opts.region+'|'+opts.items.join(',');
   if(cache&&cacheKey===key&&Date.now()-cacheTime<60000){recalcAlbion();setNotice('Cotações recentes reutilizadas do navegador. Filtros calculados localmente.',true);return;}
   const regions={europe:'europe',west:'west',east:'east'};
   const region=regions[opts.region];if(!region)throw new Error('Servidor inválido');
   const host='https://'+region+'.albion-online-data.com';
   const url=host+'/api/v2/stats/prices/'+opts.items.map(encodeURIComponent).join(',')+'?locations=Bridgewatch,Martlock,Lymhurst,Thetford,Fort%20Sterling,Caerleon&qualities=1';
   const data=await getData(url);
   cache={data};cacheKey=key;cacheTime=Date.now();recalcAlbion();
   setNotice('AODP: '+data.length+' registros recebidos. Os preços vêm de contribuições de jogadores e podem estar defasados; somente datas dentro da janela selecionada entram no ranking.',true);
  }else{
   const key='fio-all';
   if(cache&&Date.now()-cacheTime<60000){recalcFio();setNotice('Dados FIO recentes reutilizados localmente.',true);return;}
   const data=await getData('https://rest.fnar.net/exchange/all');
   cache={data};cacheKey=key;cacheTime=Date.now();recalcFio();
   setNotice('FIO: '+data.length+' cotações comunitárias recuperadas. A data exata de cada registro pode não estar presente; confirme preços e taxas no jogo.',true);
  }
  setState('Última consulta: '+new Date().toLocaleString('pt-BR'));
 }catch(e){
  setNotice('A pesquisa falhou: '+e.message+'. Pode haver limitação de CORS, indisponibilidade ou bloqueio do fornecedor. Nenhum resultado fictício foi criado.');
  setState('Consulta sem sucesso');
 }finally{$('scan').disabled=false;}
}
$('scan').addEventListener('click',scan);
const bind=kind==='albion'?['capital','tax','transport','age','positiveOnly','source','destination']:['capital','fee','transport','mode','exchange','positiveOnly','material'];
for(const id of bind)$(id).addEventListener('input',()=>{if(cache)(kind==='albion'?recalcAlbion:recalcFio)();});
for(const id of kind==='albion'?['region','custom']:[])$(id).addEventListener('input',()=>setNotice('Itens ou servidor alterados. Clique em Pesquisar mercado agora para obter cotações correspondentes.'));
