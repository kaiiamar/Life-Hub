// ============================================================
// REVISIONED DOMAIN PERSISTENCE
// ============================================================
var LIFEHUB_SCHEMA_VERSION=5;
var LIFEHUB_QUEUE_KEY='lifehub_sync_queue_v2';
var LIFEHUB_CONFLICT_KEY='lifehub_sync_conflicts_v2';
var LIFEHUB_META_KEY='lifehub_local_meta_v2';
var LIFEHUB_CLIENT_KEY='lifehub_client_id_v1';
var LIFEHUB_MAX_STATE_BYTES=4*1024*1024;
var LIFEHUB_MAX_DOMAIN_BYTES=700*1024;
var LIFEHUB_MAX_IMPORT_BYTES=5*1024*1024;
var _domainRevisions={};
var _domainExists={};
var _cloudData={};
var _localSnapshots={};
var _pendingDomains={};
var _syncConflicts={};
var _syncReady=false;
var _syncWriting=false;
var _domainSnapshotLoaded=false;
var _bootstrapDirtyDomains={};
var _capturedUndo=null;
var _undoRecord=null;
var _storageIssue=false;
var _storageMessage='';
var _cloudIssue=null;
var _syncRetryTimer=null;
var _syncRetryAttempt=0;
var _syncRetryMaxMs=60000;
var _clientId=_loadClientId();

function _loadClientId(){
  try{var id=localStorage.getItem(LIFEHUB_CLIENT_KEY);if(id)return id;id='web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);localStorage.setItem(LIFEHUB_CLIENT_KEY,id);return id}catch(e){return 'web-session-'+Math.random().toString(36).slice(2,10)}
}
function _clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function _byteLength(value){var text=typeof value==='string'?value:JSON.stringify(value);try{return new Blob([text]).size}catch(e){return unescape(encodeURIComponent(text)).length}}
function _stable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(_stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+_stable(value[k])}).join(',')+'}'
}
function _same(a,b){return _stable(a)===_stable(b)}
function _validDomainName(name){return /^[A-Za-z_$][A-Za-z0-9_$-]{0,99}$/.test(name)&&name.indexOf('/')===-1&&name!=='__proto__'&&name!=='prototype'&&name!=='constructor'}
function _timestampText(value){try{if(value&&typeof value.toDate==='function')return value.toDate().toISOString();if(value)return new Date(value).toISOString()}catch(e){}return null}
function _domainKeys(state){return state&&typeof state==='object'?Object.keys(state).filter(_validDomainName):[]}
function _isPlainRecord(value){if(!value||typeof value!=='object'||Array.isArray(value))return false;var proto=Object.getPrototypeOf(value);return proto===Object.prototype||proto===null}
function _localDayKeyNow(){var d=new Date();var m=String(d.getMonth()+1).padStart(2,'0');var day=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+day}
function _validDateKey(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  var parts=value.split('-'),date=new Date(+parts[0],+parts[1]-1,+parts[2]);
  return date.getFullYear()===+parts[0]&&date.getMonth()===+parts[1]-1&&date.getDate()===+parts[2];
}
var LIFEHUB_HABIT_INTEGRATIONS={
  'lifehub.workout.any':true,
  'lifehub.workout.hyrox':true,
  'lifehub.run.any':true,
  'lifehub.skincare.am':true,
  'lifehub.skincare.pm':true
};
function _validHabitSourceKey(value){return typeof value==='string'&&/^(workout|run|skincare):[A-Za-z0-9_-]{1,100}$/.test(value)}
function _habitProvenancePresent(entry){
  if(!_isPlainRecord(entry))return false;
  if(entry.manual===true)return true;
  return _isPlainRecord(entry.sources)&&Object.keys(entry.sources).some(function(key){return entry.sources[key]===true});
}
function _normalizeHabitProvenance(h){
  var changed=false;
  if(h.integrationKeys===undefined){h.integrationKeys=[];changed=true}
  if(Array.isArray(h.integrationKeys)){
    var unique=[];h.integrationKeys.forEach(function(key){if(unique.indexOf(key)===-1)unique.push(key)});
    if(!_same(unique,h.integrationKeys)){h.integrationKeys=unique;changed=true}
  }
  if(h.logProvenance===undefined){h.logProvenance={};changed=true}
  if(h.provenanceVersion===undefined){h.provenanceVersion=1;changed=true}
  if(!_isPlainRecord(h.logs)||!_isPlainRecord(h.logProvenance))return changed;
  Object.keys(h.logs).forEach(function(dateKey){
    if(h.logs[dateKey]===false){delete h.logs[dateKey];changed=true;return}
    if(h.logs[dateKey]===true&&_validDateKey(dateKey)&&!_habitProvenancePresent(h.logProvenance[dateKey])){
      h.logProvenance[dateKey]={manual:true,sources:{}};changed=true;
    }
  });
  Object.keys(h.logProvenance).forEach(function(dateKey){
    var entry=h.logProvenance[dateKey];if(!_isPlainRecord(entry))return;
    if(entry.manual===false){delete entry.manual;changed=true}
    if(entry.sources===undefined){entry.sources={};changed=true}
    if(_isPlainRecord(entry.sources))Object.keys(entry.sources).forEach(function(sourceKey){if(entry.sources[sourceKey]===false){delete entry.sources[sourceKey];changed=true}});
    if(!_habitProvenancePresent(entry)){
      delete h.logProvenance[dateKey];
      if(h.logs[dateKey]===true)delete h.logs[dateKey];
      changed=true;return;
    }
    if(h.logs[dateKey]!==true){h.logs[dateKey]=true;changed=true}
  });
  return changed;
}
function normalizeLifeHubHabits(state){
  if(!state||!Array.isArray(state.habits))return false;
  var changed=false,today=_localDayKeyNow();
  state.habits.forEach(function(h,index){
    if(!_isPlainRecord(h))return;
    if(h.id===undefined){h.id=typeof g==='function'?g():'habit-'+Date.now().toString(36)+'-'+index;changed=true}
    if(typeof h.name==='string'&&h.name!==h.name.trim()){h.name=h.name.trim();changed=true}
    if(h.freq===undefined){h.freq='daily';changed=true}
    if(typeof h.freq==='string'&&h.freq!==h.freq.trim().toLowerCase()){h.freq=h.freq.trim().toLowerCase();changed=true}
    if(h.freq==='bi-monthly'){h.freq='fortnightly';changed=true}
    if(h.badge===undefined){h.badge='per';changed=true}
    if(h.icon===undefined){h.icon='';changed=true}
    if(h.note===undefined){h.note='';changed=true}
    if(h.anchor===undefined){h.anchor=typeof autoSuggestAnchor==='function'?autoSuggestAnchor(h.name):'anytime';changed=true}
    if(h.logs===undefined){h.logs={};changed=true}
    if(h.lifecycle===undefined){h.lifecycle={version:1,inactivePeriods:[]};changed=true}
    if(_normalizeHabitProvenance(h))changed=true;
    var trueLogKeys=_isPlainRecord(h.logs)?Object.keys(h.logs).filter(function(key){return h.logs[key]===true&&_validDateKey(key)}).sort():[];
    if(h.startDate===undefined){h.startDate=trueLogKeys.length?trueLogKeys[0]:today;changed=true}
    else if(_validDateKey(h.startDate)&&trueLogKeys.length&&trueLogKeys[0]<h.startDate){h.startDate=trueLogKeys[0];changed=true}
  });
  return changed;
}
function _validateHabitRecords(habits,add){
  if(!Array.isArray(habits))return;
  if(habits.length>500)add('state.habits','cannot contain more than 500 habits');
  var ids=Object.create(null),allowedBadges={fit:true,fin:true,car:true,per:true},allowedAnchors={morning:true,midday:true,evening:true,anytime:true};
  habits.forEach(function(h,index){
    var path='state.habits['+index+']';
    if(!_isPlainRecord(h)){add(path,'must be a plain object');return}
    if(typeof h.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(h.id))add(path+'.id','must be 1–80 letters, numbers, underscores, or dashes');
    else if(ids[h.id])add(path+'.id','must be unique');else ids[h.id]=true;
    if(typeof h.name!=='string'||!h.name.trim())add(path+'.name','is required');else if(h.name.length>120)add(path+'.name','cannot exceed 120 characters');
    var freq=typeof h.freq==='string'?h.freq.toLowerCase():'';
    if(!/^(daily|weekly|fortnightly|monthly|[1-7]x\/week)$/.test(freq))add(path+'.freq','must be daily, weekly, 1–7x/week, fortnightly, or monthly');
    if(typeof h.badge!=='string'||!allowedBadges[h.badge])add(path+'.badge','has an unknown category');
    if(typeof h.anchor!=='string'||!allowedAnchors[h.anchor])add(path+'.anchor','has an unknown time anchor');
    if(typeof h.icon!=='string'||h.icon.length>32)add(path+'.icon','must be text up to 32 characters');
    if(typeof h.note!=='string'||h.note.length>500)add(path+'.note','must be text up to 500 characters');
    if(!_isPlainRecord(h.lifecycle))add(path+'.lifecycle','must be an object');
    else{
      Object.keys(h.lifecycle).forEach(function(key){if(key!=='version'&&key!=='inactivePeriods')add(path+'.lifecycle.'+key,'is not supported')});
      if(h.lifecycle.version!==1)add(path+'.lifecycle.version','must be version 1');
      if(!Array.isArray(h.lifecycle.inactivePeriods))add(path+'.lifecycle.inactivePeriods','must be an array');
      else{
        var ranges=h.lifecycle.inactivePeriods,previous=null,openCount=0;
        if(ranges.length>200)add(path+'.lifecycle.inactivePeriods','cannot contain more than 200 ranges');
        ranges.forEach(function(range,rangeIndex){
          var rangePath=path+'.lifecycle.inactivePeriods['+rangeIndex+']';
          if(!_isPlainRecord(range)){add(rangePath,'must be an object');return}
          Object.keys(range).forEach(function(key){if(key!=='kind'&&key!=='from'&&key!=='to')add(rangePath+'.'+key,'is not supported')});
          if(range.kind!=='paused'&&range.kind!=='archived')add(rangePath+'.kind','must be paused or archived');
          if(!_validDateKey(range.from))add(rangePath+'.from','must be a valid YYYY-MM-DD date');
          if(range.to!==null&&!_validDateKey(range.to))add(rangePath+'.to','must be null or a valid YYYY-MM-DD date');
          if(_validDateKey(range.from)&&range.to!==null&&_validDateKey(range.to)&&range.to<=range.from)add(rangePath+'.to','must be after from');
          if(range.to===null)openCount++;
          if(previous&&_validDateKey(previous.from)&&_validDateKey(range.from)){
            if(previous.to===null)add(rangePath+'.from','cannot follow an open range');
            else if(_validDateKey(previous.to)&&range.from<previous.to)add(rangePath+'.from','must not overlap the previous range');
          }
          previous=range;
        });
        if(openCount>1)add(path+'.lifecycle.inactivePeriods','can contain at most one open range');
      }
    }
    if(!_validDateKey(h.startDate))add(path+'.startDate','must be a valid YYYY-MM-DD date');
    if(h.provenanceVersion!==1)add(path+'.provenanceVersion','must be version 1');
    if(!Array.isArray(h.integrationKeys))add(path+'.integrationKeys','must be an array');
    else{
      if(h.integrationKeys.length>5)add(path+'.integrationKeys','cannot contain more than 5 links');
      h.integrationKeys.forEach(function(key,keyIndex){if(typeof key!=='string'||!LIFEHUB_HABIT_INTEGRATIONS[key])add(path+'.integrationKeys['+keyIndex+']','has an unknown integration')});
    }
    if(!_isPlainRecord(h.logs)){add(path+'.logs','must be an object of date completions');return}
    if(!_isPlainRecord(h.logProvenance)){add(path+'.logProvenance','must be an object');return}
    var logKeys=Object.keys(h.logs);if(logKeys.length>5000)add(path+'.logs','has too many completion dates');
    logKeys.forEach(function(key){
      if(!_validDateKey(key))add(path+'.logs.'+key,'must use a valid YYYY-MM-DD date');
      else if(_validDateKey(h.startDate)&&key<h.startDate)add(path+'.logs.'+key,'cannot be before the habit start date');
      if(h.logs[key]!==true)add(path+'.logs.'+key,'must be true or omitted');
      if(!_habitProvenancePresent(h.logProvenance[key]))add(path+'.logs.'+key,'must have completion provenance');
    });
    var provenanceKeys=Object.keys(h.logProvenance);if(provenanceKeys.length>5000)add(path+'.logProvenance','has too many completion dates');
    provenanceKeys.forEach(function(dateKey){
      var entry=h.logProvenance[dateKey],entryPath=path+'.logProvenance.'+dateKey;
      if(!_validDateKey(dateKey))add(entryPath,'must use a valid YYYY-MM-DD date');
      else if(_validDateKey(h.startDate)&&dateKey<h.startDate)add(entryPath,'cannot be before the habit start date');
      if(!_isPlainRecord(entry)){add(entryPath,'must be an object');return}
      Object.keys(entry).forEach(function(key){if(key!=='manual'&&key!=='sources')add(entryPath+'.'+key,'is not supported')});
      if(entry.manual!==undefined&&entry.manual!==true)add(entryPath+'.manual','must be true or omitted');
      if(!_isPlainRecord(entry.sources)){add(entryPath+'.sources','must be an object');return}
      var sourceKeys=Object.keys(entry.sources);if(sourceKeys.length>50)add(entryPath+'.sources','has too many sources');
      sourceKeys.forEach(function(sourceKey){if(!_validHabitSourceKey(sourceKey))add(entryPath+'.sources.'+sourceKey,'has an invalid source key');else if(entry.sources[sourceKey]!==true)add(entryPath+'.sources.'+sourceKey,'must be true or omitted')});
      if(!_habitProvenancePresent(entry))add(entryPath,'must contain a manual or source completion');
      if(h.logs[dateKey]!==true)add(entryPath,'must project to logs');
    });
  });
}
function validateHabitDomainData(data){
  var holder={habits:_clone(data)};normalizeLifeHubHabits(holder);var errors=[];
  function add(path,message){if(errors.length<12)errors.push(path+': '+message)}
  if(!Array.isArray(holder.habits))add('state.habits','expected array');else _validateHabitRecords(holder.habits,add);
  return {ok:errors.length===0,errors:errors,data:holder.habits};
}

