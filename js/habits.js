// HABITS — frequency-aware rendering (redesigned)
// ============================================================

var habitFilter='all';
var habitLifecycleView='active';
// Which habit detail panels are expanded, keyed by habit id. Module-level so the
// open state survives the full innerHTML rebuild a tick triggers on either the
// Habits page or the planner habits card.
var habitDetailsOpen={};

// A habit carries `details` (an array of {name, spec}) when it has an expandable
// "what it entails" panel — e.g. the seeded daily rehab block. Optional, so most
// habits have none and render exactly as before.
function habitHasDetails(h){return !!(h&&Array.isArray(h.details)&&h.details.length)}

function habitDetailsPanelHTML(h){
  if(!habitHasDetails(h))return '';
  return '<div class="hb-details-panel">'
    +(h.detailsTitle?'<div class="hb-details-panel-title">'+escapeHtml(h.detailsTitle)+'</div>':'')
    +'<ul class="hb-details-list">'
    +h.details.map(function(d){
      return '<li class="hb-details-item"><span class="hb-details-name">'+escapeHtml(d.name||'')+'</span>'
        +(d.spec?'<span class="hb-details-spec">'+escapeHtml(d.spec)+'</span>':'')
      +'</li>';
    }).join('')
    +'</ul></div>';
}

// Flip a habit's detail panel and re-render whichever surface is showing it. The
// Habits page restores focus itself via data-habit-focus; the planner has no
// generic restore, so re-focus the info toggle explicitly after its patch.
function toggleHabitDetails(id){
  habitDetailsOpen[id]=!habitDetailsOpen[id];
  if(document.getElementById('habits-grid')&&typeof renderHabits==='function')renderHabits();
  if(typeof refreshPlannerCards==='function'&&document.getElementById('planner-habits-card')){
    refreshPlannerCards(['habits']);
    var info=document.querySelector('[data-planner-habit-info="'+id+'"]');
    if(info)info.focus();
  }
}

var HABIT_CAT_META={
  fit:{label:'Fitness',color:'#B0563C',emoji:'💪'},
  fin:{label:'Finance',color:'#C98A2D',emoji:'💸'},
  car:{label:'Career',color:'#6E93AE',emoji:'💼'},
  per:{label:'Personal',color:'#3F5A44',emoji:'🌿'}
};

var HABIT_ANCHORS={
  morning:{label:'Morning',emoji:'🌅',hours:[5,12]},
  midday:{label:'Midday',emoji:'☀️',hours:[12,17]},
  evening:{label:'Evening',emoji:'🌙',hours:[17,22]},
  anytime:{label:'Anytime',emoji:'✨',hours:[0,24]}
};

