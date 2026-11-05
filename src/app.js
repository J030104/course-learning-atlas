import { mountPreview } from './components/preview.mjs';
import { setCoursePicker } from './components/course-picker.mjs';

(()=>{'use strict';
const A=window.ATLAS,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const course=A.course;
const storagePrefix='course-atlas.'+course.id+'.';
document.title=course.code+' · '+course.title;
document.querySelectorAll('[data-course]').forEach(element=>{element.textContent=course[element.dataset.course];});
$('[data-area="study"]').textContent=course.studyLabel;
$('[data-area="assignments"]').textContent=course.assignmentsLabel;
setCoursePicker(A.courses,course.id);
const area=new URLSearchParams(location.search).get('area')==='assignments'?'assignments':'study';
const assignments=area==='assignments';
const resources=A.resources.filter(r=>r.area===area);
const areaTopics=['全部主題', ...A.topics.slice(1).filter(t=>resources.some(r=>r.topics.includes(t)))];
const linkTo=r=>(r.area==='assignments'?'?area=assignments':'./')+'#resource='+r.id;
document.querySelector('[data-area="'+area+'"]').setAttribute('aria-current','page');
$('#home').hidden=assignments;
$('#assignments-home').hidden=!assignments;
if(assignments)$('#search').placeholder='搜尋作業、習題、原型或檔名…';
function read(k,d){try{return JSON.parse(localStorage.getItem(storagePrefix+k))??d}catch{return d}}
function write(k,v){try{localStorage.setItem(storagePrefix+k,JSON.stringify(v))}catch{}}
let favorites=new Set(read('favorites',[])),recent=read('recent',[]),positions=read('positions',{}),current=null,topic='全部主題',type='all',savedOnly=false;
const groups=[['all','全部',()=>true],...Object.entries(A.kinds).map(([id,label])=>[id,label,r=>r.kindId===id])]
  .filter(([id,,fn])=>id==='all'||resources.some(fn));
$('#updated').textContent=course.updated?'整理於 '+course.updated:'';
$('#stats').innerHTML=[[resources.filter(r=>r.kindId==='interactive').length,'項互動教材'],[resources.length,'項學習資源'],[areaTopics.length-1,'個主題']]
  .map(([n,l])=>`<div class="stat"><strong>${n}</strong>${l}</div>`).join('');
$('#go-interactive').hidden=!groups.some(g=>g[0]==='interactive');
$('#go-answers').hidden=!groups.some(g=>g[0]==='answers');
function topics(){ $('#topics').innerHTML=areaTopics.map((t,i)=>`<button class="topic ${t===topic?'active':''}" data-topic="${i}" aria-pressed="${t===topic}">${esc(t)}<span>${t==='全部主題'?resources.length:resources.filter(r=>r.topics.includes(t)).length}</span></button>`).join('');$('#topics').querySelectorAll('button').forEach(b=>b.onclick=()=>{topic=areaTopics[+b.dataset.topic];topics();render();$('#library').scrollIntoView({behavior:'smooth'});});}
function diagram(r){
 const label=r.kindId==='interactive'?'↗':r.files[0]?.label||'LINK';
 return `<svg viewBox="0 0 330 150" aria-hidden="true"><rect width="330" height="150" fill="#edf3e8"/><rect x="119" y="24" width="86" height="104" rx="4" fill="#fffefb" stroke="#bbcebf"/><path d="M137 48H186M137 58H176M137 96H186M137 106H170" stroke="#d5e0d2"/><text x="162" y="84" text-anchor="middle" fill="#1b6b60" font-size="16" font-family="monospace">${esc(label)}</text></svg>`;
}
function card(r){let interactive=r.kindId==='interactive';return `<article class="card"><button class="favorite" data-save="${r.id}" aria-label="${favorites.has(r.id)?'取消收藏':'收藏'}：${esc(r.title)}" aria-pressed="${favorites.has(r.id)}">${favorites.has(r.id)?'★':'☆'}</button><button class="card-top" data-open="${r.id}" aria-label="開啟：${esc(r.title)}">${r.preview?`<img src="${r.preview}" alt="${esc(r.title)}預覽" loading="lazy">`:diagram(r)}<span class="number">${interactive?'↗ EXPLORE':''}</span></button><div class="card-content"><div class="card-meta"><span class="pill">${esc(r.kind)}</span><span>${esc(r.topic)}</span>${r.historical?'<span class="pill history">歷史版本</span>':''}</div><button class="card-title" data-open="${r.id}">${esc(r.title)}</button><p class="card-desc">${esc(r.description)}</p><div class="card-bottom"><span>${r.synthetic?'合成教學例':r.kind==='實驗圖表'?'既有原型輸出':r.external?'外部資源 · 需要網路':r.files.map(f=>f.label).join(' · ')}</span><button data-open="${r.id}">${interactive?'開始探索':'開啟資源'} ↗</button></div></div></article>`;}
function bindCards(root){root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open));root.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{toggleSave(b.dataset.save);render();});}
function toggleSave(id){favorites.has(id)?favorites.delete(id):favorites.add(id);write('favorites',[...favorites]);if(current?.id===id)$('#viewer-save').textContent=favorites.has(id)?'★ 已收藏':'☆ 收藏';}
function recentRender(){let rs=recent.map(id=>resources.find(r=>r.id===id)).filter(Boolean).slice(0,3);$('#recent-section').hidden=!rs.length;$('#recent').innerHTML=rs.map(r=>`<button class="recent-item" data-open="${r.id}">${esc(r.title)}<small>${esc(r.topic)}</small></button>`).join('');bindCards($('#recent'));}
function render(){let query=$('#search').value.trim().toLowerCase(),base=resources.filter(r=>(topic==='全部主題'||r.topics.includes(topic))&&(!savedOnly||favorites.has(r.id))&&(!query||[r.title,r.description,r.topic,...r.source,...r.keywords].join(' ').toLowerCase().includes(query)));
 $('#types').innerHTML=groups.map(([id,label,fn])=>`<button class="tab ${type===id?'active':''}" data-type="${id}" aria-pressed="${type===id}">${label}<span>${base.filter(fn).length}</span></button>`).join('');$('#types').querySelectorAll('button').forEach(b=>b.onclick=()=>{type=b.dataset.type;render();});
 let list=base.filter(groups.find(g=>g[0]===type)[2]);if($('#sort').value==='title')list.sort((a,b)=>a.title.localeCompare(b.title,'zh-Hant'));$('#cards').innerHTML=list.map(card).join('');$('#empty').hidden=!!list.length;$('#result-count').textContent=`${list.length} 項資源`;
 $('#library-title').textContent=savedOnly?'我的收藏':topic==='全部主題'?(assignments?'全部作業資源':'全部學習資源'):topic;$('#active-summary').hidden=type!=='interactive';$('#active-summary').textContent='本機互動圖可直接操作。外部資源會另開網站。';$('#saved').setAttribute('aria-pressed',savedOnly);bindCards($('#cards'));recentRender();}
