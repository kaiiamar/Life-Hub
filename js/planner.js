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

// Weekly intentions are keyed so setting up next week never overwrites the
// current week's intention. The legacy single object remains a read fallback
// and is updated with the latest edit for compatibility with older clients.
function weeklyIntentionText(wkKey){
  var keyed=STATE.weeklyIntentions&&STATE.weeklyIntentions[wkKey];
  if(typeof keyed==='string')return keyed;
  if(keyed&&typeof keyed.text==='string')return keyed.text;
  var legacy=STATE.weeklyIntention;
  return (legacy&&legacy.weekKey===wkKey&&typeof legacy.text==='string')?legacy.text:'';
}
function setWeeklyIntention(text,wkKey){
  var key=wkKey||weekKey(new Date());
  var clean=(text||'').trim();
  if(!STATE.weeklyIntentions||typeof STATE.weeklyIntentions!=='object'||Array.isArray(STATE.weeklyIntentions))STATE.weeklyIntentions={};
  var legacy=STATE.weeklyIntention;
  if(legacy&&legacy.weekKey&&typeof legacy.text==='string'&&!STATE.weeklyIntentions[legacy.weekKey]){
    STATE.weeklyIntentions[legacy.weekKey]={weekKey:legacy.weekKey,text:legacy.text};
  }
  if(clean){
    var entry={weekKey:key,text:clean};
    STATE.weeklyIntentions[key]=entry;
    STATE.weeklyIntention=entry;
  }else{
    delete STATE.weeklyIntentions[key];
    if(STATE.weeklyIntention&&STATE.weeklyIntention.weekKey===key)STATE.weeklyIntention=null;
  }
  saveState();
  return clean?STATE.weeklyIntentions[key]:null;
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
// Today-tab view mode: null = the whole day, 'short' = the Short_Version.
// Written only by the re-entry view-mode handlers below (plannerOpenShortVersion,
// plannerLeaveShortVersion, plannerDismissReentry). While it is null,
// plannerTodayOrder() returns the full day.
var plannerViewMode=null;
// Whether the re-entry card is currently showing the quiet-period recap. The
// recap is opt-in (R7.1), so it starts closed and plannerToggleRecap() flips it.
var plannerReentryRecapOpen=false;

// Switch between the Today / This week / Inbox tabs (R12.4).
// Renders only the tab being shown rather than all three — the two hidden panes
// cannot have changed since they were last drawn, and rebuilding them throws
// away any input state they hold (R17.4).
function switchPlannerTab(tab,btn){
  var strip=btn&&btn.parentNode;
  if(strip){
    strip.querySelectorAll('.page-tab').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
  }
  document.querySelectorAll('#page-planner .planner-tab').forEach(function(p){p.classList.remove('active')});
  var pane=document.getElementById('planner-'+tab);
  if(pane)pane.classList.add('active');
  renderPlannerTab(tab);
}

// Draw one Planner tab by name. Unknown names draw nothing.
function renderPlannerTab(tab){
  if(tab==='today')renderPlannerToday();
  else if(tab==='week'){if(typeof renderPlannerWeek==='function')renderPlannerWeek()}
  else if(tab==='inbox')renderPlannerInbox();
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
  // Also include done inbox tasks (completed in-place) for done styling
  var allInbox=(STATE.tasks||[]).filter(function(t){
    return t&&!t.dueDate&&!t.weekPriority&&!t.focusDate;
  });
  // Use only open inbox tasks for count / empty state
  var openCount=inbox.length;

  var html='';
  // Header
  html+='<div class="card planner-card pw-inbox-header-card card-quiet">';
  html+='<div class="pw-inbox-head"><span class="pw-inbox-title">Inbox</span>'
    +(openCount?'<span class="pw-inbox-pill">'+openCount+' to sort</span>':'')+'</div>';
  html+='<div class="pw-inbox-helper">Empty your head here \u2014 sort it out later.</div>';
  html+='</div>';

  // Capture input — its own root id, since the Today tab renders this card too.
  html+=plannerCaptureCard('planner-inbox-capture-card');

  if(!openCount){
    html+='<div class="card planner-card pw-inbox-empty card-quiet"><span class="pw-inbox-empty-icon">\uD83D\uDCE5</span><span class="pw-inbox-empty-text">All clear. Nothing to sort.</span></div>';
  }else{
    // Task cards — each is a separate card
    inbox.forEach(function(t){
      html+='<div class="card planner-card pw-inbox-task-card card-quiet">'
        +'<div class="pw-inbox-task-row">'
          +'<div class="pw-inbox-check" onclick="plannerToggleFocusDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Complete '+escapeHtml(t.text)+'"></div>'
          +'<span class="pw-inbox-text">'+escapeHtml(t.text)+'</span>'
          +'<button class="pw-inbox-delete" onclick="deleteInboxTask(\''+t.id+'\')" title="Delete" aria-label="Delete task">\u00D7</button>'
        +'</div>'
      +'</div>';
    });
  }

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
// The Today tab is a registry of cards rather than one long concatenation, so a
// single mutation can re-render only the cards it actually touched instead of
// reassigning the whole subtree (R17.1, R17.5).
//
//   host  — the stable DOM id that builder's root element carries, so a card can
//           be found and replaced in place.
//   build — (todayKey) → markup rooted on `host`, or '' when the card does not
//           apply today. Every build is wrapped so the contract is uniform even
//           for builders that take no argument.
//
// PLANNER_INPUT_CARDS is declared in this same statement, directly beside the
// registry: those two cards can hold a focused text input and are therefore
// skipped by an in-place patch that did not originate inside them. Keeping the
// list here is the mitigation for it being a manual invariant — a card added
// above with a text input has to be added below as well.
var PLANNER_CARDS={
  reentry:    {host:'pc-reentry',            build:function(todayKey){return plannerReentryCard(todayKey)}},
  welcome:    {host:'planner-welcome-card',  build:function(todayKey){return plannerWelcomeCard(todayKey)}},
  training:   {host:'planner-training-card', build:function(todayKey){return plannerTrainingCard(todayKey)}},
  habits:     {host:'planner-habits-card',   build:function(){return plannerHabitCard()}},
  focus:      {host:'planner-focus-card',    build:function(todayKey){return plannerFocusCard(todayKey)}},
  suggested:  {host:'pc-suggested',          build:function(todayKey){return plannerSuggestedCard(todayKey)}},
  schedule:   {host:'planner-schedule-card', build:function(todayKey){return plannerScheduleCard(todayKey)}},
  capture:    {host:'planner-capture-card',  build:function(){return plannerCaptureCard('planner-capture-card')}},
  waterweight:{host:'planner-water-card',    build:function(){return plannerWaterCard()}},
  gratitude:  {host:'planner-gratitude-card',build:function(todayKey){return plannerGratitudeCard(todayKey)}},
  monthreview:{host:'planner-monthreview-card',build:function(todayKey){return plannerMonthReviewCard(todayKey)}},
  sweep:      {host:'planner-sweep-card',    build:function(todayKey){return plannerCloseDayCard(todayKey)}},
  inbox:      {host:'planner-inbox-card',    build:function(){return plannerInboxCard()}},
  short:      {host:'pc-short',              build:function(todayKey){return plannerShortVersionCard(todayKey)}}
},
PLANNER_INPUT_CARDS=['capture','sweep','gratitude'];

// The cards that change when a task joins or leaves today's focus slate — one
// row of the mutation table in Components §C, shared by every handler that
// promotes or demotes a task, so the set is written down once.
//
// `schedule` is in the set because getTodayTimedTasks() excludes today's focus
// tasks: promoting a dated task removes its schedule row, and demoting it puts
// the row back. R17.5 asks for every affected card, so it is declared here
// rather than left to the next full render.
var PLANNER_FOCUS_SLATE_CARDS=['focus','welcome','inbox','suggested','schedule'];

// The ordered card keys for the current view mode. The Short_Version suppresses
// the rest of the day by omission from this list, never by hiding markup that
// was rendered anyway (R6.10).
//
// Full-day order: the re-entry greeting first, then the welcome masthead and the
// two first-action cards, with the evening sweep near the end so it never
// interrupts them and the Inbox last as the quiet sorting surface.
function plannerTodayOrder(){
  if(plannerViewMode==='short')return ['reentry','short'];
  return ['reentry','welcome','monthreview','training','habits','focus','suggested','schedule','capture','waterweight','gratitude','sweep','inbox'];
}

// ── Quiet-day re-entry ─────────────────────────────────────
// The Quiet_Day_Threshold: the gap length, in whole days, at which Life Hub
// treats the stretch as a Quiet_Period and greets the return (R6.2).
var QUIET_DAY_THRESHOLD=2;
// Session-scoped dismissal, matching the gratitude flashback's precedent
// (js/gratitude.js gratitudeFlashbackDismiss) — the key holds the day it was
// dismissed for, so a new day brings the card back (R6.6).
var REENTRY_DISMISS_KEY='lh_reentry_dismissed';

// Re-entry card — first in the Today order during a Quiet_Period (R6.3).
//
// Returns '' in exactly two cases, which together are the whole of R6.12 and
// R6.6: the gap has not reached the threshold, or the card was already dismissed
// for today. Otherwise it states the gap in whole days and offers three
// controls, every one of which is a plain button over data that already exists —
// nothing to fill in first, so the Re_Entry_Cost stays at zero (R6.7).
//
// Everything here is Neutral_Palette (--text2, --text3, --gold, --mint, --sky,
// --clay, --accent) and says nothing about a broken streak (R6.11, R6.13).
function plannerReentryCard(todayKey){
  var today=todayKey||localDateKey(new Date());
  var gap=(typeof quietGapDays==='function')?quietGapDays():0;
  if(gap<QUIET_DAY_THRESHOLD)return '';
  if(plannerReentryDismissed()===today)return '';

  var gapLine=escapeHtml(String(gap))+' quiet '+(gap===1?'day':'days')+' since your last logged day.';

  return ''
    +'<div class="card planner-card pc-reentry-card card-quiet" id="pc-reentry">'
      +'<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>Welcome back</span></div>'
      +'<div class="pc-reentry-gap" style="font-size:15px;font-weight:600;color:var(--text2)">'+gapLine+'</div>'
      +'<div class="pc-reentry-note" style="font-size:13px;color:var(--text3);margin-top:4px">Nothing here needs catching up. Start wherever you like.</div>'
      +'<div class="pc-reentry-actions" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">'
        +'<button type="button" class="btn btn-sm" onclick="plannerOpenShortVersion()">Short version</button>'
        +'<button type="button" class="btn btn-sm btn-ghost" onclick="plannerDismissReentry()">Show me everything</button>'
        +'<button type="button" class="btn btn-sm btn-ghost" onclick="plannerToggleRecap()" aria-expanded="'+(plannerReentryRecapOpen?'true':'false')+'">'
          +(plannerReentryRecapOpen?'Hide what happened':'What happened?')
        +'</button>'
      +'</div>'
      +(plannerReentryRecapOpen?plannerReentryRecapPanel():'')
    +'</div>';
}

// The dismissal day, or null. sessionStorage can throw in a private-mode window,
// so every read is guarded exactly as the flashback's is.
function plannerReentryDismissed(){
  try{return sessionStorage.getItem(REENTRY_DISMISS_KEY)}catch(e){return null}
}

// The recap, built entirely from quietPeriodRecap() (R7.2–R7.5). Called with no
// arguments so the counted window is the same silence quietGapDays() measures —
// the card's stated gap and the recap's stated period can never disagree.
// Every count is stated against that period in whole days (R7.3); a period with
// nothing in it says so plainly rather than reporting three zeros (R7.4).
function plannerReentryRecapPanel(){
  if(typeof quietPeriodRecap!=='function')return '';
  var r=quietPeriodRecap();
  var period=escapeHtml(String(r.days))+' '+(r.days===1?'day':'days');
  var rowStyle=' style="font-size:13px;color:var(--text2);margin-top:4px"';
  var html='<div class="pc-reentry-recap" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">'
    +'<div class="pc-reentry-recap-head" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)">Those '+period+'</div>';
  if(r.empty){
    html+='<div class="pc-reentry-recap-empty"'+rowStyle+'>No recorded activity in that stretch \u2014 nothing to read back.</div>';
  }else{
    html+='<div class="pc-reentry-recap-row"'+rowStyle+'>'+plannerReentryRecapLine(r.habitTicks,'habit tick','habit ticks',period)+'</div>';
    html+='<div class="pc-reentry-recap-row"'+rowStyle+'>'+plannerReentryRecapLine(r.sessions,'training session','training sessions',period)+'</div>';
    html+='<div class="pc-reentry-recap-row"'+rowStyle+'>'+plannerReentryRecapLine(r.gratitudeEntries,'gratitude entry','gratitude entries',period)+'</div>';
  }
  html+='</div>';
  return html;
}

function plannerReentryRecapLine(count,one,many,period){
  return escapeHtml(String(count))+' '+(count===1?one:many)+' in '+period;
}

// The four view-mode handlers. Each one changes which cards belong on the page
// rather than the contents of one card, so each calls a full renderPlannerToday()
// instead of a targeted refreshPlannerCards() — the card set itself is what moved.
function plannerOpenShortVersion(){
  plannerViewMode='short';
  renderPlannerToday();
}

// R6.10: leaving the Short_Version brings the full set of cards back.
function plannerLeaveShortVersion(){
  plannerViewMode=null;
  renderPlannerToday();
}

// R6.6: dismiss for the session and show the full Planner. Also drops the
// Short_Version, since "show me everything" means the whole day either way.
function plannerDismissReentry(){
  try{sessionStorage.setItem(REENTRY_DISMISS_KEY,localDateKey(new Date()))}catch(e){}
  plannerViewMode=null;
  plannerReentryRecapOpen=false;
  renderPlannerToday();
}

// R7.1: the recap is requested, never volunteered.
function plannerToggleRecap(){
  plannerReentryRecapOpen=!plannerReentryRecapOpen;
  renderPlannerToday();
}

// ── The Short_Version ──────────────────────────────────────
// The at-most-three single-tap actions the Short_Version offers, in a fixed
// order: the first habit due today and not complete, a glass of water while
// today is short of the target, then the first open Focus_Task (R6.8). Fewer
// apply on a quieter day, and a day with nothing outstanding returns [].
//
// Read-only and DOM-free by contract. It is called from the card builder below
// *and* from updateAppBadge() during a Quiet_Period, where the Badge_Value is
// just this list's length (R9.4) — so it must never write to STATE, never
// touch the document, and return the same list for the same state.
//
// Each entry is {kind, id, label, meta, handler, arg}: `kind` names the domain
// the action came from, and `handler` + `arg` name the existing write path it
// delegates to. Nothing here reimplements a write — plannerToggleHabit(),
// logWaterGlass() and plannerToggleFocusDone() already persist through the
// Persistence_Layer, which is the whole of R6.9's first half.
function shortVersionActions(todayKey){
  var today=todayKey||localDateKey(new Date());
  var actions=[];

  // 1. Habits. STATE.habits order is the order the Habits card shows, so "the
  //    first one due and not complete" means the same thing in both places.
  //    habitDayStatus() is the sole definition of due-and-incomplete: 'todo'.
  var habits=STATE.habits||[];
  for(var i=0;i<habits.length;i++){
    var h=habits[i];
    if(!h)continue;
    if(typeof habitDayStatus!=='function')break;
    if(habitDayStatus(h,today)!=='todo')continue;
    actions.push({
      kind:'habit',
      id:h.id,
      label:(h.icon?h.icon+' ':'')+(h.name||'Habit'),
      meta:'Habit due today',
      handler:'plannerToggleHabit',
      arg:h.id
    });
    break;
  }

  // 2. Water. waterStats() is the sole definition of the daily target, so the
  //    Short_Version and every other water reader agree about what "short of
  //    the target" means rather than each reading STATE.waterSettings itself.
  var glasses=Number((STATE.water&&STATE.water[today])||0);
  if(!(glasses>0))glasses=0;
  var target=(typeof waterStats==='function')?Number(waterStats([today]).target||0):0;
  if(glasses<target){
    actions.push({
      kind:'water',
      id:'water',
      label:'+1 glass',
      meta:glasses+' of '+target+' today',
      handler:'logWaterGlass',
      arg:glasses+1
    });
  }

  // 3. Focus slate. getTodayFocus() is today's slate; the first not-done task.
  var focus=(typeof getTodayFocus==='function')?getTodayFocus(today):[];
  for(var j=0;j<focus.length;j++){
    var t=focus[j];
    if(!t||t.done)continue;
    actions.push({
      kind:'focus',
      id:t.id,
      label:t.text||'Focus task',
      meta:"Today's focus",
      handler:'plannerToggleFocusDone',
      arg:t.id
    });
    break;
  }

  // One entry per domain, so the cap is structural rather than enforced — the
  // slice is here so it stays true if a fourth domain is ever added (R6.8).
  return actions.slice(0,3);
}

// The Short_Version card (R6.8–R6.10). Root id `pc-short`.
//
// Unlike every other builder this one never returns '': it always carries the
// "show me the whole day" control, which is the only way out of the reduced view
// once the first action has made today active and taken the re-entry card off
// the page (R6.10). A card that vanished when the last action was done would
// leave the user on an empty page with no way back.
//
// It builds only rows — the suppression of the rest of the day is
// plannerTodayOrder()'s omission of the other keys, never markup hidden here.
// Neutral_Palette throughout, no --red (R6.13). Every row is a native <button>,
// so it is focusable and operable from the keyboard without any ARIA (R26.9).
function plannerShortVersionCard(todayKey){
  var today=todayKey||localDateKey(new Date());
  var actions=shortVersionActions(today);

  var rows;
  if(!actions.length){
    rows='<div class="pc-short-empty" style="font-size:13px;color:var(--text3)">'
      +'Nothing outstanding today. This is a good place to stop.'
    +'</div>';
  }else{
    rows='<div class="pc-short-list" style="display:flex;flex-direction:column;gap:8px">'
      +actions.map(function(a){
        // One tap completes the action through the existing write path, which
        // persists it and names `short` among the cards it refreshes. Nothing
        // here touches plannerViewMode, so the reduced view is still what
        // plannerTodayOrder() returns and the card is rebuilt in place — a done
        // habit or task drops off the list, a glass of water comes back with
        // the new count, and either way the user is still here (R6.9).
        var call=a.handler+'('+(typeof a.arg==='number'?a.arg:'\''+escapeHtml(String(a.arg))+'\'')+')';
        return '<button type="button" class="pc-short-row" data-short-action="'+escapeHtml(a.kind)+'"'
          +' onclick="'+call+'"'
          +' aria-label="'+escapeHtml(a.label)+'"'
          +' style="display:flex;align-items:center;gap:10px;width:100%;min-height:44px;text-align:left;'
            +'font:inherit;padding:10px 0;background:none;border:0;border-bottom:1px solid var(--border);cursor:pointer">'
          +'<span class="pc-short-tick" aria-hidden="true" style="width:20px;height:20px;flex:0 0 20px;'
            +'border:1.5px solid var(--mint);border-radius:50%"></span>'
          +'<span class="pc-short-text" style="display:flex;flex-direction:column;gap:2px;min-width:0">'
            +'<span style="font-size:14px;font-weight:600;color:var(--text2)">'+escapeHtml(a.label)+'</span>'
            +'<span style="font-size:11px;color:var(--text3)">'+escapeHtml(a.meta)+'</span>'
          +'</span>'
        +'</button>';
      }).join('')
    +'</div>';
  }

  return ''
    +'<div class="card planner-card pc-short-card card-quiet" id="pc-short">'
      +'<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>The short version</span></div>'
      +'<div class="pc-short-note" style="font-size:13px;color:var(--text3);margin-bottom:10px">'
        +'One tap each. Anything you skip stays where it is.'
      +'</div>'
      +rows
      +'<div class="pc-short-leave" style="margin-top:12px">'
        +'<button type="button" class="btn btn-sm btn-ghost" onclick="plannerLeaveShortVersion()">Show me the whole day</button>'
      +'</div>'
    +'</div>';
}

// Stub for the card the registry expects but that does not exist yet (task 20).
// Returning '' keeps it out of the composed markup and out of `data-cards`, so
// registering it now costs nothing and the order never has to change again.
function plannerSuggestedCard(todayKey){return ''}

function renderPlannerToday(){
  var el=document.getElementById('planner-today');
  if(!el)return;
  var todayKey=localDateKey(new Date());
  var present=[];
  var html=plannerTodayOrder().map(function(key){
    var card=PLANNER_CARDS[key];
    var markup=card?card.build(todayKey):'';
    if(markup)present.push(key);
    return markup;
  }).join('');
  el.innerHTML=html;
  // The keys whose cards are actually on the page, in render order. A targeted
  // in-place patch compares its own build against this to tell a card appearing
  // or disappearing — which moves its neighbours — from a card merely changing.
  el.setAttribute('data-cards',present.join(','));
  // Keep the PWA app-icon badge in sync with today's open focus count (R9.1).
  if(typeof updateAppBadge==='function')updateAppBadge();
  // Evening sweep: fetch the AI one-liner once the card is in the DOM (§evening).
  loadEveningSweep(todayKey);
}

// Targeted in-place patch: replace only the cards a mutation actually touched,
// instead of reassigning the whole #planner-today subtree (R17.1, R17.5).
//
// Returns true when it patched in place and false when it escalated to a full
// renderPlannerToday(). It escalates in exactly two situations:
//
//   * the set of keys whose builder produces markup no longer matches the
//     `data-cards` list the last render recorded. A card appearing or
//     disappearing moves its neighbours, and inserting markup at the right
//     position means knowing them — Decision 1 takes the full rebuild instead.
//   * a card that belongs on the page has no host element, which means the DOM
//     and `data-cards` have drifted apart. Patching from there would leave a
//     half-updated page, so rebuild the whole thing.
//
// Cards named in PLANNER_INPUT_CARDS are left alone unless opts.includeInputCards
// says the mutation originated inside them: replacing an element under an active
// caret or IME is exactly what R17.3 exists to prevent.
//
// Neither path scrolls the page of its own accord: the only window.scrollTo in
// this file is preservePlannerScroll's, and it fires only to undo an offset the
// browser clamped (R17.2).
function refreshPlannerCards(keys,opts){
  // The patch itself lives in plannerPatchCards; this wrapper is the whole of
  // R17.2 and R17.3 — the caret snapshot is taken before any markup moves, and
  // the scroll guard spans the patch and every escalation inside it.
  var focused=capturePlannerFocus();
  var patched=preservePlannerScroll(function(){
    var p=plannerPatchCards(keys||[],opts||{});
    restorePlannerFocus(focused);
    return p;
  });
  // The sweep also renders inside the close-day pop-up. When a step control
  // there fires one of the sweep* handlers, the handler repaints the `sweep`
  // card through here; mirror that repaint into the open modal so the pop-up
  // advances in lock-step with the write it just made.
  if((keys||[]).indexOf('sweep')!==-1&&typeof renderCloseDayModal==='function')renderCloseDayModal();
  return patched;
}

// ── Focus, caret and scroll preservation (R17.2, R17.3) ────
// Replacing an element under an active caret throws the user out of what they
// were typing. Two mechanisms cover it, and both are needed:
//
//   * PLANNER_INPUT_CARDS keeps the common case out of harm's way — typing in
//     the capture box while ticking a habit elsewhere never touches the input;
//   * capture/restore covers what is left: the mutation that originates inside
//     the input and so passes includeInputCards, and any escalation to a full
//     renderPlannerToday(), which rebuilds every card including that one.
//
// Both lookups are scoped to #planner-today instead of going through
// document.getElementById. The Inbox tab renders the same capture card, and it
// used to render it under the same input id, so `planner-capture-input` was in
// the document twice and a bare getElementById resolved to whichever pane the
// markup happened to put first — a document-order dependency, and the wrong
// element to restore a Today caret into. plannerCaptureCard() now derives a
// distinct input id per host, so the Today name is unique again; the scoping
// stays, because every other Week or Inbox field is a candidate for the same
// collision and the scope is what makes that impossible rather than unlikely.

// The Today field carrying `id`, or null. Scoped by construction: a duplicate of
// the same id in the Week or Inbox pane is not a candidate.
function plannerTodayField(id){
  var el=document.getElementById('planner-today');
  if(!el||!id)return null;
  var fields=el.querySelectorAll('input,textarea');
  for(var i=0;i<fields.length;i++){if(fields[i].id===id)return fields[i]}
  return null;
}

// {id, value, start, end} for the focused Today text field, or null when focus
// is anywhere else. An id is required: without one there is nothing to re-find.
function capturePlannerFocus(){
  var active=document.activeElement;
  if(!active||!active.id)return null;
  var tag=(active.tagName||'').toLowerCase();
  if(tag!=='input'&&tag!=='textarea')return null;
  if(plannerTodayField(active.id)!==active)return null;
  var snap={id:active.id,value:active.value,start:null,end:null};
  // selectionStart throws on input types that do not carry a caret (number,
  // date, checkbox); those restore their value and focus, and no range.
  try{snap.start=active.selectionStart;snap.end=active.selectionEnd}catch(e){}
  return snap;
}

// Put the caret back. Returns true when the snapshot was restored, false when
// there was nothing to restore or the field has left the page.
function restorePlannerFocus(snap){
  if(!snap)return false;
  var el=plannerTodayField(snap.id);
  if(!el)return false;
  // The typed value wins over the rebuilt markup: the Planner builders render
  // capture inputs with no value attribute, so a rebuilt card comes back empty.
  if(el.value!==snap.value)el.value=snap.value;
  if(snap.start!==null&&snap.end!==null&&typeof el.setSelectionRange==='function'){
    try{el.setSelectionRange(snap.start,snap.end)}catch(e){}
  }
  if(typeof el.focus==='function')el.focus();
  return true;
}

function plannerScrollTop(){
  return (window.pageYOffset!==undefined)?window.pageYOffset:(window.scrollY||0);
}

// Run `fn` and leave the page where it was (R17.2).
//
// Nothing on the refresh path scrolls, so in the normal case the offset never
// moves and no scrollTo is issued at all. The one thing that can move it is the
// browser clamping the offset while a card's markup is momentarily out of the
// document and the page is shorter than the current offset allows. A clamp can
// only ever lower the offset, which is why the guard below is `< before` rather
// than `!== before`: a lower offset is the clamp's signature, and anything else
// is left alone.
function preservePlannerScroll(fn){
  var before=plannerScrollTop();
  var result=fn();
  if(before>0)plannerKeepScrollTop(before);
  return result;
}

// Checked twice: once immediately, because reading the offset forces layout and
// the clamp is usually already visible, and once on the next frame, because the
// clamp lands with layout rather than with the markup assignment. The cost of
// the deferred check is that a deliberate scroll up inside that one frame would
// be corrected; the benefit is that the far more common clamp never lands.
function plannerKeepScrollTop(before){
  var restore=function(){
    if(plannerScrollTop()<before&&typeof window.scrollTo==='function')window.scrollTo(0,before);
  };
  restore();
  if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(restore);
}

function plannerPatchCards(keys,opts){
  var el=document.getElementById('planner-today');
  if(!el)return false;
  var todayKey=localDateKey(new Date());

  // Build every card of the current order once. The present-key set is what
  // separates "a card changed" from "a card appeared or disappeared", and the
  // same markup is then reused for the patch, so each builder runs exactly once
  // per refresh — the same number of times a full render would run it.
  var built={},present=[];
  plannerTodayOrder().forEach(function(key){
    var card=PLANNER_CARDS[key];
    var markup=card?card.build(todayKey):'';
    built[key]=markup;
    if(markup)present.push(key);
  });
  if(present.join(',')!==(el.getAttribute('data-cards')||'')){renderPlannerToday();return false}

  // Resolve the requested keys to hosts before touching the document, so an
  // absent host escalates instead of leaving a partly patched page behind.
  var targets=[];
  for(var i=0;i<keys.length;i++){
    var key=keys[i];
    if(!PLANNER_CARDS[key])continue;                                            // not a card
    if(!built[key])continue;                                                    // does not apply today
    if(targets.indexOf(key)!==-1)continue;                                      // named twice
    if(!opts.includeInputCards&&PLANNER_INPUT_CARDS.indexOf(key)!==-1)continue; // may hold a caret
    if(!document.getElementById(PLANNER_CARDS[key].host)){renderPlannerToday();return false}
    targets.push(key);
  }
  targets.forEach(function(k){
    document.getElementById(PLANNER_CARDS[k].host).outerHTML=built[k];
  });

  // The card set is unchanged, so `data-cards` still describes the page. The
  // badge is not: a focus tick changes today's open count (R9.1).
  if(typeof updateAppBadge==='function')updateAppBadge();
  return true;
}

// ── Close-the-day sweep state machine ──────────────────────
// The sweep is a persisted per-day state machine (Design Decision 3). Progress
// lives in STATE.sweep[dateKey] = {step, recorded, startedAt, completedAt}, so
// it survives a reload and an iOS eviction — a module variable or sessionStorage
// would not, and R8.17 asks a completed sweep to reopen into its summary.
//
// `step` is an index into SWEEP_STEPS, or the string 'summary' once the last
// step has been passed. `recorded` is a ledger of what *the sweep itself* wrote,
// never what happens to be true for the day: water logged at lunchtime or a
// habit ticked from the Habits page is not sweep output, and reporting it as
// such would be a small dishonesty in a feature built on data honesty (R8.14).
//
// Every step delegates its write to the domain's existing global path, so there
// is exactly one implementation of each write. This file owns only the step
// pointer and the ledger.
var SWEEP_STEPS=['water','skincare','mood','gratitude','habits'];

// The other Today card each step's own write can change, keyed by the step being
// left — the sweep row of the mutation table in Components §C. Skincare, mood and
// gratitude have no Today card of their own, so leaving them repaints the sweep
// and nothing else.
var SWEEP_STEP_CARDS={water:['waterweight'],skincare:[],mood:[],gratitude:[],habits:['habits']};

// Coerces a stored `step` to a valid pointer. Anything unrecognised reads as 0
// rather than throwing, and an index past the last step reads as the summary, so
// a truncated or hand-edited record still resolves to a renderable state.
function sweepNormalizeStep(raw){
  if(raw==='summary')return 'summary';
  var n=Number(raw);
  if(!isFinite(n)||n<0)return 0;
  n=Math.floor(n);
  return n>=SWEEP_STEPS.length?'summary':n;
}

// A pure read. The card builder calls this on every render, and R8.1 says that
// simply opening the Planner writes nothing — so there is deliberately no
// lazy-create here and no saveState(). `recorded` is copied out so a caller
// cannot mutate the stored ledger without going through sweepRecord.
function sweepState(dateKey){
  var rec=(STATE.sweep&&typeof STATE.sweep==='object')?STATE.sweep[dateKey]:null;
  if(!rec||typeof rec!=='object')return {step:0,recorded:{},startedAt:null,completedAt:null};
  var recorded={};
  if(rec.recorded&&typeof rec.recorded==='object')Object.keys(rec.recorded).forEach(function(k){recorded[k]=rec.recorded[k]});
  return {
    step:sweepNormalizeStep(rec.step),
    recorded:recorded,
    startedAt:rec.startedAt||null,
    completedAt:rec.completedAt||null
  };
}

// Creates the record on the first interaction, never on render, and returns the
// live record for the mutators below. Does not save on its own: the save comes
// from the sweepRecord or sweepAdvance that follows it, so an interaction that
// fails to persist leaves nothing behind (see sweepAdvance's rollback).
function sweepBegin(dateKey){
  if(!STATE.sweep||typeof STATE.sweep!=='object')STATE.sweep={};
  var rec=STATE.sweep[dateKey];
  if(!rec||typeof rec!=='object'){
    rec={step:0,recorded:{},startedAt:new Date().toISOString(),completedAt:null};
    STATE.sweep[dateKey]=rec;
    return rec;
  }
  rec.step=sweepNormalizeStep(rec.step);
  if(!rec.recorded||typeof rec.recorded!=='object')rec.recorded={};
  return rec;
}

// Records what the sweep itself wrote, and only ever after the delegated write
// path has already returned success. Returns saveState()'s verdict: on a
// rejected save the ledger entry is rolled back so it can never claim a write
// that is not persisted, and the caller must not advance (Error Handling, R8.4).
function sweepRecord(dateKey,stepKey,value){
  if(!dateKey||SWEEP_STEPS.indexOf(stepKey)===-1)return false;
  var existed=!!(STATE.sweep&&STATE.sweep[dateKey]);
  var rec=sweepBegin(dateKey);
  var had=Object.prototype.hasOwnProperty.call(rec.recorded,stepKey);
  var before=rec.recorded[stepKey];
  rec.recorded[stepKey]=value;
  if(saveState())return true;
  if(had)rec.recorded[stepKey]=before;else delete rec.recorded[stepKey];
  if(!existed)delete STATE.sweep[dateKey];
  return false;
}

// Moves the pointer on one step; past the last step the sweep enters its summary
// state and stamps completedAt. The summary is terminal — advancing from it is a
// no-op, which is what keeps a reopened Planner on the summary instead of
// restarting at step 0 (R8.17).
//
// The step pointer is the only thing written here; the domain write already
// happened in the delegated path. On a rejected save the pointer is rolled back
// and no repaint runs, so a failed write never advances the sweep.
//
// The repaint names the sweep plus whichever Today card the step just left could
// have changed, and passes includeInputCards because the mutation originated
// inside the sweep card itself — the one case where replacing an input-bearing
// card is allowed (R17.3, R17.5).
function sweepAdvance(dateKey){
  if(!dateKey)return false;
  var existed=!!(STATE.sweep&&STATE.sweep[dateKey]);
  var rec=sweepBegin(dateKey);
  if(rec.step==='summary')return true;
  var from=SWEEP_STEPS[rec.step]||null;
  var prevStep=rec.step,prevCompleted=rec.completedAt;
  var next=rec.step+1;
  if(next>=SWEEP_STEPS.length){rec.step='summary';rec.completedAt=new Date().toISOString()}
  else rec.step=next;
  if(!saveState()){
    rec.step=prevStep;rec.completedAt=prevCompleted;
    if(!existed)delete STATE.sweep[dateKey];
    return false;
  }
  var affected=['sweep'].concat((from&&SWEEP_STEP_CARDS[from])||[]);
  if(typeof refreshPlannerCards==='function')refreshPlannerCards(affected,{includeInputCards:true});
  return true;
}

// Skip is an advance and nothing else: no domain write, and no entry added to
// `recorded`, so a skipped step leaves both its domain and the ledger untouched
// (R8.5, R8.6). Named separately because that absence is the whole contract.
function sweepSkip(dateKey){
  return sweepAdvance(dateKey);
}

// ── Close-the-day card ─────────────────────────────────────
// The deep-link open target. The evening notification opens the app at
// `?open=close-day` (R10.6) and the router that reads the query string into this
// variable belongs to task 17.3; it is declared here because plannerCloseDayCard
// is its only reader and the card must not wait on that task to be correct.
// `null` means "no override", which is every ordinary load.
var plannerOpenTarget=null;

// The Close_The_Day_Card. Root element keeps the id and class of the card it
// replaces — `planner-sweep-card` — so the existing `.planner-sweep-*` styling and
// the `sweep` registry host both carry over untouched (Decision 3).
//
// Returns '' before 17:00, which is the whole of R8.1's gate, unless the deep
// link forced the card open. Renders exactly one step at a time (R8.3): the step
// pointer selects one builder and nothing else is emitted, so a later step is
// absent from the markup rather than hidden in it. Past the last step the card
// renders the Sweep_Completion_Summary instead (R8.17).
//
// Neutral_Palette only — --text2, --text3, --gold, --mint, --sky, --clay,
// --accent — and no --red anywhere, including the skipped-step affordances, since
// a skipped step is a legitimate outcome and not a failure (R8.18).
// The hour the close-the-day flow becomes available and auto-prompts. The sweep
// used to surface from 17:00 as an inline card; it now waits until 21:00 and
// runs as a pop-up (openCloseDayModal / maybePromptCloseDay in init.js), so this
// card is only a launcher and status line.
var CLOSE_DAY_HOUR=21;

// The Close_The_Day launcher card. From CLOSE_DAY_HOUR it offers a button that
// opens the sweep as a modal; once the sweep is complete it shows a done line
// with a reopen affordance. The step-by-step flow itself lives in
// closeDayModalBody so there is exactly one place the sweep inputs are rendered
// (no duplicate element ids across a hidden page and an open modal).
function plannerCloseDayCard(todayKey){
  var today=todayKey||localDateKey(new Date());
  var forced=(typeof plannerOpenTarget!=='undefined'&&plannerOpenTarget==='close-day');
  if(new Date().getHours()<CLOSE_DAY_HOUR&&!forced)return '';

  var st=sweepState(today);                                                     // pure read: rendering writes nothing (R8.1)
  var head='<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>';

  if(st.step==='summary'){
    return ''
      +'<div class="card planner-card planner-sweep-card" id="planner-sweep-card">'
        +head+'Day closed</span></div>'
        +'<div class="pc-sweep-summary" style="font-size:13px;color:var(--text2)">That\u2019s today closed. \u2713</div>'
        +'<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" onclick="openCloseDayModal()">Reopen</button></div>'
      +'</div>';
  }

  var started=(typeof st.step==='number'&&st.step>0);
  return ''
    +'<div class="card planner-card planner-sweep-card" id="planner-sweep-card">'
      +head+'Close the day</span></div>'
      +'<div style="font-size:13px;color:var(--text3);margin-bottom:10px">A quick sweep \u2014 water, skincare, mood, gratitude, habits.</div>'
      +'<button type="button" class="btn btn-accent" onclick="openCloseDayModal()">'+(started?'Continue closing the day':'Close the day')+'</button>'
    +'</div>';
}

// Open the sweep as a modal. The step buttons inside reuse the same sweep*
// write paths as before; renderCloseDayModal keeps the modal in step with them.
function openCloseDayModal(){
  if(typeof openModal==='function')openModal('closeDay');
}

// The modal body for one sweep step (or the completion state). Mirrors the old
// inline card exactly — same step builders, same handlers — so nothing about
// the sweep's write logic changes; only where it renders. The wrapping
// [data-close-day-modal] marker lets renderCloseDayModal recognise its own modal.
function closeDayModalBody(today){
  today=today||localDateKey(new Date());
  var st=sweepState(today);
  if(st.step==='summary'){
    return '<h2>\uD83C\uDF19 Day closed</h2>'
      +'<div class="modal-sub">That\u2019s today wrapped up. Nice work.</div>'
      +'<div data-close-day-modal="1" hidden></div>'
      +'<div class="modal-btns"><button class="btn btn-accent" onclick="closeModal()">Done</button></div>';
  }
  var builders={water:sweepStepWater,skincare:sweepStepSkincare,mood:sweepStepMood,gratitude:sweepStepGratitude,habits:sweepStepHabits};
  var stepKey=SWEEP_STEPS[st.step];
  var body=(stepKey&&builders[stepKey])?builders[stepKey](today,st):'';
  return '<h2>\uD83C\uDF19 Close the day</h2>'
    +'<div class="modal-sub">Step '+escapeHtml(String(st.step+1))+' of '+escapeHtml(String(SWEEP_STEPS.length))+'</div>'
    +'<div data-close-day-modal="1">'+body+'</div>'
    +'<div class="modal-btns"><button class="btn btn-ghost" onclick="closeModal()">Finish later</button></div>';
}

// Re-render the close-day modal in place when it is the modal on screen. Called
// from refreshPlannerCards whenever the sweep changes, so tapping a step control
// advances the pop-up just as it advanced the old inline card.
function renderCloseDayModal(){
  var modal=document.getElementById('modal'),mc=document.getElementById('modal-content');
  if(!modal||!mc||modal.style.display!=='flex')return;
  if(!mc.querySelector('[data-close-day-modal]'))return;
  mc.innerHTML=closeDayModalBody(localDateKey(new Date()));
  var first=mc.querySelector('textarea,input:not([type=hidden]),button');
  if(first)setTimeout(function(){try{first.focus()}catch(e){}},0);
}

// The Sweep_Skip control, in one place because R8.5 asks for it at *every* step
// and a per-step copy is a per-step chance to forget one. Skip is a native
// button, so it is reachable and operable from the keyboard with no ARIA (R26.9),
// and it goes through sweepSkip(), which advances without writing to any domain
// and without adding to the ledger (R8.6).
function sweepSkipControl(dateKey,label){
  return '<button type="button" class="pc-sweep-skip btn btn-sm btn-ghost"'
    +' onclick="sweepSkip(\''+escapeHtml(String(dateKey))+'\')"'
    +' aria-label="'+escapeHtml(label||'Skip this step')+'">'
    +escapeHtml(label||'Skip')
  +'</button>';
}

// Shared chrome for a step: the prompt line, the controls, then the skip row.
function sweepStepShell(prompt,note,controls,skip){
  return '<div class="pc-sweep-step">'
    +'<div class="pc-sweep-prompt" style="font-size:15px;font-weight:600;color:var(--text2)">'+prompt+'</div>'
    +(note?'<div class="pc-sweep-note" style="font-size:12px;color:var(--text3);margin-top:3px">'+note+'</div>':'')
    +'<div class="pc-sweep-controls" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">'+controls+'</div>'
    +'<div class="pc-sweep-skiprow" style="margin-top:10px">'+skip+'</div>'
  +'</div>';
}

// Step 1 — water. logWaterGlass(n) takes an *absolute* glass count, not a delta,
// so every control here states the total it is about to write (R8.7).
function sweepStepWater(dateKey,state){
  var glasses=Number((STATE.water&&STATE.water[dateKey])||0);
  if(!(glasses>0))glasses=0;
  var target=(typeof waterStats==='function')?Number(waterStats([dateKey]).target||0):Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  var d=escapeHtml(String(dateKey));

  var controls=''
    +'<button type="button" class="btn btn-sm" onclick="sweepLogWater(\''+d+'\','+(glasses+1)+')">+ 1 glass</button>'
    +'<button type="button" class="btn btn-sm" onclick="sweepLogWater(\''+d+'\','+(glasses+2)+')">+ 2 glasses</button>';
  if(glasses<target)controls+='<button type="button" class="btn btn-sm btn-ghost" onclick="sweepLogWater(\''+d+'\','+target+')">Reached '+escapeHtml(String(target))+'</button>';

  return sweepStepShell(
    'Water',
    escapeHtml(String(glasses))+' of '+escapeHtml(String(target))+' logged so far today.',
    controls,
    sweepSkipControl(dateKey,'Skip water')
  );
}

// Step 2 — skincare. Delegates to toggleSkincareToday('AM'|'PM'), which is a
// toggle: an already-ticked period is rendered as done with no handler, so the
// only reachable call is the one that adds a tick (R8.8).
function sweepStepSkincare(dateKey,state){
  var d=escapeHtml(String(dateKey));
  var controls=['AM','PM'].map(function(period){
    var habit=(typeof _findSkincareHabit==='function')?_findSkincareHabit(period):null;
    if(!habit){
      return '<span class="pc-sweep-missing" style="font-size:12px;color:var(--text3)">No '+escapeHtml(period)+' routine set up</span>';
    }
    var done=!!(habit.logs&&habit.logs[dateKey]);
    if(done){
      return '<span class="pc-sweep-done" style="font-size:13px;color:var(--mint)">\u2713 '+escapeHtml(period)+' done</span>';
    }
    return '<button type="button" class="btn btn-sm" onclick="sweepLogSkincare(\''+d+'\',\''+escapeHtml(period)+'\')"'
      +' aria-label="'+escapeHtml('Log skincare '+period)+'">'+escapeHtml(period)+'</button>';
  }).join('');

  return sweepStepShell('Skincare','Tick whichever routine you did.',controls,sweepSkipControl(dateKey,'Skip skincare'));
}

// Step 3 — mood. The same 1–5 scale and the same labels the Dashboard mini-orb
// uses, through the same quickLogMood(v, dateKey) path (R8.9).
function sweepStepMood(dateKey,state){
  var d=escapeHtml(String(dateKey));
  var emoji=['\uD83D\uDE1E','\uD83D\uDE10','\uD83D\uDE42','\uD83D\uDE0A','\uD83E\uDD29'];
  var labels=['Low','Flat','Okay','Good','Great'];
  var controls=emoji.map(function(e,i){
    return '<button type="button" class="btn btn-sm btn-ghost pc-sweep-mood"'
      +' onclick="sweepLogMood(\''+d+'\','+(i+1)+')"'
      +' aria-label="'+escapeHtml('Log mood as '+labels[i])+'">'+e+'</button>';
  }).join('');
  return sweepStepShell('How was today?','One tap. Nothing to explain.',controls,sweepSkipControl(dateKey,'Skip mood'));
}

// Step 4 — gratitude. The write itself is sweepSaveGratitude(text), which lands
// in task 14.3; this step owns the input and the controls only. The textarea
// carries an id and no value attribute so restorePlannerFocus() can put the caret
// back after an in-place patch (R17.3).
function sweepStepGratitude(dateKey,state){
  var d=escapeHtml(String(dateKey));
  var controls=''
    +'<textarea id="sweep-gratitude-input" class="pc-sweep-gratitude planner-capture-input" rows="2"'
      +' placeholder="One thing worth keeping"'
      +' aria-label="Gratitude for today"'
      +' style="width:100%;font:inherit;font-size:13px;color:var(--text2);resize:vertical"></textarea>'
    +'<button type="button" class="btn btn-sm" onclick="sweepSubmitGratitude(\''+d+'\')">Save</button>';
  return sweepStepShell(
    'Gratitude',
    'Leave it empty and nothing is written \u2014 the sweep still moves on.',
    controls,
    sweepSkipControl(dateKey,'Skip gratitude')
  );
}

// Step 5 — habits. Lists only habits that are due today and not yet complete,
// which is exactly habitDayStatus(h, dateKey) === 'todo' — the sole definition of
// due-and-incomplete, shared with the Short_Version and the badge (R8.12).
//
// Ticking does not advance: a day can have several habits left, so each tick
// writes through plannerToggleHabit() and the step stays put until the explicit
// finish control (R8.13). A day with nothing due says so and offers the same
// single control out.
function sweepStepHabits(dateKey,state){
  var d=escapeHtml(String(dateKey));
  var due=(STATE.habits||[]).filter(function(h){
    return h&&typeof habitDayStatus==='function'&&habitDayStatus(h,dateKey)==='todo';
  });

  var controls;
  if(!due.length){
    controls='<span class="pc-sweep-none" style="font-size:13px;color:var(--text3)">Nothing left due today.</span>';
  }else{
    controls=due.map(function(h){
      var label=(h.icon?h.icon+' ':'')+(h.name||'Habit');
      return '<button type="button" class="btn btn-sm pc-sweep-habit"'
        +' data-sweep-habit="'+escapeHtml(String(h.id))+'"'
        +' onclick="sweepLogHabit(\''+d+'\',\''+escapeHtml(String(h.id))+'\')"'
        +' aria-label="'+escapeHtml('Complete '+(h.name||'habit'))+'">'+escapeHtml(label)+'</button>';
    }).join('');
  }
  controls+='<button type="button" class="btn btn-sm btn-ghost" onclick="sweepAdvance(\''+d+'\')">Finish</button>';

  var ticked=Array.isArray(state&&state.recorded&&state.recorded.habits)?state.recorded.habits.length:0;
  var note=due.length
    ?'Tick what you did, then finish.'+(ticked?' '+escapeHtml(String(ticked))+' ticked in this sweep.':'')
    :'Nothing to tick.';

  return sweepStepShell('Habits',note,controls,sweepSkipControl(dateKey,'Skip habits'));
}

// ── The five step handlers ─────────────────────────────────
// Each one has the same shape, and that shape is the whole of the Error Handling
// contract for the sweep: call the existing write path first, confirm it landed,
// record the ledger entry, and only advance when both succeeded. A failed save
// therefore leaves the step where it is with nothing recorded, rather than
// advancing past a write that never happened (R8.4).
//
// logWaterGlass() and quickLogMood() return nothing, so "it landed" is read back
// out of STATE rather than taken on trust.

// Water. `count` is absolute — the builder above computes the total.
function sweepLogWater(dateKey,count){
  if(typeof logWaterGlass!=='function')return false;
  var n=Math.max(0,Math.floor(Number(count)||0));
  logWaterGlass(n);
  if(Number((STATE.water&&STATE.water[dateKey])||0)!==n)return false;
  if(!sweepRecord(dateKey,'water',n))return false;
  return sweepAdvance(dateKey);
}

// Skincare. toggleSkincareToday() reports its own save verdict, and it is a
// toggle: an already-ticked period is skipped rather than un-ticked, so a double
// tap can never remove a tick the sweep just made.
function sweepLogSkincare(dateKey,period){
  if(typeof toggleSkincareToday!=='function')return false;
  var habit=(typeof _findSkincareHabit==='function')?_findSkincareHabit(period):null;
  if(habit&&habit.logs&&habit.logs[dateKey])return sweepSkip(dateKey);
  if(!toggleSkincareToday(period))return false;
  if(!sweepRecord(dateKey,'skincare',period))return false;
  return sweepAdvance(dateKey);
}

// Mood. Same 1–5 value the Dashboard writes, through the same path.
function sweepLogMood(dateKey,value){
  if(typeof quickLogMood!=='function')return false;
  var v=Math.floor(Number(value)||0);
  if(v<1||v>5)return false;
  quickLogMood(v,dateKey);
  if(!(STATE.mood&&STATE.mood[dateKey]&&STATE.mood[dateKey].mood===v))return false;
  if(!sweepRecord(dateKey,'mood',v))return false;
  return sweepAdvance(dateKey);
}

// Gratitude. Empty or whitespace-only text writes nothing and still advances,
// which is R8.11 — the step is satisfied by having been offered, not by having
// been filled in. sweepSaveGratitude() lands in task 14.3 and is reached through
// a typeof guard so this step degrades to a skip until it does.
function sweepSubmitGratitude(dateKey){
  var el=document.getElementById('sweep-gratitude-input');
  var text=el?String(el.value||''):'';
  if(!text.trim())return sweepSkip(dateKey);
  if(typeof sweepSaveGratitude!=='function')return sweepSkip(dateKey);
  if(!sweepSaveGratitude(text))return sweepSkip(dateKey);
  if(!sweepRecord(dateKey,'gratitude',text.trim()))return false;
  return sweepAdvance(dateKey);
}

// Habits. Writes one habit and stays on the step, so several can be ticked in a
// row; the ledger accumulates the ids this sweep wrote. plannerToggleHabit()
// already repaints the sweep among its cards, so the extra refresh here is only
// to bring the just-updated ledger count back into the step.
function sweepLogHabit(dateKey,hid){
  if(typeof plannerToggleHabit!=='function')return false;
  if(!plannerToggleHabit(hid))return false;
  var st=sweepState(dateKey);
  var list=Array.isArray(st.recorded&&st.recorded.habits)?st.recorded.habits.slice():[];
  if(list.indexOf(hid)===-1)list.push(hid);
  if(!sweepRecord(dateKey,'habits',list))return false;
  if(typeof refreshPlannerCards==='function')refreshPlannerCards(['sweep'],{includeInputCards:true});
  return true;
}

// ── Evening gratitude prompt ───────────────────────────────
// A standalone card from GRATITUDE_CARD_HOUR onward, so the day's gratitude is
// asked for visibly rather than only inside the close-the-day sweep. Gone the
// moment today has an entry — from this card, the sweep, the Gratitude page or
// another device — so it never nags past the first write. The textarea means
// this card is in PLANNER_INPUT_CARDS: an in-place patch that did not originate
// here must not rebuild it mid-typing.
var GRATITUDE_CARD_HOUR=18;
function plannerGratitudeCard(todayKey){
  var today=todayKey||localDateKey(new Date());
  if(new Date().getHours()<GRATITUDE_CARD_HOUR)return '';
  if((STATE.gratitude||[]).some(function(e){return e&&e.date===today}))return '';
  return ''
    +'<div class="card planner-card" id="planner-gratitude-card">'
      +'<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>\uD83D\uDE4F Gratitude</span></div>'
      +'<div style="font-size:13px;color:var(--text3);margin-bottom:8px">One thing from today worth keeping.</div>'
      +'<textarea id="planner-gratitude-input" class="planner-capture-input" rows="2"'
        +' placeholder="e.g. Long run in the evening sun"'
        +' aria-label="Gratitude for today"'
        +' style="width:100%;font:inherit;font-size:13px;color:var(--text2);resize:vertical"></textarea>'
      +'<div style="display:flex;gap:8px;margin-top:8px">'
        +'<button type="button" class="btn btn-sm btn-accent" onclick="plannerSubmitGratitude()">Save \u2713</button>'
      +'</div>'
    +'</div>';
}

// Delegates to sweepSaveGratitude() — the single write path for gratitude
// captured outside the Gratitude page — then rebuilds the day, since a saved
// entry means this card no longer applies and has to leave the page.
function plannerSubmitGratitude(){
  var el=document.getElementById('planner-gratitude-input');
  var text=el?String(el.value||'').trim():'';
  if(!text)return;
  if(typeof sweepSaveGratitude!=='function'||!sweepSaveGratitude(text))return;
  renderPlannerToday();
}

// ── Monthly review prompt ──────────────────────────────────
// The monthly review kept getting lost: nothing on the planner ever pointed at
// it. This card appears during the last three days of the month while the
// month's review is unwritten, and holds over into the first three days of the
// next month while last month's is still open. It disappears the moment the
// review exists, and "Later" quiets it for the session (per prompted month, so
// a new month prompts again).
var MONTHREVIEW_DISMISS_KEY='lh_monthreview_dismissed';
function plannerMonthReviewCard(todayKey){
  var now=new Date();
  var monthly=(STATE.reviews&&STATE.reviews.monthly)||{};
  var day=now.getDate();
  var daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  var thisKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var prevDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  var prevKey=prevDate.getFullYear()+'-'+String(prevDate.getMonth()+1).padStart(2,'0');

  var promptKey=null,line='';
  if(day>=daysInMonth-2&&!monthly[thisKey]){
    promptKey=thisKey;
    var left=daysInMonth-day;
    line=left===0?'Today is the last day of the month.':(left+' '+(left===1?'day':'days')+' left in the month.');
  }else if(day<=3&&!monthly[prevKey]){
    promptKey=prevKey;
    line='Last month is still open for its review.';
  }
  if(!promptKey)return '';
  try{if(sessionStorage.getItem(MONTHREVIEW_DISMISS_KEY)===promptKey)return ''}catch(e){}

  var label=(typeof getMonthLabel==='function')?getMonthLabel(promptKey):promptKey;
  return ''
    +'<div class="card planner-card" id="planner-monthreview-card">'
      +'<div class="planner-card-head"><span class="planner-card-title"><span class="section-rule-bar"></span>\uD83D\uDCD3 Monthly review</span></div>'
      +'<div style="font-size:14px;font-weight:600;color:var(--text2)">'+escapeHtml(String(label))+' is ready to close.</div>'
      +'<div style="font-size:13px;color:var(--text3);margin-top:4px">'+escapeHtml(line)+' A few sliders and a couple of lines \u2014 the AI draft does the heavy lifting.</div>'
      +'<div style="display:flex;gap:8px;margin-top:12px">'
        +'<button type="button" class="btn btn-sm btn-accent" onclick="nav(\'review\')">Write the review</button>'
        +'<button type="button" class="btn btn-sm btn-ghost" onclick="plannerDismissMonthReview(\''+escapeHtml(promptKey)+'\')">Later</button>'
      +'</div>'
    +'</div>';
}

function plannerDismissMonthReview(key){
  try{sessionStorage.setItem(MONTHREVIEW_DISMISS_KEY,String(key))}catch(e){}
  renderPlannerToday();
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
  var habitStats=habitStatsForDays(STATE.habits||[],[todayKey],todayKey);
  var habitsTotal=habitStats.total;
  var habitsDone=habitStats.done;
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
  // The close-the-day card reuses this card's id but not its inner body element,
  // so the AI one-liner has nowhere to render until loadEveningSummaryLine
  // (task 14.4) retargets it at #sweep-summary-line. Bail rather than throw.
  if(!body)return;
  var sig=[stats.habitsDone,stats.habitsTotal,stats.training,stats.waterPct,stats.focusDone,stats.focusTotal].join('|').replace(/[^a-z0-9]/gi,'');
  var cacheKey='lh_sweep_'+todayKey+'_'+sig;
  try{var cached=localStorage.getItem(cacheKey);if(cached){body.textContent=cached;card.style.display='';return}}catch(e){}
  body.innerHTML='<span class="planner-sweep-loading">Reading your day…</span>';
  card.style.display='';
  lifeHubApiFetch(NOTIF_API+'/api/ai-narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sweep:stats})})
    .then(function(r){return r.json()}).then(function(d){
      if(d&&d.sweep){body.textContent=d.sweep;try{localStorage.setItem(cacheKey,d.sweep)}catch(e){}}
      else card.style.display='none';
    }).catch(function(){card.style.display='none'});
}

// Welcome masthead — washi-tape decoration, greeting, status chips, quote.
// Reuses getTimeContext() from dashboard.js and hardcodes user name "Kai".
//
// While a Quiet_Period is active the streak chip is omitted entirely: a streak
// value is a count and never carries a loss statement, and during a quiet
// stretch the count itself is left unsaid so the return is not framed as a
// setback (R6.11, R13.7). The Re_Entry_Card that renders above this one states
// counts only and says nothing about a broken streak.
function plannerWelcomeCard(todayKey){
  var tc=getTimeContext(); // {slot, greeting, class}
  var now=new Date();
  var dateStr=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  todayKey=todayKey||localDateKey(now);

  // Quiet_Period gate — quietGapDays() lives in js/dashboard.js and is 0 when
  // today carried an Activity_Event or when there is no activity at all.
  var gap=(typeof quietGapDays==='function')?quietGapDays():0;
  var quiet=gap>=QUIET_DAY_THRESHOLD;

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
  if(!quiet&&streak>=2)chips+='<span class="pw-chip pw-chip-streak">\uD83D\uDD25 '+streak+' day streak</span>';
  if(hasTraining)chips+='<span class="pw-chip pw-chip-training">\uD83C\uDFCB\uFE0F training day</span>';
  if(focusCount>0)chips+='<span class="pw-chip pw-chip-focus">\uD83C\uDFAF '+focusCount+' to focus on</span>';
  chips+='</div>';

  // Quote
  var quotes=CONTEXTUAL_QUOTES&&CONTEXTUAL_QUOTES[tc.slot]?CONTEXTUAL_QUOTES[tc.slot]:['One thing at a time.'];
  var quote=quotes[Math.floor(now.getMinutes()/15)%quotes.length]||quotes[0];

  return ''
    +'<div class="card planner-card planner-welcome-card" id="planner-welcome-card">'
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
  var weightSpark=(typeof sparklineSVG==='function')?sparklineSVG(weights.slice(-7).map(function(w){return Number(w.value)}),'var(--moss)'):'';
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
        +'<div class="pw-water-progress" aria-hidden="true"><span style="width:'+pct+'%"></span></div>'
        +'<button class="pw-water-btn" onclick="logWaterGlass('+(glasses+1)+')">+ glass</button>'
      +'</div>'
      +'<div class="card planner-card pw-weight-mini">'
        +'<div class="pw-mini-title">\u2696\uFE0F Weight</div>'
        +(latestW!=null?'<div class="pw-weight-val">'+latestW+' kg</div>':'<div class="pw-weight-val">\u2014</div>')
        +weightSpark
        +(weightChange!=null?'<div class="pw-weight-change '+weightClass+'">'+weightDir+' this week</div>':'')
        +'<button class="pw-weight-btn" onclick="openModal(\'logMetric\',\'weight\')">Log</button>'
      +'</div>'
    +'</div>';
}

// Re-render the cards a logged glass of water changes. Kept under this name
// because logWaterGlass() in js/gratitude.js calls it through a `typeof` guard
// and must keep finding it (R17.1, R17.5).
//
// `welcome` is in the set because a glass of water is an Activity_Event:
// dayHadActivity() counts STATE.water, so the first glass of the day turns today
// into an active day and showUpStreak() — which the welcome card renders as its
// streak chip — goes up by one. Without it the chip stays a day behind until the
// next full render, exactly the staleness plannerToggleHabit already declares
// `welcome` to avoid (R17.5).
//
// `short` is in the set because a glass of water is one of the Short_Version's
// three single-tap actions: the row has to come back showing the new count
// without the view mode moving (R6.9). Outside the Short_Version the key builds
// nothing and the patch skips it, so naming it here costs a full-day refresh
// nothing.
function renderPlannerWater(){
  refreshPlannerCards(['waterweight','welcome','sweep','short']);
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
    rows='<div class="planner-empty-line">No active rhythms due today — enjoy the breather.</div>';
  } else {
    rows='<div class="pw-habits-list">';
    rows+=habits.map(function(h){
      var done=!!(h.logs&&h.logs[today]),manual=done&&typeof habitManualCompleted==='function'&&habitManualCompleted(h,today),sourceOnly=done&&!manual;
      var label=sourceOnly?'Completed by linked activity: '+h.name:(done?'Undo ':'Complete ')+h.name;
      var hasDetails=typeof habitHasDetails==='function'&&habitHasDetails(h);
      var open=hasDetails&&habitDetailsOpen[h.id];
      var row='<div class="pw-habit-rowline">'
        +'<button type="button" class="pw-habit-row'+(done?' done':'')+'" data-planner-habit="'+h.id+'" aria-pressed="'+(done?'true':'false')+'" aria-label="'+escapeHtml(label)+'"'+(sourceOnly?' disabled':' onclick="plannerToggleHabit(\''+h.id+'\')"')+'>'
          +'<span class="pw-habit-check" data-tick="pwhab:'+h.id+'" aria-hidden="true">'+(done?'\u2713':'')+'</span>'
          +'<span class="pw-habit-name">'+(h.icon?escapeHtml(h.icon)+' ':'')+escapeHtml(h.name)+(sourceOnly?'<span class="pw-habit-source">Linked</span>':'')+'</span>'
        +'</button>'
        +(hasDetails?'<button type="button" class="pw-habit-info" data-planner-habit-info="'+h.id+'" aria-expanded="'+(open?'true':'false')+'" aria-label="'+(open?'Hide':'Show')+' what '+escapeHtml(h.name)+' entails" onclick="toggleHabitDetails(\''+h.id+'\')">'+(open?'\u25BE':'\u25B8')+'</button>':'')
      +'</div>';
      return '<div class="pw-habit-item">'+row+(open?habitDetailsPanelHTML(h):'')+'</div>';
    }).join('');
    rows+='</div>';
  }
  var doneCount=habits.filter(function(h){return h.logs&&h.logs[today]}).length;
  // Hand-drawn underline SVG
  var wavySvg='<svg class="pw-wavy-underline" viewBox="0 0 220 6" preserveAspectRatio="none" aria-hidden="true"><path d="M0 3 Q10 0 20 3 T40 3 T60 3 T80 3 T100 3 T120 3 T140 3 T160 3 T180 3 T200 3 T220 3" fill="none" stroke="var(--moss)" stroke-width="1.5" opacity="0.4"/></svg>';
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
  if(!h)return false;
  var today=localDateKey(new Date());var wasDone=!!(h.logs&&h.logs[today]);
  // Whether the tick came from the habit control itself. The refresh replaces
  // that control, so keyboard focus has to be put back on the new one — but only
  // when it held focus to begin with. Reaching for it unconditionally would pull
  // the caret out of the capture box mid-word, which is exactly what R17.3
  // forbids; before the Planner patched in place this line could not tell the
  // difference because everything was rebuilt anyway.
  var control='[data-planner-habit="'+hid+'"]';
  var fromControl=!!(document.activeElement&&document.activeElement.matches&&document.activeElement.matches(control));
  var saved=toggleHabitToday(hid);if(!saved)return false;
  // The tick changes the habits card, the welcome card's streak and chip line,
  // the evening sweep's habit count, and — while the Short_Version is open —
  // its first row, which is this same habit (R6.9).
  refreshPlannerCards(['habits','welcome','sweep','short']);
  var current=(STATE.habits||[]).find(function(x){return x.id===hid});
  if(!wasDone&&current&&current.logs&&current.logs[today]&&typeof bloomTick==='function')bloomTick('pwhab:'+hid);
  if(fromControl){var restored=document.querySelector(control);if(restored)restored.focus();}
  return true;
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

  var dotColors=['var(--moss)','var(--sky)','var(--amber)','var(--clay)','var(--text2)'];

  var html='<div class="card planner-card planner-schedule-card" id="planner-schedule-card">';
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

// Delete a time block (commitment or timed task) and refresh the schedule.
// Clearing a task's date can also drop it into the inbox, so the Inbox tab is
// redrawn alongside the Today cards.
function deleteTimeBlock(id,kind){
  if(kind==='commit'){
    STATE.commitments=(STATE.commitments||[]).filter(function(c){return c.id!==id});
  }else{
    var t=(STATE.tasks||[]).find(function(x){return x.id===id});
    if(t){delete t.dueTime;delete t.dueDate;}
  }
  saveState();
  // `inbox` is declared on top of the table's schedule/welcome pair: clearing a
  // task's date leaves it undated and unslated, which is the definition of an
  // inbox task, so the inbox card gains a row (R17.5).
  refreshPlannerCards(['schedule','welcome','inbox']);
  renderPlannerInbox();
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
  saveState();closeModal();
  refreshPlannerCards(['schedule','welcome']);
}

// Inbox — captured-but-unscheduled tasks, so a quick-add never disappears.
// Each row can be pulled into today's focus or opened to set a date/time.
function plannerInboxCard(){
  var inbox=getInboxTasks();
  if(!inbox.length)return '';
  var html='<div class="card planner-card planner-inbox-card card-quiet" id="planner-inbox-card">';
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
// Prefer the kind planned for today, then use a fixed activity order so the
// label is deterministic even when more than one session exists that day.
function plannerTrainingLoggedToday(dateKey,planned){
  var labels=[];
  (STATE.workouts||[]).forEach(function(w){
    if(!w||w.date!==dateKey)return;
    var label=w.type||w.name||'Session';
    if(labels.indexOf(label)===-1)labels.push(label);
  });
  var hasRun=((STATE.metrics||{}).run||[]).some(function(r){return r&&r.date===dateKey});
  if(hasRun&&labels.indexOf('Run')===-1)labels.push('Run');
  if(!labels.length)return null;

  var preferred=null;
  if(planned){
    if(planned.session==='run'&&hasRun)preferred='Run';
    else if(planned.session==='rest')preferred=labels.find(function(label){return /^rest/i.test(label)});
    else if(/hyrox/i.test(planned.label||''))preferred=labels.find(function(label){return /hyrox/i.test(label)});
    else preferred=labels.find(function(label){return !/^rest$/i.test(label)&&!/^rest day$/i.test(label)&&label!=='Run'});
  }
  if(preferred)return preferred;

  var order={hyrox:1,gym:2,upper:3,lower:4,strength:5,run:6,session:7,rest:9,'rest day':9};
  labels.sort(function(a,b){
    var ak=String(a).toLowerCase(),bk=String(b).toLowerCase();
    var ap=order[ak]||8,bp=order[bk]||8;
    return ap-bp||ak.localeCompare(bk);
  });
  return labels[0];
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

  var logged=plannerTrainingLoggedToday(todayKey,t);
  if(logged){
    html+='<div class="planner-train-done">'+escapeHtml(logged)+' \u2713 logged</div>';
  }else{
    html+='<div class="planner-train-actions">';
    if(isRest){
      html+='<button class="btn btn-sm pw-train-log-btn" onclick="quickLogToday(\'Rest\')">Log rest \uD83C\uDF3F</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Gym\')">Gym</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Hyrox\')">Hyrox</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="openModal(\'logRun\')">Run</button>';
    }else if(t.session==='run'){
      html+='<button class="btn btn-sm pw-train-log-btn" onclick="openModal(\'logRun\')">Log run \uD83C\uDFC3</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Gym\')">Gym</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Hyrox\')">Hyrox</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Rest\')">Rest</button>';
      if(t.runType)html+='<button class="btn btn-sm btn-ghost" onclick="openModal(\'moveRun\',\''+t.runType+'\')" title="Move this run to another day">Move to\u2026</button>';
    }else{
      html+='<button class="btn btn-sm pw-train-log-btn" onclick="quickLogToday(\'Gym\')">Log gym \uD83D\uDCAA</button>';
      html+='<button class="btn btn-sm btn-ghost" onclick="quickLogToday(\'Hyrox\')">Hyrox</button>';
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

  var html='<div class="card planner-card planner-focus-card" id="planner-focus-card">';
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

  // Create straight into the slate (R14.5). The chooser is the one place that
  // already knows the slate has room, and the empty state above already points
  // here ("Add one below…"). Its own id keeps it out of the capture box's way,
  // and it lives inside #planner-today, so capturePlannerFocus() /
  // restorePlannerFocus() put the caret back if an unrelated refresh replaces
  // the focus card mid-word (R17.3).
  html+='<div class="planner-chooser-add-row planner-capture-row">'
    +'<input type="text" id="planner-chooser-add-input" class="planner-capture-input" placeholder="or write a new one\u2026" aria-label="New focus task for today" onkeydown="if(event.key===\'Enter\')plannerCreateFocusTask()">'
    +'<button class="planner-capture-btn" onclick="plannerCreateFocusTask()" title="Add as today\'s focus" aria-label="Add as today\'s focus">+</button>'
  +'</div>';

  html+='</div>';
  return html;
}

function plannerChooserRow(t){
  return '<button class="planner-chooser-row" onclick="plannerPickFocus(\''+t.id+'\')">'
    +'<span class="planner-chooser-plus">+</span>'
    +'<span class="planner-chooser-text">'+escapeHtml(t.text)+'</span>'
    +'</button>';
}

// Quick-capture — dashed torn-note style card (R12.1, R14.1)
// `hostId` names the root element. The Today tab and the Inbox tab both render
// this card, so each passes its own id rather than putting the same one in the
// document twice.
//
// The text input is keyed off the same id. The Today card keeps the original
// `planner-capture-input`: plannerQuickCapture() with no argument still reads
// it, and capturePlannerFocus() / restorePlannerFocus() are scoped to
// #planner-today around that name. Every other host derives its own input id
// from its root, which is what makes the Inbox tab's box work — until now both
// boxes carried `planner-capture-input`, and the single getElementById lookup
// resolved by document order, so text typed on the Inbox tab went nowhere.
//
// Two controls: `+` files the text as an Inbox_Task (R14.4) and "+ Today" asks
// for it as one of today's three Focus_Tasks (R14.1). Both are native buttons,
// so both are keyboard-operable as they stand (R26.9).
function plannerCaptureCard(hostId){
  var host=hostId||'planner-capture-card';
  var inputId=(host==='planner-capture-card')?'planner-capture-input':host+'-input';
  var readInbox="{inputId:'"+inputId+"'}";
  var readFocus="{inputId:'"+inputId+"',focus:true}";
  return '<div class="card planner-card planner-capture-card" id="'+escapeHtml(host)+'">'
    +'<div class="planner-capture-row">'
      +'<input type="text" id="'+escapeHtml(inputId)+'" class="planner-capture-input" placeholder="jot something down\u2026" onkeydown="if(event.key===\'Enter\')plannerQuickCapture('+readInbox+')">'
      +'<button class="planner-capture-btn" onclick="plannerQuickCapture('+readInbox+')" title="Add to your inbox" aria-label="Add to your inbox">+</button>'
      +'<button class="btn btn-ghost btn-sm planner-capture-today" onclick="plannerQuickCapture('+readFocus+')" title="Add as one of today\'s focus tasks">+ Today</button>'
    +'</div>'
  +'</div>';
}

// ── Today-tab mutations ────────────────────────────────────
// Each one names the cards it invalidates and refreshes exactly those, in place
// (Components §C, "Mutation → invalidated card set"). None of them re-renders
// the whole Planner any more.
function plannerToggleCommitment(id){
  toggleCommitment(id,localDateKey(new Date()));
  // The schedule row changes, and the commitment count feeds the welcome card's
  // day description.
  refreshPlannerCards(['schedule','welcome']);
}

// Complete/uncomplete a focus task via the normal task done/doneAt flow (R10.2)
function plannerToggleFocusDone(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var wasDone=!!t.done;
  t.done=!wasDone;
  t.doneAt=t.done?localDateKey(new Date()):null;
  saveState();
  // One handler serves the focus list, the Today inbox rows and the schedule
  // rows, so all three can hold the task that just changed. The welcome chip
  // line counts open focus tasks and the sweep counts completed ones.
  //
  // `reentry` is here for the un-complete direction. A completed task is an
  // Activity_Event, so clearing a `doneAt` that sits in the past removes an
  // active day and lengthens the gap quietGapDays() reports — while today stays
  // inactive, so the re-entry card is still on the page and its gap line goes
  // stale. Completing a task instead makes today active, which removes the card
  // and escalates to a full render on its own (R17.5).
  //
  // `short` is the Short_Version's third row, which is this same task: ticking
  // it there has to redraw the reduced view — where a done task drops off the
  // list — without leaving it (R6.9).
  refreshPlannerCards(['focus','welcome','sweep','inbox','schedule','reentry','short']);
  // The Inbox tab renders its own rows from this same handler and is not part of
  // the Today card registry, so it is redrawn separately.
  renderPlannerInbox();
  if(!wasDone&&t.done){
    if(typeof bloomTick==='function')bloomTick('focus:'+id);
    if(typeof showCelebrationToast==='function')showCelebrationToast('Done — '+t.text,'✓');
  }
}

function plannerRemoveFocus(id){
  removeFocusTask(id);
  plannerFocusNote='';
  refreshPlannerCards(PLANNER_FOCUS_SLATE_CARDS);
}

// Toggle a task's micro-step from the Planner focus card. Micro-steps render
// inside the focus card and nowhere else.
function plannerToggleSubStep(taskId,idx){
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t||!t.subSteps||!t.subSteps[idx])return;
  t.subSteps[idx].done=!t.subSteps[idx].done;
  saveState();
  refreshPlannerCards(['focus']);
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
  refreshPlannerCards(PLANNER_FOCUS_SLATE_CARDS);
}

// Pull an inbox task into today's focus; gives a toast if the 3-focus cap is hit
// (the inline note only renders on the focus card / chooser, not the inbox).
function plannerInboxMakeFocus(taskId){
  var ok=addFocusTask(taskId);
  if(!ok&&typeof showCelebrationToast==='function'){
    showCelebrationToast('Three focus tasks is plenty for today.','🎯');
  }
  refreshPlannerCards(PLANNER_FOCUS_SLATE_CARDS);
}

// Quick capture — adds a task; routes time-blocked input to the commitment modal when available (R12.1)
//
// `opts` is optional and every field has a default, so plannerQuickCapture()
// with no argument behaves exactly as it always has: read
// `planner-capture-input`, file the text as an Inbox_Task (R14.4).
//
//   opts.inputId — which capture box to read. Defaults to the Today card's.
//   opts.focus   — true asks for the task as one of today's Focus_Tasks
//                  (R14.2). A full slate leaves it in the inbox and says so
//                  (R14.3).
function plannerQuickCapture(opts){
  var o=opts||{};
  var wantFocus=(o.focus===true);
  var inp=document.getElementById(o.inputId||'planner-capture-input');
  if(!inp)return;
  var raw=(inp.value||'').trim();
  if(!raw)return;

  // Time-blocked shape (e.g. "maths 2-4pm", "call 14:00") → commitment capture.
  // The commitment modal + routing is wired in task 6; until then this falls
  // through to adding a task. plannerCaptureCommitment is defined there.
  //
  // Only on the default path: "+ Today" names a focus task outright, so a time
  // in the text is part of the task rather than a request for a commitment, and
  // diverting it into the commitment modal would drop the focus slot the press
  // asked for.
  var timeBlocked=/\b\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(raw)||/\b\d{1,2}:\d{2}\b/.test(raw);
  if(!wantFocus&&timeBlocked&&typeof plannerCaptureCommitment==='function'){
    plannerCaptureCommitment(raw);
    inp.value='';
    return;
  }

  var parsed=(typeof parseTaskInput==='function')?parseTaskInput(raw):{text:raw,dueDate:null};
  if(!STATE.tasks)STATE.tasks=[];
  var newId=g();
  STATE.tasks.push({
    id:newId,
    text:parsed.text,
    done:false,
    dueDate:parsed.dueDate||null,
    doneAt:null,
    createdAt:localDateKey(new Date())
  });
  inp.value='';
  var slated=false;
  if(wantFocus){
    // R14.6 — the cap of three is addFocusTask's, the same guard plannerPickFocus,
    // plannerInboxMakeFocus and plannerWeekMakeFocus go through. It stamps
    // today's focusDate and saves on success (R14.2); on a full slate it returns
    // false and the task stays exactly what it already is — an Inbox_Task —
    // which is what R14.3 asks for, stated as a fact and nothing more.
    slated=addFocusTask(newId);
    if(!slated){
      saveState();
      if(typeof showCelebrationToast==='function'){
        showCelebrationToast('Today\'s focus slate is full — this is in your inbox.','\uD83D\uDCE5');
      }
    }
  }else{
    saveState();
  }
  // includeInputCards: the capture input is this mutation's own origin and has
  // already been cleared, so replacing it is safe here and nowhere else.
  // `schedule` is declared because parseTaskInput can put a due date on the new
  // task, and a task dated today lands on today's schedule (R17.5). A task that
  // joined the slate touches the wider focus-slate set instead.
  var cards=slated?['capture'].concat(PLANNER_FOCUS_SLATE_CARDS):['capture','inbox','focus','schedule'];
  refreshPlannerCards(cards,{includeInputCards:true});
  // The Inbox tab renders the same capture card under its own root id.
  renderPlannerInbox();
}

// Create a task straight into today's slate from the Focus_Chooser's own input,
// then close the chooser (R14.5, R14.6). The task is pushed first and slated
// through addFocusTask, so the cap of three is enforced by that one guard rather
// than a second check here.
function plannerCreateFocusTask(){
  var inp=document.getElementById('planner-chooser-add-input');
  if(!inp)return;
  var raw=(inp.value||'').trim();
  if(!raw)return;

  var parsed=(typeof parseTaskInput==='function')?parseTaskInput(raw):{text:raw,dueDate:null};
  if(!STATE.tasks)STATE.tasks=[];
  var newId=g();
  STATE.tasks.push({
    id:newId,
    text:parsed.text,
    done:false,
    dueDate:parsed.dueDate||null,
    doneAt:null,
    createdAt:localDateKey(new Date())
  });
  inp.value='';
  var slated=addFocusTask(newId);   // saves on success
  if(!slated){
    // The chooser only renders with room on the slate, so this is the race
    // rather than the norm. The task keeps its place in the inbox.
    saveState();
    if(typeof showCelebrationToast==='function'){
      showCelebrationToast('Today\'s focus slate is full — this is in your inbox.','\uD83D\uDCE5');
    }
  }
  plannerFocusNote='';
  plannerFocusChooserOpen=false;    // R14.6 — the chooser closes either way
  refreshPlannerCards(PLANNER_FOCUS_SLATE_CARDS);
  // The Inbox tab lists the same tasks and is not part of the Today registry.
  renderPlannerInbox();
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
  el.innerHTML=plannerWeekHeaderCard(wkKey)+plannerWeekPrioritiesCard(wkKey)+plannerHabitConsistencyCard(wkKey)+plannerTrainingSplitCard(wkKey)+plannerIntentionCard(wkKey)+plannerBlockScheduleCard(wkKey)+plannerFixedTasksCard(wkKey)+plannerNextWeekCard(wkKey);
}

// Week header card — "This week" + date range + 7-day strip
function plannerWeekHeaderCard(wkKey){
  // weekDays(weekKey(d)) is Mon→Sun already — no display reordering needed.
  var days=weekDays(wkKey);
  var todayKey=localDateKey(new Date());
  var dayLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Compute date range label (e.g. "20–26 Jul") from Mon to Sun
  var first=new Date(days[0]+'T12:00:00');
  var last=new Date(days[6]+'T12:00:00');
  var rangeStr=first.getDate()+'\u2013'+last.getDate()+' '+last.toLocaleDateString('en-GB',{month:'short'});

  var html='<div class="card planner-card pw-week-header-card">';
  html+='<div class="pw-week-header-top"><span class="pw-week-header-title">This week</span><span class="pw-week-header-range">'+rangeStr+'</span></div>';
  html+='<div class="pw-week-daystrip">';
  days.forEach(function(dk){
    var d=new Date(dk+'T12:00:00');
    var dow=d.getDay();
    var isToday=dk===todayKey;
    html+='<div class="pw-week-daycell'+(isToday?' is-today':'')+'">'
      +'<span class="pw-week-daycell-label">'+dayLabels[dow]+'</span>'
      +'<span class="pw-week-daycell-num">'+d.getDate()+'</span>'
    +'</div>';
  });
  html+='</div></div>';
  return html;
}

// Priorities card — maps to weekPriority tasks (gold accent)
function plannerWeekPrioritiesCard(wkKey){
  var tasks=getWeekTasks(wkKey);
  var todayKey=localDateKey(new Date());

  var html='<div class="card planner-card pw-priorities-card">';
  html+='<div class="pw-priorities-label">\u2B50 PRIORITIES THIS WEEK</div>';

  if(plannerWeekNote){
    html+='<div class="planner-focus-note">'+escapeHtml(plannerWeekNote)+'</div>';
  }

  if(tasks.length){
    html+='<div class="pw-priorities-list">';
    tasks.forEach(function(t){
      var isFocus=t.focusDate===todayKey;
      html+='<div class="pw-priority-row'+(t.done?' done':'')+'">'
        +'<div class="pw-priority-check'+(t.done?' done':'')+'" onclick="plannerToggleWeekDone(\''+t.id+'\')" role="button" tabindex="0" aria-label="Toggle '+escapeHtml(t.text)+'">'+(t.done?'\u2713':'')+'</div>'
        +'<span class="pw-priority-text">'+escapeHtml(t.text)+'</span>'
        +(t.done
            ?''
            :(isFocus
                ?'<span class="week-focus-flag" title="Already today\'s focus">\u2605 Today</span>'
                :'<button class="btn btn-ghost btn-sm week-make-focus" onclick="plannerWeekMakeFocus(\''+t.id+'\')" title="Make today\'s focus">Focus</button>'))
      +'</div>';
    });
    html+='</div>';
  }else{
    html+='<div class="planner-empty-line">No priorities for this week yet.</div>';
  }

  // Inline add
  html+='<div class="planner-week-add-row">'
    +'<input type="text" id="planner-week-add-input" class="planner-capture-input" placeholder="Add a priority\u2026" onkeydown="if(event.key===\'Enter\')plannerAddWeekTask()">'
    +'<button class="planner-capture-btn" onclick="plannerAddWeekTask()">+</button>'
  +'</div>';

  html+='</div>';
  return html;
}

// Habit consistency card — 7-column dot grid for the current week
function plannerHabitConsistencyCard(wkKey){
  var habits=(STATE.habits||[]).filter(function(h){
    var f=(h.freq||'daily').toLowerCase();
    return f==='daily'||/^\d+x\/week$/.test(f)||f==='weekly';
  });
  if(!habits.length)return '';
  var displayDays=habitWeekDays(wkKey);
  var colLabels=['M','T','W','T','F','S','S'];

  // Target-based totals keep Nx/week denominators stable throughout the week.
  var consistencyStats=habitStatsForDays(habits,displayDays,displayDays[6]);
  var pct=consistencyStats.pct;

  var html='<div class="card planner-card pw-consistency-card">';
  html+='<div class="pw-consistency-head"><span class="pw-consistency-title">Habit consistency</span><span class="pw-consistency-pct">'+pct+'%</span></div>';
  html+='<div class="pw-consistency-grid">';
  // Column headers
  html+='<div class="pw-cg-row pw-cg-header"><span class="pw-cg-label"></span>';
  colLabels.forEach(function(l){html+='<span class="pw-cg-col-head">'+l+'</span>'});
  html+='</div>';
  // Habit rows
  habits.forEach(function(h){
    var name=(h.icon?h.icon+' ':'')+h.name;
    html+='<div class="pw-cg-row"><span class="pw-cg-label" title="'+escapeHtml(h.name)+'">'+escapeHtml(name)+'</span>';
    displayDays.forEach(function(dk){
      var s=(typeof habitDayStatus==='function')?habitDayStatus(h,dk):'todo';
      var filled=(s==='done');
      var applicable=(s==='done'||s==='todo');
      html+='<span class="pw-cg-dot'+(filled?' filled':'')+(applicable?'':' rest')+'"></span>';
    });
    html+='</div>';
  });
  html+='</div></div>';
  return html;
}

// Training split card — Mon–Sun schedule for the current week
function plannerTrainingSplitCard(wkKey){
  if(typeof todaysTrainingSession!=='function')return '';
  // weekDays(weekKey(d)) is Mon→Sun already — no display reordering needed.
  var days=weekDays(wkKey);
  var todayKey=localDateKey(new Date());
  var dayLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  var html='<div class="card planner-card pw-split-card">';
  html+='<div class="pw-split-head">\uD83C\uDFCB\uFE0F Training split</div>';
  html+='<div class="pw-split-list">';
  days.forEach(function(dk){
    var d=new Date(dk+'T12:00:00');
    var dow=d.getDay();
    var isToday=dk===todayKey;
    var s=todaysTrainingSession(dk);
    var label=s?s.label:'Rest';
    var isRest=(!s||s.session==='rest');
    html+='<div class="pw-split-row'+(isToday?' is-today':'')+(isRest?' is-rest':'')+'">'
      +'<span class="pw-split-day'+(isToday?' is-today':'')+'">'+dayLabels[dow]+'</span>'
      +'<span class="pw-split-session'+(isRest?' is-rest':'')+'">'+escapeHtml(label)+'</span>'
      +(isToday?'<span class="pw-split-today-badge">TODAY</span>':'')
    +'</div>';
  });
  html+='</div></div>';
  return html;
}

// Read-only training schedule for the current HM block week (addendum §2.4):
// the three runs + two strength sessions laid out by day, above the week's
// life tasks. Returns '' outside the block so nothing shows off-plan.
function plannerBlockScheduleCard(wkKey){
  if(typeof todaysTrainingSession!=='function'||typeof weekDays!=='function')return '';
  var ctx=(typeof resolveHmWeek==='function')?resolveHmWeek(localDateKey(new Date())):null;
  if(!ctx)return '';
  var days=weekDays(wkKey);            // Mon→Sun date keys
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
  var nextText=weeklyIntentionText(nextWk);
  var carryover=getWeekTasks(wkKey).filter(function(t){return t&&!t.done});

  var html='<div class="card planner-card planner-nextweek-card">';
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

  // (b) Select any unfinished priorities, then move them together in one
  // reversible action. Nothing changes until the batch button is pressed.
  if(carryover.length){
    html+='<div class="planner-nextweek-carry-label">Bring these along?</div>';
    html+='<div class="planner-nextweek-list" id="planner-nextweek-list">';
    carryover.forEach(function(t){
      html+='<label class="nextweek-row">'
        +'<input type="checkbox" class="nextweek-check-input" value="'+escapeHtml(t.id)+'" aria-label="Bring '+escapeHtml(t.text)+' to next week">'
        +'<span class="nextweek-text">'+escapeHtml(t.text)+'</span>'
      +'</label>';
    });
    html+='</div>';
    html+='<div class="planner-nextweek-batch"><button class="btn btn-sm pw-train-log-btn" onclick="plannerCarryForward()">Bring selected along →</button></div>';
  }else{
    html+='<div class="planner-empty-line">Nothing left hanging — a clean slate for next week.</div>';
  }

  html+='</div>';
  return html;
}

// Save next week's intention without replacing the current week's entry.
function plannerSaveNextIntention(){
  var inp=document.getElementById('planner-next-intention-input');
  if(!inp)return;
  setWeeklyIntention(inp.value||'',nextWeekKey());
  renderPlanner();
}

// Move selected unfinished priorities together. Capture one snapshot before any
// mutation so the whole batch can be undone as a single action.
function plannerCarryForward(){
  var selected=Array.prototype.slice.call(document.querySelectorAll('#planner-nextweek-list .nextweek-check-input:checked'));
  var ids=selected.map(function(input){return input.value});
  if(!ids.length){
    if(typeof showCelebrationToast==='function')showCelebrationToast('Choose anything you’d like to bring along','🌱');
    return;
  }
  var nextWk=nextWeekKey();
  var tasks=(STATE.tasks||[]).filter(function(t){return t&&ids.indexOf(t.id)!==-1&&!t.done});
  if(!tasks.length)return;
  if(typeof captureUndoSnapshot==='function')captureUndoSnapshot(tasks.length===1?'Task brought along':'Tasks brought along');
  tasks.forEach(function(t){t.weekPriority=nextWk});
  saveState();
  renderPlanner();
  if(typeof showCelebrationToast==='function')showCelebrationToast(tasks.length===1?'Brought along to next week':tasks.length+' brought along to next week','🌱');
}

// Weekly intention — one line, prefilled when set for the current week (R9.1)
function plannerIntentionCard(wkKey){
  var current=weeklyIntentionText(wkKey);
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
  refreshPlannerCards(PLANNER_FOCUS_SLATE_CARDS);
  // This mutation is triggered from the week tab, whose cards carry the inline
  // note and the "★ Today" flag and are not part of the Today registry.
  if(typeof renderPlannerWeek==='function')renderPlannerWeek();
}