var HABIT_INTEGRATION_META=[
  {key:'lifehub.workout.any',label:'Any workout',sourceKind:'workout'},
  {key:'lifehub.workout.hyrox',label:'Hyrox workout',sourceKind:'workout'},
  {key:'lifehub.run.any',label:'Any run',sourceKind:'run'},
  {key:'lifehub.skincare.am',label:'Morning skincare',sourceKind:'skincare'},
  {key:'lifehub.skincare.pm',label:'Evening skincare',sourceKind:'skincare'}
];
function projectHabitLogs(habit){
  habit.logs={};
  Object.keys(habit.logProvenance||{}).forEach(function(dateKey){
    var entry=habit.logProvenance[dateKey],hasManual=entry&&entry.manual===true;
    var hasSource=entry&&entry.sources&&Object.keys(entry.sources).some(function(key){return entry.sources[key]===true});
    if(hasManual||hasSource)habit.logs[dateKey]=true;
    else delete habit.logProvenance[dateKey];
  });
  return habit.logs;
}
function ensureHabitProvenance(habit){
  if(!habit)return habit;
  if(typeof normalizeLifeHubHabits==='function')normalizeLifeHubHabits({habits:[habit]});
  if(!habit.logProvenance||typeof habit.logProvenance!=='object'||Array.isArray(habit.logProvenance))habit.logProvenance={};
  if(!Array.isArray(habit.integrationKeys))habit.integrationKeys=[];
  habit.provenanceVersion=1;projectHabitLogs(habit);return habit;
}
function habitManualCompleted(habit,dateKey){ensureHabitProvenance(habit);return !!(habit.logProvenance[dateKey]&&habit.logProvenance[dateKey].manual)}
function setManualHabitCompletion(habit,dateKey,present){
  ensureHabitProvenance(habit);var entry=habit.logProvenance[dateKey]||{sources:{}};
  if(!entry.sources||typeof entry.sources!=='object'||Array.isArray(entry.sources))entry.sources={};
  if(present)entry.manual=true;else delete entry.manual;
  if(entry.manual||Object.keys(entry.sources).length)habit.logProvenance[dateKey]=entry;else delete habit.logProvenance[dateKey];
  projectHabitLogs(habit);
}
function _habitSourceKey(sourceKind,sourceRecordKey){
  var key=String(sourceKind||'')+':'+String(sourceRecordKey||'');
  return /^(workout|run|skincare):[A-Za-z0-9_-]{1,100}$/.test(key)?key:null;
}
function applyHabitSource(integrationKey,dateKey,sourceKind,sourceRecordKey){
  var sourceKey=_habitSourceKey(sourceKind,sourceRecordKey);if(!sourceKey)return [];
  var changed=[];(STATE.habits||[]).forEach(function(habit){
    ensureHabitProvenance(habit);if(habit.integrationKeys.indexOf(integrationKey)===-1||!habitIsActiveOnDate(habit,dateKey))return;
    var entry=habit.logProvenance[dateKey]||{sources:{}};if(!entry.sources)entry.sources={};
    if(entry.sources[sourceKey]===true)return;entry.sources[sourceKey]=true;habit.logProvenance[dateKey]=entry;projectHabitLogs(habit);changed.push(habit.id);
  });
  return changed;
}
function removeHabitSource(sourceKind,sourceRecordKey){
  var sourceKey=_habitSourceKey(sourceKind,sourceRecordKey);if(!sourceKey)return [];
  var changed=[];(STATE.habits||[]).forEach(function(habit){
    ensureHabitProvenance(habit);var habitChanged=false;
    Object.keys(habit.logProvenance).forEach(function(dateKey){var entry=habit.logProvenance[dateKey];if(entry.sources&&entry.sources[sourceKey]){delete entry.sources[sourceKey];habitChanged=true}});
    if(habitChanged){projectHabitLogs(habit);changed.push(habit.id)}
  });
  return changed;
}
function selectedHabitIntegrations(){
  return Array.prototype.slice.call(document.querySelectorAll('input[name="m-hintegration"]:checked')).map(function(input){return input.value});
}
function ensureHabitLifecycle(habit){
  if(!habit.lifecycle||habit.lifecycle.version!==1||!Array.isArray(habit.lifecycle.inactivePeriods))habit.lifecycle={version:1,inactivePeriods:[]};
  return habit.lifecycle;
}
function habitHasHistory(habit){return !!(habit&&habit.logs&&Object.keys(habit.logs).some(function(key){return habit.logs[key]===true}))}
function habitLifecycleLabel(habit){var status=habitLifecycleStatus(habit,new Date());return status==='paused'?'Paused':status==='archived'?'Archived':'Active'}
function habitFrequencyLabel(habit){
  var frequency=habitFrequency(habit);
  if(/^\d+x\/week$/.test(frequency))return frequency.replace('x/week','× / week');
  return frequency.charAt(0).toUpperCase()+frequency.slice(1);
}
function habitSourceSummary(habit){
  ensureHabitProvenance(habit);
  var manual=0,linked=0;
  Object.keys(habit.logProvenance||{}).forEach(function(dateKey){
    var entry=habit.logProvenance[dateKey]||{};
    if(entry.manual===true)manual++;
    if(entry.sources&&Object.keys(entry.sources).some(function(key){return entry.sources[key]===true}))linked++;
  });
  var labels=(habit.integrationKeys||[]).map(function(key){var meta=HABIT_INTEGRATION_META.find(function(item){return item.key===key});return meta&&meta.label}).filter(Boolean);
  return {manual:manual,linked:linked,labels:labels};
}
function habitLifecycleCounts(){
  var counts={active:0,paused:0,archived:0};
  (STATE.habits||[]).forEach(function(habit){counts[habitLifecycleStatus(habit,new Date())]++});
  return counts;
}
function setHabitLifecycleView(view){
  if(['active','paused','archived'].indexOf(view)===-1)return;
  habitLifecycleView=view;habitFilter='all';renderHabits();
}
function habitViewKeydown(event){
  if(['ArrowLeft','ArrowRight','Home','End'].indexOf(event.key)===-1)return;
  var tabs=Array.prototype.slice.call(document.querySelectorAll('[data-habit-view]')),index=tabs.indexOf(event.currentTarget);if(index<0)return;
  event.preventDefault();if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[index].focus();setHabitLifecycleView(tabs[index].getAttribute('data-habit-view'));
}
function _setHabitLifecycleKind(habit,nextKind,dateKey){
  var lifecycle=ensureHabitLifecycle(habit),ranges=lifecycle.inactivePeriods,current=ranges.length?ranges[ranges.length-1]:null;
  if(current&&current.to===null){
    if(current.from===dateKey)ranges.pop();else current.to=dateKey;
  }
  if(nextKind)ranges.push({kind:nextKind,from:dateKey,to:null});
  return lifecycle;
}

// Auto-suggest a time-of-day anchor based on the habit name
function autoSuggestAnchor(name){
  var n=(name||'').toLowerCase();
  if(/\b(am|morning|wake|breakfast)\b/.test(n))return 'morning';
  if(/\b(pm|evening|night|bed|sleep)\b/.test(n))return 'evening';
  if(/\b(lunch|midday|noon)\b/.test(n))return 'midday';
  return 'anytime';
}

// Which time slot are we in right now?
function currentTimeSlot(){
  var h=new Date().getHours();
  if(h>=5&&h<12)return 'morning';
  if(h>=12&&h<17)return 'midday';
  if(h>=17&&h<22)return 'evening';
  return 'night';  // late night/early morning — treat like evening for what's-next
}

// Should this habit show up as due now? The canonical cadence engine owns
// period boundaries and target progress for every frequency.
function isHabitDueToday(h){
  return getHabitDayState(h,localDateKey(new Date()),new Date())==='todo';
}

// Historical consistency uses only completed periods. The current day/week/
// fortnight/month cannot lower the score while there is still time left.
function habitConsistency(h){
  return getHabitHistoricalConsistency(h,new Date());
}

