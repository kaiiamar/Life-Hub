// DASHBOARD
// ============================================================

// ── Inline SVG icon set (#5) ──
// Lightweight, currentColor-themed icons for system chrome. Use icon('run')
// etc. Emoji stay for user-chosen things (habit icons). Stroke-based, 1.6.
var ICONS={
  run:'<path d="M13 4a2 2 0 1 0 0-.001M5 21l3-5 3 2 1-4M8 16l-2-3 4-3 3 2 3-1"/>',
  dumbbell:'<path d="M6.5 6.5l11 11M3 9v6M21 9v6M6 7v10M18 7v10"/>',
  rest:'<path d="M3 12h6l2-3 2 6 2-3h6"/>',
  flame:'<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3 0 2 1 3 2 3 1 0 2-1 2-3 0-3-1-4-1-5z"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>'
};
function icon(name,size){
  var p=ICONS[name];if(!p)return '';
  var s=size||18;
  return '<svg class="ico" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" '
    +'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" '
    +'aria-hidden="true" focusable="false">'+p+'</svg>';
}

// ── Bloom glow-up SVG helpers (#signature layer, matches design-preview-5) ──
// Pure, dependency-free inline-SVG builders reused across dashboard, training,
// habits and planner. sparklineSVG draws a tiny trend polyline; ringSVG draws a
// progress ring with optional centre text. Defined here because dashboard.js is
// loaded early (before habits/workouts/gratitude/planner), so every renderer can
// call them. Colours accept CSS tokens (e.g. 'var(--accent)') — resolved by the
// browser since the markup is injected live into the DOM.
function sparklineSVG(values,color){
  var vals=(values||[]).filter(function(v){return typeof v==='number'&&isFinite(v)});
  if(vals.length<2)return '';  // gracefully omit with too few points
  color=color||'var(--moss)';
  var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
  var range=(max-min)||1;
  var w=100,h=24,pad=3;
  var step=w/(vals.length-1);
  var pts=vals.map(function(v,i){
    var x=i*step;
    var y=(h-pad)-((v-min)/range)*(h-pad*2);
    return (Math.round(x*10)/10)+','+(Math.round(y*10)/10);
  }).join(' ');
  return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">'
    +'<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2.6" '
    +'stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function ringSVG(pct,color,size,centerText){
  pct=Math.max(0,Math.min(100,Number(pct)||0));
  color=color||'var(--moss)';
  size=size||34;
  var r=(size-6)/2,cx=size/2,c=2*Math.PI*r,off=c-(pct/100)*c;
  return '<svg class="ring" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" aria-hidden="true">'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="var(--moss-dim)" stroke-width="3.5"/>'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="3.5" '
    +'stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 '+cx+' '+cx+')"/>'
    +(centerText?'<text x="'+cx+'" y="'+(cx+3)+'" text-anchor="middle" font-size="9" font-family="Spline Sans Mono" fill="'+color+'">'+centerText+'</text>':'')
    +'</svg>';
}

// ── "Showed up" streak (#5) ──
// Forgiving momentum metric: a day counts if you logged ANYTHING — ticked a
// habit, logged mood, water, a task, a workout or a run. Counts consecutive
// days ending today (or yesterday if today's still empty, so it never punishes
// an in-progress morning).
function dayHadActivity(dateKey){
  if((STATE.habits||[]).some(function(h){return h.logs&&h.logs[dateKey]}))return true;
  if((STATE.mood||{})[dateKey]&&((STATE.mood||{})[dateKey].mood||(STATE.mood||{})[dateKey].sleep))return true;
  if(Number((STATE.water||{})[dateKey]||0)>0)return true;
  if((STATE.tasks||[]).some(function(t){return t.done&&t.doneAt===dateKey}))return true;
  if((STATE.workouts||[]).some(function(w){return w.date===dateKey&&(w.type||'').toLowerCase()!=='rest'}))return true;
  if((((STATE.metrics||{}).run)||[]).some(function(r){return r.date===dateKey}))return true;
  if((STATE.gratitude||[]).some(function(e){return e.date===dateKey}))return true;
  return false;
}
function showUpStreak(){
  var streak=0;
  var d=new Date();
  // If today has no activity yet, start counting from yesterday (grace).
  if(!dayHadActivity(localDateKey(d)))d.setDate(d.getDate()-1);
  for(var i=0;i<400;i++){
    if(dayHadActivity(localDateKey(d))){streak++;d.setDate(d.getDate()-1)}
    else break;
  }
  return streak;
}

// ── Quiet-gap detection ──
// Nothing new is stored: the Last_Activity_Date is derived by walking back over
// the dated records every Activity_Event already writes, using dayHadActivity()
// above as the single definition of "an Activity_Event happened that day".
// Both helpers are pure reads — no saveState, no STATE mutation — so the gap is
// a function of the activity-bearing domains alone.

// The latest day at or before beforeKey (default yesterday) that carries an
// Activity_Event, or null when none is found. Bounded at 400 days back so a long
// silence reads as "no activity" instead of walking for years.
function lastActivityDateKey(beforeKey){
  var d;
  if(beforeKey){d=new Date(beforeKey+'T12:00:00')}
  else{d=new Date();d.setDate(d.getDate()-1)}
  if(isNaN(d.getTime()))return null;
  for(var i=0;i<400;i++){
    var key=localDateKey(d);
    if(dayHadActivity(key))return key;
    d.setDate(d.getDate()-1);
  }
  return null;
}

// Whole days of silence ending today. Zero when today already has an
// Activity_Event, and zero when there is no activity anywhere — a brand-new user
// is not in a quiet period. Monotonic while no new activity arrives.
function quietGapDays(){
  var todayKey=localDateKey(new Date());
  if(dayHadActivity(todayKey))return 0;
  var last=lastActivityDateKey();
  if(!last)return 0;
  return Math.round((new Date(todayKey+'T12:00:00')-new Date(last+'T12:00:00'))/86400000);
}

// ── Quiet-period recap ──
// The window is half-open: the days *after* fromKey through toKey inclusive.
// fromKey is the last day that carried an Activity_Event, so the counted stretch
// is exactly the silence quietGapDays() measures — call it with no arguments and
// `days` equals `quietGapDays()`, so the Re_Entry_Card and the recap never
// disagree about how long the period was (Requirements 6.4, 7.3).
// Bounded at the same 400 days as the derivation walk; when a caller passes a
// longer range the most recent 400 days are counted and `days` reports what was
// actually counted, so the stated period always matches the counts.
var QUIET_RECAP_MAX_DAYS=400;
function quietPeriodRecapDays(fromKey,toKey){
  var endKey=toKey||localDateKey(new Date());
  var startKey=fromKey||lastActivityDateKey();
  // No last-activity day, or nothing between the two: an empty window.
  if(!startKey||!endKey||startKey>=endKey)return [];
  var d=new Date(endKey+'T12:00:00');
  if(isNaN(d.getTime()))return [];
  var days=[];
  for(var i=0;i<QUIET_RECAP_MAX_DAYS;i++){
    var key=localDateKey(d);
    if(key<=startKey)break;
    days.push(key);
    d.setDate(d.getDate()-1);
  }
  return days.reverse();
}

// Counts of what was recorded during the quiet stretch, each over the same day
// window so every figure is stated against the one period. Pure read: it
// delegates to the existing calculators — habitCountInRange for ticks,
// dashboardTrainingCount for sessions and runs, gratitudeStats for entries — and
// defines no measure of its own. `empty` is the no-activity case the recap
// states plainly instead of reporting three zeros (Requirement 7.4).
function quietPeriodRecap(fromKey,toKey){
  var days=quietPeriodRecapDays(fromKey,toKey);
  var habitTicks=0;
  if(days.length){
    var rangeStart=days[0],rangeEnd=days[days.length-1];
    (STATE.habits||[]).forEach(function(h){habitTicks+=habitCountInRange(h,rangeStart,rangeEnd)});
  }
  var sessions=days.length?dashboardTrainingCount(days):0;
  var gratitudeEntries=days.length?gratitudeStats(days).entries:0;
  return {
    days:days.length,
    habitTicks:habitTicks,
    sessions:sessions,
    gratitudeEntries:gratitudeEntries,
    empty:habitTicks===0&&sessions===0&&gratitudeEntries===0
  };
}

