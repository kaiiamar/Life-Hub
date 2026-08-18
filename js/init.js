// SIDEBAR QUOTE & INIT
var quotes=['Be intentional \u{1F928}','God\'s timing is perfect \u2728','Make happiness the priority \u{1F973}','Character energy only \u{1F451}','You are so much stronger than you think \u{1F4AA}','Debt free era loading\u2026 \u{1F4B8}','Future you says thanks \u{1F929}','She believed she could, so she did \u{1F4AA}\u{1F3FE}'];
var qEl=document.getElementById('sidebar-quote');if(qEl)qEl.textContent=quotes[Math.floor(Math.random()*quotes.length)];

// Auto night mode — applied immediately on load (respects user pref)
(function(){
  var pref=null;
  try{pref=localStorage.getItem('lh_theme')}catch(e){}
  if(pref==='dark')document.body.classList.add('night-mode');
  else if(pref==='light')document.body.classList.remove('night-mode');
  else{
    var h=new Date().getHours();
    if(h>=21||h<5)document.body.classList.add('night-mode');
  }
})();

function _lifeHubPageActive(page){var el=document.getElementById('page-'+page);return !!(el&&el.classList.contains('active'))}
document.addEventListener('lifehub:change',function(event){
  var detail=event.detail||{};if(detail.rendered||detail.source==='sync')return;
  var domains=detail.domains||[],habitsChanged=domains.indexOf('habits')!==-1;
  var movementChanged=domains.indexOf('workouts')!==-1||domains.indexOf('metrics')!==-1;
  if(habitsChanged&&_lifeHubPageActive('habits')&&typeof renderHabits==='function')renderHabits();
  if((habitsChanged||movementChanged)&&_lifeHubPageActive('planner')&&typeof renderPlanner==='function')renderPlanner();
  if((habitsChanged||movementChanged)&&typeof refreshDashboardIfActive==='function')refreshDashboardIfActive();
  if(habitsChanged&&_lifeHubPageActive('skincare')&&typeof renderSkincareToday==='function')renderSkincareToday();
  if(movementChanged&&_lifeHubPageActive('workout')&&typeof renderWorkout==='function')renderWorkout();
});