function _validateChallengeRecords(challenges,habits,add){
  if(!_isPlainRecord(challenges))return;
  var legacyHabitKeys=['steps','movement','duolingo','manna','food','alcohol','career'];
  var winterRuleIds=['steps','workout','water','duolingo','reading','manna','alcohol','eating'];
  var habitIds=Object.create(null);(Array.isArray(habits)?habits:[]).forEach(function(h){if(h&&typeof h.id==='string')habitIds[h.id]=true});
  Object.keys(challenges).forEach(function(id){
    var challenge=challenges[id],path='state.challenges.'+id;
    if(!_isPlainRecord(challenge)){add(path,'must be a plain object');return}
    if(challenge.id!==id)add(path+'.id','must match its challenge key');
    if(typeof challenge.title!=='string'||!challenge.title.trim()||challenge.title.length>120)add(path+'.title','must be 1–120 characters');
    if(!_validDateKey(challenge.startDate))add(path+'.startDate','must be a valid YYYY-MM-DD date');
    if(!_validDateKey(challenge.endDate))add(path+'.endDate','must be a valid YYYY-MM-DD date');
    if(_validDateKey(challenge.startDate)&&_validDateKey(challenge.endDate)){
      var a=challenge.startDate.split('-').map(Number),b=challenge.endDate.split('-').map(Number);
      var span=Math.round((Date.UTC(b[0],b[1]-1,b[2])-Date.UTC(a[0],a[1]-1,a[2]))/86400000)+1;
      if(span!==75)add(path+'.endDate','must make the challenge exactly 75 inclusive days');
    }
    if(challenge.continuation!=='continue')add(path+'.continuation','must be continue');
    if(!Number.isFinite(challenge.waterTargetMl)||challenge.waterTargetMl<=0)add(path+'.waterTargetMl','must be a positive number');
    if(!Number.isFinite(challenge.waterGlassMl)||challenge.waterGlassMl<=0)add(path+'.waterGlassMl','must be a positive number');
    if(challenge.definitionVersion===1&&challenge.planId==='winter-arc-75-me-2026'){
      if(challenge.startDate!=='2026-10-05'||challenge.endDate!=='2026-12-18')add(path+'.startDate','must match the immutable Winter Arc dates');
      if(challenge.planVersion!==1)add(path+'.planVersion','must be 1');
      if(!Array.isArray(challenge.ruleIds)||challenge.ruleIds.length!==8||new Set(challenge.ruleIds).size!==8||winterRuleIds.some(function(rule){return challenge.ruleIds.indexOf(rule)===-1}))add(path+'.ruleIds','must contain the eight Winter Arc rules exactly once');
      if(!_isPlainRecord(challenge.habitIds))add(path+'.habitIds','must be an object');
      else ['duolingo','manna'].forEach(function(key){var value=challenge.habitIds[key];if(typeof value!=='string'||!habitIds[value])add(path+'.habitIds.'+key,'must reference an existing habit')});
      return;
    }
    if(!_isPlainRecord(challenge.habitIds))add(path+'.habitIds','must be an object');
    else{
      var references=[];
      legacyHabitKeys.forEach(function(key){
        var value=challenge.habitIds[key];
        if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value))add(path+'.habitIds.'+key,'must reference a valid habit id');
        else{references.push(value);if(!habitIds[value])add(path+'.habitIds.'+key,'must reference an existing habit')}
      });
      if(new Set(references).size!==references.length)add(path+'.habitIds','must reference seven distinct habits');
    }
  });
}

function _validateWinterArcDomains(state,add){
  if(_isPlainRecord(state.dailyCheckIns))Object.keys(state.dailyCheckIns).forEach(function(key){
    var row=state.dailyCheckIns[key],path='state.dailyCheckIns.'+key;if(!_validDateKey(key)){add(path,'key must be a valid date');return}if(!_isPlainRecord(row)){add(path,'must be an object');return}
    if(row.date!==undefined&&row.date!==key)add(path+'.date','must match its date key');
    [['hipPain',0,10],['sleepHours',0,24],['steps',0,200000],['proteinG',0,1000],['calories',0,20000]].forEach(function(rule){var v=row[rule[0]];if(v!==undefined&&(!Number.isFinite(v)||v<rule[1]||v>rule[2]))add(path+'.'+rule[0],'is outside its allowed range')});
    if(row.alcoholState!==undefined&&['none','special-occasion','outside-plan'].indexOf(row.alcoholState)===-1)add(path+'.alcoholState','is invalid');
    if(row.balancedPortionsConfirmed!==undefined&&typeof row.balancedPortionsConfirmed!=='boolean')add(path+'.balancedPortionsConfirmed','must be boolean');
  });
  if(_isPlainRecord(state.trainingSessions))Object.keys(state.trainingSessions).forEach(function(id){
    var session=state.trainingSessions[id],path='state.trainingSessions.'+id;if(!_isPlainRecord(session)){add(path,'must be an object');return}if(session.id!==id)add(path+'.id','must match its occurrence key');if(!_validDateKey(session.date))add(path+'.date','must be a valid date');if(session.planId!=='winter-arc-75-me-2026'||session.planVersion!==1)add(path+'.planId','must reference Winter Arc v1');if(['planned','in-progress','completed'].indexOf(session.status)===-1)add(path+'.status','is invalid');if(!Array.isArray(session.exercises))add(path+'.exercises','must be an array');if(!Number.isFinite(Number(session.durationSec))||Number(session.durationSec)<0)add(path+'.durationSec','must be non-negative');
    var canonical=typeof winterArcOccurrence==='function'&&_validDateKey(session.date)?winterArcOccurrence(session.date):null;if(!canonical)add(path+'.date','must fall inside the Winter Arc block');else if(id!==canonical.id)add(path+'.id','must be the deterministic occurrence id');
    if(session.occurrenceId!==id)add(path+'.occurrenceId','must match the deterministic occurrence id');
    var rawVariant=canonical&&session.code===canonical.code&&session.kind===canonical.kind&&session.qualifies===true,recoveryVariant=canonical&&session.code==='REC-SAFETY'&&session.kind==='recovery'&&session.qualifies===true,restVariant=canonical&&session.code==='REST-SAFETY'&&session.kind==='rest'&&session.qualifies===false;
    if(canonical&&!rawVariant&&!recoveryVariant&&!restVariant)add(path+'.code','must be a canonical or safety-override variant');
    if((recoveryVariant||restVariant)&&(!Array.isArray(session.exercises)||session.exercises.length!==0))add(path+'.exercises','safety override sessions cannot retain active planned exercises');
    if(session.status==='completed'&&(typeof session.startedAt!=='string'||typeof session.completedAt!=='string'))add(path+'.completedAt','completed sessions require start and completion timestamps');
    if(session.planContentRevision!==undefined&&session.planContentRevision!=='1.1')add(path+'.planContentRevision','is not supported');
    var expectedDefs=[],canonicalExerciseDefs={},enforceCurrentContent=session.planContentRevision==='1.1';if(canonical&&rawVariant&&(canonical.kind==='strength'||enforceCurrentContent)){expectedDefs=(canonical.exercises||[]).filter(function(def){var count=def.fixedSets!==undefined?def.fixedSets:(def.phaseSets&&def.phaseSets[canonical.phase.key]!==undefined?def.phaseSets[canonical.phase.key]:canonical.phase.mainSets);return count>0});expectedDefs.forEach(function(def){canonicalExerciseDefs[def.id]=def});if(!Array.isArray(session.exercises)||session.exercises.length!==expectedDefs.length)add(path+'.exercises','must contain every scheduled exercise')}
    var exerciseIds={},setIds={};
    (Array.isArray(session.exercises)?session.exercises:[]).forEach(function(ex,ei){var ep=path+'.exercises['+ei+']';if(!_isPlainRecord(ex)||typeof ex.id!=='string'||typeof ex.exerciseId!=='string'){add(ep,'must have stable IDs');return}if(ex.id!==id+'__'+ex.exerciseId)add(ep+'.id','must be deterministic');if(exerciseIds[ex.exerciseId])add(ep+'.exerciseId','must be unique');exerciseIds[ex.exerciseId]=true;var scheduledDef=canonical&&canonical.exercises&&(canonical.exercises||[]).find(function(def){return def.id===ex.exerciseId}),allowed=!!scheduledDef;if(!allowed)add(ep+'.exerciseId','is not part of the scheduled occurrence');if(scheduledDef&&scheduledDef.mode==='ladder'){var maxRung=Math.max(1,Number(scheduledDef.rungs||7));if(!Number.isFinite(Number(ex.rung))||Number(ex.rung)<1||Number(ex.rung)>maxRung)add(ep+'.rung','must be within the exercise ladder');if(ex.nextRung!==undefined&&(Number(ex.nextRung)<1||Number(ex.nextRung)>maxRung))add(ep+'.nextRung','must be within the exercise ladder')}var expectedDef=canonicalExerciseDefs[ex.exerciseId];if(expectedDef){var expectedSets=expectedDef.mode==='skill'?1:(expectedDef.fixedSets!==undefined?expectedDef.fixedSets:(expectedDef.phaseSets&&expectedDef.phaseSets[canonical.phase.key]!==undefined?expectedDef.phaseSets[canonical.phase.key]:canonical.phase.mainSets));if(!Array.isArray(ex.sets)||ex.sets.length!==expectedSets)add(ep+'.sets','must match the scheduled set count')}if(!Array.isArray(ex.sets))add(ep+'.sets','must be an array');(Array.isArray(ex.sets)?ex.sets:[]).forEach(function(set,si){var sp=ep+'.sets['+si+']';if(!_isPlainRecord(set)||typeof set.id!=='string')add(sp,'must have a stable ID');else{if(set.id!==ex.id+'__s'+(si+1))add(sp+'.id','must be deterministic');if(setIds[set.id])add(sp+'.id','must be unique');setIds[set.id]=true;if(set.pain!==undefined&&['None','Niggle','Stop'].indexOf(set.pain)===-1)add(sp+'.pain','is invalid');if(set.effort!==undefined&&['Easy','Right','Hard'].indexOf(set.effort)===-1)add(sp+'.effort','is invalid');if(set.done!==undefined&&typeof set.done!=='boolean')add(sp+'.done','must be boolean')}})});
  });
  if(_isPlainRecord(state.reading)){
    if(!_isPlainRecord(state.reading.sessions))add('state.reading.sessions','must be an object');
    else Object.keys(state.reading.sessions).forEach(function(id){var item=state.reading.sessions[id],path='state.reading.sessions.'+id;if(!_isPlainRecord(item)||item.id!==id)add(path,'must be an ID-keyed record');else{if(!_validDateKey(item.date))add(path+'.date','must be a valid date');if(['active','completed'].indexOf(item.status)===-1)add(path+'.status','is invalid');if(item.elapsedSec!==undefined&&(!Number.isFinite(item.elapsedSec)||item.elapsedSec<0))add(path+'.elapsedSec','must be non-negative')}});
    if(state.reading.activeSessionId!==null&&state.reading.activeSessionId!==undefined&&(!state.reading.sessions||!state.reading.sessions[state.reading.activeSessionId]))add('state.reading.activeSessionId','must reference a reading session');
  }
  if(_isPlainRecord(state.weeklyCheckIns))Object.keys(state.weeklyCheckIns).forEach(function(key){if(!_validDateKey(key)||new Date(key+'T12:00:00').getDay()!==1)add('state.weeklyCheckIns.'+key,'must use a Monday date key')});
  if(_isPlainRecord(state.cycle)){if(!Array.isArray(state.cycle.observedStarts))add('state.cycle.observedStarts','must be an array');else state.cycle.observedStarts.forEach(function(key){if(!_validDateKey(key))add('state.cycle.observedStarts','contains an invalid date')});if(!Array.isArray(state.cycle.estimates))add('state.cycle.estimates','must be an array')}
}

