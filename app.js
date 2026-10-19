(function(){
var KINDS={warm:'Hip prep',strength:'Strength',core:'Core and obliques',cond:'Conditioning',cool:'Cool-down'};
var ls={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},del:function(k){try{localStorage.removeItem(k)}catch(e){}}};
var starter=JSON.parse(document.getElementById('plan-data').textContent);
var starterStr=JSON.stringify(starter);
var plan=null, custom=false;
var stored=ls.get('pr-plan');
if(stored){ try{ plan=JSON.parse(stored); custom=true; }catch(e){ plan=null; } }
if(!plan||!plan.days||!plan.days.length){ plan=JSON.parse(starterStr); custom=false; }
var today=new Date(); var todayKey='pr-ticks-'+today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i); if(k&&k.indexOf('pr-ticks-')===0&&k!==todayKey) localStorage.removeItem(k)}}catch(e){}
var ticks={}; try{ticks=JSON.parse(ls.get(todayKey)||'{}')||{}}catch(e){ticks={}}
var S={day:null,edit:false,editing:null,adding:null,confirmDel:null,confirmReset:false,msg:'',err:'',restoreOpen:false};
function pickDay(){var want=ls.get('pr-day'); if(want==='guide') return 'guide'; if(want&&plan.days.some(function(d){return d.id===want})) return want;
 var wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()]; var m=plan.days.filter(function(d){return d.weekday===wd})[0]; return m?m.id:plan.days[0].id;}
S.day=pickDay();

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return 'x'+Math.random().toString(36).slice(2,9)}
function nsets(it){var n=parseInt(it.sets,10); if(!(n>0)) n=1; return Math.min(n,12)}
function videoUrl(it){ if(it.video) return it.video; return 'https://www.youtube.com/results?search_query='+encodeURIComponent((it.q||it.name)+' exercise form'); }
function curDay(){return plan.days.filter(function(d){return d.id===S.day})[0]}
function findItem(id){var r=null; plan.days.forEach(function(d){d.sections.forEach(function(s){s.items.forEach(function(it,ix){if(it.id===id) r={day:d,sec:s,item:it,ix:ix}})})}); return r}
var toastT=null;
function toast(t){var el=document.getElementById('toast'); if(!el) return; el.textContent=t; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){el.hidden=true},1800);}
function changed(){
 var str=JSON.stringify(plan);
 if(str===starterStr){ ls.del('pr-plan'); custom=false; toast('Saved on this phone'); return; }
 if(ls.set('pr-plan',str)){ custom=true; toast('Saved on this phone'); }
 else { S.msg='This browser won’t let the page save. Your change works until you close it. Use Backup to keep a copy.'; }
}

var PLAY='<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';

function itemForm(it,secId){
 it=it||{name:'',sets:3,reps:'',rest:'',note:'',video:''};
 return '<form class="edit" data-form="'+(it.id?'edit':'add')+'" data-sec="'+esc(secId||'')+'" data-id="'+esc(it.id||'')+'">'+
 '<label class="full">Exercise name<input id="f-name" required value="'+esc(it.name)+'" placeholder="e.g. Cable kickback"></label>'+
 '<label>Sets / rounds<input id="f-sets" inputmode="numeric" value="'+esc(it.sets)+'"></label>'+
 '<label>Reps or time<input id="f-reps" value="'+esc(it.reps)+'" placeholder="10 / side"></label>'+
 '<label>Rest<input id="f-rest" value="'+esc(it.rest)+'" placeholder="60 s"></label>'+
 '<label>Search words for the demo<input id="f-q" value="'+esc(it.q||'')+'" placeholder="optional"></label>'+
 '<label class="full">Coaching note<input id="f-note" value="'+esc(it.note)+'" placeholder="What to feel, what to avoid"></label>'+
 '<label class="full">Your own video link (optional)<input id="f-video" inputmode="url" value="'+esc(it.video||'')+'" placeholder="https://youtube.com/..."></label>'+
 (S.err?'<p class="err">'+esc(S.err)+'</p>':'')+
 '<div class="row"><button type="button" class="btn" data-act="cancel">Cancel</button><button type="submit" class="btn primary">'+(it.id?'Update':'Add exercise')+'</button></div></form>';
}