function getTimeContext(){
  var h=new Date().getHours();
  if(h>=5&&h<12)return {slot:'morning',greeting:'Good morning',class:'time-morning'};
  if(h>=12&&h<17)return {slot:'afternoon',greeting:'Good afternoon',class:'time-afternoon'};
  if(h>=17&&h<21)return {slot:'evening',greeting:'Good evening',class:'time-evening'};
  return {slot:'night',greeting:'Winding down',class:'time-night'};
}
var CONTEXTUAL_QUOTES={
  morning:['You did not wake up to be mediocre.','A quiet start. Make it count.','First hour, best hour.','Begin with one small intention.'],
  afternoon:['Midday check — are you still with you?','Half the day remains. Use it well.','Keep moving. Softly.','The afternoon rewards the focused.'],
  evening:['Soft landings make better days tomorrow.','Celebrate the small wins today.','Evening is for reflection, not regret.','You did enough. You are enough.'],
  night:['Time to wind down.','Rest is part of the plan.','Dim the screen, quiet the mind.','Tomorrow starts with tonight\'s rest.']
};

// Dashboard view state. A direct Insights navigation sets this before nav()
// renders the page, avoiding timing-coupled tab switching.
var _dashboardRequestedTab=null;

function dashboardHabitStats(days,todayKey){
  return habitStatsForDays(STATE.habits||[],days,todayKey);
}

function dashboardTrainingCount(days){
  var sessions=(STATE.workouts||[]).filter(function(w){
    return w&&days.indexOf(w.date)!==-1&&String(w.type||w.name||'').toLowerCase()!=='rest'&&String(w.name||'').toLowerCase()!=='rest day';
  }).length;
  var runs=(((STATE.metrics||{}).run)||((STATE.metrics||{}).runs)||[]).filter(function(r){return r&&days.indexOf(r.date)!==-1}).length;
  return sessions+runs;
}

function dashboardMoodStats(days){
  var moodVals=[],sleepVals=[];
  days.forEach(function(day){
    var entry=(STATE.mood||{})[day]||{};
    if(Number(entry.mood)>0)moodVals.push(Number(entry.mood));
    if(Number(entry.sleep)>0)sleepVals.push(Number(entry.sleep));
  });
  function avg(values){return values.length?Math.round(values.reduce(function(sum,value){return sum+value},0)/values.length*10)/10:null}
  return {mood:avg(moodVals),sleep:avg(sleepVals),logged:moodVals.length};
}

function dashboardDelta(current,previous,unit){
  if(current==null||previous==null)return 'No previous-week comparison yet';
  var diff=Math.round((current-previous)*10)/10;
  if(diff===0)return 'About the same as last week';
  return (diff>0?'+':'')+diff+(unit||'')+' from last week';
}

function buildDashboardViewModel(){
  var now=new Date();
  var todayKey=localDateKey(now);
  var thisWeekDays=habitWeekDays(now).filter(function(day){return day<=todayKey});
  var previousStart=habitAddDays(habitWeekStart(now),-7);
  var previousWeekDays=habitWeekDays(previousStart);
  var habits=dashboardHabitStats(thisWeekDays,todayKey);
  var previousHabits=dashboardHabitStats(previousWeekDays,todayKey);
  var sessions=dashboardTrainingCount(thisWeekDays);
  var previousSessions=dashboardTrainingCount(previousWeekDays);
  var mood=dashboardMoodStats(thisWeekDays);
  var previousMood=dashboardMoodStats(previousWeekDays);

  // financeTotals() lives in js/finance.js and is the single definition of these
  // figures. Safe to call here: buildDashboardViewModel only runs from render
  // paths, long after every script tag has been evaluated.
  var finance=financeTotals();
  var margin=finance.margin;

  var focus=(STATE.tasks||[]).filter(function(task){return task&&task.focusDate===todayKey});
  var focusDone=focus.filter(function(task){return task.done}).length;
  var commitments=typeof getTodayCommitments==='function'?getTodayCommitments(todayKey):[];
  var nextCommitment=commitments.filter(function(item){return !item.done}).sort(function(a,b){return String(a.start||'99:99').localeCompare(String(b.start||'99:99'))})[0]||null;

  var attention=[];
  var dueRelationships=(STATE.relationships||[]).filter(function(person){
    if(!person.lastContact)return true;
    var last=new Date(person.lastContact+'T12:00:00');
    return Math.floor((now-last)/86400000)>=Number(person.freq||14);
  });
  if(dueRelationships.length){
    attention.push({icon:'🤎',title:dueRelationships.length+' relationship check-in'+(dueRelationships.length===1?'':'s')+' ready',body:'Reconnect when it feels useful.',cta:'Open relationships',action:"nav('relationships')"});
  }
  var monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  var hasReview=!!(STATE.reviews&&STATE.reviews.monthly&&STATE.reviews.monthly[monthKey]);
  if(now.getDate()>=monthEnd-2&&!hasReview){
    attention.push({icon:'🌙',title:'Monthly reflection is available',body:'A short review can close the month when you are ready.',cta:'Open reviews',action:"nav('review')"});
  }
  var targetSoon=(STATE.goals||[]).filter(function(goal){return goal&&!goal.done&&goal.deadline}).map(function(goal){return {goal:goal,days:Math.ceil((new Date(goal.deadline+'T12:00:00')-new Date(todayKey+'T12:00:00'))/86400000)}}).filter(function(item){return item.days>=-30&&item.days<=30}).sort(function(a,b){return a.days-b.days})[0];
  if(targetSoon){
    attention.push({icon:'🎯',title:targetSoon.goal.name,body:targetSoon.days<0?'Target date was '+fmtDate(targetSoon.goal.deadline)+'. Revisit it when useful.':targetSoon.days+' days until the target date.',cta:'Open goals',action:"nav('goals')"});
  }
  if(margin<0){
    attention.push({icon:'🧮',title:'Monthly plan has a '+fmtMoney(Math.abs(margin))+' gap',body:'Income and recurring expenses currently do not balance.',cta:'Review finance',action:"nav('finance')"});
  }

  var recentSessions=(STATE.workouts||[]).filter(function(w){return w&&String(w.type||w.name||'').toLowerCase()!=='rest'&&String(w.name||'').toLowerCase()!=='rest day'}).map(function(w){return {date:w.date,title:w.name||w.type||'Training session',detail:(w.muscleGroups||[]).join(', ')||'Training',icon:/hyrox/i.test((w.name||'')+' '+(w.type||''))?'⚡':'🏋️'}});
  (((STATE.metrics||{}).run)||((STATE.metrics||{}).runs)||[]).forEach(function(run){recentSessions.push({date:run.date,title:Number(run.distance||0)+'km run',detail:run.time||run.note||'Run',icon:'🏃'})});
  recentSessions.sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))});

  var latestGratitude=(STATE.gratitude||[]).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))})[0]||null;
  var upcoming=[];
  (STATE.trainingEvents||[]).filter(function(event){return event&&event.date>=todayKey}).sort(function(a,b){return a.date.localeCompare(b.date)}).slice(0,2).forEach(function(event){upcoming.push({icon:'🏁',title:event.name||'Training event',detail:fmtDate(event.date),date:event.date,action:"nav('workout')"})});
  (STATE.goals||[]).filter(function(goal){return goal&&!goal.done&&goal.deadline&&goal.deadline>=todayKey}).sort(function(a,b){return a.deadline.localeCompare(b.deadline)}).slice(0,2).forEach(function(goal){upcoming.push({icon:'🎯',title:goal.name,detail:'Target '+fmtDate(goal.deadline),date:goal.deadline,action:"nav('goals')"})});
  upcoming.sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''))});

  return {
    todayKey:todayKey,
    habits:habits,previousHabits:previousHabits,
    sessions:sessions,previousSessions:previousSessions,
    mood:mood,previousMood:previousMood,
    finance:finance,
    focus:{done:focusDone,total:focus.length},nextCommitment:nextCommitment,
    attention:attention,recentSessions:recentSessions.slice(0,3),latestGratitude:latestGratitude,upcoming:upcoming.slice(0,4)
  };
}

function renderDashboardTodayBridge(view){
  var el=document.getElementById('dash-today-bridge');if(!el)return;
  var focusText=view.focus.total?view.focus.done+' of '+view.focus.total+' focus tasks complete':'No focus selected yet';
  var next=view.nextCommitment?'<div class="dashboard-next-line"><span class="dashboard-next-time">'+escapeHtml(view.nextCommitment.start||'Any time')+'</span><span>'+escapeHtml(view.nextCommitment.text||'Commitment')+'</span></div>':'<div class="dashboard-next-line dashboard-next-empty">No remaining commitments today</div>';
  el.innerHTML='<div class="dashboard-today-head"><div><h2 id="dash-today-title">Today at a glance</h2><p>'+focusText+'</p></div><button class="btn btn-accent btn-sm" onclick="nav(\'planner\')">Open Today</button></div>'+next;
}

