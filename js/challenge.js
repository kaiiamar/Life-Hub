// ============================================================
// 75 ME CHALLENGE
// Calendar-based challenge overlay. A missed criterion remains incomplete;
// it never changes the start date or resets the day number.
// ============================================================
var CHALLENGE_75_ID='intentional-75-2026';

function getChallenge75(){
  return STATE.challenges&&STATE.challenges[CHALLENGE_75_ID]||null;
}

function challenge75Phase(dateKey){
  var challenge=getChallenge75();
  if(!challenge)return 'none';
  var key=dateKey||localDateKey(new Date());
  if(key<challenge.startDate)return 'before';
  if(key>challenge.endDate)return 'after';
  return 'active';
}

function challenge75DayNumber(dateKey){
  var challenge=getChallenge75();if(!challenge)return 0;
  var key=dateKey||localDateKey(new Date());
  if(key<challenge.startDate)return 0;
  if(key>challenge.endDate)return 75;
  return Math.max(1,Math.min(75,habitDayDiff(challenge.startDate,key)+1));
}

function challenge75Habit(key){
  var challenge=getChallenge75();
  var id=challenge&&challenge.habitIds&&challenge.habitIds[key];
  return id?(STATE.habits||[]).find(function(h){return h&&h.id===id}):null;
}

function challenge75OwnsHabit(id){
  var challenge=getChallenge75();if(!challenge||!challenge.habitIds||challenge75Phase(localDateKey(new Date()))!=='active')return false;
  return Object.keys(challenge.habitIds).some(function(key){return challenge.habitIds[key]===id});
}

function challenge75WaterStatus(dateKey){
  var challenge=getChallenge75();
  var glasses=Number((STATE.water||{})[dateKey]||0);
  var glassMl=Number(challenge&&challenge.waterGlassMl||250);
  var targetMl=Number(challenge&&challenge.waterTargetMl||2000);
  var ml=glasses*glassMl;
  return {done:ml>=targetMl,glasses:glasses,glassMl:glassMl,ml:ml,targetMl:targetMl};
}

function challenge75DailyStatus(dateKey){
  var challenge=getChallenge75();if(!challenge)return {rows:[],done:0,total:0,water:null};
  var definitions=[
    {key:'steps',icon:'👟',label:'10,000 steps'},
    {key:'movement',icon:'⏱️',label:'45-minute workout · walking excluded'},
    {key:'duolingo',icon:'🦉',label:'Duolingo'},
    {key:'manna',icon:'📖',label:'Manna'},
    {key:'food',icon:'🥗',label:'Whole foods · no unhealthy takeaway'},
    {key:'alcohol',icon:'🥂',label:'Alcohol rule followed'}
  ];
  var rows=definitions.map(function(definition){
    var habit=challenge75Habit(definition.key);
    return {key:definition.key,icon:definition.icon,label:definition.label,habitId:habit&&habit.id||null,done:!!(habit&&habit.logs&&habit.logs[dateKey])};
  });
  var water=challenge75WaterStatus(dateKey);
  rows.push({key:'water',icon:'💧',label:'2 litres of water',habitId:null,done:water.done});
  return {rows:rows,done:rows.filter(function(row){return row.done}).length,total:rows.length,water:water};
}

function challenge75CareerStatus(dateKey){
  var habit=challenge75Habit('career');
  if(!habit)return {habit:null,count:0,target:3,met:false,todayDone:false,state:'inactive'};
  var progress=getHabitProgress(habit,dateKey,dateKey);
  return {habit:habit,count:progress.count,target:progress.target||3,met:progress.met,todayDone:!!(habit.logs&&habit.logs[dateKey]),state:getHabitDayState(habit,dateKey,dateKey)};
}

function challenge75PerfectDays(asOfKey){
  var challenge=getChallenge75();if(!challenge)return 0;
  var cutoff=asOfKey<challenge.endDate?asOfKey:challenge.endDate;
  if(cutoff<challenge.startDate)return 0;
  var count=0;
  for(var day=habitDate(challenge.startDate);localDateKey(day)<=cutoff;day=habitAddDays(day,1)){
    var key=localDateKey(day),status=challenge75DailyStatus(key);
    if(status.total&&status.done===status.total)count++;
  }
  return count;
}

function challenge75CompactSummary(dateKey){
  var challenge=getChallenge75();if(!challenge)return null;
  var key=dateKey||localDateKey(new Date()),phase=challenge75Phase(key);
  if(phase==='before')return {phase:phase,text:'75 Me Challenge · starts '+fmtDate(challenge.startDate)};
  if(phase==='after')return {phase:phase,text:'75 Me Challenge · closed '+fmtDate(challenge.startDate)+'–'+fmtDate(challenge.endDate)};
  var daily=challenge75DailyStatus(key),career=challenge75CareerStatus(key);
  return {phase:phase,text:'Challenge · Day '+challenge75DayNumber(key)+' of 75 · '+daily.done+'/'+daily.total+' today · Career '+career.count+'/'+career.target};
}