function validateLifeHubState(state,options){
  options=options||{};
  if(state&&typeof state==='object'&&!Array.isArray(state))normalizeLifeHubHabits(state);
  var errors=[];var nodes=0;var stringBytes=0;var dangerous=Object.create(null);dangerous.__proto__=true;dangerous.prototype=true;dangerous.constructor=true;
  var typeRules={goals:'array',habits:'array',workouts:'array',prs:'object',income:'array',expenses:'array',accounts:'array',debts:'array',savingsGoals:'array',metrics:'object',weeklyPlans:'object',reviews:'object',dailyPriorities:'object',trainingEvents:'array',challenges:'object',trainingSessions:'object',dailyCheckIns:'object',reading:'object',cycle:'object',weeklyCheckIns:'object',journal:'object',mood:'object',dailyHighlights:'object',skincare:'object',tasks:'array',relationships:'array',gratitude:'array',wishlist:'array',watchlist:'array',roadmapChecklist:'object',debtPayments:'array',plannedPayments:'array',reminders:'array',water:'object',waterSettings:'object',commitments:'array',netWorthSnapshots:'array',sweep:'object',companion:'object'};
  function add(path,message){if(errors.length<12)errors.push(path+': '+message)}
  function walk(value,path,depth){
    nodes++;if(nodes>100000){add(path,'too many values');return}if(depth>24){add(path,'nesting is too deep');return}
    if(value===null||typeof value==='boolean')return;
    if(typeof value==='number'){if(!Number.isFinite(value))add(path,'number must be finite');return}
    if(typeof value==='string'){
      stringBytes+=_byteLength(value);if(value.length>250000)add(path,'text value is too long');
      if(/^data:image\//i.test(value))add(path,'embedded images are not supported');
      if(options.importMode&&/(<\s*script\b|<\s*(iframe|object|embed)\b|javascript\s*:|on[a-z]+\s*=)/i.test(value))add(path,'executable markup is not allowed');
      return;
    }
    if(typeof value!=='object'){add(path,'unsupported value type');return}
    if(Array.isArray(value)){if(value.length>25000)add(path,'array is too large');for(var i=0;i<value.length;i++)walk(value[i],path+'['+i+']',depth+1);return}
    var proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null){add(path,'must be a plain object');return}
    var keys=Object.keys(value);if(keys.length>10000)add(path,'object has too many fields');
    keys.forEach(function(key){if(dangerous[key])add(path+'.'+key,'unsafe field name');else walk(value[key],path+'.'+key,depth+1)});
  }
  if(!state||typeof state!=='object'||Array.isArray(state))errors.push('state: must be an object');
  else{
    Object.keys(state).forEach(function(key){if(!_validDomainName(key))add('state.'+key,'invalid domain name')});
    Object.keys(typeRules).forEach(function(key){if(state[key]===undefined){if(options.requireCore)add('state.'+key,'required data area is missing');return}var expected=typeRules[key];var actual=Array.isArray(state[key])?'array':(state[key]===null?'null':typeof state[key]);if(actual!==expected)add('state.'+key,'expected '+expected)});
    _validateHabitRecords(state.habits,add);
    _validateChallengeRecords(state.challenges,state.habits,add);
    _validateWinterArcDomains(state,add);
    if(options.requireCore&&state.trainingPlan===undefined)add('state.trainingPlan','required data area is missing');
    if(options.requireCore&&state.weeklyIntention===undefined)add('state.weeklyIntention','required data area is missing');
    if(state.trainingPlan!==undefined&&state.trainingPlan!==null&&(typeof state.trainingPlan!=='object'||Array.isArray(state.trainingPlan)))add('state.trainingPlan','expected object or null');
    if(state.weeklyIntention!==undefined&&state.weeklyIntention!==null&&(typeof state.weeklyIntention!=='object'||Array.isArray(state.weeklyIntention)))add('state.weeklyIntention','expected object or null');
    walk(state,'state',0);
  }
  if(stringBytes>LIFEHUB_MAX_STATE_BYTES)add('state','contains too much text');
  try{if(_byteLength(state)>LIFEHUB_MAX_STATE_BYTES)add('state','backup exceeds '+Math.round(LIFEHUB_MAX_STATE_BYTES/1048576)+' MB')}catch(e){add('state','could not be serialized')}
  if(state&&typeof state==='object')_domainKeys(state).forEach(function(key){try{if(_byteLength(state[key])>LIFEHUB_MAX_DOMAIN_BYTES)add('state.'+key,'domain exceeds '+Math.round(LIFEHUB_MAX_DOMAIN_BYTES/1024)+' KB')}catch(e){add('state.'+key,'could not be serialized')}});
  return {ok:errors.length===0,errors:errors};
}

