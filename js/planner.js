// ============================================================
// PLANNER — daily & weekly planning data helpers
// Operate on the global STATE object; persist via saveState().
// Depend on localDateKey()/weekKey() (js/navigation.js) and g() (js/state.js).
// ============================================================

// Today's scheduled commitments, sorted chronologically by start time (R11.2).
// Includes weekly-recurring commitments (recur==='weekly') on matching weekdays.
// Returns lightweight view objects with a per-day `done` state so a recurring
// commitment can be ticked independently on each occurrence.
function getTodayCommitments(dateKey){
  var key=dateKey||localDateKey(new Date());
  var keyDow=new Date(key+'T12:00:00').getDay();
  var out=[];
  (STATE.commitments||[]).forEach(function(c){
    if(!c)return;
    var matches=false;
    if(c.date===key)matches=true;
    else if(c.recur==='weekly'&&c.date&&key>=c.date&&new Date(c.date+'T12:00:00').getDay()===keyDow)matches=true;
    if(!matches)return;
    var done=(c.recur==='weekly')?!!(c.doneDates&&c.doneDates[key]):!!c.done;
    out.push({id:c.id,text:c.text,start:c.start||'',end:c.end||'',recur:c.recur||null,done:done});
  });
  return out.sort(function(a,b){return String(a.start||'').localeCompare(String(b.start||''))});
}

// Today's dated tasks that carry a time-of-day (or are simply due today),
// excluding anything already surfaced as a Daily Focus task so it isn't
// shown twice. Sorted by time; untimed tasks sink to the bottom.
function getTodayTimedTasks(dateKey){
  var key=dateKey||localDateKey(new Date());
  return (STATE.tasks||[])
    .filter(function(t){return t&&t.dueDate===key&&t.focusDate!==key})
    .slice()
    .sort(function(a,b){
      return String(a.dueTime||'99:99').localeCompare(String(b.dueTime||'99:99'));
    });
}

// Loose "inbox" tasks — captured but not yet scheduled: open, no due date, not
// this week's flexible task, and not today's focus. Surfacing these means a
// quick-added task is always visible somewhere (never silently swallowed).
function getInboxTasks(){
  var wkKey=(typeof weekKey==='function')?weekKey(new Date()):'';
  var today=localDateKey(new Date());
  return (STATE.tasks||[]).filter(function(t){
    return t&&!t.done&&!t.dueDate&&t.weekPriority!==wkKey&&t.focusDate!==today;
  });
}

// Tasks selected as today's Daily_Focus_Tasks (R10)
function getTodayFocus(dateKey){
  var key=dateKey||localDateKey(new Date());
  return (STATE.tasks||[]).filter(function(t){return t&&t.focusDate===key});
}

// This week's flexible Weekly_Tasks (R9.3, R9.5)
function getWeekTasks(wk){
  var key=wk||weekKey(new Date());
  return (STATE.tasks||[]).filter(function(t){return t&&t.weekPriority===key});
}

// Stamp a task as today's focus. Rejects the 4th (max 3 per focusDate) (R10.1).
// Returns true on success, false when rejected or task not found.
function addFocusTask(taskId){
  var today=localDateKey(new Date());
  var task=(STATE.tasks||[]).find(function(t){return t.id===taskId});
  if(!task)return false;
  if(task.focusDate===today)return true; // already today's focus
  var current=(STATE.tasks||[]).filter(function(t){return t.focusDate===today});
  if(current.length>=3)return false;      // cap of 3 — reject the 4th
  task.focusDate=today;
  saveState();
  return true;
}

// Remove a task from today's (or any) focus by clearing its focusDate
function removeFocusTask(taskId){
  var task=(STATE.tasks||[]).find(function(t){return t.id===taskId});
  if(!task||!task.focusDate)return false;
  delete task.focusDate;
  saveState();
  return true;
}

// Set the single weekly intention for the current week (R9.1)
function setWeeklyIntention(text){
  STATE.weeklyIntention={weekKey:weekKey(new Date()),text:(text||'').trim()};
  saveState();
  return STATE.weeklyIntention;
}

