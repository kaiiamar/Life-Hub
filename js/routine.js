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
    if(typeof refreshPlannerCards==='function')refreshPlannerCards(domain==='study'?['study']:['training','sunday']);
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
    html+='</div><div class="routine-study-row"><span>Course sections</span><div class="wa-stepper"><button type="button" data-planner-control="study:sec-minus" onclick="changeStudySections(-1)" aria-label="One section fewer">−</button><span class="routine-count">'+Number(sections.sectionsDone||0)+' / '+Number(sections.sectionsTotal||14)+'</span><button type="button" data-planner-control="study:sec-plus" onclick="changeStudySections(1)" aria-label="One more section done">+</button></div></div>';
    html+='<div class="routine-study-row"><label for="routine-score-input">Practice score</label><div class="routine-score-add"><input id="routine-score-input" type="number" min="0" max="100" inputmode="numeric" placeholder="%" onkeydown="if(event.key===\'Enter\')routineAddScoreFromInput()"><button type="button" class="btn btn-sm btn-ghost" data-planner-control="study:score" onclick="routineAddScoreFromInput()">Add</button></div></div>';
    if(scores.length)html+='<div class="routine-scores">'+scores.slice(0,3).map(function(s){return '<span>'+esc(shortDate(s.date))+' · <strong>'+Number(s.percent)+'%</strong></span>'}).join('')+'</div>';
    html+='<label class="routine-booked"><input type="checkbox" data-planner-control="study:booked" '+(goal.examBooked?'checked ':'')+'onchange="setExamBooked(this.checked)"> Exam booked</label>';
    return html+'</div>';
  }
  function routineAddScoreFromInput(){var input=document.getElementById('routine-score-input');if(!input||input.value==='')return false;var ok=addPracticeScore(input.value);if(ok)input.value='';return ok}

  global.ROUTINE_START=ROUTINE_START;global.ROUTINE_SUNDAY_ITEMS=SUNDAY_ITEMS;
  global.routineStayStart=routineStayStart;global.routineLocation=routineLocation;global.setRoutineLocation=setRoutineLocation;global.toggleRoutineLocation=toggleRoutineLocation;
  global.sundayPlan=sundayPlan;global.toggleSundayItem=toggleSundayItem;
  global.studyWeek=studyWeek;global.studyMinutesOn=studyMinutesOn;global.studyFocusFor=studyFocusFor;global.logStudyMinutes=logStudyMinutes;global.undoTodayStudy=undoTodayStudy;global.changeStudySections=changeStudySections;global.addPracticeScore=addPracticeScore;global.setExamBooked=setExamBooked;global.routineAddScoreFromInput=routineAddScoreFromInput;
  global.routineWeekChip=routineWeekChip;global.routineLocationLine=routineLocationLine;global.routineSundayCard=routineSundayCard;global.routineStudyCard=routineStudyCard;
})(typeof window!=='undefined'?window:globalThis);
