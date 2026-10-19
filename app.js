(function(){
var KINDS={warm:'Hip prep',strength:'Strength',core:'Core and obliques',cond:'Conditioning',cool:'Cool-down'};
var WD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var WDL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
var DEFAULT_DAYS=[0,1,3,5];            // slot -> weekday (Mon, Tue, Thu, Sat)
var LOWER={0:true,2:true};             // Lower A and Lower B
var MAX_MOVES=2, TARGET=4, BLOCK_WEEKS=6;
var STAGE_KEYS=['mon','tue','thu','sat'];
var ls={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},del:function(k){try{localStorage.removeItem(k)}catch(e){}}};
function getJSON(k,d){try{var v=JSON.parse(ls.get(k)||'null');return v==null?d:v}catch(e){return d}}

// ---------- dates ----------
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function parseYmd(s){var p=String(s).split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function addDays(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)}
function mondayOf(d){return addDays(d,-((d.getDay()+6)%7))}
function weeksBetween(a,b){return Math.round((b-a)/864e5/7)}
function nice(d){return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}
var now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), todayStr=ymd(today);
var mon=mondayOf(today), monStr=ymd(mon), todayIdx=(today.getDay()+6)%7;
function dateOf(i){return addDays(mon,i)}

// ---------- plan ----------
var starter=JSON.parse(document.getElementById('plan-data').textContent);
var starterStr=JSON.stringify(starter);
function upgrade(p){
 if(!p) return null;
 if(p.plan) p=p.plan;                                   // backup wrapper
 if(Array.isArray(p.days)&&!p.blocks){ var b=JSON.parse(JSON.stringify(starter.blocks)); b[0].days=p.days; p={blocks:b}; }
 if(!Array.isArray(p.blocks)||!p.blocks.length) return null;
 for(var i=p.blocks.length;i<starter.blocks.length;i++) p.blocks.push(JSON.parse(JSON.stringify(starter.blocks[i])));
 Object.keys(starter).forEach(function(k){ if(p[k]==null) p[k]=JSON.parse(JSON.stringify(starter[k])); });
 var ok=p.blocks.every(function(bl){return Array.isArray(bl.days)&&bl.days.length===4&&bl.days.every(function(d){return d&&d.id&&Array.isArray(d.sections)&&d.sections.every(function(s){return s&&Array.isArray(s.items)})})});
 return ok?p:null;
}
var plan=null, custom=false;
var stored=getJSON('pr-plan',null);
if(stored){ plan=upgrade(stored); custom=!!plan; }
if(!plan){ plan=JSON.parse(starterStr); custom=false; }

// ---------- program week / block ----------
var startStr=ls.get('pr-start'); if(!startStr){ startStr=monStr; ls.set('pr-start',startStr); }
var startMon=mondayOf(parseYmd(startStr));
function weekNo(m){return Math.max(1,weeksBetween(startMon,m)+1)}
var week=weekNo(mon);
var blockIdx=Math.floor((week-1)/BLOCK_WEEKS)%plan.blocks.length;
var weekInBlock=((week-1)%BLOCK_WEEKS)+1;
var stageIdx=week<=2?0:week<=4?1:week<=6?2:3;
function block(){return plan.blocks[blockIdx]}
function days(){return block().days}
function shortName(s){return (days()[s].title||'').split(':')[0]}

// ---------- log + schedule ----------
var log=getJSON('pr-log',[]); if(!Array.isArray(log)) log=[];
function saveLog(){ log=log.filter(function(e){return parseYmd(e.d)>=addDays(today,-400)}); ls.set('pr-log',JSON.stringify(log)); }
function weekLog(m){var a=ymd(m),b=ymd(addDays(m,6));return log.filter(function(e){return e.d>=a&&e.d<=b})}
var wlog=weekLog(mon);
function doneEntry(s){return wlog.filter(function(e){return e.s===s})[0]}
function loggedOn(i){var d=ymd(dateOf(i));return wlog.filter(function(e){return e.d===d})}
var schedKey='pr-sched-'+monStr;
var sched=getJSON(schedKey,null);
if(!sched||!Array.isArray(sched.at)||sched.at.length!==4) sched={at:DEFAULT_DAYS.slice(),moves:0};
function saveSched(){ ls.set(schedKey,JSON.stringify(sched)); }
try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i); if(k&&k.indexOf('pr-sched-')===0&&k<'pr-sched-'+ymd(addDays(mon,-56))) localStorage.removeItem(k)}}catch(e){}