// Tone label + color for a consistency %
function consistencyTone(pct){
  if(pct>=80)return {label:'Established',color:'var(--moss)'};
  if(pct>=50)return {label:'Building',color:'var(--amber)'};
  return {label:'Starting',color:'var(--sky)'};
}

function habitFocusKey(){var active=document.activeElement;return active&&active.getAttribute?active.getAttribute('data-habit-focus'):null}
function restoreHabitFocus(key){
  if(!key)return;
  var controls=document.querySelectorAll('[data-habit-focus]');
  for(var i=0;i<controls.length;i++)if(controls[i].getAttribute('data-habit-focus')===key&&!controls[i].disabled){controls[i].focus();break}
}
function habitSnapshot(){return typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE))}
function persistHabitChange(snapshot,options){
  if(typeof saveStateOrRollback==='function')return saveStateOrRollback(snapshot,options);
  if(saveState(options))return true;STATE=snapshot;return false;
}
function showHabitFormError(message){var el=document.getElementById('m-herror');if(el){el.textContent=message||'';el.style.display=message?'block':'none'}}

function renderHabits(){
  var focusKey=habitFocusKey(),todayKey=localDateKey(new Date());
  activeWeek=getHabitPeriod({freq:'weekly'},activeWeek).start;
  var wkStart=habitDate(activeWeek),wkEnd=habitAddDays(wkStart,6);
  var wlEl=document.getElementById('habit-week-label');if(wlEl)wlEl.textContent=fmtDate(wkStart.toISOString())+' \u2013 '+fmtDate(wkEnd.toISOString());
  var nextWeekButton=document.getElementById('habit-next-week');if(nextWeekButton)nextWeekButton.disabled=activeWeek>=getHabitPeriod({freq:'weekly'},new Date()).start;

  var lifecycleCounts=habitLifecycleCounts();
  document.querySelectorAll('[data-habit-view]').forEach(function(button){
    var view=button.getAttribute('data-habit-view'),selected=view===habitLifecycleView;
    button.classList.toggle('active',selected);button.setAttribute('aria-selected',selected?'true':'false');button.setAttribute('tabindex',selected?'0':'-1');
    var count=button.querySelector('.habit-view-count');if(count)count.textContent=lifecycleCounts[view]||0;
  });
  var viewHabits=(STATE.habits||[]).filter(function(h){return habitLifecycleStatus(h,todayKey)===habitLifecycleView});
  var summary=document.getElementById('habit-lifecycle-summary');
  if(summary)summary.textContent=viewHabits.length+' '+habitLifecycleView+' rhythm'+(viewHabits.length===1?'':'s')+(habitLifecycleView==='active'?' available now':habitLifecycleView==='paused'?' keeping their history':' stored in the archive');

  var fEl=document.getElementById('habit-filters');
  if(fEl){
    var counts={all:viewHabits.length};
    Object.keys(HABIT_CAT_META).forEach(function(k){counts[k]=viewHabits.filter(function(h){return h.badge===k}).length});
    var btns=[{key:'all',label:'All',color:'var(--moss)'}];
    Object.keys(HABIT_CAT_META).forEach(function(k){var m=HABIT_CAT_META[k];if(counts[k]>0)btns.push({key:k,label:m.emoji+' '+m.label,color:m.color})});
    fEl.innerHTML=btns.map(function(b){var active=habitFilter===b.key;return '<button type="button" class="habit-filter-btn'+(active?' active':'')+'" data-habit-focus="filter:'+b.key+'" aria-pressed="'+(active?'true':'false')+'" onclick="setHabitFilter(\''+b.key+'\')" style="'+(active?'--habit-filter-color:'+b.color:'')+'">'+b.label+' <span class="habit-filter-count">'+counts[b.key]+'</span></button>'}).join('');
  }

  var hgEl=document.getElementById('habits-grid');if(!hgEl)return;
  var habits=viewHabits.filter(function(h){return habitFilter==='all'||h.badge===habitFilter});
  if(!habits.length){
    var copy=habitFilter!=='all'?'No rhythms in this category.':habitLifecycleView==='active'?'No active rhythms yet. Add one when something feels worth returning to.':habitLifecycleView==='paused'?'No paused rhythms. You can pause one from its edit menu without losing history.':'No archived rhythms. Older chapters can rest here without being deleted.';
    hgEl.innerHTML='<div class="habit-empty"><span aria-hidden="true">'+(habitLifecycleView==='active'?'🌱':habitLifecycleView==='paused'?'☁️':'📚')+'</span><strong>'+escapeHtml(copy)+'</strong></div>';
    restoreHabitFocus(focusKey);return;
  }
  hgEl.innerHTML=habits.map(function(h){return renderHabitCard(h,todayKey)}).join('');restoreHabitFocus(focusKey);
}

function setHabitFilter(key){
  habitFilter=key;
  renderHabits();
}