// Create a time-blocked Scheduled_Commitment (R11.1). Pass recur:'weekly' for a
// standing weekly commitment (e.g. a course) so it never needs re-entering.
function addCommitment(data){
  data=data||{};
  var text=(data.text||'').trim();
  if(!text)return null;
  if(!STATE.commitments)STATE.commitments=[];
  var c={
    id:g(),
    text:text,
    date:data.date||localDateKey(new Date()),
    start:data.start||'',
    end:data.end||'',
    recur:data.recur==='weekly'?'weekly':null,
    done:false,
    doneDates:{},
    createdAt:new Date().toISOString()
  };
  STATE.commitments.push(c);
  saveState();
  return c;
}

// Toggle a commitment's completion — never treated as failure if left off
// (R11.4). Weekly-recurring commitments track completion per occurrence date.
function toggleCommitment(id,dateKey){
  var key=dateKey||localDateKey(new Date());
  var c=(STATE.commitments||[]).find(function(x){return x.id===id});
  if(!c)return false;
  if(c.recur==='weekly'){
    if(!c.doneDates)c.doneDates={};
    c.doneDates[key]=!c.doneDates[key];
  }else{
    c.done=!c.done;
  }
  saveState();
  return true;
}

// ============================================================
// PLANNER — rendering (Today tab)
// Builds HTML strings and injects via innerHTML, matching the
// dashboard/habits conventions. Inline onclick handlers call the
// global functions defined below. Re-render after every mutation.
// ============================================================

// UI state for the Today tab's focus chooser
var plannerFocusChooserOpen=false;
var plannerFocusNote='';   // gentle inline note (e.g. 4th-focus rejection)

// Switch between the Today / This week tabs and re-render (R12.4)
function switchPlannerTab(tab,btn){
  var strip=btn&&btn.parentNode;
  if(strip){
    strip.querySelectorAll('.page-tab').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
  }
  document.querySelectorAll('#page-planner .planner-tab').forEach(function(p){p.classList.remove('active')});
  var pane=document.getElementById('planner-'+tab);
  if(pane)pane.classList.add('active');
  renderPlanner();
}

// Top-level render — draws whichever tabs exist on the page
function renderPlanner(){
  renderPlannerToday();
  if(typeof renderPlannerWeek==='function')renderPlannerWeek();
}

// ── Today tab ──────────────────────────────────────────────
function renderPlannerToday(){
  var el=document.getElementById('planner-today');
  if(!el)return;
  var todayKey=localDateKey(new Date());
  el.innerHTML=plannerWelcomeCard()+plannerGlanceCard(todayKey)+plannerFocusCard(todayKey)+plannerInboxCard()+plannerCaptureCard()+plannerWaterCard()+plannerHabitCard();
}

// Compact time-based welcome row — reuses getTimeContext() from dashboard.js
// and hardcodes the single user's name "Kai". Deliberately a slim single row,
// not the Dashboard hero block (R1.2, R1.3, R1.4, R1.5).
function plannerWelcomeCard(){
  var tc=getTimeContext(); // {slot, greeting, class}
  var dateStr=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  return ''
    +'<div class="planner-welcome '+tc.class+'">'
      +'<span class="planner-welcome-greet">'+tc.greeting+', Kai</span>'
      +'<span class="planner-welcome-date">'+dateStr+'</span>'
    +'</div>';
}

// Compact water widget — a single filling cup that reflects today's hydration
// against the daily target. Reads the same STATE.water / STATE.waterSettings the
// Dashboard uses; the add control writes ONLY through the global logWaterGlass()
// (never mutating STATE.water directly). Root carries id="planner-water-card" so
// renderPlannerWater() can re-render just this widget in place (R2.2–R2.5, R2.7).
function plannerWaterCard(){
  var today=localDateKey(new Date());
  var glasses=(STATE.water&&STATE.water[today])||0;
  var target=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  var ml=Number((STATE.waterSettings&&STATE.waterSettings.glassMl)||250);
  var pct=Math.min(100,Math.round((glasses/Math.max(1,target))*100));
  var full=glasses>=target;
  return ''
    +'<div class="card planner-card planner-water" id="planner-water-card">'
      +'<div class="planner-card-head"><span class="planner-card-title">Water</span>'
        +'<span class="planner-card-hint">'+(glasses*ml/1000).toFixed(2)+'L</span></div>'
      +'<div class="planner-water-body">'
        +'<div class="pw-cup'+(full?' full':'')+'" id="planner-water-cup" aria-hidden="true">'
          +'<div class="pw-cup-fill" style="height:'+pct+'%"></div>'
        +'</div>'
        +'<div class="planner-water-info">'
          +'<div class="pw-figure"><b>'+glasses+'</b> / '+target+' glasses · '+pct+'%</div>'
          +'<button class="btn btn-sm btn-accent" onclick="logWaterGlass('+(glasses+1)+')">+ glass</button>'
        +'</div>'
      +'</div>'
    +'</div>';
}