// gym day per weekday for a schedule: logged sessions in the past/today, planned undone ones from today on
function gymDays(at){
 var g=[null,null,null,null,null,null,null];
 for(var i=0;i<7;i++){ var l=loggedOn(i); if(l.length) g[i]=l[0].s; }
 for(var s=0;s<4;s++){ if(doneEntry(s)) continue; var d=at[s]; if(d>=todayIdx&&g[d]==null) g[d]=s; }
 return g;
}
function violations(g){
 var v=[];
 for(var i=0;i<5;i++) if(g[i]!=null&&g[i+1]!=null&&g[i+2]!=null) v.push({days:[i,i+1,i+2],why:'that makes 3 training days in a row'});
 for(var j=0;j<6;j++) if(g[j]!=null&&g[j+1]!=null&&LOWER[g[j]]&&LOWER[g[j+1]]) v.push({days:[j,j+1],why:'Lower A and Lower B would be back to back'});
 return v;
}
function moveCheck(s,t){
 if(doneEntry(s)) return {ok:false,why:'already done'};
 if(sched.moves>=MAX_MOVES) return {ok:false,why:'no moves left this week'};
 var from=sched.at[s];
 if(t===from) return {ok:false,why:'already there'};
 if(t<todayIdx) return {ok:false,why:'that day has passed'};
 if(loggedOn(t).length) return {ok:false,why:'you already trained that day'};
 var at=sched.at.slice(), other=-1;
 for(var o=0;o<4;o++) if(o!==s&&at[o]===t&&!doneEntry(o)) other=o;
 if(other>=0){ if(from<todayIdx) return {ok:false,why:shortName(other)+' is planned then'}; at[other]=from; }
 at[s]=t;
 var before=gymDays(sched.at), after=gymDays(at), changed={};
 for(var i=0;i<7;i++) if(before[i]!==after[i]) changed[i]=true;
 var bad=violations(after).filter(function(v){return v.days.some(function(d){return changed[d]})})[0];
 if(bad) return {ok:false,why:(other>=0&&bad.days.indexOf(t)<0?'swap puts '+shortName(other)+' on '+WD[from]+': ':'')+bad.why};
 return {ok:true,at:at,swap:other};
}
function cellState(i){
 var l=loggedOn(i); if(l.length) return {s:l[0].s,st:l[0].t==='min'?'min':'done'};
 for(var s=0;s<4;s++) if(sched.at[s]===i&&!doneEntry(s)) return {s:s,st:i<todayIdx?'missed':i===todayIdx?'today':'planned'};
 return {s:null,st:i===todayIdx?'resttoday':'rest'};
}

// ---------- ticks (per day) ----------
var todayKey='pr-ticks-'+todayStr;
try{for(var i2=localStorage.length-1;i2>=0;i2--){var k2=localStorage.key(i2); if(k2&&k2.indexOf('pr-ticks-')===0&&k2!==todayKey) localStorage.removeItem(k2)}}catch(e){}
var ticks=getJSON(todayKey,{})||{};
function saveTicks(){ls.set(todayKey,JSON.stringify(ticks))}

