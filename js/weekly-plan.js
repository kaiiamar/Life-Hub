// WEEKLY PLAN — rebuild (planning-first, trimmed review)
// ============================================================
// Data shape (new fields, backwards-compatible):
//   STATE.weeklyPlans[weekKey] = {
//     priorities: ["…","…","…"],
//     prioritiesDone: {0:true,…},
//     priorityDays: {0:'2026-05-07', …}   // NEW: pinned day per priority
//     intention: '…',
//     reflection: '…',
//     savedAt: ISO
//   }

var weeklyViewKey=null;

function _wpPlan(){
  if(!weeklyViewKey)weeklyViewKey=weekKey(new Date());
  if(!STATE.weeklyPlans)STATE.weeklyPlans={};
  if(!STATE.weeklyPlans[weeklyViewKey])STATE.weeklyPlans[weeklyViewKey]={priorities:['','',''],prioritiesDone:{},priorityDays:{}};
  var p=STATE.weeklyPlans[weeklyViewKey];
  if(!p.priorities)p.priorities=['','',''];
  if(!p.prioritiesDone)p.prioritiesDone={};
  if(!p.priorityDays)p.priorityDays={};
  return p;
}

function _wpDays(){
  return weekDays(weeklyViewKey||weekKey(new Date()));
}

function renderWeeklyPlan(){
  if(!weeklyViewKey)weeklyViewKey=weekKey(new Date());
  var days=_wpDays();
  var wkStart=new Date(days[0]+'T12:00:00');
  var wkEnd=new Date(days[6]+'T12:00:00');
  var lEl=document.getElementById('weekly-week-label');
  if(lEl)lEl.textContent=wkStart.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' – '+wkEnd.toLocaleDateString('en-GB',{day:'numeric',month:'short'});

  renderWPPriorities();
  renderWPSchedule();
  renderWPComingUp();
  renderWPReflect();
  renderWPReviewStrip();
}

// ── 1. PRIORITIES (hero) ──
function renderWPPriorities(){
  var el=document.getElementById('wp-priorities');
  if(!el)return;
  var plan=_wpPlan();
  var days=_wpDays();
  var dayShort=['S','M','T','W','T','F','S'];
  var todayKey=localDateKey(new Date());

  var html=plan.priorities.map(function(val,i){
    var done=!!plan.prioritiesDone[i];
    var pinnedDay=plan.priorityDays[i]||'';
    var safe=(val||'').replace(/"/g,'&quot;');
    var h='<div class="wp-priority-row'+(done?' done':'')+'">';
    h+='<div class="wp-priority-tick" onclick="toggleWeeklyPriority('+i+')" title="Mark complete">'+(done?'✓':(i+1))+'</div>';
    h+='<input type="text" class="wp-priority-input" id="wp-p'+i+'" value="'+safe+'" placeholder="Priority '+(i+1)+'…" onblur="savePriorityText('+i+',this.value)" onkeydown="if(event.key===\'Enter\'){this.blur()}">';
    h+='<div class="wp-priority-pins">';
    h+=days.map(function(d,di){
      var isPinned=pinnedDay===d;
      var isToday=d===todayKey;
      return '<button class="wp-pin'+(isPinned?' pinned':'')+(isToday?' today':'')+'" onclick="pinPriorityToDay('+i+',\''+d+'\')" title="Pin to '+new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})+'">'+dayShort[di]+'</button>';
    }).join('');
    h+='</div>';
    h+='</div>';
    return h;
  }).join('');
  el.innerHTML=html;

  // Progress footer
  var foot=document.getElementById('wp-progress-footer');
  if(foot){
    var set=plan.priorities.filter(function(p){return p&&p.trim()}).length;
    var done=plan.priorities.filter(function(p,i){return p&&p.trim()&&plan.prioritiesDone[i]}).length;
    if(set===0){
      foot.innerHTML='<span class="wp-hero-foot-hint">Pick up to 3 things that would make this week a win.</span>';
    }else{
      var pct=Math.round(done/set*100);
      foot.innerHTML='<span class="wp-hero-foot-stat"><strong>'+done+'</strong> of <strong>'+set+'</strong> ticked · '+pct+'%</span><div class="wp-hero-bar"><div class="wp-hero-bar-fill" style="width:'+pct+'%"></div></div>';
    }
  }
}

