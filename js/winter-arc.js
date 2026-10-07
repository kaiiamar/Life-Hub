// Winter Arc selectors, evidence rules, safety policy, logging and progression.
// Raw user evidence is stored once; all challenge completion is derived here.
(function(global){
  'use strict';
  var PLAN_ID='winter-arc-75-me-2026';
  var CHALLENGE_ID='winter-arc-75-me-v1';
  var CHALLENGE_ARCHIVE_DATE='2026-12-19';

  function challengeSourceRecord(ruleId,key){return CHALLENGE_ID+'__'+ruleId+'__'+key}

  function plan(){return global.WINTER_ARC_TRAINING_V1||null}
  function clone(value){return JSON.parse(JSON.stringify(value))}
  function dateKey(value){return typeof value==='string'?value:localDateKey(value||new Date())}
  function addDays(key,amount){var d=new Date(key+'T12:00:00');d.setDate(d.getDate()+amount);return localDateKey(d)}
  function dayDiff(a,b){var x=a.split('-').map(Number),y=b.split('-').map(Number);return Math.round((Date.UTC(y[0],y[1]-1,y[2])-Date.UTC(x[0],x[1]-1,x[2]))/86400000)}
  function clampNumber(value,min,max){var n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):null}
  function occurrenceId(key,code){return PLAN_ID+'__'+key+'__'+code}
  function sessionRecord(id){return (STATE.trainingSessions||{})[id]||null}

  function winterArcPhaseForWeek(week){var p=plan();return p&&p.phases[week-1]||null}
  function winterArcOccurrence(value){
    var p=plan(),key=dateKey(value);if(!p||key<p.startDate||key>p.endDate)return null;
    var offset=dayDiff(p.startDate,key),week=Math.floor(offset/7)+1,dow=new Date(key+'T12:00:00').getDay();
    var base=p.weekPattern.find(function(item){return item.dow===dow});if(!base)return null;
    var phase=winterArcPhaseForWeek(week),out=clone(base),patternCode=out.code;
    if(key===p.endDate){out.code='TEST';out.label='Final test, review + core';out.kind='test';out.durationMin=45;out.test=true;out.qualifies=true}
    out.id=occurrenceId(key,out.code);out.planId=p.id;out.planVersion=p.version;out.planContentRevision=p.contentRevision;out.date=key;out.day=offset+1;out.week=week;out.phase=clone(phase);
    if(patternCode==='INT')out.interval=clone(p.intervals[phase.key]||p.intervals[phase.rangeKey]);
    if(out.includePhysio)out.physio=clone(p.physio);
    var mainExercises=p.exercises[out.code]||[],coreCoverage=p.dailyCore&&p.dailyCore.coverage[patternCode],coreExercises=p.dailyCore&&p.dailyCore.supplemental[patternCode]||[];
    if(coreCoverage)out.core=clone(coreCoverage);
    out.exercises=clone(mainExercises.concat(coreExercises));
    return out;
  }
  function winterArcWeek(value){var key=dateKey(value),p=plan();if(!p)return [];var d=new Date(key+'T12:00:00'),shift=(d.getDay()+6)%7,monday=addDays(key,-shift);var rows=[];for(var i=0;i<7;i++){var occurrence=winterArcOccurrence(addDays(monday,i));if(occurrence)rows.push(occurrence)}return rows}

  function winterArcSafety(value){
    var key=dateKey(value),choice=((STATE.dailyCheckIns||{})[key]||{}).sessionChoice;
    if(choice==='rest')return {level:'rest',action:'rest',title:'Full rest selected',message:'No workout is required today. Clinical guidance always wins.',clinician:true};
    if(choice==='recovery')return {level:'recovery',action:'recovery',title:'Recovery selected',message:'Use the 45-minute Recovery session instead of the scheduled workout.'};
    return {level:'planned',action:'planned',title:'Train as planned',message:'Follow the scheduled session and stop or skip any exercise that does not feel right.'};
  }
  function effectiveWinterArcOccurrence(value){
    var occurrence=winterArcOccurrence(value);if(!occurrence)return null;var safety=winterArcSafety(value);occurrence.safety=safety;
    if(safety.action==='recovery'&&occurrence.code!=='REC'){
      var recovery=plan().weekPattern.find(function(x){return x.code==='REC'});occurrence.originalCode=occurrence.code;occurrence.code='REC-SAFETY';occurrence.label='Recovery · chosen swap';occurrence.kind='recovery';occurrence.exercises=[];occurrence.blocks=clone(recovery.blocks);occurrence.core=clone(plan().dailyCore.coverage.REC);
    }
    if(safety.action==='rest'){occurrence.originalCode=occurrence.code;occurrence.code='REST-SAFETY';occurrence.label='Full rest · selected';occurrence.kind='rest';occurrence.qualifies=false;occurrence.exercises=[];occurrence.core=null}
    return occurrence;
  }

  function checkInForDate(value){return (STATE.dailyCheckIns||{})[dateKey(value)]||{}}
  function reconcileCheckInHabitSources(key,next,patch){
    var p=plan(),changed=[];if(!p||key<p.startDate||key>p.endDate)return changed;
    function collect(ids){(ids||[]).forEach(function(id){if(changed.indexOf(id)===-1)changed.push(id)})}
    if(Object.prototype.hasOwnProperty.call(patch||{},'steps')){
      var stepRule=p.challenge.rules.find(function(rule){return rule.id==='steps'}),stepSource=challengeSourceRecord('steps',key);
      collect(stepRule&&Number(next.steps)>=Number(stepRule.target)?applyHabitSource('lifehub.steps.10000',key,'challenge',stepSource):removeHabitSource('challenge',stepSource));
    }
    if(Object.prototype.hasOwnProperty.call(patch||{},'manualConfirmations')){
      var workoutSource=challengeSourceRecord('workout',key),confirmed=!!(next.manualConfirmations&&next.manualConfirmations.workout===true);
      collect(confirmed?applyHabitSource('lifehub.workout.any',key,'challenge',workoutSource):removeHabitSource('challenge',workoutSource));
    }
    return changed;
  }
  function saveDailyCheckIn(value,patch){
    var key=dateKey(value),snapshot=clone(STATE);if(!STATE.dailyCheckIns)STATE.dailyCheckIns={};var current=STATE.dailyCheckIns[key]||{};
    var next=Object.assign({},current,patch,{date:key,updatedAt:new Date().toISOString()});
    Object.keys(patch||{}).forEach(function(field){if(patch[field]===null)delete next[field]});
    if(next.hipPain!==undefined){next.hipPain=clampNumber(next.hipPain,0,10);if(next.hipPain===null)delete next.hipPain}
    ['sleepHours','steps','proteinG','calories'].forEach(function(field){if(next[field]!==undefined&&next[field]!==''){var n=Number(next[field]);if(Number.isFinite(n)&&n>=0)next[field]=n;else delete next[field]}});
    if(next.alcoholState&&['none','special-occasion','outside-plan'].indexOf(next.alcoholState)===-1)delete next.alcoholState;
    STATE.dailyCheckIns[key]=next;var habitIds=reconcileCheckInHabitSources(key,next,patch);if(!saveStateOrRollback(snapshot))return false;
    emitLifeHubChange({action:'winter-arc-checkin',dateKeys:[key],habitIds:habitIds,domains:habitIds.length?['dailyCheckIns','habits']:['dailyCheckIns'],source:'winter-arc'});return true;
  }

  function manualConfirmationForDate(value,ruleId){var confirmations=checkInForDate(value).manualConfirmations||{};return confirmations[ruleId]===true}
  function setWinterArcManualConfirmation(value,ruleId,present){var key=dateKey(value),p=plan(),today=dateKey(new Date());if(['reading','workout','eating'].indexOf(ruleId)===-1||key<p.startDate||key>p.endDate||key>today)return false;var current=checkInForDate(key).manualConfirmations||{},next=clone(current);if(present)next[ruleId]=true;else delete next[ruleId];return saveDailyCheckIn(key,{manualConfirmations:Object.keys(next).length?next:null})}

  function habitByChallengeKey(key){var c=(STATE.challenges||{})[CHALLENGE_ID]||{};var id=c.habitIds&&c.habitIds[key];return id?(STATE.habits||[]).find(function(h){return h&&h.id===id}):null}
  function waterEvidence(key,target){var c=(STATE.challenges||{})[CHALLENGE_ID]||{},glassMl=Number(c.waterGlassMl||STATE.waterSettings&&STATE.waterSettings.glassMl||250),glasses=Number((STATE.water||{})[key]||0),ml=glasses*glassMl;return {done:ml>=target,ml:ml,targetMl:target,glasses:glasses,meta:ml+' / '+target+' ml'}}
  function readingSeconds(key){return Object.keys((STATE.reading&&STATE.reading.sessions)||{}).reduce(function(sum,id){var s=STATE.reading.sessions[id];return sum+(s&&s.date===key&&s.completedAt?Number(s.elapsedSec||0):0)},0)}
  function canonicalSessionEvidence(session,key){if(!session||session.status!=='completed'||session.date!==key||session.manualCompletion!==true&&Number(session.durationSec)<2700)return false;var occurrence=winterArcOccurrence(key);if(!occurrence||session.id!==occurrence.id||session.occurrenceId!==occurrence.id||session.planId!==occurrence.planId||session.planVersion!==occurrence.planVersion)return false;if(session.code==='REST-SAFETY'||session.kind==='rest'||session.qualifies!==true)return false;if(session.code==='REC-SAFETY')return session.kind==='recovery'&&Array.isArray(session.exercises)&&session.exercises.length===0;if(session.code!==occurrence.code||session.kind!==occurrence.kind)return false;if(session.planContentRevision==='1.2'&&occurrence.exercises&&occurrence.exercises.length){var expected=(occurrence.exercises||[]).filter(function(def){var count=def.fixedSets!==undefined?def.fixedSets:(def.phaseSets&&def.phaseSets[occurrence.phase.key]!==undefined?def.phaseSets[occurrence.phase.key]:occurrence.phase.mainSets);return count>0});if(!Array.isArray(session.exercises)||session.exercises.length!==expected.length||!expected.every(function(def){return session.exercises.some(function(ex){return ex.exerciseId===def.id&&Array.isArray(ex.sets)})}))return false}return true}
  function qualifyingWorkoutSeconds(key){return Object.keys(STATE.trainingSessions||{}).reduce(function(sum,id){var s=STATE.trainingSessions[id];return sum+(canonicalSessionEvidence(s,key)?Math.max(Number(s.durationSec)||0,2700):0)},0)}
  function winterArcRuleStatus(rule,value){
    var key=dateKey(value),check=checkInForDate(key);
    if(rule.evidence==='daily-steps'){var stepsHabit=habitByChallengeKey('steps'),steps=Number(check.steps||0);return {done:steps>=rule.target||!!(stepsHabit&&stepsHabit.logs&&stepsHabit.logs[key]),value:steps,target:rule.target,habitId:stepsHabit&&stepsHabit.id||null,meta:steps.toLocaleString()+' / '+rule.target.toLocaleString()}};
    if(rule.evidence==='qualifying-session'){var confirmed=manualConfirmationForDate(key,'workout'),sec=qualifyingWorkoutSeconds(key);return {done:confirmed||sec>=rule.targetSeconds,value:confirmed?rule.targetSeconds:sec,target:rule.targetSeconds,manual:confirmed,meta:confirmed?'Confirmed 45+ min':sec>=rule.targetSeconds?'Recorded 45+ min':'Finish session or amend day'}}
    if(rule.evidence==='water')return waterEvidence(key,rule.targetMl);
    if(rule.evidence==='reading'){var read=readingSeconds(key),readingManual=manualConfirmationForDate(key,'reading');return {done:readingManual||read>=rule.targetSeconds,value:readingManual?rule.targetSeconds:read,target:rule.targetSeconds,manual:readingManual,meta:readingManual?'Confirmed 15 min':read>=rule.targetSeconds?'Recorded 15+ min':'Tap to confirm 15 min'}}
    if(rule.evidence==='habit'){var habit=habitByChallengeKey(rule.habitKey);return {done:!!(habit&&habit.logs&&habit.logs[key]),habitId:habit&&habit.id||null}}
    if(rule.evidence==='alcohol')return {done:check.alcoholState==='none'||check.alcoholState==='special-occasion',state:check.alcoholState||null,meta:check.alcoholState==='special-occasion'?'Special occasion':check.alcoholState==='none'?'No alcohol':'Choose result'};
    if(rule.evidence==='manual-confirmation'){var manualConfirmation=manualConfirmationForDate(key,rule.confirmationKey);return {done:manualConfirmation,manual:manualConfirmation,meta:manualConfirmation?'Confirmed':'Tap to confirm'}}
    return {done:false};
  }
  function winterArcDailyStatus(value){var p=plan(),key=dateKey(value),rows=(p?p.challenge.rules:[]).map(function(rule){return Object.assign({},clone(rule),winterArcRuleStatus(rule,key))});return {date:key,rows:rows,done:rows.filter(function(r){return r.done}).length,total:rows.length,complete:rows.length===8&&rows.every(function(r){return r.done})}}

  function reconcileWinterArcHabitIntegrationV2(){
    var p=plan(),challenge=STATE.challenges&&STATE.challenges[CHALLENGE_ID];if(!p||!challenge||!Array.isArray(STATE.habits))return false;
    var legacy=STATE.challenges&&STATE.challenges['intentional-75-2026'],legacyStepsId=legacy&&legacy.habitIds&&legacy.habitIds.steps;
    var stepsHabit=STATE.habits.find(function(habit){return habit&&habit.id==='steps-towards-10k-v1'})||STATE.habits.find(function(habit){return habit&&habit.id===legacyStepsId});if(!stepsHabit)return false;
    ensureHabitProvenance(stepsHabit);ensureHabitLifecycle(stepsHabit);if(stepsHabit.integrationKeys.indexOf('lifehub.steps.10000')===-1)stepsHabit.integrationKeys.push('lifehub.steps.10000');
    if(!stepsHabit.startDate||stepsHabit.startDate>p.startDate)stepsHabit.startDate=p.startDate;
    // Winter Arc v1 archived legacy challenge habits from its start. Repair only
    // that exact generated interval; specialized Water, Reading, Alcohol and
    // Whole-food stores intentionally remain evidence-only rather than duplicate Habits.
    (stepsHabit.lifecycle.inactivePeriods||[]).forEach(function(range){if(range&&range.kind==='archived'&&range.from===p.startDate&&range.to===null)range.from=CHALLENGE_ARCHIVE_DATE});
    challenge.habitIds=Object.assign({},challenge.habitIds,{steps:stepsHabit.id});
    Object.keys(STATE.dailyCheckIns||{}).forEach(function(key){var row=STATE.dailyCheckIns[key];if(key>=p.startDate&&key<=p.endDate&&row&&Number(row.steps)>=10000)applyHabitSource('lifehub.steps.10000',key,'challenge',challengeSourceRecord('steps',key))});
    Object.keys(STATE.trainingSessions||{}).forEach(function(id){var session=STATE.trainingSessions[id];if(session&&canonicalSessionEvidence(session,session.date))applyHabitSource('lifehub.workout.any',session.date,'workout',session.id)});
    Object.keys(STATE.dailyCheckIns||{}).forEach(function(key){var row=STATE.dailyCheckIns[key];if(key>=p.startDate&&key<=p.endDate&&row&&row.manualConfirmations&&row.manualConfirmations.workout===true)applyHabitSource('lifehub.workout.any',key,'challenge',challengeSourceRecord('workout',key))});
    return true;
  }
  function migrateWinterArcHabitIntegrationV2(){
    if(STATE.__winterArcHabitIntegrationV2)return true;var snapshot=clone(STATE);if(!reconcileWinterArcHabitIntegrationV2())return false;STATE.__winterArcHabitIntegrationV2=true;
    if(!saveStateOrRollback(snapshot,{suppressUndo:true})){STATE=clone(snapshot);return false}return true;
  }

  function previousExerciseContext(exerciseId,beforeDate){var rows=Object.keys(STATE.trainingSessions||{}).map(function(id){return STATE.trainingSessions[id]}).filter(function(s){return s&&s.status==='completed'&&s.date<beforeDate}).sort(function(a,b){return b.date.localeCompare(a.date)});for(var i=0;i<rows.length;i++){var found=(rows[i].exercises||[]).find(function(x){return x.exerciseId===exerciseId});if(found)return {exercise:found,session:rows[i],phase:rows[i].phase||(winterArcOccurrence(rows[i].date)||{}).phase||null}}return null}
  function previousExerciseResult(exerciseId,beforeDate){var context=previousExerciseContext(exerciseId,beforeDate);return context&&context.exercise||null}
  function roundDown(value,step){return Math.floor((Number(value)+1e-9)/step)*step}
  function epleyLoad(weight,reps,targetReps,targetRir,step){var e1rm=Number(weight)*(1+Number(reps)/30);return roundDown(e1rm/(1+(Number(targetReps)+Number(targetRir))/30),step||1)}
  function exerciseRange(exercise,phase){var key=phase.rangeKey||phase.key,range=exercise.reps&&exercise.reps[key];return range||null}
  function suggestedExercise(exercise,occurrence){
    var phase=occurrence.phase,range=exerciseRange(exercise,phase),context=previousExerciseContext(exercise.id,occurrence.date),previous=context&&context.exercise,linkedPrevious=exercise.linkedExerciseId&&previousExerciseResult(exercise.linkedExerciseId,occurrence.date),sets=exercise.fixedSets!==undefined?exercise.fixedSets:(exercise.phaseSets&&exercise.phaseSets[phase.key]!==undefined?exercise.phaseSets[phase.key]:phase.mainSets);
    if(exercise.mode==='skill')sets=1;if(sets<=0)return null;
    var load=previous&&Number.isFinite(Number(previous.nextLoadKg))?Number(previous.nextLoadKg):Number(exercise.startLoadKg||0);
    var phaseChanged=!!(context&&context.phase&&context.phase.key!==phase.key);
    if(phaseChanged&&!exercise.coreMicrodose&&range&&['db','db-pair','barbell','machine','cable'].indexOf(exercise.loadType)!==-1){
      var completed=(previous.sets||[]).filter(function(set){return set.done&&Number(set.loadKg)>0&&Number(set.reps)>0}).sort(function(a,b){return Number(b.loadKg)*(1+Number(b.reps)/30)-Number(a.loadKg)*(1+Number(a.reps)/30)});
      if(completed[0])load=epleyLoad(completed[0].loadKg,completed[0].reps,range[0],phase.rir,exercise.incrementKg||1);
    }
    if(phase.loadFactor&&!exercise.coreMicrodose)load=roundDown(load*phase.loadFactor,exercise.incrementKg||1);
    var timeRange=exercise.timeRangeSec&&exercise.timeRangeSec[phase.rangeKey],duration=previous&&previous.next&&Number.isFinite(Number(previous.next.durationSec))?Number(previous.next.durationSec):((exercise.timeSec&&exercise.timeSec[phase.rangeKey])||(timeRange&&timeRange[0])||null),maxDuration=timeRange&&timeRange[1]||duration;
    var reps=previous&&previous.next&&Number.isFinite(Number(previous.next.reps))?Number(previous.next.reps):(range?range[0]:(exercise.mode==='skill'?1:null)),rawRung=linkedPrevious&&linkedPrevious.nextRung||linkedPrevious&&linkedPrevious.rung||previous&&previous.nextRung||previous&&previous.rung||1,rung=Math.min(Math.max(1,Number(rawRung)||1),Math.max(1,Number(exercise.rungs||7))),misses=Number(previous&&previous.minimumMisses||previous&&previous.next&&previous.next.minimumMisses||0);
    return {id:occurrence.id+'__'+exercise.id,exerciseId:exercise.id,originalName:exercise.name,name:exercise.name,mode:exercise.mode,unit:exercise.unit||'reps',sides:exercise.sides||null,loadType:exercise.loadType,restSec:exercise.restSec||60,lowerBody:!!exercise.lowerBody,coreMicrodose:!!exercise.coreMicrodose,noProgression:!!exercise.noProgression,swap:exercise.swap||null,range:range,targetRir:phase.rir,phaseKey:phase.key,phaseWeek:phase.week,minimumMisses:misses,rung:rung,sets:Array.from({length:sets},function(_,index){return {id:occurrence.id+'__'+exercise.id+'__s'+(index+1),loadKg:load||0,reps:reps,durationSec:duration,targetDurationSec:duration,maxDurationSec:maxDuration,distanceM:exercise.distanceM||null,targetDistanceM:exercise.distanceM||null,done:false,effort:'Right',pain:'None'}})};
  }
  function buildTrainingSession(value){var occurrence=effectiveWinterArcOccurrence(value);if(!occurrence)return null;var existing=sessionRecord(occurrence.id);if(existing)return existing;var exercises=(occurrence.exercises||[]).map(function(ex){return suggestedExercise(ex,occurrence)}).filter(Boolean);return {id:occurrence.id,occurrenceId:occurrence.id,planId:occurrence.planId,planVersion:occurrence.planVersion,planContentRevision:occurrence.planContentRevision,date:occurrence.date,code:occurrence.code,label:occurrence.label,kind:occurrence.kind,phase:clone(occurrence.phase),status:'planned',qualifies:occurrence.qualifies!==false,durationSec:0,exercises:exercises,safety:occurrence.safety}}
  function upgradeSessionContent(session){
    if(!session||session.status==='completed'||session.planContentRevision===plan().contentRevision)return false;var canonical=winterArcOccurrence(session.date);if(!canonical||session.code!==canonical.code)return false;
    if(!Array.isArray(session.exercises))session.exercises=[];var existing={};session.exercises.forEach(function(ex){existing[ex.exerciseId]=true});(canonical.exercises||[]).forEach(function(def){if(existing[def.id])return;var added=suggestedExercise(def,canonical);if(added)session.exercises.push(added)});
    session.planContentRevision=canonical.planContentRevision;session.label=canonical.label;return true;
  }
  function applyCurrentSafety(session){
    if(!session||session.status==='completed')return false;var effective=effectiveWinterArcOccurrence(session.date);if(!effective)return false;var changed=false;
    if(JSON.stringify(session.safety||{})!==JSON.stringify(effective.safety||{})){session.safety=clone(effective.safety);changed=true}
    if(effective.kind==='rest'){
      if(session.exercises&&session.exercises.length&&!session.supersededExercises)session.supersededExercises=clone(session.exercises);
      if(session.exercises&&session.exercises.length){session.exercises=[];changed=true}if(session.kind!=='rest'||session.code!=='REST-SAFETY'){session.kind='rest';session.code='REST-SAFETY';session.label='Full rest · selected';changed=true}session.planContentRevision=effective.planContentRevision;
      if(session.qualifies!==false){session.qualifies=false;changed=true}if(session.lockedBySafety!=='rest'){session.lockedBySafety='rest';changed=true}
    }else if(effective.kind==='recovery'&&session.kind!=='recovery'){
      if(session.exercises&&session.exercises.length&&!session.supersededExercises)session.supersededExercises=clone(session.exercises);
      session.exercises=[];session.kind='recovery';session.code=effective.code;session.label=effective.label;session.lockedBySafety=null;session.qualifies=true;changed=true;
    }else if(effective.safety.action==='planned'&&session.code==='REC-SAFETY'){
      var restored=winterArcOccurrence(session.date);session.kind=restored.kind;session.code=restored.code;session.label=restored.label;session.phase=clone(restored.phase);session.exercises=session.supersededExercises?clone(session.supersededExercises):(restored.exercises||[]).map(function(ex){return suggestedExercise(ex,restored)}).filter(Boolean);delete session.supersededExercises;session.planContentRevision=restored.planContentRevision;session.lockedBySafety=null;session.qualifies=restored.qualifies!==false;changed=true;
    }else if(session.kind==='rest'||session.code==='REST-SAFETY'){
      var canonical=winterArcOccurrence(session.date),restoredExercises=session.supersededExercises?clone(session.supersededExercises):(canonical.exercises||[]).map(function(ex){return suggestedExercise(ex,canonical)}).filter(Boolean);session.kind=canonical.kind;session.code=canonical.code;session.label=canonical.label;session.phase=clone(canonical.phase);session.exercises=restoredExercises;delete session.supersededExercises;var restoredIds={};session.exercises.forEach(function(ex){restoredIds[ex.exerciseId]=true});(canonical.exercises||[]).forEach(function(def){if(restoredIds[def.id])return;var added=suggestedExercise(def,canonical);if(added)session.exercises.push(added)});session.planContentRevision=canonical.planContentRevision;session.lockedBySafety=null;session.qualifies=canonical.qualifies!==false;changed=true;
    }else if(session.lockedBySafety==='rest'){
      session.lockedBySafety=null;session.qualifies=effective.qualifies!==false;changed=true;
    }
    return changed;
  }
  function reconcileWinterArcSessionSafety(value){var key=dateKey(value),occurrence=winterArcOccurrence(key),session=occurrence&&sessionRecord(occurrence.id);if(!session||session.status==='completed')return false;var snapshot=clone(STATE),changed=applyCurrentSafety(session);if(session.lockedBySafety==='rest'){stripSessionTimers(session);changed=true}if(!changed)return true;session.updatedAt=new Date().toISOString();if(!saveStateOrRollback(snapshot,{suppressUndo:true}))return false;emitLifeHubChange({action:'training-choice',entityId:session.id,dateKeys:[key],domains:['trainingSessions'],source:'winter-arc'});return true}

  function startWinterArcSession(value){
    var requested=dateKey(value);if(requested!==localDateKey(new Date()))return null;var draft=buildTrainingSession(requested);if(!draft)return null;if(draft.status==='completed')return draft.id;
    var existing=!!sessionRecord(draft.id),snapshot=clone(STATE);upgradeSessionContent(draft);applyCurrentSafety(draft);
    if(draft.lockedBySafety==='rest'){if(existing)saveStateOrRollback(snapshot,{suppressUndo:true});return null}
    if(draft.status==='planned'){
      var now=new Date().toISOString();draft.status='in-progress';draft.startedAt=draft.startedAt||now;stripSessionTimers(draft);draft.updatedAt=now;if(!STATE.trainingSessions)STATE.trainingSessions={};STATE.trainingSessions[draft.id]=draft;if(!saveStateOrRollback(snapshot))return null;emitLifeHubChange({action:'training-start',entityId:draft.id,dateKeys:[draft.date],domains:['trainingSessions'],source:'winter-arc'});
    }else if(draft.status==='in-progress'){
      stripSessionTimers(draft);draft.updatedAt=new Date().toISOString();if(!saveStateOrRollback(snapshot))return null;
    }
    return draft.id;
  }
  function updateTrainingSet(sessionId,exerciseId,setId,patch){var session=sessionRecord(sessionId);if(!session)return false;var snapshot=clone(STATE);if(applyCurrentSafety(session)){session.updatedAt=new Date().toISOString();if(session.lockedBySafety==='rest'||session.kind==='recovery'){saveStateOrRollback(snapshot);return false}}var exercise=(session.exercises||[]).find(function(x){return x.id===exerciseId}),set=exercise&&(exercise.sets||[]).find(function(x){return x.id===setId});if(!set)return false;if(exercise.stopLatched&&patch.done===true)return false;Object.keys(patch).forEach(function(key){set[key]=patch[key]});session.updatedAt=new Date().toISOString();if(set.pain==='Stop'){set.done=false;exercise.swapFlag=true;exercise.stopLatched=true;if(!Array.isArray(exercise.stopEvents))exercise.stopEvents=[];if(!exercise.stopEvents.some(function(event){return event.setId===set.id}))exercise.stopEvents.push({setId:set.id,at:new Date().toISOString()})}if(!saveStateOrRollback(snapshot))return false;emitLifeHubChange({action:'training-set',entityId:setId,dateKeys:[session.date],domains:['trainingSessions'],source:'winter-arc',rendered:true});return true}
  function sameAsLastTime(sessionId,exerciseId){var session=sessionRecord(sessionId),exercise=session&&(session.exercises||[]).find(function(x){return x.id===exerciseId});if(!exercise)return false;var previous=previousExerciseResult(exercise.exerciseId,session.date);if(!previous)return false;var snapshot=clone(STATE);exercise.sets.forEach(function(set,index){var prior=previous.sets&&previous.sets[Math.min(index,previous.sets.length-1)];if(prior){['loadKg','reps','durationSec','distanceM'].forEach(function(k){if(prior[k]!=null)set[k]=prior[k]})}});session.updatedAt=new Date().toISOString();if(!saveStateOrRollback(snapshot))return false;emitLifeHubChange({action:'training-copy-last',entityId:exerciseId,dateKeys:[session.date],domains:['trainingSessions'],source:'winter-arc',rendered:true});return true}
  function nextExerciseSuggestion(exercise,phase,morningPain){
    var sets=exercise.sets||[],completed=sets.filter(function(s){return s.done}),painStop=sets.some(function(s){return s.pain==='Stop'}),niggle=sets.some(function(s){return s.pain==='Niggle'}),range=exercise.range,load=Number(sets[0]&&sets[0].loadKg||0),effort=sets.some(function(s){return s.effort==='Hard'})?'Hard':sets.length&&sets.every(function(s){return s.effort==='Easy'})?'Easy':'Right',definition=findExercise(exercise.exerciseId);
    if(exercise.swapAccepted||exercise.skippedAfterStop)return {action:'hold',loadKg:load,minimumMisses:Number(exercise.minimumMisses||0),reason:'Pain response recorded — hold progression.'};
    if(painStop||exercise.stopLatched||exercise.stopEvents&&exercise.stopEvents.length)return {action:'swap',loadKg:load,minimumMisses:Number(exercise.minimumMisses||0),reason:'Pain marked Stop — hold progression and use the swap or skip.'};
    if((niggle||Number(morningPain)>=2)&&exercise.lowerBody)return {action:'hold',loadKg:load,minimumMisses:Number(exercise.minimumMisses||0),reason:'Lower-body load held for pain safety.'};
    if(exercise.noProgression)return {action:'hold',loadKg:load,minimumMisses:0,reason:'Keep this breathing reset easy and consistent.'};
    if(phase.noProgression)return {action:'hold',loadKg:load,minimumMisses:Number(exercise.minimumMisses||0),reason:'No progression during deload or taper.'};
    if(exercise.mode==='time'&&completed.length===sets.length&&sets.length&&completed.every(function(set){return Number(set.durationSec||0)>=Number(set.targetDurationSec||0)})){var currentTarget=Number(sets[0].targetDurationSec||sets[0].durationSec||0),maxTarget=Number(sets[0].maxDurationSec||currentTarget+5);if(currentTarget>=maxTarget)return {action:'hold',durationSec:maxTarget,minimumMisses:0,reason:'Daily core time target reached — keep it crisp.'};return {action:'increase-time',durationSec:Math.min(maxTarget,currentTarget+5),minimumMisses:0,reason:'All timed sets reached target — add 5 seconds.'}}
    if(exercise.mode==='time')return {action:'hold',durationSec:Number(sets[0]&&sets[0].targetDurationSec||0),minimumMisses:Number(exercise.minimumMisses||0),reason:'Hold the timed target until every set reaches it.'};
    if(exercise.mode==='distance'&&completed.length===sets.length&&sets.length&&completed.every(function(set){return Number(set.distanceM||0)>=Number(set.targetDistanceM||0)})){var distanceIncrement=Number(definition&&definition.incrementKg||0);return {action:'increase',loadKg:load+distanceIncrement,minimumMisses:0,reason:'All carries reached target — add the prescribed load.'}}
    if(exercise.mode==='distance')return {action:'hold',loadKg:load,minimumMisses:Number(exercise.minimumMisses||0),reason:'Hold load until every carry reaches the target distance.'};
    if(exercise.mode==='ladder'&&completed.length>=3&&completed.length===sets.length&&completed.every(function(s){return Number(s.reps)>=10})){var maxRung=Number(definition&&definition.rungs||Infinity);if(Number(exercise.rung||1)>=maxRung)return {action:'hold',rung:maxRung,minimumMisses:0,reason:'Top ladder rung reached — hold and own it.'};return {action:'next-rung',rung:Number(exercise.rung||1)+1,reps:6,minimumMisses:0,reason:'Three sets at 10 — move one rung and reset to 6.'}}
    if(exercise.mode==='ladder')return {action:'hold',rung:Math.min(Number(definition&&definition.rungs||7),Math.max(1,Number(exercise.rung||1))),minimumMisses:Number(exercise.minimumMisses||0),reason:'Stay on this rung until three sets reach 10.'};
    if(!range||!completed.length)return {action:'hold',loadKg:load,minimumMisses:Number(exercise.minimumMisses||0),reason:'Repeat this target next time.'};
    var allMax=completed.length===sets.length&&completed.every(function(s){return Number(s.reps)>=range[1]});
    if(allMax&&effort!=='Hard'){
      if(exercise.coreMicrodose)return {action:'hold',loadKg:load,reps:range[1],minimumMisses:0,reason:'Daily core rep target reached — keep the movement controlled.'};
      if(definition&&definition.loadType==='bodyweight')return {action:'add-bodyweight-load',loadKg:load+Number(definition.bodyweightAddKg||8),reps:4,minimumMisses:0,reason:'Top reps reached — add two 4kg dumbbells and reset to 4 reps.'};
      var increment=Number(definition&&definition.incrementKg||0);if(effort==='Easy'&&phase.week<=2)increment*=2;var next=definition&&definition.loadType==='assistance'?load-increment:load+increment;return {action:'increase',loadKg:Math.max(0,next),minimumMisses:0,reason:effort==='Easy'&&phase.week<=2?'Easy calibration: double increment.':'All sets reached the top of the range.'};
    }
    if(allMax&&effort==='Hard')return {action:'hold',loadKg:load,minimumMisses:0,reason:'Top reps felt hard — hold the load.'};
    var allMin=completed.length===sets.length&&completed.every(function(s){return Number(s.reps)>=range[0]});if(allMin)return {action:'reps',loadKg:load,reps:Math.min(range[1],Math.min.apply(null,completed.map(function(s){return Number(s.reps)}))+1),minimumMisses:0,reason:'Hold load and add one rep from the lowest set.'};
    var previousMisses=Number(exercise.minimumMisses||0)+1;if(previousMisses>=2){var factor=definition&&definition.loadType==='assistance'?1.1:0.9;return {action:'reduce',loadKg:roundDown(load*factor,definition&&definition.incrementKg||1),minimumMisses:0,reason:'Minimum missed twice — adjust by 10%.'}}
    return {action:'hold',loadKg:load,minimumMisses:previousMisses,reason:'Repeat after one minimum miss.'};
  }
  function findExercise(id){var p=plan(),found=null;Object.keys(p.exercises).some(function(code){found=p.exercises[code].find(function(ex){return ex.id===id});return !!found});if(found)return found;Object.keys(p.dailyCore&&p.dailyCore.supplemental||{}).some(function(code){found=p.dailyCore.supplemental[code].find(function(ex){return ex.id===id});return !!found});return found}
  function stripSessionTimers(session){if(!session)return;delete session.sessionTimer;delete session.restTimer;(session.exercises||[]).forEach(function(exercise){(exercise.sets||[]).forEach(function(set){delete set.timerAnchorMs;delete set.heartbeatMs;delete set.elapsedBeforeSec})})}
  function finishWinterArcSession(sessionId){var session=sessionRecord(sessionId);if(!session)return false;var snapshot=clone(STATE),safetyChanged=applyCurrentSafety(session);if(session.lockedBySafety==='rest'){if(safetyChanged)saveStateOrRollback(snapshot);return false}if((session.exercises||[]).some(function(ex){return ex.stopLatched&&!ex.swapAccepted&&!ex.skippedAfterStop}))return false;var occurrence=winterArcOccurrence(session.date),pain=null;stripSessionTimers(session);session.durationSec=Math.max(0,Number(session.durationSec)||0);session.manualCompletion=true;session.completedAt=new Date().toISOString();session.updatedAt=session.completedAt;session.status='completed';(session.exercises||[]).forEach(function(ex){var suggestion=nextExerciseSuggestion(ex,occurrence.phase,pain);ex.next=suggestion;ex.minimumMisses=Number(suggestion.minimumMisses||0);if(suggestion.loadKg!=null)ex.nextLoadKg=suggestion.loadKg;if(suggestion.rung!=null)ex.nextRung=suggestion.rung});var habitIds=applyHabitSource('lifehub.workout.any',session.date,'workout',session.id);if(!saveStateOrRollback(snapshot))return false;emitLifeHubChange({action:'training-finish',entityId:sessionId,dateKeys:[session.date],habitIds:habitIds,domains:habitIds.length?['trainingSessions','habits']:['trainingSessions'],source:'winter-arc'});return true}
  function removeWinterArcSession(sessionId){var session=sessionRecord(sessionId);if(!session)return false;var snapshot=clone(STATE);delete STATE.trainingSessions[sessionId];var habitIds=removeHabitSource('workout',sessionId);if(!saveStateOrRollback(snapshot))return false;emitLifeHubChange({action:'training-delete',entityId:sessionId,dateKeys:[session.date],habitIds:habitIds,domains:habitIds.length?['trainingSessions','habits']:['trainingSessions'],source:'winter-arc'});return true}

  global.WINTER_ARC_PLAN_ID=PLAN_ID;global.WINTER_ARC_CHALLENGE_ID=CHALLENGE_ID;
  global.winterArcPlan=plan;global.winterArcOccurrence=winterArcOccurrence;global.effectiveWinterArcOccurrence=effectiveWinterArcOccurrence;global.winterArcWeek=winterArcWeek;global.winterArcSafety=winterArcSafety;
  global.winterArcDailyStatus=winterArcDailyStatus;global.winterArcRuleStatus=winterArcRuleStatus;global.checkInForDate=checkInForDate;global.saveDailyCheckIn=saveDailyCheckIn;global.manualConfirmationForDate=manualConfirmationForDate;global.setWinterArcManualConfirmation=setWinterArcManualConfirmation;global.reconcileWinterArcSessionSafety=reconcileWinterArcSessionSafety;
  global.reconcileWinterArcHabitIntegrationV2=reconcileWinterArcHabitIntegrationV2;global.migrateWinterArcHabitIntegrationV2=migrateWinterArcHabitIntegrationV2;
  global.readingSeconds=readingSeconds;
  global.buildTrainingSession=buildTrainingSession;global.startWinterArcSession=startWinterArcSession;global.updateTrainingSet=updateTrainingSet;global.sameAsLastTime=sameAsLastTime;global.finishWinterArcSession=finishWinterArcSession;global.removeWinterArcSession=removeWinterArcSession;
  global.nextExerciseSuggestion=nextExerciseSuggestion;global.epleyLoad=epleyLoad;global.winterArcOccurrenceId=occurrenceId;
})(typeof window!=='undefined'?window:globalThis);