function exHtml(it,sec){
 var t=ticks[it.id]||[], n=nsets(it), done=0, b='';
 for(var i=0;i<n;i++){var on=!!t[i]; if(on) done++; b+='<button class="set'+(on?' on':'')+'" data-act="tick" data-id="'+it.id+'" data-i="'+i+'" aria-pressed="'+on+'" aria-label="Set '+(i+1)+'">'+(i+1)+'</button>';}
 var rx='<b>'+esc(it.sets)+' ×</b> '+esc(it.reps)+(it.rest?' <em>· rest '+esc(it.rest)+'</em>':'');
 var h='<li class="ex'+(done===n?' done':'')+'" id="ex-'+it.id+'"><div class="ex-main"><div class="ex-name">'+esc(it.name)+'</div><div class="ex-rx">'+rx+'</div>'+(it.note?'<div class="ex-note">'+esc(it.note)+'</div>':'')+'</div>'+
  '<a class="watch" href="'+esc(videoUrl(it))+'" target="_blank" rel="noopener">'+PLAY+(it.video?'My video':'Watch')+'</a>'+
  '<div class="sets">'+b+'</div>';
 if(S.edit){
  if(S.editing===it.id){ h+=itemForm(it,sec.id); }
  else { h+='<div class="tools"><button class="btn" data-act="edit" data-id="'+it.id+'">Edit</button><button class="btn" data-act="up" data-id="'+it.id+'">Move up</button><button class="btn" data-act="down" data-id="'+it.id+'">Move down</button>'+
   (S.confirmDel===it.id?'<button class="btn danger" data-act="delyes" data-id="'+it.id+'">Tap again to remove</button>':'<button class="btn danger" data-act="del" data-id="'+it.id+'">Remove</button>')+'</div>'; }
 }
 return h+'</li>';
}

function dayHtml(d){
 var total=0,mins=0,done=0;
 d.sections.forEach(function(s){mins+=(+s.minutes||0); s.items.forEach(function(it){var n=nsets(it); total+=n; var t=ticks[it.id]||[]; for(var i=0;i<n;i++) if(t[i]) done++;})});
 var h='<div class="dayhead">';
 if(S.edit){ h+='<div class="dayedit"><label>Day<input id="dd-wd" value="'+esc(d.weekday)+'" maxlength="4"></label><label>Title<input id="dd-title" value="'+esc(d.title)+'"></label><label class="full">Focus<input id="dd-focus" value="'+esc(d.focus)+'"></label></div>'; }
 else { h+='<h2>'+esc(d.title)+'</h2><p>'+esc(d.focus)+'</p>'; }
 h+='<div class="meta"><span><b>~'+Math.round(mins/5)*5+' min</b> total</span><span><b>'+done+'</b> of '+total+' sets done today</span>'+(done>0?'<button class="btn small" data-act="clearticks">Clear today’s ticks</button>':'')+'</div>';
 h+='<div class="bar"><i style="width:'+(total?Math.round(done/total*100):0)+'%"></i></div></div>';
 d.sections.forEach(function(s){
  h+='<section class="sec k-'+esc(s.kind)+'"><div class="sec-h"><h3>'+esc(s.title||KINDS[s.kind]||'')+'</h3><span>'+(s.minutes?esc(s.minutes)+' min':'')+'</span></div>'+(s.note?'<p class="sec-note">'+esc(s.note)+'</p>':'')+'<ul class="ex-list">';
  s.items.forEach(function(it){h+=exHtml(it,s)});
  h+='</ul>';
  if(S.edit){ h+= (S.adding===s.id? itemForm(null,s.id) : '<button class="add" data-act="add" data-sec="'+s.id+'">+ Add exercise to '+esc(s.title||KINDS[s.kind])+'</button>'); }
  h+='</section>';
 });
 return h;
}