function _renderHabitCardV40(h,todayKey){
  var f=habitFrequency(h);
  var streak=habitStreak(h);
  var meta=HABIT_CAT_META[h.badge]||HABIT_CAT_META.per;
  var icon=h.icon||meta.emoji;
  var anchor=HABIT_ANCHORS[h.anchor||'anytime']||HABIT_ANCHORS.anytime;
  var consistency=habitConsistency(h);
  var tone=consistencyTone(consistency.pct);

  // Render the week selected by Prev/Next, using the canonical Monday start.
  var dayLetters=['M','T','W','T','F','S','S'];
  var weekDates=habitWeekDays(activeWeek).map(function(wk,index){
    var status=getHabitDayState(h,wk,todayKey),manual=status==='done'&&habitManualCompleted(h,wk);
    return {key:wk,letter:dayLetters[index],status:status,manual:manual,sourceOnly:status==='done'&&!manual,isToday:wk===todayKey,future:status==='future'};
  });

  var streakUnit=f==='daily'?'day':f==='weekly'||/^\d+x\/week$/.test(f)?'wk':f==='monthly'?'mo':'fn';
  var streakStr='';
  if(streak>=30)streakStr='<span class="hb-streak-icon hot">💎</span><span class="hb-streak-num">'+streak+streakUnit+'</span>';
  else if(streak>=7)streakStr='<span class="hb-streak-icon hot">🔥</span><span class="hb-streak-num">'+streak+streakUnit+'</span>';
  else if(streak>=3)streakStr='<span class="hb-streak-icon">⚡</span><span class="hb-streak-num">'+streak+streakUnit+'</span>';
  else if(streak>0)streakStr='<span class="hb-streak-num quiet">'+streak+streakUnit+'</span>';

  var todayStatus=getHabitDayState(h,todayKey,todayKey);
  var currentProgress=getHabitProgress(h,todayKey,todayKey);
  var periodManualKeys=currentProgress.logKeys.filter(function(dateKey){return habitManualCompleted(h,dateKey)});
  var todayManual=todayStatus==='done'&&habitManualCompleted(h,todayKey);
  var todayBtn='';
  if(todayStatus==='pre-start'){
    todayBtn='<span class="hb-today-tag">Not tracked yet</span>';
  }else if(f==='monthly'||f==='fortnightly'){
    if(currentProgress.met&&!periodManualKeys.length)todayBtn='<span class="hb-today-tag">✓ Linked activity</span>';
    else todayBtn='<button type="button" class="hb-today-btn'+(currentProgress.met?' done':'')+'" data-habit-focus="period:'+h.id+'" aria-pressed="'+(currentProgress.met?'true':'false')+'" onclick="toggleHabitPeriod(\''+h.id+'\',\''+todayKey+'\')">'
      +(currentProgress.met?'✓ Done this '+currentProgress.period.unit:'Log this '+currentProgress.period.unit)
      +'</button>';
  }else if(todayStatus==='rest'){
    todayBtn='<span class="hb-today-tag">✓ On track this '+currentProgress.period.unit+'</span>';
  }else if(todayStatus==='done'&&!todayManual){
    todayBtn='<span class="hb-today-tag">✓ Linked activity</span>';
  }else{
    var doneToday=todayStatus==='done';
    todayBtn='<button type="button" class="hb-today-btn'+(doneToday?' done':'')+'" data-habit-focus="today:'+h.id+'" aria-pressed="'+(todayManual?'true':'false')+'" onclick="toggleHabitToday(\''+h.id+'\')">'
      +(doneToday?'✓ Done today':'Mark done')
      +'</button>';
  }

  var titleId='habit-title-'+h.id;
  var html='<article class="habit-card" aria-labelledby="'+titleId+'" style="border-left:3px solid '+meta.color+'">';
  html+='<div class="hb-head">';
  html+='<div class="hb-icon" style="background:'+meta.color+'18;color:'+meta.color+'">'+escapeHtml(icon)+'</div>';
  html+='<div class="hb-title-block">';
  html+='<div class="hb-title" id="'+titleId+'">'+escapeHtml(h.name)+'</div>';
  html+='<div class="hb-meta"><span class="hb-freq">'+escapeHtml(f)+'</span><span class="hb-cat-dot" style="background:'+meta.color+'"></span><span class="hb-anchor">'+anchor.emoji+' '+anchor.label+'</span></div>';
  html+='</div>';
  var ringColor=f==='daily'?'var(--moss)':'var(--amber)';
  var ringCenter=currentProgress.met?'✓':'';
  if(typeof ringSVG==='function')html+='<div class="hb-ring" title="'+consistency.pct+'% consistency">'+ringSVG(consistency.pct,ringColor,34,ringCenter)+'</div>';
  if(streakStr)html+='<div class="hb-streak" title="'+streak+' '+streakUnit+' streak">'+streakStr+'</div>';
  html+='<button type="button" class="hb-edit" data-habit-focus="edit:'+h.id+'" onclick="openModal(\'editHabit\',\''+h.id+'\')" aria-label="Edit '+escapeHtml(h.name)+'">✎</button>';
  html+='</div>';

  var consistencyDetail=consistency.total
    ?consistency.done+'/'+consistency.total+' '+consistency.unit+(consistency.total===1?'':'s')
    :'No completed periods yet';
  html+='<div class="hb-consistency"><div class="hb-consistency-head"><span class="hb-consistency-pct" style="color:'+tone.color+'">'+consistency.pct+'%</span><span class="hb-consistency-tone" style="color:'+tone.color+'">'+tone.label+'</span><span class="hb-consistency-detail">'+consistencyDetail+'</span></div><div class="hb-consistency-bar" role="progressbar" aria-label="'+escapeHtml(h.name)+' historical consistency" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+consistency.pct+'"><div class="hb-consistency-fill" style="width:'+consistency.pct+'%;background:'+tone.color+'"></div></div></div>';

  if(f==='monthly'||f==='fortnightly'){
    var periodHistory=habitPeriodStatus(h,f);
    html+='<div class="hb-periods">'+periodHistory.lastPeriods.map(function(period){
      var suffix=period.preStart?' — not tracked yet':period.done?' — done':period.current?' — current period':' — open';
      return '<span class="hb-period'+(period.done?' done':'')+(period.preStart?' pre':'')+'" role="img" aria-label="'+escapeHtml(period.label+suffix)+'"><span aria-hidden="true">'+escapeHtml(period.label)+'</span></span>';
    }).join('')+'</div>';
  }else{
    html+='<div class="hb-week">'+weekDates.map(function(day){
      var cls='hb-week-day';
      if(day.future)cls+=' future';
      else if(day.status==='done')cls+=' done';
      else if(day.status==='rest')cls+=' rest';
      else if(day.status==='pre-start')cls+=' pre';
      else if(day.isToday)cls+=' today';
      var inner=day.status==='done'?'✓':day.letter;
      var clickable=(day.status==='done'&&day.manual)||day.status==='todo';
      var fullDate=habitDate(day.key).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
      var statusLabel=day.sourceOnly?'completed by linked activity':day.status==='done'?'completed manually':day.status==='rest'?'target already met':day.status==='pre-start'?'before tracking began':day.status==='future'?'future date':'not completed';
      var disabled=clickable?'':' disabled';
      var tick=clickable?' data-tick="hab:'+h.id+':'+day.key+'"':'';
      return '<button type="button" class="'+cls+'" data-habit-focus="day:'+h.id+':'+day.key+'" aria-label="'+escapeHtml(h.name+', '+fullDate+', '+statusLabel)+'" aria-pressed="'+(day.status==='done'?'true':'false')+'"'+disabled+tick+(clickable?' onclick="toggleHabit(\''+h.id+'\',\''+day.key+'\')"':'')+'><span class="hb-week-letter" aria-hidden="true">'+day.letter+'</span><span class="hb-week-mark" aria-hidden="true">'+inner+'</span></button>';
    }).join('')+'</div>';
  }

  html+='<div class="hb-foot"><div class="hb-foot-action" style="margin-left:auto">'+todayBtn+'</div></div>';
  html+='</article>';
  return html;
}

