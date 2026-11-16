var DAILY_BASICS_EFFECTIVE_DATE='2026-11-02';
var DAILY_STEPS_TARGET=8000;
var DAILY_WATER_TARGET_ML=2000;
var RETIRED_75_EVENT_IDS=new Set(['75-day-challenge-2026-10-03','75-day-challenge-2026-10-05']);
var RETIRED_CHALLENGE_HABIT_IDS=new Set(['challenge-45min-movement-v1','challenge-duolingo-v1','challenge-manna-v1','challenge-whole-food-v1','challenge-alcohol-rule-v1']);

function isRetired75TrainingEvent(event){return !!(event&&RETIRED_75_EVENT_IDS.has(event.id))}
function _dailyBasicsClone(value){return JSON.parse(JSON.stringify(value))}
function _dailyBasicsValidDate(value){if(typeof _validDateKey==='function')return _validDateKey(value);var key=String(value||''),parts=key.split('-').map(Number),date=new Date(key+'T12:00:00');return /^\d{4}-\d{2}-\d{2}$/.test(key)&&date.getFullYear()===parts[0]&&date.getMonth()===parts[1]-1&&date.getDate()===parts[2]}
function _dailyBasicsHabitOwned(habit){return !!(habit&&(habit.id==='steps-towards-10k-v1'||habit.managedBy==='lifehub'&&habit.managedHabitKey==='daily-basics.steps'))}

function resolveManagedStepsHabit(state,options){
  state=state||STATE;options=options||{};var habits=Array.isArray(state.habits)?state.habits:[],fixed=habits.find(function(h){return h&&h.id==='steps-towards-10k-v1'});
  var candidates=habits.filter(function(h){return h&&(h.id==='steps-towards-10k-v1'||h.managedBy==='lifehub'&&h.managedHabitKey==='daily-basics.steps')});
  if(fixed)return {ok:true,habit:fixed,duplicates:candidates.filter(function(h){return h!==fixed})};
  if(candidates.length>1)return {ok:false,code:'ambiguous-steps-owner',message:'More than one managed Steps habit was found.'};
  if(candidates.length===1)return {ok:true,habit:candidates[0],duplicates:[]};
  if(!options.create)return {ok:true,habit:null,duplicates:[]};
  var habit={id:'steps-towards-10k-v1',name:'8,000 steps',freq:'daily',badge:'fit',icon:'👟',note:'Build up gradually and split walking into comfortable bouts. A lower-step recovery day is not a failure; scale back if symptoms increase.',anchor:'anytime',detailsTitle:'A gentle daily minimum',details:[{name:'Build gradually',spec:'Increase only while the hip stays comfortable'},{name:'Minimum 8,000 steps',spec:'A guide, never something to force through pain'},{name:'Symptoms increase',spec:'Scale back and follow your physiotherapist or GP advice'}],startDate:DAILY_BASICS_EFFECTIVE_DATE,lifecycle:{version:1,inactivePeriods:[]},integrationKeys:[],managedBy:'lifehub',managedHabitKey:'daily-basics.steps',managedHabitVersion:1,provenanceVersion:1,logProvenance:{},logs:{}};
  habits.push(habit);state.habits=habits;return {ok:true,habit:habit,duplicates:[]};
}

function normalizeManagedStepsLifecycle(habit,firstMigration){
  if(!habit.lifecycle||habit.lifecycle.version!==1||!Array.isArray(habit.lifecycle.inactivePeriods))habit.lifecycle={version:1,inactivePeriods:[]};
  if(firstMigration)habit.lifecycle.inactivePeriods=habit.lifecycle.inactivePeriods.filter(function(range){return !(range&&range.kind==='archived'&&range.to===null&&(range.from==='2026-10-05'||range.from==='2026-12-19'))});
  var dates=[habit.startDate,DAILY_BASICS_EFFECTIVE_DATE].filter(_dailyBasicsValidDate);
  Object.keys(habit.logs||{}).concat(Object.keys(habit.logProvenance||{})).forEach(function(key){if(_dailyBasicsValidDate(key))dates.push(key)});
  dates.sort();habit.startDate=dates[0]||DAILY_BASICS_EFFECTIVE_DATE;return habit;
}
function _archiveManagedHabit(habit,dateKey){
  if(!habit)return;ensureHabitProvenance(habit);ensureHabitLifecycle(habit);
  var ranges=(habit.lifecycle.inactivePeriods||[]).filter(function(range){return range&&range.from<dateKey}).map(function(range){var copy=_dailyBasicsClone(range);if(copy.to===null||copy.to>dateKey)copy.to=dateKey;return copy}).filter(function(range){return range.to===null||range.to>range.from});
  ranges.sort(function(a,b){return a.from.localeCompare(b.from)||String(a.to||'').localeCompare(String(b.to||''))});ranges.push({kind:'archived',from:dateKey,to:null});habit.lifecycle.inactivePeriods=ranges;
}
function _stripRetiredChallengeSources(habit){
  Object.keys(habit.logProvenance||{}).forEach(function(dateKey){var entry=habit.logProvenance[dateKey];if(!entry||!entry.sources)return;Object.keys(entry.sources).forEach(function(source){if(/^challenge:winter-arc-75-me-v1__/.test(source))delete entry.sources[source]})});projectHabitLogs(habit);
}