// ---- MONDAY WEEK KEY REMAP (body of the __mondayWeeksV1 migration) --------
// weekKey() is Monday-anchored (Design Decision 2), so every weekly key an older
// client wrote points at the Sunday that started its week. A Sunday week S…S+6
// overlaps the Monday week S+1…S+7 in six of its seven days and the previous
// Monday week in one, so majority overlap gives S → S+1 — mondayKeyForWeekKey()
// in js/navigation.js.
//
// Called once from the loadFromCloud callback below, after the migrateKeys
// backfill and before the first render; a named function rather than an inline
// block so Property 15 can drive it directly instead of only as a side effect of
// load. Returns true when it changed something.
//
// Every key is checked with isMondayKey() and skipped when it already is one, so
// a second run is a no-op whatever the __mondayWeeksV1 flag says. A key that is
// not a valid date key is left exactly where it is.
//
// STATE.weeklyPlans is deliberately not remapped: it is pre-migration legacy read
// only by __tasksMigrated, which has already run (Data Models → "Migrations").
function migrateMondayWeekKeys(state){
  if(!state||typeof state!=='object')return false;
  if(typeof isMondayKey!=='function'||typeof mondayKeyForWeekKey!=='function')return false;
  var changed=false;
  function remappable(key){return typeof key==='string'&&(typeof _validDateKey==='function'?_validDateKey(key):/^\d{4}-\d{2}-\d{2}$/.test(key))}
  function isPlainMap(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
  // The losing record of a collision, parked verbatim where no UI reads it. Never
  // overwrites an entry already there — a taken slot gets a #n suffix — so this
  // store only ever accumulates.
  function legacyPut(label,key,record){
    if(!isPlainMap(state.weeklyIntentionsLegacy))state.weeklyIntentionsLegacy={};
    var base=label?label+':'+key:key,slot=base,n=2;
    while(Object.prototype.hasOwnProperty.call(state.weeklyIntentionsLegacy,slot)){slot=base+'#'+n;n++}
    state.weeklyIntentionsLegacy[slot]=record;
  }
  // Rebuild `map` with Sunday keys moved onto their Monday keys. A target that is
  // already occupied keeps its own value; the source record goes to the legacy
  // store rather than being dropped.
  function remapMap(map,label,stampWeekKey){
    var keys=Object.keys(map),moving=keys.filter(function(k){return remappable(k)&&!isMondayKey(k)});
    if(!moving.length)return map;
    var next={};
    keys.forEach(function(k){if(moving.indexOf(k)===-1)next[k]=map[k]});
    moving.sort().forEach(function(k){
      var target=mondayKeyForWeekKey(k),record=map[k];
      if(Object.prototype.hasOwnProperty.call(next,target)){legacyPut(label,k,record);return}
      if(stampWeekKey&&isPlainMap(record)&&typeof record.weekKey==='string')record.weekKey=target;
      next[target]=record;
    });
    changed=true;
    return next;
  }
  if(isPlainMap(state.weeklyIntentions))state.weeklyIntentions=remapMap(state.weeklyIntentions,'',true);
  var intention=state.weeklyIntention;
  if(isPlainMap(intention)&&remappable(intention.weekKey)&&!isMondayKey(intention.weekKey)){
    intention.weekKey=mondayKeyForWeekKey(intention.weekKey);changed=true;
  }
  (Array.isArray(state.tasks)?state.tasks:[]).forEach(function(t){
    if(!t||typeof t!=='object')return;
    if(!remappable(t.weekPriority)||isMondayKey(t.weekPriority))return;
    t.weekPriority=mondayKeyForWeekKey(t.weekPriority);changed=true;
  });
  var raceBlock=state.trainingPlan&&state.trainingPlan.raceBlock;
  if(isPlainMap(raceBlock)&&isPlainMap(raceBlock.weekOverrides))raceBlock.weekOverrides=remapMap(raceBlock.weekOverrides,'weekOverrides',false);
  return changed;
}

if(_firebaseReady)setSyncStatus('saving');
loadFromCloud(function(){
  // Backfills any domain a stored payload predates. `sweep` and `companion` are
  // new; `netWorthSnapshots` and `waterSettings` are written by live code but
  // were never registered here (Data Models → "Registration is required in
  // three places").
  var migrateKeys=['goals','habits','workouts','prs','income','expenses','accounts','debts','savingsGoals','metrics','weeklyPlans','reviews','journal','mood','dailyHighlights','relationships','gratitude','wishlist','watchlist','debtPayments','reminders','water','dailyPriorities','trainingEvents','trainingPlan','tasks','commitments','weeklyIntentions','weeklyIntention','sweep','companion','netWorthSnapshots','waterSettings'];
  migrateKeys.forEach(function(k){if(!STATE[k])STATE[k]=JSON.parse(JSON.stringify(DEFAULT_STATE[k]||(k==='tasks'?[]:{})))});
  if(!STATE.tasks)STATE.tasks=[];
  if(!STATE.metrics.projectsDone)STATE.metrics.projectsDone=[];
  if(!STATE.reviews.monthly)STATE.reviews.monthly={};

  // ---- MONDAY WEEK KEYS (one-shot) ----------------------------------------
  // Move Sunday-keyed weekly data onto Monday keys. Snapshot first and restore it
  // if the save is refused, so a rejected write leaves neither the remap nor the
  // flag behind (__habitIntegrationsV1 pattern). The remap is self-checking
  // through isMondayKey, so a restored-and-retried run is safe.
  if(!STATE.__mondayWeeksV1){
    var mondayWeeksSnapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
    migrateMondayWeekKeys(STATE);
    STATE.__mondayWeeksV1=true;
    if(!saveState({suppressUndo:true}))STATE=mondayWeeksSnapshot;
  }

  // ---- HABIT INTEGRATIONS + RUN STORAGE MIGRATION (one-shot) ------------
  // Keep legacy boolean completions as manual provenance, infer a stable link
  // only when exactly one habit matches, and canonicalize metrics.run without
  // discarding duplicate-free history from the former metrics.runs key.
  if(!STATE.__habitIntegrationsV1){
    var integrationSnapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
    var integrationChanged=false;if(!STATE.metrics)STATE.metrics={};
    var sourceRuns=(Array.isArray(STATE.metrics.run)?STATE.metrics.run:[]).concat(Array.isArray(STATE.metrics.runs)?STATE.metrics.runs:[]);
    var legacyRuns=Array.isArray(STATE.metrics.runs)?STATE.metrics.runs:[];var runSeen={},canonicalRuns=[];
    sourceRuns.forEach(function(run){
      if(!run||typeof run!=='object')return;
      var signature=['run',run.id||'',run.date||'',run.distance,run.time||'',run.note||''].join('|');
      if(runSeen[signature])return;runSeen[signature]=true;canonicalRuns.push(run);
    });
    var canonicalRunIds={};canonicalRuns.forEach(function(run){
      if(typeof run.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(run.id)||canonicalRunIds[run.id]){run.id=g();integrationChanged=true}
      canonicalRunIds[run.id]=true;
    });
    if(!Array.isArray(STATE.metrics.run)||!_same(STATE.metrics.run,canonicalRuns)){STATE.metrics.run=canonicalRuns;integrationChanged=true}
    if(Object.prototype.hasOwnProperty.call(STATE.metrics,'runs')){delete STATE.metrics.runs;integrationChanged=true}
    if(typeof normalizeLifeHubHabits==='function'&&normalizeLifeHubHabits(STATE))integrationChanged=true;
    var rules=[
      {key:'lifehub.skincare.am',match:function(name){return /\bskincare\b.*\bam\b|\bmorning\s+skincare\b/i.test(name)}},
      {key:'lifehub.skincare.pm',match:function(name){return /\bskincare\b.*\bpm\b|\bevening\s+skincare\b/i.test(name)}},
      {key:'lifehub.workout.hyrox',match:function(name){return /\bhyrox\b/i.test(name)}},
      {key:'lifehub.workout.any',match:function(name){return /\b(gym|workout|strength)\b/i.test(name)&&!/\bhyrox\b/i.test(name)}},
      {key:'lifehub.run.any',match:function(name){return /\brun(?:ning)?\b/i.test(name)}}
    ];
    rules.forEach(function(rule){
      var already=(STATE.habits||[]).some(function(h){return Array.isArray(h.integrationKeys)&&h.integrationKeys.indexOf(rule.key)!==-1});if(already)return;
      var matches=(STATE.habits||[]).filter(function(h){return rule.match(h.name||'')});
      if(matches.length===1){ensureHabitProvenance(matches[0]);matches[0].integrationKeys.push(rule.key);integrationChanged=true}
    });
    var workoutIds={};(STATE.workouts||[]).forEach(function(workout){
      if(typeof workout.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(workout.id)||workoutIds[workout.id]){workout.id=g();integrationChanged=true}
      workoutIds[workout.id]=true;
      if((workout.type||'')==='Rest'||typeof _validDateKey==='function'&&!_validDateKey(workout.date))return;
      if(applyHabitSource('lifehub.workout.any',workout.date,'workout',workout.id).length)integrationChanged=true;
      var isHyrox=String(workout.type||workout.name||'').toLowerCase()==='hyrox'||(workout.muscleGroups||[]).some(function(group){return String(group).toLowerCase()==='hyrox'});
      if(isHyrox&&applyHabitSource('lifehub.workout.hyrox',workout.date,'workout',workout.id).length)integrationChanged=true;
    });
    canonicalRuns.forEach(function(run){if((typeof _validDateKey!=='function'||_validDateKey(run.date))&&applyHabitSource('lifehub.run.any',run.date,'run',run.id).length)integrationChanged=true});
    STATE.__habitIntegrationsV1=true;integrationChanged=true;
    if(integrationChanged&&!saveState({suppressUndo:true}))STATE=integrationSnapshot;
  }
  (STATE.debts||[]).forEach(function(d){if(!d.startingBalance){var dPaid=(STATE.debtPayments||[]).filter(function(p){return p.debtId===d.id}).reduce(function(s,p){return s+Number(p.amount)},0);d.startingBalance=Number(d.balance)+dPaid}});
  // Normalize legacy habit cadence and remove old false tombstones. Preserve
  // every true completion and derive missing start dates from those logs.
  var habitDataChanged=false;
  if(typeof normalizeLifeHubHabits==='function'&&normalizeLifeHubHabits(STATE))habitDataChanged=true;
  (STATE.habits||[]).forEach(function(h){
    if(h.freq==='bi-monthly'){h.freq='fortnightly';habitDataChanged=true}
    if(!h.logs||typeof h.logs!=='object'){h.logs={};habitDataChanged=true}
    Object.keys(h.logs).forEach(function(key){if(h.logs[key]===false){delete h.logs[key];habitDataChanged=true}});
    if(!h.startDate){
      var logKeys=Object.keys(h.logs).filter(function(key){return !!h.logs[key]}).sort();
      h.startDate=logKeys.length?logKeys[0]:localDateKey(new Date());
      habitDataChanged=true;
    }
    if(!h.anchor){
      if(typeof autoSuggestAnchor==='function')h.anchor=autoSuggestAnchor(h.name);
      else h.anchor='anytime';
      habitDataChanged=true;
    }
  });
  if(habitDataChanged)saveState({suppressUndo:true});

  // ---- TRAINING PLAN MIGRATION (one-shot) ---------------------------------
  // Move gym/running out of the habit tracker into the dedicated training plan.
  // Remove the old 'Gym session' and 'Run once a week' habits, seed the half
  // marathon plan + race event. Guarded so it only runs once.
  if(!STATE.__trainingMigrated){
    STATE.habits=(STATE.habits||[]).filter(function(h){
      var n=(h.name||'').toLowerCase();
      return !(n.indexOf('gym session')!==-1||n==='run once a week'||n.indexOf('run once')!==-1);
    });
    if(!STATE.trainingPlan&&typeof TRAINING_TEMPLATE!=='undefined'){
      STATE.trainingPlan={template:JSON.parse(JSON.stringify(TRAINING_TEMPLATE)),checks:{}};
    }
    // Seed race event if not already present
    if(!STATE.trainingEvents)STATE.trainingEvents=[];
    var hasRace=STATE.trainingEvents.some(function(e){return e.date==='2026-09-20'||/half\s*marathon/i.test(e.name||'')});
    if(!hasRace){
      STATE.trainingEvents.push({id:g(),name:'Half Marathon',date:'2026-09-20',note:'21.1km race day'});
    }
    STATE.__trainingMigrated=true;
    saveState();
  }

  // ---- HALF MARATHON RACE BLOCK SEED (one-shot) ---------------------------
  // Load the dated 10-week block (13 Jul – 20 Sep 2026) and adopt the block-
  // arranged weekly template. Guarded with __hmBlockSeeded so it runs once.
  // HM_RACE_BLOCK + TRAINING_TEMPLATE come from workouts.js (loaded before
  // init.js per index.html script order). (addendum §1)
  if(!STATE.__hmBlockSeeded){
    if(!STATE.trainingPlan)STATE.trainingPlan={template:[],checks:{}};
    if(typeof TRAINING_TEMPLATE!=='undefined')STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
    if(typeof HM_RACE_BLOCK!=='undefined')STATE.trainingPlan.raceBlock=JSON.parse(JSON.stringify(HM_RACE_BLOCK));
    if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
    STATE.__hmBlockSeeded=true;
    saveState();
  }

  // ---- HM BLOCK RE-SEED V2 (one-shot) -------------------------------------
  // The weekly layout changed (Mon easy · Tue strength · Wed rest · Thu quality
  // · Fri rest · Sat long · Sun rest). Existing users already have the old
  // template/runDays saved, and __hmBlockSeeded blocks a re-run — so force the
  // template + run-day mapping to the current values once, guarded by a new
  // flag. Weeks data is unchanged; user weigh-ins/checks are untouched.
  if(!STATE.__hmBlockV2){
    if(STATE.trainingPlan){
      if(typeof TRAINING_TEMPLATE!=='undefined')STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
      if(!STATE.trainingPlan.raceBlock&&typeof HM_RACE_BLOCK!=='undefined')STATE.trainingPlan.raceBlock=JSON.parse(JSON.stringify(HM_RACE_BLOCK));
      if(STATE.trainingPlan.raceBlock)STATE.trainingPlan.raceBlock.runDays={easy:1,quality:4,long:6};
    }
    STATE.__hmBlockV2=true;
    saveState();
  }

  // ---- FINAL 5-WEEK HM PLAN (one-shot) ------------------------------------
  // The plan was revised to the final 5-week block (17 Aug – 20 Sep): a second
  // gym day on Friday (upper+core), physio's full knee+calf rehab on Tuesday,
  // and A–E weeks with a 19k peak. Force the saved template + race block to the
  // current constants once, guarded by a new flag. Exercise-tick history in
  // trainingPlan.checks is untouched; stale per-week run-day overrides inside
  // the old raceBlock are dropped with it (the layout changed).
  if(!STATE.__hmBlock5wkV3){
    if(!STATE.trainingPlan)STATE.trainingPlan={template:[],checks:{}};
    if(typeof TRAINING_TEMPLATE!=='undefined')STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
    if(typeof HM_RACE_BLOCK!=='undefined')STATE.trainingPlan.raceBlock=JSON.parse(JSON.stringify(HM_RACE_BLOCK));
    if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
    STATE.__hmBlock5wkV3=true;
    saveState();
  }

  // ---- DAILY REHAB HABIT (one-shot) ---------------------------------------
  // Seed the physio's daily 5-minute rehab block as a tickable daily habit. It
  // carries its exercise list in `details` (a field the validator permits and
  // the habit sync-merge preserves) so the habit card can expand to show what it
  // entails. Guarded by a flag AND an id check so it seeds exactly once and
  // never duplicates a habit the user may already have. Snapshot/rollback on a
  // refused save, matching the other one-shot migrations above.
  if(!STATE.__rehabHabitV1){
    var _rehabSnap=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
    if(!Array.isArray(STATE.habits))STATE.habits=[];
    if(!STATE.habits.some(function(h){return h&&h.id==='rehab-daily-5min'})){
      STATE.habits.push({
        id:'rehab-daily-5min',
        name:'Daily 5-min rehab',
        freq:'daily',badge:'fit',icon:'🦵',
        note:'Five minutes daily beats a perfect session you skip. Do it while the kettle boils.',
        anchor:'anytime',integrationKeys:[],provenanceVersion:1,
        logProvenance:{},logs:{},startDate:localDateKey(new Date()),
        lifecycle:{version:1,inactivePeriods:[]},
        detailsTitle:'The daily 5-minute block',
        details:[
          {name:'Heel raises, ball squeezed between heels',spec:'2 × 15 slow'},
          {name:'Banded inversion (foot turns inward)',spec:'2 × 15 each side'},
          {name:'Calf stretch (straight knee + bent knee)',spec:'30s each'},
          {name:'Hamstring stretch',spec:'30s each'}
        ]
      });
    }
    STATE.__rehabHabitV1=true;
    if(!saveState({suppressUndo:true}))STATE=_rehabSnap;
  }

  // ---- RETIRE RUNNING FROM HABITS (one-shot) ------------------------------
  // Running now lives in the training plan (logged per session with pace/detail),
  // so any running habit is retired from the active list. Archived, not deleted:
  // the lifecycle model keeps every completion and the habit can be restored
  // from the Archive view. Targets habits linked to runs (integration key) or
  // named for running. Snapshot/rollback on a refused save.
  if(!STATE.__runHabitRetiredV1){
    var _runSnap=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
    var _runToday=localDateKey(new Date());
    (STATE.habits||[]).forEach(function(h){
      if(!h)return;
      var linked=Array.isArray(h.integrationKeys)&&h.integrationKeys.indexOf('lifehub.run.any')!==-1;
      var named=/\brun(ning)?\b/i.test(h.name||'');
      if(!linked&&!named)return;
      if(typeof habitLifecycleStatus==='function'&&habitLifecycleStatus(h,new Date())==='archived')return;
      if(typeof ensureHabitLifecycle==='function')ensureHabitLifecycle(h);
      if(typeof _setHabitLifecycleKind==='function')_setHabitLifecycleKind(h,'archived',_runToday);
    });
    STATE.__runHabitRetiredV1=true;
    if(!saveState({suppressUndo:true}))STATE=_runSnap;
  }

  // ---- TASKS MIGRATION (one-shot) -----------------------------------------
  // Old data: STATE.dailyPriorities[date] = [{text,done}]
  //           STATE.weeklyPlans[wkKey].priorities = [3 strings]
  // New data: STATE.tasks = [{id,text,done,dueDate?,doneAt?,createdAt,weekPriority?}]
  // Migrate once, mark with __tasksMigrated so we don't run twice.
  if(!STATE.__tasksMigrated){
    if(!STATE.tasks)STATE.tasks=[];
    var existingTexts={};
    STATE.tasks.forEach(function(t){if(t.text)existingTexts[t.text.toLowerCase()+'|'+(t.dueDate||'')]=true});
    // Migrate daily priorities
    var dp=STATE.dailyPriorities||{};
    Object.keys(dp).forEach(function(d){
      (dp[d]||[]).forEach(function(p){
        if(!p||!p.text)return;
        var key=p.text.toLowerCase()+'|'+d;
        if(existingTexts[key])return;
        STATE.tasks.push({
          id:g(),
          text:p.text,
          done:!!p.done,
          dueDate:d,
          doneAt:p.done?d:null,
          createdAt:d
        });
        existingTexts[key]=true;
      });
    });
    // Migrate weekly priorities — set weekPriority + dueDate to end of that week
    var wp=STATE.weeklyPlans||{};
    Object.keys(wp).forEach(function(wkKey){
      var plan=wp[wkKey];
      if(!plan||!plan.priorities)return;
      var parts=wkKey.split('-');
      var wkStart=new Date(+parts[0],+parts[1]-1,+parts[2]);
      var wkEnd=new Date(wkStart);wkEnd.setDate(wkEnd.getDate()+6);
      var wkEndKey=localDateKey(wkEnd);
      plan.priorities.forEach(function(text,i){
        if(!text||!text.trim())return;
        var done=!!(plan.prioritiesDone&&plan.prioritiesDone[i]);
        var key=text.toLowerCase()+'|'+wkEndKey;
        if(existingTexts[key])return;
        STATE.tasks.push({
          id:g(),
          text:text,
          done:done,
          dueDate:wkEndKey,
          doneAt:done?wkEndKey:null,
          createdAt:wkKey,
          weekPriority:wkKey
        });
        existingTexts[key]=true;
      });
    });
    STATE.__tasksMigrated=true;
    saveState();
  }

  // ---- PLANNER MIGRATION (one-shot) ---------------------------------------
  // New planner fields: STATE.commitments (time-blocked blocks) and
  // STATE.weeklyIntention ({weekKey,text}). Also carry forward any unfinished
  // weekly task whose weekPriority points at a *past* week to the current week
  // key, so stale weekly tasks are never treated as overdue. Guarded so it
  // only runs once.
  if(!STATE.__plannerMigrated){
    if(!STATE.commitments)STATE.commitments=[];
    // migrateKeys may have coerced an absent weeklyIntention to {}; normalise
    // anything without a real intention back to null (per data model).
    if(!STATE.weeklyIntention||!STATE.weeklyIntention.text)STATE.weeklyIntention=null;
    var _curWk=(typeof weekKey==='function')?weekKey(new Date()):null;
    if(_curWk){
      (STATE.tasks||[]).forEach(function(t){
        if(t.weekPriority&&t.weekPriority<_curWk&&!t.done)t.weekPriority=_curWk;
      });
    }
    STATE.__plannerMigrated=true;
    saveState();
  }
  // `focusDate` is a PERMANENT record of the day a task was slated for, so there
  // is deliberately no daily sweep clearing past stamps (Design Decision 7).
  // Historical Focus_Slates are reconstructed from these stamps alone, and every
  // reader compares `focusDate` for exact equality with a specific day, so a
  // stale stamp changes nothing they render. `doneAt` stays the field that
  // decides which day a completion counts toward.
  // Auto-correct "debt free" type goals: target should be 0, startProgress = initial debt total
  (STATE.goals||[]).forEach(function(go){
    var name=(go.name||'').toLowerCase();
    if(go.cat==='Finance'&&go.direction==='down'&&/debt free|pay off|clear debt/i.test(go.name)){
      // Set target to 0 (debt free means 0 debt)
      if(go.target!==0)go.target=0;
      // Set startProgress from sum of debt starting balances
      if(!go.startProgress){
        var startSum=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.startingBalance||d.balance||0)},0);
        go.startProgress=startSum;
      }
    }
  });
  // Seed startProgress for auto-linked goals that track 'down' (so % calc works)
  (STATE.goals||[]).forEach(function(go){
    if(!go.startProgress&&go.direction==='down'&&typeof getGoalSource==='function'){
      var s=getGoalSource(go);
      if(s.source!=='manual')go.startProgress=s.progress||go.progress||go.target*2;
    }
  });
  // Clean up dormant data left over from removed features
  if(STATE.gymTemplates)delete STATE.gymTemplates;
  if(STATE.projects)delete STATE.projects;
  if(!STATE.reviews.quarterly)STATE.reviews.quarterly={};
  if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};
  if(!STATE.roadmapDueDates)STATE.roadmapDueDates={};
  finishDataBootstrap();
  try{renderPlanner()}catch(e){console.error('Render error:',e)}
  try{updateAppBadge()}catch(e){}
  try{maybePromptMorningMood()}catch(e){}
  try{maybePromptCloseDay()}catch(e){}
  setupReminders();
});
startClock();

