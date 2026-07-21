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
  renderPlannerInbox();
}

// ── Inbox tab ──────────────────────────────────────────────
function renderPlannerInbox(){
  var el=document.getElementById('planner-inbox');
  if(!el)return;
  var inbox=getInboxTasks();
  if(!inbox.length){
    el.innerHTML='<div class="card planner-card"><div class="planner-empty-line">Inbox clear — everything has a home.</div></div>';
    return;
  }
  var html='<div class="card planner-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>Inbox</span>'
    +'<span class="planner-card-count">'+inbox.length+'</span></div>';
  html+='<div class="planner-inbox-list">';
  inbox.forEach(function(t){
    html+='<div class="inbox-row">'
      +'<div class="inbox-check" onclick="plannerToggleFocusDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Complete '+escapeHtml(t.text)+'"></div>'
      +'<span class="inbox-text">'+escapeHtml(t.text)+'</span>'
      +'<button class="btn btn-ghost btn-sm inbox-focus" onclick="plannerInboxMakeFocus(\''+t.id+'\')" title="Make today\'s focus">Focus</button>'
      +(typeof openTaskEditModal==='function'?'<button class="inbox-edit" onclick="openTaskEditModal(\''+t.id+'\')" title="Set date/time" aria-label="Set date or time">⋯</button>':'')
      +'<button class="inbox-delete" onclick="deleteInboxTask(\''+t.id+'\')" title="Delete" aria-label="Delete task">×</button>'
    +'</div>';
  });
  html+='</div></div>';
  el.innerHTML=html;
}

function deleteInboxTask(id){
  if(typeof confirmDelete==='function'){
    confirmDelete('Remove this task?',function(){
      STATE.tasks=(STATE.tasks||[]).filter(function(t){return t.id!==id});
      saveState();renderPlanner();
    });
  }else{
    STATE.tasks=(STATE.tasks||[]).filter(function(t){return t.id!==id});
    saveState();renderPlanner();
  }
}

// ── Today tab ──────────────────────────────────────────────
function renderPlannerToday(){
  var el=document.getElementById('planner-today');
  if(!el)return;
  var todayKey=localDateKey(new Date());
  // Order: welcome → evening sweep → training → habits → schedule → focus → water+weight → capture.
  el.innerHTML=plannerWelcomeCard()+plannerEveningSweepCard(todayKey)+plannerTrainingCard(todayKey)+plannerHabitCard()+plannerScheduleCard(todayKey)+plannerFocusCard(todayKey)+plannerWaterCard()+plannerCaptureCard();
  // Keep the PWA app-icon badge in sync with today's open focus count (3.5).
  if(typeof updateAppBadge==='function')updateAppBadge();
  // Evening sweep: fetch the AI one-liner once the card is in the DOM (§evening).
  loadEveningSweep(todayKey);
}

// Evening sweep (AI): after ~5pm, a single generated sentence reflecting the
// day ("3/4 habits, strength done, water low again"). Cheap (~50 tokens),
// cached per stats-signature so it only regenerates when something changes.
// Renders an empty placeholder card synchronously; loadEveningSweep fills it.
function plannerEveningSweepCard(todayKey){
  if(new Date().getHours()<17)return '';
  return '<div class="card planner-card planner-sweep-card" id="planner-sweep-card" style="display:none">'
    +'<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>Evening sweep</span></div>'
    +'<div class="planner-sweep-body" id="planner-sweep-body"></div>'
  +'</div>';
}