// Re-render ONLY the water widget in place. Mirrors renderDashWater(): looks up
// the planner host and the water card, no-ops if either is absent (the planner
// may not be the active render), then swaps the card's outerHTML so logWaterGlass
// can sync the cup without redrawing the whole page (R2.6).
function renderPlannerWater(){
  var el=document.getElementById('planner-today');
  if(!el)return;
  var host=document.getElementById('planner-water-card');
  if(!host)return;
  host.outerHTML=plannerWaterCard();
}

// Compact habit tracker — lists only today's DUE habits (habitDayStatus 'done'
// or 'todo'; 'rest'/'missed'/'pre-start' are excluded). Reads STATE.habits, the
// same source the Dashboard uses. Each row's tick reflects logs[today] and calls
// plannerToggleHabit(id) to write. Root carries id="planner-habits-card" so that
// toggle can re-render just this widget in place (R3.2, R3.3, R3.4, R3.7).
function plannerHabitCard(){
  var today=localDateKey(new Date());
  var habits=(STATE.habits||[]).filter(function(h){
    var s=habitDayStatus(h,today);
    return s==='done'||s==='todo';
  });
  var rows;
  if(!habits.length){
    rows='<div class="planner-empty-line">No habits due today — enjoy the breather.</div>';
  } else {
    rows=habits.map(function(h){
      var done=!!(h.logs&&h.logs[today]);
      return '<div class="pw-habit-row'+(done?' done':'')+'">'
        +'<div class="pw-habit-check" role="button" tabindex="0"'
          +' aria-label="Toggle '+escapeHtml(h.name)+'"'
          +' onclick="plannerToggleHabit(\''+h.id+'\')">'+(done?'✓':'')+'</div>'
        +'<span class="pw-habit-name">'+(h.icon?escapeHtml(h.icon)+' ':'')+escapeHtml(h.name)+'</span>'
      +'</div>';
    }).join('');
  }
  var doneCount=habits.filter(function(h){return h.logs&&h.logs[today]}).length;
  return ''
    +'<div class="card planner-card planner-habits card-hero-tier" id="planner-habits-card">'
      +'<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>Habits</span>'
        +'<span class="planner-card-count">'+doneCount+'/'+habits.length+'</span></div>'
      +rows
    +'</div>';
}

// Toggle today's completion for one habit, persist, re-render just the planner
// habit widget in place, then sync the Dashboard habit views (guarded so this
// file doesn't hard-depend on dashboard.js load order). Reuses STATE.habits —
// the same source the Dashboard uses — so no parallel state (R3.5, R3.6, R4.3, R4.4).
function plannerToggleHabit(hid){
  var h=(STATE.habits||[]).find(function(x){return x.id===hid});
  if(!h)return;
  if(!h.logs)h.logs={};
  var today=localDateKey(new Date());
  h.logs[today]=!h.logs[today];
  saveState();
  // Re-render just the planner habit widget in place
  var host=document.getElementById('planner-habits-card');
  if(host)host.outerHTML=plannerHabitCard();
  // Keep Dashboard habit views in sync (guarded)
  if(typeof renderDashboard==='function')renderDashboard();
}

