var activeSessionId=null;
var runCharts={};

// Stub for legacy session viewing
function getBestPrevSet(){return null}

// ── HALF MARATHON TRAINING PLAN ─────────────────────────────────────────────
// Day 1 = Monday. Strength days pair with an easy recovery run (per NRC plan).
// Knee-friendly (isometric quad hold, single-leg work) and shin-aware (tib
// raises, eccentric calf raises). Upper day is machine-led with two row
// variations for upright running posture.
var STRENGTH_A={
  id:'strength-a',
  title:'Strength A — Lower Body & Running Focus',
  emoji:'🏋️',
  duration:'~55 min',
  warmup:'Glute bridges x15 · Banded lateral walks x15 each · Heel-to-toe walks 20m',
  note:'3 rounds · 60 sec rest between rounds. Finish with your recovery run.',
  exercises:[
    {name:'Hip Thrust',scheme:'3 x 12',note:'Main glute driver — load progressively'},
    {name:'Leg Press (full range)',scheme:'3 x 15',note:'Knee feeling good — full ROM, slow & controlled'},
    {name:'Spanish Squat / Wall Sit (isometric)',scheme:'3 x 30-45 sec',note:'Builds quad & knee tolerance'},
    {name:'Single-Leg RDL',scheme:'3 x 10 each',note:'DB in hand, 3 sec lower'},
    {name:'Eccentric Calf Raise (single leg)',scheme:'3 x 12 each',note:'3 sec down, push up on two legs'},
    {name:'Tibialis Raises',scheme:'3 x 20',note:'Heels on a step, raise toes — shin-splint insurance'},
    {name:'Dead Bug',scheme:'3 x 10 each side',note:'Lower back flat on the floor throughout'}
  ]
};
var STRENGTH_B={
  id:'strength-b',
  title:'Strength B — Upper Body & Core',
  emoji:'🏋️',
  duration:'~55 min',
  warmup:'Arm circles · Thoracic rotations · Inchworms x5',
  note:'3 rounds · 60 sec rest between rounds. Finish with your recovery run.',
  exercises:[
    {name:'Lat Pulldown (machine)',scheme:'3 x 10',note:'Upper back for upright running posture'},
    {name:'Seated Cable Row (machine)',scheme:'3 x 10',note:'Row #1 — squeeze shoulder blades, flat back'},
    {name:'Chest Press (machine)',scheme:'3 x 12',note:'Controlled, full range'},
    {name:'Chest-Supported / T-Bar Row',scheme:'3 x 10',note:'Row #2 — no lower-back load, pure upper back'},
    {name:'Shoulder Press (machine)',scheme:'3 x 10',note:'Arm drive matters over 21K'},
    {name:'Pallof Press (cable or band)',scheme:'3 x 12 each side',note:'Anti-rotation core stability'},
    {name:'Copenhagen Plank',scheme:'3 x 20 sec each',note:'Inner thigh & knee stability'},
    {name:'Plank',scheme:'3 x 40 sec',note:"Hips level, don't let them sag"}
  ]
};
// Weekly template — Mon→Sun. session: 'strength-a'|'strength-b'|'run'|'rest'.
var TRAINING_TEMPLATE=[
  {day:'Mon',session:'strength-b',label:'Strength B (Upper)',sub:'+ Recovery run',run:true},
  {day:'Tue',session:'run',label:'Speed Run',sub:'NRC speed session',run:false},
  {day:'Wed',session:'rest',label:'Rest',sub:'Recover',run:false},
  {day:'Thu',session:'strength-a',label:'Strength A (Lower)',sub:'+ Recovery run',run:true},
  {day:'Fri',session:'run',label:'Speed Run',sub:'NRC speed session',run:false},
  {day:'Sat',session:'rest',label:'Rest',sub:'Optional easy walk',run:false},
  {day:'Sun',session:'run',label:'Long Run',sub:'NRC long run',run:false}
];
function workoutDef(id){return id==='strength-a'?STRENGTH_A:id==='strength-b'?STRENGTH_B:null}

function getTrainingPlan(){
  if(!STATE.trainingPlan)STATE.trainingPlan={template:JSON.parse(JSON.stringify(TRAINING_TEMPLATE)),checks:{}};
  if(!STATE.trainingPlan.template)STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
  if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
  return STATE.trainingPlan;
}

// Today's planned session (for dashboard + bot). Returns the template row.
function todaysTrainingSession(dateKey){
  var d=dateKey?new Date(dateKey+'T12:00:00'):new Date();
  var dow=d.getDay(); // 0 Sun..6 Sat
  var idx=(dow+6)%7;  // map to Mon=0..Sun=6
  var plan=getTrainingPlan();
  return plan.template[idx];
}

