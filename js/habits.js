// HABITS — frequency-aware rendering
// ============================================================

function renderHabits(){
  var days=weekDays(activeWeek);
  var todayKey=localDateKey(new Date());
  var dl=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  var dhEl=document.getElementById('day-headers');
  if(dhEl)dhEl.innerHTML=days.map(function(d,i){
    return '<div style="width:28px;text-align:center"><div style="font-size:10px;color:var(--text3)">'+dl[i]+'</div><div style="font-size:11px;color:'+(d===todayKey?'var(--accent)':'var(--text3)')+'">'+new Date(d).getDate()+'</div></div>';
  }).join('');

  var wkStart=new Date(activeWeek);
  var wkEnd=new Date(activeWeek);wkEnd.setDate(wkEnd.getDate()+6);
  var wlEl=document.getElementById('habit-week-label');
  if(wlEl)wlEl.textContent=fmtDate(wkStart.toISOString())+' \u2013 '+fmtDate(wkEnd.toISOString());

  var hgEl=document.getElementById('habits-grid');
  if(!hgEl)return;
  hgEl.innerHTML=STATE.habits.map(function(h){
    return renderHabitRow(h,days,todayKey);
  }).join('');

  var soEl=document.getElementById('streak-overview');
  if(soEl)soEl.innerHTML=STATE.habits.map(function(h){return renderStreakRow(h)}).join('');
}

function renderHabitRow(h,days,todayKey){
  var f=(h.freq||'daily').toLowerCase();
  var streak=habitStreak(h);
  var wk=weekKey(new Date());
  var wpct=habitWeekPct(h,wk);

  // For monthly / bi-monthly, show a different view: current period status + last few periods
  if(f==='monthly'||f==='bi-monthly'){
    var done=habitPeriodStatus(h,f);
    return '<div class="habit-row">'
      +'<div style="width:170px;flex-shrink:0;display:flex;align-items:center;gap:4px">'
        +'<div style="flex:1;min-width:0"><div class="habit-name">'+h.name+'</div><div class="habit-freq">'+h.freq+'</div></div>'
        +'<button style="border:none;background:none;padding:2px;font-size:11px;color:var(--text3);cursor:pointer;flex-shrink:0" onclick="openModal(\'editHabit\',\''+h.id+'\')" title="Edit">\u270F\uFE0F</button>'
      +'</div>'
      +'<div style="flex:1;display:flex;align-items:center;gap:8px">'
        +'<button class="btn btn-sm '+(done.thisPeriod?'':'btn-accent')+'" onclick="toggleHabitToday(\''+h.id+'\')">'
          +(done.thisPeriod?'✓ Done this '+(f==='monthly'?'month':'fortnight'):'Log for this '+(f==='monthly'?'month':'fortnight'))
        +'</button>'
        +'<div style="display:flex;gap:3px">'+done.lastPeriods.map(function(p){
          return '<div class="period-dot'+(p.done?' done':'')+'" title="'+p.label+'"></div>';
        }).join('')+'</div>'
      +'</div>'
      +'<div class="streak-badge">'+(streak>0?'&#128293;'+streak:'')+'</div>'
    +'</div>';
  }

  // Default: weekly dot grid for daily / Nx/week / weekly
  var dayLetters=['S','M','T','W','T','F','S'];
  return '<div class="habit-row">'
    +'<div style="width:170px;flex-shrink:0;display:flex;align-items:center;gap:4px">'
      +'<div style="flex:1;min-width:0"><div class="habit-name">'+h.name+'</div><div class="habit-freq">'+h.freq+'</div></div>'
      +'<button style="border:none;background:none;padding:2px;font-size:11px;color:var(--text3);cursor:pointer;flex-shrink:0" onclick="openModal(\'editHabit\',\''+h.id+'\')" title="Edit">\u270F\uFE0F</button>'
    +'</div>'
    +'<div class="habit-dots" style="flex:1">'+days.map(function(d,i){
      var status=habitDayStatus(h,d);
      var isT=d===todayKey;
      var cls='dot';
      if(status==='done')cls+=' done';
      else if(status==='rest')cls+=' rest';
      else if(status==='pre-start')cls+=' pre-start';
      else if(isT)cls+=' today';
      var inner=status==='done'?'&#10003;':status==='pre-start'?'':dayLetters[i];
      return '<div class="'+cls+'" onclick="toggleHabit(\''+h.id+'\',\''+d+'\')" title="'+status+'">'+inner+'</div>';
    }).join('')+'</div>'
    +'<div class="streak-badge">'+(streak>0?'&#128293;'+streak:'')+'</div>'
  +'</div>';
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

function renderStreakRow(h){
  var f=(h.freq||'daily').toLowerCase();
  var s=habitStreak(h);
  var wp=habitWeekPct(h,weekKey(new Date()));
  var streakUnit=f==='daily'?'day':f==='monthly'?'month':f==='bi-monthly'?'fortnight':'week';
  var streakPlural=s===1?streakUnit:streakUnit+'s';
  return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">'
    +'<span style="flex:1;font-size:13px">'+h.name+'</span>'
    +'<span class="badge badge-'+h.badge+'">'+h.freq+'</span>'
    +'<span style="font-size:13px;color:'+(s>=7?'var(--accent)':s>=3?'var(--amber)':'var(--text2)')+'">'+(s>0?'&#128293; '+s+' '+streakPlural:'No streak')+'</span>'
    +(f==='daily'||/^\d+x\/week$/.test(f)||f==='weekly'?'<div class="pbar-wrap" style="width:60px;margin:0"><div class="pbar" style="width:'+wp+'%;background:'+pbarColor(wp)+'"></div></div><span style="font-size:12px;color:var(--text2);min-width:36px;text-align:right">'+wp+'%</span>':'<div style="width:100px"></div>')
    +'<button class="btn btn-sm btn-danger" onclick="deleteHabit(\''+h.id+'\')">&#215;</button>'
  +'</div>';
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
  var wasDone=h.logs[day];
  h.logs[day]=!h.logs[day];
  saveState();
  renderHabits();
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
  saveState();closeModal();renderHabits();
}