function renderHabitCard(h,todayKey){
  ensureHabitLifecycle(h);ensureHabitProvenance(h);
  var frequency=habitFrequency(h),status=habitLifecycleStatus(h,todayKey),readOnly=status!=='active';
  var meta=HABIT_CAT_META[h.badge]||HABIT_CAT_META.per,icon=h.icon||meta.emoji;
  var anchor=HABIT_ANCHORS[h.anchor||'anytime']||HABIT_ANCHORS.anytime;
  var consistency=habitConsistency(h),tone=consistencyTone(consistency.pct),trend=habitCompletedPeriodTrend(h,new Date(),4);
  var streak=habitStreak(h),source=habitSourceSummary(h),currentProgress=getHabitProgress(h,todayKey,todayKey);
  var titleId='habit-title-'+h.id;
  var html='<article class="habit-card habit-card--'+status+'" aria-labelledby="'+titleId+'" style="--habit-accent:'+meta.color+'">';
  html+='<div class="hb-head"><div class="hb-icon" aria-hidden="true">'+escapeHtml(icon)+'</div><div class="hb-title-block">';
  html+='<div class="hb-title-row"><h2 class="hb-title" id="'+titleId+'">'+escapeHtml(h.name)+'</h2>'+(readOnly?'<span class="hb-status hb-status--'+status+'">'+habitLifecycleLabel(h)+'</span>':'')+'</div>';
  html+='<div class="hb-meta"><span>'+escapeHtml(habitFrequencyLabel(h))+'</span><span aria-hidden="true">·</span><span>'+anchor.emoji+' '+anchor.label+'</span><span aria-hidden="true">·</span><span>'+meta.label+'</span></div></div>';
  html+='<button type="button" class="hb-edit" data-habit-focus="edit:'+h.id+'" onclick="openModal(\'editHabit\',\''+h.id+'\')" aria-label="Manage '+escapeHtml(h.name)+'">•••</button></div>';

  if(h.note)html+='<p class="hb-note">'+escapeHtml(h.note)+'</p>';
  if(habitHasDetails(h)){
    var detailsOpen=!!habitDetailsOpen[h.id];
    html+='<button type="button" class="hb-details-toggle" data-habit-focus="details:'+h.id+'" aria-expanded="'+(detailsOpen?'true':'false')+'" onclick="toggleHabitDetails(\''+h.id+'\')">'
      +'<span class="hb-details-caret" aria-hidden="true">'+(detailsOpen?'▾':'▸')+'</span>'+escapeHtml(h.detailsTitle||'What it entails')+'</button>';
    if(detailsOpen)html+=habitDetailsPanelHTML(h);
  }
  html+='<div class="hb-snapshot"><div><span class="hb-snapshot-value" style="color:'+tone.color+'">'+consistency.pct+'%</span><span class="hb-snapshot-label">historical rhythm</span></div>';
  html+='<div><span class="hb-snapshot-value">'+(streak||'—')+'</span><span class="hb-snapshot-label">'+(streak?'period'+(streak===1?'':'s')+' in flow':'open start')+'</span></div>';
  html+='<div class="hb-ring-wrap" aria-label="'+escapeHtml(h.name)+' historical rhythm '+consistency.pct+' percent">'+(typeof ringSVG==='function'?ringSVG(consistency.pct,frequency==='daily'?'var(--moss)':'var(--amber)',42,currentProgress.met?'✓':''):'')+'</div></div>';
  html+='<div class="hb-consistency-bar" role="progressbar" aria-label="'+escapeHtml(h.name)+' historical rhythm" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+consistency.pct+'"><span style="width:'+consistency.pct+'%;background:'+tone.color+'"></span></div>';

  if(frequency==='monthly'||frequency==='fortnightly'){
    var periodHistory=habitPeriodStatus(h,frequency);
    html+='<div class="hb-periods" aria-label="Recent periods">'+periodHistory.lastPeriods.map(function(item){
      var cls='hb-period'+(item.done?' done':'')+(item.preStart?' pre':'')+(item.inactive?' inactive':'');
      var suffix=item.inactive?'inactive':item.preStart?'not tracked yet':item.done?'complete':item.current?'current period':'open';
      return '<span class="'+cls+'" role="img" aria-label="'+escapeHtml(item.label+', '+suffix)+'">'+escapeHtml(item.label)+'</span>';
    }).join('')+'</div>';
  }else{
    var dayLetters=['M','T','W','T','F','S','S'];
    html+='<div class="hb-week" aria-label="Selected week">'+habitWeekDays(activeWeek).map(function(dateKey,index){
      var dayStatus=getHabitDayState(h,dateKey,todayKey),manual=dayStatus==='done'&&habitManualCompleted(h,dateKey),sourceOnly=dayStatus==='done'&&!manual;
      var clickable=!readOnly&&((dayStatus==='done'&&manual)||dayStatus==='todo');
      var cls='hb-week-day '+dayStatus+(dateKey===todayKey?' today':'');
      var fullDate=habitDate(dateKey).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
      var statusText=sourceOnly?'completed by linked activity':dayStatus==='done'?'completed manually':dayStatus==='rest'?'rhythm already met':dayStatus==='inactive'?'inactive':dayStatus==='pre-start'?'before tracking began':dayStatus==='future'?'future date':'open';
      return '<button type="button" class="'+cls+'" data-habit-focus="day:'+h.id+':'+dateKey+'" aria-label="'+escapeHtml(h.name+', '+fullDate+', '+statusText)+'" aria-pressed="'+(dayStatus==='done'?'true':'false')+'"'+(clickable?' data-tick="hab:'+h.id+':'+dateKey+'" onclick="toggleHabit(\''+h.id+'\',\''+dateKey+'\')"':' disabled')+'><span class="hb-week-letter" aria-hidden="true">'+dayLetters[index]+'</span><span class="hb-week-mark" aria-hidden="true">'+(dayStatus==='done'?'✓':dayStatus==='inactive'?'—':dayLetters[index])+'</span></button>';
    }).join('')+'</div>';
  }

  var provenanceParts=[];
  if(source.manual)provenanceParts.push(source.manual+' manual');
  if(source.linked)provenanceParts.push(source.linked+' linked');
  if(source.labels.length)provenanceParts.push('connected to '+source.labels.join(', '));
  html+='<div class="hb-details"><div class="hb-trend"><span aria-hidden="true">↗</span><div><strong>'+escapeHtml(trend.label)+'</strong><span>'+(trend.available?trend.recent.pct+'% recent · '+trend.earlier.pct+'% earlier':'Completed periods only')+'</span></div></div>';
  html+='<div class="hb-source"><span aria-hidden="true">⌁</span><span>'+escapeHtml(provenanceParts.length?provenanceParts.join(' · '):'Manual check-ins only')+'</span></div></div>';

  var todayStatus=getHabitDayState(h,todayKey,todayKey),periodManualKeys=currentProgress.logKeys.filter(function(key){return habitManualCompleted(h,key)}),todayManual=todayStatus==='done'&&habitManualCompleted(h,todayKey),todayAction='';
  if(readOnly)todayAction='<span class="hb-today-tag">History kept · '+habitLifecycleLabel(h)+'</span>';
  else if(todayStatus==='inactive')todayAction='<span class="hb-today-tag">This date rests outside the rhythm</span>';
  else if(todayStatus==='pre-start')todayAction='<span class="hb-today-tag">Tracking starts '+escapeHtml(fmtDate(h.startDate))+'</span>';
  else if(frequency==='monthly'||frequency==='fortnightly'){
    if(currentProgress.met&&!periodManualKeys.length)todayAction='<span class="hb-today-tag">✓ Linked activity</span>';
    else todayAction='<button type="button" class="hb-today-btn'+(currentProgress.met?' done':'')+'" data-habit-focus="period:'+h.id+'" aria-pressed="'+(currentProgress.met?'true':'false')+'" onclick="toggleHabitPeriod(\''+h.id+'\',\''+todayKey+'\')">'+(currentProgress.met?'✓ Logged this '+currentProgress.period.unit:'Log this '+currentProgress.period.unit)+'</button>';
  }else if(todayStatus==='rest')todayAction='<span class="hb-today-tag">✓ Rhythm met for this '+currentProgress.period.unit+'</span>';
  else if(todayStatus==='done'&&!todayManual)todayAction='<span class="hb-today-tag">✓ Linked activity</span>';
  else todayAction='<button type="button" class="hb-today-btn'+(todayStatus==='done'?' done':'')+'" data-habit-focus="today:'+h.id+'" aria-pressed="'+(todayManual?'true':'false')+'" onclick="toggleHabitToday(\''+h.id+'\')">'+(todayStatus==='done'?'✓ Logged today':'Log today')+'</button>';
  html+='<div class="hb-foot"><span class="hb-consistency-detail">'+(consistency.total?consistency.done+' of '+consistency.total+' completed periods':'No completed periods yet')+'</span><div class="hb-foot-action">'+todayAction+'</div></div></article>';
  return html;
}