function renderDashChrome(view){
  var now=new Date();var ctx=getTimeContext();
  var themePref=null;try{themePref=localStorage.getItem('lh_theme')}catch(e){}
  if(!themePref){if(ctx.slot==='night')document.body.classList.add('night-mode');else document.body.classList.remove('night-mode')}
  var hero=document.getElementById('hero');
  if(hero){hero.classList.remove('time-morning','time-afternoon','time-evening','time-night');hero.classList.add(ctx.class)}
  var dEl=document.getElementById('dash-date-sub');
  if(dEl){
    var dateStr=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    dEl.textContent=dateStr+' · '+view.habits.done+' of '+view.habits.total+' habit check-ins · '+view.focus.done+' of '+view.focus.total+' focus tasks';
  }
  renderDashMonthlyFocus();
  renderDashMoodMini();
  renderDashboardTodayBridge(view);
}

function renderDashboardPulse(view){
  var el=document.getElementById('dashboard-pulse-grid');if(!el)return;
  var moodValue=view.mood.mood==null?'—':view.mood.mood.toFixed(1)+'/5';
  var cards=[
    {icon:'✅',label:'Habit consistency',value:view.habits.pct+'%',detail:view.habits.done+'/'+view.habits.total+' available check-ins',delta:dashboardDelta(view.habits.pct,view.previousHabits.pct,' pts'),pct:view.habits.pct,color:'var(--moss)'},
    {icon:'🏋️',label:'Training',value:String(view.sessions),detail:'sessions logged this week',delta:dashboardDelta(view.sessions,view.previousSessions,' sessions'),pct:null,color:'var(--clay)'},
    {icon:'🌡️',label:'Mood',value:moodValue,detail:view.mood.sleep==null?view.mood.logged+' check-ins':view.mood.sleep.toFixed(1)+'h average sleep',delta:dashboardDelta(view.mood.mood,view.previousMood.mood,' mood'),pct:view.mood.mood==null?0:view.mood.mood*20,color:'var(--sky)'},
    {icon:'💷',label:'Monthly plan',value:view.finance.margin>=0?fmtMoney(view.finance.margin):'−'+fmtMoney(view.finance.margin),detail:fmtMoney(view.finance.savings)+' in savings accounts',delta:view.finance.margin>=0?'planned margin after recurring costs':'planned gap to revisit',pct:null,color:'var(--amber)'}
  ];
  el.innerHTML=cards.map(function(card){
    return '<article class="dashboard-pulse-card"><div class="dashboard-pulse-icon" aria-hidden="true">'+card.icon+'</div><div class="dashboard-pulse-label">'+card.label+'</div><div class="dashboard-pulse-value">'+card.value+'</div><div class="dashboard-pulse-detail">'+card.detail+'</div>'+(card.pct==null?'':'<div class="dashboard-pulse-track" role="progressbar" aria-label="'+card.label+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(card.pct)+'"><span style="width:'+Math.max(0,Math.min(100,card.pct))+'%;background:'+card.color+'"></span></div>')+'<div class="dashboard-pulse-delta">'+card.delta+'</div></article>';
  }).join('');
}

function renderDashboardAttention(view){
  var el=document.getElementById('dashboard-attention-list');if(!el)return;
  if(!view.attention.length){el.innerHTML='<div class="dashboard-clear-state"><span aria-hidden="true">🌿</span><div><strong>Nothing needs sorting right now.</strong><p>Your overview is clear.</p></div></div>';return}
  el.innerHTML=view.attention.slice(0,4).map(function(item){return '<div class="dashboard-list-item"><span class="dashboard-list-icon" aria-hidden="true">'+item.icon+'</span><div class="dashboard-list-body"><strong>'+escapeHtml(item.title)+'</strong><span>'+escapeHtml(item.body)+'</span></div><button class="dashboard-list-action" onclick="'+item.action+'" aria-label="'+escapeHtml(item.cta)+'">'+escapeHtml(item.cta)+' →</button></div>'}).join('');
}

