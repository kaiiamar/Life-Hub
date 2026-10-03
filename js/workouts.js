var activeSessionId=null;
var runCharts={};

// Stub for legacy session viewing
function getBestPrevSet(){return null}

// ── INJURY RE-ENTRY TRAINING PLAN ──────────────────────────────────────────
// Recovery-first weekly rhythm based on the current physio/GP guidance:
// running and demanding upper-body work are paused; cycling is the primary
// cardio; swimming is optional and deliberately short; hip physio is tracked
// as a separate 3x/week habit with an optional fourth day, so its completion
// history remains meaningful.
var TRAINING_TEMPLATE=[
  {day:'Mon',session:'recovery-v6',kind:'recovery',label:'Hip physio + walking',sub:'Physio habit · build towards 10k steps',required:false,kcal:2000,icon:'🦵'},
  {day:'Tue',session:'cycle-v6',kind:'cycle',label:'Easy cycle',sub:'20–30 min · comfortable, conversational effort',required:true,logType:'Easy cycle',acceptedLogTypes:['Easy cycle'],kcal:2050,icon:'🚲'},
  {day:'Wed',session:'recovery-v6',kind:'recovery',label:'Hip physio + recovery',sub:'Physio habit · gentle walking through the day',required:false,kcal:2000,icon:'🦵'},
  {day:'Thu',session:'cycle-v6',kind:'cycle',label:'Easy cycle',sub:'20–30 min · comfortable, conversational effort',required:true,logType:'Easy cycle',acceptedLogTypes:['Easy cycle'],kcal:2050,icon:'🚲'},
  {day:'Fri',session:'recovery-v6',kind:'recovery',label:'Hip physio + walking',sub:'Physio habit · build towards 10k steps',required:false,kcal:2000,icon:'🦵'},
  {day:'Sat',session:'swim-v6',kind:'swim',label:'Beginner swim or easy cycle',sub:'Optional · 10–20 min with rests · keep upper-body effort gentle',required:false,logType:'Beginner swim',acceptedLogTypes:['Beginner swim','Easy cycle'],kcal:2050,icon:'🏊'},
  {day:'Sun',session:'recovery-v6',kind:'recovery',label:'Optional fourth physio day',sub:'Use if comfortable · otherwise keep the day easy',required:false,kcal:2000,icon:'🌿'}
];

var BODY_COMPOSITION_PROGRAM={
  name:'Injury Re-entry',
  phase:'Recovery',
  focus:'Rebuild consistency without running or demanding upper-body training',
  progression:'Keep cycling easy. Increase duration or effort only when symptoms stay settled and your clinician is happy with progress.',
  recovery:'Follow the physio form: stop any exercise that causes pain. Scale walking back if symptoms increase and seek clinical advice for new or worsening symptoms.',
  cardio:'Cycling is the main cardio. Swimming is optional, short and rest-friendly while confidence and tolerance build.',
  steps:'Build gradually towards 10,000 steps across the day; the direction matters more than hitting the number immediately.'
};
// ── NUTRITION PLAN ───────────────────────────────────────────────────────────
// Static reference for the Fuel tab (renderTrainingFuel). Data-driven so the
// meal lists stay maintainable rather than living in one long HTML string. Pure
// content — no state, no writes. Calorie targets per day come from the training
// template's `kcal` field so the two never disagree.
var NUTRITION_PLAN={
  targets:{protein:'150–180g',fibre:'30–35g',water:'2L',avg:'~2,020 kcal/day weekly average — recovery and symptom stability come before a larger deficit'},
  fibreNote:'If you\'re currently well under 30g, ramp up over 2–3 weeks rather than jumping straight there. Increase gradually and keep meals comfortable.',
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
    ],note:'Cycling or swim days: add a banana or extra toast if energy is low.'},
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
    'Eating window 8am–9pm. Put a useful share of your carbs around cycling or swimming.',
    'Batch-cook chilli, curry and stir-fry base on Sundays — three lunches sorted.',
    'Keep any deficit moderate. Healing, symptom stability and consistency come first.',
    'Weigh weekly, same day, same time.'
  ],
  floors:'Don\'t go below 1,900 on any day. If energy drops repeatedly, sleep gets poor, recovery stalls, or symptoms increase — eat more, not less. The deficit is the first thing to relax.'
};

function workoutDef(){return null}

// Bump whenever the prescriptive plan changes. Existing logged workouts,
// runs and body metrics live in separate domains and are never replaced here.
var LIFEHUB_PLAN_VERSION=6;