// Current and recent canonical monthly/fortnightly periods.
function habitPeriodStatus(h,freq){
  var normalized=habitFrequency(freq),todayKey=localDateKey(new Date());
  var current=getHabitPeriod({freq:normalized},todayKey);
  var lastPeriods=[];
  for(var offset=-5;offset<=0;offset++){
    var period=habitPeriodOffset({freq:normalized},todayKey,offset);
    var progress=getHabitProgress(h,period.start,todayKey);
    var preStart=!!(h.startDate&&period.end<h.startDate);
    var startDate=habitDate(period.start),label;
    if(normalized==='monthly')label=startDate.toLocaleDateString('en-GB',{month:'short'});
    else label=fmtDate(startDate.toISOString())+'–'+fmtDate(habitDate(period.end).toISOString());
    lastPeriods.push({done:!preStart&&progress.met,preStart:preStart,inactive:!progress.active||progress.interrupted,current:period.key===current.key,label:label,period:period});
  }
  return {thisPeriod:getHabitProgress(h,todayKey,todayKey).met,lastPeriods:lastPeriods};
}

function toggleHabitToday(hid){
  var h=(STATE.habits||[]).find(function(item){return item.id===hid});
  if(!h)return false;
  var today=localDateKey(new Date());
  if(habitFrequency(h)==='monthly'||habitFrequency(h)==='fortnightly')return toggleHabitPeriod(hid,today);
  return toggleHabit(hid,today);
}