function _ensureTrustBanner(){
  var el=document.getElementById('lifehub-data-notice');if(el)return el;
  el=document.createElement('div');el.id='lifehub-data-notice';el.className='data-trust-banner';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.style.display='none';
  var text=document.createElement('span');text.className='data-trust-message';el.appendChild(text);
  var actions=document.createElement('div');actions.className='data-trust-actions';
  var primary=document.createElement('button');primary.type='button';primary.className='btn btn-sm data-trust-primary';primary.style.display='none';actions.appendChild(primary);
  var secondary=document.createElement('button');secondary.type='button';secondary.className='btn btn-sm btn-ghost data-trust-secondary';secondary.style.display='none';actions.appendChild(secondary);
  el.appendChild(actions);document.body.appendChild(el);return el;
}
function _showTrustNotice(message,actionLabel,actionFn,secondaryLabel,secondaryFn){
  var el=_ensureTrustBanner();el.querySelector('.data-trust-message').textContent=message;
  var primary=el.querySelector('.data-trust-primary');primary.style.display=actionLabel?'inline-flex':'none';primary.textContent=actionLabel||'';primary.onclick=actionFn||null;
  var secondary=el.querySelector('.data-trust-secondary');secondary.style.display=secondaryLabel?'inline-flex':'none';secondary.textContent=secondaryLabel||'';secondary.onclick=secondaryFn||null;
  el.style.display='flex';
}
function _hideTrustNotice(){var el=document.getElementById('lifehub-data-notice');if(el)el.style.display='none'}
function _safeCloudCode(error){
  var source=error&&error.error?error.error:error;var code=source&&source.code?String(source.code).toLowerCase():'unknown';
  code=code.replace(/^firestore\//,'').replace(/[^a-z0-9_\/-]/g,'').slice(0,80);return code||'unknown';
}
function _classifyCloudError(error,operation,options){
  options=options||{};var code=_safeCloudCode(error);var offline=typeof navigator!=='undefined'&&navigator.onLine===false;var category='unknown';
  if(operation==='auth-persistence')category='auth-persistence';
  else if(code==='unauthenticated'||code.indexOf('auth/')===0&&code!=='auth/network-request-failed')category='auth';
  else if(code==='permission-denied')category='rules';
  else if(['invalid-argument','data-loss','failed-precondition','data-validation','invalid-data'].indexOf(code)!==-1)category='data';
  else if(offline||['unavailable','deadline-exceeded','cancelled','aborted','resource-exhausted','auth/network-request-failed'].indexOf(code)!==-1)category='network';
  var copy={
    network:{message:'Cloud sync is waiting for a connection. Your changes remain queued on this device.',guidance:'Check the connection, then retry. Life Hub will also retry automatically with a short backoff.'},
    auth:{message:'Sign in is required before cloud sync can continue.',guidance:'Sign in again. Queued changes will remain on this device until authentication succeeds.'},
    'auth-persistence':{message:'This browser could not keep the Firebase session between visits.',guidance:'Sync can continue for this session. Retry session storage or review browser privacy and storage settings.'},
    rules:{message:'Cloud sync does not have permission to read or write this data.',guidance:'Confirm the deployed Firestore rules allow this signed-in account and the users/kai/domains collection.'},
    data:{message:'A cloud data check stopped sync to protect your saved information.',guidance:'Review the error code and failing area. Do not clear local data or the offline queue.'},
    unknown:{message:'Cloud sync needs attention. Your changes remain queued on this device.',guidance:'Retry once. If the issue continues, use the code below when reviewing Firebase configuration or logs.'}
  }[category];
  return {category:category,code:code,operation:operation||'sync',domain:options.domain&&_validDomainName(options.domain)?options.domain:null,message:copy.message,guidance:copy.guidance,retryable:category==='network'||category==='auth-persistence'||category==='unknown',autoRetry:category==='network',occurredAt:new Date().toISOString()};
}
function _issuePriority(issue){return {auth:5,rules:4,data:4,'auth-persistence':3,unknown:2,network:1}[issue&&issue.category]||0}
function _setCloudIssue(error,operation,options){
  var issue=_classifyCloudError(error,operation,options);var pending=Object.keys(_pendingDomains).length;
  if(_cloudIssue&&(_issuePriority(_cloudIssue)>_issuePriority(issue)||(_cloudIssue.operation==='write'&&issue.operation==='read'&&pending)))return _cloudIssue;
  _cancelSyncRetry(false);_cloudIssue=issue;_updateSyncPresentation();if(issue.autoRetry)_scheduleSyncRetry();return issue;
}
function _clearCloudIssue(operation){
  if(!_cloudIssue||operation&&_cloudIssue.operation!==operation)return false;
  _cloudIssue=null;_cancelSyncRetry(true);_updateSyncPresentation();return true;
}
function _localMetadata(){return {schemaVersion:LIFEHUB_SCHEMA_VERSION,savedAt:new Date().toISOString(),clientId:_clientId,domainRevisions:_clone(_domainRevisions),domainExists:_clone(_domainExists)}}
function _persistRevisionMetadata(){try{localStorage.setItem(LIFEHUB_META_KEY,JSON.stringify(_localMetadata()));return true}catch(e){console.warn('Local sync metadata save failed:',e);return false}}
function _persistLocalState(){
  var previousRaw=null,previousMeta=null,hadRaw=false,hadMeta=false;
  try{previousRaw=localStorage.getItem(KEY);previousMeta=localStorage.getItem(LIFEHUB_META_KEY);hadRaw=previousRaw!==null;hadMeta=previousMeta!==null}catch(readError){}
  try{
    var raw=JSON.stringify(STATE);localStorage.setItem(KEY,raw);
    localStorage.setItem(LIFEHUB_META_KEY,JSON.stringify(_localMetadata()));
    _storageIssue=false;_storageMessage='';return true;
  }catch(e){
    try{if(hadRaw)localStorage.setItem(KEY,previousRaw);else localStorage.removeItem(KEY);if(hadMeta)localStorage.setItem(LIFEHUB_META_KEY,previousMeta);else localStorage.removeItem(LIFEHUB_META_KEY)}catch(restoreError){console.warn('Previous local state could not be restored:',restoreError)}
    console.error('Local state save failed:',e);_storageIssue=true;_storageMessage='This device could not save locally. Keep this tab open while storage is checked.';setSyncStatus('storage');_showTrustNotice(_storageMessage);return false;
  }
}
function _persistQueue(){try{localStorage.setItem(LIFEHUB_QUEUE_KEY,JSON.stringify(_pendingDomains));return true}catch(e){console.warn('Sync queue could not be stored:',e);_storageIssue=true;_storageMessage='Changes are syncing from memory, but this device could not store the offline queue.';setSyncStatus('storage');_showTrustNotice(_storageMessage);return false}}
function _persistConflicts(){try{localStorage.setItem(LIFEHUB_CONFLICT_KEY,JSON.stringify(_syncConflicts));return true}catch(e){console.warn('Conflict details could not be stored:',e);_storageIssue=true;_storageMessage='A sync choice is held in this tab, but this device could not store it for reload.';return false}}
function _restorePersistenceMetadata(){
  try{var meta=JSON.parse(localStorage.getItem(LIFEHUB_META_KEY)||'{}');if(meta&&typeof meta==='object'){if(meta.domainRevisions&&typeof meta.domainRevisions==='object')_domainRevisions=meta.domainRevisions;if(meta.domainExists&&typeof meta.domainExists==='object')_domainExists=meta.domainExists}}catch(e){_domainRevisions={};_domainExists={}}
  try{var queued=JSON.parse(localStorage.getItem(LIFEHUB_QUEUE_KEY)||'{}');if(queued&&typeof queued==='object'&&!Array.isArray(queued))_pendingDomains=queued}catch(e){_pendingDomains={}}
  try{var conflicts=JSON.parse(localStorage.getItem(LIFEHUB_CONFLICT_KEY)||'{}');if(conflicts&&typeof conflicts==='object'&&!Array.isArray(conflicts))_syncConflicts=conflicts}catch(e){_syncConflicts={}}
}
_restorePersistenceMetadata();

function emitLifeHubChange(detail){
  detail=detail||{};
  var payload=Object.assign({},detail,{
    changeId:detail.changeId||('change-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)),
    timestamp:detail.timestamp||new Date().toISOString(),
    domains:Array.isArray(detail.domains)?detail.domains.slice():[]
  });
  document.dispatchEvent(new CustomEvent('lifehub:change',{detail:payload}));
  return payload.changeId;
}
function _slot(present,value){return {present:!!present,value:present?_clone(value):undefined}}
function _sameSlot(a,b){return a.present===b.present&&(!a.present||_same(a.value,b.value))}
function _mergeSlot(base,local,remote){
  if(_sameSlot(local,remote))return {conflict:false,result:local};
  if(_sameSlot(local,base))return {conflict:false,result:remote};
  if(_sameSlot(remote,base))return {conflict:false,result:local};
  return {conflict:true,local:local,cloud:remote};
}
function _assignSlot(target,key,slot){if(slot.present)target[key]=_clone(slot.value)}
function _projectMergedHabit(habit){
  habit.provenanceVersion=1;habit.logs={};
  Object.keys(habit.logProvenance||{}).forEach(function(dateKey){if(_habitProvenancePresent(habit.logProvenance[dateKey]))habit.logs[dateKey]=true});
  return habit;
}
function _mergeHabitSets(baseKeys,localKeys,remoteKeys){
  var all={};(baseKeys||[]).concat(localKeys||[],remoteKeys||[]).forEach(function(key){all[key]=true});
  var localResult=[],cloudResult=[],clean=true;
  Object.keys(all).sort().forEach(function(key){
    var merged=_mergeSlot(_slot((baseKeys||[]).indexOf(key)!==-1,true),_slot((localKeys||[]).indexOf(key)!==-1,true),_slot((remoteKeys||[]).indexOf(key)!==-1,true));
    if(merged.conflict){clean=false;if(merged.local.present)localResult.push(key);if(merged.cloud.present)cloudResult.push(key)}
    else{if(merged.result.present)localResult.push(key);if(merged.result.present)cloudResult.push(key)}
  });
  return {clean:clean,local:localResult,cloud:cloudResult};
}
function _mergeHabitProvenance(base,local,remote){
  base=base||{};local=local||{};remote=remote||{};var dates={};
  Object.keys(base).concat(Object.keys(local),Object.keys(remote)).forEach(function(key){dates[key]=true});
  var localResult={},cloudResult={},clean=true;
  Object.keys(dates).sort().forEach(function(dateKey){
    var b=base[dateKey]||{},l=local[dateKey]||{},r=remote[dateKey]||{};
    var localEntry={sources:{}},cloudEntry={sources:{}};
    var manual=_mergeSlot(_slot(b.manual===true,true),_slot(l.manual===true,true),_slot(r.manual===true,true));
    if(manual.conflict){clean=false;if(manual.local.present)localEntry.manual=true;if(manual.cloud.present)cloudEntry.manual=true}
    else{if(manual.result.present)localEntry.manual=true;if(manual.result.present)cloudEntry.manual=true}
    var sourceKeys={};Object.keys(b.sources||{}).concat(Object.keys(l.sources||{}),Object.keys(r.sources||{})).forEach(function(key){sourceKeys[key]=true});
    Object.keys(sourceKeys).sort().forEach(function(sourceKey){
      var source=_mergeSlot(_slot(!!(b.sources&&b.sources[sourceKey]),true),_slot(!!(l.sources&&l.sources[sourceKey]),true),_slot(!!(r.sources&&r.sources[sourceKey]),true));
      if(source.conflict){clean=false;if(source.local.present)localEntry.sources[sourceKey]=true;if(source.cloud.present)cloudEntry.sources[sourceKey]=true}
      else{if(source.result.present)localEntry.sources[sourceKey]=true;if(source.result.present)cloudEntry.sources[sourceKey]=true}
    });
    if(_habitProvenancePresent(localEntry))localResult[dateKey]=localEntry;
    if(_habitProvenancePresent(cloudEntry))cloudResult[dateKey]=cloudEntry;
  });
  return {clean:clean,local:localResult,cloud:cloudResult};
}
function _mergeExistingHabit(base,local,remote){
  var localResult={},cloudResult={},clean=true,conflicts=[];var fields={};
  Object.keys(base).concat(Object.keys(local),Object.keys(remote)).forEach(function(key){if(key!=='logs'&&key!=='logProvenance'&&key!=='provenanceVersion'&&key!=='integrationKeys')fields[key]=true});
  Object.keys(fields).sort().forEach(function(key){
    var merged=_mergeSlot(_slot(Object.prototype.hasOwnProperty.call(base,key),base[key]),_slot(Object.prototype.hasOwnProperty.call(local,key),local[key]),_slot(Object.prototype.hasOwnProperty.call(remote,key),remote[key]));
    if(merged.conflict){clean=false;conflicts.push(key);_assignSlot(localResult,key,merged.local);_assignSlot(cloudResult,key,merged.cloud)}
    else{_assignSlot(localResult,key,merged.result);_assignSlot(cloudResult,key,merged.result)}
  });
  var integrations=_mergeHabitSets(base.integrationKeys,local.integrationKeys,remote.integrationKeys);
  if(!integrations.clean){clean=false;conflicts.push('integrationKeys')}
  localResult.integrationKeys=integrations.local;cloudResult.integrationKeys=integrations.cloud;
  var provenance=_mergeHabitProvenance(base.logProvenance,local.logProvenance,remote.logProvenance);
  if(!provenance.clean){clean=false;conflicts.push('logProvenance')}
  localResult.logProvenance=provenance.local;cloudResult.logProvenance=provenance.cloud;
  return {clean:clean,local:_projectMergedHabit(localResult),cloud:_projectMergedHabit(cloudResult),conflicts:conflicts};
}
function _habitMap(items){var map={};(items||[]).forEach(function(h){map[h.id]=h});return map}
function _mergeHabitArrays(base,local,remote){
  var bMap=_habitMap(base),lMap=_habitMap(local),rMap=_habitMap(remote),ids={};
  Object.keys(bMap).concat(Object.keys(lMap),Object.keys(rMap)).forEach(function(id){ids[id]=true});
  var order=[];(remote||[]).concat(local||[],base||[]).forEach(function(h){if(order.indexOf(h.id)===-1)order.push(h.id)});
  var localOut=[],cloudOut=[],clean=true,conflicts=[];
  order.forEach(function(id){if(!ids[id])return;var b=bMap[id],l=lMap[id],r=rMap[id];
    if(b&&l&&r){
      var habitMerge=_mergeExistingHabit(b,l,r);if(!habitMerge.clean){clean=false;conflicts.push({habitId:id,fields:habitMerge.conflicts})}
      localOut.push(habitMerge.local);cloudOut.push(habitMerge.cloud);return;
    }
    var slotMerge=_mergeSlot(_slot(!!b,b),_slot(!!l,l),_slot(!!r,r));
    if(slotMerge.conflict){clean=false;conflicts.push({habitId:id,fields:['record']});if(slotMerge.local.present)localOut.push(_clone(slotMerge.local.value));if(slotMerge.cloud.present)cloudOut.push(_clone(slotMerge.cloud.value));return}
    if(slotMerge.result.present){localOut.push(_clone(slotMerge.result.value));cloudOut.push(_clone(slotMerge.result.value))}
  });
  return {clean:clean,merged:clean?localOut:null,localCandidate:localOut,cloudCandidate:cloudOut,conflicts:conflicts};
}
function _mergeHabitDomainChange(pending,remote){
  if(!pending||pending.baseKnown!==true)return {clean:false,reason:'missing-base'};
  var baseSlot=_slot(!pending.baseDeleted,pending.baseData),localSlot=_slot(!pending.deleted,pending.data),remoteSlot=_slot(!remote.deleted,remote.data);
  if(baseSlot.present&&localSlot.present&&remoteSlot.present){
    var baseCheck=validateHabitDomainData(baseSlot.value),localCheck=validateHabitDomainData(localSlot.value),remoteCheck=validateHabitDomainData(remoteSlot.value);
    if(!baseCheck.ok||!localCheck.ok||!remoteCheck.ok)return {clean:false,reason:'invalid-candidate'};
    var arrayMerge=_mergeHabitArrays(baseCheck.data,localCheck.data,remoteCheck.data);
    if(arrayMerge.clean){
      var mergedCheck=validateHabitDomainData(arrayMerge.merged);
      if(mergedCheck.ok&&_same(mergedCheck.data,arrayMerge.merged)){arrayMerge.merged=mergedCheck.data;arrayMerge.localCandidate=mergedCheck.data;arrayMerge.cloudCandidate=mergedCheck.data;return arrayMerge}
      return {clean:false,reason:mergedCheck.ok?'normalized-merged-result':'invalid-merged-result',localCandidate:localCheck.data,localDeleted:false,cloudCandidate:remoteCheck.data,cloudDeleted:false,conflicts:[{habitId:'domain',fields:['validation']}]};
    }
    var localCandidateCheck=validateHabitDomainData(arrayMerge.localCandidate),cloudCandidateCheck=validateHabitDomainData(arrayMerge.cloudCandidate);
    if(!localCandidateCheck.ok||!cloudCandidateCheck.ok)return {clean:false,reason:'invalid-merged-candidate',localCandidate:localCheck.data,localDeleted:false,cloudCandidate:remoteCheck.data,cloudDeleted:false,conflicts:arrayMerge.conflicts};
    arrayMerge.localCandidate=localCandidateCheck.data;arrayMerge.cloudCandidate=cloudCandidateCheck.data;return arrayMerge;
  }
  var merged=_mergeSlot(baseSlot,localSlot,remoteSlot);
  if(!merged.conflict)return {clean:true,merged:merged.result.present?_clone(merged.result.value):null,deleted:!merged.result.present,localCandidate:merged.result.present?_clone(merged.result.value):null,cloudCandidate:merged.result.present?_clone(merged.result.value):null};
  return {clean:false,reason:'delete-vs-edit',localCandidate:merged.local.present?_clone(merged.local.value):null,localDeleted:!merged.local.present,cloudCandidate:merged.cloud.present?_clone(merged.cloud.value):null,cloudDeleted:!merged.cloud.present,conflicts:[{habitId:'domain',fields:['record']}]};
}

var LIFEHUB_KEYED_MERGE_DOMAINS={trainingSessions:true,dailyCheckIns:true,weeklyCheckIns:true};
function _mergeKeyedDomainChange(pending,remote){
  if(!pending||pending.baseKnown!==true)return {clean:false,reason:'missing-base'};
  var baseSlot=_slot(!pending.baseDeleted,pending.baseData),localSlot=_slot(!pending.deleted,pending.data),remoteSlot=_slot(!remote.deleted,remote.data);
  if(baseSlot.present&&localSlot.present&&remoteSlot.present&&_isPlainRecord(baseSlot.value)&&_isPlainRecord(localSlot.value)&&_isPlainRecord(remoteSlot.value)){
    var base=baseSlot.value,local=localSlot.value,cloud=remoteSlot.value,keys={},localOut={},cloudOut={},conflicts=[];
    Object.keys(base).concat(Object.keys(local),Object.keys(cloud)).forEach(function(key){keys[key]=true});
    Object.keys(keys).sort().forEach(function(key){
      var merged=_mergeSlot(_slot(Object.prototype.hasOwnProperty.call(base,key),base[key]),_slot(Object.prototype.hasOwnProperty.call(local,key),local[key]),_slot(Object.prototype.hasOwnProperty.call(cloud,key),cloud[key]));
      if(merged.conflict){conflicts.push({recordId:key,fields:['record']});_assignSlot(localOut,key,merged.local);_assignSlot(cloudOut,key,merged.cloud)}
      else{_assignSlot(localOut,key,merged.result);_assignSlot(cloudOut,key,merged.result)}
    });
    return {clean:conflicts.length===0,merged:conflicts.length?null:localOut,deleted:false,localCandidate:localOut,localDeleted:false,cloudCandidate:cloudOut,cloudDeleted:false,conflicts:conflicts};
  }
  var mergedSlot=_mergeSlot(baseSlot,localSlot,remoteSlot);
  if(!mergedSlot.conflict)return {clean:true,merged:mergedSlot.result.present?_clone(mergedSlot.result.value):null,deleted:!mergedSlot.result.present,localCandidate:mergedSlot.result.present?_clone(mergedSlot.result.value):null,cloudCandidate:mergedSlot.result.present?_clone(mergedSlot.result.value):null};
  return {clean:false,reason:'delete-vs-edit',localCandidate:mergedSlot.local.present?_clone(mergedSlot.local.value):null,localDeleted:!mergedSlot.local.present,cloudCandidate:mergedSlot.cloud.present?_clone(mergedSlot.cloud.value):null,cloudDeleted:!mergedSlot.cloud.present,conflicts:[{recordId:'domain',fields:['record']}]};
}

function _mergeReadingDomainChange(pending,remote){
  if(!pending||pending.baseKnown!==true)return {clean:false,reason:'missing-base'};
  var base=pending.baseDeleted?null:pending.baseData,local=pending.deleted?null:pending.data,cloud=remote.deleted?null:remote.data;
  if(!_isPlainRecord(base)||!_isPlainRecord(local)||!_isPlainRecord(cloud)||!_isPlainRecord(base.sessions)||!_isPlainRecord(local.sessions)||!_isPlainRecord(cloud.sessions))return _mergeKeyedDomainChange(pending,remote);
  var sessionPending={baseKnown:true,baseDeleted:false,deleted:false,baseData:base.sessions,data:local.sessions};
  var sessionRemote={deleted:false,data:cloud.sessions},sessions=_mergeKeyedDomainChange(sessionPending,sessionRemote);
  var active=_mergeSlot(_slot(Object.prototype.hasOwnProperty.call(base,'activeSessionId'),base.activeSessionId),_slot(Object.prototype.hasOwnProperty.call(local,'activeSessionId'),local.activeSessionId),_slot(Object.prototype.hasOwnProperty.call(cloud,'activeSessionId'),cloud.activeSessionId));
  var localOut={sessions:sessions.clean?sessions.merged:sessions.localCandidate},cloudOut={sessions:sessions.clean?sessions.merged:sessions.cloudCandidate},conflicts=(sessions.conflicts||[]).slice();
  if(active.conflict){conflicts.push({recordId:'activeSessionId',fields:['value']});_assignSlot(localOut,'activeSessionId',active.local);_assignSlot(cloudOut,'activeSessionId',active.cloud)}else{_assignSlot(localOut,'activeSessionId',active.result);_assignSlot(cloudOut,'activeSessionId',active.result)}
  if(localOut.activeSessionId===undefined)localOut.activeSessionId=null;if(cloudOut.activeSessionId===undefined)cloudOut.activeSessionId=null;
  return {clean:conflicts.length===0,merged:conflicts.length?null:localOut,deleted:false,localCandidate:localOut,localDeleted:false,cloudCandidate:cloudOut,cloudDeleted:false,conflicts:conflicts};
}

function _queueDomain(domain,value,deleted,force){
  if(!_validDomainName(domain))return;
  var existing=_pendingDomains[domain];var cloudHas=Object.prototype.hasOwnProperty.call(_cloudData,domain);
  var item={
    domain:domain,data:deleted?null:_clone(value),deleted:!!deleted,
    baseRevision:existing?Number(existing.baseRevision||0):Number(_domainRevisions[domain]||0),
    baseKnown:existing?existing.baseKnown===true:!!_domainSnapshotLoaded,
    baseData:existing?_clone(existing.baseData):(cloudHas?_clone(_cloudData[domain]):null),
    baseDeleted:existing?!!existing.baseDeleted:!cloudHas,
    queuedAt:new Date().toISOString(),clientId:_clientId
  };
  if(!force&&existing&&existing.deleted===item.deleted&&_same(existing.data,item.data))return;
  _pendingDomains[domain]=item;
}
function _changedDomains(previous,current,forceAll){
  var seen={};var changed=[];
  _domainKeys(previous).concat(_domainKeys(current)).forEach(function(key){if(seen[key])return;seen[key]=true;if(forceAll||!Object.prototype.hasOwnProperty.call(previous,key)||!Object.prototype.hasOwnProperty.call(current,key)||!_same(previous[key],current[key]))changed.push(key)});
  return changed;
}
function saveState(options){
  options=options||{};
  var validation=validateLifeHubState(STATE,{importMode:false});
  if(!validation.ok){console.error('State was not saved:',validation.errors);setSyncStatus('storage');_showTrustNotice('A data check stopped this save: '+validation.errors[0]);return false}
  var previous=_clone(_localSnapshots||{});
  var changed=_changedDomains(previous,STATE,!!options.forceAll);
  if(!_persistLocalState())return false;
  if(!_syncReady)changed.forEach(function(domain){_bootstrapDirtyDomains[domain]=true});
  if(_capturedUndo&&!options.suppressUndo&&changed.length){_undoRecord={label:_capturedUndo.label||options.undoLabel||'Change',state:_capturedUndo.state,createdAt:Date.now()};_capturedUndo=null;showUndoToast(_undoRecord.label)}else if(options.suppressUndo){_capturedUndo=null}
  _localSnapshots=_clone(STATE);
  if(!_syncReady)return true;
  changed.forEach(function(domain){var has=Object.prototype.hasOwnProperty.call(STATE,domain);_queueDomain(domain,STATE[domain],!has,!!options.forceAll)});
  _persistQueue();_updateSyncPresentation();
  if(_firebaseReady&&syncDoc&&_authUser)_scheduleCloudFlush();
  else if(!_firebaseReady||!syncDoc)_setCloudIssue({code:'firebase-unavailable'},'write');
  else if(!_authUser)_setCloudIssue({code:'unauthenticated'},'auth');
  return true;
}
function saveStateOrRollback(snapshot,options){
  if(saveState(options))return true;
  STATE=_clone(snapshot);_capturedUndo=null;return false;
}
function captureUndoSnapshot(label){_capturedUndo={label:label||'Deleted item',state:_clone(STATE)}}
function showUndoToast(label){
  var old=document.getElementById('lifehub-undo-toast');if(old)old.remove();
  var el=document.createElement('div');el.id='lifehub-undo-toast';el.className='undo-toast';el.setAttribute('role','status');
  var text=document.createElement('span');text.textContent=label+' saved';el.appendChild(text);
  var button=document.createElement('button');button.type='button';button.textContent='Undo';button.onclick=undoLastChange;el.appendChild(button);document.body.appendChild(el);
  setTimeout(function(){if(el.parentNode)el.remove()},7000);
}
function undoLastChange(){
  if(!_undoRecord)return;var record=_undoRecord;_undoRecord=null;var toast=document.getElementById('lifehub-undo-toast');if(toast)toast.remove();
  STATE=_clone(record.state);saveState({forceAll:true,suppressUndo:true});_rerenderCurrentPage();
  if(typeof showCelebrationToast==='function')showCelebrationToast('Restored previous data','↩️');
}
function _updateSyncPresentation(){
  if(!_cloudIssue&&typeof _authPersistenceError!=='undefined'&&_authPersistenceError)_cloudIssue=_classifyCloudError(_authPersistenceError,'auth-persistence');
  var conflicts=Object.keys(_syncConflicts).length;var pending=Object.keys(_pendingDomains).length;
  var status=document.getElementById('sync-status');if(status){status.onclick=conflicts?openSyncReview:_cloudIssue?openSyncDetails:null;status.style.cursor=conflicts||_cloudIssue?'pointer':''}
  if(conflicts){setSyncStatus('conflict');_showTrustNotice(conflicts+' area'+(conflicts===1?'':'s')+' need'+(conflicts===1?'s':'')+' a sync choice.','Review sync',openSyncReview)}
  else if(_storageIssue){setSyncStatus('storage');_showTrustNotice(_storageMessage||'This device needs a storage check.')}
  else if(_cloudIssue){
    var issue=_cloudIssue;var statusName=issue.category==='auth'?'auth':issue.category==='auth-persistence'?'authPersistence':issue.category==='rules'?'rules':issue.category==='data'?'data':issue.category==='network'&&typeof navigator!=='undefined'&&!navigator.onLine?'queued':_syncRetryTimer?'retrying':'error';
    var primaryLabel='',primaryFn=null;if(issue.category==='auth'){primaryLabel='Sign in';primaryFn=_showSignIn}else if(issue.retryable){primaryLabel='Retry';primaryFn=retryCloudSync}
    setSyncStatus(statusName);_showTrustNotice(issue.message,primaryLabel,primaryFn,'Details',openSyncDetails);
  }
  else if(pending){setSyncStatus(typeof navigator!=='undefined'&&navigator.onLine?'saving':'queued');_hideTrustNotice()}
  else{setSyncStatus('saved');_hideTrustNotice();setTimeout(function(){if(!Object.keys(_pendingDomains).length&&!Object.keys(_syncConflicts).length&&!_cloudIssue)setSyncStatus('idle')},1800)}
}
function _cancelSyncRetry(resetAttempt){if(_syncRetryTimer){clearTimeout(_syncRetryTimer);_syncRetryTimer=null}if(resetAttempt)_syncRetryAttempt=0}
function _scheduleSyncRetry(){
  if(_syncRetryTimer||!_cloudIssue||!_cloudIssue.autoRetry||typeof navigator!=='undefined'&&!navigator.onLine)return;
  var base=Math.min(_syncRetryMaxMs,1000*Math.pow(2,Math.min(_syncRetryAttempt,6)));var jitter=0.8+Math.random()*0.4;var delay=Math.min(_syncRetryMaxMs,Math.round(base*jitter));_syncRetryAttempt++;
  _syncRetryTimer=setTimeout(function(){_syncRetryTimer=null;_attemptCloudRecovery(false)},delay);_updateSyncPresentation();
}
function _attemptCloudRecovery(manual){
  if(manual)_cancelSyncRetry(true);
  if(typeof navigator!=='undefined'&&!navigator.onLine){_updateSyncPresentation();return Promise.resolve(false)}
  var issue=_cloudIssue;if(!issue)return Promise.resolve(true);
  if(issue.category==='auth'){_showSignIn();return Promise.resolve(false)}
  if(issue.operation==='auth-persistence'&&typeof configureLifeHubAuthPersistence==='function')return configureLifeHubAuthPersistence();
  if(issue.operation==='write')return _flushPendingWrites();
  if(issue.operation==='read'||issue.operation==='bootstrap')return _refreshFromCloud(issue.operation);
  return Promise.all([_flushPendingWrites(),_refreshFromCloud()]);
}
function retryCloudSync(){return _attemptCloudRecovery(true)}
function _scheduleCloudFlush(){if(!_syncReady||_syncRetryTimer)return;clearTimeout(_syncTimeout);_syncTimeout=setTimeout(function(){_syncTimeout=null;_flushPendingWrites()},700)}

function _recordConflict(domain,pending,remote,merge){
  merge=merge||{};
  var hasLocalCandidate=Object.prototype.hasOwnProperty.call(merge,'localCandidate');
  var hasCloudCandidate=Object.prototype.hasOwnProperty.call(merge,'cloudCandidate');
  _syncConflicts[domain]={
    domain:domain,
    localData:hasLocalCandidate?_clone(merge.localCandidate):_clone(pending.data),
    localDeleted:hasLocalCandidate?!!merge.localDeleted:!!pending.deleted,
    localQueuedAt:pending.queuedAt||null,
    baseRevision:Number(pending.baseRevision||0),
    cloudData:hasCloudCandidate?_clone(merge.cloudCandidate):(remote.deleted?null:_clone(remote.data)),
    cloudDeleted:hasCloudCandidate?!!merge.cloudDeleted:!!remote.deleted,
    remoteData:remote.deleted?null:_clone(remote.data),
    remoteDeleted:!!remote.deleted,
    cloudRevision:Number(remote.revision||0),
    cloudUpdatedAt:remote.updatedAt||null,
    mergeReason:merge.reason||null,
    conflictCount:Array.isArray(merge.conflicts)?merge.conflicts.length:0
  };
  var persisted=_persistConflicts();
  if(persisted){delete _pendingDomains[domain];_persistQueue()}
  _updateSyncPresentation();return persisted;
}
function _writeOneDomain(domain){
  var pending=_pendingDomains[domain];if(!pending||_syncConflicts[domain])return Promise.resolve();
  var ref=syncDoc.collection('domains').doc(domain);
  return db.runTransaction(function(tx){
    return tx.get(ref).then(function(snap){
      var remote=snap.exists?snap.data():{};var revision=Number(remote.revision||0);
      var writeData=pending.data,writeDeleted=!!pending.deleted,merge=null;
      if(revision!==Number(pending.baseRevision||0)){
        var remoteInfo={data:remote.data,deleted:!!remote.deleted,revision:revision,updatedAt:_timestampText(remote.updatedAt)};
        if(domain==='habits')merge=_mergeHabitDomainChange(pending,remoteInfo);
        else if(domain==='reading')merge=_mergeReadingDomainChange(pending,remoteInfo);
        else if(LIFEHUB_KEYED_MERGE_DOMAINS[domain])merge=_mergeKeyedDomainChange(pending,remoteInfo);
        else return {conflict:true,remote:remoteInfo};
        if(!merge.clean)return {conflict:true,remote:remoteInfo,merge:merge};
        writeDeleted=merge.deleted===true;writeData=writeDeleted?null:_clone(merge.merged);
      }
      tx.set(ref,{data:writeDeleted?null:writeData,deleted:writeDeleted,revision:revision+1,schemaVersion:LIFEHUB_SCHEMA_VERSION,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:_clientId});
      return {conflict:false,revision:revision+1,data:_clone(writeData),deleted:writeDeleted,merged:!!merge};
    });
  }).then(function(result){
    if(result&&result.conflict){_recordConflict(domain,_pendingDomains[domain]||pending,result.remote,result.merge);return}
    _domainRevisions[domain]=result.revision;_domainExists[domain]=true;_persistRevisionMetadata();
    if(result.deleted)delete _cloudData[domain];else _cloudData[domain]=_clone(result.data);
    if(_pendingDomains[domain]!==pending){
      var replacement=_pendingDomains[domain];
      if(domain==='reading'||LIFEHUB_KEYED_MERGE_DOMAINS[domain]){
        var rebaseBase={baseKnown:true,baseDeleted:!!pending.deleted,baseData:pending.deleted?null:_clone(pending.data),deleted:!!replacement.deleted,data:replacement.deleted?null:_clone(replacement.data)};
        var rebaseRemote={deleted:!!result.deleted,data:result.deleted?null:_clone(result.data),revision:result.revision};
        var rebased=domain==='reading'?_mergeReadingDomainChange(rebaseBase,rebaseRemote):_mergeKeyedDomainChange(rebaseBase,rebaseRemote);
        if(!rebased.clean){_recordConflict(domain,replacement,rebaseRemote,rebased);return}
        replacement.deleted=rebased.deleted===true;replacement.data=replacement.deleted?null:_clone(rebased.merged);_applyDomain(STATE,domain,{data:replacement.data,deleted:replacement.deleted});_localSnapshots=_clone(STATE);_persistLocalState();
      }
      if(domain!=='habits'&&_pendingDomains[domain]){
        _pendingDomains[domain].baseRevision=result.revision;_pendingDomains[domain].baseKnown=true;_pendingDomains[domain].baseData=result.deleted?null:_clone(result.data);_pendingDomains[domain].baseDeleted=!!result.deleted;
      }
      _persistQueue();return;
    }
    if(result.merged){
      _applyDomain(STATE,domain,{data:result.data,deleted:result.deleted});_localSnapshots=_clone(STATE);_persistLocalState();
      emitLifeHubChange({action:'merge',domains:[domain],source:'sync'});
    }
    delete _pendingDomains[domain];_persistQueue();
  });
}
function _flushPendingWrites(){
  if(_syncWriting||!_syncReady)return Promise.resolve(false);
  if(!_firebaseReady||!db||!syncDoc||!_authUser){if(!_authUser&&Object.keys(_pendingDomains).length)_setCloudIssue({code:'unauthenticated'},'auth');return Promise.resolve(false)}
  var domains=Object.keys(_pendingDomains).filter(function(domain){return !_syncConflicts[domain]});
  if(!domains.length){_clearCloudIssue('write');_updateSyncPresentation();return Promise.resolve(true)}
  _syncWriting=true;setSyncStatus('saving');var activeDomain=null;
  var chain=Promise.resolve();domains.forEach(function(domain){chain=chain.then(function(){activeDomain=domain;return _writeOneDomain(domain)})});
  return chain.then(function(){
    // Domain documents are authoritative. Root metadata is legacy discovery data,
    // so a metadata-only failure is logged without re-queuing successful domains.
    return syncDoc.set({schemaVersion:LIFEHUB_SCHEMA_VERSION,domainStorage:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:_clientId},{merge:true}).catch(function(e){console.warn('Non-critical root sync metadata update failed:',e)});
  }).then(function(){_clearCloudIssue('write');return true}).catch(function(e){
    console.warn('Domain sync paused:',e);_setCloudIssue(e,'write',{domain:activeDomain});return false;
  }).then(function(ok){
    _syncWriting=false;_updateSyncPresentation();
    if(ok&&Object.keys(_pendingDomains).length&&!_cloudIssue)_scheduleCloudFlush();
    return ok;
  });
}
function _parseLegacyState(root){
  if(!root||!root.state)return null;
  try{var parsed=typeof root.state==='string'?JSON.parse(root.state):root.state;var result=validateLifeHubState(parsed,{importMode:false});return result.ok?parsed:null}catch(e){console.warn('Legacy cloud state could not be parsed:',e);return null}
}
function _applyDomain(target,domain,record){if(record.deleted)delete target[domain];else target[domain]=_clone(record.data)}
function loadFromCloud(onDone){
  var called=false;function done(){if(called)return;called=true;if(onDone)onDone()}
  var localCandidate=_clone(STATE);var localCheck=validateLifeHubState(localCandidate,{importMode:false});if(!localCheck.ok){console.warn('Local state failed validation:',localCheck.errors);localCandidate=_clone(DEFAULT_STATE);_showTrustNotice('Local data failed a safety check. A safe copy was loaded instead while cloud recovery is attempted.')}
  if(!_firebaseReady||!syncDoc){_setCloudIssue({code:'firebase-unavailable'},'bootstrap');STATE=localCandidate;_localSnapshots=_clone(STATE);done();return}
  _ensureSignedIn(function(user){
    if(!user){_setCloudIssue({code:'unauthenticated'},'auth');STATE=localCandidate;_localSnapshots=_clone(STATE);done();return}
    var rootPromise=syncDoc.get().catch(function(e){console.warn('Non-critical legacy state load failed:',e);return null});
    var domainsPromise=syncDoc.collection('domains').get();
    Promise.all([rootPromise,domainsPromise]).then(function(results){
      var rootSnap=results[0];var query=results[1];_domainSnapshotLoaded=true;var root=rootSnap&&rootSnap.exists?rootSnap.data():null;var legacy=_parseLegacyState(root);
      _lastCloudUpdatedAt=root?_timestampText(root.updatedAt):null;
      var cloudBase=_clone(legacy||localCandidate||DEFAULT_STATE);_domainRevisions={};_domainExists={};
      query.forEach(function(doc){var record=doc.data()||{};if(!_validDomainName(doc.id))return;_domainExists[doc.id]=true;_domainRevisions[doc.id]=Number(record.revision||0);_applyDomain(cloudBase,doc.id,record)});
      var effective=_clone(cloudBase);
      Object.keys(_pendingDomains).forEach(function(domain){var item=_pendingDomains[domain];_applyDomain(effective,domain,item)});
      Object.keys(_syncConflicts).forEach(function(domain){var conflict=_syncConflicts[domain];_applyDomain(effective,domain,{data:conflict.localData,deleted:conflict.localDeleted})});
      var check=validateLifeHubState(effective,{importMode:false});if(!check.ok){var validationError=new Error('Combined cloud data failed validation: '+check.errors[0]);validationError.code='data-validation';throw validationError}
      STATE=effective;_cloudData=_clone(cloudBase);_localSnapshots=_clone(effective);_persistLocalState();_clearCloudIssue('bootstrap');_updateSyncPresentation();done();
    }).catch(function(e){console.warn('Cloud bootstrap failed:',e);_setCloudIssue(e,'bootstrap');STATE=localCandidate;_localSnapshots=_clone(STATE);done()});
  });
}
function finishDataBootstrap(){
  Object.keys(DEFAULT_STATE||{}).forEach(function(domain){if(STATE[domain]===undefined)STATE[domain]=_clone(DEFAULT_STATE[domain])});
  _changedDomains(_localSnapshots,STATE,false).forEach(function(domain){_bootstrapDirtyDomains[domain]=true});
  var check=validateLifeHubState(STATE,{importMode:false,requireCore:true});if(!check.ok){setSyncStatus('storage');_showTrustNotice('Startup data check failed: '+check.errors[0]);return false}
  _persistLocalState();_syncReady=true;
  if(_firebaseReady&&syncDoc&&_authUser&&_domainSnapshotLoaded){
    var seen={};_domainKeys(_cloudData).concat(_domainKeys(STATE)).forEach(function(domain){if(seen[domain]||_syncConflicts[domain])return;seen[domain]=true;var has=Object.prototype.hasOwnProperty.call(STATE,domain);if(!_domainExists[domain]||!has||!_same(_cloudData[domain],STATE[domain]))_queueDomain(domain,STATE[domain],!has,false)});
    _persistQueue();
  }else if(_firebaseReady&&syncDoc&&_authUser){
    Object.keys(_bootstrapDirtyDomains).forEach(function(domain){var has=Object.prototype.hasOwnProperty.call(STATE,domain);_queueDomain(domain,STATE[domain],!has,false)});_persistQueue();
  }
  _bootstrapDirtyDomains={};
  _localSnapshots=_clone(STATE);_updateSyncPresentation();_scheduleCloudFlush();document.dispatchEvent(new CustomEvent('lifehub:ready'));return true;
}

function _rerenderCurrentPage(){
  try{var active=document.querySelector('.page.active');var page=active?active.id.replace(/^page-/,''):'planner';if(typeof renderPage==='function')renderPage(page);else if(typeof renderPlanner==='function')renderPlanner();if(typeof updateAppBadge==='function')updateAppBadge()}catch(e){console.warn('Re-render failed:',e)}
}
function _refreshFromCloud(recoveryOperation){
  var operation=recoveryOperation||'read';
  var refreshRollback=null;
  if(!_syncReady||!_firebaseReady||!syncDoc||!_authUser||_syncWriting)return Promise.resolve(false);
  return syncDoc.collection('domains').get().then(function(query){
    var incoming=[];
    // Validate and normalize every incoming Habit domain before applying any
    // remote changes, so one malformed record cannot partially mutate state.
    query.forEach(function(doc){
      var domain=doc.id;if(!_validDomainName(domain))return;
      var record=doc.data()||{},revision=Number(record.revision||0);
      if(revision<=Number(_domainRevisions[domain]||0))return;
      if(domain==='habits'&&!record.deleted){
        var habitCheck=validateHabitDomainData(record.data);
        if(!habitCheck.ok){var error=new Error('Synced habits failed validation: '+habitCheck.errors[0]);error.code='data-validation';throw error}
        record.data=habitCheck.data;
      }
      incoming.push({domain:domain,record:record,revision:revision});
    });
    refreshRollback={
      state:_clone(STATE),cloudData:_clone(_cloudData),domainRevisions:_clone(_domainRevisions),domainExists:_clone(_domainExists),
      pendingDomains:_clone(_pendingDomains),syncConflicts:_clone(_syncConflicts),domainSnapshotLoaded:_domainSnapshotLoaded
    };
    var changed=false,changedDomains=[];
    incoming.forEach(function(item){
      var domain=item.domain,record=item.record,revision=item.revision;
      var remoteInfo={data:record.data,deleted:!!record.deleted,revision:revision,updatedAt:_timestampText(record.updatedAt)};
      var pending=_pendingDomains[domain];
      if(pending){
        var merge=null;
        if(domain==='habits')merge=_mergeHabitDomainChange(pending,remoteInfo);
        else if(domain==='reading')merge=_mergeReadingDomainChange(pending,remoteInfo);
        else if(LIFEHUB_KEYED_MERGE_DOMAINS[domain])merge=_mergeKeyedDomainChange(pending,remoteInfo);
        if(merge){
          if(merge.clean){
            pending.data=merge.deleted?null:_clone(merge.merged);pending.deleted=merge.deleted===true;
            pending.baseRevision=revision;pending.baseKnown=true;pending.baseData=record.deleted?null:_clone(record.data);pending.baseDeleted=!!record.deleted;pending.queuedAt=new Date().toISOString();
            _applyDomain(STATE,domain,{data:pending.data,deleted:pending.deleted});changed=true;changedDomains.push(domain);
          }else{
            _recordConflict(domain,pending,remoteInfo,merge);
            var conflict=_syncConflicts[domain];if(conflict){_applyDomain(STATE,domain,{data:conflict.localData,deleted:conflict.localDeleted});changed=true;changedDomains.push(domain)}
          }
        }else _recordConflict(domain,pending,remoteInfo);
        _domainRevisions[domain]=revision;_domainExists[domain]=true;_applyDomain(_cloudData,domain,record);return;
      }
      if(_syncConflicts[domain])return;
      _domainRevisions[domain]=revision;_domainExists[domain]=true;_applyDomain(STATE,domain,record);_applyDomain(_cloudData,domain,record);changed=true;changedDomains.push(domain);
    });
    _domainSnapshotLoaded=true;_domainKeys(STATE).forEach(function(domain){if(!_domainExists[domain]&&!_pendingDomains[domain]&&!_syncConflicts[domain])_queueDomain(domain,STATE[domain],false,false)});_persistQueue();
    if(changed){
      var stateCheck=validateLifeHubState(STATE,{importMode:false});if(!stateCheck.ok){var stateError=new Error('Synced data failed validation: '+stateCheck.errors[0]);stateError.code='data-validation';throw stateError}
      _localSnapshots=_clone(STATE);_persistLocalState();_rerenderCurrentPage();emitLifeHubChange({action:'remote-apply',domains:changedDomains,source:'sync'});
    }
    _persistRevisionMetadata();_clearCloudIssue(operation);_updateSyncPresentation();_scheduleCloudFlush();return true;
  }).catch(function(e){
    if(refreshRollback){
      STATE=refreshRollback.state;_cloudData=refreshRollback.cloudData;_domainRevisions=refreshRollback.domainRevisions;_domainExists=refreshRollback.domainExists;
      _pendingDomains=refreshRollback.pendingDomains;_syncConflicts=refreshRollback.syncConflicts;_domainSnapshotLoaded=refreshRollback.domainSnapshotLoaded;
      _persistQueue();_persistConflicts();_persistRevisionMetadata();
    }
    console.warn('Cloud refresh failed:',e);_setCloudIssue(e,operation);return false;
  });
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)_refreshFromCloud()});
window.addEventListener('focus',function(){_refreshFromCloud()});
window.addEventListener('online',function(){_cancelSyncRetry(true);if(_cloudIssue)_attemptCloudRecovery(false);else{_updateSyncPresentation();_flushPendingWrites();_refreshFromCloud()}});
window.addEventListener('offline',function(){_cancelSyncRetry(false);_updateSyncPresentation()});