// ============================================================
// MORNING CHECK-IN
// ============================================================
// On the first open of each day, offer the mood log once. The localStorage
// guard is written before the modal opens, so later opens (and other tabs on
// this device) stay quiet even if the modal is closed without logging; if
// today's mood is already logged — from any device, via sync — nothing shows.
// The delay lets the first planner paint land before the modal appears, and an
// already-open modal is never stolen.
var MOOD_PROMPT_KEY='lh_mood_prompted';
function maybePromptMorningMood(){
  var today=localDateKey(new Date());
  var m=(STATE.mood||{})[today]||{};
  if(m.mood)return;
  try{
    if(localStorage.getItem(MOOD_PROMPT_KEY)===today)return;
    localStorage.setItem(MOOD_PROMPT_KEY,today);
  }catch(e){return}
  setTimeout(function(){
    var modal=document.getElementById('modal');
    if(modal&&modal.style.display==='flex')return;
    openModal('logMood',today);
  },700);
}

// Close-the-day pop-up. On the first open of the evening (from CLOSE_DAY_HOUR),
// surface the sweep as a modal once — unless today's sweep is already complete
// or a modal is already up. The guard is written only once the modal actually
// opens, so a session where another modal was in the way retries on the next
// open rather than being silently spent. Without background scheduling (the
// Telegram bot is gone) the pop-up can only appear when the app is opened, which
// is the honest behaviour for a PWA.
var CLOSE_DAY_PROMPT_KEY='lh_closeday_prompted';
function maybePromptCloseDay(){
  var hour=(typeof CLOSE_DAY_HOUR==='number')?CLOSE_DAY_HOUR:21;
  if(new Date().getHours()<hour)return;
  var today=localDateKey(new Date());
  var st=(typeof sweepState==='function')?sweepState(today):null;
  if(st&&st.step==='summary')return;
  try{if(localStorage.getItem(CLOSE_DAY_PROMPT_KEY)===today)return}catch(e){return}
  setTimeout(function(){
    var modal=document.getElementById('modal');
    if(modal&&modal.style.display==='flex')return;   // busy — retry next open
    try{localStorage.setItem(CLOSE_DAY_PROMPT_KEY,today)}catch(e){}
    if(typeof openCloseDayModal==='function')openCloseDayModal();
  },900);
}