// Browser presentation adapters. These replace the visible v6 weekly template
// while leaving its stored object and all generic workout history untouched.
(function(global){
  'use strict';
  var pendingSetFocus=null;
  function esc(value){return typeof escapeHtml==='function'?escapeHtml(String(value==null?'':value)):String(value==null?'':value)}
  function currentPlan(){return global.WINTER_ARC_TRAINING_V1}
  function definitionFor(exerciseId){var p=currentPlan(),found=null;Object.keys(p.exercises||{}).some(function(code){found=(p.exercises[code]||[]).find(function(def){return def.id===exerciseId});return !!found});if(found)return found;Object.keys(p.dailyCore&&p.dailyCore.supplemental||{}).some(function(code){found=(p.dailyCore.supplemental[code]||[]).find(function(def){return def.id===exerciseId});return !!found});return found}
  function displayDate(value){var key=typeof value==='string'?value:localDateKey(value||new Date()),p=currentPlan();return key<p.startDate?p.startDate:key>p.endDate?p.endDate:key}
  function sessionForOccurrence(occurrence){return occurrence&&STATE.trainingSessions&&STATE.trainingSessions[occurrence.id]||null}
  function phaseCopy(occurrence){return 'Week '+occurrence.week+' · '+occurrence.phase.label+' · '+occurrence.phase.mainSets+' sets · RIR '+occurrence.phase.rir}

  var winterArcRoute=null;
  function winterArcContent(){return document.getElementById('winter-arc-content')}
  function activeWorkoutTab(){var active=document.querySelector('#page-workout .sub-page.active');return active?active.id.replace('workout-',''):'overview'}
  function updateWinterArcPageHeading(occurrence,preview){var title=document.getElementById('winter-arc-page-title'),kicker=document.getElementById('winter-arc-page-kicker');if(title)title.textContent=occurrence?occurrence.label:'Winter Arc session';if(kicker)kicker.textContent=preview?'SESSION PREVIEW':'WINTER ARC · '+(occurrence?occurrence.code:'SESSION')}
  function openWinterArcPageRoute(route){winterArcRoute=route;var page=document.getElementById('page-winter-arc');if(page&&page.classList.contains('active'))renderWinterArcPage();else nav('winter-arc')}
  global.renderWinterArcPage=function(){if(!winterArcRoute)return;var occurrence=winterArcOccurrence(winterArcRoute.date),session=winterArcRoute.sessionId&&(STATE.trainingSessions||{})[winterArcRoute.sessionId];if(session&&winterArcRoute.mode!=='preview'){occurrence=Object.assign({},occurrence,{label:session.label,code:session.code})}updateWinterArcPageHeading(occurrence,winterArcRoute.mode==='preview');if(winterArcRoute.mode==='preview')renderWinterArcPreview(winterArcRoute.date,session);else renderWinterArcLogger(winterArcRoute.sessionId)};
  global.closeWinterArcPage=function(){
    var route=winterArcRoute;winterArcRoute=null;var returnPage=route&&route.returnPage||'workout',returnTab=route&&route.returnTab||'overview',date=route&&route.date;
    nav(returnPage,function(){var button=null;if(returnPage==='workout'){button=document.querySelector('#page-workout .page-tab[data-tab="'+returnTab+'"]');subNav('workout',returnTab,button)}var focusRoot=returnPage==='workout'?document.getElementById('workout-'+returnTab):document.getElementById('page-'+returnPage),focus=date&&focusRoot&&focusRoot.querySelector('[data-training-date="'+date+'"]'),target=returnPage==='workout'?(button||focus):(focus||route&&route.opener);if(target&&typeof target.focus==='function')target.focus();if(button)setTimeout(function(){if(document.getElementById('page-workout').classList.contains('active'))button.focus()},600)});
  };

  global.todaysTrainingSession=function(key){
    var occurrence=effectiveWinterArcOccurrence(key||localDateKey(new Date()));if(!occurrence)return null;
    occurrence.session=occurrence.code;occurrence.trainingType=occurrence.kind;occurrence.icon=occurrence.kind==='strength'?'🏋🏽‍♀️':occurrence.kind==='cardio'?'💓':occurrence.kind==='rest'?'🛌':'🌸';occurrence.sub=occurrence.durationMin+' min · '+occurrence.phase.label;occurrence.detail=occurrence.safety.message;occurrence.logType=null;occurrence.acceptedLogTypes=[];return occurrence;
  };

  var activeEvidenceRule=null;
  function openEvidenceDialog(html,ruleId){
    var modal=document.getElementById('modal'),content=document.getElementById('modal-content');if(!modal||!content)return false;activeEvidenceRule=document.activeElement&&document.activeElement.getAttribute&&document.activeElement.getAttribute('data-challenge-rule')===ruleId?ruleId:null;if(typeof _modalReturnFocus!=='undefined'&&modal.style.display!=='flex')_modalReturnFocus=document.activeElement;content.innerHTML=html;modal.style.display='flex';var first=content.querySelector('[autofocus],input,button');if(first)setTimeout(function(){first.focus()},0);return true;
  }
  function evidenceError(message){var el=document.getElementById('wa-evidence-error');if(el){el.textContent=message;el.style.display='block'}}
  function finishEvidenceSave(key,patch,message){var returnRule=activeEvidenceRule;if(!saveDailyCheckIn(key,patch))return false;if(typeof closeModal==='function')closeModal();if(returnRule)setTimeout(function(){var replacement=document.querySelector('[data-challenge-rule="'+returnRule+'"]');if(replacement)replacement.focus()},0);if(typeof showCelebrationToast==='function')showCelebrationToast(message,'✓');return true}

  global.openWinterArcSteps=function(value){
    var key=value||localDateKey(new Date()),row=checkInForDate(key),current=row.steps==null?'':row.steps;
    openEvidenceDialog('<div class="wa-modal-kicker">10,000 STEPS</div><h2>Log steps</h2><div class="modal-sub">'+esc(fmtDate(key))+' · enter the total shown by your phone or watch.</div><div id="wa-evidence-error" class="wa-evidence-error" role="alert" style="display:none"></div><div class="field"><label for="wa-quick-steps">Steps</label><input id="wa-quick-steps" type="number" inputmode="numeric" min="0" max="200000" step="1" value="'+esc(current)+'" placeholder="e.g. 10420" autofocus onkeydown="if(event.key===\'Enter\')saveWinterArcSteps(\''+key+'\')"></div><div class="modal-btns">'+(current!==''?'<button type="button" class="btn btn-ghost" onclick="clearWinterArcSteps(\''+key+'\')">Clear</button>':'')+'<button type="button" class="btn" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-accent" onclick="saveWinterArcSteps(\''+key+'\')">Save steps</button></div>','steps');
  };
  global.saveWinterArcSteps=function(key){var input=document.getElementById('wa-quick-steps'),steps=Number(input&&input.value);if(!input||input.value===''||!Number.isInteger(steps)||steps<0||steps>200000){evidenceError('Enter a whole-number step total between 0 and 200,000.');return false}return finishEvidenceSave(key,{steps:steps},'Steps saved')};
  global.clearWinterArcSteps=function(key){return finishEvidenceSave(key,{steps:null},'Steps cleared')};

  global.openWinterArcWater=function(value){
    var key=value||localDateKey(new Date()),challenge=typeof getChallenge75==='function'?getChallenge75():null,glassMl=Number(challenge&&challenge.waterGlassMl||250),current=Number((STATE.water||{})[key]||0);
    openEvidenceDialog('<div class="wa-modal-kicker">2 LITRES OF WATER</div><h2>Log water</h2><div class="modal-sub">'+esc(fmtDate(key))+' · '+glassMl+' ml per glass.</div><div id="wa-evidence-error" class="wa-evidence-error" role="alert" style="display:none"></div><div class="field"><label for="wa-quick-water">Glasses</label><input id="wa-quick-water" type="number" inputmode="numeric" min="0" max="100" step="1" value="'+current+'" autofocus onkeydown="if(event.key===\'Enter\')saveWinterArcWater(\''+key+'\')"></div><p class="wa-evidence-hint">'+(current*glassMl)+' ml currently recorded.</p><div class="modal-btns">'+(current?'<button type="button" class="btn btn-ghost" onclick="clearWinterArcWater(\''+key+'\')">Clear</button>':'')+'<button type="button" class="btn" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-accent" onclick="saveWinterArcWater(\''+key+'\')">Save water</button></div>','water');
  };
  global.saveWinterArcWater=function(key){var input=document.getElementById('wa-quick-water'),count=Number(input&&input.value);if(!input||input.value===''||!Number.isInteger(count)||count<0||count>100){evidenceError('Enter a whole-number glass count between 0 and 100.');return false}if(typeof setWaterGlasses!=='function'||!setWaterGlasses(key,count)){evidenceError('Water could not be saved.');return false}if(typeof closeModal==='function')closeModal();if(typeof showCelebrationToast==='function')showCelebrationToast('Water saved','✓');return true};
  global.clearWinterArcWater=function(key){if(typeof setWaterGlasses!=='function'||!setWaterGlasses(key,0))return false;if(typeof closeModal==='function')closeModal();return true};

  global.openWinterArcAlcohol=function(value){
    var key=value||localDateKey(new Date()),row=checkInForDate(key),state=row.alcoholState||'',choice=function(value,label,copy){return '<button type="button" class="wa-evidence-choice'+(state===value?' selected':'')+'" aria-pressed="'+(state===value?'true':'false')+'" onclick="saveWinterArcAlcohol(\''+key+'\',\''+value+'\')"><strong>'+label+'</strong><span>'+copy+'</span></button>'};
    openEvidenceDialog('<div class="wa-modal-kicker">ALCOHOL</div><h2>Choose the result</h2><div class="modal-sub">'+esc(fmtDate(key))+' · alcohol is limited to special occasions decided in advance.</div>'+choice('none','No alcohol','The daily rule is complete.')+choice('special-occasion','Planned special occasion','The daily rule is complete.')+choice('outside-plan','Outside the plan','Recorded honestly; the daily rule remains incomplete.')+'<div class="modal-btns">'+(state?'<button type="button" class="btn btn-ghost" onclick="clearWinterArcAlcohol(\''+key+'\')">Clear</button>':'')+'<button type="button" class="btn" onclick="closeModal()">Cancel</button></div>','alcohol');
  };
  global.saveWinterArcAlcohol=function(key,state){if(['none','special-occasion','outside-plan'].indexOf(state)===-1)return false;return finishEvidenceSave(key,{alcoholState:state,alcoholNote:null},'Alcohol result saved')};
  global.clearWinterArcAlcohol=function(key){return finishEvidenceSave(key,{alcoholState:null,alcoholNote:null},'Alcohol result cleared')};

  global.chooseWinterArcRecovery=function(key){if(saveDailyCheckIn(key,{sessionChoice:'recovery'})){reconcileWinterArcSessionSafety(key);if(typeof refreshPlannerCards==='function')refreshPlannerCards(['training']);if(typeof renderTrainingOverview==='function')renderTrainingOverview()}};
  global.chooseWinterArcFullRest=function(key){if(saveDailyCheckIn(key,{sessionChoice:'rest'})){reconcileWinterArcSessionSafety(key);if(typeof refreshPlannerCards==='function')refreshPlannerCards(['training']);if(typeof renderTrainingOverview==='function')renderTrainingOverview()}};
  global.restoreWinterArcPlan=function(key){if(saveDailyCheckIn(key,{sessionChoice:null})){reconcileWinterArcSessionSafety(key);if(typeof refreshPlannerCards==='function')refreshPlannerCards(['training']);if(typeof renderTrainingOverview==='function')renderTrainingOverview()}};

  function occurrenceDetail(occurrence){
    var rows=[];
    if(occurrence.interval)rows.push('<li><strong>Intervals</strong><span>'+esc(occurrence.interval.label)+'</span></li>');
    (occurrence.blocks||[]).forEach(function(block){rows.push('<li><strong>'+esc(block[0])+'</strong><span>'+block[1]+' min</span></li>')});
    (occurrence.options||[]).forEach(function(option){rows.push('<li><strong>Cardio option</strong><span>'+esc(option)+'</span></li>')});
    (occurrence.exercises||[]).forEach(function(ex){var range=ex.reps&&ex.reps[occurrence.phase.rangeKey],timeRange=ex.timeRangeSec&&ex.timeRangeSec[occurrence.phase.rangeKey],target=range?range[0]+'–'+range[1]+' '+(ex.unit||'reps'):timeRange?timeRange[0]+'–'+timeRange[1]+' sec':ex.timeSec?ex.timeSec[occurrence.phase.rangeKey]+' sec':ex.distanceM?ex.distanceM+'m':ex.skill&&ex.skill[occurrence.phase.rangeKey]||'';rows.push('<li><strong>'+(ex.coreMicrodose?'Daily core · ':'')+esc(ex.id)+' · '+esc(ex.name)+'</strong><span>'+esc(target)+(ex.sides?' · '+esc(ex.sides):'')+(ex.optional?' · optional':'')+'</span></li>')});
    if(occurrence.core&&occurrence.core.type==='embedded')rows.push('<li><strong>Daily core covered</strong><span>'+esc(occurrence.core.label)+'</span></li>');
    return rows.join('');
  }

  global.renderTrainingOverview=function(){
    var nowKey=localDateKey(new Date()),anchor=displayDate(nowKey),week=winterArcWeek(anchor),completed=week.filter(function(o){var s=sessionForOccurrence(o);return s&&s.status==='completed'}).length,target=week.length;
    var c=document.getElementById('training-week-count');if(c)c.innerHTML=completed+'<span style="font-size:18px;color:var(--text2);font-weight:400"> / '+target+'</span>';
    var t=document.getElementById('training-week-target');if(t)t.textContent=nowKey<currentPlan().startDate?'Your first Winter Arc week':completed===target?'Week complete ✓':(target-completed)+' planned session'+(target-completed===1?'':'s')+' left';
    var grid=document.getElementById('training-week-grid');if(grid)grid.innerHTML='<div class="training-week-grid">'+week.map(function(o){var s=sessionForOccurrence(o),today=o.date===nowKey;return '<button type="button" class="training-day '+(s&&s.status==='completed'?'done':today?'today':'')+'" data-training-date="'+o.date+'" onclick="openWinterArcWorkout(\''+o.date+'\')"><span class="training-day-name">'+esc(new Date(o.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'}))+'</span><span class="training-day-plan">'+esc(o.code)+'</span><span class="training-day-logged">'+(s&&s.status==='completed'?'✓ Done':s&&s.status==='in-progress'?'Resume':esc(o.label))+'</span></button>'}).join('')+'</div>';
    var all=Object.keys(STATE.trainingSessions||{}).map(function(id){return STATE.trainingSessions[id]}).filter(function(s){return s&&s.status==='completed'}).sort(function(a,b){return String(b.completedAt||b.date).localeCompare(String(a.completedAt||a.date))});
    var month=nowKey.slice(0,7),monthCount=all.filter(function(s){return s.date&&s.date.slice(0,7)===month}).length;var mc=document.getElementById('training-month-count');if(mc)mc.textContent=monthCount;var mb=document.getElementById('training-month-breakdown');if(mb)mb.textContent='Winter Arc sessions';var last=all[0],ls=document.getElementById('training-last-session'),lw=document.getElementById('training-last-when');if(ls)ls.textContent=last?last.label:'—';if(lw)lw.textContent=last?fmtDate(last.date):'log your first';var streak=document.getElementById('training-streak'),streakSub=document.getElementById('training-streak-sub');if(streak)streak.textContent='—';if(streakSub)streakSub.textContent='never-miss-twice, not a reset streak';
    if(typeof renderTrainingEvents==='function')renderTrainingEvents();if(typeof renderTrainingBody==='function')renderTrainingBody();
  };

  global.renderTrainingFuel=function(){
    var el=document.getElementById('training-fuel');if(!el)return;var n=currentPlan().nutrition,today=localDateKey(new Date()),eating=global.winterArcDailyStatus(today).rows.find(function(r){return r.id==='eating'});el.innerHTML='<div class="wa-fuel-hero card"><div><span>OPTIONAL GUIDANCE</span><strong>'+n.caloriesTarget.toLocaleString()+' kcal</strong><p>Reference targets for meal planning only — not 75 Me completion criteria.</p></div><div class="wa-fuel-macros"><div><strong>'+n.proteinTargetG+'g</strong><span>protein</span></div><div><strong>'+n.fatTargetG+'g</strong><span>fat</span></div><div><strong>'+n.carbsTargetG+'g</strong><span>carbs</span></div><div><strong>2L</strong><span>water</span></div></div></div><div class="card wa-fuel-rule"><div class="planner-card-head"><span class="planner-card-title">Whole foods, no takeaway</span><span class="wa-session-state">'+(eating&&eating.done?'Confirmed ✓':'Not confirmed')+'</span></div><p>Complete this rule when you made an active effort to eat whole foods and had no takeaway.</p><button type="button" class="btn btn-accent" onclick="challenge75EatingAction(\''+today+'\')">'+(eating&&eating.done?'Undo confirmation':'Confirm for today')+'</button></div>';
  };

  function persistSession(session,action){var snapshot=JSON.parse(JSON.stringify(STATE));session.updatedAt=new Date().toISOString();if(!saveStateOrRollback(snapshot))return false;emitLifeHubChange({action:action,entityId:session.id,dateKeys:[session.date],domains:['trainingSessions'],source:'winter-arc',rendered:true});return true}
  function findParts(sessionId,exerciseId,setId){var session=(STATE.trainingSessions||{})[sessionId],exercise=session&&(session.exercises||[]).find(function(ex){return ex.id===exerciseId}),set=exercise&&(exercise.sets||[]).find(function(item){return item.id===setId});return {session:session,exercise:exercise,set:set}}

  global.winterArcToggleSet=function(sessionId,exerciseId,setId){var parts=findParts(sessionId,exerciseId,setId);if(!parts.set)return;if(updateTrainingSet(sessionId,exerciseId,setId,{done:!parts.set.done}))renderWinterArcLogger(sessionId)};
  global.winterArcAdjustSet=function(sessionId,exerciseId,setId,field,amount){var parts=findParts(sessionId,exerciseId,setId);if(!parts.set)return;var next=Math.max(0,Number(parts.set[field]||0)+Number(amount));if(updateTrainingSet(sessionId,exerciseId,setId,{[field]:Math.round(next*100)/100}))renderWinterArcLogger(sessionId)};
  global.winterArcSetValue=function(sessionId,exerciseId,setId,field,value){var next=Math.max(0,Number(value)||0);if(updateTrainingSet(sessionId,exerciseId,setId,{[field]:next}))renderWinterArcLogger(sessionId)};
  global.winterArcSetRating=function(sessionId,exerciseId,setId,field,value){if(updateTrainingSet(sessionId,exerciseId,setId,{[field]:value}))renderWinterArcLogger(sessionId)};
  global.winterArcUseSwap=function(sessionId,exerciseId){var parts=findParts(sessionId,exerciseId);if(!parts.exercise||!parts.exercise.swap)return;var snapshot=JSON.parse(JSON.stringify(STATE));parts.exercise.substitutedName=parts.exercise.swap;parts.exercise.name=parts.exercise.swap;parts.exercise.swapAccepted=true;parts.exercise.stopLatched=false;parts.exercise.swapFlag=false;(parts.exercise.sets||[]).forEach(function(set){set.done=false;set.pain='None'});parts.session.updatedAt=new Date().toISOString();if(saveStateOrRollback(snapshot))renderWinterArcLogger(sessionId)};
  global.winterArcSkipExercise=function(sessionId,exerciseId){var parts=findParts(sessionId,exerciseId);if(!parts.exercise)return;var snapshot=JSON.parse(JSON.stringify(STATE));parts.exercise.skippedAfterStop=true;parts.exercise.stopLatched=false;parts.exercise.swapFlag=false;(parts.exercise.sets||[]).forEach(function(set){set.done=false});parts.session.updatedAt=new Date().toISOString();if(saveStateOrRollback(snapshot))renderWinterArcLogger(sessionId)};
  global.winterArcChangeRung=function(sessionId,exerciseId,amount){var parts=findParts(sessionId,exerciseId);if(!parts.exercise)return;var snapshot=JSON.parse(JSON.stringify(STATE)),definition=definitionFor(parts.exercise.exerciseId),max=Math.max(1,Number(definition&&definition.rungs||7));parts.exercise.rung=Math.min(max,Math.max(1,Number(parts.exercise.rung||1)+Number(amount)));if(saveStateOrRollback(snapshot))renderWinterArcLogger(sessionId)};
  global.winterArcSameLast=function(sessionId,exerciseId){if(sameAsLastTime(sessionId,exerciseId))renderWinterArcLogger(sessionId)};
  global.winterArcAddSet=function(sessionId,exerciseId){
    var parts=findParts(sessionId,exerciseId);if(!parts.session||!parts.exercise||parts.session.status!=='in-progress'||parts.exercise.sets.length>=12)return false;var snapshot=JSON.parse(JSON.stringify(STATE)),previous=parts.exercise.sets[parts.exercise.sets.length-1]||{},set=JSON.parse(JSON.stringify(previous)),suffix;
    delete set.timerAnchorMs;delete set.heartbeatMs;set.done=false;set.effort='Right';set.pain='None';set.extra=true;
    do{suffix='x'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);set.id=parts.exercise.id+'__'+suffix}while(parts.exercise.sets.some(function(item){return item.id===set.id}));
    parts.exercise.sets.push(set);parts.session.updatedAt=new Date().toISOString();pendingSetFocus=set.id;if(!saveStateOrRollback(snapshot)){pendingSetFocus=null;return false}emitLifeHubChange({action:'training-set-add',entityId:set.id,dateKeys:[parts.session.date],domains:['trainingSessions'],source:'winter-arc',rendered:true});renderWinterArcLogger(sessionId);return true;
  };

  function setControl(session,exercise,set,index){var isTime=exercise.mode==='time',isDistance=exercise.mode==='distance',valueField=isTime?'durationSec':isDistance?'distanceM':'reps',value=Number(set[valueField]||0),unit=exercise.unit||'reps',workLabel=isTime?'seconds':isDistance?'distance':unit,workUnit=isTime?'sec':isDistance?'m':unit,stepAmount=isTime||isDistance?5:1,loadControl=exercise.loadType&&['bodyweight','time','notch'].indexOf(exercise.loadType)===-1?'<div class="wa-stepper"><button type="button" onclick="winterArcAdjustSet(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\'loadKg\',-0.5)" data-wa-key="load-minus:'+set.id+'" aria-label="Decrease weight">−</button><input type="number" min="0" step="0.5" data-wa-key="load:'+set.id+'" value="'+Number(set.loadKg||0)+'" onchange="winterArcSetValue(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\'loadKg\',this.value)" aria-label="Weight in kilograms"><span>kg</span><button type="button" onclick="winterArcAdjustSet(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\'loadKg\',0.5)" data-wa-key="load-plus:'+set.id+'" aria-label="Increase weight">+</button></div>':'';
    var workControl='<div class="wa-stepper"><button type="button" onclick="winterArcAdjustSet(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\''+valueField+'\',-'+stepAmount+')" data-wa-key="work-minus:'+set.id+'" aria-label="Decrease '+workLabel+'">−</button><input type="number" min="0" step="'+stepAmount+'" data-wa-key="work:'+set.id+'" value="'+value+'" onchange="winterArcSetValue(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\''+valueField+'\',this.value)" aria-label="'+(isTime?'Seconds':isDistance?'Distance in metres':unit.charAt(0).toUpperCase()+unit.slice(1))+'"><span>'+workUnit+'</span><button type="button" onclick="winterArcAdjustSet(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\''+valueField+'\','+stepAmount+')" data-wa-key="work-plus:'+set.id+'" aria-label="Increase '+workLabel+'">+</button></div>';
    return '<div class="wa-set-row'+(set.done?' done':'')+'"><button type="button" class="wa-one-tap" data-wa-key="done:'+set.id+'" onclick="winterArcToggleSet(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\')"'+(exercise.stopLatched?' disabled':'')+' aria-pressed="'+(set.done?'true':'false')+'" aria-label="Mark set '+(index+1)+' complete">'+(set.done?'✓':'S'+(index+1))+'</button>'+loadControl+workControl+'<div class="wa-rating" role="group" aria-label="Effort">'+['Easy','Right','Hard'].map(function(v){return '<button type="button" data-wa-key="effort:'+set.id+':'+v+'" aria-pressed="'+(set.effort===v?'true':'false')+'" class="'+(set.effort===v?'selected':'')+'" onclick="winterArcSetRating(\''+session.id+'\',\''+exercise.id+'\',\''+set.id+'\',\'effort\',\''+v+'\')">'+v+'</button>'}).join('')+'</div></div>'}
  function exerciseCard(session,exercise){var next=exercise.next,swap=exercise.swapFlag?'<div class="wa-stop-callout" role="alert"><strong>Stop this exercise.</strong> '+esc(exercise.swap?'Swap to '+exercise.swap+'.':'Skip it today and follow clinical guidance.')+(exercise.swap?'<button type="button" data-wa-key="swap:'+exercise.id+'" class="btn btn-sm" onclick="winterArcUseSwap(\''+session.id+'\',\''+exercise.id+'\')">Use '+esc(exercise.swap)+'</button>':'')+'<button type="button" data-wa-key="skip:'+exercise.id+'" class="btn btn-sm btn-ghost" onclick="winterArcSkipExercise(\''+session.id+'\',\''+exercise.id+'\')">Skip exercise</button>'+'</div>':'';return '<section class="wa-exercise'+(exercise.coreMicrodose?' wa-core-exercise':'')+'" data-wa-exercise="'+esc(exercise.id)+'" tabindex="-1"><div class="wa-exercise-head"><div><span>'+(exercise.coreMicrodose?'DAILY CORE · ':'')+esc(exercise.exerciseId)+'</span><h3>'+esc(exercise.name)+'</h3><p>'+(exercise.range?exercise.range[0]+'–'+exercise.range[1]+' '+esc(exercise.unit||'reps')+' · ':'')+'RIR '+exercise.targetRir+(exercise.sides?' · '+esc(exercise.sides):'')+' · rest '+exercise.restSec+'s</p></div><div class="wa-exercise-actions">'+(exercise.mode==='ladder'?'<div class="wa-rung"><button type="button" data-wa-key="rung-minus:'+exercise.id+'" onclick="winterArcChangeRung(\''+session.id+'\',\''+exercise.id+'\',-1)">−</button><span>Rung '+Number(exercise.rung||1)+'</span><button type="button" data-wa-key="rung-plus:'+exercise.id+'" onclick="winterArcChangeRung(\''+session.id+'\',\''+exercise.id+'\',1)">+</button></div>':'')+'<button type="button" data-wa-key="same:'+exercise.id+'" class="btn btn-sm btn-ghost" onclick="winterArcSameLast(\''+session.id+'\',\''+exercise.id+'\')">Same as last time</button><button type="button" data-wa-key="add-set:'+exercise.id+'" class="btn btn-sm btn-ghost" onclick="winterArcAddSet(\''+session.id+'\',\''+exercise.id+'\')"'+(exercise.sets.length>=12?' disabled':'')+'>+ Add set</button></div></div>'+swap+'<div class="wa-sets">'+exercise.sets.map(function(set,index){return setControl(session,exercise,set,index)}).join('')+'</div>'+(next?'<div class="wa-next"><strong>Next:</strong> '+esc(next.reason)+(next.loadKg!=null?' · '+next.loadKg+'kg':'')+'</div>':'')+'</section>'}

  function sessionMainCard(occurrence){
    if(!occurrence||occurrence.kind==='strength'||occurrence.kind==='rest')return '';
    var prescription=occurrence.interval&&occurrence.interval.label||(occurrence.blocks||[]).map(function(block){return block[0]+' '+block[1]+' min'}).join(' · ')||(occurrence.options||[]).join(' · ')||occurrence.label;
    return '<div class="wa-cardio-session"><strong>'+esc(occurrence.label)+'</strong><p>'+esc(prescription)+'</p>'+(occurrence.core?'<span class="wa-core-chip">Daily core · '+esc(occurrence.core.label)+'</span>':'')+'</div>';
  }

  function previousBestE1rm(exerciseId,beforeDate){var best=0;Object.keys(STATE.trainingSessions||{}).forEach(function(id){var session=STATE.trainingSessions[id];if(!session||session.status!=='completed'||session.date>=beforeDate)return;var ex=(session.exercises||[]).find(function(item){return item.exerciseId===exerciseId});(ex&&ex.sets||[]).forEach(function(set){if(set.done&&Number(set.loadKg)>0&&Number(set.reps)>0)best=Math.max(best,Number(set.loadKg)*(1+Number(set.reps)/30))})});return best}

  global.renderWinterArcPreview=function(value,existing){var key=value||localDateKey(new Date()),occurrence=winterArcOccurrence(key),content=winterArcContent();if(!occurrence||!content)return;var future=key>localDateKey(new Date());content.innerHTML='<div class="wa-modal-kicker">SESSION PREVIEW</div><h2>'+esc(occurrence.code+' · '+occurrence.label)+'</h2><div class="modal-sub">'+esc(fmtDate(key))+' · '+esc(phaseCopy(occurrence))+'</div><div class="wa-safety-banner planned"><strong>Preview only</strong><span>'+(future?'This session unlocks on '+esc(fmtDate(key))+'.':'This session was scheduled for '+esc(fmtDate(key))+'.')+' Opening a preview does not create a workout.</span></div><ul class="wa-plan-details">'+occurrenceDetail(occurrence)+'</ul>'+(existing&&existing.status==='in-progress'?'<div class="wa-stop-callout"><strong>An older preview draft is still marked in progress.</strong><span>Discard it to remove the test session.</span></div>':'')+'<div class="modal-btns">'+(existing&&existing.status==='in-progress'?'<button type="button" class="btn btn-danger" onclick="deleteWinterArcSession(\''+existing.id+'\')">Discard draft</button>':'')+'<button type="button" class="btn btn-accent" onclick="closeWinterArcPage()">Close preview</button></div>'}

  global.renderWinterArcLogger=function(sessionId){
    var session=(STATE.trainingSessions||{})[sessionId],content=winterArcContent();if(!session||!content)return;var focused=document.activeElement,focusKey=focused&&focused.getAttribute&&focused.getAttribute('data-wa-key'),scrollTop=content.scrollTop;var occurrence=effectiveWinterArcOccurrence(session.date)||winterArcOccurrence(session.date);
    if(session.status==='completed'){content.innerHTML='<div class="wa-modal-kicker">SESSION COMPLETE</div><h2>'+esc(session.label)+'</h2><div class="wa-session-summary"><strong>'+(Number(session.durationSec||0)>0?Math.floor(Number(session.durationSec)/60)+' min':'Completed')+'</strong><span>'+esc(fmtDate(session.date))+'</span></div>'+(session.exercises||[]).map(function(ex){var best=(ex.sets||[]).filter(function(s){return s.done}).sort(function(a,b){return Number(b.loadKg||0)*(1+Number(b.reps||0)/30)-Number(a.loadKg||0)*(1+Number(a.reps||0)/30)})[0],e1=!ex.coreMicrodose&&best&&best.loadKg&&best.reps?Math.round(Number(best.loadKg)*(1+Number(best.reps)/30)*10)/10:null,previousBest=previousBestE1rm(ex.exerciseId,session.date),isPr=e1&&e1>previousBest+0.01;return '<div class="wa-summary-row"><span>'+esc(ex.name)+(isPr?' <b class="wa-pr">PR</b>':'')+'</span><strong>'+(e1?'e1RM '+e1+'kg':'Complete')+'</strong><small>'+esc(ex.next&&ex.next.reason||'')+(ex.next&&ex.next.loadKg!=null?' · next '+ex.next.loadKg+'kg':'')+'</small></div>'}).join('')+'<div class="modal-btns"><button type="button" data-wa-key="finish" class="btn btn-accent" onclick="closeWinterArcPage()">Done</button></div>';content.scrollTop=scrollTop;if(focusKey==='finish'){var completedFocus=content.querySelector('[data-wa-key="finish"]');if(completedFocus)setTimeout(function(){completedFocus.focus({preventScroll:true})},0)}return}
    content.innerHTML='<div class="wa-logger-head"><div><div class="wa-modal-kicker">'+esc(phaseCopy(occurrence))+'</div><h2>'+esc(session.label)+'</h2><p>'+esc(fmtDate(session.date))+'</p></div></div>'+(session.safety&&session.safety.action!=='planned'?'<div class="wa-safety-banner '+esc(session.safety.level)+'"><strong>'+esc(session.safety.title)+'</strong><span>'+esc(session.safety.message)+'</span></div>':'')+sessionMainCard(occurrence)+(session.exercises&&session.exercises.length?session.exercises.map(function(ex){return exerciseCard(session,ex)}).join(''):'')+'<div class="wa-logger-footer"><span>Finish when you have completed the planned workout. This confirms the 45-minute rule.</span><div class="wa-logger-footer-actions"><button type="button" class="btn btn-ghost" onclick="deleteWinterArcSession(\''+session.id+'\')">Discard session</button><button type="button" data-wa-key="finish" class="btn btn-accent" onclick="finishWinterArcWorkout(\''+session.id+'\')">Finish session</button></div></div>';
    content.scrollTop=scrollTop;if(focusKey){var safeKey=typeof CSS!=='undefined'&&CSS.escape?CSS.escape(focusKey):focusKey.replace(/"/g,'\\"'),focusTarget=content.querySelector('[data-wa-key="'+safeKey+'"]');if(!focusTarget&&/^(swap|skip):/.test(focusKey)){var exerciseKey=focusKey.slice(focusKey.indexOf(':')+1),safeExercise=typeof CSS!=='undefined'&&CSS.escape?CSS.escape(exerciseKey):exerciseKey;focusTarget=content.querySelector('[data-wa-exercise="'+safeExercise+'"]')}if(focusTarget)setTimeout(function(){focusTarget.focus({preventScroll:true})},0)}if(pendingSetFocus){var newSetFocus=content.querySelector('[data-wa-key="done:'+pendingSetFocus+'"]');pendingSetFocus=null;if(newSetFocus)setTimeout(function(){newSetFocus.focus({preventScroll:true})},0)}
  };

  global.openWinterArcWorkout=function(value){
    var key=value||localDateKey(new Date()),occurrence=effectiveWinterArcOccurrence(key);if(!occurrence)return;var id=occurrence.id,existing=(STATE.trainingSessions||{})[id],active=document.querySelector('.page.active'),returnPage=active&&!active.id.includes('winter-arc')?active.id.replace(/^page-/,''):'workout',returnTab=returnPage==='workout'?activeWorkoutTab():'overview',base={date:key,returnPage:returnPage,returnTab:returnTab,opener:document.activeElement};
    if(existing&&existing.status==='completed'){openWinterArcPageRoute(Object.assign(base,{mode:'logger',sessionId:id}));return}
    if(key!==localDateKey(new Date())){openWinterArcPageRoute(Object.assign(base,{mode:'preview',sessionId:existing&&existing.id||null}));return}
    id=startWinterArcSession(key);if(!id){if(typeof showCelebrationToast==='function')showCelebrationToast('Full rest is selected for today','♡');return}openWinterArcPageRoute(Object.assign(base,{mode:'logger',sessionId:id}));
  };
  global.finishWinterArcWorkout=function(sessionId){var s=(STATE.trainingSessions||{})[sessionId];if(!s)return;if(finishWinterArcSession(sessionId)){if(typeof showCelebrationToast==='function')showCelebrationToast('Workout completed','✨');renderWinterArcLogger(sessionId)}else{if(typeof showCelebrationToast==='function')showCelebrationToast('Resolve the safety stop or full-rest choice first','♡');renderWinterArcLogger(sessionId)}};
  global.deleteWinterArcSession=function(sessionId){var session=(STATE.trainingSessions||{})[sessionId];if(!session)return;var showing=!!(winterArcRoute&&winterArcRoute.sessionId===sessionId);confirmDelete('Delete this Winter Arc session? The dated plan remains available.',function(){if(!removeWinterArcSession(sessionId))return false;if(showing)setTimeout(closeWinterArcPage,0);return true})};
})(typeof window!=='undefined'?window:globalThis);
