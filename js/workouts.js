var activeSessionId=null;
var runCharts={};

// Stub for legacy session viewing
function getBestPrevSet(){return null}

// ── HALF MARATHON TRAINING PLAN ─────────────────────────────────────────────
// Day 1 = Monday. Strength days pair with an easy recovery run (per NRC plan).
// Knee-friendly (isometric quad hold, single-leg work) and shin-aware (tib
// raises, eccentric calf raises). Upper day is machine-led with two row
// variations for upright running posture.
// Tuesday — Legs. The physio's full rehab block: knee block (six) then the
// calf + PTT block. Sits four days clear of the long run. Progression is weight,
// never extra exercises.
var STRENGTH_A={
  id:'strength-a',
  title:'Gym — Legs (Knee + Calf Rehab)',
  emoji:'🦵',
  duration:'~55 min',
  warmup:'Glute bridges x15 · Banded lateral walks x15 each · Heel-to-toe walks 20m',
  note:'Add weight when the last rep is still controlled — never add exercises. Full rehab lives inside this session.',
  exercises:[
    {name:'Knee extension (machine)',scheme:'3 x 10',note:'Knee block #1'},
    {name:'Leg press',scheme:'3 x 10',note:'Knee block #2 — full range, controlled'},
    {name:'Hip abductor (machine)',scheme:'3 x 10',note:'Knee block #3'},
    {name:'Hip adduction (machine)',scheme:'3 x 10',note:'Knee block #4'},
    {name:'Seated hamstring curl',scheme:'3 x 10',note:'Knee block #5'},
    {name:'Goblet squat',scheme:'3 x 10',note:'Knee block #6'},
    {name:'Heel raises, ball squeezed between heels',scheme:'3 x 15 slow',note:'Calf + PTT block'},
    {name:'Banded inversion (foot turns inward)',scheme:'3 x 15 each side',note:'PTT — tibialis posterior'},
    {name:'Eccentric calf raise, straight knee',scheme:'3 x 12',note:'3 sec lower'},
    {name:'Eccentric calf raise, bent knee',scheme:'3 x 12',note:'3 sec lower — soleus'},
    {name:'Single-leg balance',scheme:'3 x 30-45 sec each',note:'Proprioception — no wobble'}
  ]
};
// Friday — Upper + core (lunch). Machine-led for upright running posture, plus
// core and single-leg balance. Add weight, never exercises.
var STRENGTH_B={
  id:'strength-b',
  title:'Gym — Upper + Core',
  emoji:'💪',
  duration:'~45 min',
  warmup:'Arm circles · Thoracic rotations · Inchworms x5',
  note:'Add weight when the last rep is still controlled. Never add exercises.',
  exercises:[
    {name:'Lat pulldown or seated row',scheme:'3 x 10',note:'Upper back for upright running posture'},
    {name:'Chest press',scheme:'3 x 10',note:'Controlled, full range'},
    {name:'Shoulder press',scheme:'3 x 10',note:'Arm drive matters over 21k'},
    {name:'Dead bugs',scheme:'3 x 10 each side',note:'Lower back flat on the floor throughout'},
    {name:'Plank',scheme:'3 x 30-45 sec',note:"Hips level, don't let them sag"},
    {name:'Side plank',scheme:'3 x 30 sec each side',note:'Lateral core'},
    {name:'Single-leg balance',scheme:'2 x 30 sec each side',note:'Ankle stability'}
  ]
};
// Weekly template — Mon→Sun. session: 'strength-a'|'strength-b'|'run'|'rest'.
// Final-5-week layout: Mon easy run · Tue gym (legs) · Wed rest/cross-train ·
// Thu quality · Fri gym (upper+core) · Sat long run · Sun rest. Two gym days now.
// Runs map to easy=Mon, quality=Thu, long=Sat via HM_RACE_BLOCK.runDays. `kcal`
// is the day's calorie target from the nutrition plan (shown on the Fuel tab).
var TRAINING_TEMPLATE=[
  {day:'Mon',session:'run',label:'Easy run',sub:'Easy pace · 06:30',run:false,kcal:2100},
  {day:'Tue',session:'strength-a',label:'Gym — Legs',sub:'Knee + calf rehab block',run:false,kcal:2100},
  {day:'Wed',session:'rest',label:'Rest',sub:'Optional cross-train',run:false,kcal:2000},
  {day:'Thu',session:'run',label:'Quality run',sub:'Tempo / race pace · 06:30',run:false,kcal:2300},
  {day:'Fri',session:'strength-b',label:'Gym — Upper + core',sub:'Machine-led · lunch',run:false,kcal:2100},
  {day:'Sat',session:'run',label:'Long run',sub:'Build the distance · 07:00',run:false,kcal:2700},
  {day:'Sun',session:'rest',label:'Rest',sub:'Recover + stretch',run:false,kcal:1900}
];