function savePriorityText(idx,val){
  var plan=_wpPlan();
  plan.priorities[idx]=val;
  plan.savedAt=new Date().toISOString();
  saveState();
  renderWPSchedule();
  renderWPPriorities();
}

function pinPriorityToDay(idx,day){
  var plan=_wpPlan();
  // Toggle: if already pinned to same day, unpin
  if(plan.priorityDays[idx]===day){delete plan.priorityDays[idx]}
  else{plan.priorityDays[idx]=day}
  saveState();
  renderWPPriorities();
  renderWPSchedule();
}

function toggleWeeklyPriority(idx){
  var plan=_wpPlan();
  var wasDone=!!plan.prioritiesDone[idx];
  plan.prioritiesDone[idx]=!wasDone;
  saveState();
  renderWPPriorities();
  renderWPSchedule();
  if(!wasDone&&weeklyViewKey===weekKey(new Date())){
    var pris=plan.priorities.filter(function(p){return p&&p.trim()});
    var done=plan.priorities.filter(function(p,i){return p&&p.trim()&&plan.prioritiesDone[i]}).length;
    if(pris.length>=2&&done===pris.length){
      celebrateOnce('weekly-priorities-done',function(){
        fireConfetti({count:110,duration:2400});
        showCelebrationToast('All weekly priorities ticked — strong week.','🎯');
      });
    }
  }
}

