// HABITS — frequency-aware rendering (redesigned)
// ============================================================

var habitFilter='all';

var HABIT_CAT_META={
  fit:{label:'Fitness',color:'#9b87be',emoji:'💪'},
  fin:{label:'Finance',color:'#D4845A',emoji:'💸'},
  car:{label:'Career',color:'#C9973A',emoji:'💼'},
  per:{label:'Personal',color:'#6B9E7A',emoji:'🌿'}
};

var HABIT_ANCHORS={
  morning:{label:'Morning',emoji:'🌅',hours:[5,12]},
  midday:{label:'Midday',emoji:'☀️',hours:[12,17]},
  evening:{label:'Evening',emoji:'🌙',hours:[17,22]},
  anytime:{label:'Anytime',emoji:'✨',hours:[0,24]}
};

// Auto-suggest a time-of-day anchor based on the habit name
function autoSuggestAnchor(name){
  var n=(name||'').toLowerCase();
  if(/\b(am|morning|wake|breakfast)\b/.test(n))return 'morning';
  if(/\b(pm|evening|night|bed|sleep)\b/.test(n))return 'evening';
  if(/\b(lunch|midday|noon)\b/.test(n))return 'midday';
  return 'anytime';
}

// Which time slot are we in right now?
function currentTimeSlot(){
  var h=new Date().getHours();
  if(h>=5&&h<12)return 'morning';
  if(h>=12&&h<17)return 'midday';
  if(h>=17&&h<22)return 'evening';
  return 'night';  // late night/early morning — treat like evening for what's-next
}

// Should this habit show up as "due now" (frequency-aware)?
function isHabitDueToday(h){
  var f=(h.freq||'daily').toLowerCase();
  var todayKey=localDateKey(new Date());
  if(h.startDate&&todayKey<h.startDate)return false;
  if(h.logs&&h.logs[todayKey])return false;

  if(f==='daily')return true;

  if(/^\d+x\/week$/.test(f)||f==='weekly'){
    var target=f==='weekly'?1:Number(f.split('x')[0]);
    var today=new Date();today.setHours(0,0,0,0);
    var ws=new Date(today);ws.setDate(ws.getDate()-ws.getDay());
    var we=new Date(ws);we.setDate(we.getDate()+6);
    return habitCountInRange(h,ws,we)<target;
  }

  if(f==='monthly'){
    var ms=new Date();ms.setHours(0,0,0,0);ms.setDate(1);
    var me=new Date(ms);me.setMonth(me.getMonth()+1);me.setDate(0);
    return habitCountInRange(h,ms,me)<1;
  }

  if(f==='bi-monthly'){
    var today2=new Date();today2.setHours(0,0,0,0);
    var ps=new Date(today2);ps.setDate(ps.getDate()-13);
    return habitCountInRange(h,ps,today2)<1;
  }

  return true;
}

// Frequency-aware consistency score (% of eligible periods met in recent history)
function habitConsistency(h){
  var f=(h.freq||'daily').toLowerCase();
  var startKey=h.startDate||'';
  var today=new Date();today.setHours(0,0,0,0);

  if(f==='daily'){
    var eligible=0,done=0;
    for(var i=0;i<30;i++){
      var d=new Date(today);d.setDate(d.getDate()-i);
      var k=localDateKey(d);
      if(k<startKey)continue;
      eligible++;
      if(h.logs&&h.logs[k])done++;
    }
    return {pct:eligible>0?Math.round(done/eligible*100):0,done:done,total:eligible,unit:'day',window:30};
  }

  if(f==='weekly'||/^\d+x\/week$/.test(f)){
    var target=f==='weekly'?1:Number(f.split('x')[0]);
    var eligible=0,done=0;
    for(var i=0;i<5;i++){
      var ws=new Date(today);ws.setDate(ws.getDate()-ws.getDay()-i*7);
      var we=new Date(ws);we.setDate(we.getDate()+6);
      if(localDateKey(we)<startKey)continue;
      eligible++;
      var count=habitCountInRange(h,ws,we);
      if(count>=target)done++;
    }
    return {pct:eligible>0?Math.round(done/eligible*100):0,done:done,total:eligible,unit:'week',window:5};
  }

  if(f==='monthly'){
    var eligible2=0,done2=0;
    for(var i=0;i<6;i++){
      var ms=new Date(today.getFullYear(),today.getMonth()-i,1);
      var me=new Date(today.getFullYear(),today.getMonth()-i+1,0);
      if(localDateKey(me)<startKey)continue;
      eligible2++;
      if(habitCountInRange(h,ms,me)>=1)done2++;
    }
    return {pct:eligible2>0?Math.round(done2/eligible2*100):0,done:done2,total:eligible2,unit:'month',window:6};
  }

  if(f==='bi-monthly'){
    var eligible3=0,done3=0;
    for(var i=0;i<6;i++){
      var ps=new Date(today);ps.setDate(ps.getDate()-ps.getDay()-i*14);
      var pe=new Date(ps);pe.setDate(pe.getDate()+13);
      if(localDateKey(pe)<startKey)continue;
      eligible3++;
      if(habitCountInRange(h,ps,pe)>=1)done3++;
    }
    return {pct:eligible3>0?Math.round(done3/eligible3*100):0,done:done3,total:eligible3,unit:'fortnight',window:6};
  }

  return {pct:0,done:0,total:0,unit:'',window:0};
}