// ── HALF MARATHON — FINAL 5 WEEKS (17 Aug – 20 Sep 2026, sub-2:30) ───────────
// Dated, week-aware plan seeded into STATE.trainingPlan.raceBlock via a guarded
// one-shot migration in init.js. runDays maps easy/quality/long to JS getDay()
// weekdays and is user-editable. Peak long run 19k. Fuel from the 17k up.
var HM_RACE_BLOCK={
  race:{name:'Half Marathon',date:'2026-09-20',goal:'Sub 2:30',goalPace:'7:06/km',
    strategy:'First 5k @ 7:15 · 5–15k @ 7:05 · final 6k on feel · checkpoints: 10k by 1:11, 15k by 1:47'},
  paces:{easy:'8:00+ /km (nothing faster)',race:'7:05–7:15 /km',tempo:'7:00–7:06 /km',interval:'7:00 /km'},
  runDays:{easy:1,quality:4,long:6},
  weeks:[
    {n:1,start:'2026-08-17',phase:'re-entry',easy:'6k easy — first run back, deliberately slow',quality:'1k easy · 3k @ 7:05 · 1k easy',long:'14k all easy'},
    {n:2,start:'2026-08-24',phase:'build',easy:'6k easy',quality:'1k easy · 4k @ 7:00 · 1k easy',long:'17k easy',fuel:true},
    {n:3,start:'2026-08-31',phase:'peak',easy:'6k easy',quality:'1k easy · 5k @ race pace 7:06 · 1k easy',long:'19k — last 3k at race pace',fuel:true},
    {n:4,start:'2026-09-07',phase:'taper',easy:'6k easy',quality:'Easy 6k in Lisbon — travel week, no hard session',long:'12k with the group (Lisbon)',fuel:true},
    {n:5,start:'2026-09-14',phase:'race week',easy:'4k easy (Mon, Lisbon)',quality:'3k — 2k easy + 4×30s strides @ race pace (Fri)',long:'RACE DAY — Sun 20 Sep 🏁',fuel:true}
  ]
};
// ── NUTRITION PLAN ───────────────────────────────────────────────────────────
// Static reference for the Fuel tab (renderTrainingFuel). Data-driven so the
// meal lists stay maintainable rather than living in one long HTML string. Pure
// content — no state, no writes. Calorie targets per day come from the training
// template's `kcal` field so the two never disagree.
var NUTRITION_PLAN={
  targets:{protein:'150–180g',fibre:'30–35g',water:'3L+',avg:'~2,170 kcal/day average — roughly 0.5kg/week'},
  fibreNote:'If you\'re currently well under 30g, ramp up over 2–3 weeks rather than jumping straight there. A sudden increase causes bloating you don\'t want mid-long-run.',
  noLegumes:'No beans, lentils or cottage cheese in the meals below. Fibre comes from oats, chia, berries, avocado, wholegrains, veg, nuts and seeds instead.',
  heroes:[
    {food:'Chia seeds',fibre:'10g / 2 tbsp',use:'Stir into yoghurt or overnight oats. Tasteless. The single biggest lever you have.'},
    {food:'Raspberries',fibre:'6.5g / 100g',use:'Highest-fibre fruit by a distance. Frozen is fine and cheaper.'},
    {food:'Avocado',fibre:'7g / half',use:'Toast, salads, burrito bowls.'}
  ],
  formula:{
    line:'Every main meal = protein (150–180g) + carb + two veg. Whatever\'s reduced becomes the protein; the rest stays the same.',
    protein:['Chicken breast/thigh','Beef mince','Steak','Turkey mince/breast','Diced beef','Eggs'],
    carb:['Bulgur wheat','Brown rice','Sweet potato (skin on)','Wholewheat pasta','Wholemeal wrap'],
    veg:['Broccoli','Peppers','Courgette','Spinach','Green beans','Peas','Cauliflower','Red onion','Mushrooms','Sweetcorn','Carrots']
  },
  meals:{
    breakfast:{target:'35–45g protein · 8–12g fibre',items:[
      {meal:'Greek yoghurt (200g) + oats (40g) + raspberries + 2 tbsp chia + honey',p:'30g',f:'18g'},
      {meal:'3 eggs scrambled + 2 slices wholegrain toast + spinach + avocado',p:'28g',f:'11g'},
      {meal:'Overnight oats: oats 50g, milk, scoop protein, banana, chia',p:'38g',f:'14g'},
      {meal:'Skyr (200g) + granola + raspberries + flaxseed',p:'28g',f:'10g'},
      {meal:'2 poached eggs + wholegrain toast + avocado + grilled tomatoes + spinach',p:'24g',f:'12g'}
    ],note:'Long-run days: add a banana and extra toast before heading out.'},
    lunch:{target:'45–55g protein · 10–12g fibre',items:[
      {meal:'Chicken + bulgur salad + roasted peppers, courgette, red onion + feta',p:'48g',f:'13g'},
      {meal:'Chicken burrito bowl: chicken 150g, brown rice, sweetcorn, avocado, salsa, spinach',p:'48g',f:'13g'},
      {meal:'Beef strips + bulgur + tomato, cucumber, parsley, lemon (tabbouleh-style)',p:'46g',f:'12g'},
      {meal:'Turkey wrap (wholemeal) + avocado + spinach + sweetcorn + side salad',p:'44g',f:'12g'},
      {meal:'Leftovers from last night\'s dinner + extra veg',p:'—',f:'—'}
    ]},
    dinner:{target:'45–55g protein · 10–12g fibre',items:[
      {meal:'Chilli con carne (extra beef mince, no beans) + peppers + brown rice',p:'52g',f:'9g'},
      {meal:'Chicken stir fry: 180g chicken, broccoli, peppers, mangetout, brown rice noodles',p:'50g',f:'11g'},
      {meal:'Turkey meatballs + wholewheat pasta + tomato sauce + large side salad',p:'50g',f:'12g'},
      {meal:'Beef + bulgur pilaf + roasted Mediterranean veg',p:'48g',f:'13g'},
      {meal:'Chicken traybake: thighs, sweet potato, peppers, red onion, courgette',p:'46g',f:'12g'},
      {meal:'Steak + sweet potato wedges + broccoli + peas',p:'48g',f:'11g'},
      {meal:'Chicken curry + brown rice + spinach + cauliflower',p:'46g',f:'10g'}
    ],note:'Fish kept out of shared meals. Eating alone? Salmon and cod are the easiest protein to cook and good for recovery.'},
    snacks:{target:'Pick 1–2 daily',items:[
      {meal:'Protein shake + banana',p:'28g',f:'3g'},
      {meal:'Greek yoghurt + raspberries + 1 tbsp chia',p:'20g',f:'11g'},
      {meal:'Apple or pear + 2 tbsp peanut butter',p:'8g',f:'6g'},
      {meal:'Handful almonds (30g)',p:'6g',f:'4g'},
      {meal:'Boiled eggs (2) + oatcakes',p:'15g',f:'4g'},
      {meal:'Biltong or beef jerky (50g)',p:'25g',f:'0g'},
      {meal:'Homemade popcorn (30g)',p:'3g',f:'4g'}
    ]}
  },
  sampleDay:{summary:'~2,100 kcal · 158g protein · 38g fibre',rows:[
    ['08:00','Greek yoghurt + oats + raspberries + 2 tbsp chia'],
    ['11:00','Protein shake + banana'],
    ['13:30','Chicken burrito bowl (rice, sweetcorn, avocado, salsa)'],
    ['16:30','Apple + peanut butter'],
    ['19:30','Chicken traybake — thighs, sweet potato, peppers, red onion, courgette']
  ]},
  rules:[
    'Protein at every meal — protects muscle in a deficit and supports tendon repair.',
    'Fibre from chia, oats, raspberries, avocado, wholegrains and veg — no legumes required.',
    'Eating window 8am–9pm. Don\'t run 12k+ fasted.',
    'Batch-cook chilli, curry and stir-fry base on Sundays — three lunches sorted.',
    'Never cut Saturday. The deficit lives on the other six days.',
    'Weigh weekly, same day, same time.'
  ],
  floors:'Don\'t go below 1,900 on any day. If long runs feel heavy, sleep gets poor, or a niggle reappears — eat more, not less. The deficit is the first thing to relax.'
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
  lifeHubApiFetch(NOTIF_API+'/api/ai-narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replan:{today:order[todayIdx],remainingDays:remaining,sessions:sessions}})})
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
  var weightSpark=(typeof sparklineSVG==='function')?sparklineSVG(last7,'var(--moss)'):'';
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
    var _acc=(_cs.getPropertyValue('--moss')||'#3F5A44').trim();
    var _mossDim=(_cs.getPropertyValue('--moss-dim')||'rgba(63,90,68,0.10)').trim();
    var _skyDim=(_cs.getPropertyValue('--sky-dim')||'rgba(110,147,174,0.12)').trim();
    var _tick=(_cs.getPropertyValue('--text2')||'#626B62').trim();
    var _chartFont='Spline Sans Mono';
    var _labels=weights.map(function(w){return fmtDate(w.date)});
    var _vals=weights.map(function(w){return w.value});
    var _avg=_vals.map(function(_,i){var seg=_vals.slice(Math.max(0,i-6),i+1);return Math.round(seg.reduce(function(a,b){return a+b},0)/seg.length*10)/10;});
    // Guide band: 92.0kg at 13 Jul 2026, -0.5kg/week, ±0.75kg.
    var _bRef=new Date('2026-07-13T12:00:00'),_bStart=92.0,_bSlope=-0.5,_bHalf=0.75;
    function _bandC(dk){var wks=(new Date(dk+'T12:00:00')-_bRef)/(7*86400000);return _bStart+_bSlope*wks;}
    var _bHigh=weights.map(function(w){return Math.round((_bandC(w.date)+_bHalf)*10)/10;});
    var _bLow=weights.map(function(w){return Math.round((_bandC(w.date)-_bHalf)*10)/10;});
    ctx._ch=new Chart(ctx,{type:'line',data:{labels:_labels,datasets:[
      {label:'Steady range',data:_bHigh,borderColor:'transparent',backgroundColor:_mossDim,pointRadius:0,fill:'+1',tension:0.3},
      {label:'_bandlow',data:_bLow,borderColor:'transparent',backgroundColor:'transparent',pointRadius:0,fill:false,tension:0.3},
      {label:'Daily',data:_vals,borderColor:_skyDim,backgroundColor:'transparent',pointRadius:2,pointBackgroundColor:_skyDim,borderWidth:1,tension:0.3},
      {label:'7-day avg',data:_avg,borderColor:_acc,backgroundColor:'transparent',pointRadius:0,borderWidth:2.5,tension:0.3}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{filter:function(it){return it.text!=='_bandlow'},color:_tick,font:{size:10,family:_chartFont},boxWidth:10,padding:10}}},scales:{x:{ticks:{color:_tick,font:{size:10,family:_chartFont}}},y:{ticks:{color:_tick,font:{size:10,family:_chartFont},callback:function(v){return v+'kg'}}}}}});
  }
}