// "Today at a glance" — a single time-ordered timeline mixing scheduled
// commitments and any tasks due today (with an optional time), plus today's
// training line (R11.2, R12.4). A "now" marker separates past from upcoming.
function plannerGlanceCard(todayKey){
  var commitments=getTodayCommitments(todayKey);
  var timedTasks=getTodayTimedTasks(todayKey);

  // Build a unified timeline. Commitments sort by start; tasks by dueTime.
  var items=[];
  commitments.forEach(function(c){
    items.push({kind:'commit',id:c.id,text:c.text,time:c.start||'',end:c.end||'',recur:c.recur,done:c.done});
  });
  timedTasks.forEach(function(t){
    items.push({kind:'task',id:t.id,text:t.text,time:t.dueTime||'',end:'',done:!!t.done});
  });
  items.sort(function(a,b){return String(a.time||'99:99').localeCompare(String(b.time||'99:99'))});

  var html='<div class="card planner-card card-hero-tier">';
  html+='<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>Today at a glance</span></div>';

  if(items.length){
    var nowHM=(function(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)})();
    var nowShown=false;
    html+='<div class="planner-commitments">';
    items.forEach(function(it){
      // Drop a subtle "now" divider before the first still-upcoming timed item.
      if(!nowShown&&it.time&&it.time>=nowHM){
        html+='<div class="planner-now-line"><span>now · '+escapeHtml(nowHM)+'</span></div>';
        nowShown=true;
      }
      var time=(it.time||'')+((it.time&&it.end)?'–'+it.end:'');
      var toggle=it.kind==='commit'?'plannerToggleCommitment':'plannerToggleFocusDone';
      html+='<div class="commit-row'+(it.done?' done':'')+'">'
        +'<div class="commit-check" onclick="'+toggle+'(\''+it.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(it.text)+'">'+(it.done?'✓':'')+'</div>'
        +'<div class="commit-body">'
          +'<span class="commit-text">'+escapeHtml(it.text)+(it.kind==='commit'&&it.recur==='weekly'?' <span class="commit-recur" title="Repeats weekly">↻</span>':'')+'</span>'
          +(time?'<span class="commit-time">'+escapeHtml(time)+'</span>':(it.kind==='task'?'<span class="commit-time commit-time-soft">task</span>':''))
        +'</div>'
      +'</div>';
    });
    html+='</div>';
  }else{
    html+='<div class="planner-empty-line">Nothing scheduled today.</div>';
  }

  var train=plannerTrainingLine(todayKey);
  if(train)html+=train;

  html+='</div>';
  return html;
}

// Inbox — captured-but-unscheduled tasks, so a quick-add never disappears.
// Each row can be pulled into today's focus or opened to set a date/time.
function plannerInboxCard(){
  var inbox=getInboxTasks();
  if(!inbox.length)return '';
  var html='<div class="card planner-card planner-inbox-card card-quiet">';
  html+='<div class="planner-card-head"><span class="planner-card-title">Inbox</span>'
    +'<span class="planner-card-count">'+inbox.length+'</span></div>';
  html+='<div class="planner-inbox-list">';
  inbox.forEach(function(t){
    html+='<div class="inbox-row">'
      +'<div class="inbox-check" onclick="plannerToggleFocusDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Complete '+escapeHtml(t.text)+'"></div>'
      +'<span class="inbox-text">'+escapeHtml(t.text)+'</span>'
      +'<button class="btn btn-ghost btn-sm inbox-focus" onclick="plannerInboxMakeFocus(\''+t.id+'\')" title="Make today\'s focus">Focus</button>'
      +(typeof openTaskEditModal==='function'?'<button class="inbox-edit" onclick="openTaskEditModal(\''+t.id+'\')" title="Set date/time" aria-label="Set date or time">⋯</button>':'')
    +'</div>';
  });
  html+='</div></div>';
  return html;
}