function getTrainingPlan(){
  if(!STATE.trainingPlan)STATE.trainingPlan={template:JSON.parse(JSON.stringify(TRAINING_TEMPLATE)),checks:{},program:JSON.parse(JSON.stringify(BODY_COMPOSITION_PROGRAM)),planVersion:LIFEHUB_PLAN_VERSION,effectiveDate:localDateKey(new Date()),effectiveWeek:weekKey(new Date())};
  if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
  // Reconcile only the current prescription. Prior checkbox data remains in
  // place for history safety, but v6 has no strength checklist to remap.
  if(STATE.trainingPlan.planVersion!==LIFEHUB_PLAN_VERSION){
    STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
    STATE.trainingPlan.program=JSON.parse(JSON.stringify(BODY_COMPOSITION_PROGRAM));
    if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
    delete STATE.trainingPlan.raceBlock;
    STATE.trainingPlan.effectiveDate=localDateKey(new Date());
    STATE.trainingPlan.effectiveWeek=weekKey(new Date());
    STATE.trainingPlan.planVersion=LIFEHUB_PLAN_VERSION;
    if(typeof saveState==='function')saveState({suppressUndo:true});
  }
  if(!STATE.trainingPlan.template)STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
  if(!STATE.trainingPlan.program)STATE.trainingPlan.program=JSON.parse(JSON.stringify(BODY_COMPOSITION_PROGRAM));
  if(!STATE.trainingPlan.effectiveDate)STATE.trainingPlan.effectiveDate=localDateKey(new Date());
  if(!STATE.trainingPlan.effectiveWeek)STATE.trainingPlan.effectiveWeek=weekKey(new Date());
  if(STATE.trainingPlan.raceBlock)delete STATE.trainingPlan.raceBlock;
  return STATE.trainingPlan;
}

// Kept as a compatibility shim for older cached callers. The replacement plan
// is a repeatable weekly rhythm and has no race-week countdown.
function resolveHmWeek(){return null}