function computeEveningSweepStats(todayKey){
  var habits=(STATE.habits||[]).filter(function(h){
    var s=(typeof habitDayStatus==='function')?habitDayStatus(h,todayKey):'todo';
    return s==='done'||s==='todo';
  });
  var habitsTotal=habits.length;
  var habitsDone=habits.filter(function(h){return h.logs&&h.logs[todayKey]}).length;
  var training=null;
  var logged=(typeof plannerTrainingLoggedToday==='function')?plannerTrainingLoggedToday(todayKey):'';
  var t=(typeof todaysTrainingSession==='function')?todaysTrainingSession(todayKey):null;
  if(logged)training=logged+' logged';
  else if(t&&t.session==='rest')training='rest day';
  else if(t)training=(t.label||'training')+' still to do';
  var glasses=(STATE.water&&STATE.water[todayKey])||0;
  var target=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  var waterPct=Math.min(100,Math.round((glasses/Math.max(1,target))*100));
  var focus=(STATE.tasks||[]).filter(function(x){return x&&x.focusDate===todayKey});
  var focusTotal=focus.length;
  var focusDone=focus.filter(function(x){return x.done}).length;
  if(habitsTotal===0&&!training&&glasses===0&&focusTotal===0)return null;
  return {habitsDone:habitsDone,habitsTotal:habitsTotal,training:training,waterPct:waterPct,focusDone:focusDone,focusTotal:focusTotal};
}

function loadEveningSweep(todayKey){
  var card=document.getElementById('planner-sweep-card');
  if(!card)return;
  if(typeof NOTIF_API==='undefined'||!NOTIF_API)return;
  var stats=computeEveningSweepStats(todayKey);
  if(!stats)return;
  var body=document.getElementById('planner-sweep-body');
  var sig=[stats.habitsDone,stats.habitsTotal,stats.training,stats.waterPct,stats.focusDone,stats.focusTotal].join('|').replace(/[^a-z0-9]/gi,'');
  var cacheKey='lh_sweep_'+todayKey+'_'+sig;
  try{var cached=localStorage.getItem(cacheKey);if(cached){body.textContent=cached;card.style.display='';return}}catch(e){}
  body.innerHTML='<span class="planner-sweep-loading">Reading your day…</span>';
  card.style.display='';
  fetch(NOTIF_API+'/api/ai-narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sweep:stats})})
    .then(function(r){return r.json()}).then(function(d){
      if(d&&d.sweep){body.textContent=d.sweep;try{localStorage.setItem(cacheKey,d.sweep)}catch(e){}}
      else card.style.display='none';
    }).catch(function(){card.style.display='none'});
}

// Welcome masthead — washi-tape decoration, greeting, status chips, quote.
// Reuses getTimeContext() from dashboard.js and hardcodes user name "Kai".
function plannerWelcomeCard(){
  var tc=getTimeContext(); // {slot, greeting, class}
  var now=new Date();
  var dateStr=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  var todayKey=localDateKey(now);

  // Streak (showUpStreak from dashboard.js)
  var streak=(typeof showUpStreak==='function')?showUpStreak():0;
  // Training today?
  var hasTraining=false;
  if(typeof todaysTrainingSession==='function'){
    var ts=todaysTrainingSession(todayKey);
    hasTraining=!!(ts&&ts.session!=='rest');
  }
  // Focus count
  var focusTasks=(STATE.tasks||[]).filter(function(t){return t&&t.focusDate===todayKey&&!t.done});
  var focusCount=focusTasks.length;

  // Status chips
  var chips='<div class="pw-welcome-chips">';
  if(streak>=2)chips+='<span class="pw-chip pw-chip-streak">\uD83D\uDD25 '+streak+' day streak</span>';
  if(hasTraining)chips+='<span class="pw-chip pw-chip-training">\uD83C\uDFCB\uFE0F training day</span>';
  if(focusCount>0)chips+='<span class="pw-chip pw-chip-focus">\uD83C\uDFAF '+focusCount+' to focus on</span>';
  chips+='</div>';

  // Quote
  var quotes=CONTEXTUAL_QUOTES&&CONTEXTUAL_QUOTES[tc.slot]?CONTEXTUAL_QUOTES[tc.slot]:['One thing at a time.'];
  var quote=quotes[Math.floor(now.getMinutes()/15)%quotes.length]||quotes[0];

  return ''
    +'<div class="card planner-card planner-welcome-card">'
      +'<span class="pw-washi-tape" aria-hidden="true"></span>'
      +'<div class="pw-welcome-greet">'+tc.greeting+', Kai \u2728</div>'
      +'<div class="pw-welcome-date">'+dateStr+' \u2014 a quiet, open day.</div>'
      +chips
      +'<div class="pw-welcome-divider"></div>'
      +'<div class="pw-welcome-quote">\u201C'+escapeHtml(quote)+'\u201D</div>'
    +'</div>';
}

// Water + Weight side-by-side row — two mini cards in a grid.
// Water: filling glass + count + add button.
// Weight: latest value + weekly change + log button.
function plannerWaterCard(){
  var today=localDateKey(new Date());
  var glasses=(STATE.water&&STATE.water[today])||0;
  var target=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  var pct=Math.min(100,Math.round((glasses/Math.max(1,target))*100));

  // Weight data
  var weights=((STATE.metrics||{}).weight||[]).slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date))});
  var latestW=weights.length?weights[weights.length-1].value:null;
  var weekAgo=localDateKey(new Date(Date.now()-7*86400000));
  var weekWeight=weights.filter(function(w){return w.date<=weekAgo});
  var prevW=weekWeight.length?weekWeight[weekWeight.length-1].value:null;
  var weightChange=null,weightDir='',weightClass='';
  if(latestW!=null&&prevW!=null){
    weightChange=Math.round((latestW-prevW)*10)/10;
    if(weightChange<0){weightDir='\u2193 '+Math.abs(weightChange);weightClass='pw-weight-down';}
    else if(weightChange>0){weightDir='\u2191 '+weightChange;weightClass='pw-weight-up';}
    else{weightDir='\u2194 0';weightClass='';}
  }

  return ''
    +'<div class="planner-water-weight-row" id="planner-water-card">'
      +'<div class="card planner-card pw-water-mini">'
        +'<div class="pw-mini-title">Water</div>'
        +'<div class="pw-glass-illus" aria-hidden="true"><div class="pw-glass-fill" style="height:'+pct+'%"></div></div>'
        +'<div class="pw-water-count">'+glasses+' / '+target+'</div>'
        +'<div class="pw-water-sub">glasses \u00B7 '+pct+'%</div>'
        +'<button class="pw-water-btn" onclick="logWaterGlass('+(glasses+1)+')">+ glass</button>'
      +'</div>'
      +'<div class="card planner-card pw-weight-mini">'
        +'<div class="pw-mini-title">\u2696\uFE0F Weight</div>'
        +(latestW!=null?'<div class="pw-weight-val">'+latestW+' kg</div>':'<div class="pw-weight-val">\u2014</div>')
        +(weightChange!=null?'<div class="pw-weight-change '+weightClass+'">'+weightDir+' this week</div>':'')
        +'<button class="pw-weight-btn" onclick="openModal(\'logMetric\',\'weight\')">Log</button>'
      +'</div>'
    +'</div>';
}