function markdown(text,r){let lines=text.split('\n'),out=[],fence=false,table=false;
 function inline(s){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>{let raw=url.replaceAll('&amp;','&');if(/^https?:\/\//.test(raw))return `<a href="${esc(raw)}" target="_blank" rel="noopener">${label} ↗</a>`;let known;try{let source=r.source[0]||'';let resolved=new URL(raw,'https://atlas.local/'+source);let path=decodeURIComponent(resolved.pathname.slice(1));known=A.resources.find(x=>x.source.includes(path));}catch{}return known?`<a href="${linkTo(known)}" data-related="${known.id}">${label}</a>`:`<span class="broken-link" title="來源中的相對連結；可在原專案查閱">${label}</span>`;});}
 for(let line of lines){if(line.startsWith('```')){if(table){out.push('</tbody></table>');table=false}out.push(fence?'</pre>':'<pre>');fence=!fence;continue}if(fence){out.push(esc(line)+'\n');continue}if(line.trim().startsWith('|')){if(!table){out.push('<table><tbody>');table=true}if(/^\s*\|[\s|:\-]+\|\s*$/.test(line))continue;out.push('<tr>'+line.trim().replace(/^\||\|$/g,'').split('|').map(c=>'<td>'+inline(c.trim())+'</td>').join('')+'</tr>');continue}if(table){out.push('</tbody></table>');table=false}let m=line.match(/^(#{1,4}) (.*)/);if(m){out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);continue}if(line.trim())out.push('<p>'+inline(line.replace(/^[-*] /,'• '))+'</p>');}if(table)out.push('</tbody></table>');if(fence)out.push('</pre>');return out.join('\n');}
async function documentView(r,f){$('#viewer-body').innerHTML='<div class="text-document">正在讀取…</div>';try{let response=await fetch(f.url);if(!response.ok)throw Error('讀取失敗');let text=await response.text();if(current?.id!==r.id)return;let content=f.label==='MD'?markdown(text,r):f.label==='CSV'?'<table><tbody>'+text.trim().split('\n').map(row=>'<tr>'+row.split(',').map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<pre>'+esc(text)+'</pre>';$('#viewer-body').innerHTML='<div class="text-document">'+content+'</div>';$('#viewer-body').querySelectorAll('[data-related]').forEach(a=>a.onclick=e=>{if(resources.some(r=>r.id===a.dataset.related)){e.preventDefault();open(a.dataset.related);}});}catch{if(current?.id===r.id)$('#viewer-body').innerHTML='<div class="text-document"><p>此檔案無法在目前環境預覽。請使用上方「開啟原檔」連結閱讀。</p></div>';}}
function showFrame(url,title,sandboxed=false,onPage){
 mountPreview($('#viewer-body'),url,title,{sandboxed,close,onPage});
}
function showDocument(r,file){
 const reader=new URL('pdf.html',location.href);
 reader.searchParams.set('file',file.preview||file.url);
 if(file.preview)reader.searchParams.set('original',file.url);
 const position=r.id+':'+file.label;
 if(positions[position])reader.searchParams.set('page',positions[position]);
 showFrame(reader.href,r.title+' · '+file.label+' 預覽',false,number=>{
  positions[position]=number;
  write('positions',positions);
 });
}
function open(id,fromHash=false){const r=A.resources.find(x=>x.id===id);if(!r)return;if(r.area!==area){location.replace(linkTo(r));return;}current=r;recent=[id,...recent.filter(x=>x!==id)].slice(0,8);write('recent',recent);recentRender();$('#viewer-title').textContent=r.title;$('#viewer-type').textContent=r.topic+' / '+r.kind;$('#viewer-desc').textContent=(r.hint||r.description)+(r.synthetic?'　｜　合成教學例':'')+(r.historical?'　｜　歷史版本':'');$('#viewer-save').textContent=favorites.has(id)?'★ 已收藏':'☆ 收藏';$('#viewer-links').innerHTML=r.files.map(f=>`<a href="${f.url}" target="_blank" rel="noopener">開啟原檔 ${esc(f.label)} ↗</a>`).join('')+(r.external?`<a href="${esc(r.external)}" target="_blank" rel="noopener">前往原網站 ↗</a>`:'');$('#viewer-source').textContent=r.source.length?'專案來源：'+r.source.join(' · '):'外部來源：'+r.external;
 if(!$('#viewer').open)$('#viewer').showModal();if(!fromHash)history.replaceState(null,'','#resource='+r.id);
 const body=$('#viewer-body');body.replaceChildren();body.scrollTop=0;
 const pdf=r.files.find(f=>f.label==='PDF');
 const pptx=r.files.find(f=>f.label==='PPTX'&&f.preview);
 const available=[pdf,pptx].filter(Boolean);
 if(available.length){
  const formats=available.length>1?document.createElement('span'):null;
  if(formats){
   formats.className='preview-formats';
   formats.setAttribute('role','group');
   formats.setAttribute('aria-label','預覽格式');
   $('#viewer-links').prepend(formats);
  }
  const buttons=[];
  const show=file=>{
   buttons.forEach(button=>button.setAttribute('aria-pressed',button.dataset.format===file.label));
   showDocument(r,file);
  };
  if(formats)available.forEach(file=>{
   const button=document.createElement('button');
   button.type='button';
   button.dataset.format=file.label;
   button.textContent=file.label+' 預覽';
   button.onclick=()=>show(file);
   formats.append(button);
   buttons.push(button);
  });
  show(available[0]);
 }
 else if(r.external){body.innerHTML=`<div class="text-document"><h2>${esc(r.title)}</h2><p>${esc(r.description)}</p><p>這是外部互動資源，需要網路。從下方連結開啟原網站操作。</p><a class="primary" href="${esc(r.external)}" target="_blank" rel="noopener">開啟互動網站 ↗</a></div>`;}
 else{let f=r.files[0],url=f?.url;if(!url)return;if(/\.(png|jpg|jpeg|svg|webp|gif)(?:$|\?)/i.test(url)){body.innerHTML=`<img class="image-preview" src="${url}" alt="${esc(r.title)}">`;}
 else if(['HTML','HTM'].includes(f.label)){showFrame(url,r.title,r.kindId!=='answers');}
 else if(['MD','CSV','JSON','PY','MJS','TXT'].includes(f.label))documentView(r,f);
 else{body.innerHTML='<div class="text-document"><h2>下載原始教材</h2><p>請使用上方原檔連結下載後，以相容的軟體開啟。</p></div>';}}}
function close(){if(!$('#viewer').open)return;const id=current?.id;$('#viewer').close();$('#viewer-body').replaceChildren();current=null;history.replaceState(null,'',location.pathname+location.search+'#library');render();($(`.card-title[data-open="${id}"]`)||$('#search')).focus({preventScroll:true});}
$('#close-viewer').onclick=close;$('#viewer').addEventListener('cancel',e=>{e.preventDefault();close();});$('#viewer-save').onclick=()=>{if(current)toggleSave(current.id);};$('#search').oninput=render;$('#sort').onchange=render;$('#saved').onclick=()=>{savedOnly=!savedOnly;render();$('#library').scrollIntoView();};$('#go-interactive').onclick=()=>{type='interactive';savedOnly=false;topic='全部主題';$('#search').value='';topics();render();$('#library').scrollIntoView({behavior:'smooth'});};$('#go-answers').onclick=e=>{e.preventDefault();type='answers';savedOnly=false;topic='全部主題';$('#search').value='';topics();render();$('#library').scrollIntoView({behavior:'smooth'});};$('#clear').onclick=()=>{topic='全部主題';type='all';savedOnly=false;$('#search').value='';topics();render();};$('#scope').onclick=()=>$('#about').showModal();$('#about-link').onclick=e=>{e.preventDefault();$('#about').showModal();};$('#close-about').onclick=()=>$('#about').close();
function hash(){let m=location.hash.match(/^#resource=([\w-]+)$/);if(m)open(m[1],true);}window.addEventListener('hashchange',hash);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('#viewer').open&&!$('#about').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();$('#search').focus();}});topics();render();hash();
})();
