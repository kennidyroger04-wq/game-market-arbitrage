import {computeLots} from './dofus.mjs?v=2';
const $=id=>document.getElementById(id);
const sizes=[1,10,100,1000];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const money=x=>{
 if(typeof x==='number')return Number.isFinite(x)&&x>0?Math.round(x):0;
 if(typeof x==='object'&&x!==null)return money(x.price??x.value??x.amount??x.kamas??x.kama);
 const s=String(x??'').trim();if(!s||s==='—'||s==='-')return 0;
 let v=s.replace(/[^0-9.,-]/g,'');
 if(/^\d{1,3}([.,]\d{3})+$/.test(v))v=v.replace(/[.,]/g,'');
 else if(v.includes(',')&&v.includes('.'))v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replaceAll('.','').replace(',','.'):v.replaceAll(',','');
 else if(v.includes(','))v=v.replace(',','.');
 const n=Number(v);
 return Number.isFinite(n)&&n>0?Math.round(n):0;
};
const best=(o,names)=>{
 if(!o||typeof o!=='object')return undefined;
 const idx=new Map(Object.keys(o).map(k=>[normalize(k),k]));
 for(const name of names){const key=idx.get(normalize(name));if(key!==undefined&&o[key]!=null&&o[key]!=='')return o[key];}
 return undefined;
};
const versionOf=x=>{const v=normalize(x);if(['dofus3','unity','dofusunity','dofus30','3'].includes(v))return 'dofus3';if(v.includes('retro'))return 'retro';if(v.includes('touch'))return 'touch';return '';};
const serverOf=x=>normalize(x).replace('dakkal','dakal');
const parsableDate=x=>{
 if(x==null||x==='')return null;
 if(typeof x==='number'){const ms=x<1e11?x*1000:x;return Number.isFinite(ms)?ms:null;}
 const raw=String(x).trim(),iso=/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(raw)&&!/(Z|[+-]\d\d:?\d\d)$/.test(raw)?raw.replace(' ','T')+'Z':raw;
 const candidate=Date.parse(iso);return Number.isFinite(candidate)?candidate:null;
};
function parseCSV(input){
 const line=input.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||'';
 const counts=[',',';','\t'].map(del=>[del,line.split(del).length]);
 counts.sort((a,b)=>b[1]-a[1]);const delim=counts[0][0];
 let quoted=false,field='',row=[],all=[];
 for(let i=0;i<input.length;i++){
  const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===delim){row.push(field);field='';}
  else if(!quoted&&(c==='\r'||c==='\n')){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))all.push(row);row=[];}
  else field+=c;
 }
 row.push(field);if(row.some(x=>x.trim()))all.push(row);
 if(!all.length)return[];
 const columns=all[0].map(x=>x.replace(/^\uFEFF/,'').trim());
 return all.slice(1).map(c=>Object.fromEntries(columns.map((k,i)=>[k,c[i]??''])));
}
function rowsOf(payload){
 if(Array.isArray(payload))return payload;
 if(!payload||typeof payload!=='object')return[];
 for(const key of ['data','items','rows','results','records','prices','list','offers']){
  const v=best(payload,[key]);if(Array.isArray(v))return v.map(o=>typeof o==='object'&&o?{...o,__defaultServer:best(payload,['server','server_name','world'])}:o);
 }
 // Map keyed by item name: { "Iron":{x1:...,x10:...}, ... }
 return Object.entries(payload).filter(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([name,v])=>({name,...v}));
}
function lotPrice(row,n){
 const direct=best(row,['x'+n,'price'+n,'price_x'+n,'prix'+n,'prix_'+n,'lot'+n,'lot_'+n,'p'+n,n+'x','quantity'+n,'price_per_'+n,'price_lot_'+n,'unit_'+n,'lot'+n+'Price']);
 if(direct!==undefined)return money(direct);
 const prices=best(row,['prices','lots','lot_prices','listings','market_prices','marketplace_prices','hdv_prices']);
 if(prices&&typeof prices==='object'){
  if(Array.isArray(prices)){
   const found=prices.find(p=>Number(best(p,['size','quantity','lot','lot_size','stack_size']))===n);
   if(found)return money(best(found,['price','value','kamas','amount']));
  }else{
   const value=best(prices,[String(n),'x'+n,'price'+n,'lot'+n,'price_x'+n]);
   if(value!==undefined)return money(value);
  }
 }
 return 0;
}
function normalizeEntries(rows,selectedServer,selectedVersion='dofus3',source='mizanbot',allowMissingServer=false,allowMissingVersion=false){
 const grouped=new Map(),stats={sourceRows:rows.length,unusable:0,differentServer:0,missingServer:0,differentVersion:0,missingVersion:0};
 const sourceVersion=['mizanbot','kamaradar','dofusteam','hdvclair'].includes(source)?'dofus3':'';
 for(const item of rows){
  if(!item||typeof item!=='object'){stats.unusable++;continue;}
  const nested=best(item,['item','object','resource']);
  const name=String(best(item,['name','item_name','itemName','nom','objet','resource_name','itemLabel','label','title'])??(typeof nested==='object'&&nested?best(nested,['name','label','title']):nested)??'').trim();
  const id=best(item,['item_id','itemId','id','gid']);
  const itemLabel=name||(id?'Item #'+id:'');
  if(!itemLabel){stats.unusable++;continue;}
  const rawServer=best(item,['server','server_name','serverName','world','worldName','server_label'])??item.__defaultServer;
  const server=typeof rawServer==='object'?String(best(rawServer,['name','label'])??''):String(rawServer??'').trim();
  if(server&&selectedServer&&serverOf(server)!==serverOf(selectedServer)){stats.differentServer++;continue;}
  if(!server&&!allowMissingServer){stats.missingServer++;continue;}
  const rawVersion=best(item,['version','game_version','gameVersion','game','edition','client']);
  const actualVersion=versionOf(rawVersion)||(!rawVersion?sourceVersion:'');
  if(rawVersion&&!actualVersion){stats.missingVersion++;continue;}
  if(actualVersion&&actualVersion!==selectedVersion){stats.differentVersion++;continue;}
  if(!actualVersion&&!allowMissingVersion){stats.missingVersion++;continue;}
  const date=parsableDate(best(item,['updated_at','updatedAt','last_updated','lastUpdate','updated','date','timestamp','checked_at','observed_at','collected_at','created_at']));
  const prices=Object.fromEntries(sizes.map(n=>[n,lotPrice(item,n)]));
  const lotSize=Number(best(item,['lot_size','lotSize','lot','size']));
  const onePrice=money(best(item,['price','unit_price','kamas','amount','value']));
  if(sizes.includes(lotSize)&&onePrice>0&&!prices[lotSize])prices[lotSize]=onePrice;
  if(!sizes.some(n=>prices[n]>0)){stats.unusable++;continue;}
  const k=normalize(itemLabel)+'|'+serverOf(selectedServer||server)+'|'+selectedVersion;
  let group=grouped.get(k);
  if(!group){group={name:itemLabel,server:selectedServer||server,version:selectedVersion,source,prices:{},dates:{}};grouped.set(k,group);}
  for(const n of sizes){
   if(prices[n]>0&&(!group.prices[n]||date&&(!group.dates[n]||date>group.dates[n]))){
    group.prices[n]=prices[n];group.dates[n]=date;
   }
  }
 }
 return {items:[...grouped.values()],stats};
}
let loaded=null;
const fmt=x=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:1});
function display(){
 if(!loaded)return;
 const cap=Number($('capital').value)||0,tax=Number($('tax').value)||0,maxAds=Number($('maxAds').value)||20;
 const ageHours=Number($('maxAge').value)||24,margin=Number($('importMargin').value)||0;
 const onlyPositive=$('importOnlyPositive').checked,allowUndated=$('allowUndated').checked;
 const fromText=$('dateFrom').value,toText=$('dateTo').value;
 const from=fromText?new Date(fromText+'T00:00:00').getTime():null;
 const to=toText?new Date(toText+'T23:59:59.999').getTime():null;
 if(from!==null&&to!==null&&from>to){$('importStatus').textContent='Período inválido: data inicial posterior à data final.';return;}
 const now=Date.now(),rank=[],counters={stale:0,undated:0,outside:0};
 const server=$('server').value.trim(),version=$('version').value;
 for(const row of loaded.items){
  if(serverOf(row.server)!==serverOf(server)||row.version!==version)continue;
  const prices={},ages={};
  for(const n of sizes){
   if(!row.prices[n])continue;
   const stamp=row.dates[n];
   if(!stamp){
    counters.undated++;
    if(!allowUndated||from!==null||to!==null)continue;
    ages[n]=null;
   }else{
    if(from!==null&&stamp<from||to!==null&&stamp>to){counters.outside++;continue;}
    const age=(now-stamp)/3600000;
    if(age>ageHours||age< -2){counters.stale++;continue;}
    ages[n]=age;
   }
   prices[n]=row.prices[n];
  }
  for(const op of computeLots(prices,cap,tax,maxAds)){
   if(op.roi<margin||onlyPositive&&op.profit<=0)continue;
   const ago=Math.max(ages[op.buySize]??0,ages[op.sellSize]??0);
   const noDate=ages[op.buySize]===null||ages[op.sellSize]===null;
   rank.push({...op,name:row.name,source:row.source,age:noDate?'sem data':fmt(ago)+'h'});
  }
 }
 rank.sort((a,b)=>b.profit-a.profit);
 $('importRows').innerHTML=rank.length?rank.slice(0,100).map(r=>'<tr><td>'+esc(r.name)+'</td><td>x'+r.buySize+'</td><td>x'+r.sellSize+'</td><td>'+fmt(r.required)+'</td><td class="'+(r.profit>0?'positive':'negative')+'">'+fmt(r.profit)+' K</td><td class="'+(r.roi>0?'positive':'negative')+'">'+fmt(r.roi)+'%</td><td>'+esc(r.age)+'</td></tr>').join(''):'<tr><td colspan="7" class="muted">Sem oportunidades com versão, servidor, datas, capital e margem selecionados. Não misturamos mercados.</td></tr>';
 $('importStatus').className='notice'+(rank.length?' ok':'');
 const st=loaded.stats;
 $('importStatus').textContent='Fonte: '+loaded.source+' · '+loaded.items.length+' itens reconhecidos · '+rank.length+' combinações (até 100 exibidas). Excluídas: '+counters.stale+' cotações antigas, '+counters.outside+' fora do período, '+counters.undated+' sem data, '+st.unusable+' linhas ilegíveis, '+st.differentServer+' outros servidores, '+st.missingServer+' sem servidor e '+st.differentVersion+' versões diferentes, '+st.missingVersion+' sem versão. São hipóteses, não vendas confirmadas.';
}
async function importFile(){
 const file=$('mizanFile').files?.[0];
 if(!file){$('importStatus').textContent='Selecione um arquivo CSV ou JSON exportado antes de importar.';return;}
 if(file.size>15_000_000){$('importStatus').textContent='Arquivo acima de 15 MB. Exporte um conjunto menor.';return;}
 const source=$('importSource').value,version=$('version').value;
 if(source!=='generic'&&version!=='dofus3'){$('importStatus').textContent='Esta fonte é de DOFUS 3. Para Retro e Touch, escolha arquivo genérico com versão conhecida.';return;}
 const server=$('server').value.trim();
 if(!server){$('importStatus').textContent='Informe seu servidor antes de importar, para evitar comparação entre mundos diferentes.';return;}
 $('importFile').disabled=true;
 try{
  const content=await file.text(),parsed=/\.json$/i.test(file.name)||content.trim().startsWith('{')||content.trim().startsWith('[')?rowsOf(JSON.parse(content)):parseCSV(content);
  if(!Array.isArray(parsed)||!parsed.length)throw new Error('Não encontrei registros de preços no arquivo');
  const {items,stats}=normalizeEntries(parsed,server,version,source,$('assumeServer').checked,$('assumeVersion').checked);
  if(!items.length)throw new Error('Não consegui identificar itens e preços. Precisamos conferir as colunas do arquivo exportado; nenhum preço foi inventado.');
  loaded={items,stats,source};display();
 }catch(e){$('importStatus').textContent='Não foi possível importar: '+e.message;}
 finally{$('importFile').disabled=false;}
}
$('importFile').addEventListener('click',importFile);
for(const id of ['maxAge','importMargin','importOnlyPositive','allowUndated','capital','tax','maxAds','dateFrom','dateTo','version','server'])$(id)?.addEventListener('input',display);