// Re-render ONLY the water widget in place.
function renderPlannerWater(){
  var el=document.getElementById('planner-today');
  if(!el)return;
  var host=document.getElementById('planner-water-card');
  if(!host)return;
  host.outerHTML=plannerWaterCard();
}

// Habits card — top coral border, hand-drawn underline, tappable rows.
function plannerHabitCard(){
  var today=localDateKey(new Date());
  var habits=(STATE.habits||[]).filter(function(h){
    var s=habitDayStatus(h,today);
    return s==='done'||s==='todo';
  });
  var rows;
  if(!habits.length){
    rows='<div class="planner-empty-line">No habits due today \u2014 enjoy the breather.</div>';
  } else {
    rows='<div class="pw-habits-list">';
    rows+=habits.map(function(h){
      var done=!!(h.logs&&h.logs[today]);
      return '<div class="pw-habit-row'+(done?' done':'')+'" onclick="plannerToggleHabit(\''+h.id+'\')">'
        +'<div class="pw-habit-check" role="button" tabindex="0" data-tick="pwhab:'+h.id+'"'
          +' aria-label="Toggle '+escapeHtml(h.name)+'">'+(done?'\u2713':'')+'</div>'
        +'<span class="pw-habit-name">'+(h.icon?escapeHtml(h.icon)+' ':'')+escapeHtml(h.name)+'</span>'
      +'</div>';
    }).join('');
    rows+='</div>';
  }
  var doneCount=habits.filter(function(h){return h.logs&&h.logs[today]}).length;
  // Hand-drawn underline SVG
  var wavySvg='<svg class="pw-wavy-underline" viewBox="0 0 220 6" preserveAspectRatio="none" aria-hidden="true"><path d="M0 3 Q10 0 20 3 T40 3 T60 3 T80 3 T100 3 T120 3 T140 3 T160 3 T180 3 T200 3 T220 3" fill="none" stroke="#c97b6e" stroke-width="1.5" opacity="0.4"/></svg>';
  return ''
    +'<div class="card planner-card planner-habits-card" id="planner-habits-card">'
      +'<div class="planner-card-head"><span class="planner-card-title">Habits</span>'
        +'<span class="pw-habit-count">'+doneCount+' / '+habits.length+'</span></div>'
      +wavySvg
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
  var pwWasDone=!!h.logs[today];
  h.logs[today]=!h.logs[today];
  saveState();
  // Re-render just the planner habit widget in place
  var host=document.getElementById('planner-habits-card');
  if(host)host.outerHTML=plannerHabitCard();
  if(!pwWasDone&&h.logs[today]&&typeof bloomTick==='function')bloomTick('pwhab:'+hid);
  // Keep Dashboard habit views in sync (guarded)
  if(typeof renderDashboard==='function')renderDashboard();
}

