var activeSessionId=null;
var runCharts={};

// Stub for legacy session viewing
function getBestPrevSet(){return null}

// Default weekly plan — editable and saved to STATE
var DEFAULT_PLAN=[
  {day:'Mon',type:'Hyrox',title:'Hyrox',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
  {day:'Tue',type:'Upper',title:'Upper body',sub:'Push · Pull · Shoulders',bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
  {day:'Wed',type:'Hyrox',title:'Hyrox',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
  {day:'Thu',type:'Lower',title:'Lower body',sub:'Glutes · Hams · Quads',bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
  {day:'Fri',type:'Hyrox',title:'Hyrox',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
  {day:'Sat',type:'Run',title:'Run',sub:'Your choice',bg:'var(--mint-dim)',br:'rgba(107,158,122,0.25)',c:'var(--mint)',badge:'badge-per'},
  {day:'Sun',type:'Rest',title:'Recovery',sub:'Rest or light walk',bg:'var(--bg3)',br:'var(--border)',c:'var(--text3)',badge:''}
];

function getWeeklyPlanData(){
  return STATE.weeklyPlan||DEFAULT_PLAN.map(function(d){return {day:d.day,type:d.type,title:d.title,sub:d.sub}});
}

function renderWorkout(){
  renderTrainingOverview();
  renderMyPlanSchedule();
  renderAllWorkouts();
}

function renderTrainingOverview(){
  var now=new Date();
  var wk=weekKey(now);
  var days=weekDays(wk);
  var todayKey=localDateKey(now);
  var sessions=STATE.workouts||[];
  var runs=((STATE.metrics||{}).run||[]);

  // Merge sessions + runs for this week
  var weekItems=sessions.filter(function(w){return days.indexOf(w.date)!==-1})
    .concat(runs.filter(function(r){return days.indexOf(r.date)!==-1}).map(function(r){return {type:'Run',date:r.date,isRun:true}}));
  var weekCount=weekItems.length;

  // Weekly target — count non-rest days from the plan
  var plan=getWeeklyPlanData();
  var target=plan.filter(function(d){return d.type&&d.type.toLowerCase()!=='rest'}).length;

  // Update header counters
  var cEl=document.getElementById('training-week-count');
  if(cEl)cEl.innerHTML=weekCount+'<span style="font-size:18px;color:var(--text2);font-weight:400"> / '+target+'</span>';
  var tEl=document.getElementById('training-week-target');
  if(tEl){
    var remaining=Math.max(0,target-weekCount);
    tEl.textContent=weekCount>=target?'Target hit — extra credit!':remaining+' more to hit your weekly target';
  }

  // Week day grid — show what's logged each day
  var gridEl=document.getElementById('training-week-grid');
  if(gridEl){
    var dayLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    gridEl.innerHTML='<div class="training-week-grid">'+days.map(function(d,i){
      var items=weekItems.filter(function(x){return x.date===d});
      var isToday=d===todayKey;
      var isPast=d<todayKey;
      var pd=plan[(i+6)%7];  // align to plan order (starts Mon)
      var planType=pd?pd.type:'';
      var statusClass='';
      if(items.length>0)statusClass='done';
      else if(isPast&&planType.toLowerCase()!=='rest')statusClass='missed';
      else if(isToday)statusClass='today';
      return '<div class="training-day '+statusClass+'">'
        +'<div class="training-day-name">'+dayLabels[i]+'</div>'
        +'<div class="training-day-plan">'+(planType||'—')+'</div>'
        +'<div class="training-day-logged">'+(items.length>0?items.map(function(x){return '✓ '+(x.type||x.name||'session')}).join('<br>'):(statusClass==='missed'?'missed':'—'))+'</div>'
        +'</div>';
    }).join('')+'</div>';
  }

  // Weekly streak — consecutive weeks hitting target
  var streak=0;
  for(var wi=0;wi<52;wi++){
    var checkDate=new Date(now);checkDate.setDate(checkDate.getDate()-wi*7);
    var checkWk=weekKey(checkDate);
    var checkDays=weekDays(checkWk);
    var checkCount=sessions.filter(function(w){return checkDays.indexOf(w.date)!==-1}).length
      +runs.filter(function(r){return checkDays.indexOf(r.date)!==-1}).length;
    if(checkCount>=target)streak++;
    else if(wi>0)break;  // allow current week to still be incomplete
  }
  var sEl=document.getElementById('training-streak');
  if(sEl)sEl.textContent=streak;
  var ssEl=document.getElementById('training-streak-sub');
  if(ssEl)ssEl.textContent=streak===0?'hit your target to start':'weeks hitting target';

  // This month breakdown
  var monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var monthSessions=sessions.filter(function(w){return w.date&&w.date.startsWith(monthKey)});
  var monthRuns=runs.filter(function(r){return r.date&&r.date.startsWith(monthKey)});
  var totalMonth=monthSessions.length+monthRuns.length;
  var mcEl=document.getElementById('training-month-count');
  if(mcEl)mcEl.textContent=totalMonth;
  var types={};
  monthSessions.forEach(function(w){var t=w.type||'Session';types[t]=(types[t]||0)+1});
  if(monthRuns.length)types['Run']=monthRuns.length;
  var breakdownStr=Object.keys(types).map(function(t){return types[t]+' '+t.toLowerCase()}).join(' · ')||'no sessions yet';
  var mbEl=document.getElementById('training-month-breakdown');
  if(mbEl)mbEl.textContent=breakdownStr;

  // Last session
  var allDated=sessions.concat(runs.map(function(r){return {type:'Run',date:r.date,note:r.distance+'km'}}));
  allDated.sort(function(a,b){return b.date.localeCompare(a.date)});
  var last=allDated[0];
  var lsEl=document.getElementById('training-last-session');
  if(lsEl)lsEl.textContent=last?(last.type||last.name||'Session'):'—';
  var lwEl=document.getElementById('training-last-when');
  if(lwEl){
    if(!last)lwEl.textContent='log your first';
    else{
      var dayDiff=Math.floor((now-new Date(last.date))/86400000);
      lwEl.textContent=dayDiff===0?'today':dayDiff===1?'yesterday':dayDiff+' days ago';
    }
  }

  // Events
  renderTrainingEvents();

  // Body stats
  renderTrainingBody();
}

function renderTrainingEvents(){
  var el=document.getElementById('training-events');
  if(!el)return;
  var events=STATE.trainingEvents||[];
  var now=new Date();
  var upcoming=events.filter(function(e){return new Date(e.date)>=now}).sort(function(a,b){return a.date.localeCompare(b.date)});
  if(!upcoming.length){
    el.innerHTML='<div class="empty-prompt-mini">No events scheduled. Add your Hyrox race, half marathon, or any target date.</div>';
    return;
  }
  el.innerHTML=upcoming.map(function(e){
    var d=new Date(e.date);
    var daysAway=Math.ceil((d-now)/86400000);
    var urgency=daysAway<=14?'var(--accent-dark)':daysAway<=60?'var(--gold)':'var(--text2)';
    return '<div class="training-event">'
      +'<div class="training-event-date"><div class="training-event-num">'+d.getDate()+'</div><div class="training-event-mon">'+d.toLocaleDateString('en-GB',{month:'short'}).toUpperCase()+'</div></div>'
      +'<div class="training-event-body"><div class="training-event-title">'+e.name+'</div>'
      +'<div class="training-event-sub" style="color:'+urgency+'">'+daysAway+' days away'+(e.note?' · '+e.note:'')+'</div></div>'
      +'<button class="btn-danger" onclick="deleteTrainingEvent(\''+e.id+'\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">×</button>'
      +'</div>';
  }).join('');
}

function deleteTrainingEvent(id){
  STATE.trainingEvents=(STATE.trainingEvents||[]).filter(function(e){return e.id!==id});
  saveState();renderTrainingOverview();
}

function saveTrainingEvent(){
  var name=((document.getElementById('m-event-name')||{}).value||'').trim();
  var date=((document.getElementById('m-event-date')||{}).value||'').trim();
  var note=((document.getElementById('m-event-note')||{}).value||'').trim();
  if(!name||!date)return;
  if(!STATE.trainingEvents)STATE.trainingEvents=[];
  STATE.trainingEvents.push({id:g(),name:name,date:date,note:note});
  saveState();closeModal();renderTrainingOverview();
}

function renderTrainingBody(){
  var el=document.getElementById('training-body-stats');
  if(!el)return;
  var weights=((STATE.metrics||{}).weight||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date)});
  if(!weights.length){
    el.innerHTML='<div class="empty-prompt-mini" style="grid-column:1/-1">No weight data yet. Log your first entry to see trends.</div>';
    return;
  }
  var latest=weights[weights.length-1];
  var first=weights[0];
  var delta=latest.value-first.value;
  var goalW=STATE.weightGoal||80;
  var toGoal=latest.value-goalW;
  el.innerHTML=
    '<div class="stat-card"><div class="stat-orb blue">⚖️</div><div class="card-label">Current</div><div class="stat-big">'+latest.value+'<span style="font-size:16px;color:var(--text2)"> kg</span></div><div class="stat-sub">'+fmtDate(latest.date)+'</div></div>'
    +'<div class="stat-card"><div class="stat-orb '+(delta<=0?'green':'accent')+'">📉</div><div class="card-label">Change</div><div class="stat-big">'+(delta>=0?'+':'')+delta.toFixed(1)+'<span style="font-size:16px;color:var(--text2)"> kg</span></div><div class="stat-sub">since start</div></div>'
    +'<div class="stat-card"><div class="stat-orb gold">🎯</div><div class="card-label">To goal</div><div class="stat-big">'+(toGoal>0?toGoal.toFixed(1):'✓')+'<span style="font-size:16px;color:var(--text2)"> kg</span></div><div class="stat-sub">goal: '+goalW+' kg</div></div>';
  // Render log
  var logEl=document.getElementById('training-weight-log');
  if(logEl){
    logEl.innerHTML=weights.slice().reverse().slice(0,10).map(function(w){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-weight:600">'+w.value+' kg</span><span style="font-size:12px;color:var(--text2)">'+fmtDate(w.date)+'</span></div>';
    }).join('');
  }
  // Chart
  var ctx=document.getElementById('training-weight-chart');
  if(ctx){
    if(ctx._ch)ctx._ch.destroy();
    ctx._ch=new Chart(ctx,{type:'line',data:{labels:weights.map(function(w){return fmtDate(w.date)}),datasets:[{data:weights.map(function(w){return w.value}),borderColor:'#D97B6C',backgroundColor:'rgba(217,123,108,0.08)',tension:0.3,pointRadius:3,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8A8278',font:{size:10}}},y:{ticks:{color:'#8A8278',font:{size:10},callback:function(v){return v+'kg'}}}}}});
  }
}

// Quick log today — one tap
function quickLogToday(type){
  var today=localDateKey(new Date());
  if(type==='Rest'){
    if(!STATE.workouts)STATE.workouts=[];
    STATE.workouts.push({id:g(),date:today,type:'Rest',name:'Rest day',note:''});
  }else if(type==='Run'){
    openModal('logRun');return;
  }else{
    if(!STATE.workouts)STATE.workouts=[];
    STATE.workouts.push({id:g(),date:today,type:type,name:type,note:''});
    autoTickHabit('gym',today);
  }
  saveState();renderWorkout();
  // First workout of the week = bigger celebration
  var wkStart=weekKey(new Date());
  var sessionsThisWeek=(STATE.workouts||[]).filter(function(s){return s.date>=wkStart&&s.type!=='Rest'});
  if(type!=='Rest'&&sessionsThisWeek.length===1){
    fireConfetti({count:80,duration:2200});
    showCelebrationToast(type+' logged — first session of the week!','💪');
  }else{
    showCelebrationToast(type+' logged','💪');
  }
}

function sessionCard(w){
  var typeLabel=w.type||w.name||'Session';
  return '<div class="workout-card"><div class="workout-header"><div style="flex:1"><div class="workout-title">'+typeLabel+'</div><div class="workout-meta">'+fmtDate(w.date)+(w.note?' · '+w.note:'')+'</div></div><div style="display:flex;gap:6px;align-items:center"><span class="badge badge-fit">'+typeLabel+'</span><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteWorkout(\''+w.id+'\')">&#215;</button></div></div></div>';
}

function deleteWorkout(id){
  confirmDelete('Delete this session?',function(){
    STATE.workouts=(STATE.workouts||[]).filter(function(w){return w.id!==id});
    saveState();renderWorkout();
  });
}

function renderAllWorkouts(){
  var el=document.getElementById('all-workouts');if(!el)return;
  var all=(STATE.workouts||[]).slice().reverse();
  if(!all.length){el.innerHTML='<div class="empty">No sessions yet</div>';return}
  var fEl=document.getElementById('muscle-filters');
  if(fEl){
    var types=['All'];
    all.forEach(function(w){var t=w.type||'Other';if(types.indexOf(t)===-1)types.push(t)});
    fEl.innerHTML=types.map(function(t,i){return '<button class="filter-btn'+(i===0?' active':'')+'" onclick="filterWorkouts(\''+t+'\',this)">'+t+'</button>'}).join('');
  }
  el.innerHTML=all.map(function(w){return sessionCard(w)}).join('');
}

function filterWorkouts(type,btn){
  document.querySelectorAll('#muscle-filters .filter-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  var el=document.getElementById('all-workouts');if(!el)return;
  var all=(STATE.workouts||[]).slice().reverse();
  var filtered=type==='All'?all:all.filter(function(w){return (w.type||'Other')===type});
  el.innerHTML=filtered.length?filtered.map(function(w){return sessionCard(w)}).join(''):'<div class="empty">No sessions for '+type+'</div>';
}

function saveQuickLog(){
  var type=(document.getElementById('m-qltype')||{}).value;
  if(!type)return;
  var date=(document.getElementById('m-qldate')||{}).value||localDateKey(new Date());
  var note=(document.getElementById('m-qlnote')||{}).value||'';
  if(!STATE.workouts)STATE.workouts=[];
  STATE.workouts.push({id:g(),date:date,type:type,name:type,note:note,muscleGroups:[type]});
  autoTickHabit('gym',date);
  saveState();closeModal();renderWorkout();
  showCelebrationToast(type+' session logged','💪');
}

function saveRunFromWorkout(){
  var dist=(document.getElementById('m-rundist')||{}).value;if(!dist)return;
  var date=(document.getElementById('m-rundate')||{}).value||localDateKey(new Date());
  var time=(document.getElementById('m-runtime')||{}).value||'';
  var note=(document.getElementById('m-runnote')||{}).value||'';
  if(!STATE.metrics)STATE.metrics={};if(!STATE.metrics.run)STATE.metrics.run=[];
  STATE.metrics.run.push({id:g(),date:date,distance:Number(dist),time:time,note:note});
  autoTickHabit('run',date);saveState();closeModal();renderWorkout();
  var distNum=Number(dist);
  if(distNum>=10){fireConfetti({count:110,duration:2600,colors:['#5A8FB0','#7CA5C2','#6b9e7a','#d4845a']});showCelebrationToast(distNum+'km run — beast mode.','🏃')}
  else if(distNum>=5){fireConfetti({count:70,duration:2000,colors:['#5A8FB0','#7CA5C2','#6b9e7a']});showCelebrationToast(distNum+'km logged — nice one.','🏃')}
  else{showCelebrationToast(distNum+'km run logged','🏃')}
}

function deleteRunFromWorkout(id){
  confirmDelete('Delete this run?',function(){
    if(!STATE.metrics||!STATE.metrics.run)return;
    STATE.metrics.run=STATE.metrics.run.filter(function(r){return r.id!==id});
    saveState();renderWorkout();
  });
}

// Editable weekly plan
function renderMyPlanSchedule(){
  var el=document.getElementById('myplan-schedule');if(!el)return;
  var plan=getWeeklyPlanData();
  var colorMap={
    'Upper':{bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
    'Lower':{bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
    'Gym':{bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
    'Hyrox':{bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
    'Run':{bg:'var(--mint-dim)',br:'rgba(107,158,122,0.25)',c:'var(--mint)',badge:'badge-per'},
    'Rest':{bg:'var(--bg3)',br:'var(--border)',c:'var(--text3)',badge:''},
    'Other':{bg:'var(--blue-dim)',br:'rgba(100,149,237,0.25)',c:'var(--blue)',badge:''}
  };
  el.innerHTML=plan.map(function(d,i){
    var cm=colorMap[d.type]||colorMap['Other'];
    return '<div style="background:'+cm.bg+';border:1px solid '+cm.br+';border-radius:var(--radius-sm);padding:10px 8px;min-height:110px;cursor:pointer" onclick="openModal(\'editPlanDay\','+i+')">'
      +'<div style="font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:'+cm.c+';margin-bottom:6px">'+d.day+'</div>'
      +'<span class="badge '+cm.badge+'" style="font-size:9px;padding:2px 7px;margin-bottom:6px;display:inline-block'+(cm.badge?'':';background:var(--bg4);color:var(--text3)')+'">'+d.type+'</span>'
      +'<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px">'+d.title+'</div>'
      +'<div style="font-size:10px;color:var(--text2)">'+d.sub+'</div></div>';
  }).join('');
}

function savePlanDay(){
  var idx=Number((document.getElementById('m-planidx')||{}).value);
  var type=(document.getElementById('m-plantype')||{}).value||'Rest';
  var title=(document.getElementById('m-plantitle')||{}).value||type;
  var sub=(document.getElementById('m-plansub')||{}).value||'';
  var plan=getWeeklyPlanData();
  plan[idx]={day:plan[idx].day,type:type,title:title,sub:sub};
  STATE.weeklyPlan=plan;
  saveState();closeModal();renderMyPlanSchedule();
}