// Period habits undo the actual completion in that period rather than blindly
// toggling today's date.
function toggleHabitPeriod(hid,dateKey){
  var h=(STATE.habits||[]).find(function(item){return item.id===hid});
  if(!h)return false;
  var progress=getHabitProgress(h,dateKey,dateKey);
  var manualKeys=progress.logKeys.filter(function(key){return habitManualCompleted(h,key)});
  if(progress.met&&!manualKeys.length)return false;
  var toggleKey=progress.met?manualKeys[manualKeys.length-1]:dateKey;
  return toggleHabit(hid,toggleKey);
}

function toggleHabit(hid,day){
  var h=STATE.habits.find(function(x){return x.id===hid});
  if(!h)return false;
  var snapshot=habitSnapshot();ensureHabitProvenance(h);ensureHabitLifecycle(h);
  var todayKey=localDateKey(new Date());
  if(day>todayKey||(h.startDate&&day<h.startDate)||!habitIsActiveOnDate(h,day))return false;
  var wasDone=!!h.logs[day],wasManual=habitManualCompleted(h,day);
  if(!wasDone&&getHabitDayState(h,day,todayKey)==='rest')return false;
  setManualHabitCompletion(h,day,!wasManual);
  if(!persistHabitChange(snapshot)){if(typeof renderHabits==='function')renderHabits();return false}
  emitLifeHubChange({action:'habit-manual-toggle',entityId:hid,dateKeys:[day],domains:['habits'],source:'habit'});
  if(!wasDone&&h.logs[day]){
    if(typeof bloomTick==='function')bloomTick('hab:'+hid+':'+day);
    var streak=habitStreak(h);
    if([7,14,30].indexOf(streak)!==-1&&typeof showCelebrationToast==='function')showCelebrationToast(h.name+' · '+streak+' periods in rhythm','🌿');
    if(day===todayKey&&typeof checkAllDoneToday==='function')checkAllDoneToday();
  }
  return true;
}

function changeWeek(dir){
  var candidate=habitAddDays(activeWeek,dir*7),currentStart=getHabitPeriod({freq:'weekly'},new Date()).start;
  if(localDateKey(candidate)>currentStart)return;
  activeWeek=localDateKey(candidate);renderHabits();
}

function _persistHabitLifecycleAction(id,nextKind,expectedStatuses,action,label,nextView){
  var habit=(STATE.habits||[]).find(function(item){return item.id===id});if(!habit)return false;
  var current=habitLifecycleStatus(habit,new Date());if(expectedStatuses.indexOf(current)===-1)return false;
  var snapshot=habitSnapshot();if(typeof captureUndoSnapshot==='function')captureUndoSnapshot(label);
  _setHabitLifecycleKind(habit,nextKind,localDateKey(new Date()));
  if(!persistHabitChange(snapshot)){showHabitFormError('This change could not be saved. Your previous rhythm is unchanged.');return false}
  if(nextView)habitLifecycleView=nextView;habitFilter='all';closeModal();
  emitLifeHubChange({action:action,entityId:id,domains:['habits'],source:'habit'});return true;
}
function pauseHabit(id){return _persistHabitLifecycleAction(id,'paused',['active'],'habit-pause','Paused rhythm','paused')}
function resumeHabit(id){return _persistHabitLifecycleAction(id,null,['paused'],'habit-resume','Resumed rhythm','active')}
function archiveHabit(id){return _persistHabitLifecycleAction(id,'archived',['active','paused'],'habit-archive','Archived rhythm','archived')}
function restoreHabit(id){return _persistHabitLifecycleAction(id,null,['archived'],'habit-restore','Restored rhythm','active')}