// Today's training as a single compact line, reusing todaysTrainingSession() (R8.2 shared helper)
function plannerTrainingLine(todayKey){
  if(typeof todaysTrainingSession!=='function')return '';
  var t=todaysTrainingSession(todayKey);
  if(!t)return '';
  var icon,text;
  if(t.session==='rest'){
    icon='🌿';text=(t.label||'Rest')+(t.sub?' · '+t.sub:'');
  }else{
    var def=(typeof workoutDef==='function')?workoutDef(t.session):null;
    if(def){
      icon=def.emoji||'🏋️';
      text=t.label+' · '+def.exercises.length+' exercises'+(t.run?' · then recovery run':'');
    }else{
      icon='🏃';
      text=t.label+(t.sub?' · '+t.sub:'');
    }
  }
  // Bloom glow-up (#7): gradient "Training day" chip on active training days
  // (matches preview .gu .chip). Rest days stay chip-free to keep it calm.
  var chip=(t.session==='rest')?'':'<span class="chip">Training day</span>';
  return '<div class="planner-train-line"><span class="planner-train-icon">'+icon+'</span>'
    +'<span class="planner-train-text">'+escapeHtml(text)+'</span>'+chip+'</div>';
}

// "Daily Focus (1–3)" card — focus tasks, chooser, cap + completion states (R10.1–R10.4)
function plannerFocusCard(todayKey){
  var focus=getTodayFocus(todayKey);
  var doneCount=focus.filter(function(t){return t.done}).length;

  var html='<div class="card planner-card planner-focus-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">Daily Focus</span>'
    +(focus.length?'<span class="planner-card-count">'+doneCount+'/'+focus.length+'</span>':'<span class="planner-card-hint">1–3 for today</span>')
    +'</div>';

  if(focus.length){
    html+='<div class="planner-focus-list">';
    focus.forEach(function(t){
      var canEdit=(typeof openTaskEditModal==='function');
      html+='<div class="focus-row'+(t.done?' done':'')+'">'
        +'<div class="focus-check" onclick="plannerToggleFocusDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(t.text)+'">'+(t.done?'✓':'')+'</div>'
        +'<span class="focus-text"'+(canEdit?' onclick="openTaskEditModal(\''+t.id+'\')" style="cursor:pointer"':'')+'>'+escapeHtml(t.text)+'</span>'
        +'<button class="focus-remove" onclick="plannerRemoveFocus(\''+t.id+'\')" title="Remove from today\'s focus" aria-label="Remove from today\'s focus">×</button>'
      +'</div>';
      // Nested micro-steps (from "Break it down") — the activation-energy win,
      // shown right where you execute so the next tiny action is always visible.
      var subs=t.subSteps||[];
      if(subs.length){
        html+='<div class="focus-substeps">';
        subs.forEach(function(s,si){
          html+='<div class="focus-substep'+(s.done?' done':'')+'">'
            +'<div class="focus-substep-tick" onclick="plannerToggleSubStep(\''+t.id+'\','+si+')" role="button" tabindex="0" aria-label="Toggle step '+escapeHtml(s.text)+'">'+(s.done?'✓':'')+'</div>'
            +'<span class="focus-substep-text">'+escapeHtml(s.text)+'</span>'
          +'</div>';
        });
        html+='</div>';
      }
    });
    html+='</div>';

    // Neutral, specific confirmation when everything is done (R10.3)
    if(doneCount===focus.length){
      html+='<div class="planner-focus-done">All '+focus.length+' focus task'+(focus.length===1?'':'s')+' done today.</div>';
    }

    // Allow adding more (up to 3) via the chooser
    if(focus.length<3){
      if(plannerFocusChooserOpen)html+=plannerFocusChooser(todayKey);
      else html+='<button class="btn btn-ghost btn-sm planner-focus-add" onclick="plannerShowFocusChooser()">+ Add a focus task</button>';
    }
  }else{
    // Empty state → "Pick today's focus" button opening the chooser (R10.4)
    if(plannerFocusChooserOpen){
      html+=plannerFocusChooser(todayKey);
    }else{
      html+='<div class="planner-empty-line">No focus set for today.</div>';
      html+='<button class="btn btn-accent btn-sm planner-focus-pick" onclick="plannerShowFocusChooser()">Pick today\'s focus</button>';
    }
  }

  html+='</div>';
  return html;
}