function handleLifeHubAuthPersistenceResult(error){
  if(error)_setCloudIssue(error,'auth-persistence');
  else{if(typeof _authPersistenceError!=='undefined')_authPersistenceError=null;_clearCloudIssue('auth-persistence');_updateSyncPresentation()}
}
function handleLifeHubSyncAuthState(user,error){
  if(user){_clearCloudIssue('auth');_updateSyncPresentation();if(_syncReady){_flushPendingWrites();_refreshFromCloud()}}
  else{_cancelSyncRetry(false);_setCloudIssue(error||{code:'unauthenticated'},'auth')}
}

function openSyncDetails(){
  var issue=_cloudIssue;if(!issue)return;
  var modal=document.getElementById('modal');var content=document.getElementById('modal-content');if(!modal||!content)return;content.textContent='';
  var title=document.createElement('h2');title.textContent='Cloud sync details';content.appendChild(title);
  var sub=document.createElement('div');sub.className='modal-sub';sub.textContent=issue.guidance;content.appendChild(sub);
  var details=document.createElement('dl');details.className='sync-detail-list';
  [['Category',issue.category],['Code',issue.code],['Operation',issue.operation],['Area',issue.domain||'Not specified'],['Queued areas',String(Object.keys(_pendingDomains).length)],['Recorded',new Date(issue.occurredAt).toLocaleString()]].forEach(function(pair){var dt=document.createElement('dt');dt.textContent=pair[0];var dd=document.createElement('dd');dd.textContent=pair[1];details.appendChild(dt);details.appendChild(dd)});content.appendChild(details);
  var note=document.createElement('p');note.className='sync-detail-note';note.textContent='Local data and queued changes have not been deleted.';content.appendChild(note);
  var actions=document.createElement('div');actions.className='modal-btns';
  if(issue.category==='auth'){var signIn=document.createElement('button');signIn.type='button';signIn.className='btn btn-accent';signIn.textContent='Sign in';signIn.onclick=function(){closeModal();_showSignIn()};actions.appendChild(signIn)}
  else if(issue.retryable){var retry=document.createElement('button');retry.type='button';retry.className='btn btn-accent';retry.textContent='Retry now';retry.onclick=function(){closeModal();retryCloudSync()};actions.appendChild(retry)}
  var close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Close';close.onclick=closeModal;actions.appendChild(close);content.appendChild(actions);modal.style.display='flex';
}