function guideHtml(){
 var h='<div class="guide"><div class="dayhead"><h2>How the week works</h2><p>4 gym days of 1.5-2 hours. Every day follows the same order: conditioning, hip prep, strength, core and obliques, cool-down. Each day uses different exercises, even when they train the same muscles.</p></div>';
 h+='<h3>Your week</h3><div class="week">'+(plan.week||[]).map(function(w){return '<div><b>'+esc(w.day)+'</b><span>'+esc(w.what)+'</span></div>'}).join('')+'</div>';
 if(plan.buildup&&plan.buildup.length){
  h+='<h3>Conditioning build-up</h3><p class="sec-note">Move to the next stage only when the current one felt easy and the hip was quiet the next day.</p><div class="bu-wrap"><table class="bu"><thead><tr><th>Weeks</th><th>Tue · treadmill</th><th>Thu · rope</th><th>Sat · 15/15</th></tr></thead><tbody>'+
   plan.buildup.map(function(r){return '<tr><th>'+esc(r.weeks)+'</th><td>'+esc(r.tue)+'</td><td>'+esc(r.thu)+'</td><td>'+esc(r.sat)+'</td></tr>'}).join('')+'</tbody></table></div>';
 }
 h+='<h3>Hip rules</h3><ol>'+(plan.rules||[]).map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ol>';
 h+='<h3>Getting lean and stronger</h3><ul>'+(plan.fuel||[]).map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ul>';
 h+='<h3>Using this app</h3><div class="callout">Tap the numbered circles as you finish each set. Ticks reset every day. <b>Watch</b> opens a YouTube search for the movement. When you find a good video, use <b>Edit plan</b> to paste its link so the button goes straight to it. Changes save on this phone straight away and the app works offline once it has been opened.</div>';
 h+='<h3>Backup and restore</h3><p class="sec-note">Your edits live only on this phone. Make a backup now and then, so a new phone or cleared browser data doesn’t lose them.'+(custom?'':' You haven’t changed the plan yet.')+'</p>';
 h+='<div class="bk"><button class="btn" data-act="download">Download backup file</button><button class="btn" data-act="copy">Copy backup text</button><button class="btn" data-act="restoreopen">Restore…</button></div>';
 if(S.restoreOpen){
  h+='<div class="restore"><label for="r-file">Pick a backup file</label><input type="file" id="r-file" accept=".json,application/json,text/plain"><label for="r-text">or paste backup text</label><textarea id="r-text" rows="4" placeholder="{&quot;days&quot;: …}"></textarea>'+
   (S.err?'<p class="err">'+esc(S.err)+'</p>':'')+'<div class="row"><button class="btn" data-act="restoreclose">Cancel</button><button class="btn primary" data-act="restoretext">Restore pasted text</button></div></div>';
 }
 h+='<div class="bk">'+(S.confirmReset?'<button class="btn danger" data-act="resetyes">Tap again: go back to the original plan</button>':'<button class="btn danger" data-act="reset">Go back to the original plan</button>')+'</div>';
 return h+'</div>';
}

function render(){
 var focusId=document.activeElement&&document.activeElement.id;
 var h='<header class="top"><div class="brand"><div><h1>Pitch Ready</h1><small>4 days · engine, strength, core · hip first</small></div>'+
  '<button class="btn'+(S.edit?' on':'')+'" data-act="toggleedit">'+(S.edit?'Done editing':'Edit plan')+'</button></div>';
 h+='<nav class="tabs" role="tablist">'+plan.days.map(function(d){return '<button class="tab" role="tab" data-act="day" data-id="'+d.id+'" aria-selected="'+(S.day===d.id)+'"><b>'+esc(d.weekday)+'</b><span>'+esc((d.title||'').split(':')[0])+'</span></button>'}).join('')+
  '<button class="tab" role="tab" data-act="day" data-id="guide" aria-selected="'+(S.day==='guide')+'"><b>Guide</b><span>Week and rules</span></button></nav></header>';
 if(S.msg) h+='<div class="msg" role="status">'+esc(S.msg)+'</div>';
 var d=curDay();
 h+= (S.day==='guide'||!d)? guideHtml() : dayHtml(d);
 document.getElementById('app').innerHTML=h;
 if(focusId){var el=document.getElementById(focusId); if(el) el.focus();}
 else { var f=document.getElementById('f-name'); if(f&&(S.editing||S.adding)) f.focus(); }
}

