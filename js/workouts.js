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
// Kai's layout: Mon easy run · Tue strength & mobility · Wed rest · Thu quality
// · Fri rest · Sat long run · Sun rest. Runs map to easy=Mon, quality=Thu,
// long=Sat via HM_RACE_BLOCK.runDays.
var TRAINING_TEMPLATE=[
  {day:'Mon',session:'run',label:'Easy run',sub:'Easy pace',run:false},
  {day:'Tue',session:'strength-a',label:'Strength & mobility',sub:'Knee-safe lower + mobility',run:false},
  {day:'Wed',session:'rest',label:'Rest',sub:'Recover',run:false},
  {day:'Thu',session:'run',label:'Quality run',sub:'Tempo / intervals',run:false},
  {day:'Fri',session:'rest',label:'Rest',sub:'Recover',run:false},
  {day:'Sat',session:'run',label:'Long run',sub:'Build the distance',run:false},
  {day:'Sun',session:'rest',label:'Rest',sub:'Recover',run:false}
];

// ── HALF MARATHON RACE BLOCK (13 Jul – 20 Sep 2026, sub-2:30) ────────────────
// Dated, week-aware plan seeded into STATE.trainingPlan.raceBlock via a guarded
// one-shot migration (__hmBlockSeeded) in init.js. runDays maps easy/quality/
// long to JS getDay() weekdays and is user-editable (addendum §2.3).
var HM_RACE_BLOCK={
  race:{name:'Half Marathon',date:'2026-09-20',goal:'Sub 2:30',goalPace:'7:06/km',
    strategy:'First 5k @ 7:15 · settle 7:05 · checkpoints: 10k by 1:11, 15k by 1:47'},
  paces:{easy:'7:45–8:15 /km',race:'7:00–7:10 /km',tempo:'6:45–7:00 /km',interval:'6:20–6:35 /km'},
  birthday:'2026-08-12',
  runDays:{easy:1,quality:4,long:6},
  weeks:[
    {n:1,start:'2026-07-13',phase:'base',easy:'5k easy',quality:'Tempo 4k — 1k easy · 2k @ 6:50–7:00 · 1k easy',long:'10k all easy'},
    {n:2,start:'2026-07-20',phase:'build',easy:'5k easy',quality:'Intervals — 1k WU · 5×800m @ 6:25–6:35, 90s walk rec · 1k CD',long:'12k easy'},
    {n:3,start:'2026-07-27',phase:'build',easy:'6k easy',quality:'Tempo 5k — 1k easy · 3k @ 6:50 · 1k easy',long:'13k easy'},
    {n:4,start:'2026-08-03',phase:'cutback',easy:'5k easy',quality:'Intervals — 1k WU · 4×1k @ 6:30, 2min walk rec · 1k CD',long:'11k easy — recovery week'},
    {n:5,start:'2026-08-10',phase:'build',easy:'6k easy',quality:'Tempo 6k — 1k easy · 4k @ 6:50–7:00 · 1k easy',long:'14k — last 3k @ race pace 7:06'},
    {n:6,start:'2026-08-17',phase:'build',easy:'6k easy',quality:'Intervals — 1k WU · 6×800m @ 6:25–6:35, 90s rec · 1k CD',long:'16k easy',fuel:true},
    {n:7,start:'2026-08-24',phase:'build',easy:'6k easy',quality:'7k session — 1k easy · 5k @ race pace 7:06 · 1k easy',long:'17k — last 4k @ race pace',fuel:true},
    {n:8,start:'2026-08-31',phase:'peak',easy:'6k easy',quality:'Tempo 6k — 1k easy · 4k @ 6:45–6:55 · 1k easy',long:'19k easy — the confidence builder',fuel:true},
    {n:9,start:'2026-09-07',phase:'taper',easy:'5k easy',quality:'5k — 1k easy · 3k @ race pace · 1k easy',long:'12k easy',fuel:true},
    {n:10,start:'2026-09-14',phase:'race week',easy:'4k easy (Tue)',quality:'3k — 2k easy + 4×30s strides @ race pace (Thu)',long:'RACE DAY — Sun 20 Sep 🏁',fuel:true}
  ]
};
function workoutDef(id){return id==='strength-a'?STRENGTH_A:id==='strength-b'?STRENGTH_B:null}