function renderDashboardUpcoming(view){
  var el=document.getElementById('dashboard-upcoming-list');if(!el)return;
  if(!view.upcoming.length){el.innerHTML='<div class="dashboard-clear-state"><span aria-hidden="true">🗓️</span><div><strong>Open horizon.</strong><p>Future goals and events will appear here.</p></div></div>';return}
  el.innerHTML=view.upcoming.map(function(item){return '<button class="dashboard-upcoming-item" onclick="'+item.action+'"><span aria-hidden="true">'+item.icon+'</span><span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.detail)+'</small></span><span aria-hidden="true">→</span></button>'}).join('');
}

function renderDashboardMovement(view){
  var el=document.getElementById('dashboard-recent-movement');if(!el)return;
  var cards=[];
  if(view.recentSessions.length){
    var session=view.recentSessions[0];
    cards.push('<article class="card card-quiet dashboard-movement-card"><div class="dashboard-movement-kicker">'+session.icon+' Latest training</div><strong>'+escapeHtml(session.title)+'</strong><p>'+escapeHtml(session.detail)+' · '+fmtDate(session.date)+'</p><button class="dashboard-inline-link" onclick="nav(\'workout\')">Open training →</button></article>');
  }
  cards.push('<article class="card card-quiet dashboard-movement-card"><div class="dashboard-movement-kicker">🌿 Weekly rhythm</div><strong>'+view.habits.pct+'% habit consistency</strong><p>'+dashboardDelta(view.habits.pct,view.previousHabits.pct,' points')+'. '+view.sessions+' training session'+(view.sessions===1?'':'s')+' logged.</p><button class="dashboard-inline-link" onclick="openInsights()">See patterns →</button></article>');
  if(view.latestGratitude){
    var gratitude=view.latestGratitude.wins||view.latestGratitude.gratitude||'';
    cards.push('<article class="card card-quiet dashboard-movement-card"><div class="dashboard-movement-kicker">🙏 Latest reflection</div><strong>'+fmtDate(view.latestGratitude.date)+'</strong><p>'+escapeHtml(String(gratitude).split('\n')[0].slice(0,120))+'</p><button class="dashboard-inline-link" onclick="nav(\'gratitude\')">Open gratitude →</button></article>');
  }
  if(!cards.length)cards.push('<article class="card card-quiet dashboard-movement-card"><div class="dashboard-clear-state"><span aria-hidden="true">🌱</span><div><strong>Your movement will appear here.</strong><p>Use Today normally; Dashboard will summarize it.</p></div></div></article>');
  el.innerHTML=cards.join('');
}

function renderDashboardOverview(view){
  renderDashboardPulse(view);
  renderDashboardAttention(view);
  renderDashboardUpcoming(view);
  renderDashboardMovement(view);
  renderLifeTab();
}

function refreshDashboardIfActive(){
  var page=document.getElementById('page-dashboard');
  if(page&&page.classList.contains('active'))renderDashboard();
}

function renderDashboard(){
  var view=buildDashboardViewModel();
  renderDashChrome(view);
  if(_dashboardRequestedTab){
    var requested=_dashboardRequestedTab;_dashboardRequestedTab=null;
    document.querySelectorAll('#page-dashboard [role="tab"]').forEach(function(button){var selected=button.id==='dash-tab-btn-'+requested;button.classList.toggle('active',selected);button.setAttribute('aria-selected',selected?'true':'false');button.tabIndex=selected?0:-1});
    document.querySelectorAll('#page-dashboard [role="tabpanel"]').forEach(function(panel){var selected=panel.id==='dash-tab-'+requested;panel.classList.toggle('active',selected);panel.hidden=!selected});
  }
  var active=document.querySelector('#page-dashboard .dash-tab.active');
  if(active&&active.id==='dash-tab-insights'){if(typeof renderInsights==='function')renderInsights()}
  else if(active&&active.id==='dash-tab-numbers'){if(typeof renderNumbersSurface==='function')renderNumbersSurface()}
  else renderDashboardOverview(view);
}

// ── CELEBRATIONS ──
// The Day_Complete_Acknowledgement. Fires when today's Focus_Slate and today's
// due habits are both fully done.
//
// The focus reading comes from focusStats([todayKey]) over the Unified_Task_Store
// — never STATE.dailyPriorities, which the tasks migration retired and which is
// an empty object on live data, so the acknowledgement used to be unreachable
// whenever a slate existed (Requirements 1.1, 1.6).
//
// The "at least two tracked items" guard is kept, so a day with nothing on it
// never fires. An empty slate is therefore evaluated from habits alone and
// returns without error (Requirement 1.3).
//
// Once-per-calendar-day is held by STATE.companion.acks.dayComplete rather than
// sessionStorage, so a reload cannot re-fire it (Requirement 1.5).
function checkAllDoneToday(){
  var todayKey=localDateKey(new Date());
  var habitStats=habitStatsForDays(STATE.habits||[],[todayKey],todayKey);
  var habitsDone=habitStats.done;
  var habitsTotal=habitStats.total;
  var focus=focusStats([todayKey]);
  var focusDone=focus.done;
  var focusTotal=focus.total;

  // Need at least 2 items tracked in total, and both categories (if present) fully done
  var totalTracked=habitsTotal+focusTotal;
  if(totalTracked<2)return;
  var habitsComplete=habitsTotal===0||habitsDone===habitsTotal;
  var focusComplete=focusTotal===0||focusDone===focusTotal;
  if(!habitsComplete||!focusComplete)return;

  if(!STATE.companion)STATE.companion=JSON.parse(JSON.stringify(DEFAULT_STATE.companion));
  if(!STATE.companion.acks)STATE.companion.acks={dayComplete:null,focusSlate:null};
  if(STATE.companion.acks.dayComplete===todayKey)return;
  STATE.companion.acks.dayComplete=todayKey;
  saveState();

  // Factual counts, not just "everything ticked" — the numbers are the reward.
  var focusLabel=focusDone+' focus '+(focusDone===1?'task':'tasks');
  var habitLabel=habitsDone+' '+(habitsDone===1?'habit':'habits');
  setTimeout(function(){
    fireConfetti({count:160,duration:3200,colors:['#3F5A44','#C98A2D','#6E93AE','#B0563C','#EFEAE0']});
    showCelebrationToast('Day complete — '+focusLabel+', '+habitLabel+'.','🌟');
  },350);
}

// GOALS (simplified)
function renderGoals(){var catColors={Finance:'#6E93AE',Fitness:'#B0563C',Career:'#C98A2D',Personal:'#3F5A44'};var all=STATE.goals||[];var doneCount=all.filter(function(g){return g.done}).length;var total=all.length;var pct=total>0?Math.round(doneCount/total*100):0;var sumEl=document.getElementById('goals-summary');if(sumEl&&total>0){var sh='<div style="display:flex;gap:12px;flex-wrap:wrap">';
/* Overall progress card */
sh+='<div class="card" style="flex:1;min-width:200px;padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap"><div style="font-size:13px;font-weight:500;color:var(--text2)">'+doneCount+' of '+total+' goals completed</div><div style="flex:1;min-width:120px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--mint);border-radius:3px;transition:width .4s"></div></div><span style="font-size:13px;font-weight:600;color:var(--mint)">'+pct+'%</span></div>';
/* Category breakdown */
var cats=['Finance','Fitness','Career','Personal'];
sh+='<div class="card" style="min-width:200px;padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">';
cats.forEach(function(c){var catAll=all.filter(function(g){return g.cat===c});var catDone=catAll.filter(function(g){return g.done}).length;if(catAll.length>0)sh+='<div style="text-align:center"><div style="font-size:16px;font-family:var(--serif);font-weight:600;color:'+(catColors[c]||'var(--accent)')+'">'+catDone+'/'+catAll.length+'</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">'+c+'</div></div>'});
sh+='</div></div>';
/* the flex row is now closed; Up next renders as its own full-width row */
/* Up next — most urgent undone goal */
var upcoming=all.filter(function(g){return !g.done&&g.deadline}).sort(function(a,b){return a.deadline.localeCompare(b.deadline)});
if(upcoming.length){var ug=upcoming[0];var udl=daysLeft(ug.deadline);var pastTarget=udl<0;sh+='<div style="background:linear-gradient(135deg,#fdf6e8,#f2e8d8);border:1.5px solid var(--gold);border-radius:var(--radius);padding:12px 18px;margin-top:12px;display:flex;align-items:center;gap:12px"><div style="font-size:22px">🎯</div><div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">Up next</div><div style="font-size:14px;font-weight:600;margin-top:2px">'+ug.name+'</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:600;color:'+(pastTarget?'var(--text3)':'var(--text)')+'">'+(pastTarget?'target was '+fmtDate(ug.deadline):udl+' days left')+'</div>'+(pastTarget?'':'<div style="font-size:10px;color:var(--text3)">'+fmtDate(ug.deadline)+'</div>')+'</div></div>'}
sumEl.innerHTML=sh}else if(sumEl){sumEl.innerHTML=''}
var filtered=all;if(goalFilter==='Done')filtered=all.filter(function(g){return g.done});else if(goalFilter==='Active')filtered=all.filter(function(g){return !g.done});else if(goalFilter!=='all')filtered=all.filter(function(g){return g.cat===goalFilter});
var el=document.getElementById('goals-container');if(!el)return;if(!filtered.length){el.innerHTML='<div class="empty"><div class="empty-icon">\ud83c\udfaf</div>'+(total>0?'No goals match this filter':'No goals yet. Add one!')+'</div>';return}
el.innerHTML=filtered.map(function(go){var isDone=go.done;var dl=daysLeft(go.deadline);var col=catColors[go.cat]||'var(--accent)';var overdue=!isDone&&dl<0;
var h='<div class="card goal-item" style="position:relative;margin-bottom:12px;border-left:4px solid '+col+';'+(isDone?'opacity:0.65;':'')+'">';
/* Actions — pinned top-right */
h+='<div class="goal-actions"><button class="btn btn-sm btn-ghost" onclick="openModal(\'editGoal\',\''+go.id+'\')" title="Edit">✎</button><button class="btn btn-sm btn-danger" onclick="deleteGoal(\''+go.id+'\')" title="Delete">×</button></div>';
h+='<div style="display:flex;align-items:flex-start;gap:14px">';
/* Tickbox */
h+='<div onclick="toggleGoalDone(\''+go.id+'\')" role="button" tabindex="0" aria-label="Toggle goal complete" style="width:28px;height:28px;border-radius:50%;border:2px solid '+(isDone?'var(--mint)':col)+';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .15s;background:'+(isDone?'var(--mint)':'transparent')+'">'+(isDone?'<span style="color:#fff;font-size:14px;font-weight:700">✓</span>':'')+'</div>';
/* Content */
h+='<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px"><span class="badge badge-'+go.badge+'">'+go.cat+'</span>';
if(isDone)h+='<span class="badge badge-done">Done</span>';
else if(overdue)h+='<span class="badge">Past target date</span>';
h+='</div>';
h+='<div style="font-size:15px;font-weight:600;'+(isDone?'text-decoration:line-through;color:var(--text3)':'')+'">'+go.name+'</div>';
if(go.desc)h+='<div style="font-size:12px;color:var(--text2);margin-top:3px;'+(isDone?'text-decoration:line-through':'')+'">'+go.desc+'</div>';
/* Deadline */
if(go.deadline){h+='<div style="font-size:11px;margin-top:6px;color:var(--text3)">📅 '+(isDone?'Completed':(overdue?'Target was '+fmtDate(go.deadline):'Due '+fmtDate(go.deadline)+(dl>0?' · '+dl+' days left':'')))+'</div>'}
/* Live progress + linked badge */
var srcInfo=getGoalSource(go);
var livePct=goalPct(go);
var progressDisplay=srcInfo.source!=='manual'?srcInfo.progress:go.progress;
h+='<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:11px;color:var(--text2);font-weight:500">'+progressDisplay+(go.unit||'')+' / '+go.target+(go.unit||'')+'</span><span style="font-size:11px;font-weight:600;color:'+pbarColor(livePct)+'">'+livePct+'%</span></div><div class="u-bar" role="progressbar" aria-valuenow="'+livePct+'" aria-valuemin="0" aria-valuemax="100" aria-label="'+escapeHtml(go.name)+' progress"><div class="u-bar-fill" style="width:'+livePct+'%;background:'+pbarColor(livePct)+'"></div></div>';
if(srcInfo.label)h+='<div style="font-size:10px;color:var(--mint);margin-top:4px;font-weight:500">'+srcInfo.label+'</div>';
h+='</div>';
/* Sub-steps (item 10) */
var subs=go.subGoals||[];
var subsDone=subs.filter(function(s){return s.done}).length;
h+='<div class="goal-substeps"><div class="goal-substeps-head"><span>Steps</span><span style="display:flex;align-items:center;gap:8px">'+(subs.length?'<span class="goal-substeps-count">'+subsDone+'/'+subs.length+'</span>':'')+'<button class="goal-breakdown-btn" data-goal="'+go.id+'" onclick="breakDownGoal(\''+go.id+'\')" title="Suggest steps with AI">✨ Break it down</button></span></div>';
if(subs.length){
  h+=subs.map(function(s,si){
    return '<div class="goal-substep'+(s.done?' done':'')+'">'
      +'<div class="goal-substep-tick" onclick="toggleGoalSubStep(\''+go.id+'\','+si+')" role="button" tabindex="0" aria-label="Toggle step: '+escapeHtml(s.text)+'">'+(s.done?'✓':'')+'</div>'
      +'<span class="goal-substep-text">'+escapeHtml(s.text)+'</span>'
      +'<button class="goal-substep-del" onclick="deleteGoalSubStep(\''+go.id+'\','+si+')" title="Remove" aria-label="Remove step">×</button>'
      +'</div>';
  }).join('');
}
h+='<div class="goal-substep-add-row">'
  +'<input type="text" class="goal-substep-add-input" id="goal-substep-input-'+go.id+'" placeholder="Add a step…" onkeydown="if(event.key===\'Enter\')addGoalSubStep(\''+go.id+'\')">'
  +'<button class="goal-substep-add-btn" onclick="addGoalSubStep(\''+go.id+'\')">+</button>'
  +'</div>';
h+='</div>';
h+='</div></div></div>';return h}).join('')}
function filterGoals(cat,btn){goalFilter=cat;document.querySelectorAll('#goal-filters .filter-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');renderGoals()}
function toggleGoalDone(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;var wasDone=goal.done;goal.done=!goal.done;if(goal.done)goal.progress=goal.target;saveState();renderGoals();if(!wasDone&&goal.done){fireConfetti({count:150,duration:3000});showCelebrationToast('Goal complete: '+goal.name,'🎯')}}
function saveGoal(){var name=((document.getElementById('m-gname')||{}).value||'').trim();if(!name)return;var cat=(document.getElementById('m-gcat')||{}).value||'Personal';var badges={Finance:'fin',Fitness:'fit',Career:'car',Personal:'per'};var target=Number((document.getElementById('m-gtarget')||{}).value)||100;var unit=(document.getElementById('m-gunit')||{}).value||'%';var direction=(document.getElementById('m-gdir')||{}).value||'up';STATE.goals.push({id:g(),name:name,cat:cat,badge:badges[cat]||'per',desc:(document.getElementById('m-gdesc')||{}).value||'',target:target,unit:unit,direction:direction,deadline:(document.getElementById('m-gdeadline')||{}).value||'2026-12-31',progress:direction==='up'?0:target*2,done:false,subGoals:[]});saveState();closeModal();renderGoals()}
function updateGoalProgress(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;var wasDone=goalPct(goal)>=100;goal.progress=Number((document.getElementById('m-gprogress')||{}).value)||0;saveState();closeModal();renderGoals();if(!wasDone&&goalPct(goal)>=100){fireConfetti({count:150,duration:3000});showCelebrationToast('Goal complete: '+goal.name,'🎯')}}
function editGoalSave(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;goal.name=(document.getElementById('m-gname')||{}).value||goal.name;goal.deadline=(document.getElementById('m-gdeadline')||{}).value||goal.deadline;goal.desc=(document.getElementById('m-gdesc')||{}).value||'';var cat=(document.getElementById('m-gcat')||{}).value;if(cat){goal.cat=cat;var badges={Finance:'fin',Fitness:'fit',Career:'car',Personal:'per'};goal.badge=badges[cat]||goal.badge}var manualEl=document.getElementById('m-gmanual');if(manualEl){goal.manualOverride=manualEl.value==='1';if(goal.manualOverride){var p=document.getElementById('m-gprogress');if(p&&p.value!=='')goal.progress=Number(p.value)}}saveState();closeModal();renderGoals()}
function deleteGoal(id){confirmDelete('Delete this goal?',function(){STATE.goals=STATE.goals.filter(function(g){return g.id!==id});saveState();renderGoals()})}
function saveMetric(type){
  if(!STATE.metrics)STATE.metrics={};var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
  var date=(document.getElementById('m-mdate')||{}).value||localDateKey(new Date());var note=(document.getElementById('m-mnote')||{}).value||'';var entry={id:g(),date:date};
  if(type==='project'){var name=((document.getElementById('m-mname')||{}).value||'').trim();if(!name)return;entry.name=name}
  else if(type==='run'){var runValue=(document.getElementById('m-mval')||{}).value;if(!runValue)return;entry.distance=Number(runValue);entry.time=(document.getElementById('m-mtime')||{}).value||'';entry.note=note}
  else if(type==='moneySaved'){var savedValue=(document.getElementById('m-mval')||{}).value;if(!savedValue)return;entry.amount=Number(savedValue);entry.note=note}
  else{var metricValue=(document.getElementById('m-mval')||{}).value;if(!metricValue)return;entry.value=Number(metricValue);entry.note=note}
  if(!STATE.metrics[type])STATE.metrics[type]=[];STATE.metrics[type].push(entry);
  if(type==='run')applyHabitSource('lifehub.run.any',date,'run',entry.id);
  if(!saveStateOrRollback(snapshot))return false;closeModal();
  if(type==='run')emitLifeHubChange({action:'run-create',entityId:entry.id,dateKeys:[date],domains:['metrics','habits'],source:'dashboard'});
  else{
    if(type==='weight'&&typeof renderTrainingBody==='function'){var bodyEl=document.getElementById('workout-body');if(bodyEl&&bodyEl.classList.contains('active'))renderTrainingBody()}
    if(type==='weight'&&typeof renderPlanner==='function')renderPlanner();
  }
  return true;
}




// Shared escaping helper for user-authored text rendered into HTML strings.
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ── TASKS ARCHIVE PAGE ──
function renderTasksArchive(){
  var statsEl=document.getElementById('tasks-stats');
  var archEl=document.getElementById('tasks-archive');
  if(!archEl)return;
  if(!STATE.tasks)STATE.tasks=[];
  var all=STATE.tasks.slice();

  if(!all.length){
    if(statsEl)statsEl.innerHTML='';
    archEl.innerHTML='<div class="empty"><div class="empty-icon">📝</div>No tasks yet. Add some from the dashboard to start building history.</div>';
    return;
  }

  // Four counts, no ratio: the all-time completion percentage and its "of N
  // all-time" fraction are the same Guilt_Metric, and for a capture-heavy user
  // both can only fall as more is captured. Design Decision 8, Requirements
  // 13.5, 13.6. Completion counts come from taskCompletionStats, the sole
  // definition of the measure; `open now` is the one actionable number here and
  // `completed all time` only ever grows.
  var todayKey=localDateKey(new Date());
  var last30=Array.from({length:30},function(_,i){var d=new Date();d.setDate(d.getDate()-i);return localDateKey(d)});
  var last30Done=taskCompletionStats(last30).completed;
  var doneToday=taskCompletionStats([todayKey]).completed;
  var openNow=all.filter(function(t){return !t.done}).length;
  var totalDone=all.filter(function(t){return t.done}).length;

  if(statsEl){
    statsEl.innerHTML=
      '<div class="card-sm" style="text-align:center;border-top:3px solid var(--accent)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:var(--accent-dark);line-height:1">'+last30Done+'</div><div style="font-size:11px;color:var(--text2);margin-top:4px">done last 30 days</div></div>'
      +'<div class="card-sm" style="text-align:center;border-top:3px solid var(--mint)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:#5A8A55;line-height:1">'+doneToday+'</div><div style="font-size:11px;color:var(--text2);margin-top:4px">done today</div></div>'
      +'<div class="card-sm" style="text-align:center;border-top:3px solid var(--purple)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:#7A6A9E;line-height:1">'+openNow+'</div><div style="font-size:11px;color:var(--text2);margin-top:4px">open now</div></div>'
      +'<div class="card-sm" style="text-align:center;border-top:3px solid var(--gold)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:#B8860B;line-height:1">'+totalDone+'</div><div style="font-size:11px;color:var(--text2);margin-top:4px">completed all time</div></div>';
  }

  // Group: open (sorted by due then created), done (sorted by doneAt desc)
  var open=all.filter(function(t){return !t.done}).sort(byDueDate);
  var done=all.filter(function(t){return t.done}).sort(function(a,b){return (b.doneAt||'').localeCompare(a.doneAt||'')});

  var html='';
  html+='<div class="card" style="margin-bottom:14px"><div class="card-label">Open · '+open.length+'</div>';
  if(!open.length){
    html+='<div style="font-size:13px;color:var(--text3);padding:8px 0">All clear ✓</div>';
  }else{
    html+=open.map(function(t){return renderArchiveTaskRow(t)}).join('');
  }
  html+='</div>';

  if(done.length){
    html+='<details class="card" style="margin-bottom:14px"><summary class="card-label" style="cursor:pointer">Completed · '+done.length+'</summary>';
    html+=done.slice(0,100).map(function(t){return renderArchiveTaskRow(t)}).join('');
    if(done.length>100)html+='<div style="font-size:11px;color:var(--text3);padding-top:6px">(showing latest 100)</div>';
    html+='</details>';
  }

  archEl.innerHTML=html;
}

function renderArchiveTaskRow(t){
  var due=t.dueDate?fmtDueRel(t.dueDate):'';
  var dueClass=t.dueDate&&!t.done&&t.dueDate<localDateKey(new Date())?'overdue':'';
  return '<div class="task-row'+(t.done?' done':'')+'" style="background:transparent">'
    +'<div class="task-check" onclick="toggleTask(\''+t.id+'\');setTimeout(renderTasksArchive,30)">'+(t.done?'✓':'')+'</div>'
    +'<div class="task-body">'
      +'<span class="task-text">'+escapeHtml(t.text)+'</span>'
      +(due?'<span class="task-due '+dueClass+'">'+due+'</span>':'')
    +'</div>'
    +'<button class="task-action" onclick="openTaskEditModal(\''+t.id+'\')" title="Edit">⋯</button>'
    +'<button class="task-action task-delete" onclick="deleteTask(\''+t.id+'\');setTimeout(renderTasksArchive,30)" title="Remove">×</button>'
    +'</div>';
}


// ── DASHBOARD TABS ──
function switchDashTab(tab,btn){
  if(tab!=='overview'&&tab!=='insights'&&tab!=='numbers')tab='overview';
  var page=document.getElementById('page-dashboard');if(!page)return;
  page.querySelectorAll('[role="tab"]').forEach(function(button){
    var selected=button.id==='dash-tab-btn-'+tab;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-selected',selected?'true':'false');
    button.tabIndex=selected?0:-1;
  });
  page.querySelectorAll('[role="tabpanel"]').forEach(function(panel){
    var selected=panel.id==='dash-tab-'+tab;
    panel.classList.toggle('active',selected);
    panel.hidden=!selected;
  });
  var activeButton=btn||document.getElementById('dash-tab-btn-'+tab);
  if(activeButton&&document.activeElement&&document.activeElement.getAttribute('role')==='tab')activeButton.focus();
  if(tab==='insights'){if(typeof renderInsights==='function')renderInsights()}
  // The Numbers_Surface, reached from the Dashboard as a third tab rather than a
  // page of its own. Requirement 12.1.
  else if(tab==='numbers'){if(typeof renderNumbersSurface==='function')renderNumbersSurface()}
  else renderDashboardOverview(buildDashboardViewModel());
}

function dashboardTabKeydown(event){
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight'&&event.key!=='Home'&&event.key!=='End')return;
  var tabs=Array.from(document.querySelectorAll('#page-dashboard [role="tab"]'));
  var current=tabs.indexOf(event.currentTarget);if(current<0)return;
  event.preventDefault();
  var next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  var tab=tabs[next].id.replace('dash-tab-btn-','');
  switchDashTab(tab,tabs[next]);
}

// Open Dashboard directly on Insights without waiting for the page transition.
function openInsights(){
  _dashboardRequestedTab='insights';
  if(typeof nav==='function')nav('dashboard');
}

// ── LIFE TAB ──
function renderLifeTab(){
  // Goals snapshot — top 3 in-progress with progress bars
  var gSnapEl=document.getElementById('dash-goals-snapshot');
  if(gSnapEl){
    var active=(STATE.goals||[]).filter(function(g){return !g.done});
    var top3=active.slice().sort(function(a,b){
      var ad=a.deadline||'9999-12-31',bd=b.deadline||'9999-12-31';
      return ad.localeCompare(bd)||goalPct(b)-goalPct(a);
    }).slice(0,3);
    if(!top3.length){
      gSnapEl.innerHTML='<div class="empty" style="padding:20px 0">No active goals. <a href="#" onclick="nav(\'goals\');return false" style="color:var(--accent-dark)">Set one →</a></div>';
    }else{
      gSnapEl.innerHTML=top3.map(function(go){
        var pct=goalPct(go);
        var src=getGoalSource(go);
        var progressDisplay=src.source!=='manual'?src.progress:go.progress;
        return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
            +'<div style="font-size:13px;font-weight:500">'+escapeHtml(go.name)+'</div>'
            +'<span style="font-size:11px;font-weight:600;color:'+pbarColor(pct)+'">'+pct+'%</span>'
          +'</div>'
          +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">'
            +'<div class="pbar-wrap" style="flex:1;margin:0"><div class="pbar" style="width:'+pct+'%;background:'+pbarColor(pct)+'"></div></div>'
            +'<span style="font-size:11px;color:var(--text2);white-space:nowrap">'+progressDisplay+(go.unit||'')+' / '+go.target+(go.unit||'')+'</span>'
          +'</div>'
          +'</div>';
      }).join('')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'goals\')" style="margin-top:10px;width:100%;justify-content:center">View all goals →</button>';
    }
  }

  // Reviews snapshot — last monthly review
  var rSnapEl=document.getElementById('dash-reviews-snapshot');
  if(rSnapEl){
    var reviews=(STATE.reviews&&STATE.reviews.monthly)||{};
    var keys=Object.keys(reviews).sort().reverse();
    if(!keys.length){
      rSnapEl.innerHTML='<div class="empty" style="padding:20px 0">No reviews yet. <a href="#" onclick="nav(\'review\');return false" style="color:var(--accent-dark)">Start reflecting →</a></div>';
    }else{
      var lastKey=keys[0];
      var r=reviews[lastKey];
      var parts=lastKey.split('-');
      var monthLabel=new Date(Number(parts[0]),Number(parts[1])-1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
      var avg=0;
      if(r.ratings){
        var vals=Object.values(r.ratings);
        avg=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0;
      }
      var color=avg>=7?'var(--mint)':avg>=5?'var(--gold)':'var(--accent-dark)';
      rSnapEl.innerHTML='<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)">'
        +'<div style="width:52px;height:52px;border-radius:50%;background:'+color+';color:var(--white);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:20px;font-weight:500;flex-shrink:0">'+avg+'</div>'
        +'<div style="flex:1"><div style="font-size:14px;font-weight:600">'+monthLabel+'</div>'+(r.focus?'<div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4">🎯 '+escapeHtml(r.focus.split('\n')[0].slice(0,80))+(r.focus.length>80?'…':'')+'</div>':'<div style="font-size:11px;color:var(--text3);margin-top:2px">No focus set</div>')+'</div>'
        +'</div>'
        +'<button class="btn btn-ghost btn-sm" onclick="nav(\'review\')" style="margin-top:10px;width:100%;justify-content:center">Open Reviews →</button>';
    }
  }
}


// ── DASHBOARD: MONTHLY FOCUS (hero banner) ──
// Surfaces this month's review focus in the hero header (falls back to last
// month's focus if the current month's review isn't written yet).
function renderDashMonthlyFocus(){
  var card=document.getElementById('dash-monthly-focus-card');
  var el=document.getElementById('dash-monthly-focus');
  if(!card||!el)return;
  var now=new Date();
  // Prefer this month's focus; fall back to last month's if not set yet.
  var thisKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var prevMonth=new Date(now.getFullYear(),now.getMonth()-1,1);
  var prevKey=prevMonth.getFullYear()+'-'+String(prevMonth.getMonth()+1).padStart(2,'0');
  var monthly=(STATE.reviews&&STATE.reviews.monthly)||{};
  var review=monthly[thisKey]&&monthly[thisKey].focus?monthly[thisKey]:(monthly[prevKey]&&monthly[prevKey].focus?monthly[prevKey]:null);
  if(!review||!review.focus){card.style.display='none';return}
  card.style.display='';
  var focusText=review.focus.split('\n')[0].trim();
  if(focusText.length>90)focusText=focusText.slice(0,90)+'…';
  el.textContent=focusText;
}

// ── DASHBOARD: MINI MOOD ORB (item 4) ──
function renderDashMoodMini(){
  var el=document.getElementById('dash-mood-checkin-mini');
  if(!el)return;
  var today=localDateKey(new Date());
  var m=(STATE.mood||{})[today]||{};
  var moodEm=['','😞','😐','🙂','😊','🤩'];
  var moodLabels=['','Low','Flat','Okay','Good','Great'];
  if(m.mood){
    el.innerHTML='<div class="dash-mood-mini-done"><span class="dash-mood-mini-emoji" aria-hidden="true">'+moodEm[m.mood]+'</span><span class="sr-only">Mood: '+moodLabels[m.mood]+'</span><button class="dash-mood-mini-edit" onclick="openModal(\'logMood\',\''+today+'\')">Edit check-in</button></div>';
  }else{
    el.innerHTML='<div class="dash-mood-mini-row" aria-label="Log today\'s mood">'
      +['😞','😐','🙂','😊','🤩'].map(function(e,i){
        return '<button class="dash-mood-mini-btn" aria-label="Log mood as '+moodLabels[i+1]+'" onclick="quickLogMood('+(i+1)+',\''+today+'\')">'+e+'</button>';
      }).join('')
      +'</div>';
  }
}

// ── GOALS — sub-steps (item 10) ──
function addGoalSubStep(goalId){
  var inp=document.getElementById('goal-substep-input-'+goalId);
  if(!inp)return;
  var text=inp.value.trim();
  if(!text)return;
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal)return;
  if(!goal.subGoals)goal.subGoals=[];
  goal.subGoals.push({text:text,done:false});
  inp.value='';
  saveState();
  renderGoals();
}
function toggleGoalSubStep(goalId,idx){
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal||!goal.subGoals||!goal.subGoals[idx])return;
  goal.subGoals[idx].done=!goal.subGoals[idx].done;
  saveState();
  renderGoals();
  if(goal.subGoals[idx].done){
    var allDone=goal.subGoals.every(function(s){return s.done});
    if(allDone&&goal.subGoals.length>=2&&typeof celebrateOnce==='function'){
      celebrateOnce('goal-substeps-done:'+goalId,function(){
        showCelebrationToast('All steps for '+goal.name+' done!','✨');
      });
    }
  }
}
function deleteGoalSubStep(goalId,idx){
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal||!goal.subGoals)return;
  goal.subGoals.splice(idx,1);
  saveState();
  renderGoals();
}