// Quick log today — one tap. Repeated taps reuse the existing same-type
// record instead of creating duplicate sessions for the same date.
function quickLogToday(type){
  var today=localDateKey(new Date());
  if(type==='Run'){
    openModal('logRun');return;
  }
  if(!STATE.workouts)STATE.workouts=[];
  var existing=STATE.workouts.find(function(w){
    if(!w||w.date!==today)return false;
    return String(w.type||w.name||'').toLowerCase()===String(type).toLowerCase();
  });
  if(existing){
    if(typeof showCelebrationToast==='function')showCelebrationToast(type+' is already logged today','✓');
    return existing;
  }

  var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
  var record={id:g(),date:today,type:type,name:type==='Rest'?'Rest day':type,note:''};STATE.workouts.push(record);
  if(type!=='Rest'){
    applyHabitSource('lifehub.workout.any',today,'workout',record.id);
    if(type==='Hyrox')applyHabitSource('lifehub.workout.hyrox',today,'workout',record.id);
  }
  if(!saveStateOrRollback(snapshot)){renderWorkout();return null}
  emitLifeHubChange({action:'workout-create',entityId:record.id,dateKeys:[today],domains:type==='Rest'?['workouts']:['workouts','habits'],source:'workout'});
  // First workout of the week = bigger celebration
  var wkStart=weekKey(new Date());
  var sessionsThisWeek=(STATE.workouts||[]).filter(function(s){return s.date>=wkStart&&s.type!=='Rest'});
  if(type!=='Rest'&&sessionsThisWeek.length===1){
    fireConfetti({count:80,duration:2200});
    showCelebrationToast(type+' logged — first session of the week!','💪');
  }else{
    showCelebrationToast(type+' logged','💪');
  }
  return record;
}