function getTrainingPlan(){
  if(!STATE.trainingPlan)STATE.trainingPlan={template:JSON.parse(JSON.stringify(TRAINING_TEMPLATE)),checks:{}};
  if(!STATE.trainingPlan.template)STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
  if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
  // Defensive backfill: ensure the dated race block is present (addendum §1).
  if(!STATE.trainingPlan.raceBlock&&typeof HM_RACE_BLOCK!=='undefined')STATE.trainingPlan.raceBlock=JSON.parse(JSON.stringify(HM_RACE_BLOCK));
  if(STATE.trainingPlan.raceBlock&&!STATE.trainingPlan.raceBlock.runDays)STATE.trainingPlan.raceBlock.runDays={easy:1,quality:4,long:6};
  return STATE.trainingPlan;
}

// Resolve which race-block week a date falls in (block start … race day, both
// inclusive). Returns {week,n,total,daysToRace,daysToBirthday} or null when the
// date is outside the block. Countdowns are always forward (never negative).
function resolveHmWeek(dateKey){
  var plan=getTrainingPlan();
  var block=plan.raceBlock;
  if(!block||!block.weeks||!block.weeks.length)return null;
  var key=dateKey||localDateKey(new Date());
  var weeks=block.weeks;
  if(key<weeks[0].start||key>block.race.date)return null;
  var wk=null;
  for(var i=0;i<weeks.length;i++){if(weeks[i].start<=key)wk=weeks[i];else break;}
  if(!wk)return null;
  function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}
  return {
    week:wk,n:wk.n,total:weeks.length,
    daysToRace:Math.max(0,daysBetween(key,block.race.date)),
    daysToBirthday:(block.birthday&&block.birthday>=key)?daysBetween(key,block.birthday):null
  };
}