// Tone label + color for a consistency %
function consistencyTone(pct){
  if(pct>=80)return {label:'Strong',color:'var(--mint)'};
  if(pct>=50)return {label:'Building',color:'var(--gold)'};
  return {label:'Focus',color:'var(--accent-dark)'};
}

function renderHabits(){
  var todayKey=localDateKey(new Date());
  var wlEl=document.getElementById('habit-week-label');
  if(wlEl){
    var wkStart=new Date(activeWeek);
    var wkEnd=new Date(activeWeek);wkEnd.setDate(wkEnd.getDate()+6);
    wlEl.textContent=fmtDate(wkStart.toISOString())+' \u2013 '+fmtDate(wkEnd.toISOString());
  }

  // Filters
  var fEl=document.getElementById('habit-filters');
  if(fEl){
    var counts={all:STATE.habits.length};
    Object.keys(HABIT_CAT_META).forEach(function(k){counts[k]=STATE.habits.filter(function(h){return h.badge===k}).length});
    var btns=[{key:'all',label:'All',color:'var(--accent-dark)'}];
    Object.keys(HABIT_CAT_META).forEach(function(k){
      var m=HABIT_CAT_META[k];
      if(counts[k]>0)btns.push({key:k,label:m.emoji+' '+m.label,color:m.color});
    });
    fEl.innerHTML=btns.map(function(b){
      var active=habitFilter===b.key;
      return '<button class="habit-filter-btn'+(active?' active':'')+'" onclick="setHabitFilter(\''+b.key+'\')" style="'+(active?'background:'+b.color+';color:#fff;border-color:'+b.color:'')+'">'+b.label+' <span class="habit-filter-count">'+counts[b.key]+'</span></button>';
    }).join('');
  }

  var hgEl=document.getElementById('habits-grid');
  if(!hgEl)return;
  var habits=(STATE.habits||[]).filter(function(h){return habitFilter==='all'||h.badge===habitFilter});
  if(!habits.length){
    hgEl.innerHTML='<div class="empty" style="padding:40px 20px;text-align:center"><div style="font-size:36px;margin-bottom:10px">✅</div><div style="font-size:13px;color:var(--text2)">'+(habitFilter==='all'?'No habits yet. Tap + Add Habit to start.':'No habits in this category.')+'</div></div>';
    return;
  }

  hgEl.innerHTML=habits.map(function(h){return renderHabitCard(h,todayKey)}).join('');
}

function setHabitFilter(key){
  habitFilter=key;
  renderHabits();
}

