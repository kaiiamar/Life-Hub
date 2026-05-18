// HABITS — frequency-aware rendering (redesigned)
// ============================================================

var habitFilter='all';

var HABIT_CAT_META={
  fit:{label:'Fitness',color:'#9b87be',emoji:'💪'},
  fin:{label:'Finance',color:'#D4845A',emoji:'💸'},
  car:{label:'Career',color:'#C9973A',emoji:'💼'},
  per:{label:'Personal',color:'#6B9E7A',emoji:'🌿'}
};

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

  // Compute 30-day strip
  var stripDays=[];
  for(var i=29;i>=0;i--){
    var d=new Date();d.setDate(d.getDate()-i);
    var k=localDateKey(d);
    var status=habitDayStatus(h,k);
    stripDays.push({key:k,date:d,status:status,isToday:k===todayKey});
  }
  // Count this-month adherence (only days the habit was eligible)
  var eligible=stripDays.filter(function(d){return d.status==='done'||d.status==='todo'});
  var done=eligible.filter(function(d){return d.status==='done'}).length;
  var pct=eligible.length>0?Math.round((done/eligible.length)*100):0;

  // Streak indicator
  var streakStr='';
  if(streak>=30)streakStr='<span class="hb-streak-icon hot">💎</span><span class="hb-streak-num">'+streak+'</span>';
  else if(streak>=7)streakStr='<span class="hb-streak-icon hot">🔥</span><span class="hb-streak-num">'+streak+'</span>';
  else if(streak>=3)streakStr='<span class="hb-streak-icon">⚡</span><span class="hb-streak-num">'+streak+'</span>';
  else if(streak>0)streakStr='<span class="hb-streak-num quiet">'+streak+'</span>';

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
  html+='<div class="hb-meta"><span class="hb-freq">'+h.freq+'</span><span class="hb-cat-dot" style="background:'+meta.color+'"></span><span class="hb-cat">'+meta.label+'</span></div>';
  html+='</div>';
  html+='<div class="hb-streak">'+streakStr+'</div>';
  html+='<button class="hb-edit" onclick="openModal(\'editHabit\',\''+h.id+'\')" title="Edit">✎</button>';
  html+='</div>';

  // 30-day strip
  if(f==='monthly'||f==='bi-monthly'){
    // For monthly/bi-monthly show last 6 periods as wider chunks
    var period=habitPeriodStatus(h,f);
    html+='<div class="hb-periods">'+period.lastPeriods.map(function(p){
      return '<div class="hb-period'+(p.done?' done':'')+'" title="'+p.label+(p.done?' — done':' — missed')+'"><span>'+p.label+'</span></div>';
    }).join('')+'</div>';
  }else{
    html+='<div class="hb-strip">'+stripDays.map(function(d){
      var cls='hb-strip-cell';
      if(d.status==='done')cls+=' done';
      else if(d.status==='rest')cls+=' rest';
      else if(d.status==='pre-start')cls+=' pre';
      else if(d.isToday)cls+=' today';
      var title=d.date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' — '+(d.status==='done'?'done':d.status==='rest'?'not due':d.status==='pre-start'?'before tracking':'missed');
      return '<div class="'+cls+'" title="'+title+'" onclick="toggleHabit(\''+h.id+'\',\''+d.key+'\')"></div>';
    }).join('')+'</div>';
  }

  // Footer stats
  html+='<div class="hb-foot">';
  if(eligible.length>0){
    html+='<div class="hb-foot-stat"><span class="hb-foot-num">'+pct+'%</span><span class="hb-foot-lbl">last 30d</span></div>';
    html+='<div class="hb-foot-stat"><span class="hb-foot-num">'+done+'/'+eligible.length+'</span><span class="hb-foot-lbl">done</span></div>';
  }
  html+='<div class="hb-foot-action">'+todayBtn+'</div>';
  html+='</div>';

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
  STATE.habits.push({
    id:g(),
    name:name,
    freq:(document.getElementById('m-hfreq')||{}).value||'daily',
    badge:(document.getElementById('m-hbadge')||{}).value||'per',
    icon:(document.getElementById('m-hicon')||{}).value||'',
    note:(document.getElementById('m-hnote')||{}).value||'',
    logs:{},
    startDate:localDateKey(new Date())
  });
  saveState();closeModal();renderHabits();
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
  saveState();closeModal();renderHabits();
}