// ============================================================
// PWA APP-ICON BADGE (3.5)
// ============================================================
// Reflect today's incomplete focus tasks (focusDate===today && !done) on the
// installed app icon. Guarded for browsers without the Badging API. Called on
// load and after every planner render (see renderPlanner) so it stays in sync
// with focus/task toggles for free.
function updateAppBadge(){
  try{
    if(!('setAppBadge' in navigator))return;
    var today=localDateKey(new Date());
    var n=(STATE.tasks||[]).filter(function(t){return t&&t.focusDate===today&&!t.done}).length;
    if(n>0){
      navigator.setAppBadge(n).catch(function(){});
    }else if('clearAppBadge' in navigator){
      navigator.clearAppBadge().catch(function(){});
    }else{
      navigator.setAppBadge(0).catch(function(){});
    }
  }catch(e){}
}

// Bloom checkmark micro-interaction (Part 4.3.4). Tick handlers re-render their
// list synchronously, which replaces the tapped node — so we replay the pop on
// the freshly rendered element, identified by a data-tick key, on the next
// frame. No-op when the user prefers reduced motion. Only call this when an
// item newly BECOMES done (never on un-tick).
function bloomTick(key){
  try{
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    requestAnimationFrame(function(){
      var el=document.querySelector('[data-tick="'+key+'"]');
      if(!el)return;
      el.classList.add('just-ticked');
      setTimeout(function(){el.classList.remove('just-ticked')},260);
    });
  }catch(e){}
}