// ---------- ui state ----------
var S={day:null,edit:false,editing:null,adding:null,confirmDel:null,confirmReset:false,moving:false,msg:'',err:'',restoreOpen:false};
function pickDay(){
 for(var s=0;s<4;s++) if(sched.at[s]===todayIdx&&!doneEntry(s)) return String(s);
 var l=loggedOn(todayIdx); if(l.length) return String(l[0].s);
 var want=ls.get('pr-day'); if(want==='guide'||/^[0-3]$/.test(want||'')) return want;
 return '0';
}
S.day=pickDay();

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return 'x'+Math.random().toString(36).slice(2,9)}
function nsets(it){var n=parseInt(it.sets,10); if(!(n>0)) n=1; return Math.min(n,12)}
function videoUrl(it){ if(it.video) return it.video; return 'https://www.youtube.com/results?search_query='+encodeURIComponent((it.q||it.name)+' exercise form'); }
function curSlot(){return /^[0-3]$/.test(S.day)?+S.day:null}
function findItem(id){var r=null; plan.blocks.forEach(function(bl){bl.days.forEach(function(d){d.sections.forEach(function(s){s.items.forEach(function(it,ix){if(it.id===id) r={day:d,sec:s,item:it,ix:ix}})})})}); return r}
var toastT=null;
function toast(t){var el=document.getElementById('toast'); if(!el) return; el.textContent=t; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){el.hidden=true},2000);}
function changed(){
 var str=JSON.stringify(plan);
 if(str===starterStr){ ls.del('pr-plan'); custom=false; toast('Saved on this phone'); return; }
 if(ls.set('pr-plan',str)){ custom=true; toast('Saved on this phone'); }
 else { S.msg='This browser won’t let the app save. Your change works until you close it. Use Backup to keep a copy.'; }
}
var PLAY='<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';

// ---------- streak ----------
function streak(){
 var n=0, m=addDays(mon,-7);
 var cur=new Set(wlog.map(function(e){return e.s})).size;
 while(m>=startMon){ var c=new Set(weekLog(m).map(function(e){return e.s})).size; if(c>=TARGET) n++; else break; m=addDays(m,-7); }
 return n+(cur>=TARGET?1:0);
}