// ── 2. SCHEDULE (7-day strip showing pinned priorities + roadmap dues) ──
function renderWPSchedule(){
  var el=document.getElementById('wp-schedule');
  if(!el)return;
  var plan=_wpPlan();
  var days=_wpDays();
  var dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var todayKey=localDateKey(new Date());

  // Collect roadmap items due each day this week
  var dueByDay={};
  days.forEach(function(d){dueByDay[d]=[]});
  if(typeof RM_MONTHS!=='undefined'){
    RM_MONTHS.forEach(function(m){
      m.sections.forEach(function(sec,si){
        sec.items.forEach(function(item,ii){
          if(rmIsDone(m.id,si,ii))return;
          var k=rmKey(m.id,si,ii);
          if((STATE.roadmapHidden||{})[k])return;
          var due=item.dueDate;
          var added=(STATE.roadmapAdded||[]).find(function(a){return a.mid===m.id&&a.si===si&&a.text===item.text});
          if(added&&added.dueDate)due=added.dueDate;
          if(due&&dueByDay[due])dueByDay[due].push({type:'roadmap',text:item.text});
        });
      });
    });
  }
  (STATE.roadmapAdded||[]).forEach(function(a){
    if((STATE.roadmapChecklist||{})[a.id])return;
    if(a.dueDate&&dueByDay[a.dueDate])dueByDay[a.dueDate].push({type:'roadmap',text:a.text});
  });

  // Collect pinned priorities per day
  var priByDay={};
  days.forEach(function(d){priByDay[d]=[]});
  plan.priorities.forEach(function(text,i){
    if(!text||!text.trim())return;
    var d=plan.priorityDays[i];
    if(d&&priByDay[d])priByDay[d].push({idx:i,text:text,done:!!plan.prioritiesDone[i]});
  });

  var html='<div class="wp-schedule-grid">';
  days.forEach(function(d,i){
    var dateObj=new Date(d+'T12:00:00');
    var isToday=d===todayKey;
    var isPast=d<todayKey;
    var pris=priByDay[d];
    var roadmaps=dueByDay[d];
    html+='<div class="wp-sched-day'+(isToday?' today':'')+(isPast?' past':'')+'">';
    html+='<div class="wp-sched-day-head">';
    html+='<span class="wp-sched-day-name">'+dayNames[i]+'</span>';
    html+='<span class="wp-sched-day-num">'+dateObj.getDate()+'</span>';
    html+='</div>';
    html+='<div class="wp-sched-items">';
    pris.forEach(function(p){
      html+='<div class="wp-sched-item wp-sched-priority'+(p.done?' done':'')+'" title="Priority '+(p.idx+1)+'"><span class="wp-sched-num">'+(p.idx+1)+'</span>'+escapeHtml(p.text)+'</div>';
    });
    roadmaps.forEach(function(r){
      html+='<div class="wp-sched-item wp-sched-roadmap" title="Roadmap due">🗓 '+escapeHtml(r.text)+'</div>';
    });
    if(!pris.length&&!roadmaps.length){
      html+='<div class="wp-sched-empty">'+(isPast?'·':isToday?'Today':'')+'</div>';
    }
    html+='</div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ── 3. COMING UP (combined: overdue + due this week + goal deadlines + check-ins) ──
function renderWPComingUp(){
  var el=document.getElementById('wp-coming-up');
  if(!el)return;
  var days=_wpDays();
  var todayKey=localDateKey(new Date());
  var wkEnd=days[6];
  var items=[];

  // Roadmap overdue + due this week
  if(typeof RM_MONTHS!=='undefined'){
    RM_MONTHS.forEach(function(m){
      m.sections.forEach(function(sec,si){
        sec.items.forEach(function(item,ii){
          if(rmIsDone(m.id,si,ii))return;
          var k=rmKey(m.id,si,ii);
          if((STATE.roadmapHidden||{})[k])return;
          var due=item.dueDate;
          var added=(STATE.roadmapAdded||[]).find(function(a){return a.mid===m.id&&a.si===si&&a.text===item.text});
          if(added&&added.dueDate)due=added.dueDate;
          if(!due)return;
          if(due<todayKey)items.push({type:'roadmap',urgency:'overdue',text:item.text,date:due,sub:sec.label+' · '+m.name});
          else if(due<=wkEnd)items.push({type:'roadmap',urgency:'this-week',text:item.text,date:due,sub:sec.label+' · '+m.name});
        });
      });
    });
  }
  (STATE.roadmapAdded||[]).forEach(function(a){
    if((STATE.roadmapChecklist||{})[a.id])return;
    if(!a.dueDate)return;
    if(a.dueDate<todayKey)items.push({type:'roadmap',urgency:'overdue',text:a.text,date:a.dueDate,sub:'Added'});
    else if(a.dueDate<=wkEnd)items.push({type:'roadmap',urgency:'this-week',text:a.text,date:a.dueDate,sub:'Added'});
  });

  // Goal deadlines within 30 days
  (STATE.goals||[]).forEach(function(g){
    if(g.done||!g.deadline)return;
    var dl=Math.ceil((new Date(g.deadline+'T12:00:00')-new Date())/86400000);
    if(dl<0)items.push({type:'goal',urgency:'overdue',text:g.name,date:g.deadline,sub:g.cat+' · overdue'});
    else if(dl<=30){
      var urg=dl<=7?'this-week':'soon';
      items.push({type:'goal',urgency:urg,text:g.name,date:g.deadline,sub:g.cat+' · '+dl+' day'+(dl===1?'':'s')+' left',action:'openModal(\'updateGoal\',\''+g.id+'\')'});
    }
  });

  // Relationship check-ins due
  (STATE.relationships||[]).forEach(function(r){
    if(!r.lastCheckIn||!r.freq)return;
    var last=new Date(r.lastCheckIn+'T12:00:00');
    var nextDue=new Date(last);
    nextDue.setDate(nextDue.getDate()+Number(r.freq));
    var nextKey=localDateKey(nextDue);
    if(nextKey<todayKey)items.push({type:'relationship',urgency:'overdue',text:'Check in with '+r.name,date:nextKey,sub:'Every '+r.freq+' days'});
    else if(nextKey<=wkEnd)items.push({type:'relationship',urgency:'this-week',text:'Check in with '+r.name,date:nextKey,sub:'Every '+r.freq+' days'});
  });

  // Sort: overdue first, then by date
  var urgencyRank={'overdue':0,'this-week':1,'soon':2};
  items.sort(function(a,b){
    var ra=urgencyRank[a.urgency],rb=urgencyRank[b.urgency];
    if(ra!==rb)return ra-rb;
    return (a.date||'').localeCompare(b.date||'');
  });

  if(!items.length){
    el.innerHTML='<div class="empty" style="padding:20px 0;font-size:13px;color:var(--text3)">Nothing demanding your attention — enjoy the breathing room.</div>';
    return;
  }

  var typeIcon={roadmap:'🗓',goal:'🎯',relationship:'💬'};
  var urgencyColor={'overdue':'var(--red)','this-week':'var(--accent-dark)','soon':'var(--text2)'};
  var urgencyLabel={'overdue':'Overdue','this-week':'This week','soon':'Coming up'};

  el.innerHTML=items.slice(0,12).map(function(it){
    var dl2=Math.ceil((new Date(it.date+'T12:00:00')-new Date())/86400000);
    var when=dl2<0?Math.abs(dl2)+'d ago':dl2===0?'today':dl2===1?'tomorrow':'in '+dl2+'d';
    var action=it.action?' onclick="'+it.action+'" style="cursor:pointer"':'';
    return '<div class="wp-coming-item"'+action+'>'
      +'<span class="wp-coming-icon">'+typeIcon[it.type]+'</span>'
      +'<div class="wp-coming-body">'
        +'<div class="wp-coming-text">'+escapeHtml(it.text)+'</div>'
        +'<div class="wp-coming-sub">'+escapeHtml(it.sub||'')+'</div>'
      +'</div>'
      +'<div class="wp-coming-meta">'
        +'<span class="wp-coming-urgency" style="color:'+urgencyColor[it.urgency]+'">'+urgencyLabel[it.urgency]+'</span>'
        +'<span class="wp-coming-when">'+when+'</span>'
      +'</div>'
    +'</div>';
  }).join('');
}

// ── 4. REFLECT (adaptive intention/reflection) ──
function renderWPReflect(){
  var plan=_wpPlan();
  var iEl=document.getElementById('weekly-intention');
  var rEl=document.getElementById('weekly-reflection');
  var iWrap=document.getElementById('weekly-intention-wrap');
  var rWrap=document.getElementById('weekly-reflection-wrap');
  var labelEl=document.getElementById('wp-reflect-label');
  var promptEl=document.getElementById('wp-reflect-prompt');
  if(iEl)iEl.value=plan.intention||'';
  if(rEl)rEl.value=plan.reflection||'';

  var viewingCurrent=weeklyViewKey===weekKey(new Date());
  var day=new Date().getDay(); // 0 Sun .. 6 Sat

  var mode='both';
  if(viewingCurrent){
    if(day>=1&&day<=3)mode='intention';       // Mon–Wed
    else if(day>=4&&day<=6)mode='both';        // Thu–Sat
    else mode='reflection';                    // Sun
  }

  var prompts={
    'intention':'Early week — what do you want this week to feel like?',
    'reflection':'Week\'s end — what made it, what broke it?',
    'both':'Mid-week check — still on track? What do you want to remember?'
  };
  var labels={
    'intention':'✍️ Set the tone',
    'reflection':'🌙 Reflect on the week',
    'both':'✍️ Check in'
  };

  if(labelEl)labelEl.textContent=labels[mode];
  if(promptEl)promptEl.textContent=prompts[mode];
  if(iWrap)iWrap.style.display=(mode==='reflection')?'none':'block';
  if(rWrap)rWrap.style.display=(mode==='intention')?'none':'block';
}

function wpReflectSaveDebounced(){
  if(window._wpReflectTimer)clearTimeout(window._wpReflectTimer);
  window._wpReflectTimer=setTimeout(function(){
    var plan=_wpPlan();
    var i=document.getElementById('weekly-intention');
    var r=document.getElementById('weekly-reflection');
    if(i)plan.intention=i.value;
    if(r)plan.reflection=r.value;
    plan.savedAt=new Date().toISOString();
    saveState();
    var s=document.getElementById('wp-reflect-saved');
    if(s){s.textContent='Saved';s.classList.add('show');setTimeout(function(){s.classList.remove('show')},1200)}
  },600);
}

// ── 5. REVIEW STRIP (trimmed — context, not redundant) ──
function renderWPReviewStrip(){
  var el=document.getElementById('wp-review-strip');
  if(!el)return;
  var days=_wpDays();
  var todayKey=localDateKey(new Date());

  var wkWorkouts=(STATE.workouts||[]).filter(function(w){return days.indexOf(w.date)!==-1&&w.type!=='Rest'});
  var wkRuns=((STATE.metrics||{}).run||[]).filter(function(r){return days.indexOf(r.date)!==-1});
  var wkRunKm=wkRuns.reduce(function(s,r){return s+Number(r.distance||0)},0);
  var moodDays=days.filter(function(d){return (STATE.mood||{})[d]&&(STATE.mood||{})[d].mood});
  var avgMood=moodDays.length?(moodDays.reduce(function(s,d){return s+Number((STATE.mood||{})[d].mood)},0)/moodDays.length):0;
  var expectedHabits=(STATE.habits||[]);
  var habitsDone=0,habitsTotal=0;
  expectedHabits.forEach(function(h){
    days.forEach(function(d){
      if(d>todayKey)return;
      var status=typeof habitDayStatus==='function'?habitDayStatus(h,d):'todo';
      if(status==='done'||status==='todo'){
        habitsTotal++;
        if(h.logs&&h.logs[d])habitsDone++;
      }
    });
  });
  var habitPct=habitsTotal>0?Math.round(habitsDone/habitsTotal*100):0;

  var pris=_wpPlan().priorities.filter(function(p){return p&&p.trim()});
  var prisDone=_wpPlan().priorities.filter(function(p,i){return p&&p.trim()&&_wpPlan().prioritiesDone[i]}).length;

  var html='<div class="wp-review-grid">';
  html+='<div class="wp-review-stat"><div class="wp-review-num">'+(wkWorkouts.length+wkRuns.length)+'</div><div class="wp-review-lbl">sessions</div><div class="wp-review-detail">'+wkWorkouts.length+' gym · '+wkRuns.length+' run'+(wkRuns.length?' ('+wkRunKm.toFixed(1)+'km)':'')+'</div></div>';
  html+='<div class="wp-review-stat"><div class="wp-review-num">'+habitPct+'%</div><div class="wp-review-lbl">habits</div><div class="wp-review-detail">'+habitsDone+' of '+habitsTotal+' due so far</div></div>';
  html+='<div class="wp-review-stat"><div class="wp-review-num">'+(avgMood?avgMood.toFixed(1):'—')+'</div><div class="wp-review-lbl">avg mood</div><div class="wp-review-detail">'+moodDays.length+' of 7 days logged</div></div>';
  html+='<div class="wp-review-stat"><div class="wp-review-num">'+prisDone+'/'+pris.length+'</div><div class="wp-review-lbl">priorities</div><div class="wp-review-detail">'+(pris.length===0?'None set':pris.length===prisDone?'All ticked':(pris.length-prisDone)+' to go')+'</div></div>';
  html+='</div>';
  el.innerHTML=html;
}

// ── NAV ──
function changeWeeklyWeek(dir){
  if(!weeklyViewKey)weeklyViewKey=weekKey(new Date());
  var parts=weeklyViewKey.split('-');
  var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  d.setDate(d.getDate()+dir*7);
  weeklyViewKey=localDateKey(d);
  renderWeeklyPlan();
}

// Legacy shim — anything that still calls saveWeeklyPlan() will just noop (auto-save handles it)
function saveWeeklyPlan(){
  var plan=_wpPlan();
  var priorities=[0,1,2].map(function(i){var el=document.getElementById('wp-p'+i);return el?el.value:(plan.priorities[i]||'')});
  plan.priorities=priorities;
  var i=document.getElementById('weekly-intention');if(i)plan.intention=i.value;
  var r=document.getElementById('weekly-reflection');if(r)plan.reflection=r.value;
  plan.savedAt=new Date().toISOString();
  saveState();
}

// Wire up auto-save on reflect textareas when page opens
document.addEventListener('DOMContentLoaded',function(){
  var i=document.getElementById('weekly-intention');
  var r=document.getElementById('weekly-reflection');
  if(i)i.addEventListener('input',wpReflectSaveDebounced);
  if(r)r.addEventListener('input',wpReflectSaveDebounced);
});