function readForm(form){
 function v(id){var e=form.querySelector('#'+id); return e?e.value.trim():''}
 var it={name:v('f-name'),sets:v('f-sets')||'1',reps:v('f-reps'),rest:v('f-rest'),note:v('f-note'),q:v('f-q'),video:v('f-video')};
 if(!it.name) return {err:'Give the exercise a name.'};
 if(it.video&&!/^https:\/\//i.test(it.video)) return {err:'The video link has to start with https://'};
 var n=parseInt(it.sets,10); it.sets=(n>0)?n:1;
 if(!it.q) delete it.q; if(!it.video) delete it.video;
 return {it:it};
}

function validPlan(p){ return p&&Array.isArray(p.days)&&p.days.length&&p.days.every(function(d){return d&&d.id&&Array.isArray(d.sections)&&d.sections.every(function(s){return s&&Array.isArray(s.items)})}); }
function restoreFrom(text){
 var p; try{ p=JSON.parse(text); }catch(e){ S.err='That isn’t a backup from this app. Copy the whole text, from the first { to the last }.'; render(); return; }
 if(!validPlan(p)){ S.err='That text doesn’t contain a workout plan.'; render(); return; }
 plan=p; S.err=''; S.restoreOpen=false; S.day=plan.days[0].id; changed(); S.msg='Plan restored from your backup.'; render();
}
function backupText(){ return JSON.stringify(plan,null,1); }

document.addEventListener('click',function(ev){
 var b=ev.target.closest('[data-act]'); if(!b) return;
 var a=b.getAttribute('data-act'), id=b.getAttribute('data-id');
 if(a!=='delyes'&&a!=='del') S.confirmDel=null;
 if(a!=='reset'&&a!=='resetyes') S.confirmReset=false;
 if(a==='day'){ S.day=id; S.editing=null; S.adding=null; S.msg=''; ls.set('pr-day',id); render(); window.scrollTo(0,0); return; }
 if(a==='tick'){ var i=+b.getAttribute('data-i'); var t=ticks[id]||[]; t[i]=!t[i]; ticks[id]=t; ls.set(todayKey,JSON.stringify(ticks)); render(); return; }
 if(a==='clearticks'){ var d=curDay(); if(d) d.sections.forEach(function(s){s.items.forEach(function(it){delete ticks[it.id]})}); ls.set(todayKey,JSON.stringify(ticks)); render(); return; }
 if(a==='toggleedit'){ S.edit=!S.edit; S.editing=null; S.adding=null; S.err=''; if(S.day==='guide'&&S.edit) S.day=plan.days[0].id; render(); return; }
 if(a==='edit'){ S.editing=id; S.adding=null; S.err=''; render(); return; }
 if(a==='add'){ S.adding=b.getAttribute('data-sec'); S.editing=null; S.err=''; render(); return; }
 if(a==='cancel'){ S.editing=null; S.adding=null; S.err=''; render(); return; }
 if(a==='up'||a==='down'){ var f=findItem(id); if(!f) return; var j=f.ix+(a==='up'?-1:1); if(j<0||j>=f.sec.items.length) return; var arr=f.sec.items; var tmp=arr[j]; arr[j]=arr[f.ix]; arr[f.ix]=tmp; changed(); render(); return; }
 if(a==='del'){ S.confirmDel=id; render(); return; }
 if(a==='delyes'){ var g=findItem(id); if(g){ g.sec.items.splice(g.ix,1); delete ticks[id]; } S.confirmDel=null; changed(); render(); return; }
 if(a==='download'){
  var blob=new Blob([backupText()],{type:'application/json'}); var url=URL.createObjectURL(blob); var aEl=document.createElement('a');
  aEl.href=url; aEl.download='pitch-ready-backup-'+today.toISOString().slice(0,10)+'.json'; document.body.appendChild(aEl); aEl.click(); aEl.remove(); setTimeout(function(){URL.revokeObjectURL(url)},2000);
  toast('Backup file saved to Downloads'); return; }
 if(a==='copy'){
  var txt=backupText();
  var fallback=function(){ S.restoreOpen=true; render(); var ta=document.getElementById('r-text'); if(ta){ ta.value=txt; ta.focus(); ta.select(); } S.msg='Copy didn’t work automatically. The text is selected below: copy it and keep it in Notes or an email.'; render(); var ta2=document.getElementById('r-text'); if(ta2){ta2.value=txt; ta2.select();} };
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast('Backup copied. Paste it into Notes or an email.')},fallback); } else fallback();
  return; }
 if(a==='restoreopen'){ S.restoreOpen=true; S.err=''; render(); return; }
 if(a==='restoreclose'){ S.restoreOpen=false; S.err=''; render(); return; }
 if(a==='restoretext'){ var ta=document.getElementById('r-text'); restoreFrom(ta?ta.value.trim():''); return; }
 if(a==='reset'){ S.confirmReset=true; render(); return; }
 if(a==='resetyes'){ plan=JSON.parse(starterStr); ls.del('pr-plan'); custom=false; S.confirmReset=false; S.msg='Back to the original plan. Your old version is gone unless you made a backup.'; render(); return; }
});
document.addEventListener('change',function(ev){
 var t=ev.target;
 if(t.id==='r-file'&&t.files&&t.files[0]){ var r=new FileReader(); r.onload=function(){ restoreFrom(String(r.result||'').trim()); }; r.readAsText(t.files[0]); return; }
 var d=curDay(); if(!d) return;
 if(t.id==='dd-wd'){ d.weekday=t.value.trim()||d.weekday; changed(); render(); }
 else if(t.id==='dd-title'){ d.title=t.value.trim()||d.title; changed(); render(); }
 else if(t.id==='dd-focus'){ d.focus=t.value.trim(); changed(); render(); }
});
document.addEventListener('submit',function(ev){
 var form=ev.target; if(!form.matches('form.edit')) return; ev.preventDefault();
 var r=readForm(form); if(r.err){ S.err=r.err; render(); return; } S.err='';
 if(form.getAttribute('data-form')==='edit'){ var f=findItem(form.getAttribute('data-id')); if(f){ r.it.id=f.item.id; f.sec.items[f.ix]=r.it; } S.editing=null; }
 else { var secId=form.getAttribute('data-sec'); r.it.id=uid(); plan.days.forEach(function(d){d.sections.forEach(function(s){if(s.id===secId) s.items.push(r.it)})}); S.adding=null; }
 changed(); render();
});
render();
if('serviceWorker' in navigator){ window.addEventListener('load',function(){ navigator.serviceWorker.register('./sw.js').catch(function(){}); }); }
})();