// ============================================================
// SERVICE WORKER & PUSH NOTIFICATIONS
// ============================================================
var NOTIF_API='https://lifehub-notifications.vercel.app';// Set to your Vercel URL after deploy, e.g. 'https://lifehub-notifications.vercel.app'

if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){})}

function setupReminders(){
  if(!('Notification' in window)){return}
  if(Notification.permission==='granted'){
    subscribeToPush();
    setupInAppReminders()
  }
}
function requestNotifPermission(){
  Notification.requestPermission().then(function(p){
    if(p==='granted'){setupReminders()}
  })
}
function subscribeToPush(){
  if(!NOTIF_API||!navigator.serviceWorker)return;
  navigator.serviceWorker.ready.then(function(reg){
    fetch(NOTIF_API+'/api/vapid-key').then(function(r){return r.json()}).then(function(data){
      if(!data.publicKey)return;
      var key=urlBase64ToUint8Array(data.publicKey);
      return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
    }).then(function(sub){
      if(!sub)return;
      return lifeHubApiFetch(NOTIF_API+'/api/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({subscription:sub.toJSON()})
      })
    }).catch(function(e){console.log('Push subscribe failed:',e)})
  })
}
function syncRemindersToBackend(){
  if(!NOTIF_API){showCelebrationToast('No backend URL set','⚠️');return}
  var reminders=getReminders();
  var enabledCount=reminders.filter(function(r){return r.enabled}).length;
  lifeHubApiFetch(NOTIF_API+'/api/reminders',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({reminders:reminders})
  }).then(function(r){return r.json()}).then(function(data){
    console.log('Reminders synced:',data);
    if(typeof data.schedules==='string'&&data.schedules.indexOf('skipped')===0){
      showCelebrationToast('Synced locally only — backend not configured','⚠️');
    }else if(data.scheduled!==undefined){
      showCelebrationToast('Synced '+data.scheduled+'/'+enabledCount+' reminders','🔔');
    }else if(data.error){
      showCelebrationToast('Sync failed: '+data.error,'⚠️');
    }
  }).catch(function(e){console.error('Sync failed:',e);showCelebrationToast('Sync failed — check connection','⚠️')})
}
function urlBase64ToUint8Array(base64String){
  var padding='='.repeat((4-base64String.length%4)%4);
  var base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  var raw=atob(base64);var arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return arr
}
function getReminders(){
  if(!STATE.reminders)STATE.reminders=[
    {id:'morning',label:'Morning habits',emoji:'\u2600\uFE0F',message:'Time to start ticking off those habits!',hour:7,minute:0,enabled:true,condition:'habits'},
    {id:'water',label:'Water check',emoji:'\uD83D\uDCA7',message:'Keep sipping! Stay hydrated.',hour:13,minute:0,enabled:true,condition:'water'},
    {id:'gratitude',label:'Gratitude journal',emoji:'\uD83D\uDE4F',message:'Log your win and gratitude for today',hour:21,minute:0,enabled:true,condition:'gratitude'},
    {id:'sleep',label:'Bedtime reminder',emoji:'\uD83D\uDE34',message:'Time to wind down. 10pm bedtime!',hour:21,minute:30,enabled:true,condition:'none'},
    {id:'gym',label:'Training option',emoji:'\uD83C\uDFCB\uFE0F',message:'Training is on the plan today. Adjust or log it when useful.',hour:6,minute:0,enabled:false,condition:'none'}
  ];
  return STATE.reminders
}
var _notifFired={};
function setupInAppReminders(){
  setInterval(function(){
    var now=new Date();var h=now.getHours();var m=now.getMinutes();var today=localDateKey(now);
    getReminders().forEach(function(r){
      if(!r.enabled||h!==r.hour||m!==r.minute)return;
      var fk=r.id+'-'+today;if(_notifFired[fk])return;
      var skip=false;
      if(r.condition==='habits'){if((STATE.habits||[]).filter(function(hab){return hab.logs[today]}).length>0)skip=true}
      if(r.condition==='water'){if(((STATE.water||{})[today]||0)>=4)skip=true}
      if(r.condition==='gratitude'){if((STATE.gratitude||[]).some(function(e){return e.date===today}))skip=true}
      if(!skip){
        if(Notification.permission==='granted')new Notification(r.emoji+' '+r.label,{body:r.message});
        _notifFired[fk]=true
      }
    })
  },60000)
}
// Reminder setup starts after persistence bootstrap above, so it never seeds
// or syncs reminders against stale/default state.