function sessionCard(w){
  var typeLabel=w.type||w.name||'Session';var deleteFn=w.isRun?'deleteRunFromWorkout':'deleteWorkout';
  return '<div class="workout-card"><div class="workout-header"><div style="flex:1"><div class="workout-title">'+escapeHtml(typeLabel)+'</div><div class="workout-meta">'+fmtDate(w.date)+(w.note?' · '+escapeHtml(w.note):'')+'</div></div><div style="display:flex;gap:6px;align-items:center"><span class="badge badge-fit">'+escapeHtml(typeLabel)+'</span><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();'+deleteFn+'(\''+w.id+'\')">&#215;</button></div></div></div>';
}

function deleteWorkout(id){
  confirmDelete('Delete this session?',function(){
    var record=(STATE.workouts||[]).find(function(w){return w.id===id});if(!record)return false;
    var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
    STATE.workouts=(STATE.workouts||[]).filter(function(w){return w.id!==id});var habitIds=removeHabitSource('workout',id);
    if(!saveStateOrRollback(snapshot)){renderWorkout();return false}
    emitLifeHubChange({action:'workout-delete',entityId:id,dateKeys:[record.date],habitIds:habitIds,domains:habitIds.length?['workouts','habits']:['workouts'],source:'workout'});return true;
  });
}