// ── AI "Break it down" (Claude via backend) ──
// Turns a task/goal title into 3–5 concrete micro-steps to beat activation
// energy. Shared helper returns a promise of a string[] (or null on failure).
function aiBreakdown(title,kind){
  if(typeof NOTIF_API==='undefined'||!NOTIF_API)return Promise.resolve(null);
  return lifeHubApiFetch(NOTIF_API+'/api/ai-narrative',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({breakdown:{title:title,kind:kind}})
  }).then(function(r){return r.json()}).then(function(d){
    return (d&&Array.isArray(d.steps)&&d.steps.length)?d.steps:null;
  }).catch(function(){return null});
}

// Goal breakdown — appends AI-suggested steps to a goal's existing subGoals.
function breakDownGoal(goalId){
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal)return;
  var btn=document.querySelector('.goal-breakdown-btn[data-goal="'+goalId+'"]');
  if(btn){btn.disabled=true;btn.textContent='✨ Thinking…'}
  aiBreakdown(goal.name+(goal.desc?' — '+goal.desc:''),'goal').then(function(steps){
    if(!steps){
      if(typeof showCelebrationToast==='function')showCelebrationToast('Couldn\'t reach the AI just now.','⚠️');
      if(btn){btn.disabled=false;btn.textContent='✨ Break it down'}
      return;
    }
    if(!goal.subGoals)goal.subGoals=[];
    steps.forEach(function(s){goal.subGoals.push({text:s,done:false})});
    saveState();
    renderGoals();
    if(typeof showCelebrationToast==='function')showCelebrationToast('Added '+steps.length+' steps.','✨');
  });
}