// Today's planned session (Today card, Training page, bot mirror). Overlays the
// dated HM race block onto the weekly template when the date is in-block, else
// returns the plain template row unchanged. Extra fields (desc/detail/block/
// runType/fuelText/isRace) are additive so existing callers keep working.
// (addendum §2.1). Any change here MUST be mirrored in the backend _planner.js.
function todaysTrainingSession(dateKey){
  var d=dateKey?new Date(dateKey+'T12:00:00'):new Date();
  var key=dateKey||localDateKey(d);
  var dow=d.getDay();               // 0 Sun..6 Sat
  var plan=getTrainingPlan();
  var base=plan.template[(dow+6)%7]; // Mon=0..Sun=6
  var ctx=resolveHmWeek(key);
  if(!ctx)return base;
  var block=plan.raceBlock;
  var rd=block.runDays||{easy:1,quality:4,long:6};
  // Per-week overrides: if this week's runDays have been moved (e.g. quality
  // to Friday), apply that. Stored as raceBlock.weekOverrides[weekKey]={...}.
  var _wkKey=(typeof weekKey==='function')?weekKey(d):null;
  var _wkOver=(block.weekOverrides&&_wkKey&&block.weekOverrides[_wkKey])||null;
  if(_wkOver){rd={easy:_wkOver.easy!=null?_wkOver.easy:rd.easy,quality:_wkOver.quality!=null?_wkOver.quality:rd.quality,long:_wkOver.long!=null?_wkOver.long:rd.long}}
  var wk=ctx.week;
  var fuelText=wk.fuel?'practise fuelling: gel/sweets ~every 40min':'';
  var blockInfo={n:ctx.n,total:ctx.total,phase:wk.phase,daysToRace:ctx.daysToRace,daysToBirthday:ctx.daysToBirthday,fuel:!!wk.fuel,race:block.race};
  var runType=null;
  if(dow===rd.long)runType='long';
  else if(dow===rd.quality)runType='quality';
  else if(dow===rd.easy)runType='easy';
  var out={session:base.session,label:base.label,sub:base.sub,run:base.run,block:blockInfo,runType:runType,desc:'',detail:'',fuelText:'',isRace:(key===block.race.date)};
  if(out.isRace){
    out.session='run';out.label='RACE DAY';out.desc=wk.long;out.detail=block.paces.race;out.runType='long';out.run=false;out.raceStrategy=block.race.strategy;
    return out;
  }
  if(base.session==='strength-a'||base.session==='strength-b'){
    out.desc=base.label;
    if(runType==='easy'){out.run=true;out.easyRun=wk.easy;out.easyDetail=block.paces.easy;}
    return out;
  }
  if(runType==='long'){
    // Race week: the long-run slot the day before the race is a shakeout, not
    // a long run (the race itself is handled by the isRace branch above).
    if(blockInfo.phase==='race week'){
      out.session='run';out.label='Shakeout';out.desc='2k easy shakeout or rest — race tomorrow';out.detail=block.paces.easy;out.run=false;
      return out;
    }
    out.session='run';out.label='Long run';out.desc=wk.long;out.detail=block.paces.easy;out.fuelText=fuelText;out.run=false;
    return out;
  }
  if(runType==='quality'){
    out.session='run';out.label='Quality session';out.desc=wk.quality;out.detail=/interval/i.test(wk.quality)?block.paces.interval:block.paces.tempo;out.run=false;
    return out;
  }
  if(runType==='easy'){
    out.session='run';out.label='Easy run';out.desc=wk.easy;out.detail=block.paces.easy;out.run=false;
    return out;
  }
  out.session='rest';out.label='Rest';out.sub=base.sub||'Recover';
  return out;
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
      // Zero-guilt: past unlogged days are never flagged red or "missed".
      var statusClass='';
      if(items.length>0)statusClass='done';
      else if(isToday)statusClass='today';
      return '<div class="training-day '+statusClass+'">'
        +'<div class="training-day-name">'+dayLabels[i]+'</div>'
        +'<div class="training-day-plan">'+(planType||'—')+'</div>'
        +'<div class="training-day-logged">'+(items.length>0?items.map(function(x){return '✓ '+(x.type||x.name||'session')}).join('<br>'):'—')+'</div>'
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
  var raceBlock=(STATE.trainingPlan&&STATE.trainingPlan.raceBlock)||null;
  el.innerHTML=upcoming.map(function(e){
    var d=new Date(e.date);
    var daysAway=Math.ceil((d-now)/86400000);
    var urgency=daysAway<=14?'var(--accent-dark)':daysAway<=60?'var(--gold)':'var(--text2)';
    // Race-day strategy summary for the block's race event (addendum §6).
    var strategy=(raceBlock&&raceBlock.race&&e.date===raceBlock.race.date&&raceBlock.race.strategy)?raceBlock.race.strategy:'';
    return '<div class="training-event">'
      +'<div class="training-event-date"><div class="training-event-num">'+d.getDate()+'</div><div class="training-event-mon">'+d.toLocaleDateString('en-GB',{month:'short'}).toUpperCase()+'</div></div>'
      +'<div class="training-event-body"><div class="training-event-title">'+e.name+(raceBlock&&e.date===raceBlock.race.date?' · '+raceBlock.race.goal:'')+'</div>'
      +'<div class="training-event-sub" style="color:'+urgency+'">'+daysAway+' days away'+(e.note?' · '+e.note:'')+'</div>'
      +(strategy?'<div class="training-event-strategy">'+strategy+'</div>':'')+'</div>'
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

// Move a specific run type (easy/quality/long) to a different day for THIS
// WEEK ONLY. Stored as raceBlock.weekOverrides[weekKey]={...} so it doesn't
// touch the global mapping. Called from the training card "Move to…" modal.
function moveRunThisWeek(runType,toDow){
  var plan=getTrainingPlan();
  if(!plan.raceBlock)return;
  if(!plan.raceBlock.weekOverrides)plan.raceBlock.weekOverrides={};
  var wk=(typeof weekKey==='function')?weekKey(new Date()):null;
  if(!wk)return;
  if(!plan.raceBlock.weekOverrides[wk])plan.raceBlock.weekOverrides[wk]=JSON.parse(JSON.stringify(plan.raceBlock.runDays||{easy:1,quality:4,long:6}));
  plan.raceBlock.weekOverrides[wk][runType]=Number(toDow);
  saveState();
  if(typeof closeModal==='function')closeModal();
  if(typeof renderPlanner==='function')renderPlanner();
  var wp=document.getElementById('page-workout');
  if(typeof renderWorkout==='function'&&wp&&wp.classList.contains('active'))renderWorkout();
  if(typeof showCelebrationToast==='function')showCelebrationToast('Moved to '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][Number(toDow)],'🗓️');
}

// Persist a remap of the HM block run days (addendum §2.3). Values are JS
// getDay() weekday numbers (0 Sun..6 Sat).
function saveRunDays(){
  var plan=getTrainingPlan();
  if(!plan.raceBlock)return;
  var e=Number((document.getElementById('m-rd-easy')||{}).value);
  var q=Number((document.getElementById('m-rd-quality')||{}).value);
  var l=Number((document.getElementById('m-rd-long')||{}).value);
  plan.raceBlock.runDays={easy:e,quality:q,long:l};
  saveState();
  if(typeof closeModal==='function')closeModal();
  if(typeof renderPlanner==='function')renderPlanner();
  var wp=document.getElementById('page-workout');
  if(typeof renderWorkout==='function'&&wp&&wp.classList.contains('active'))renderWorkout();
  if(typeof showCelebrationToast==='function')showCelebrationToast('Run days updated','🗓️');
}

// AI "replan this week" — asks the backend to reshuffle the remaining runs
// across the days left this week (respecting rest-day spacing), then pre-fills
// the run-day dropdowns in the modal so the user can review and Save. Applies
// through the same runDays mechanism as the manual editor.
function aiReplanWeek(){
  var noteEl=document.getElementById('rd-replan-note');
  if(typeof NOTIF_API==='undefined'||!NOTIF_API){if(noteEl)noteEl.textContent='AI not available.';return}
  var ctx=(typeof resolveHmWeek==='function')?resolveHmWeek(localDateKey(new Date())):null;
  var wk=ctx?ctx.week:null;
  var order=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var todayIdx=(new Date().getDay()+6)%7; // Mon=0..Sun=6
  var remaining=order.slice(todayIdx);
  var sessions=[
    {key:'easy',desc:wk?wk.easy:'easy run'},
    {key:'quality',desc:wk?wk.quality:'quality session'},
    {key:'long',desc:wk?wk.long:'long run'}
  ];
  if(noteEl)noteEl.textContent='Thinking…';
  fetch(NOTIF_API+'/api/ai-narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replan:{today:order[todayIdx],remainingDays:remaining,sessions:sessions}})})
    .then(function(r){return r.json()}).then(function(d){
      var p=d&&d.replan;
      if(!p){if(noteEl)noteEl.textContent='Couldn\u2019t suggest a plan right now.';return}
      var nameToNum={Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};
      ['easy','quality','long'].forEach(function(k){
        if(p[k]!=null&&nameToNum[p[k]]!=null){var sel=document.getElementById('m-rd-'+k);if(sel)sel.value=String(nameToNum[p[k]])}
      });
      if(noteEl)noteEl.textContent=p.note?('💡 '+p.note+' — review and Save.'):'Suggestion ready — review and Save.';
    }).catch(function(){if(noteEl)noteEl.textContent='Couldn\u2019t reach AI.';});
}

// "Repeat this week" — shift the whole block's week starts forward by 7 days so
// a missed week is repeated rather than compressed (addendum §5.4). Zero-guilt:
// framed as repeating, never as falling behind.
function repeatHmWeek(){
  var plan=getTrainingPlan();
  var block=plan.raceBlock;
  if(!block||!block.weeks)return;
  block.weeks.forEach(function(w){
    var d=new Date(w.start+'T12:00:00');d.setDate(d.getDate()+7);
    w.start=localDateKey(d);
  });
  saveState();
  if(typeof renderPlanner==='function')renderPlanner();
  var wp=document.getElementById('page-workout');
  if(typeof renderWorkout==='function'&&wp&&wp.classList.contains('active'))renderWorkout();
  if(typeof showCelebrationToast==='function')showCelebrationToast('Week repeated — plan shifted a week','🔁');
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
  // Bloom glow-up (#2): a 7-point sparkline of the last 7 logged weights beneath
  // the current-weight number, in --accent. Omitted gracefully when <2 points.
  var last7=weights.slice(-7).map(function(w){return w.value});
  var weightSpark=(typeof sparklineSVG==='function')?sparklineSVG(last7,'var(--accent)'):'';
  el.innerHTML=
    '<div class="stat-card"><div class="stat-orb blue">⚖️</div><div class="card-label">Current</div><div class="stat-big">'+latest.value+'<span style="font-size:16px;color:var(--text2)"> kg</span></div>'+weightSpark+'<div class="stat-sub">'+fmtDate(latest.date)+'</div></div>'
    +'<div class="stat-card"><div class="stat-orb '+(delta<=0?'green':'accent')+'">📉</div><div class="card-label">Change</div><div class="stat-big">'+(delta>=0?'+':'')+delta.toFixed(1)+'<span style="font-size:16px;color:var(--text2)"> kg</span></div><div class="stat-sub">since start</div></div>'
    +'<div class="stat-card"><div class="stat-orb gold">🎯</div><div class="card-label">To goal</div><div class="stat-big">'+(toGoal>0?toGoal.toFixed(1):'✓')+'<span style="font-size:16px;color:var(--text2)"> kg</span></div><div class="stat-sub">goal: '+goalW+' kg</div></div>';
  // Render log
  var logEl=document.getElementById('training-weight-log');
  if(logEl){
    logEl.innerHTML=weights.slice().reverse().slice(0,10).map(function(w){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-weight:600">'+w.value+' kg</span><span style="font-size:12px;color:var(--text2)">'+fmtDate(w.date)+'</span></div>';
    }).join('');
  }
  // Chart — 7-entry rolling average is the primary truth; daily points sit
  // faint behind it (daily noise is the #1 discouragement trigger, §4.1). A
  // soft "steady range" band gives context, never judgement (§4.2): no reading
  // is ever flagged red for sitting above it.
  var ctx=document.getElementById('training-weight-chart');
  if(ctx&&typeof Chart!=='undefined'){
    if(ctx._ch)ctx._ch.destroy();
    var _cs=getComputedStyle(document.body);
    var _acc=(_cs.getPropertyValue('--accent')||'#9B7ED6').trim();
    var _tick=(_cs.getPropertyValue('--text2')||'#8F86A3').trim();
    var _labels=weights.map(function(w){return fmtDate(w.date)});
    var _vals=weights.map(function(w){return w.value});
    var _avg=_vals.map(function(_,i){var seg=_vals.slice(Math.max(0,i-6),i+1);return Math.round(seg.reduce(function(a,b){return a+b},0)/seg.length*10)/10;});
    // Guide band: 92.0kg at 13 Jul 2026, -0.5kg/week, ±0.75kg.
    var _bRef=new Date('2026-07-13T12:00:00'),_bStart=92.0,_bSlope=-0.5,_bHalf=0.75;
    function _bandC(dk){var wks=(new Date(dk+'T12:00:00')-_bRef)/(7*86400000);return _bStart+_bSlope*wks;}
    var _bHigh=weights.map(function(w){return Math.round((_bandC(w.date)+_bHalf)*10)/10;});
    var _bLow=weights.map(function(w){return Math.round((_bandC(w.date)-_bHalf)*10)/10;});
    ctx._ch=new Chart(ctx,{type:'line',data:{labels:_labels,datasets:[
      {label:'Steady range',data:_bHigh,borderColor:'transparent',backgroundColor:'rgba(155,126,214,0.10)',pointRadius:0,fill:'+1',tension:0.3},
      {label:'_bandlow',data:_bLow,borderColor:'transparent',backgroundColor:'transparent',pointRadius:0,fill:false,tension:0.3},
      {label:'Daily',data:_vals,borderColor:'rgba(155,126,214,0.28)',backgroundColor:'transparent',pointRadius:2,pointBackgroundColor:'rgba(155,126,214,0.4)',borderWidth:1,tension:0.3},
      {label:'7-day avg',data:_avg,borderColor:_acc,backgroundColor:'transparent',pointRadius:0,borderWidth:2.5,tension:0.3}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{filter:function(it){return it.text!=='_bandlow'},color:_tick,font:{size:10},boxWidth:10,padding:10}}},scales:{x:{ticks:{color:_tick,font:{size:10}}},y:{ticks:{color:_tick,font:{size:10},callback:function(v){return v+'kg'}}}}}});
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
  // Keep the Planner "Today's training" card (3.2) in sync when it's on-screen.
  if(typeof renderPlanner==='function')renderPlanner();
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
  if(typeof renderPlanner==='function')renderPlanner();
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
  if(typeof renderPlanner==='function')renderPlanner();
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
  var wdays=(typeof weekDays==='function')?weekDays(wk):null; // Sun-first date keys
  var todayIdx=(new Date().getDay()+6)%7;
  var sessionColors={
    'strength-a':{c:'var(--accent)',badge:'badge-fin',bg:'var(--accent-dim)'},
    'strength-b':{c:'var(--accent)',badge:'badge-fin',bg:'var(--accent-dim)'},
    'run':{c:'var(--mint)',badge:'badge-per',bg:'var(--mint-dim)'},
    'rest':{c:'var(--text3)',badge:'',bg:'var(--bg3)'}
  };
  // Block header — week/phase context + the one pain rule (addendum §5.5).
  var block=plan.raceBlock;
  var blockCtx=(typeof resolveHmWeek==='function')?resolveHmWeek(localDateKey(new Date())):null;
  var html='';
  if(block&&blockCtx){
    html+='<div class="train-plan-block-head">'
      +'<div class="train-plan-block-week">Week '+blockCtx.n+' of '+blockCtx.total+' · '+blockCtx.week.phase+'</div>'
      +'<div class="train-plan-block-race">'+block.race.goal+' · '+blockCtx.daysToRace+' days to race day</div>'
    +'</div>';
  }
  html+='<div class="train-plan-painrule">Any pain that changes your gait = stop and rest.</div>';
  html+='<div class="train-plan-list">';
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
    // Overlay this week's ACTUAL block session onto the run rows (and the easy
    // run that pairs with Tue strength) so the schedule shows the real plan,
    // not generic placeholders. Falls back to the template off-plan.
    var rowLabel=d.label;
    var rowSub=d.sub+(def?' · '+def.duration:'');
    if(block&&blockCtx&&wdays&&typeof todaysTrainingSession==='function'){
      var s=todaysTrainingSession(wdays[(i+1)%7]);
      if(s){
        if(d.session==='run'&&s.session==='run'){
          rowLabel=s.label;
          rowSub=(s.desc||d.sub)+(s.detail?' · '+s.detail:'');
        }else if((d.session==='strength-a'||d.session==='strength-b')&&s.easyRun){
          rowSub=d.sub+(def?' · '+def.duration:'')+' · then easy run: '+s.easyRun;
        }
      }
    }
    html+='<div class="train-plan-dayname">'+(dayNames[d.day]||d.day)+(isToday?' · Today':'')+'</div>';
    html+='<div class="train-plan-label">'+rowLabel+'</div>';
    html+='<div class="train-plan-sub">'+rowSub+'</div>';
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
      if(typeof renderPlanner==='function')renderPlanner();
    }
  }
}