function openSyncReview(){
  var modal=document.getElementById('modal');var content=document.getElementById('modal-content');if(!modal||!content)return;content.textContent='';
  var title=document.createElement('h2');title.textContent='Review sync choices';content.appendChild(title);
  var sub=document.createElement('div');sub.className='modal-sub';sub.textContent='Independent habit changes are combined automatically. These choices contain only overlapping edits or changes without a reliable merge base.';content.appendChild(sub);
  var list=document.createElement('div');list.className='sync-conflict-list';content.appendChild(list);
  var domains=Object.keys(_syncConflicts);domains.forEach(function(domain){var item=_syncConflicts[domain];var row=document.createElement('section');row.className='sync-conflict-item';
    var name=document.createElement('strong');name.textContent=domain.replace(/^__/,'').replace(/([A-Z])/g,' $1');row.appendChild(name);
    var detail=document.createElement('div');detail.className='sync-conflict-meta';
    detail.textContent=item.mergeReason==='missing-base'
      ?'This queued change predates merge-base tracking, so an explicit choice is safest.'
      :(item.conflictCount?item.conflictCount+' overlapping change'+(item.conflictCount===1?'':'s')+' remain after combining everything else.':'This device started at revision '+item.baseRevision+'; synced version is revision '+item.cloudRevision+'.');
    row.appendChild(detail);
    var actions=document.createElement('div');actions.className='sync-conflict-actions';
    var keep=document.createElement('button');keep.type='button';keep.className='btn btn-sm btn-accent';keep.textContent='Keep this device';keep.onclick=function(){resolveSyncConflict(domain,'local')};actions.appendChild(keep);
    var cloud=document.createElement('button');cloud.type='button';cloud.className='btn btn-sm';cloud.textContent='Use synced version';cloud.onclick=function(){resolveSyncConflict(domain,'cloud')};actions.appendChild(cloud);row.appendChild(actions);list.appendChild(row);
  });
  if(!domains.length){var empty=document.createElement('p');empty.textContent='No sync choices are waiting.';list.appendChild(empty)}
  var footer=document.createElement('div');footer.className='modal-btns';var close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Close';close.onclick=function(){if(typeof closeModal==='function')closeModal();else modal.style.display='none'};footer.appendChild(close);content.appendChild(footer);modal.style.display='flex';
}
function resolveSyncConflict(domain,choice){
  var item=_syncConflicts[domain];if(!item)return;
  var chosenData=choice==='cloud'?item.cloudData:item.localData;
  var chosenDeleted=choice==='cloud'?item.cloudDeleted:item.localDeleted;
  if(domain==='habits'&&!chosenDeleted){
    var habitCheck=validateHabitDomainData(chosenData);
    if(!habitCheck.ok){_setCloudIssue({code:'data-validation'},'conflict',{domain:domain});return}
    chosenData=habitCheck.data;
  }
  var snapshot=_clone(STATE),pendingSnapshot=_clone(_pendingDomains),revisionSnapshot=_domainRevisions[domain],existsSnapshot=_domainExists[domain];
  var cloudHad=Object.prototype.hasOwnProperty.call(_cloudData,domain),cloudSnapshot=cloudHad?_clone(_cloudData[domain]):null;
  var remoteData=Object.prototype.hasOwnProperty.call(item,'remoteData')?item.remoteData:item.cloudData;
  var remoteDeleted=Object.prototype.hasOwnProperty.call(item,'remoteDeleted')?item.remoteDeleted:item.cloudDeleted;
  var matchesRemote=chosenDeleted===remoteDeleted&&(chosenDeleted||_same(chosenData,remoteData));
  _applyDomain(STATE,domain,{data:chosenData,deleted:chosenDeleted});_domainRevisions[domain]=item.cloudRevision;_domainExists[domain]=true;_applyDomain(_cloudData,domain,{data:remoteData,deleted:remoteDeleted});
  if(matchesRemote)delete _pendingDomains[domain];
  else _pendingDomains[domain]={domain:domain,data:chosenDeleted?null:_clone(chosenData),deleted:!!chosenDeleted,baseRevision:item.cloudRevision,baseKnown:true,baseData:remoteDeleted?null:_clone(remoteData),baseDeleted:!!remoteDeleted,queuedAt:new Date().toISOString(),clientId:_clientId};
  if(!_persistLocalState()||!_persistQueue()){
    STATE=snapshot;_pendingDomains=pendingSnapshot;
    if(revisionSnapshot===undefined)delete _domainRevisions[domain];else _domainRevisions[domain]=revisionSnapshot;
    if(existsSnapshot===undefined)delete _domainExists[domain];else _domainExists[domain]=existsSnapshot;
    if(cloudHad)_cloudData[domain]=cloudSnapshot;else delete _cloudData[domain];
    _persistLocalState();_persistQueue();_updateSyncPresentation();return;
  }
  delete _syncConflicts[domain];
  if(!_persistConflicts()){
    _syncConflicts[domain]=item;_updateSyncPresentation();return;
  }
  _localSnapshots=_clone(STATE);_persistRevisionMetadata();_updateSyncPresentation();_rerenderCurrentPage();
  emitLifeHubChange({action:'conflict-resolved',domains:[domain],source:'local',choice:choice,rendered:true});openSyncReview();if(!matchesRemote)_flushPendingWrites();
}