// ---------- rendering ----------
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
 var h='<li class="ex'+(done===n?' done':'')+'"><div class="ex-main"><div class="ex-name">'+esc(it.name)+'</div><div class="ex-rx">'+rx+'</div>'+(it.note?'<div class="ex-note">'+esc(it.note)+'</div>':'')+'</div>'+
  '<a class="watch" href="'+esc(videoUrl(it))+'" target="_blank" rel="noopener">'+PLAY+(it.video?'My video':'Watch')+'</a>'+
  '<div class="sets">'+b+'</div>';
 if(S.edit){
  if(S.editing===it.id){ h+=itemForm(it,sec.id); }
  else { h+='<div class="tools"><button class="btn" data-act="edit" data-id="'+it.id+'">Edit</button><button class="btn" data-act="up" data-id="'+it.id+'">Move up</button><button class="btn" data-act="down" data-id="'+it.id+'">Move down</button>'+
   (S.confirmDel===it.id?'<button class="btn danger" data-act="delyes" data-id="'+it.id+'">Tap again to remove</button>':'<button class="btn danger" data-act="del" data-id="'+it.id+'">Remove</button>')+'</div>'; }
 }
 return h+'</li>';
}
function weekStrip(){
 var h='<div class="wk" role="list">';
 for(var i=0;i<7;i++){ var c=cellState(i), lab=c.s!=null?shortName(c.s):'Rest';
  var mark={done:'✓',min:'½',missed:'✕',today:'',planned:'',rest:'',resttoday:''}[c.st];
  h+='<button class="wk-c st-'+c.st+(i===todayIdx?' is-today':'')+'" role="listitem" '+(c.s!=null?'data-act="day" data-id="'+c.s+'"':'disabled')+'><b>'+WD[i]+'</b><span>'+esc(lab)+'</span><i>'+mark+'</i></button>'; }
 return h+'</div>';
}
function weekStatus(){
 var done=new Set(wlog.map(function(e){return e.s})).size, mins=wlog.filter(function(e){return e.t==='min'}).length;
 var left=TARGET-done, avail=0; for(var i=todayIdx;i<7;i++) if(!loggedOn(i).length) avail++;
 var h='<div class="status"><span><b>Week '+week+'</b> · '+esc(block().name)+', week '+weekInBlock+' of '+BLOCK_WEEKS+'</span><span><b>'+done+' of '+TARGET+'</b> done'+(mins?' ('+mins+' minimum)':'')+'</span><span>Moves left: <b>'+Math.max(0,MAX_MOVES-sched.moves)+'</b></span>';
 var st=streak(); if(st>0) h+='<span>On target <b>'+st+'</b> week'+(st>1?'s':'')+' in a row</span>';
 h+='</div>';
 var y=todayIdx>0?cellState(todayIdx-1):null;
 if(y&&y.st==='missed'&&!loggedOn(todayIdx).length) h+='<div class="nag">You missed '+esc(shortName(y.s))+' yesterday. Never miss twice: train today, even if it’s only the minimum session. Or move it to a later day.</div>';
 else if(left>0&&left>avail) h+='<div class="nag">'+left+' workouts left and only '+avail+' day'+(avail===1?'':'s')+' this week. Do what you can. A minimum session still counts.</div>';
 if(weekInBlock===BLOCK_WEEKS) h+='<div class="note-b">Last week of '+esc(block().name)+'. New exercises start next Monday.</div>';
 return h;
}
function dayBanner(s){
 var de=doneEntry(s), at=sched.at[s], c=cellState(at), h='';
 if(de){
  h+='<div class="banner ok">Done on '+WDL[(parseYmd(de.d).getDay()+6)%7]+(de.t==='min'?' (minimum session)':'')+'. '+(de.d===todayStr?'<button class="btn small" data-act="undo">Undo</button>':'')+'</div>';
  return h;
 }
 if(c.st==='today') h+='<div class="banner today"><b>Today’s workout.</b> Sore or no energy? You have options below.</div>';
 else if(c.st==='missed') h+='<div class="banner miss">Planned for '+WDL[at]+' and missed. Move it to a later day this week.</div>';
 else h+='<div class="banner">Planned for <b>'+WDL[at]+'</b>.</div>';
 h+='<div class="opts">';
 if(c.st==='today') h+= ticks['__min'+s] ? '<button class="btn" data-act="full">Back to the full workout</button>' : '<button class="btn" data-act="min">Low energy: minimum session</button>';
 h+='<button class="btn'+(S.moving?' on':'')+'" data-act="moveopen">Move this workout</button></div>';
 if(S.moving){
  h+='<div class="move"><p>Move '+esc(shortName(s))+' to… <span class="muted">('+Math.max(0,MAX_MOVES-sched.moves)+' of '+MAX_MOVES+' moves left this week)</span></p>';
  for(var t=0;t<7;t++){ if(t===at) continue; var r=moveCheck(s,t);
   h+='<button class="mv'+(r.ok?'':' no')+'" '+(r.ok?'data-act="moveto" data-t="'+t+'"':'disabled')+'><b>'+WDL[t]+'</b><span>'+(r.ok?(r.swap>=0?'swaps with '+esc(shortName(r.swap)):'free day'):esc(r.why))+'</span></button>'; }
  h+='</div>';
 }
 return h;
}
function stageBanner(s){
 if(!block().progressive||!plan.buildup||!plan.buildup[stageIdx]) return '';
 var row=plan.buildup[stageIdx], txt=row[STAGE_KEYS[s]];
 return txt?'<div class="stage"><b>This week (weeks '+esc(row.weeks)+' stage):</b> '+esc(txt)+'</div>':'';
}
function dayHtml(s){
 var d=days()[s], minMode=!!ticks['__min'+s], de=doneEntry(s);
 var secs=d.sections.filter(function(x){return !minMode||x.kind==='cond'||x.kind==='warm'||x.kind==='core'});
 var total=0,mins=0,done=0;
 secs.forEach(function(x){mins+=(+x.minutes||0); x.items.forEach(function(it){var n=nsets(it); total+=n; var t=ticks[it.id]||[]; for(var i=0;i<n;i++) if(t[i]) done++;})});
 var h='<div class="dayhead">';
 if(S.edit){ h+='<div class="dayedit"><label class="full">Title<input id="dd-title" value="'+esc(d.title)+'"></label><label class="full">Focus<input id="dd-focus" value="'+esc(d.focus)+'"></label></div>'; }
 else { h+='<h2>'+esc(d.title)+'</h2><p>'+esc(d.focus)+'</p>'; }
 h+='<div class="meta"><span><b>~'+Math.round(mins/5)*5+' min</b>'+(minMode?' minimum session':' total')+'</span><span><b>'+done+'</b> of '+total+' sets ticked today</span>'+(done>0?'<button class="btn small" data-act="clearticks">Clear ticks</button>':'')+'</div>';
 h+='<div class="bar"><i style="width:'+(total?Math.round(done/total*100):0)+'%"></i></div></div>';
 if(!S.edit) h+=dayBanner(s);
 if(minMode&&!de) h+='<div class="banner today">Minimum session: conditioning, hip prep and core only. Strength and cool-down are skipped today.</div>';
 secs.forEach(function(x){
  h+='<section class="sec k-'+esc(x.kind)+'"><div class="sec-h"><h3>'+esc(x.title||KINDS[x.kind]||'')+'</h3><span>'+(x.minutes?esc(x.minutes)+' min':'')+'</span></div>'+(x.note?'<p class="sec-note">'+esc(x.note)+'</p>':'')+(x.kind==='cond'?stageBanner(s):'')+'<ul class="ex-list">';
  x.items.forEach(function(it){h+=exHtml(it,x)});
  h+='</ul>';
  if(S.edit){ h+= (S.adding===x.id? itemForm(null,x.id) : '<button class="add" data-act="add" data-sec="'+x.id+'">+ Add exercise to '+esc(x.title||KINDS[x.kind])+'</button>'); }
  h+='</section>';
 });
 if(!S.edit&&!de){
  var c=cellState(sched.at[s]);
  if(c.st==='today') h+='<button class="finish" data-act="finish">'+(minMode?'Finish minimum session':'Finish workout')+'</button><p class="sec-note center">Tap when you’re done, even if you skipped a few sets.</p>';
  else h+='<p class="sec-note center">To do this workout today, use <b>Move this workout</b> at the top.</p>';
 }
 return h;
}
function guideHtml(){
 var h='<div class="guide"><div class="dayhead"><h2>How it works</h2><p>4 gym days of 1.5-2 hours. Every day: conditioning, hip prep, strength, core and obliques, cool-down. New exercises every '+BLOCK_WEEKS+' weeks: Block 1, Block 2, then back to Block 1 to beat your old numbers.</p></div>';
 var nextBlock=addDays(startMon,Math.ceil(week/BLOCK_WEEKS)*BLOCK_WEEKS*7);
 h+='<h3>Your program</h3><div class="callout">You’re in <b>week '+week+'</b>, '+esc(block().name)+'. Next block starts <b>Monday '+nice(nextBlock)+'</b>.<label class="startlab" for="g-start">Program start (a Monday)<input type="date" id="g-start" value="'+ymd(startMon)+'"></label></div>';
 h+='<h3>Discipline rules</h3><ol>'+(plan.discipline||[]).map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ol>';
 h+='<h3>Default week</h3><div class="week">'+(plan.week||[]).map(function(w){return '<div><b>'+esc(w.day)+'</b><span>'+esc(w.what)+'</span></div>'}).join('')+'</div>';
 if(plan.buildup&&plan.buildup.length){
  h+='<h3>Block 1 conditioning build-up</h3><p class="sec-note">The app shows the right stage on each day. Only move up when the stage felt easy and the hip was quiet the next day; otherwise repeat it.</p><div class="bu-wrap"><table class="bu"><thead><tr><th>Weeks</th><th>Mon · rower</th><th>Tue · treadmill</th><th>Thu · rope</th><th>Sat · 15/15</th></tr></thead><tbody>'+
   plan.buildup.map(function(r,i){return '<tr'+(i===stageIdx&&block().progressive?' class="cur"':'')+'><th>'+esc(r.weeks)+'</th><td>'+esc(r.mon||'')+'</td><td>'+esc(r.tue)+'</td><td>'+esc(r.thu)+'</td><td>'+esc(r.sat)+'</td></tr>'}).join('')+'</tbody></table></div>';
 }
 h+='<h3>Hip rules</h3><ol>'+(plan.rules||[]).map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ol>';
 h+='<h3>Getting lean and stronger</h3><ul>'+(plan.fuel||[]).map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ul>';
 h+='<h3>Backup and restore</h3><p class="sec-note">Your edits, finished workouts and start date live only on this phone. Make a backup now and then.</p>';
 h+='<div class="bk"><button class="btn" data-act="download">Download backup file</button><button class="btn" data-act="copy">Copy backup text</button><button class="btn" data-act="restoreopen">Restore…</button></div>';
 if(S.restoreOpen){
  h+='<div class="restore"><label for="r-file">Pick a backup file</label><input type="file" id="r-file" accept=".json,application/json,text/plain"><label for="r-text">or paste backup text</label><textarea id="r-text" rows="4" placeholder="{&quot;plan&quot;: …}"></textarea>'+
   (S.err?'<p class="err">'+esc(S.err)+'</p>':'')+'<div class="row"><button class="btn" data-act="restoreclose">Cancel</button><button class="btn primary" data-act="restoretext">Restore pasted text</button></div></div>';
 }
 h+='<div class="bk">'+(S.confirmReset?'<button class="btn danger" data-act="resetyes">Tap again: go back to the original exercises</button>':'<button class="btn danger" data-act="reset">Go back to the original exercises</button>')+'</div>';
 return h+'</div>';
}
function render(){
 var focusId=document.activeElement&&document.activeElement.id;
 var order=[0,1,2,3].sort(function(a,b){return sched.at[a]-sched.at[b]});
 var h='<header class="top"><div class="brand"><div><h1>Pitch Ready</h1><small>Week '+week+' · '+esc(block().name)+'</small></div>'+
  '<button class="btn'+(S.edit?' on':'')+'" data-act="toggleedit">'+(S.edit?'Done editing':'Edit plan')+'</button></div>';
 h+='<nav class="tabs" role="tablist">'+order.map(function(s){var de=doneEntry(s);return '<button class="tab'+(de?' tdone':'')+'" role="tab" data-act="day" data-id="'+s+'" aria-selected="'+(S.day===String(s))+'"><b>'+(de?'✓ ':'')+WD[sched.at[s]]+'</b><span>'+esc(shortName(s))+'</span></button>'}).join('')+
  '<button class="tab" role="tab" data-act="day" data-id="guide" aria-selected="'+(S.day==='guide')+'"><b>Guide</b><span>Rules, backup</span></button></nav></header>';
 if(S.msg) h+='<div class="msg" role="status">'+esc(S.msg)+'</div>';
 if(!S.edit) h+=weekStrip()+weekStatus();
 var s=curSlot();
 h+= s==null? guideHtml() : dayHtml(s);
 document.getElementById('app').innerHTML=h;
 if(focusId){var el=document.getElementById(focusId); if(el) el.focus();}
 else { var f=document.getElementById('f-name'); if(f&&(S.editing||S.adding)) f.focus(); }
}