function _setBasicSource(habit,dateKey,present){var source='basics:steps__'+dateKey,entry=habit.logProvenance[dateKey]||{sources:{}};if(!entry.sources||typeof entry.sources!=='object'||Array.isArray(entry.sources))entry.sources={};if(present)entry.sources[source]=true;else delete entry.sources[source];if(entry.manual===true||Object.keys(entry.sources).length)habit.logProvenance[dateKey]=entry;else delete habit.logProvenance[dateKey];projectHabitLogs(habit)}
function reconcileDailyBasicsState(targetState){
  var state=targetState||STATE,before=_dailyBasicsClone(state),firstMigration=state.__dailyBasicsV1!==true;if(!Array.isArray(state.habits))state.habits=[];
  var resolved=resolveManagedStepsHabit(state,{create:true});if(!resolved.ok)return resolved;if(typeof normalizeLifeHubHabits==='function')normalizeLifeHubHabits(state);var habit=resolved.habit;
  ensureHabitProvenance(habit);normalizeManagedStepsLifecycle(habit,firstMigration||habit.managedHabitVersion!==1);
  habit.name='8,000 steps';habit.freq='daily';habit.badge='fit';habit.icon='👟';habit.anchor='anytime';habit.note='Build up gradually and split walking into comfortable bouts. A lower-step recovery day is not a failure; scale back if symptoms increase.';habit.detailsTitle='A gentle daily minimum';habit.details=[{name:'Build gradually',spec:'Increase only while the hip stays comfortable'},{name:'Minimum 8,000 steps',spec:'A guide, never something to force through pain'},{name:'Symptoms increase',spec:'Scale back and follow your physiotherapist or GP advice'}];habit.managedBy='lifehub';habit.managedHabitKey='daily-basics.steps';habit.managedHabitVersion=1;
  habit.integrationKeys=(habit.integrationKeys||[]).filter(function(key){return key!=='lifehub.steps.10000'&&key!=='lifehub.steps.8000'});habit.integrationKeys.push('lifehub.steps.8000');
  resolved.duplicates.forEach(function(duplicate){_archiveManagedHabit(duplicate,DAILY_BASICS_EFFECTIVE_DATE);duplicate.managedHabitKey='retired.daily-basics.steps';duplicate.integrationKeys=(duplicate.integrationKeys||[]).filter(function(key){return key!=='lifehub.steps.8000'})});
  state.habits.forEach(function(item){
    if(!item)return;
    if(RETIRED_CHALLENGE_HABIT_IDS.has(item.id)){ensureHabitProvenance(item);_stripRetiredChallengeSources(item);_archiveManagedHabit(item,DAILY_BASICS_EFFECTIVE_DATE)}
    Object.keys(item.logProvenance||{}).forEach(function(parentDate){var entry=item.logProvenance[parentDate];Object.keys(entry&&entry.sources||{}).forEach(function(source){if(!/^basics:steps__/.test(source))return;if(item!==habit)return;var embedded=source.slice('basics:steps__'.length);if(embedded!==parentDate||parentDate<DAILY_BASICS_EFFECTIVE_DATE)delete entry.sources[source]})});
    projectHabitLogs(item);
  });
  Object.keys(state.dailyCheckIns||{}).forEach(function(dateKey){if(dateKey<DAILY_BASICS_EFFECTIVE_DATE||!_dailyBasicsValidDate(dateKey))return;var steps=(state.dailyCheckIns[dateKey]||{}).steps,present=Number.isInteger(steps)&&steps>=DAILY_STEPS_TARGET;_setBasicSource(habit,dateKey,present)});
  Object.keys(habit.logProvenance||{}).forEach(function(dateKey){if(dateKey<DAILY_BASICS_EFFECTIVE_DATE)return;var steps=(state.dailyCheckIns&&state.dailyCheckIns[dateKey]||{}).steps;if(!Number.isInteger(steps)||steps<DAILY_STEPS_TARGET)_setBasicSource(habit,dateKey,false)});
  state.__dailyBasicsV1=true;var changedDomains=[];Object.keys(state).forEach(function(domain){if(JSON.stringify(before[domain])!==JSON.stringify(state[domain]))changedDomains.push(domain)});return {ok:true,changed:changedDomains.length>0,changedDomains:changedDomains};
}
function migrateDailyBasicsV1(){var snapshot=_dailyBasicsClone(STATE),result=reconcileDailyBasicsState(STATE);if(!result.ok){STATE=snapshot;console.error('Daily Basics migration could not resolve managed Steps ownership.');return false}if(!result.changed)return true;if(!saveStateOrRollback(snapshot,{suppressUndo:true})){STATE=snapshot;return false}return true}