function renderAllWorkouts(){
  var el=document.getElementById('all-workouts');if(!el)return;
  // Merge gym sessions AND runs into one unified history (runs live in metrics.run).
  var sessions=(STATE.workouts||[]).slice();
  var runs=((STATE.metrics||{}).run||[]).map(function(r){
    return {id:r.id,date:r.date,type:'Run',name:'Run',note:(r.distance?r.distance+'km':'')+(r.time?' · '+r.time:'')+(r.note?' · '+r.note:''),isRun:true};
  });
  var all=sessions.concat(runs).sort(function(a,b){return (b.date||'').localeCompare(a.date||'')});
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
  var sessions=(STATE.workouts||[]).slice();
  var runs=((STATE.metrics||{}).run||[]).map(function(r){
    return {id:r.id,date:r.date,type:'Run',name:'Run',note:(r.distance?r.distance+'km':'')+(r.time?' · '+r.time:'')+(r.note?' · '+r.note:''),isRun:true};
  });
  var all=sessions.concat(runs).sort(function(a,b){return (b.date||'').localeCompare(a.date||'')});
  var filtered=type==='All'?all:all.filter(function(w){return (w.type||'Other')===type});
  el.innerHTML=filtered.length?filtered.map(function(w){return sessionCard(w)}).join(''):'<div class="empty">No sessions for '+type+'</div>';
}