function renderHabitCard(h,todayKey){
  var f=(h.freq||'daily').toLowerCase();
  var streak=habitStreak(h);
  var meta=HABIT_CAT_META[h.badge]||HABIT_CAT_META.per;
  var icon=h.icon||meta.emoji;
  var anchor=HABIT_ANCHORS[h.anchor||'anytime']||HABIT_ANCHORS.anytime;
  var consistency=habitConsistency(h);
  var tone=consistencyTone(consistency.pct);

  // Compute 30-day strip
  var stripDays=[];
  for(var i=29;i>=0;i--){
    var d=new Date();d.setDate(d.getDate()-i);
    var k=localDateKey(d);
    var status=habitDayStatus(h,k);
    stripDays.push({key:k,date:d,status:status,isToday:k===todayKey});
  }

  // Streak indicator (frequency-aware label)
  var streakUnit=f==='daily'?'day':f==='weekly'||/^\d+x\/week$/.test(f)?'wk':f==='monthly'?'mo':'fn';
  var streakStr='';
  if(streak>=30)streakStr='<span class="hb-streak-icon hot">💎</span><span class="hb-streak-num">'+streak+streakUnit+'</span>';
  else if(streak>=7)streakStr='<span class="hb-streak-icon hot">🔥</span><span class="hb-streak-num">'+streak+streakUnit+'</span>';
  else if(streak>=3)streakStr='<span class="hb-streak-icon">⚡</span><span class="hb-streak-num">'+streak+streakUnit+'</span>';
  else if(streak>0)streakStr='<span class="hb-streak-num quiet">'+streak+streakUnit+'</span>';

  // Today's tap target — clearer than "click the dot for today"
  var todayStatus=habitDayStatus(h,todayKey);
  var todayBtn='';
  if(todayStatus==='pre-start'){
    todayBtn='<span class="hb-today-tag">Not tracked yet</span>';
  }else if(todayStatus==='rest'){
    todayBtn='<span class="hb-today-tag">Rest day</span>';
  }else if(f==='monthly'||f==='bi-monthly'){
    var period=habitPeriodStatus(h,f);
    todayBtn='<button class="hb-today-btn'+(period.thisPeriod?' done':'')+'" onclick="toggleHabitToday(\''+h.id+'\')">'
      +(period.thisPeriod?'✓ Done this '+(f==='monthly'?'month':'fortnight'):'Log this '+(f==='monthly'?'month':'fortnight'))
      +'</button>';
  }else{
    var done_today=todayStatus==='done';
    todayBtn='<button class="hb-today-btn'+(done_today?' done':'')+'" onclick="toggleHabitToday(\''+h.id+'\')">'
      +(done_today?'✓ Done today':'Mark done')
      +'</button>';
  }

  var html='<div class="habit-card" style="border-left:3px solid '+meta.color+'">';
  html+='<div class="hb-head">';
  html+='<div class="hb-icon" style="background:'+meta.color+'18;color:'+meta.color+'">'+icon+'</div>';
  html+='<div class="hb-title-block">';
  html+='<div class="hb-title">'+escapeHtml(h.name)+'</div>';
  html+='<div class="hb-meta"><span class="hb-freq">'+h.freq+'</span><span class="hb-cat-dot" style="background:'+meta.color+'"></span><span class="hb-cat">'+meta.label+'</span><span class="hb-anchor">'+anchor.emoji+' '+anchor.label+'</span></div>';
  html+='</div>';
  if(streakStr)html+='<div class="hb-streak" title="'+streak+' '+streakUnit+' streak">'+streakStr+'</div>';
  html+='<button class="hb-edit" onclick="openModal(\'editHabit\',\''+h.id+'\')" title="Edit">✎</button>';
  html+='</div>';

  // Consistency hero — replaces streak as the headline
  html+='<div class="hb-consistency"><div class="hb-consistency-head"><span class="hb-consistency-pct" style="color:'+tone.color+'">'+consistency.pct+'%</span><span class="hb-consistency-tone" style="color:'+tone.color+'">'+tone.label+'</span><span class="hb-consistency-detail">'+consistency.done+'/'+consistency.total+' '+consistency.unit+(consistency.total===1?'':'s')+' · last '+consistency.window+'</span></div><div class="hb-consistency-bar"><div class="hb-consistency-fill" style="width:'+consistency.pct+'%;background:'+tone.color+'"></div></div></div>';

  // 30-day strip
  if(f==='monthly'||f==='bi-monthly'){
    var period=habitPeriodStatus(h,f);
    html+='<div class="hb-periods">'+period.lastPeriods.map(function(p){
      return '<div class="hb-period'+(p.done?' done':'')+'" title="'+p.label+(p.done?' — done':' — missed')+'"><span>'+p.label+'</span></div>';
    }).join('')+'</div>';
  }else{
    html+='<div class="hb-strip-wrap"><div class="hb-strip">'+stripDays.map(function(d){
      var cls='hb-strip-cell';
      if(d.status==='done')cls+=' done';
      else if(d.status==='rest')cls+=' rest';
      else if(d.status==='pre-start')cls+=' pre';
      else if(d.isToday)cls+=' today';
      var title=d.date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' — '+(d.status==='done'?'done (tap to remove)':d.status==='rest'?'not due':d.status==='pre-start'?'before tracking':'missed (tap to log)');
      return '<div class="'+cls+'" title="'+title+'" onclick="toggleHabit(\''+h.id+'\',\''+d.key+'\')"></div>';
    }).join('')+'</div><div class="hb-strip-hint">Tap any day to log or unlog · ← 30 days</div></div>';
  }

  // Footer just shows the action button
  html+='<div class="hb-foot"><div class="hb-foot-action" style="margin-left:auto">'+todayBtn+'</div></div>';

  html+='</div>';
  return html;
}