// Default weekly plan (legacy — kept so old references don't break)
var DEFAULT_PLAN=[
  {day:'Mon',type:'Upper',title:'Upper body',sub:'Strength B'},
  {day:'Tue',type:'Run',title:'Speed run',sub:'NRC'},
  {day:'Wed',type:'Rest',title:'Recovery',sub:'Rest'},
  {day:'Thu',type:'Lower',title:'Lower body',sub:'Strength A'},
  {day:'Fri',type:'Run',title:'Speed run',sub:'NRC'},
  {day:'Sat',type:'Rest',title:'Recovery',sub:'Optional walk'},
  {day:'Sun',type:'Run',title:'Long run',sub:'NRC'}
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

  // Weekly target — count non-rest days from the training plan
  var plan=getTrainingPlan().template;
  var target=plan.filter(function(d){return d.session&&d.session!=='rest'}).length;

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
      var planType=pd?pd.label:'';
      var planSession=pd?pd.session:'';
      var statusClass='';
      if(items.length>0)statusClass='done';
      else if(isPast&&planSession!=='rest')statusClass='missed';
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

// ── Weekly training plan (half marathon) ──
// Renders the Mon→Sun template. Strength days expand to show the full exercise
// list with per-week checkboxes. Checks are keyed by ISO week so each week
// starts fresh but history is preserved.
function renderMyPlanSchedule(){
  var el=document.getElementById('myplan-schedule');if(!el)return;
  var plan=getTrainingPlan();
  var wk=weekKey(new Date());
  var todayIdx=(new Date().getDay()+6)%7;
  var sessionColors={
    'strength-a':{c:'var(--accent)',badge:'badge-fin',bg:'var(--accent-dim)'},
    'strength-b':{c:'var(--accent)',badge:'badge-fin',bg:'var(--accent-dim)'},
    'run':{c:'var(--mint)',badge:'badge-per',bg:'var(--mint-dim)'},
    'rest':{c:'var(--text3)',badge:'',bg:'var(--bg3)'}
  };
  var html='<div class="train-plan-list">';
  plan.template.forEach(function(d,i){
    var def=workoutDef(d.session);
    var cm=sessionColors[d.session]||sessionColors.rest;
    var isToday=i===todayIdx;
    var dayNames={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
    // Progress for strength days this week
    var progressBadge='';
    if(def){
      var checks=(plan.checks[wk]&&plan.checks[wk][d.session])||{};
      var doneCount=def.exercises.filter(function(ex,xi){return checks[xi]}).length;
      progressBadge='<span class="train-plan-progress">'+doneCount+'/'+def.exercises.length+'</span>';
    }
    html+='<div class="train-plan-day'+(isToday?' is-today':'')+'" style="border-left:4px solid '+cm.c+'">';
    html+='<div class="train-plan-head"'+(def?' onclick="toggleTrainDay(\''+d.session+'\')" style="cursor:pointer"':'')+'>';
    html+='<div class="train-plan-head-main">';
    html+='<div class="train-plan-dayname">'+(dayNames[d.day]||d.day)+(isToday?' · Today':'')+'</div>';
    html+='<div class="train-plan-label">'+d.label+'</div>';
    html+='<div class="train-plan-sub">'+d.sub+(def?' · '+def.duration:'')+'</div>';
    html+='</div>';
    html+='<div class="train-plan-head-right">'+progressBadge+(def?'<span class="train-plan-chevron" id="chev-'+d.session+'">▸</span>':'')+'</div>';
    html+='</div>';
    if(def){
      var checks2=(plan.checks[wk]&&plan.checks[wk][d.session])||{};
      html+='<div class="train-plan-body" id="trainbody-'+d.session+'">';
      html+='<div class="train-plan-warmup"><strong>Warm-up:</strong> '+def.warmup+'</div>';
      html+=def.exercises.map(function(ex,xi){
        var done=!!checks2[xi];
        return '<div class="train-ex'+(done?' done':'')+'" onclick="toggleTrainEx(\''+d.session+'\','+xi+')" role="button" tabindex="0" aria-label="Toggle '+ex.name.replace(/"/g,'')+'">'
          +'<div class="train-ex-tick">'+(done?'✓':'')+'</div>'
          +'<div class="train-ex-body">'
            +'<div class="train-ex-name">'+ex.name+'<span class="train-ex-scheme">'+ex.scheme+'</span></div>'
            +'<div class="train-ex-note">'+ex.note+'</div>'
          +'</div></div>';
      }).join('');
      html+='<div class="train-plan-foot">'+def.note+'</div>';
      html+='</div>';
    }
    html+='</div>';
  });
  html+='</div>';
  html+='<div class="train-plan-hint">Tap a strength day to see the full session. Tick exercises as you go — they reset each week.</div>';
  el.innerHTML=html;
}

function toggleTrainDay(sessionId){
  var body=document.getElementById('trainbody-'+sessionId);
  var chev=document.getElementById('chev-'+sessionId);
  if(!body)return;
  var open=body.classList.toggle('open');
  if(chev)chev.style.transform=open?'rotate(90deg)':'';
}

function toggleTrainEx(sessionId,exIdx){
  var plan=getTrainingPlan();
  var wk=weekKey(new Date());
  if(!plan.checks[wk])plan.checks[wk]={};
  if(!plan.checks[wk][sessionId])plan.checks[wk][sessionId]={};
  plan.checks[wk][sessionId][exIdx]=!plan.checks[wk][sessionId][exIdx];
  saveState();
  // Re-render but keep this day expanded
  renderMyPlanSchedule();
  var body=document.getElementById('trainbody-'+sessionId);
  var chev=document.getElementById('chev-'+sessionId);
  if(body){body.classList.add('open');if(chev)chev.style.transform='rotate(90deg)'}
  // If every exercise done, log the session + celebrate
  var def=workoutDef(sessionId);
  var checks=plan.checks[wk][sessionId]||{};
  var allDone=def&&def.exercises.every(function(ex,xi){return checks[xi]});
  if(allDone){
    var today=localDateKey(new Date());
    var typeLabel=sessionId==='strength-a'?'Lower':'Upper';
    var already=(STATE.workouts||[]).some(function(w){return w.date===today&&w.type===typeLabel});
    if(!already){
      if(!STATE.workouts)STATE.workouts=[];
      STATE.workouts.push({id:g(),date:today,type:typeLabel,name:def.title,note:'Plan complete'});
      saveState();
      fireConfetti({count:120,duration:2600});
      showCelebrationToast(def.title.split('—')[0].trim()+' complete — logged!','💪');
      renderTrainingOverview();
    }
  }
}