// Task breakdown — appends AI-suggested micro-steps to a task's subSteps, then
// reopens the edit modal so they're visible and tickable.
function breakDownTask(taskId){
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t)return;
  var btn=document.getElementById('task-breakdown-btn');
  if(btn){btn.disabled=true;btn.textContent='✨ Thinking…'}
  aiBreakdown(t.text,'task').then(function(steps){
    if(!steps){
      if(typeof showCelebrationToast==='function')showCelebrationToast('Couldn\'t reach the AI just now.','⚠️');
      if(btn){btn.disabled=false;btn.textContent='✨ Break it down'}
      return;
    }
    if(!t.subSteps)t.subSteps=[];
    steps.forEach(function(s){t.subSteps.push({text:s,done:false})});
    saveState();
    if(typeof openModal==='function')openModal('editTask',taskId); // re-render modal with steps
    if(typeof renderPlanner==='function')renderPlanner();
    if(typeof renderDashboard==='function')renderDashboard();
  });
}

// Task sub-step mutations (mirror the goal helpers).
function toggleTaskSubStep(taskId,idx){
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t||!t.subSteps||!t.subSteps[idx])return;
  t.subSteps[idx].done=!t.subSteps[idx].done;
  saveState();
  if(typeof openModal==='function'&&document.getElementById('modal')&&document.getElementById('modal').style.display!=='none')openModal('editTask',taskId);
  if(typeof renderPlanner==='function')renderPlanner();
  if(typeof renderDashboard==='function')renderDashboard();
}
function deleteTaskSubStep(taskId,idx){
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t||!t.subSteps)return;
  t.subSteps.splice(idx,1);
  saveState();
  if(typeof openModal==='function')openModal('editTask',taskId);
}
function addTaskSubStep(taskId){
  var inp=document.getElementById('task-substep-input');
  if(!inp)return;
  var text=inp.value.trim();
  if(!text)return;
  var t=(STATE.tasks||[]).find(function(x){return x.id===taskId});
  if(!t)return;
  if(!t.subSteps)t.subSteps=[];
  t.subSteps.push({text:text,done:false});
  saveState();
  if(typeof openModal==='function')openModal('editTask',taskId);
}