// Resolve the repeatable weekly prescription used by Today, Week and Training.
// Callers receive a cloned row so presentation code can safely add fields.
function todaysTrainingSession(dateKey){
  var d=dateKey?new Date(dateKey+'T12:00:00'):new Date();
  var plan=getTrainingPlan();
  var base=plan.template[(d.getDay()+6)%7]; // Mon=0..Sun=6
  if(!base)return null;
  var out=JSON.parse(JSON.stringify(base));
  out.program=plan.program||BODY_COMPOSITION_PROGRAM;
  out.trainingType=out.kind||'recovery';
  out.logType=out.logType||null;
  out.acceptedLogTypes=out.acceptedLogTypes||[];
  out.icon=out.icon||(out.kind==='cycle'?'🚲':out.kind==='swim'?'🏊':'🌿');
  if(out.kind==='cycle'){
    out.desc='Low-impact cardio';
    out.detail='Keep the effort comfortable and conversational. Stop if symptoms increase.';
  }else if(out.kind==='swim'){
    out.desc='Optional confidence-building cardio';
    out.detail='Take frequent rests and keep the upper-body effort gentle. Choose an easy cycle instead if that feels better.';
  }else{
    out.desc=out.label;
    out.detail='Physio is tracked in Habits. Walking can be split into short, comfortable bouts across the day.';
  }
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

  // Merge all historical session types for the visible week grid.
  var weekItems=sessions.filter(function(w){return days.indexOf(w.date)!==-1})
    .concat(runs.filter(function(r){return days.indexOf(r.date)!==-1}).map(function(r){return {type:'Run',date:r.date,isRun:true}}));

  // Weekly target — match the two required cycle slots by weekday and type.
  // Optional swimming, physio habits and unrelated historical activities never
  // make the target harder or satisfy a different planned slot accidentally.
  var planState=getTrainingPlan();
  var plan=planState.template;
  var effectiveWeek=planState.effectiveWeek||wk;
  function requiredCountForDays(dateKeys){
    return plan.reduce(function(count,row,index){
      if(row.required===false||!row.logType||!dateKeys[index])return count;
      var accepted=(row.acceptedLogTypes||[row.logType]).map(function(type){return String(type).toLowerCase()});
      var done=sessions.some(function(item){
        return item&&item.date===dateKeys[index]&&accepted.indexOf(String(item.type||item.name||'').toLowerCase())!==-1;
      });
      return count+(done?1:0);
    },0);
  }
  var target=plan.filter(function(d){return d.required!==false&&d.logType}).length;
  var weekCount=requiredCountForDays(days);

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
    gridEl.innerHTML='<div class="training-week-grid">'+days.map(function(d,i){
      var items=weekItems.filter(function(x){return x.date===d});
      var isToday=d===todayKey;
      var pd=plan[i];
      var planType=pd?pd.label:'';
      // Zero-guilt: past unlogged days are never flagged red or "missed".
      var statusClass='';
      if(items.length>0)statusClass='done';
      else if(isToday)statusClass='today';
      return '<div class="training-day '+statusClass+'">'
        +'<div class="training-day-name">'+new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'})+'</div>'
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
    if(effectiveWeek&&checkWk<effectiveWeek)break;
    var checkDays=weekDays(checkWk);
    var checkCount=requiredCountForDays(checkDays);
    if(checkCount>=target)streak++;
    else if(wi>0)break;  // allow current week to still be incomplete
  }
  var sEl=document.getElementById('training-streak');
  if(sEl)sEl.textContent=streak;
  var ssEl=document.getElementById('training-streak-sub');
  if(ssEl)ssEl.textContent=streak===0?'complete this re-entry week to start':'weeks on this re-entry plan';

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
  var todayKey=localDateKey(now);
  var upcoming=events.filter(function(e){return e.date&&e.date>=todayKey}).sort(function(a,b){return a.date.localeCompare(b.date)});
  if(!upcoming.length){
    el.innerHTML='<div class="empty-prompt-mini">No events scheduled. Add a class, challenge, assessment or any target date.</div>';
    return;
  }
  el.innerHTML=upcoming.map(function(e){
    var d=new Date(e.date+'T12:00:00');
    var daysAway=Math.max(0,Math.round((d-new Date(todayKey+'T12:00:00'))/86400000));
    var urgency=daysAway<=14?'var(--accent-dark)':daysAway<=60?'var(--gold)':'var(--text2)';
    return '<div class="training-event">'
      +'<div class="training-event-date"><div class="training-event-num">'+d.getDate()+'</div><div class="training-event-mon">'+d.toLocaleDateString('en-GB',{month:'short'}).toUpperCase()+'</div></div>'
      +'<div class="training-event-body"><div class="training-event-title">'+escapeHtml(e.name)+'</div>'
      +'<div class="training-event-sub" style="color:'+urgency+'">'+daysAway+' days away'+(e.note?' · '+escapeHtml(e.note):'')+'</div></div>'
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

function allTrainingHistory(){
  var legacy=(STATE.workouts||[]).slice();
  var typed=Object.keys(STATE.trainingSessions||{}).map(function(id){var s=STATE.trainingSessions[id];return {id:s.id,date:s.date,type:'Winter Arc',name:s.label||s.code||'Winter Arc session',note:s.status==='completed'?Math.floor(Number(s.durationSec||0)/60)+' min':s.status==='in-progress'?'In progress':'Planned',isWinterArc:true,status:s.status}});
  var runs=((STATE.metrics||{}).run||[]).map(function(r){return {id:r.id,date:r.date,type:'Run',name:'Run',note:(r.distance?r.distance+'km':'')+(r.time?' · '+r.time:'')+(r.note?' · '+r.note:''),isRun:true}});
  return legacy.concat(typed,runs).sort(function(a,b){return (b.date||'').localeCompare(a.date||'')});
}

function sessionCard(w){
  var typeLabel=w.type||w.name||'Session';
  if(w.isWinterArc)return '<div class="workout-card wa-history-card"><button type="button" class="wa-history-open" onclick="openWinterArcWorkout(\''+w.date+'\')"><span class="workout-title">'+escapeHtml(w.name)+'</span><span class="workout-meta">'+fmtDate(w.date)+(w.note?' · '+escapeHtml(w.note):'')+'</span></button><span class="badge badge-fit">'+escapeHtml(w.status==='in-progress'?'Resume':'Winter Arc')+'</span><button type="button" class="btn btn-sm btn-danger" onclick="deleteWinterArcSession(\''+w.id+'\')" aria-label="Delete '+escapeHtml(w.name)+'">&#215;</button></div>';
  var deleteFn=w.isRun?'deleteRunFromWorkout':'deleteWorkout';
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
  // Legacy workouts and runs remain unchanged; typed Winter Arc occurrences are
  // composed at read time so History is unified without duplicating evidence.
  var all=allTrainingHistory();
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
  var all=allTrainingHistory();
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
  // Reflect the new run on the plan (done line + pace) when the Training page is
  // showing. Other surfaces refresh through the lifehub:change listener.
  var _wp=document.getElementById('page-workout');
  if(_wp&&_wp.classList.contains('active')&&typeof renderWorkout==='function')renderWorkout();
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

// Pace (mm:ss per km) derived from a run record's distance and mm:ss time, or ''
// when either is missing/unparseable. Speed the user cares about is worked out
// here rather than stored, so it can never disagree with the logged figures.
function trainingRunPace(r){
  if(!r||!r.time||r.distance==null)return '';
  var parts=String(r.time).split(':');if(parts.length<2)return '';
  var secs=Number(parts[0])*60+Number(parts[1]),dist=Number(r.distance);
  if(!isFinite(secs)||!secs||!isFinite(dist)||!dist)return '';
  var pace=secs/dist,m=Math.floor(pace/60),s=Math.round(pace%60);
  if(s===60){m++;s=0}
  return m+':'+('0'+s).slice(-2);
}

// ── Weekly injury re-entry plan ──
// Renders recovery, cycling and optional beginner-swim rows. Physio and steps
// remain habits so their cadence and completion history are tracked correctly.
function renderMyPlanSchedule(){
  var el=document.getElementById('myplan-schedule');if(!el)return;
  var plan=getTrainingPlan();
  var wk=weekKey(new Date());
  var wdays=(typeof weekDays==='function')?weekDays(wk):null; // Mon→Sun
  var todayIdx=(new Date().getDay()+6)%7;
  var kindColors={cycle:'var(--sky)',swim:'var(--mint)',recovery:'var(--text3)'};
  var dayNames={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
  var program=plan.program||BODY_COMPOSITION_PROGRAM;
  var html='<div class="train-plan-block-head">'
    +'<div class="train-plan-block-week">'+escapeHtml(program.name)+' · '+escapeHtml(program.phase)+'</div>'
    +'<div class="train-plan-block-race">'+escapeHtml(program.focus)+'</div>'
  +'</div>';
  html+='<div class="train-plan-painrule">'+escapeHtml(program.recovery)+'</div>';
  html+='<div class="train-plan-list">';
  plan.template.forEach(function(d,i){
    var isToday=i===todayIdx;
    var dateKey=wdays?wdays[i]:null;
    var accepted=d.acceptedLogTypes||[];
    var logged=dateKey&&(STATE.workouts||[]).find(function(w){
      var type=String(w.type||w.name||'').toLowerCase();
      return w.date===dateKey&&accepted.some(function(candidate){return type===String(candidate).toLowerCase()});
    });
    html+='<div class="train-plan-day'+(isToday?' is-today':'')+'" style="border-left:4px solid '+(kindColors[d.kind]||kindColors.recovery)+'">';
    html+='<div class="train-plan-head"><div class="train-plan-head-main">';
    html+='<div class="train-plan-dayname">'+(dayNames[d.day]||d.day)+(isToday?' · Today':'')+(d.required===false&&d.logType?' · Optional':'')+'</div>';
    html+='<div class="train-plan-label">'+escapeHtml((d.icon?d.icon+' ':'')+d.label)+'</div>';
    html+='<div class="train-plan-sub">'+escapeHtml(d.sub||'')+'</div>';
    html+='</div></div>';
    if(d.logType&&dateKey){
      if(logged){
        html+='<div class="train-plan-runlog done"><span>✓ '+escapeHtml(logged.type||logged.name||d.logType)+' logged</span></div>';
      }else if(isToday){
        html+='<div class="train-plan-runlog"><button class="btn btn-sm btn-accent" onclick="quickLogToday(\''+String(d.logType).replace(/'/g,"\\'")+'\')">Log '+escapeHtml(d.logType)+' ✓</button>';
        if(d.kind==='swim')html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Easy cycle\')">Choose easy cycle</button>';
        html+='</div>';
      }
    }
    html+='</div>';
  });
  html+='</div>';
  html+='<div class="train-plan-hint">Hip physio and the gradual 10k-step goal are tracked in Habits. The Saturday swim is optional; an easy cycle is always a valid swap.</div>';
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
    var typeLabel=sessionId.indexOf('lower-')===0?'Lower':sessionId.indexOf('upper-')===0?'Upper':'Strength';
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

