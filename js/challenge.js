// ============================================================
// 75 INTENTIONAL DAYS
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
  if(phase==='before')return {phase:phase,text:'75 Intentional Days · starts '+fmtDate(challenge.startDate)};
  if(phase==='after')return {phase:phase,text:'75 Intentional Days · closed '+fmtDate(challenge.startDate)+'–'+fmtDate(challenge.endDate)};
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
  if(typeof refreshPlannerCards==='function')refreshPlannerCards(['challenge','habits','welcome','sweep','short']);
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
  html+='<div class="challenge75-head"><div><div class="challenge75-kicker">75 INTENTIONAL DAYS</div><div class="challenge75-title">'+escapeHtml(challenge.title||'75 Intentional Days')+'</div></div>';
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
    var daily=challenge75DailyStatus(key),career=challenge75CareerStatus(key);
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
    html+='<div class="challenge75-career"><div><strong>💼 Career Focus</strong><span>Applications · networking · CV/LinkedIn · interviews · skills training</span></div>';
    if(career.habit){
      if(career.met&&!career.todayDone)html+='<span class="challenge75-career-count done">✓ '+career.count+'/'+career.target+'</span>';
      else html+='<button type="button" data-challenge-habit="'+escapeHtml(career.habit.id)+'" class="challenge75-career-count'+(career.todayDone?' done':'')+'" onclick="challenge75ToggleHabit(\''+career.habit.id+'\')">'+(career.todayDone?'✓ ':'')+career.count+'/'+career.target+'</button>';
    }
    html+='</div>';
    html+='<div class="challenge75-rule-note">Walking counts toward steps, not the 45-minute workout. Planned balanced restaurant meals and pre-decided special occasions are allowed. Missed something? Continue tomorrow—never restart.</div>';
  }
  html+='</div>';
  return html;
}