function challenge75ToggleHabit(habitId){
  if(!habitId||challenge75Phase(localDateKey(new Date()))!=='active')return false;
  var habit=(STATE.habits||[]).find(function(item){return item&&item.id===habitId});if(!habit)return false;
  var today=localDateKey(new Date()),state=getHabitDayState(habit,today,today),manual=habitManualCompleted(habit,today);
  if(!manual&&state!=='todo'&&state!=='optional')return false;
  var selector='[data-challenge-habit="'+habitId+'"]';
  var restoreFocus=!!(document.activeElement&&document.activeElement.matches&&document.activeElement.matches(selector));
  var snapshot=typeof _clone==='function'?_clone(STATE):JSON.parse(JSON.stringify(STATE));
  ensureHabitProvenance(habit);ensureHabitLifecycle(habit);setManualHabitCompletion(habit,today,!manual);
  if(typeof saveStateOrRollback==='function'?!saveStateOrRollback(snapshot):!saveState()){return false}
  if(typeof emitLifeHubChange==='function')emitLifeHubChange({action:'challenge-habit-toggle',entityId:habitId,dateKeys:[today],domains:['habits'],source:'challenge',rendered:true});
  if(typeof plannerActiveTab!=='undefined'&&plannerActiveTab==='career'&&typeof renderPlannerCareer==='function')renderPlannerCareer();
  else if(typeof refreshPlannerCards==='function')refreshPlannerCards(['challenge','habits']);
  if(typeof refreshDashboardIfActive==='function')refreshDashboardIfActive();
  if(restoreFocus){var replacement=document.querySelector(selector);if(replacement)replacement.focus()}
  return true;
}

function challenge75LogWater(){
  var today=localDateKey(new Date()),glasses=Number((STATE.water||{})[today]||0);
  var restoreFocus=!!(document.activeElement&&document.activeElement.matches&&document.activeElement.matches('[data-challenge-water]'));
  if(typeof logWaterGlass==='function')logWaterGlass(glasses+1);
  if(restoreFocus){var replacement=document.querySelector('[data-challenge-water]');if(replacement)replacement.focus()}
}

function renderChallenge75Card(todayKey){
  var challenge=getChallenge75();if(!challenge)return '';
  var key=todayKey||localDateKey(new Date()),phase=challenge75Phase(key);
  var html='<div class="card planner-card challenge75-card" id="planner-challenge-card">';
  html+='<div class="challenge75-head"><div><div class="challenge75-kicker">75 ME CHALLENGE</div><div class="challenge75-title">75 Me Challenge</div></div>';
  if(phase==='active')html+='<div class="challenge75-day">Day '+challenge75DayNumber(key)+'<span>/75</span></div>';
  html+='</div>';

  if(phase==='before'){
    var daysUntil=Math.max(0,habitDayDiff(key,challenge.startDate));
    html+='<div class="challenge75-before">Starts Monday 5 October · '+daysUntil+' day'+(daysUntil===1?'':'s')+' to set up calmly.</div>';
    html+='<div class="challenge75-rule-note">10k steps · 45-minute non-walking workout · 2L water · Duolingo · Manna · whole foods · alcohol rule. Career Focus is 3× weekly. Missed something? Continue—never restart.</div>';
  }else if(phase==='after'){
    var finalCareer=challenge75CareerStatus(challenge.endDate);
    html+='<div class="challenge75-before">5 October–18 December · '+challenge75PerfectDays(challenge.endDate)+' fully checked days recorded.</div>';
    html+='<div class="challenge75-before">Career Focus final week · '+finalCareer.count+'/'+finalCareer.target+'</div>';
    html+='<div class="challenge75-rule-note">The challenge is closed; your history stays available in Habits and Movement.</div>';
  }else{
    var daily=challenge75DailyStatus(key);
    html+='<div class="challenge75-progress"><span style="width:'+(challenge75DayNumber(key)/75*100)+'%"></span></div>';
    html+='<div class="challenge75-summary">Today · '+daily.done+' of '+daily.total+'</div>';
    html+='<div class="challenge75-grid">'+daily.rows.map(function(row){
      if(row.key==='water'){
        var water=daily.water;
        return '<button type="button" data-challenge-water="true" class="challenge75-row'+(row.done?' done':'')+'" onclick="challenge75LogWater()" aria-label="Add water. '+water.ml+' of '+water.targetMl+' millilitres">'
          +'<span class="challenge75-check">'+(row.done?'✓':row.icon)+'</span><span class="challenge75-label">'+escapeHtml(row.label)+'</span><span class="challenge75-meta">'+water.ml+' / '+water.targetMl+' ml</span></button>';
      }
      return '<button type="button" data-challenge-habit="'+escapeHtml(row.habitId||'')+'" class="challenge75-row'+(row.done?' done':'')+'"'+(row.habitId?' onclick="challenge75ToggleHabit(\''+row.habitId+'\')"':' disabled')+' aria-pressed="'+(row.done?'true':'false')+'">'
        +'<span class="challenge75-check">'+(row.done?'✓':row.icon)+'</span><span class="challenge75-label">'+escapeHtml(row.label)+'</span></button>';
    }).join('')+'</div>';
    html+='<div class="challenge75-rule-note">Walking counts toward steps, not the 45-minute workout. Recovery guidance always wins. Missed something? Continue tomorrow—never restart.</div>';
  }
  html+='</div>';
  return html;
}