function saveQuickLog(){
  var type=(document.getElementById('m-qltype')||{}).value;
  if(!type)return;
  var date=(document.getElementById('m-qldate')||{}).value||localDateKey(new Date());
  var note=(document.getElementById('m-qlnote')||{}).value||'';
  var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
  if(!STATE.workouts)STATE.workouts=[];
  var record={id:g(),date:date,type:type,name:type,note:note,muscleGroups:[type]};STATE.workouts.push(record);
  applyHabitSource('lifehub.workout.any',date,'workout',record.id);
  if(type==='Hyrox')applyHabitSource('lifehub.workout.hyrox',date,'workout',record.id);
  if(!saveStateOrRollback(snapshot)){renderWorkout();return false}
  closeModal();emitLifeHubChange({action:'workout-create',entityId:record.id,dateKeys:[date],domains:['workouts','habits'],source:'workout'});
  showCelebrationToast(type+' session logged','💪');return true;
}

function saveRunFromWorkout(){
  var dist=(document.getElementById('m-rundist')||{}).value;if(!dist)return;
  var date=(document.getElementById('m-rundate')||{}).value||localDateKey(new Date());
  var time=(document.getElementById('m-runtime')||{}).value||'';
  var note=(document.getElementById('m-runnote')||{}).value||'';
  var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
  if(!STATE.metrics)STATE.metrics={};if(!STATE.metrics.run)STATE.metrics.run=[];
  var record={id:g(),date:date,distance:Number(dist),time:time,note:note};STATE.metrics.run.push(record);
  applyHabitSource('lifehub.run.any',date,'run',record.id);
  if(!saveStateOrRollback(snapshot)){renderWorkout();return false}
  closeModal();emitLifeHubChange({action:'run-create',entityId:record.id,dateKeys:[date],domains:['metrics','habits'],source:'run'});
  var distNum=Number(dist);
  if(distNum>=10){fireConfetti({count:110,duration:2600,colors:['#5A8FB0','#7CA5C2','#6b9e7a','#d4845a']});showCelebrationToast(distNum+'km run — beast mode.','🏃')}
  else if(distNum>=5){fireConfetti({count:70,duration:2000,colors:['#5A8FB0','#7CA5C2','#6b9e7a']});showCelebrationToast(distNum+'km logged — nice one.','🏃')}
  else{showCelebrationToast(distNum+'km run logged','🏃')}
  return true;
}