// ============================================================
// CONFETTI CELEBRATION
// ============================================================
var confettiCanvas=null;
function fireConfetti(opts){
opts=opts||{};
// Celebrations scaled down for a calmer, less over-stimulating hit: cap the
// piece count and duration regardless of what a caller requests, so even the
// big milestone bursts stay gentle.
var duration=Math.min(opts.duration||1600,1800);var count=Math.min(opts.count||40,55);var colors=opts.colors||['#3F5A44','#C98A2D','#6E93AE','#B0563C','#EFEAE0'];
if(!confettiCanvas){confettiCanvas=document.createElement('canvas');confettiCanvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';document.body.appendChild(confettiCanvas)}
var cv=confettiCanvas;var ctx=cv.getContext('2d');cv.width=window.innerWidth;cv.height=window.innerHeight;
var pieces=[];for(var i=0;i<count;i++){pieces.push({x:cv.width*(.2+Math.random()*.6),y:cv.height*-.1-Math.random()*cv.height*.3,w:6+Math.random()*6,h:4+Math.random()*4,color:colors[Math.floor(Math.random()*colors.length)],vx:(Math.random()-.5)*6,vy:2+Math.random()*4,rot:Math.random()*360,vr:(Math.random()-.5)*8,opacity:1})}
var start=Date.now();
function frame(){var elapsed=Date.now()-start;var progress=elapsed/duration;ctx.clearRect(0,0,cv.width,cv.height);
if(progress>=1){ctx.clearRect(0,0,cv.width,cv.height);return}
pieces.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.rot+=p.vr;p.opacity=Math.max(0,1-progress*1.2);
ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.globalAlpha=p.opacity;ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()});
requestAnimationFrame(frame)}
frame()}