// Chooser listing this week's weekPriority tasks + other open tasks (R10.4)
function plannerFocusChooser(todayKey){
  var wkKey=(typeof weekKey==='function')?weekKey(new Date()):'';
  var open=(STATE.tasks||[]).filter(function(t){return t&&!t.done&&t.focusDate!==todayKey});
  var priority=open.filter(function(t){return t.weekPriority===wkKey});
  var others=open.filter(function(t){return t.weekPriority!==wkKey});

  var html='<div class="planner-focus-chooser">';
  html+='<div class="planner-chooser-head"><span>Pick from this week and your open tasks</span>'
    +'<button class="planner-chooser-close" onclick="plannerHideFocusChooser()" aria-label="Close chooser">×</button></div>';

  if(plannerFocusNote){
    html+='<div class="planner-focus-note">'+escapeHtml(plannerFocusNote)+'</div>';
  }

  if(!open.length){
    html+='<div class="planner-empty-line">No open tasks to choose from. Add one below or on the week tab.</div>';
  }else{
    if(priority.length){
      html+='<div class="planner-chooser-group-label">⭐ This week</div>';
      priority.forEach(function(t){html+=plannerChooserRow(t)});
    }
    if(others.length){
      html+='<div class="planner-chooser-group-label">Open tasks</div>';
      others.forEach(function(t){html+=plannerChooserRow(t)});
    }
  }

  html+='</div>';
  return html;
}

function plannerChooserRow(t){
  return '<button class="planner-chooser-row" onclick="plannerPickFocus(\''+t.id+'\')">'
    +'<span class="planner-chooser-plus">+</span>'
    +'<span class="planner-chooser-text">'+escapeHtml(t.text)+'</span>'
    +'</button>';
}

// Quick-capture inline input (R12.1)
function plannerCaptureCard(){
  return '<div class="card planner-card planner-capture-card">'
    +'<div class="planner-capture-row">'
      +'<input type="text" id="planner-capture-input" class="planner-capture-input" placeholder="Quick add a task or commitment…" onkeydown="if(event.key===\'Enter\')plannerQuickCapture()">'
      +'<button class="planner-capture-btn" onclick="plannerQuickCapture()">+</button>'
    +'</div>'
  +'</div>';
}

// ── Today-tab mutations (each re-renders) ──────────────────
function plannerToggleCommitment(id){
  toggleCommitment(id,localDateKey(new Date()));
  renderPlanner();
}

// Complete/uncomplete a focus task via the normal task done/doneAt flow (R10.2)
function plannerToggleFocusDone(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var wasDone=!!t.done;
  t.done=!wasDone;
  t.doneAt=t.done?localDateKey(new Date()):null;
  saveState();
  renderPlanner();
  if(!wasDone&&t.done){
    if(typeof showCelebrationToast==='function')showCelebrationToast('Done — '+t.text,'✓');
  }
}

function plannerRemoveFocus(id){
  removeFocusTask(id);
  plannerFocusNote='';
  renderPlanner();
}

// Toggle a task's micro-step from the Planner focus card.
function plannerToggleSubStep(taskId,idx){
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t||!t.subSteps||!t.subSteps[idx])return;
  t.subSteps[idx].done=!t.subSteps[idx].done;
  saveState();
  renderPlanner();
}

function plannerShowFocusChooser(){
  plannerFocusChooserOpen=true;
  plannerFocusNote='';
  renderPlanner();
}

function plannerHideFocusChooser(){
  plannerFocusChooserOpen=false;
  plannerFocusNote='';
  renderPlanner();
}

// Stamp a task as today's focus; a 4th is rejected with a gentle inline note (R10.1)
function plannerPickFocus(taskId){
  var ok=addFocusTask(taskId);
  if(!ok){
    plannerFocusNote='Three focus tasks is plenty for one day. Finish or remove one to add another.';
  }else{
    plannerFocusNote='';
    // Close the chooser once we've reached the cap of 3
    if(getTodayFocus(localDateKey(new Date())).length>=3)plannerFocusChooserOpen=false;
  }
  renderPlanner();
}

// Pull an inbox task into today's focus; gives a toast if the 3-focus cap is hit
// (the inline note only renders on the focus card / chooser, not the inbox).
function plannerInboxMakeFocus(taskId){
  var ok=addFocusTask(taskId);
  if(!ok&&typeof showCelebrationToast==='function'){
    showCelebrationToast('Three focus tasks is plenty for today.','🎯');
  }
  renderPlanner();
}