// Schedule — vertical dashed timeline with colored dots and "now" line.
function plannerScheduleCard(todayKey){
  var commitments=getTodayCommitments(todayKey);
  var timedTasks=getTodayTimedTasks(todayKey);

  var items=[];
  commitments.forEach(function(c){
    items.push({kind:'commit',id:c.id,text:c.text,time:c.start||'',end:c.end||'',recur:c.recur,done:c.done});
  });
  timedTasks.forEach(function(t){
    items.push({kind:'task',id:t.id,text:t.text,time:t.dueTime||'',end:'',done:!!t.done});
  });
  items.sort(function(a,b){return String(a.time||'99:99').localeCompare(String(b.time||'99:99'))});

  var dotColors=['#8a6545','#c97b6e','#d4a96a','#6b9e7a','#b0563c'];

  var html='<div class="card planner-card planner-schedule-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">Schedule</span>'
    +'<button class="btn btn-sm btn-ghost" onclick="openModal(\'addTimeBlock\')" title="Add time block">+ Block</button></div>';

  if(items.length){
    var nowHM=(function(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)})();
    var nowShown=false;
    html+='<div class="pw-schedule-timeline">';
    items.forEach(function(it,idx){
      if(!nowShown&&it.time&&it.time>=nowHM){
        html+='<div class="pw-now-line"><span class="pw-now-text">now \u00B7 '+escapeHtml(nowHM)+'</span></div>';
        nowShown=true;
      }
      var time=(it.time||'')+((it.time&&it.end)?'\u2013'+it.end:'');
      var toggle=it.kind==='commit'?'plannerToggleCommitment':'plannerToggleFocusDone';
      var dotColor=dotColors[idx%dotColors.length];
      html+='<div class="pw-sched-row'+(it.done?' done':'')+'">'
        +'<span class="pw-sched-dot" style="background:'+dotColor+'"></span>'
        +'<div class="pw-sched-body">'
          +'<div class="pw-sched-check'+(it.done?' done':'')+'" onclick="'+toggle+'(\''+it.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(it.text)+'">'+(it.done?'\u2713':'')+'</div>'
          +'<span class="pw-sched-text">'+escapeHtml(it.text)+(it.kind==='commit'&&it.recur==='weekly'?' <span class="commit-recur" title="Repeats weekly">\u21BB</span>':'')+'</span>'
          +(time?'<span class="pw-sched-time">'+escapeHtml(time)+'</span>':(it.kind==='task'?'<span class="pw-sched-time pw-sched-time-task">task</span>':''))
        +'</div>'
        +'<button class="commit-delete" onclick="deleteTimeBlock(\''+it.id+'\',\''+it.kind+'\')" title="Remove" aria-label="Remove">\u00D7</button>'
      +'</div>';
    });
    if(!nowShown){
      html+='<div class="pw-now-line"><span class="pw-now-text">now \u00B7 '+nowHM+'</span></div>';
    }
    html+='</div>';
  }else{
    html+='<div class="planner-empty-line">Nothing time-blocked today. Tap + Block to plan your day.</div>';
  }

  html+='</div>';
  return html;
}