function dailyBasicsStatus(dateKey){
  var key=dateKey||localDateKey(new Date());if(!_dailyBasicsValidDate(key))return null;if(key<DAILY_BASICS_EFFECTIVE_DATE)return {date:key,applicable:false,rows:[]};
  var check=(STATE.dailyCheckIns||{})[key]||{},managed=resolveManagedStepsHabit(STATE,{create:false}),habit=managed.ok&&managed.habit,manual=!!(habit&&habit.logProvenance&&habit.logProvenance[key]&&habit.logProvenance[key].manual===true),steps=Number.isInteger(check.steps)?check.steps:0;
  var occurrence=typeof currentWorkoutOccurrence==='function'?currentWorkoutOccurrence(key):null,session=occurrence&&STATE.trainingSessions&&STATE.trainingSessions[occurrence.id],workoutDone=!!(session&&typeof workoutSessionMatchesOccurrence==='function'&&workoutSessionMatchesOccurrence(session)&&session.status==='completed'&&session.manualCompletion===true&&session.qualifies===true&&session.code!=='REST-SAFETY');
  var glasses=Number((STATE.water||{})[key]||0),glassMl=Number(STATE.waterSettings&&STATE.waterSettings.glassMl||250),waterMl=glasses*glassMl;
  return {date:key,applicable:true,rows:[
    {id:'steps',label:'Steps',done:steps>=DAILY_STEPS_TARGET||manual,status:(steps>=DAILY_STEPS_TARGET||manual)?'Complete':steps.toLocaleString()+' of 8,000',target:DAILY_STEPS_TARGET,value:steps,action:'steps'},
    {id:'workout',label:'Planned workout',done:workoutDone,status:workoutDone?'Complete':occurrence?occurrence.label:'Not available',target:occurrence&&occurrence.label||'',action:'workout'},
    {id:'water',label:'Water',done:waterMl>=DAILY_WATER_TARGET_ML,status:waterMl>=DAILY_WATER_TARGET_ML?'Complete':waterMl.toLocaleString()+' of 2,000 ml',target:DAILY_WATER_TARGET_ML,value:waterMl,action:'water'}
  ]};
}
function dailyBasicsAction(id,key){if(id==='steps')return "openWinterArcSteps('"+key+"')";if(id==='workout')return "openWinterArcWorkout('"+key+"')";return "openWinterArcWater('"+key+"')"}
function renderDailyBasicsCard(dateKey,options){var model=dailyBasicsStatus(dateKey),key=model&&model.date||dateKey;if(!model)return '';var rows=options&&options.hideWorkout?model.rows.filter(function(row){return row.id!=='workout'}):model.rows;var html='<section class="card planner-card daily-basics-card" id="planner-daily-basics-card" aria-labelledby="daily-basics-title"><div class="planner-card-head"><h2 class="planner-card-title" id="daily-basics-title">Daily Basics</h2></div>';if(!model.applicable)return html+'<p class="daily-basics-note">Daily Basics starts 2 November 2026.</p></section>';html+='<div class="daily-basics-list">'+rows.map(function(row){return '<button type="button" class="daily-basics-row'+(row.done?' done':'')+'" data-daily-basic="'+row.id+'" onclick="'+dailyBasicsAction(row.id,key)+'" aria-label="'+escapeHtml(row.label+', '+row.status)+'"><span class="daily-basics-icon" aria-hidden="true">'+(row.done?'✓':row.id==='steps'?'👟':row.id==='workout'?'✨':'💧')+'</span><span class="daily-basics-copy"><strong>'+escapeHtml(row.label)+'</strong><small>'+escapeHtml(row.status)+'</small></span><span class="daily-basics-state">'+(row.done?'Done':'')+'</span></button>'}).join('')+'</div></section>';return html}

function challenge75CareerHabit(){return (STATE.habits||[]).find(function(h){return h&&h.id==='challenge-career-focus-v1'})||(STATE.habits||[]).find(function(h){return h&&/^career focus$/i.test(String(h.name||'').trim())})||null}
function renderChallenge75CareerCard(todayKey){var key=todayKey||localDateKey(new Date()),habit=challenge75CareerHabit();if(!habit)return '<section class="card planner-card"><div class="planner-card-title">Career Focus</div><p>Add a Career Focus habit when it is useful.</p></section>';var progress=getHabitProgress(habit,key,key),todayDone=!!(habit.logs&&habit.logs[key]);return '<section class="card planner-card challenge-career-page-card"><div class="planner-card-head"><span class="planner-card-title">Career Focus</span><span class="planner-card-count">'+progress.count+' / '+progress.target+'</span></div><p>Intentional career blocks remain available as a regular habit.</p><button type="button" class="btn '+(todayDone?'btn-ghost':'btn-accent')+'" onclick="toggleHabit(\''+habit.id+'\',\''+key+'\')">'+(todayDone?'Undo today’s block':'Log a Career Focus block')+'</button></section>'}