// Quick capture — adds a task; routes time-blocked input to the commitment modal when available (R12.1)
function plannerQuickCapture(){
  var inp=document.getElementById('planner-capture-input');
  if(!inp)return;
  var raw=(inp.value||'').trim();
  if(!raw)return;

  // Time-blocked shape (e.g. "maths 2-4pm", "call 14:00") → commitment capture.
  // The commitment modal + routing is wired in task 6; until then this falls
  // through to adding a task. plannerCaptureCommitment is defined there.
  var timeBlocked=/\b\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(raw)||/\b\d{1,2}:\d{2}\b/.test(raw);
  if(timeBlocked&&typeof plannerCaptureCommitment==='function'){
    plannerCaptureCommitment(raw);
    inp.value='';
    return;
  }

  var parsed=(typeof parseTaskInput==='function')?parseTaskInput(raw):{text:raw,dueDate:null};
  if(!STATE.tasks)STATE.tasks=[];
  STATE.tasks.push({
    id:g(),
    text:parsed.text,
    done:false,
    dueDate:parsed.dueDate||null,
    doneAt:null,
    createdAt:localDateKey(new Date())
  });
  inp.value='';
  saveState();
  renderPlanner();
}

// ============================================================
// PLANNER — rendering (This week tab)
// Weekly intention + this-week task list (weekPriority) shown
// separately from fixed-date tasks, with inline add and a
// per-task "Make today's focus" action. (R9.1, R9.2, R9.3, R10.4)
// ============================================================

// Gentle inline note for the week tab (e.g. 4th-focus rejection)
var plannerWeekNote='';

// ── This week tab ──────────────────────────────────────────
function renderPlannerWeek(){
  var el=document.getElementById('planner-week');
  if(!el)return;
  var wkKey=weekKey(new Date());
  el.innerHTML=plannerIntentionCard(wkKey)+plannerWeekTasksCard(wkKey)+plannerFixedTasksCard(wkKey);
}

// Weekly intention — one line, prefilled when set for the current week (R9.1)
function plannerIntentionCard(wkKey){
  var intention=STATE.weeklyIntention;
  var current=(intention&&intention.weekKey===wkKey)?(intention.text||''):'';
  var html='<div class="card planner-card planner-intention-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">This week\'s intention</span></div>';
  html+='<div class="planner-intention-row">'
    +'<input type="text" id="planner-intention-input" class="planner-intention-input" placeholder="One intention for this week…" value="'+escapeHtml(current)+'" onkeydown="if(event.key===\'Enter\')plannerSaveIntention()">'
    +'<button class="planner-intention-btn" onclick="plannerSaveIntention()">Save</button>'
  +'</div>';
  if(current){
    html+='<div class="planner-intention-current">Set for this week.</div>';
  }
  html+='</div>';
  return html;
}

// This week's flexible tasks (weekPriority===currentWeekKey), with inline add
// and a per-task "Make today's focus" action (R9.2, R9.3, R10.4)
function plannerWeekTasksCard(wkKey){
  var tasks=getWeekTasks(wkKey);
  var todayKey=localDateKey(new Date());

  var html='<div class="card planner-card planner-week-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">This week\'s tasks</span>'
    +(tasks.length?'<span class="planner-card-count">'+tasks.filter(function(t){return t.done}).length+'/'+tasks.length+'</span>':'')
    +'</div>';

  if(plannerWeekNote){
    html+='<div class="planner-focus-note">'+escapeHtml(plannerWeekNote)+'</div>';
  }

  if(tasks.length){
    html+='<div class="planner-week-list">';
    tasks.forEach(function(t){
      var isFocus=t.focusDate===todayKey;
      html+='<div class="week-row'+(t.done?' done':'')+'">'
        +'<div class="week-check" onclick="plannerToggleWeekDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(t.text)+'">'+(t.done?'✓':'')+'</div>'
        +'<span class="week-text">'+escapeHtml(t.text)+'</span>'
        +(t.done
            ?''
            :(isFocus
                ?'<span class="week-focus-flag" title="Already today\'s focus">★ Today</span>'
                :'<button class="btn btn-ghost btn-sm week-make-focus" onclick="plannerWeekMakeFocus(\''+t.id+'\')" title="Make today\'s focus">Make today\'s focus</button>'))
      +'</div>';
    });
    html+='</div>';
  }else{
    html+='<div class="planner-empty-line">No tasks for this week yet. Add one below.</div>';
  }

  // Inline add — pushes a task with weekPriority = current week key (R9.2)
  html+='<div class="planner-week-add-row">'
    +'<input type="text" id="planner-week-add-input" class="planner-capture-input" placeholder="Add a task for this week…" onkeydown="if(event.key===\'Enter\')plannerAddWeekTask()">'
    +'<button class="planner-capture-btn" onclick="plannerAddWeekTask()">+</button>'
  +'</div>';

  html+='</div>';
  return html;
}