// Delete a time block (commitment or timed task) and re-render.
function deleteTimeBlock(id,kind){
  if(kind==='commit'){
    STATE.commitments=(STATE.commitments||[]).filter(function(c){return c.id!==id});
  }else{
    var t=(STATE.tasks||[]).find(function(x){return x.id===id});
    if(t){delete t.dueTime;delete t.dueDate;}
  }
  saveState();renderPlanner();
}

// Save a new time block (commitment) from the modal.
function saveTimeBlock(){
  var text=((document.getElementById('m-tb-text')||{}).value||'').trim();
  if(!text)return;
  var date=(document.getElementById('m-tb-date')||{}).value||localDateKey(new Date());
  var start=(document.getElementById('m-tb-start')||{}).value||'';
  var end=(document.getElementById('m-tb-end')||{}).value||'';
  var recur=(document.getElementById('m-tb-recur')||{}).checked?'weekly':'';
  if(!STATE.commitments)STATE.commitments=[];
  STATE.commitments.push({id:g(),text:text,date:date,start:start,end:end,done:false,recur:recur,createdAt:new Date().toISOString()});
  saveState();closeModal();renderPlanner();
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

// Detect whether a training session has already been logged for `dateKey`.
// A strength/gym/rest session lands in STATE.workouts; a run lands in
// STATE.metrics.run. Returns a short label for the done state, or null.
function plannerTrainingLoggedToday(dateKey){
  var w=(STATE.workouts||[]).filter(function(x){return x&&x.date===dateKey});
  if(w.length){
    var first=w[0];
    return first.type||first.name||'Session';
  }
  var runs=((STATE.metrics||{}).run||[]).filter(function(r){return r&&r.date===dateKey});
  if(runs.length)return 'Run';
  return null;
}

// Part 3 (3.2): today's training promoted to a standalone card.
// Gradient card with watermark emoji, accent bar, "TRAINING DAY" badge.
function plannerTrainingCard(todayKey){
  if(typeof todaysTrainingSession!=='function')return '';
  var t=todaysTrainingSession(todayKey);
  if(!t)return '';

  var icon,text,isRest=(t.session==='rest');
  if(isRest){
    icon='\uD83C\uDF3F';text=(t.label||'Rest')+(t.sub?' \u00B7 '+t.sub:'');
  }else if(t.isRace){
    icon='\uD83C\uDFC1';text=t.label+' \u00B7 '+(t.desc||'');
  }else{
    var def=(typeof workoutDef==='function')?workoutDef(t.session):null;
    if(def){
      icon=def.emoji||'\uD83C\uDFCB\uFE0F';
      text=t.label+' \u00B7 '+def.exercises.length+' exercises';
    }else{
      icon=(t.runType==='long')?'\uD83C\uDFC3':(t.runType==='quality')?'\u26A1':'\uD83C\uDFC3';
      text=t.label+(t.desc?' \u00B7 '+t.desc:(t.sub?' \u00B7 '+t.sub:''));
    }
  }

  // Watermark emoji
  var watermark=isRest?'\uD83C\uDF3F':(t.session==='run'?'\uD83C\uDFC3':'\uD83C\uDFCB\uFE0F');

  // "TRAINING DAY" badge on active days; rest days stay calm.
  var badge=isRest?'':'<span class="pw-train-badge">TRAINING DAY</span>';
  // Editable run-days control
  var editBtn=(t.block&&!isRest)?'<button class="planner-train-edit" onclick="openModal(\'editRunDays\')" title="Adjust run days" aria-label="Adjust run days">\u22EF</button>':'';

  var html='<div class="card planner-card planner-training-card" id="planner-training-card">';
  html+='<span class="pw-train-watermark" aria-hidden="true">'+watermark+'</span>';
  html+='<div class="planner-card-head"><span class="planner-card-title"><span class="pw-train-bar"></span>Today\'s training</span>'+badge+editBtn+'</div>';
  html+='<div class="planner-train-line"><span class="planner-train-icon">'+icon+'</span>'
    +'<span class="planner-train-text">'+escapeHtml(text)+'</span></div>';

  // In-block run session detail
  if(t.block&&!isRest){
    if(t.desc&&t.session==='run'&&!t.isRace)html+='<div class="planner-train-desc">'+escapeHtml(t.desc)+'</div>';
    if(t.detail)html+='<div class="planner-train-pace">'+escapeHtml(t.detail)+'</div>';
    if(t.easyRun)html+='<div class="planner-train-desc">then easy run \u00B7 '+escapeHtml(t.easyRun)+(t.easyDetail?' ('+escapeHtml(t.easyDetail)+')':'')+'</div>';
    if(t.fuelText)html+='<div class="planner-train-fuel">\uD83E\uDD64 '+escapeHtml(t.fuelText)+'</div>';
    if(t.isRace&&t.raceStrategy)html+='<div class="planner-train-desc">'+escapeHtml(t.raceStrategy)+'</div>';
    else if(t.block.phase==='race week'&&!t.isRace)html+='<div class="planner-train-fuel">race week \u2014 keep it light</div>';
    var ctxBits=['Week '+t.block.n+' of '+t.block.total];
    if(t.block.daysToBirthday!=null&&t.block.daysToBirthday>0)ctxBits.push(t.block.daysToBirthday+' days to your birthday');
    ctxBits.push(t.block.daysToRace+' days to race day');
    html+='<div class="planner-train-context">'+ctxBits.join(' \u00B7 ')+'</div>';
  }

  var logged=plannerTrainingLoggedToday(todayKey);
  if(logged){
    html+='<div class="planner-train-done">'+escapeHtml(logged)+' \u2713 logged</div>';
  }else{
    html+='<div class="planner-train-actions">';
    if(isRest){
      html+='<button class="btn btn-sm pw-train-log-btn" onclick="quickLogToday(\'Rest\')">Log rest \uD83C\uDF3F</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Gym\')">Gym</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="openModal(\'logRun\')">Run</button>';
    }else if(t.session==='run'){
      html+='<button class="btn btn-sm pw-train-log-btn" onclick="openModal(\'logRun\')">Log run \uD83C\uDFC3</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Gym\')">Gym</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Rest\')">Rest</button>';
      if(t.runType)html+='<button class="btn btn-sm btn-ghost" onclick="openModal(\'moveRun\',\''+t.runType+'\')" title="Move this run to another day">Move to\u2026</button>';
    }else{
      html+='<button class="btn btn-sm pw-train-log-btn" onclick="quickLogToday(\'Gym\')">Log gym \uD83D\uDCAA</button>';
      if(t.run)html+='<button class="btn btn-sm btn-ghost" onclick="openModal(\'logRun\')">Recovery run</button>';
      else html+='<button class="btn btn-sm btn-ghost" onclick="openModal(\'logRun\')">Run</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Rest\')">Rest</button>';
    }
    html+='</div>';
  }

  html+='</div>';
  return html;
}

// "Daily Focus (1–3)" — lined-notebook style with rounded-square checkboxes.
function plannerFocusCard(todayKey){
  var focus=getTodayFocus(todayKey);
  var doneCount=focus.filter(function(t){return t.done}).length;

  var html='<div class="card planner-card planner-focus-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title">Daily focus</span>'
    +(focus.length?'<span class="planner-card-count">'+doneCount+'/'+focus.length+'</span>':'<span class="pw-focus-hint">just 3 things</span>')
    +'</div>';

  if(focus.length){
    html+='<div class="planner-focus-list">';
    focus.forEach(function(t){
      var canEdit=(typeof openTaskEditModal==='function');
      html+='<div class="focus-row'+(t.done?' done':'')+'">'
        +'<div class="focus-check" data-tick="focus:'+t.id+'" onclick="plannerToggleFocusDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(t.text)+'">'+(t.done?'\u2713':'')+'</div>'
        +'<span class="focus-text"'+(canEdit?' onclick="openTaskEditModal(\''+t.id+'\')" style="cursor:pointer"':'')+'>'+escapeHtml(t.text)+'</span>'
        +'<button class="focus-remove" onclick="plannerRemoveFocus(\''+t.id+'\')" title="Remove from today\'s focus" aria-label="Remove from today\'s focus">\u00D7</button>'
      +'</div>';
      // Nested micro-steps
      var subs=t.subSteps||[];
      if(subs.length){
        html+='<div class="focus-substeps">';
        subs.forEach(function(s,si){
          html+='<div class="focus-substep'+(s.done?' done':'')+'">'
            +'<div class="focus-substep-tick" onclick="plannerToggleSubStep(\''+t.id+'\','+si+')" role="button" tabindex="0" aria-label="Toggle step '+escapeHtml(s.text)+'">'+(s.done?'\u2713':'')+'</div>'
            +'<span class="focus-substep-text">'+escapeHtml(s.text)+'</span>'
          +'</div>';
        });
        html+='</div>';
      }
    });
    html+='</div>';

    if(doneCount===focus.length){
      html+='<div class="planner-focus-done">All '+focus.length+' focus task'+(focus.length===1?'':'s')+' done today.</div>';
    }

    if(focus.length<3){
      if(plannerFocusChooserOpen)html+=plannerFocusChooser(todayKey);
      else html+='<button class="btn btn-ghost btn-sm planner-focus-add" onclick="plannerShowFocusChooser()">+ Add a focus task</button>';
    }
  }else{
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

// Quick-capture — dashed torn-note style card (R12.1)
function plannerCaptureCard(){
  return '<div class="card planner-card planner-capture-card">'
    +'<div class="planner-capture-row">'
      +'<input type="text" id="planner-capture-input" class="planner-capture-input" placeholder="jot something down\u2026" onkeydown="if(event.key===\'Enter\')plannerQuickCapture()">'
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
    if(typeof bloomTick==='function')bloomTick('focus:'+id);
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
  el.innerHTML=plannerIntentionCard(wkKey)+plannerBlockScheduleCard(wkKey)+plannerWeekTasksCard(wkKey)+plannerFixedTasksCard(wkKey)+plannerNextWeekCard(wkKey);
}

// Read-only training schedule for the current HM block week (addendum §2.4):
// the three runs + two strength sessions laid out by day, above the week's
// life tasks. Returns '' outside the block so nothing shows off-plan.
function plannerBlockScheduleCard(wkKey){
  if(typeof todaysTrainingSession!=='function'||typeof weekDays!=='function')return '';
  var ctx=(typeof resolveHmWeek==='function')?resolveHmWeek(localDateKey(new Date())):null;
  if(!ctx)return '';
  var days=weekDays(wkKey);            // Sun-first date keys
  var dayShort=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var todayKey=localDateKey(new Date());
  function row(dow,isToday,icon,label,detail){
    return '<div class="planner-sched-row'+(isToday?' is-today':'')+'">'
      +'<span class="planner-sched-day">'+dayShort[dow]+'</span>'
      +'<span class="planner-sched-icon">'+icon+'</span>'
      +'<span class="planner-sched-body"><span class="planner-sched-label">'+escapeHtml(label)+'</span>'
      +(detail?'<span class="planner-sched-detail">'+escapeHtml(detail)+'</span>':'')+'</span>'
    +'</div>';
  }
  var rows='';
  days.forEach(function(dk){
    var s=todaysTrainingSession(dk);
    if(!s||s.session==='rest')return;
    var dow=new Date(dk+'T12:00:00').getDay();
    var isToday=dk===todayKey;
    if(s.session==='strength-a'||s.session==='strength-b'){
      rows+=row(dow,isToday,'🏋️',s.label,s.desc||s.sub||'');
      if(s.easyRun)rows+=row(dow,isToday,'🏃','Easy run',s.easyRun);
    }else{
      var icon=s.isRace?'🏁':(s.runType==='quality'?'⚡':'🏃');
      rows+=row(dow,isToday,icon,s.label,s.desc||s.sub||'');
    }
  });
  if(!rows)return '';
  var html='<div class="card planner-card planner-sched-card">';
  html+='<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>This week\'s training</span><span class="planner-card-count">Week '+ctx.n+' of '+ctx.total+'</span></div>';
  html+='<div class="planner-sched-list">'+rows+'</div>';
  html+='<div class="planner-sched-foot">Training\'s already laid out — planning is just for life tasks.</div>';
  html+='</div>';
  return html;
}

// Part 3 (3.4): "Set up next week" — surfaces on the current week on/after
// Saturday (the last day of the Sun→Sat week). Lets you (a) set next week's
// intention (stored like STATE.weeklyIntention, keyed to next week's weekKey)
// and (b) bring unfinished weekPriority tasks along by re-tagging them to next
// week. Zero-guilt: unfinished tasks are framed as "bring these along", never
// as failures. Reuses weekKey()/weekDays() and the shared tasks model.
function nextWeekKey(){
  var d=new Date();
  d.setDate(d.getDate()+7);
  return weekKey(d);
}
function plannerNextWeekCard(wkKey){
  // Only from Saturday (getDay()===6) — the final day of the current week.
  if(new Date().getDay()!==6)return '';
  var nextWk=nextWeekKey();
  var intention=STATE.weeklyIntention;
  var nextText=(intention&&intention.weekKey===nextWk)?(intention.text||''):'';
  var carryover=getWeekTasks(wkKey).filter(function(t){return t&&!t.done});

  var html='<div class="card planner-card planner-nextweek-card card-hero-tier">';
  html+='<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>Set up next week</span></div>';
  html+='<div class="planner-nextweek-sub">A calm head start — jot an intention and bring along anything you\'d still like to do.</div>';

  // (a) Next week's intention
  html+='<div class="planner-intention-row">'
    +'<input type="text" id="planner-next-intention-input" class="planner-intention-input" placeholder="One intention for next week…" value="'+escapeHtml(nextText)+'" onkeydown="if(event.key===\'Enter\')plannerSaveNextIntention()">'
    +'<button class="planner-intention-btn" onclick="plannerSaveNextIntention()">Save</button>'
  +'</div>';
  if(nextText){
    html+='<div class="planner-intention-current">Set for next week.</div>';
  }

  // (b) Carry-forward unfinished tasks
  if(carryover.length){
    html+='<div class="planner-nextweek-carry-label">Bring these along?</div>';
    html+='<div class="planner-nextweek-list">';
    carryover.forEach(function(t){
      html+='<div class="nextweek-row">'
        +'<div class="nextweek-check" onclick="plannerCarryForward(\''+t.id+'\')" role="button" tabindex="0" aria-label="Bring '+escapeHtml(t.text)+' to next week"></div>'
        +'<span class="nextweek-text">'+escapeHtml(t.text)+'</span>'
        +'<button class="btn btn-ghost btn-sm nextweek-bring" onclick="plannerCarryForward(\''+t.id+'\')" title="Bring to next week">Bring along →</button>'
      +'</div>';
    });
    html+='</div>';
  }else{
    html+='<div class="planner-empty-line">Nothing left hanging — a clean slate for next week.</div>';
  }

  html+='</div>';
  return html;
}

// Save next week's intention (stored like weeklyIntention, keyed to next week).
function plannerSaveNextIntention(){
  var inp=document.getElementById('planner-next-intention-input');
  if(!inp)return;
  STATE.weeklyIntention={weekKey:nextWeekKey(),text:(inp.value||'').trim()};
  saveState();
  renderPlanner();
}

// Bring an unfinished task along to next week by re-tagging its weekPriority.
function plannerCarryForward(taskId){
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t)return;
  t.weekPriority=nextWeekKey();
  saveState();
  renderPlanner();
  if(typeof showCelebrationToast==='function')showCelebrationToast('Brought along to next week','🌱');
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