// ── TASKS (unified flat list with due dates + week priorities) ──
function renderTasksCard(){
  if(!STATE.tasks)STATE.tasks=[];
  var todayKey=localDateKey(new Date());
  var wkKey=weekKey(new Date());
  // Compute week end for "coming up" cutoff
  var wkEnd=new Date();wkEnd.setDate(wkEnd.getDate()+6);
  var wkEndKey=localDateKey(wkEnd);

  var open=STATE.tasks.filter(function(t){return !t.done});

  // Buckets
  var thisWeekPriorities=open.filter(function(t){return t.weekPriority===wkKey});
  // Exclude priorities from other buckets so we don't double-count
  var nonPriority=open.filter(function(t){return t.weekPriority!==wkKey});
  var overdue=nonPriority.filter(function(t){return t.dueDate&&t.dueDate<todayKey}).sort(byDueDate);
  var today=nonPriority.filter(function(t){return !t.dueDate||t.dueDate===todayKey}).sort(byDueDate);
  var upcoming=nonPriority.filter(function(t){return t.dueDate&&t.dueDate>todayKey&&t.dueDate<=wkEndKey}).sort(byDueDate);
  var later=nonPriority.filter(function(t){return t.dueDate&&t.dueDate>wkEndKey}).sort(byDueDate);

  var html='';

  // Priorities block
  if(thisWeekPriorities.length){
    var pDone=thisWeekPriorities.filter(function(t){return t.done}).length;
    html+='<div class="task-section task-priorities-section">';
    html+='<div class="task-section-head"><span class="task-section-label">⭐ This week\'s priorities</span><span class="task-section-count">'+pDone+'/'+thisWeekPriorities.length+'</span></div>';
    thisWeekPriorities.forEach(function(t){html+=renderTaskRow(t,true)});
    html+='</div>';
  }

  if(overdue.length){
    html+='<div class="task-section task-overdue-section">';
    html+='<div class="task-section-head"><span class="task-section-label" style="color:var(--text2)">↪ Carried over</span><span class="task-section-count">'+overdue.length+'</span></div>';
    overdue.forEach(function(t){html+=renderTaskRow(t,false)});
    html+='</div>';
  }

  if(today.length){
    html+='<div class="task-section">';
    html+='<div class="task-section-head"><span class="task-section-label">📌 Today</span></div>';
    today.forEach(function(t){html+=renderTaskRow(t,false)});
    html+='</div>';
  }

  if(upcoming.length){
    html+='<div class="task-section">';
    html+='<div class="task-section-head"><span class="task-section-label">📅 Coming up</span></div>';
    upcoming.forEach(function(t){html+=renderTaskRow(t,false)});
    html+='</div>';
  }

  if(later.length){
    html+='<details class="task-section task-later"><summary class="task-section-head"><span class="task-section-label">📌 Later</span><span class="task-section-count">'+later.length+'</span></summary>';
    later.forEach(function(t){html+=renderTaskRow(t,false)});
    html+='</details>';
  }

  // Empty state if nothing open at all
  if(!open.length){
    html+='<div class="task-empty">Nothing on your list. Add the first thing below.</div>';
  }

  // Add row
  html+='<div class="task-add-row">'
    +'<input type="text" id="task-add-input" placeholder="Add a task… (try \'book flights by friday\')" onkeydown="if(event.key===\'Enter\')addTaskFromInput()">'
    +'<button class="task-add-btn" onclick="addTaskFromInput()">+</button>'
    +'</div>';

  return html;
}

function byDueDate(a,b){
  var ad=a.dueDate||'9999-12-31';
  var bd=b.dueDate||'9999-12-31';
  return ad.localeCompare(bd);
}