// ── Dedicated 75 Me page views ─────────────────────────────────────────────
function challenge75DateKeys(){
  var challenge=getChallenge75();if(!challenge)return [];
  var keys=[];
  for(var day=habitDate(challenge.startDate);localDateKey(day)<=challenge.endDate;day=habitAddDays(day,1))keys.push(localDateKey(day));
  return keys;
}

function challenge75JourneyModel(asOfKey){
  var challenge=getChallenge75();if(!challenge)return null;
  var today=asOfKey||localDateKey(new Date());
  var cutoff=today<challenge.startDate?null:(today>challenge.endDate?challenge.endDate:today);
  var dateKeys=challenge75DateKeys(),doneChecks=0,elapsedDays=0,perfectDays=0,weeks={};
  var days=dateKeys.map(function(key,index){
    var daily=challenge75DailyStatus(key),elapsed=!!cutoff&&key<=cutoff,state='future';
    if(elapsed){
      elapsedDays++;doneChecks+=daily.done;
      if(daily.done===daily.total){state='complete';perfectDays++}
      else if(daily.done>0)state='partial';
      else state='open';
    }
    if(key===today&&challenge75Phase(today)==='active')state='current '+state;
    var wk=weekKey(habitDate(key));
    if(!weeks[wk])weeks[wk]={key:wk,dates:[],elapsedDates:[],doneChecks:0,totalChecks:0,perfectDays:0};
    weeks[wk].dates.push(key);
    if(elapsed){weeks[wk].elapsedDates.push(key);weeks[wk].doneChecks+=daily.done;weeks[wk].totalChecks+=daily.total;if(daily.done===daily.total)weeks[wk].perfectDays++}
    return {key:key,number:index+1,state:state,done:daily.done,total:daily.total};
  });
  var careerHabit=challenge75Habit('career');
  var weekRows=Object.keys(weeks).sort().map(function(key,index){
    var week=weeks[key],last=week.elapsedDates.length?week.elapsedDates[week.elapsedDates.length-1]:null;
    var career={count:0,target:3,met:false};
    if(careerHabit&&last){var progress=getHabitProgress(careerHabit,key,last);career={count:progress.count,target:progress.target||3,met:progress.met}}
    return {number:index+1,key:key,dates:week.dates,elapsed:week.elapsedDates.length,doneChecks:week.doneChecks,totalChecks:week.totalChecks,perfectDays:week.perfectDays,career:career};
  });
  return {challenge:challenge,today:today,phase:challenge75Phase(today),dayNumber:challenge75DayNumber(today),days:days,weeks:weekRows,elapsedDays:elapsedDays,remainingDays:75-elapsedDays,doneChecks:doneChecks,totalChecks:elapsedDays*7,perfectDays:perfectDays};
}

