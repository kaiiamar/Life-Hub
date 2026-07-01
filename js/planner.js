// ============================================================
// PLANNER — daily & weekly planning data helpers
// Operate on the global STATE object; persist via saveState().
// Depend on localDateKey()/weekKey() (js/navigation.js) and g() (js/state.js).
// ============================================================

// Today's scheduled commitments, sorted chronologically by start time (R11.2)
function getTodayCommitments(dateKey){
  var key=dateKey||localDateKey(new Date());
  return (STATE.commitments||[])
    .filter(function(c){return c&&c.date===key})
    .slice()
    .sort(function(a,b){return String(a.start||'').localeCompare(String(b.start||''))});
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

// Create a time-blocked Scheduled_Commitment (R11.1)
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
    done:false,
    createdAt:new Date().toISOString()
  };
  STATE.commitments.push(c);
  saveState();
  return c;
}

// Toggle a commitment's completion — never treated as failure if left off (R11.4)
function toggleCommitment(id){
  var c=(STATE.commitments||[]).find(function(x){return x.id===id});
  if(!c)return false;
  c.done=!c.done;
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
  el.innerHTML=plannerGlanceCard(todayKey)+plannerFocusCard(todayKey)+plannerCaptureCard();
}

// "Today at a glance" — commitments in time order + today's training line (R11.2, R12.4)
function plannerGlanceCard(todayKey){
  var commitments=getTodayCommitments(todayKey);
  var html='<div class="card planner-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">Today at a glance</span></div>';

  if(commitments.length){
    html+='<div class="planner-commitments">';
    commitments.forEach(function(c){
      var time=(c.start||'')+((c.start&&c.end)?'–'+c.end:'');
      html+='<div class="commit-row'+(c.done?' done':'')+'">'
        +'<div class="commit-check" onclick="plannerToggleCommitment(\''+c.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(c.text)+'">'+(c.done?'✓':'')+'</div>'
        +'<div class="commit-body">'
          +'<span class="commit-text">'+escapeHtml(c.text)+'</span>'
          +(time?'<span class="commit-time">'+escapeHtml(time)+'</span>':'')
        +'</div>'
      +'</div>';
    });
    html+='</div>';
  }else{
    html+='<div class="planner-empty-line">No scheduled commitments today.</div>';
  }

  var train=plannerTrainingLine(todayKey);
  if(train)html+=train;

  html+='</div>';
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
  return '<div class="planner-train-line"><span class="planner-train-icon">'+icon+'</span>'
    +'<span class="planner-train-text">'+escapeHtml(text)+'</span></div>';
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
      html+='<div class="focus-row'+(t.done?' done':'')+'">'
        +'<div class="focus-check" onclick="plannerToggleFocusDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(t.text)+'">'+(t.done?'✓':'')+'</div>'
        +'<span class="focus-text">'+escapeHtml(t.text)+'</span>'
        +'<button class="focus-remove" onclick="plannerRemoveFocus(\''+t.id+'\')" title="Remove from today\'s focus" aria-label="Remove from today\'s focus">×</button>'
      +'</div>';
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
  toggleCommitment(id);
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
