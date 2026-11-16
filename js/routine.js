// Routine R2 (from Mon 16 Nov 2026): which house this week, the Sunday plan,
// and the AWS AI Practitioner study tracker. Zero-guilt throughout: counts go
// up, nothing is ever marked missed or overdue, and a skipped day costs nothing.
(function(global){
  'use strict';

  var ROUTINE_START='2026-11-16';
  var SUNDAY_ITEMS=[
    {id:'gym-slots',label:'Get Martin’s shifts and put 4 gym slots in your calendar'},
    {id:'study-blocks',label:'Put 4 study blocks in your calendar (14:00)'},
    {id:'lunches',label:'Plan lunches and do the shop'},
    {id:'kit',label:'Pack gym kit for the house you’re going to'},
    {id:'review',label:'Review the week with Martin'}
  ];
  var STUDY_DEFAULTS={
    version:1,
    goal:{id:'aws-aif-c01',label:'AWS AI Practitioner (AIF-C01)',examDate:'2026-12-17',examBooked:false,slot:'14:00',backupSlot:'16:15'},
    course:{label:'Ultimate AWS Certified AI Practitioner AIF-C01',sectionsTotal:14,sectionsDone:0},
    sessions:{},
    practiceScores:[]
  };
  var STUDY_WEEKS=[
    {from:'2026-11-16',to:'2026-11-22',focus:'Book the exam. First quarter of the course'},
    {from:'2026-11-23',to:'2026-11-29',focus:'Second quarter of the course'},
    {from:'2026-11-30',to:'2026-12-06',focus:'Third quarter of the course'},
    {from:'2026-12-07',to:'2026-12-13',focus:'Final quarter. Fri 11: the practice exam in the course'},
    {from:'2026-12-14',to:'2026-12-20',focus:'Mon–Tue: full practice exams. Wed: review wrong answers. Thu 17: exam'}
  ];

  function esc(value){return typeof escapeHtml==='function'?escapeHtml(String(value==null?'':value)):String(value==null?'':value)}
  function clone(value){return JSON.parse(JSON.stringify(value))}
  function keyOf(value){return typeof value==='string'?value:localDateKey(value||new Date())}
  function todayKey(){return localDateKey(new Date())}
  function addDays(key,amount){var d=new Date(key+'T12:00:00');d.setDate(d.getDate()+amount);return localDateKey(d)}
  function dayDiff(a,b){var x=a.split('-').map(Number),y=b.split('-').map(Number);return Math.round((Date.UTC(y[0],y[1]-1,y[2])-Date.UTC(x[0],x[1]-1,x[2]))/86400000)}
  function mondayOf(key){var d=new Date(key+'T12:00:00');return addDays(key,-((d.getDay()+6)%7))}
  function plan(){return global.DAILY_BASICS_RECURRING_PLAN_R2||null}
  function newId(prefix){return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
  function shortDate(key){return new Date(key+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}

  function commit(snapshot,domain,action){
    if(typeof saveStateOrRollback==='function'&&!saveStateOrRollback(snapshot))return false;
    if(typeof emitLifeHubChange==='function')emitLifeHubChange({action:action,domains:[domain],source:'routine',rendered:true});
    if(typeof refreshPlannerCards==='function')refreshPlannerCards(domain==='study'?['study','now']:['training','sunday','now']);
    return true;
  }

  // ── Where am I this week ─────────────────────────────────
  // Stays switch on Sundays and alternate from the anchor; any stay can be
  // flipped by hand (Christmas, shift changes) and the flip is stored per stay.
  function ensureRoutine(){if(!STATE.routine||typeof STATE.routine!=='object'||Array.isArray(STATE.routine))STATE.routine={version:1,stays:{},sundayPlans:{}};if(!STATE.routine.stays)STATE.routine.stays={};if(!STATE.routine.sundayPlans)STATE.routine.sundayPlans={};return STATE.routine}
  function routineStayStart(value){var key=keyOf(value),d=new Date(key+'T12:00:00');return addDays(key,-d.getDay())}
  function routineLocation(value){
    var p=plan(),start=routineStayStart(value),stays=STATE.routine&&STATE.routine.stays||{};if(!p)return null;
    var stored=stays[start],anchor=p.locationAnchor,weeks=Math.round(dayDiff(anchor.stayStart,start)/7),other=anchor.location==='home'?'martin':'home',key=stored==='home'||stored==='martin'?stored:(Math.abs(weeks)%2===0?anchor.location:other);
    return Object.assign({stayStart:start,overridden:!!stored},clone(p.locations[key]));
  }
  function setRoutineLocation(value,location){
    if(location!=='home'&&location!=='martin')return false;var snapshot=clone(STATE),routine=ensureRoutine(),start=routineStayStart(value);
    routine.stays[start]=location;return commit(snapshot,'routine','routine-location');
  }
  function toggleRoutineLocation(value){var current=routineLocation(value);return current?setRoutineLocation(value,current.key==='home'?'martin':'home'):false}

  // ── Sunday plan ──────────────────────────────────────────
  function sundayPlan(value){var key=keyOf(value),stored=STATE.routine&&STATE.routine.sundayPlans&&STATE.routine.sundayPlans[key]||{};return SUNDAY_ITEMS.map(function(item){return {id:item.id,label:item.label,done:stored[item.id]===true}})}
  function toggleSundayItem(value,itemId){
    var key=keyOf(value);if(!SUNDAY_ITEMS.some(function(item){return item.id===itemId}))return false;var snapshot=clone(STATE),routine=ensureRoutine(),row=routine.sundayPlans[key]||{};
    if(row[itemId])delete row[itemId];else row[itemId]=true;if(Object.keys(row).length)routine.sundayPlans[key]=row;else delete routine.sundayPlans[key];return commit(snapshot,'routine','routine-sunday');
  }

  // ── Study tracker ────────────────────────────────────────
  function ensureStudy(){
    if(!STATE.study||typeof STATE.study!=='object'||Array.isArray(STATE.study))STATE.study=clone(STUDY_DEFAULTS);
    var s=STATE.study;if(!s.goal)s.goal=clone(STUDY_DEFAULTS.goal);if(!s.course)s.course=clone(STUDY_DEFAULTS.course);if(!s.sessions||typeof s.sessions!=='object')s.sessions={};if(!Array.isArray(s.practiceScores))s.practiceScores=[];return s;
  }
  function studyState(){return STATE.study&&STATE.study.goal?STATE.study:clone(STUDY_DEFAULTS)}
  function studySessionsOn(key){var sessions=studyState().sessions||{};return Object.keys(sessions).map(function(id){return sessions[id]}).filter(function(s){return s&&s.date===key})}
  function studyMinutesOn(key){return studySessionsOn(key).reduce(function(sum,s){return sum+Number(s.minutes||0)},0)}
  function studyWeek(value){
    var key=keyOf(value),monday=mondayOf(key),days=[];for(var i=0;i<7;i++){var day=addDays(monday,i),minutes=studyMinutesOn(day);if(minutes>0)days.push({date:day,minutes:minutes})}
    var count=days.length,label=count>=4?'Great week':count>=3?'Good week':'';return {monday:monday,count:count,target:4,label:label,days:days};
  }
  function studyFocusFor(value){var key=keyOf(value);return STUDY_WEEKS.find(function(w){return key>=w.from&&key<=w.to})||null}
  function logStudyMinutes(minutes,kind){
    var n=Math.round(Number(minutes));if(!Number.isFinite(n)||n<=0||n>600)return false;if(['course','practice','review'].indexOf(kind||'course')===-1)return false;
    var snapshot=clone(STATE),study=ensureStudy(),id=newId('study');study.sessions[id]={id:id,date:todayKey(),minutes:n,kind:kind||'course',loggedAt:new Date().toISOString()};
    if(!commit(snapshot,'study','study-log'))return false;if(typeof showCelebrationToast==='function')showCelebrationToast(n>=45?'Study block logged':'Minimum study logged — it counts','📘');return true;
  }
  function undoTodayStudy(){
    var today=todayKey(),rows=studySessionsOn(today).sort(function(a,b){return String(b.loggedAt||'').localeCompare(String(a.loggedAt||''))});if(!rows.length)return false;
    var snapshot=clone(STATE),study=ensureStudy();delete study.sessions[rows[0].id];return commit(snapshot,'study','study-undo');
  }
  function changeStudySections(delta){
    var snapshot=clone(STATE),study=ensureStudy(),total=Number(study.course.sectionsTotal||14),next=Math.max(0,Math.min(total,Number(study.course.sectionsDone||0)+Number(delta||0)));
    if(next===study.course.sectionsDone){STATE=snapshot;return false}study.course.sectionsDone=next;return commit(snapshot,'study','study-sections');
  }
  function addPracticeScore(percent,label){
    var n=Math.round(Number(percent));if(!Number.isFinite(n)||n<0||n>100)return false;var snapshot=clone(STATE),study=ensureStudy();
    study.practiceScores.unshift({id:newId('score'),date:todayKey(),percent:n,label:String(label||'Practice exam').slice(0,80)});study.practiceScores=study.practiceScores.slice(0,30);return commit(snapshot,'study','study-score');
  }
  function setExamBooked(booked){var snapshot=clone(STATE),study=ensureStudy();study.goal.examBooked=!!booked;return commit(snapshot,'study','study-exam')}

  // ── Planner cards ────────────────────────────────────────
  function routineWeekChip(value){
    var week=typeof rotationWeek==='function'?rotationWeek(value):null;if(!week)return '';
    return '<span class="pw-train-badge routine-week-chip">'+week.count+' of '+week.target+' this week'+(week.label?' · '+esc(week.label):'')+'</span>';
  }
  function routineLocationLine(value){
    var loc=routineLocation(value);if(!loc)return '';
    return '<div class="routine-location"><span>'+esc(loc.label)+' · <strong>'+esc(loc.gym)+'</strong></span><button type="button" class="routine-link" onclick="toggleRoutineLocation(\''+keyOf(value)+'\')" aria-label="Switch this week to '+(loc.key==='home'?'Martin’s':'home')+'">Switch</button></div>';
  }
  function routineSundayCard(value){
    var key=keyOf(value);if(key<ROUTINE_START&&key!=='2026-11-15')return '';if(new Date(key+'T12:00:00').getDay()!==0)return '';
    var items=sundayPlan(key),done=items.filter(function(i){return i.done}).length,next=routineLocation(addDays(key,1));
    var html='<div class="card planner-card routine-sunday-card" id="planner-sunday-card"><div class="planner-card-head"><span class="planner-card-title">Plan the week</span><span class="planner-card-count">'+done+'/'+items.length+'</span></div>';
    html+='<div class="routine-sub">'+(next?'This week: '+esc(next.label)+' · '+esc(next.gym):'')+'</div><div class="planner-focus-list">';
    items.forEach(function(item){html+='<div class="focus-row'+(item.done?' done':'')+'"><button type="button" class="focus-check" data-planner-control="sunday:'+item.id+'" onclick="toggleSundayItem(\''+key+'\',\''+item.id+'\')" aria-pressed="'+(item.done?'true':'false')+'" aria-label="'+esc(item.label)+'">'+(item.done?'✓':'')+'</button><span class="focus-text">'+esc(item.label)+'</span></div>'});
    return html+'</div></div>';
  }
  function routineStudyCard(value){
    var key=keyOf(value),study=studyState(),goal=study.goal;if(key<ROUTINE_START||key>goal.examDate)return '';
    var week=studyWeek(key),minutes=studyMinutesOn(key),focus=studyFocusFor(key),sections=study.course,scores=study.practiceScores||[],examDay=key===goal.examDate;
    var html='<div class="card planner-card routine-study-card" id="planner-study-card"><div class="planner-card-head"><span class="planner-card-title">AWS AI Practitioner</span><span class="pw-train-badge routine-study-chip">'+week.count+' of 4 study days'+(week.label?' · '+esc(week.label):'')+'</span></div>';
    html+='<div class="routine-sub">'+(examDay?'Exam today. You’ve got this.':'Study block '+esc(goal.slot)+' (backup '+esc(goal.backupSlot)+') · exam '+esc(shortDate(goal.examDate)))+'</div>';
    if(focus)html+='<div class="routine-focus">This week: '+esc(focus.focus)+'</div>';
    html+='<div class="planner-train-actions">';
    if(minutes>0)html+='<span class="planner-train-done">Today: '+minutes+' min ✓</span><button type="button" class="btn btn-sm btn-ghost" data-planner-control="study:undo" onclick="undoTodayStudy()">Undo last</button><button type="button" class="btn btn-sm btn-ghost" data-planner-control="study:more" onclick="logStudyMinutes(45,\'course\')">+45 min</button>';
    else html+='<button type="button" class="btn btn-sm pw-train-log-btn" data-planner-control="study:45" onclick="logStudyMinutes(45,\'course\')">Log 45 min</button><button type="button" class="btn btn-sm btn-ghost" data-planner-control="study:15" onclick="logStudyMinutes(15,\'course\')">Log 15 min (minimum)</button>';
    html+='</div><details class="routine-more" id="routine-study-details"'+(studyDetailsOpen?' open':'')+' ontoggle="routineStudyDetailsToggled(this.open)"><summary>Course progress · '+Number(sections.sectionsDone||0)+' of '+Number(sections.sectionsTotal||14)+' sections'+(goal.examBooked?'':' · exam not booked yet')+'</summary><div class="routine-study-row"><span>Course sections</span><div class="wa-stepper"><button type="button" data-planner-control="study:sec-minus" onclick="changeStudySections(-1)" aria-label="One section fewer">−</button><span class="routine-count">'+Number(sections.sectionsDone||0)+' / '+Number(sections.sectionsTotal||14)+'</span><button type="button" data-planner-control="study:sec-plus" onclick="changeStudySections(1)" aria-label="One more section done">+</button></div></div>';
    html+='<div class="routine-study-row"><label for="routine-score-input">Practice score</label><div class="routine-score-add"><input id="routine-score-input" type="number" min="0" max="100" inputmode="numeric" placeholder="%" onkeydown="if(event.key===\'Enter\')routineAddScoreFromInput()"><button type="button" class="btn btn-sm btn-ghost" data-planner-control="study:score" onclick="routineAddScoreFromInput()">Add</button></div></div>';
    if(scores.length)html+='<div class="routine-scores">'+scores.slice(0,3).map(function(s){return '<span>'+esc(shortDate(s.date))+' · <strong>'+Number(s.percent)+'%</strong></span>'}).join('')+'</div>';
    html+='<label class="routine-booked"><input type="checkbox" data-planner-control="study:booked" '+(goal.examBooked?'checked ':'')+'onchange="setExamBooked(this.checked)"> Exam booked</label></details>';
    return html+'</div>';
  }
  var studyDetailsOpen=false;
  function routineStudyDetailsToggled(open){studyDetailsOpen=!!open}
  function routineAddScoreFromInput(){var input=document.getElementById('routine-score-input');if(!input||input.value==='')return false;var ok=addPracticeScore(input.value);if(ok)input.value='';return ok}

  // ── Now card ─────────────────────────────────────────────
  // One suggestion for this moment, with one button. Workout first before 14:00
  // and after 17:00, study first in the afternoon, close the day from 21:00.
  // Returns '' when nothing is waiting, so the card never nags.
  function routineNowChoice(value,hourOverride){
    var key=keyOf(value),hour=typeof hourOverride==='number'?hourOverride:new Date().getHours();if(key<ROUTINE_START||key!==todayKey())return null;
    if(hour>=21){var st=typeof sweepState==='function'?sweepState(key):null;return st&&st.step==='summary'?null:{kind:'close'}}
    var week=typeof rotationWeek==='function'?rotationWeek(key):null,doneToday=!!(week&&week.sessions.some(function(s){return s.date===key}));
    var occ=typeof effectiveWinterArcOccurrence==='function'?effectiveWinterArcOccurrence(key):null,session=typeof winterArcCurrentSessionForDate==='function'?winterArcCurrentSessionForDate(key):null;
    var workout=occ&&occ.kind!=='rest'&&!doneToday&&(!week||week.count<week.target||!!session)?{kind:'workout',occurrence:occ,inProgress:!!(session&&session.status==='in-progress')}:null;
    var dow=new Date(key+'T12:00:00').getDay(),study=studyState(),studyOpen=dow>=1&&dow<=5&&key<=study.goal.examDate&&studyMinutesOn(key)===0?{kind:'study'}:null;
    if(workout&&workout.inProgress)return workout;
    return hour>=14&&hour<17?(studyOpen||workout):(workout||studyOpen);
  }
  function routineNowCard(value,hourOverride){
    var key=keyOf(value),choice=routineNowChoice(key,hourOverride);if(!choice)return '';
    var html='<div class="card planner-card planner-now-card" id="planner-now-card"><div class="planner-now-kicker">Now</div>';
    if(choice.kind==='workout'){
      var occ=choice.occurrence,loc=routineLocation(key);
      html+='<div class="planner-now-title">'+esc(occ.label)+(loc?' · '+esc(loc.gym):'')+'</div><div class="routine-sub">'+(occ.code==='MIN-CARDIO'||occ.kind!=='strength'?'About '+Number(occ.durationMin||20)+' minutes.':'About '+Number(occ.durationMin||55)+' minutes. 20 minutes counts too.')+'</div>';
      html+='<div class="planner-train-actions"><button type="button" class="btn btn-sm pw-train-log-btn" data-planner-control="now:workout" onclick="openWinterArcWorkout(\''+key+'\')">'+(choice.inProgress?'Resume workout':'Start workout')+'</button></div>';
    }else if(choice.kind==='study'){
      html+='<div class="planner-now-title">AWS study block</div><div class="routine-sub">45 minutes. 15 counts too.</div>';
      html+='<div class="planner-train-actions"><button type="button" class="btn btn-sm pw-train-log-btn" data-planner-control="now:study45" onclick="logStudyMinutes(45,\'course\')">Log 45 min</button><button type="button" class="btn btn-sm btn-ghost" data-planner-control="now:study15" onclick="logStudyMinutes(15,\'course\')">Log 15 min</button></div>';
    }else{
      html+='<div class="planner-now-title">Close the day</div><div class="routine-sub">Two minutes to log today and set up tomorrow.</div>';
      html+='<div class="planner-train-actions"><button type="button" class="btn btn-sm pw-train-log-btn" data-planner-control="now:close" onclick="openCloseDayModal()">Close the day</button></div>';
    }
    return html+'</div>';
  }

  // ── Check-in card: one-tap mood, plus a weekly weigh-in ──
  var MOOD_FACES=['😞','😐','🙂','😊','🤩'],MOOD_LABELS=['Low','Flat','Okay','Good','Great'];
  function weighInThisWeek(key){var monday=mondayOf(key);return (((STATE.metrics||{}).weight)||[]).some(function(w){return w&&w.date>=monday&&w.date<=key})}
  function routineCheckinCard(value){
    var key=keyOf(value);if(key!==todayKey())return '';
    var mood=Number(((STATE.mood||{})[key]||{}).mood||0),needsWeight=key>=ROUTINE_START&&!weighInThisWeek(key);if(mood&&!needsWeight)return '';
    var html='<div class="card planner-card planner-checkin-card" id="planner-checkin-card">';
    if(!mood)html+='<div class="routine-checkin-row"><span class="routine-checkin-label">Mood</span><div class="dash-mood-mini-row" aria-label="Log today\'s mood">'+MOOD_FACES.map(function(face,i){return '<button type="button" class="dash-mood-mini-btn" data-planner-control="mood:'+(i+1)+'" aria-label="Log mood as '+MOOD_LABELS[i]+'" onclick="routineLogMood('+(i+1)+')">'+face+'</button>'}).join('')+'</div></div>';
    if(needsWeight)html+='<div class="routine-checkin-row"><label class="routine-checkin-label" for="routine-weight-input">Weekly weigh-in</label><div class="routine-score-add"><input id="routine-weight-input" type="number" min="30" max="300" step="0.1" inputmode="decimal" placeholder="kg" onkeydown="if(event.key===\'Enter\')routineSaveWeighIn()"><button type="button" class="btn btn-sm btn-ghost" data-planner-control="weight:save" onclick="routineSaveWeighIn()">Save</button></div></div>';
    return html+'</div>';
  }
  function routineLogMood(value){
    var v=Number(value);if(!(v>=1&&v<=5)||typeof quickLogMood!=='function')return false;quickLogMood(v,todayKey());
    if(typeof refreshPlannerCards==='function')refreshPlannerCards(['checkin'],{includeInputCards:true});return true;
  }
  function routineSaveWeighIn(){
    var input=document.getElementById('routine-weight-input'),v=Math.round(Number(input&&input.value)*10)/10;if(!input||input.value===''||!Number.isFinite(v)||v<30||v>300)return false;
    var snapshot=clone(STATE);if(!STATE.metrics||typeof STATE.metrics!=='object')STATE.metrics={};if(!Array.isArray(STATE.metrics.weight))STATE.metrics.weight=[];
    STATE.metrics.weight.push({id:newId('w'),date:todayKey(),value:v,note:''});
    if(typeof saveStateOrRollback==='function'&&!saveStateOrRollback(snapshot))return false;
    if(typeof emitLifeHubChange==='function')emitLifeHubChange({action:'weight-create',domains:['metrics'],source:'routine',rendered:true});
    if(typeof refreshPlannerCards==='function')refreshPlannerCards(['checkin'],{includeInputCards:true});
    if(typeof showCelebrationToast==='function')showCelebrationToast('Weigh-in saved','⚖️');return true;
  }

  // ── Reminders: three nudges a day ────────────────────────
  var REMINDER_DEFAULTS=[
    {id:'plan',label:'Plan the day',emoji:'🗓️',message:'Open Today and pick the next thing.',hour:8,minute:30,enabled:true,condition:'none'},
    {id:'study',label:'Study block',emoji:'📘',message:'45 minutes of AWS. 15 counts.',hour:14,minute:0,enabled:true,condition:'none'},
    {id:'close',label:'Close the day',emoji:'🌙',message:'Two minutes to log today and set up tomorrow.',hour:21,minute:0,enabled:true,condition:'none'}
  ];
  var REMINDERS_DISMISS_KEY='lh_reminders_card_dismissed';
  function remindersDismissed(){try{return localStorage.getItem(REMINDERS_DISMISS_KEY)==='1'}catch(e){return false}}
  function remindersOn(){return typeof Notification!=='undefined'&&Notification.permission==='granted'&&(STATE.reminders||[]).some(function(r){return r&&r.enabled})}
  function routineRemindersCard(){
    if(remindersOn()||remindersDismissed())return '';
    var supported=typeof Notification!=='undefined',blocked=supported&&Notification.permission==='denied';
    var html='<div class="card planner-card planner-reminders-card" id="planner-reminders-card"><div class="planner-card-head"><span class="planner-card-title">Reminders</span></div>';
    if(!supported)html+='<div class="routine-sub">To get reminders on your phone, add Life Hub to your Home Screen and open it from there.</div>';
    else if(blocked)html+='<div class="routine-sub">Notifications are blocked for Life Hub on this device. Allow them in your browser or system settings, then reopen the app.</div>';
    else html+='<div class="routine-sub">Three nudges a day: 08:30 plan the day, 14:00 study block, 21:00 close the day.</div>';
    html+='<div class="planner-train-actions">'+(supported&&!blocked?'<button type="button" class="btn btn-sm pw-train-log-btn" data-planner-control="reminders:on" onclick="routineEnableReminders()">Turn on reminders</button>':'')+'<button type="button" class="btn btn-sm btn-ghost" data-planner-control="reminders:dismiss" onclick="routineDismissReminders()">Not now</button></div>';
    return html+'</div>';
  }
  function routineDismissReminders(){try{localStorage.setItem(REMINDERS_DISMISS_KEY,'1')}catch(e){}if(typeof renderPlanner==='function')renderPlanner();return true}
  function routineSeedReminders(){
    if((STATE.reminders||[]).some(function(r){return r&&r.enabled}))return false;
    var snapshot=clone(STATE),existing=Array.isArray(STATE.reminders)?STATE.reminders:[],ids=existing.map(function(r){return r&&r.id});
    STATE.reminders=existing.concat(clone(REMINDER_DEFAULTS).filter(function(r){return ids.indexOf(r.id)===-1}));
    STATE.reminders.forEach(function(r){if(r&&REMINDER_DEFAULTS.some(function(d){return d.id===r.id}))r.enabled=true});
    if(typeof saveStateOrRollback==='function'&&!saveStateOrRollback(snapshot))return false;return true;
  }
  function routineEnableReminders(){
    if(typeof Notification==='undefined')return Promise.resolve(false);
    return Promise.resolve(Notification.requestPermission()).then(function(permission){
      if(permission!=='granted'){if(typeof renderPlanner==='function')renderPlanner();return false}
      routineSeedReminders();
      if(typeof setupReminders==='function')setupReminders();
      if(typeof syncRemindersToBackend==='function')syncRemindersToBackend();
      if(typeof renderPlanner==='function')renderPlanner();return true;
    });
  }

  global.routineNowChoice=routineNowChoice;global.routineNowCard=routineNowCard;global.routineCheckinCard=routineCheckinCard;global.routineLogMood=routineLogMood;global.routineSaveWeighIn=routineSaveWeighIn;
  global.ROUTINE_REMINDER_DEFAULTS=REMINDER_DEFAULTS;global.routineRemindersCard=routineRemindersCard;global.routineDismissReminders=routineDismissReminders;global.routineSeedReminders=routineSeedReminders;global.routineEnableReminders=routineEnableReminders;
  global.ROUTINE_START=ROUTINE_START;global.ROUTINE_SUNDAY_ITEMS=SUNDAY_ITEMS;
  global.routineStayStart=routineStayStart;global.routineLocation=routineLocation;global.setRoutineLocation=setRoutineLocation;global.toggleRoutineLocation=toggleRoutineLocation;
  global.sundayPlan=sundayPlan;global.toggleSundayItem=toggleSundayItem;
  global.studyWeek=studyWeek;global.studyMinutesOn=studyMinutesOn;global.studyFocusFor=studyFocusFor;global.logStudyMinutes=logStudyMinutes;global.undoTodayStudy=undoTodayStudy;global.changeStudySections=changeStudySections;global.addPracticeScore=addPracticeScore;global.setExamBooked=setExamBooked;global.routineAddScoreFromInput=routineAddScoreFromInput;global.routineStudyDetailsToggled=routineStudyDetailsToggled;
  global.routineWeekChip=routineWeekChip;global.routineLocationLine=routineLocationLine;global.routineSundayCard=routineSundayCard;global.routineStudyCard=routineStudyCard;
})(typeof window!=='undefined'?window:globalThis);