// ---------- forms, backup ----------
function readForm(form){
 function v(id){var e=form.querySelector('#'+id); return e?e.value.trim():''}
 var it={name:v('f-name'),sets:v('f-sets')||'1',reps:v('f-reps'),rest:v('f-rest'),note:v('f-note'),q:v('f-q'),video:v('f-video')};
 if(!it.name) return {err:'Give the exercise a name.'};
 if(it.video&&!/^https:\/\//i.test(it.video)) return {err:'The video link has to start with https://'};
 var n=parseInt(it.sets,10); it.sets=(n>0)?n:1;
 if(!it.q) delete it.q; if(!it.video) delete it.video;
 return {it:it};
}
function backupText(){ return JSON.stringify({app:'pitch-ready',saved:todayStr,start:ymd(startMon),log:log,plan:plan},null,1); }
function restoreFrom(text){
 var raw; try{ raw=JSON.parse(text); }catch(e){ S.err='That isn’t a backup from this app. Copy the whole text, from the first { to the last }.'; render(); return; }
 var p=upgrade(JSON.parse(JSON.stringify(raw)));
 if(!p){ S.err='That text doesn’t contain a workout plan.'; render(); return; }
 if(Array.isArray(raw.log)){ log=raw.log; saveLog(); }
 if(raw.start){ ls.set('pr-start',raw.start); }
 plan=p; changed(); ls.set('pr-day','guide');
 location.reload();
}

// ---------- events ----------
document.addEventListener('click',function(ev){
 var b=ev.target.closest('[data-act]'); if(!b) return;
 var a=b.getAttribute('data-act'), id=b.getAttribute('data-id'), s=curSlot();
 if(a!=='delyes'&&a!=='del') S.confirmDel=null;
 if(a!=='reset'&&a!=='resetyes') S.confirmReset=false;
 if(a==='day'){ S.day=id; S.editing=null; S.adding=null; S.moving=false; S.msg=''; ls.set('pr-day',id); render(); window.scrollTo(0,0); return; }
 if(a==='tick'){ var i=+b.getAttribute('data-i'); var t=ticks[id]||[]; t[i]=!t[i]; ticks[id]=t; saveTicks(); render(); return; }
 if(a==='clearticks'){ days()[s].sections.forEach(function(x){x.items.forEach(function(it){delete ticks[it.id]})}); saveTicks(); render(); return; }
 if(a==='min'){ ticks['__min'+s]=true; saveTicks(); render(); return; }
 if(a==='full'){ delete ticks['__min'+s]; saveTicks(); render(); return; }
 if(a==='moveopen'){ S.moving=!S.moving; render(); return; }
 if(a==='moveto'){ var r=moveCheck(s,+b.getAttribute('data-t')); if(!r.ok) return; sched.at=r.at; sched.moves++; saveSched(); S.moving=false;
  toast(shortName(s)+' moved to '+WDL[r.at[s]]); render(); return; }
 if(a==='finish'){ if(doneEntry(s)) return; log.push({d:todayStr,s:s,b:blockIdx,t:ticks['__min'+s]?'min':'full'}); saveLog(); wlog=weekLog(mon);
  var n=new Set(wlog.map(function(e){return e.s})).size; toast(n>=TARGET?'4 of 4. Week done!':'Logged. '+n+' of '+TARGET+' this week.'); render(); window.scrollTo(0,0); return; }
 if(a==='undo'){ log=log.filter(function(e){return !(e.d===todayStr&&e.s===s)}); saveLog(); wlog=weekLog(mon); render(); return; }
 if(a==='toggleedit'){ S.edit=!S.edit; S.editing=null; S.adding=null; S.moving=false; S.err=''; if(S.day==='guide'&&S.edit) S.day='0'; render(); return; }
 if(a==='edit'){ S.editing=id; S.adding=null; S.err=''; render(); return; }
 if(a==='add'){ S.adding=b.getAttribute('data-sec'); S.editing=null; S.err=''; render(); return; }
 if(a==='cancel'){ S.editing=null; S.adding=null; S.err=''; render(); return; }
 if(a==='up'||a==='down'){ var f=findItem(id); if(!f) return; var j=f.ix+(a==='up'?-1:1); if(j<0||j>=f.sec.items.length) return; var arr=f.sec.items; var tmp=arr[j]; arr[j]=arr[f.ix]; arr[f.ix]=tmp; changed(); render(); return; }
 if(a==='del'){ S.confirmDel=id; render(); return; }
 if(a==='delyes'){ var g=findItem(id); if(g){ g.sec.items.splice(g.ix,1); delete ticks[id]; saveTicks(); } S.confirmDel=null; changed(); render(); return; }
 if(a==='download'){
  var blob=new Blob([backupText()],{type:'application/json'}); var url=URL.createObjectURL(blob); var aEl=document.createElement('a');
  aEl.href=url; aEl.download='pitch-ready-backup-'+todayStr+'.json'; document.body.appendChild(aEl); aEl.click(); aEl.remove(); setTimeout(function(){URL.revokeObjectURL(url)},2000);
  toast('Backup file saved to Downloads'); return; }
 if(a==='copy'){
  var txt=backupText();
  var fallback=function(){ S.restoreOpen=true; S.msg='Copy didn’t work automatically. The text is selected below: copy it and keep it in Notes or an email.'; render(); var ta=document.getElementById('r-text'); if(ta){ta.value=txt; ta.focus(); ta.select();} };
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast('Backup copied. Paste it into Notes or an email.')},fallback); } else fallback();
  return; }
 if(a==='restoreopen'){ S.restoreOpen=true; S.err=''; render(); return; }
 if(a==='restoreclose'){ S.restoreOpen=false; S.err=''; render(); return; }
 if(a==='restoretext'){ var ta=document.getElementById('r-text'); restoreFrom(ta?ta.value.trim():''); return; }
 if(a==='reset'){ S.confirmReset=true; render(); return; }
 if(a==='resetyes'){ plan=JSON.parse(starterStr); ls.del('pr-plan'); custom=false; S.confirmReset=false; S.msg='Back to the original exercises. Your finished workouts and start date are kept.'; render(); return; }
});
document.addEventListener('change',function(ev){
 var t=ev.target;
 if(t.id==='r-file'&&t.files&&t.files[0]){ var r=new FileReader(); r.onload=function(){ restoreFrom(String(r.result||'').trim()); }; r.readAsText(t.files[0]); return; }
 if(t.id==='g-start'&&t.value){ ls.set('pr-start',ymd(mondayOf(parseYmd(t.value)))); location.reload(); return; }
 var s=curSlot(); if(s==null) return; var d=days()[s];
 if(t.id==='dd-title'){ d.title=t.value.trim()||d.title; changed(); render(); }
 else if(t.id==='dd-focus'){ d.focus=t.value.trim(); changed(); render(); }
});
document.addEventListener('submit',function(ev){
 var form=ev.target; if(!form.matches('form.edit')) return; ev.preventDefault();
 var r=readForm(form); if(r.err){ S.err=r.err; render(); return; } S.err='';
 if(form.getAttribute('data-form')==='edit'){ var f=findItem(form.getAttribute('data-id')); if(f){ r.it.id=f.item.id; f.sec.items[f.ix]=r.it; } S.editing=null; }
 else { var secId=form.getAttribute('data-sec'); r.it.id=uid(); days().forEach(function(d){d.sections.forEach(function(x){if(x.id===secId) x.items.push(r.it)})}); S.adding=null; }
 changed(); render();
});
// a new day while the app stays open: reload so the week, block and ticks are right
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ var n=new Date(); if(ymd(n)!==todayStr) location.reload(); } });
render();
if('serviceWorker' in navigator){ window.addEventListener('load',function(){ navigator.serviceWorker.register('./sw.js').catch(function(){}); }); }
// for the in-browser checks
window.__pr={moveCheck:moveCheck,gymDays:gymDays,violations:violations,sched:function(){return sched},week:week,blockIdx:blockIdx};
})();