function renderTaskRow(t,isPriority){
  var todayKey=localDateKey(new Date());
  var wkKey=weekKey(new Date());
  var dueLabel='';
  var dueClass='';
  if(t.dueDate){
    if(t.dueDate<todayKey){dueLabel=fmtDueRel(t.dueDate);dueClass='overdue'}
    else if(t.dueDate===todayKey){dueLabel='today';dueClass='today'}
    else dueLabel=fmtDueRel(t.dueDate);
    if(t.dueTime)dueLabel+=' · '+t.dueTime;
  }
  var isWeekP=t.weekPriority===wkKey;
  var starIcon=isWeekP?'⭐':'☆';
  return '<div class="task-row'+(t.done?' done':'')+(isPriority?' is-priority':'')+'">'
    +'<div class="task-check" data-tick="task:'+t.id+'" onclick="toggleTask(\''+t.id+'\')">'+(t.done?'✓':'')+'</div>'
    +'<div class="task-body" onclick="editTaskInline(\''+t.id+'\')">'
      +'<span class="task-text">'+escapeHtml(t.text)+'</span>'
      +(dueLabel?'<span class="task-due '+dueClass+'">'+dueLabel+'</span>':'')
    +'</div>'
    +'<button class="task-star'+(isWeekP?' on':'')+'" onclick="toggleTaskWeekPriority(\''+t.id+'\')" title="'+(isWeekP?'Remove from this week\'s priorities':'Mark as priority for this week')+'">'+starIcon+'</button>'
    +'<button class="task-action" onclick="openTaskEditModal(\''+t.id+'\')" title="Edit">⋯</button>'
    +'<button class="task-action task-delete" onclick="deleteTask(\''+t.id+'\')" title="Remove">×</button>'
    +'</div>';
}

function fmtDueRel(dateKey){
  if(!dateKey)return '';
  var todayKey=localDateKey(new Date());
  var d=new Date(dateKey+'T12:00:00');
  var t=new Date(todayKey+'T12:00:00');
  var diff=Math.round((d-t)/86400000);
  if(diff===0)return 'today';
  if(diff===1)return 'tomorrow';
  if(diff===-1)return 'yesterday';
  if(diff>1&&diff<=6)return 'in '+diff+'d';
  if(diff<-1&&diff>=-6)return 'from '+d.toLocaleDateString('en-GB',{weekday:'short'});
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

// ── Add tasks (with natural-language date parsing) ──
function addTaskFromInput(){
  var inp=document.getElementById('task-add-input');
  if(!inp)return;
  var raw=inp.value.trim();
  if(!raw)return;
  var parsed=parseTaskInput(raw);
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
  renderDashboard();
}

// Parse "do X by friday" → {text:'do X', dueDate:'2026-06-05'}
function parseTaskInput(raw){
  var byMatch=raw.match(/^(.+?)\s+by\s+(.+)$/i);
  if(byMatch){
    var d=parseNaturalDate(byMatch[2]);
    if(d)return {text:byMatch[1].trim(),dueDate:d};
  }
  var onMatch=raw.match(/^(.+?)\s+on\s+(.+)$/i);
  if(onMatch){
    var d2=parseNaturalDate(onMatch[2]);
    if(d2)return {text:onMatch[1].trim(),dueDate:d2};
  }
  return {text:raw,dueDate:null};
}

// Natural language date parser. Returns YYYY-MM-DD or null.
function parseNaturalDate(input){
  if(!input)return null;
  var s=input.trim().toLowerCase();
  var now=new Date();now.setHours(12,0,0,0);
  var dayMs=86400000;

  if(s==='today'||s==='tonight')return localDateKey(now);
  if(s==='tomorrow')return localDateKey(new Date(now.getTime()+dayMs));
  if(s==='yesterday')return localDateKey(new Date(now.getTime()-dayMs));

  // Day of week: "monday", "next monday", "this monday"
  var dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var dayMatch=s.match(/^(?:next\s+|this\s+)?(\w+)$/);
  if(dayMatch){
    var idx=dayNames.indexOf(dayMatch[1]);
    if(idx>-1){
      var diff=idx-now.getDay();
      if(s.startsWith('next ')){
        if(diff<=0)diff+=7;
        else diff+=7;
      }else{
        if(diff<=0)diff+=7;
      }
      var d=new Date(now.getTime()+diff*dayMs);
      return localDateKey(d);
    }
  }

  // "in 3 days", "in 2 weeks"
  var inMatch=s.match(/^in\s+(\d+)\s+(day|days|week|weeks)$/);
  if(inMatch){
    var n=Number(inMatch[1]);
    var unit=inMatch[2].startsWith('week')?7:1;
    return localDateKey(new Date(now.getTime()+n*unit*dayMs));
  }

  // "5 dec", "december 5", "dec 5"
  var monthNames=['january','february','march','april','may','june','july','august','september','october','november','december'];
  var monthShorts=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  function findMonth(str){
    var i=monthNames.indexOf(str);
    if(i>-1)return i;
    return monthShorts.indexOf(str.slice(0,3));
  }
  var dmMatch=s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)$/);
  if(dmMatch){
    var month=findMonth(dmMatch[2]);
    if(month>-1){
      var year=now.getFullYear();
      var dd=Number(dmMatch[1]);
      var dt=new Date(year,month,dd,12,0,0);
      if(dt<now)dt.setFullYear(year+1);
      return localDateKey(dt);
    }
  }
  var mdMatch=s.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if(mdMatch){
    var month2=findMonth(mdMatch[1]);
    if(month2>-1){
      var dd2=Number(mdMatch[2]);
      var year2=now.getFullYear();
      var dt2=new Date(year2,month2,dd2,12,0,0);
      if(dt2<now)dt2.setFullYear(year2+1);
      return localDateKey(dt2);
    }
  }

  // "5/12" or "5/12/26" UK format
  var slashMatch=s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if(slashMatch){
    var d3=Number(slashMatch[1]);
    var m3=Number(slashMatch[2])-1;
    var y3=slashMatch[3]?Number(slashMatch[3]):now.getFullYear();
    if(y3<100)y3+=2000;
    var dt3=new Date(y3,m3,d3,12,0,0);
    if(dt3<now&&!slashMatch[3])dt3.setFullYear(y3+1);
    return localDateKey(dt3);
  }

  // "this week", "next week" → end of that week
  if(s==='this week'){
    var endThis=new Date(now);endThis.setDate(endThis.getDate()+(6-endThis.getDay()));
    return localDateKey(endThis);
  }
  if(s==='next week'){
    var startNext=new Date(now);startNext.setDate(startNext.getDate()+(7-startNext.getDay()));
    var endNext=new Date(startNext);endNext.setDate(endNext.getDate()+6);
    return localDateKey(endNext);
  }

  // Plain ISO date
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;

  return null;
}

function toggleTask(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var wasDone=!!t.done;
  t.done=!wasDone;
  t.doneAt=t.done?localDateKey(new Date()):null;
  saveState();
  renderDashboard();
  if(!wasDone&&t.done){
    if(typeof bloomTick==='function')bloomTick('task:'+id);
    if(typeof showCelebrationToast==='function')showCelebrationToast('Done — '+t.text,'✓');
    if(typeof checkAllDoneToday==='function')checkAllDoneToday();
  }
}

function toggleTaskWeekPriority(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var wkKey=weekKey(new Date());
  if(t.weekPriority===wkKey)delete t.weekPriority;
  else t.weekPriority=wkKey;
  saveState();
  renderDashboard();
}

function deleteTask(id){
  if(typeof confirmDelete==='function'){
    confirmDelete('Remove this task?',function(){
      STATE.tasks=(STATE.tasks||[]).filter(function(t){return t.id!==id});
      saveState();
      renderDashboard();
    });
  }else{
    STATE.tasks=(STATE.tasks||[]).filter(function(t){return t.id!==id});
    saveState();
    renderDashboard();
  }
}

function editTaskInline(id){
  // Quick-action: just open the modal
  openTaskEditModal(id);
}
function openTaskEditModal(id){
  if(typeof openModal==='function')openModal('editTask',id);
}
function saveTaskEdit(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var text=(document.getElementById('m-task-text')||{}).value||'';
  var due=(document.getElementById('m-task-due')||{}).value||'';
  if(!text.trim())return;
  t.text=text.trim();
  t.dueDate=due||null;
  saveState();
  if(typeof closeModal==='function')closeModal();
  renderDashboard();
}


function saveTaskEditFromModal(id){
  var t=(STATE.tasks||[]).find(function(x){return x.id===id});
  if(!t)return;
  var text=((document.getElementById('m-task-text')||{}).value||'').trim();
  var due=(document.getElementById('m-task-due')||{}).value||'';
  var time=(document.getElementById('m-task-time')||{}).value||'';
  var priChecked=!!(document.getElementById('m-task-pri')||{}).checked;
  if(text)t.text=text;
  t.dueDate=due||null;
  // A time only makes sense with a date; drop it if the date was cleared.
  t.dueTime=(due&&time)?time:null;
  var wkKey=weekKey(new Date());
  if(priChecked)t.weekPriority=wkKey;
  else if(t.weekPriority===wkKey)delete t.weekPriority;
  saveState();
  if(typeof closeModal==='function')closeModal();
  renderDashboard();
  if(typeof renderPlanner==='function')renderPlanner();
}