// Fixed-date tasks shown separately from this week's flexible tasks (R9.3)
function plannerFixedTasksCard(wkKey){
  var todayKey=localDateKey(new Date());
  var fixed=(STATE.tasks||[]).filter(function(t){
    return t&&!t.done&&t.dueDate&&t.weekPriority!==wkKey;
  }).sort(function(a,b){
    return String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31'));
  });

  if(!fixed.length)return '';

  var html='<div class="card planner-card planner-fixed-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">Fixed-date tasks</span></div>';
  html+='<div class="planner-fixed-list">';
  fixed.forEach(function(t){
    var due=(typeof fmtDueRel==='function')?fmtDueRel(t.dueDate):t.dueDate;
    var dueClass=t.dueDate<todayKey?'overdue':(t.dueDate===todayKey?'today':'');
    html+='<div class="fixed-row">'
      +'<div class="week-check" onclick="plannerToggleWeekDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(t.text)+'"></div>'
      +'<div class="fixed-body">'
        +'<span class="week-text">'+escapeHtml(t.text)+'</span>'
        +(due?'<span class="task-due '+dueClass+'">'+escapeHtml(due)+'</span>':'')
      +'</div>'
      +'<button class="btn btn-ghost btn-sm week-make-focus" onclick="plannerWeekMakeFocus(\''+t.id+'\')" title="Make today\'s focus">Make today\'s focus</button>'
    +'</div>';
  });
  html+='</div></div>';
  return html;
}

// ── This-week-tab mutations (each re-renders) ──────────────
function plannerSaveIntention(){
  var inp=document.getElementById('planner-intention-input');
  if(!inp)return;
  setWeeklyIntention(inp.value||'');
  renderPlanner();
}

// Toggle a week/fixed task done via the normal task done/doneAt flow (R10.2 parity)
function plannerToggleWeekDone(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var wasDone=!!t.done;
  t.done=!wasDone;
  t.doneAt=t.done?localDateKey(new Date()):null;
  saveState();
  plannerWeekNote='';
  renderPlanner();
  if(!wasDone&&t.done&&typeof showCelebrationToast==='function')showCelebrationToast('Done — '+t.text,'✓');
}

// Add a task tagged to the current week (R9.2)
function plannerAddWeekTask(){
  var inp=document.getElementById('planner-week-add-input');
  if(!inp)return;
  var raw=(inp.value||'').trim();
  if(!raw)return;
  var parsed=(typeof parseTaskInput==='function')?parseTaskInput(raw):{text:raw,dueDate:null};
  if(!STATE.tasks)STATE.tasks=[];
  STATE.tasks.push({
    id:g(),
    text:parsed.text,
    done:false,
    dueDate:parsed.dueDate||null,
    doneAt:null,
    weekPriority:weekKey(new Date()),
    createdAt:localDateKey(new Date())
  });
  inp.value='';
  plannerWeekNote='';
  saveState();
  renderPlanner();
}

// Stamp a task as today's focus from the week tab; a 4th is rejected gently (R10.4)
function plannerWeekMakeFocus(taskId){
  var ok=addFocusTask(taskId);
  if(!ok){
    plannerWeekNote='Three focus tasks is plenty for one day. Finish or remove one to add another.';
  }else{
    plannerWeekNote='';
  }
  renderPlanner();
}