// For monthly / bi-monthly habits — returns status of current + last periods
function habitPeriodStatus(h,freq){
  var today=new Date();today.setHours(0,0,0,0);
  var lastPeriods=[];
  var thisPeriod=false;

  if(freq==='monthly'){
    for(var i=0;i<6;i++){
      var ms=new Date(today.getFullYear(),today.getMonth()-i,1);
      var me=new Date(today.getFullYear(),today.getMonth()-i+1,0);
      var count=habitCountInRange(h,ms,me);
      if(i===0)thisPeriod=count>=1;
      lastPeriods.unshift({done:count>=1,label:ms.toLocaleDateString('en-GB',{month:'short'})});
    }
  }else{  // bi-monthly
    for(var i=0;i<6;i++){
      var ps=new Date(today);ps.setDate(ps.getDate()-ps.getDay()-i*14);
      var pe=new Date(ps);pe.setDate(pe.getDate()+13);
      var count=habitCountInRange(h,ps,pe);
      if(i===0)thisPeriod=count>=1;
      lastPeriods.unshift({done:count>=1,label:fmtDate(ps.toISOString())});
    }
  }
  return {thisPeriod:thisPeriod,lastPeriods:lastPeriods};
}

function toggleHabitToday(hid){
  var today=localDateKey(new Date());
  toggleHabit(hid,today);
}

function autoTickHabit(namePattern,date){
  var d=date||localDateKey(new Date());
  var pat=namePattern.toLowerCase();
  (STATE.habits||[]).forEach(function(h){
    if(h.name.toLowerCase().indexOf(pat)!==-1&&!h.logs[d]){h.logs[d]=true}
  });
}

function toggleHabit(hid,day){
  var h=STATE.habits.find(function(x){return x.id===hid});
  if(!h)return;
  // Don't allow ticking before startDate
  if(h.startDate&&day<h.startDate)return;
  var wasDone=h.logs[day];
  h.logs[day]=!h.logs[day];
  saveState();
  renderHabits();
  // Cross-page sync
  if(/skincare/i.test(h.name)&&typeof renderSkincareToday==='function'){
    renderSkincareToday();
  }
  if(typeof renderDashboard==='function'&&document.getElementById('page-dashboard')&&document.getElementById('page-dashboard').classList.contains('active')){
    renderDashboard();
  }
  if(!wasDone&&h.logs[day]){
    var s=habitStreak(h);
    if(s===7){fireConfetti();showCelebrationToast(h.name+' — 7 '+((h.freq||'daily')==='daily'?'day':'period')+' streak!','🔥')}
    else if(s===14){fireConfetti({count:120});showCelebrationToast(h.name+' — 2 week streak!','⚡')}
    else if(s===21){fireConfetti({count:140});showCelebrationToast(h.name+' — 21 days! Habit formed!','💪')}
    else if(s===30){fireConfetti({count:180,duration:3500});showCelebrationToast(h.name+' — 30 day streak! Unstoppable!','🏆')}
    if(day===localDateKey(new Date())&&typeof checkAllDoneToday==='function')checkAllDoneToday();
  }
}

function changeWeek(dir){
  var parts=activeWeek.split('-');
  var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  d.setDate(d.getDate()+dir*7);
  activeWeek=localDateKey(d);
  renderHabits();
}

function deleteHabit(id){
  confirmDelete('Delete this habit?',function(){
    STATE.habits=STATE.habits.filter(function(h){return h.id!==id});
    saveState();renderHabits();
  });
}

function saveHabit(){
  var name=((document.getElementById('m-hname')||{}).value||'').trim();
  if(!name)return;
  var anchorVal=(document.getElementById('m-hanchor')||{}).value;
  STATE.habits.push({
    id:g(),
    name:name,
    freq:(document.getElementById('m-hfreq')||{}).value||'daily',
    badge:(document.getElementById('m-hbadge')||{}).value||'per',
    icon:(document.getElementById('m-hicon')||{}).value||'',
    note:(document.getElementById('m-hnote')||{}).value||'',
    anchor:anchorVal||autoSuggestAnchor(name),
    logs:{},
    startDate:localDateKey(new Date())
  });
  saveState();closeModal();renderHabits();
  if(typeof renderDashboard==='function'&&document.getElementById('page-dashboard')&&document.getElementById('page-dashboard').classList.contains('active')){
    renderDashboard();
  }
}

function updateHabit(id){
  var h=STATE.habits.find(function(x){return x.id===id});
  if(!h)return;
  h.name=((document.getElementById('m-hname')||{}).value||'').trim()||h.name;
  h.freq=(document.getElementById('m-hfreq')||{}).value||h.freq;
  h.badge=(document.getElementById('m-hbadge')||{}).value||h.badge;
  var ic=(document.getElementById('m-hicon')||{}).value;
  if(ic!==undefined)h.icon=ic;
  var note=(document.getElementById('m-hnote')||{}).value;
  if(note!==undefined)h.note=note;
  var anchor=(document.getElementById('m-hanchor')||{}).value;
  if(anchor)h.anchor=anchor;
  saveState();closeModal();renderHabits();
  if(typeof renderDashboard==='function'&&document.getElementById('page-dashboard')&&document.getElementById('page-dashboard').classList.contains('active')){
    renderDashboard();
  }
}