function deleteHabit(id){
  var habit=(STATE.habits||[]).find(function(item){return item.id===id});
  if(!habit||habitLifecycleStatus(habit,new Date())!=='archived'){showHabitFormError('Archive this rhythm before deleting it permanently.');return false}
  confirmDelete('Permanently delete this archived rhythm and all of its history?',function(){
    var snapshot=habitSnapshot();STATE.habits=STATE.habits.filter(function(item){return item.id!==id});
    if(!persistHabitChange(snapshot)){renderHabits();return false}
    emitLifeHubChange({action:'habit-delete',entityId:id,domains:['habits'],source:'habit'});return true;
  });
}

function saveHabit(){
  var name=((document.getElementById('m-hname')||{}).value||'').trim();
  if(!name){showHabitFormError('Add a name for this rhythm.');return false}
  var snapshot=habitSnapshot(),anchorVal=(document.getElementById('m-hanchor')||{}).value;
  var habit={id:g(),name:name,freq:habitFrequency((document.getElementById('m-hfreq')||{}).value||'daily'),badge:(document.getElementById('m-hbadge')||{}).value||'per',icon:((document.getElementById('m-hicon')||{}).value||'').trim(),note:((document.getElementById('m-hnote')||{}).value||'').trim(),anchor:anchorVal||autoSuggestAnchor(name),integrationKeys:selectedHabitIntegrations(),provenanceVersion:1,logProvenance:{},logs:{},startDate:localDateKey(new Date()),lifecycle:{version:1,inactivePeriods:[]}};
  STATE.habits.push(habit);
  if(!persistHabitChange(snapshot)){showHabitFormError('This rhythm could not be saved. Your previous data is unchanged.');renderHabits();return false}
  habitLifecycleView='active';habitFilter='all';closeModal();emitLifeHubChange({action:'habit-create',entityId:habit.id,domains:['habits'],source:'habit'});return true;
}

function updateHabit(id){
  var habit=STATE.habits.find(function(item){return item.id===id});if(!habit)return false;
  var name=((document.getElementById('m-hname')||{}).value||'').trim();if(!name){showHabitFormError('Add a name for this rhythm.');return false}
  var requestedFrequency=habitFrequency((document.getElementById('m-hfreq')||{}).value||habit.freq);
  if(habitHasHistory(habit)&&requestedFrequency!==habitFrequency(habit)){showHabitFormError('Start a new rhythm to change cadence without rewriting existing history.');return false}
  var snapshot=habitSnapshot();habit.name=name;habit.freq=requestedFrequency;habit.badge=(document.getElementById('m-hbadge')||{}).value||habit.badge;
  var icon=(document.getElementById('m-hicon')||{}).value;if(icon!==undefined)habit.icon=icon.trim();
  var note=(document.getElementById('m-hnote')||{}).value;if(note!==undefined)habit.note=note.trim();
  var anchor=(document.getElementById('m-hanchor')||{}).value;if(anchor)habit.anchor=anchor;
  habit.integrationKeys=selectedHabitIntegrations();ensureHabitProvenance(habit);ensureHabitLifecycle(habit);
  if(!persistHabitChange(snapshot)){showHabitFormError('These changes could not be saved. Your previous rhythm is unchanged.');renderHabits();return false}
  closeModal();emitLifeHubChange({action:'habit-update',entityId:id,domains:['habits'],source:'habit'});return true;
}

function startNewHabitRhythm(id){
  var previous=(STATE.habits||[]).find(function(item){return item.id===id});if(!previous||!habitHasHistory(previous))return false;
  var newFrequency=habitFrequency((document.getElementById('m-hnewfreq')||{}).value||previous.freq);
  var name=((document.getElementById('m-hname')||{}).value||previous.name).trim();if(!name){showHabitFormError('Add a name for the new rhythm.');return false}
  var snapshot=habitSnapshot(),today=localDateKey(new Date());if(typeof captureUndoSnapshot==='function')captureUndoSnapshot('Started new rhythm');
  _setHabitLifecycleKind(previous,'archived',today);
  var replacement={id:g(),name:name,freq:newFrequency,badge:(document.getElementById('m-hbadge')||{}).value||previous.badge,icon:((document.getElementById('m-hicon')||{}).value||previous.icon||'').trim(),note:((document.getElementById('m-hnote')||{}).value||previous.note||'').trim(),anchor:(document.getElementById('m-hanchor')||{}).value||previous.anchor||'anytime',integrationKeys:selectedHabitIntegrations(),provenanceVersion:1,logProvenance:{},logs:{},startDate:today,lifecycle:{version:1,inactivePeriods:[]}};
  STATE.habits.push(replacement);
  if(!persistHabitChange(snapshot)){showHabitFormError('The new rhythm could not be saved. Existing history is unchanged.');return false}
  habitLifecycleView='active';habitFilter='all';closeModal();emitLifeHubChange({action:'habit-new-rhythm',entityId:replacement.id,relatedEntityId:id,domains:['habits'],source:'habit'});return true;
}