function deleteRunFromWorkout(id){
  confirmDelete('Delete this run?',function(){
    if(!STATE.metrics||!STATE.metrics.run)return false;var record=STATE.metrics.run.find(function(r){return r.id===id});if(!record)return false;
    var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
    STATE.metrics.run=STATE.metrics.run.filter(function(r){return r.id!==id});var habitIds=removeHabitSource('run',id);
    if(!saveStateOrRollback(snapshot)){renderWorkout();return false}
    emitLifeHubChange({action:'run-delete',entityId:id,dateKeys:[record.date],habitIds:habitIds,domains:habitIds.length?['metrics','habits']:['metrics'],source:'run'});return true;
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
    var _hasOverride=block.weekOverrides&&block.weekOverrides[wk];
    html+='<div class="train-plan-block-head">'
      +'<div class="train-plan-block-week">Week '+blockCtx.n+' of '+blockCtx.total+' · '+blockCtx.week.phase+(_hasOverride?' <span style="font-size:11px;color:var(--accent);font-weight:500">· adjusted this week</span>':'')+'</div>'
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

// ── Fuel tab ──
// Static nutrition reference from NUTRITION_PLAN. Today's calorie target is read
// from the training template so the number matches the plan. Escapes every
// interpolated string — it's reference data, but the escape keeps the pattern
// consistent with the rest of the app and safe if the plan is ever user-edited.
function renderTrainingFuel(){
  var el=document.getElementById('training-fuel');if(!el)return;
  var esc=(typeof escapeHtml==='function')?escapeHtml:function(s){return String(s)};
  var n=NUTRITION_PLAN;
  var plan=getTrainingPlan();
  var dayNames={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
  var todayIdx=(new Date().getDay()+6)%7;
  var todayRow=(plan.template||[])[todayIdx]||null;

  var html='';

  // Today's fuel target — the one number that changes day to day.
  if(todayRow&&todayRow.kcal){
    html+='<div class="card" style="margin-bottom:16px;padding:20px 24px;border-left:4px solid var(--sky)">'
      +'<div class="card-label" style="margin:0 0 4px">Today · '+esc(dayNames[todayRow.day]||todayRow.day)+'</div>'
      +'<div style="font-family:var(--mono,var(--serif));font-size:30px;font-weight:600;letter-spacing:-0.02em;color:var(--ink,var(--text))">'+todayRow.kcal.toLocaleString()+' <span style="font-size:14px;color:var(--text3);font-weight:400">kcal</span></div>'
      +'<div style="font-size:13px;color:var(--text2);margin-top:2px">'+esc(todayRow.label)+' — '+esc(todayRow.sub)+'</div>'
    +'</div>';
  }

  // Daily targets
  html+='<div class="card" style="margin-bottom:16px">'
    +'<div class="card-label">Daily targets</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:10px">'
    +[['Protein',n.targets.protein,'var(--clay)'],['Fibre',n.targets.fibre,'var(--moss,var(--mint))'],['Water',n.targets.water,'var(--sky)']].map(function(t){
      return '<div style="text-align:center;padding:12px;background:var(--paper2,var(--bg3));border-radius:12px">'
        +'<div style="font-family:var(--mono,var(--serif));font-size:20px;font-weight:600;color:'+t[2]+'">'+esc(t[1])+'</div>'
        +'<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">'+esc(t[0])+'</div>'
      +'</div>';
    }).join('')
    +'</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-top:12px">'+esc(n.targets.avg)+'</div>'
  +'</div>';

  // Calorie cycle by day
  html+='<div class="card" style="margin-bottom:16px">'
    +'<div class="card-label">Calories by day</div>'
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:10px">'
    +(plan.template||[]).map(function(d,i){
      var on=i===todayIdx;
      return '<div style="text-align:center;padding:10px 4px;background:'+(on?'var(--moss-dim,var(--accent-dim))':'var(--paper2,var(--bg3))')+';border-radius:10px'+(on?';outline:2px solid var(--moss,var(--accent))':'')+'">'
        +'<div style="font-size:10px;color:var(--text3);text-transform:uppercase">'+esc(d.day)+'</div>'
        +'<div style="font-family:var(--mono,var(--serif));font-size:14px;font-weight:600;color:var(--text);margin-top:3px">'+(d.kcal?d.kcal.toLocaleString():'—')+'</div>'
      +'</div>';
    }).join('')
    +'</div>'
  +'</div>';

  // Fibre heroes + notes
  html+='<div class="card" style="margin-bottom:16px">'
    +'<div class="card-label">The three fibre heroes</div>'
    +'<div style="font-size:12px;color:var(--text3);margin:4px 0 12px">No legumes needed.</div>'
    +n.heroes.map(function(h){
      return '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">'
        +'<div style="flex:0 0 auto;min-width:100px"><div style="font-size:14px;font-weight:600;color:var(--text)">'+esc(h.food)+'</div><div style="font-family:var(--mono,var(--serif));font-size:12px;color:var(--moss,var(--mint))">'+esc(h.fibre)+'</div></div>'
        +'<div style="font-size:13px;color:var(--text2)">'+esc(h.use)+'</div>'
      +'</div>';
    }).join('')
    +'<div class="train-plan-painrule" style="margin-top:12px">'+esc(n.fibreNote)+'</div>'
    +'<div style="font-size:12px;color:var(--text2);margin-top:8px">'+esc(n.noLegumes)+'</div>'
  +'</div>';

  // The formula
  html+='<div class="card" style="margin-bottom:16px">'
    +'<div class="card-label">The formula (for reduced-section shopping)</div>'
    +'<div style="font-size:13px;color:var(--text2);margin:8px 0 12px">'+esc(n.formula.line)+'</div>'
    +[['Protein',n.formula.protein],['Carb',n.formula.carb],['Veg',n.formula.veg]].map(function(g){
      return '<div style="margin-bottom:8px"><span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text3)">'+esc(g[0])+'</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">'
        +g[1].map(function(x){return '<span style="font-size:12px;padding:3px 9px;background:var(--paper2,var(--bg3));border-radius:20px;color:var(--text2)">'+esc(x)+'</span>'}).join('')
      +'</div></div>';
    }).join('')
  +'</div>';

  // Meal lists
  [['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['snacks','Snacks']].forEach(function(m){
    var slot=n.meals[m[0]];if(!slot)return;
    html+='<div class="card" style="margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">'
        +'<div class="card-label" style="margin:0">'+esc(m[1])+'</div>'
        +'<div style="font-size:11px;color:var(--text3)">'+esc(slot.target)+'</div>'
      +'</div>'
      +'<div style="margin-top:8px">'
      +slot.items.map(function(it){
        return '<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">'
          +'<div style="font-size:13px;color:var(--text2);flex:1">'+esc(it.meal)+'</div>'
          +'<div style="font-family:var(--mono,var(--serif));font-size:11px;color:var(--text3);white-space:nowrap;text-align:right">'+esc(it.p)+' P<br>'+esc(it.f)+' F</div>'
        +'</div>';
      }).join('')
      +'</div>'
      +(slot.note?'<div style="font-size:12px;color:var(--text3);font-style:italic;margin-top:8px">'+esc(slot.note)+'</div>':'')
    +'</div>';
  });

  // Sample day
  html+='<div class="card" style="margin-bottom:16px">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">'
      +'<div class="card-label" style="margin:0">A sample day</div>'
      +'<div style="font-family:var(--mono,var(--serif));font-size:11px;color:var(--moss,var(--mint))">'+esc(n.sampleDay.summary)+'</div>'
    +'</div>'
    +'<div style="margin-top:8px">'
    +n.sampleDay.rows.map(function(r){
      return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">'
        +'<div style="font-family:var(--mono,var(--serif));font-size:12px;color:var(--text3);flex:0 0 46px">'+esc(r[0])+'</div>'
        +'<div style="font-size:13px;color:var(--text2)">'+esc(r[1])+'</div>'
      +'</div>';
    }).join('')
    +'</div>'
  +'</div>';

  // Rules + floors
  html+='<div class="card" style="margin-bottom:16px">'
    +'<div class="card-label">Practical</div>'
    +'<ul style="margin:8px 0 0;padding-left:18px">'
    +n.rules.map(function(r){return '<li style="font-size:13px;color:var(--text2);margin-bottom:6px">'+esc(r)+'</li>'}).join('')
    +'</ul>'
    +'<div class="train-plan-painrule" style="margin-top:12px">'+esc(n.floors)+'</div>'
  +'</div>';

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
      var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
      if(!STATE.workouts)STATE.workouts=[];
      var record={id:g(),date:today,type:typeLabel,name:def.title,note:'Plan complete'};STATE.workouts.push(record);
      applyHabitSource('lifehub.workout.any',today,'workout',record.id);
      if(!saveStateOrRollback(snapshot)){renderMyPlanSchedule();return}
      emitLifeHubChange({action:'workout-create',entityId:record.id,dateKeys:[today],domains:['workouts','habits'],source:'training-plan'});
      fireConfetti({count:120,duration:2600});
      showCelebrationToast(def.title.split('—')[0].trim()+' complete — logged!','💪');
    }
  }
}