function _downloadJson(payload,name){var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},0)}
function downloadLifeHubBackup(prefix){
  var check=validateLifeHubState(STATE,{importMode:false});if(!check.ok)throw new Error(check.errors[0]);
  var payload={version:2,schemaVersion:LIFEHUB_SCHEMA_VERSION,exportedAt:new Date().toISOString(),state:_clone(STATE),domainRevisions:_clone(_domainRevisions)};
  var date=typeof localDateKey==='function'?localDateKey(new Date()):new Date().toISOString().slice(0,10);_downloadJson(payload,(prefix||'life-hub-backup')+'-'+date+'.json');if(!prefix&&typeof showCelebrationToast==='function')showCelebrationToast('Backup saved','📥');return payload;
}
function importLifeHubBackup(){
  var input=document.getElementById('import-file');if(!input||!input.files||!input.files[0])return;var file=input.files[0];if(file.size>LIFEHUB_MAX_IMPORT_BYTES){alert('Import failed: backup is larger than 5 MB.');return}
  var reader=new FileReader();reader.onload=function(event){try{
    var parsed=JSON.parse(event.target.result);var version=Number(parsed.version||1);if(!Number.isInteger(version)||version<1)throw new Error('Invalid backup version.');if(version>2)throw new Error('This backup was created by a newer Life Hub version.');if(!parsed.state)throw new Error('Invalid Life Hub backup.');
    var imported=_clone(parsed.state);Object.keys(DEFAULT_STATE||{}).forEach(function(domain){if(imported[domain]===undefined)imported[domain]=_clone(DEFAULT_STATE[domain])});
    var check=validateLifeHubState(imported,{importMode:true,requireCore:true});if(!check.ok)throw new Error(check.errors[0]);
    var changed=_changedDomains(STATE,imported,false);var summary='This backup will replace '+changed.length+' data area'+(changed.length===1?'':'s')+'. A copy of your current data will download first. Continue?';if(!confirm(summary))return;
    downloadLifeHubBackup('life-hub-pre-import');captureUndoSnapshot('Imported backup');STATE=imported;if(!saveState({forceAll:true,undoLabel:'Imported backup'}))throw new Error('The imported data could not be saved.');
    if(typeof closeModal==='function')closeModal();_rerenderCurrentPage();if(typeof showCelebrationToast==='function')showCelebrationToast('Backup imported and queued for sync','📤');
  }catch(e){alert('Import failed: '+e.message)}};reader.onerror=function(){alert('Import failed: the file could not be read.')};reader.readAsText(file);
}
