/** Torn API v2; somente requisições manuais. A chave nunca entra na URL ou storage. */
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:0});
let active=false;
function key(){
 const value=$('tornApiKey').value.trim();
 if(!/^[a-z0-9]{16}$/i.test(value))throw new Error('Chave inválida: use os 16 caracteres fornecidos nas configurações do Torn.');
 return value;
}
function status(id,message,success=false){
 const e=$(id);e.textContent=message;e.className='notice'+(success?' ok':'');
}
function disableBusy(busy){
 active=busy;
 $('testKey').disabled=busy;
 $('scan').disabled=busy;
}
async function api(path){
 const token=key();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20000);
 try {
  const response=await fetch('https://api.torn.com/v2/'+path,{
   method:'GET',signal:controller.signal,cache:'no-store',credentials:'omit',
   referrerPolicy:'no-referrer',redirect:'error',
   headers:{Accept:'application/json',Authorization:'ApiKey '+token}
  });
  if(!response.ok){
   if(response.status===401||response.status===403)throw new Error('Chave recusada ou sem permissão (HTTP '+response.status+').');
   if(response.status===429)throw new Error('Limite de chamadas atingido (HTTP 429). Tente mais tarde.');
   throw new Error('API Torn respondeu HTTP '+response.status+'.');
  }
  const data=await response.json();
  if(data&&data.error){
   // Evita expor conteúdo da resposta não confiável, especialmente segredos.
   const errorCode=Number(data.error.code);
   throw new Error('A API Torn devolveu um erro'+(Number.isInteger(errorCode)?' (código '+errorCode+')':'')+'. Confira chave, permissões e ID do item.');
  }
  return data;
 } catch(error){
  if(error.name==='AbortError')throw new Error('Tempo de resposta da API excedeu 20 segundos.');
  if(error instanceof TypeError)throw new Error('O navegador não conseguiu acessar a API Torn. Pode ser CORS, rede ou indisponibilidade; nenhuma chave foi enviada a outro serviço.');
  throw error;
 } finally {clearTimeout(timeout);}
}
async function withTask(task){
 if(active)return;
 disableBusy(true);
 try{await task();}
 finally{disableBusy(false);}
}
$('tornApiKey').addEventListener('input',()=>{
 $('keyState').textContent='Chave ainda não testada.';
 status('keyNotice','Chave editada. Clique em Testar chave para verificar o acesso.');
});
$('clearKey').addEventListener('click',()=>{
 $('tornApiKey').value='';
 $('keyState').textContent='Chave limpa.';
 $('rows').innerHTML='<tr><td colspan="4" class="muted">Chave limpa. Nenhuma nova consulta será feita até informar outra chave.</td></tr>';
 $('metrics').replaceChildren();
 $('summary').textContent='';
 status('keyNotice','Campo de chave limpo; nenhuma chave foi salva no dispositivo.',true);
 $('tornApiKey').focus();
});
$('testKey').addEventListener('click',()=>withTask(async()=>{
 $('keyState').textContent='Validando chave…';
 try{
  await api('key/info');
  $('keyState').textContent='Chave aceita pela API Torn.';
  status('keyNotice','Autenticação concluída. O próximo passo é consultar um item. A confirmação da permissão de mercado acontecerá nessa consulta.',true);
 }catch(e){
  $('keyState').textContent='Não validada.';
  status('keyNotice',e.message);
 }
}));
$('scan').addEventListener('click',()=>withTask(async()=>{
 const id=Number($('itemId').value);
 if(!Number.isSafeInteger(id)||id<1||id>9999999){
  status('marketNotice','Informe um ID numérico de item válido.');
  return;
 }
 $('scanState').textContent='Consultando anúncios…';
 try{
  const data=await api('market/'+id+'/itemmarket');
  const raw=data?.itemmarket?.listings??data?.listings;
  if(!Array.isArray(raw))throw new Error('Resposta da API diferente do formato esperado: não encontrei a lista de anúncios.');
  const valid=raw.map(x=>({price:Number(x.price),amount:Number(x.amount)}))
    .filter(x=>Number.isFinite(x.price)&&x.price>0&&Number.isFinite(x.amount)&&x.amount>0)
    .sort((a,b)=>a.price-b.price);
  if(!valid.length){
   $('rows').innerHTML='<tr><td colspan="4" class="muted">Nenhum anúncio válido encontrado para este item.</td></tr>';
   $('metrics').replaceChildren();
   $('summary').textContent='A API não retornou anúncios de venda utilizáveis.';
  }else{
   const limit=Number($('rowLimit').value)||25;
   const shown=valid.slice(0,limit);
   const cheapest=valid[0].price;
   const totalUnits=valid.reduce((a,b)=>a+b.amount,0);
   const median=valid[Math.floor((valid.length-1)/2)].price;
   $('metrics').innerHTML=
     '<article class="panel"><div class="small muted">Menor preço anunciado</div><h2>'+format(cheapest)+' T$</h2></article>'+
     '<article class="panel"><div class="small muted">Anúncios recebidos</div><h2>'+format(valid.length)+'</h2></article>'+
     '<article class="panel"><div class="small muted">Unidades nos anúncios recebidos</div><h2>'+format(totalUnits)+'</h2></article>';
   $('rows').innerHTML=shown.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+format(x.price)+'</td><td>'+format(x.amount)+'</td><td>'+format(x.price*x.amount)+'</td></tr>').join('');
   $('summary').textContent='Exibindo '+shown.length+' de '+valid.length+' anúncios recebidos para o item #'+id+'. Preço mediano entre anúncios: '+format(median)+' T$. Isso não representa negócios concluídos ou lucro garantido.';
  }
  $('scanState').textContent='Consulta manual concluída às '+new Date().toLocaleTimeString('pt-BR')+'.';
  status('marketNotice','Anúncios obtidos diretamente da API oficial do Torn. Os valores representam preços pedidos pelos vendedores, não ordens de compra nem arbitragem confirmada.',true);
 }catch(e){
  $('scanState').textContent='Falha na consulta.';
  status('marketNotice',e.message);
 }
}));