function showCelebrationToast(msg,emoji){
var toast=document.createElement('div');
toast.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#314836;color:#fff;padding:12px 24px;border-radius:14px;font-family:var(--sans);font-size:14px;font-weight:600;z-index:10000;box-shadow:0 8px 32px rgba(63,90,68,0.28);animation:floatIn .3s ease;display:flex;align-items:center;gap:8px';
var icon=document.createElement('span');icon.style.fontSize='20px';icon.textContent=emoji||'🎉';toast.appendChild(icon);
var text=document.createElement('span');text.textContent=String(msg||'');toast.appendChild(text);
document.body.appendChild(toast);
setTimeout(function(){toast.style.transition='opacity .4s,transform .4s';toast.style.opacity='0';toast.style.transform='translateX(-50%) translateY(-10px)';setTimeout(function(){toast.remove()},400)},2800)}

// ── CELEBRATION GUARDS — prevent re-firing the same event ──
// Stores event keys that have fired today, so we can hook celebrations into
// re-renders without spamming confetti. Keys are prefixed with the ISO date.
function celebrateOnce(key,fn){
  try{
    var today=new Date().toISOString().slice(0,10);
    var fullKey='lh_celebrated:'+today+':'+key;
    if(sessionStorage.getItem(fullKey))return false;
    sessionStorage.setItem(fullKey,'1');
    fn();
    return true;
  }catch(e){fn();return true}
}