function renderChallenge75Journey(){
  var el=document.getElementById('planner-journey');if(!el)return;
  var model=challenge75JourneyModel(localDateKey(new Date()));
  if(!model){el.innerHTML='<div class="card planner-card"><div class="planner-empty-line">The 75 Me journey is not configured yet.</div></div>';return}
  var phaseLabel=model.phase==='before'?'Starts 5 October':model.phase==='after'?'Journey complete':'Day '+model.dayNumber+' of 75';
  var html='<section class="challenge-journey-hero card"><div><div class="challenge75-kicker">75 ME CHALLENGE</div><h2>Your journey</h2><p>5 October–18 December · Keep going after imperfect days.</p></div><div class="challenge-journey-phase">'+escapeHtml(phaseLabel)+'</div></section>';
  html+='<div class="challenge-journey-stats">'
    +'<div class="card"><strong>'+model.elapsedDays+'</strong><span>days elapsed</span></div>'
    +'<div class="card"><strong>'+model.perfectDays+'</strong><span>fully checked days</span></div>'
    +'<div class="card"><strong>'+model.doneChecks+(model.totalChecks?' / '+model.totalChecks:'')+'</strong><span>daily checks</span></div>'
    +'<div class="card"><strong>'+model.remainingDays+'</strong><span>days remaining</span></div>'
  +'</div>';
  html+='<section class="card planner-card challenge-calendar-card"><div class="planner-card-head"><span class="planner-card-title">The 75 days</span><span class="planner-card-hint">read-only progress</span></div>';
  html+='<div class="challenge-calendar" role="list" aria-label="75 Me Challenge calendar">'+model.days.map(function(day){
    var dateLabel=habitDate(day.key).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    return '<div role="listitem" class="challenge-calendar-day '+day.state+'" title="'+escapeHtml(dateLabel+' · '+day.done+'/'+day.total)+'" aria-label="Day '+day.number+', '+escapeHtml(dateLabel)+', '+day.done+' of '+day.total+' checks"><span>'+day.number+'</span><small>'+day.done+'/'+day.total+'</small></div>';
  }).join('')+'</div><div class="challenge-calendar-legend"><span><i class="complete"></i>7/7</span><span><i class="partial"></i>in progress</span><span><i class="open"></i>no checks</span><span><i class="future"></i>future</span></div></section>';
  html+='<section class="card planner-card challenge-weeks-card"><div class="planner-card-head"><span class="planner-card-title">Week by week</span></div><div class="challenge-week-list">'+model.weeks.map(function(week){
    var start=fmtDate(week.dates[0]),end=fmtDate(week.dates[week.dates.length-1]);
    var checks=week.elapsed?week.doneChecks+'/'+week.totalChecks:'Not started';
    var career=week.elapsed?'Career '+week.career.count+'/'+week.career.target:'Career —';
    return '<div class="challenge-week-row"><span class="challenge-week-num">W'+week.number+'</span><span class="challenge-week-dates">'+escapeHtml(start+'–'+end)+'</span><span>'+checks+'</span><span>'+career+'</span><span>'+week.perfectDays+' full day'+(week.perfectDays===1?'':'s')+'</span></div>';
  }).join('')+'</div></section>';
  html+='<section class="card planner-card challenge-rules-card"><div class="planner-card-head"><span class="planner-card-title">Your rules & guardrails</span></div><div class="challenge-rules-grid">'
    +'<div><strong>Keep going</strong><span>A missed check stays on that day. Never restart the calendar.</span></div>'
    +'<div><strong>Move safely</strong><span>Walking counts for steps, not the 45-minute workout. Clinical guidance always wins.</span></div>'
    +'<div><strong>Eat intentionally</strong><span>Whole foods and no unhealthy takeaway; planned balanced restaurant meals are allowed.</span></div>'
    +'<div><strong>Drink intentionally</strong><span>2L water daily. Alcohol only for special occasions decided in advance.</span></div>'
  +'</div></section>';
  el.innerHTML=html;
}

function renderChallenge75CareerCard(todayKey){
  var challenge=getChallenge75();if(!challenge)return '';
  var key=todayKey||localDateKey(new Date()),phase=challenge75Phase(key),career=challenge75CareerStatus(phase==='after'?challenge.endDate:key);
  var html='<section class="card planner-card challenge-career-page-card"><div class="planner-card-head"><span class="planner-card-title">💼 Career Focus</span><span class="planner-card-count">'+career.count+' / '+career.target+'</span></div>';
  html+='<div class="challenge-career-progress"><span style="width:'+Math.min(100,career.count/Math.max(1,career.target)*100)+'%"></span></div>';
  html+='<p>Three intentional blocks each week. Tailored applications, networking, CV or LinkedIn work, interview preparation and relevant skills training all count.</p>';
  if(phase==='before')html+='<div class="challenge75-rule-note">Tracking starts Monday 5 October.</div>';
  else if(phase==='after')html+='<div class="challenge75-rule-note">Final challenge week · '+career.count+'/'+career.target+' blocks recorded.</div>';
  else if(career.habit){
    if(career.met&&!career.todayDone)html+='<span class="challenge-career-met">✓ Weekly target met</span>';
    else html+='<button type="button" data-challenge-habit="'+escapeHtml(career.habit.id)+'" class="btn '+(career.todayDone?'btn-ghost':'btn-accent')+'" onclick="challenge75ToggleHabit(\''+career.habit.id+'\')">'+(career.todayDone?'Undo today\'s block':'Log a Career Focus block')+'</button>';
  }
  html+='</section>';
  return html;
}
