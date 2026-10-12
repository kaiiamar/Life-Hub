import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

function clone(window,value){return window.JSON.parse(window.JSON.stringify(value))}
function persistenceHarness(options={}){const harness=createHarness(options);harness.window.DEFAULT_STATE={};harness.loadPersistence();return harness}
function completedHistorical(window,revision,date='2026-10-09'){
  const occurrence=revision==='1.3'?window.winterArcV13Occurrence(date):window.winterArcLegacyOccurrence(date);
  return {
    id:occurrence.id,occurrenceId:occurrence.id,planId:occurrence.planId,planVersion:occurrence.planVersion,planContentRevision:revision,date:date,
    code:occurrence.code,label:'Preserved v'+revision+' '+occurrence.code,kind:occurrence.kind,status:'completed',qualifies:true,durationSec:2700,manualCompletion:true,
    startedAt:date+'T09:00:00.000Z',completedAt:date+'T09:45:00.000Z',
    exercises:[{id:occurrence.id+'__historic',exerciseId:'historic',name:'Historical movement',sets:[{id:occurrence.id+'__historic__s1',loadKg:17,reps:7,done:true,pain:'Niggle'}]}]
  };
}
function activeHistorical(window,revision,date,status){
  const session=completedHistorical(window,revision,date);
  session.status=status;session.durationSec=0;delete session.manualCompletion;delete session.completedAt;
  if(status==='planned')delete session.startedAt;
  return session;
}
function installWorkoutUi(window){
  window.document.body.innerHTML='<div class="page active" id="page-workout"><div class="sub-page active" id="workout-history"><div id="muscle-filters"></div><div id="all-workouts"></div></div><div id="training-calendar"></div></div><div class="page" id="page-winter-arc"><h1 id="winter-arc-page-title"></h1><span id="winter-arc-page-kicker"></span><div id="winter-arc-content"></div></div>';
  window.confirmDelete=function(_message,callback){return callback()};
  window.subNav=function(){};
  window.nav=function(page,callback){window.document.querySelectorAll('.page').forEach(function(node){node.classList.remove('active')});const target=window.document.getElementById('page-'+page);if(target)target.classList.add('active');if(page==='winter-arc'&&typeof window.renderWinterArcPage==='function')window.renderWinterArcPage();if(callback)callback()};
  window.eval(source('js/workouts.js'));
}

function completeCanonical(window,session,date){
  session.status='completed';session.manualCompletion=true;session.startedAt=date+'T10:00:00.000Z';session.completedAt=date+'T10:45:00.000Z';
  return session;
}

describe('Winter Arc revision compatibility',function(){
  it('grandfathers v1.1-v1.3 payloads and preserves their workout evidence',function(){
    [['1.1','2026-10-09'],['1.2','2026-10-09'],['1.3','2026-10-09']].forEach(function(entry){
      const revision=entry[0],date=entry[1],{window}=persistenceHarness(),session=completedHistorical(window,revision,date),before=window.JSON.stringify(session);
      const result=window.validateLifeHubState(clone(window,{trainingSessions:{[session.id]:session}}),{importMode:true});
      expect(result,{revision:revision,errors:result.errors}).toEqual({ok:true,errors:[]});
      window.STATE.trainingSessions[session.id]=session;
      expect(window.winterArcDailyStatus(session.date).rows.find(function(rule){return rule.id==='workout'}).done).toBe(true);
      expect(window.JSON.stringify(window.STATE.trainingSessions[session.id])).toBe(before);
    });
  });

  it('shows and opens exact v1.2 and v1.3 records in Calendar and History',function(){
    const {window,state}=createHarness();
    const records=[completedHistorical(window,'1.2','2026-10-09'),completedHistorical(window,'1.3','2026-10-10')];
    records.forEach(function(session){state.trainingSessions[session.id]=session});state.workouts=[];state.metrics={run:[]};
    installWorkoutUi(window);window.trainingCalendarCursor='2026-10';window.renderTrainingCalendar();window.renderAllWorkouts();
    records.forEach(function(session){
      expect(window.document.getElementById('training-calendar').textContent).toContain(session.label);
      expect(window.document.getElementById('all-workouts').textContent).toContain(session.label);
      const open=Array.from(window.document.querySelectorAll('.wa-history-open')).find(function(button){return button.getAttribute('onclick').includes(session.id)});
      expect(open).toBeTruthy();window.openWinterArcWorkout(session.date,session.id);
      expect(window.document.getElementById('winter-arc-content').textContent).toContain(session.label);window.closeWinterArcPage();
    });
  });

  it('keeps the v1.4 primary and coexisting history on exact Calendar routes',function(){
    const {window,state}=createHarness();
    const date='2026-10-09',legacy=completedHistorical(window,'1.2',date),v13=completedHistorical(window,'1.3',date),canonical=completeCanonical(window,window.buildTrainingSession(date),date);
    state.trainingSessions[legacy.id]=legacy;state.trainingSessions[v13.id]=v13;state.trainingSessions[canonical.id]=canonical;state.workouts=[];state.metrics={run:[]};
    installWorkoutUi(window);window.trainingCalendarCursor='2026-10';window.renderTrainingCalendar();
    const cell=window.document.querySelector('[data-training-date="'+date+'"]');
    expect(cell.textContent).toContain('CARDIO · Cardio');
    expect(cell.textContent).toContain(legacy.label);
    expect(cell.textContent).toContain(v13.label);
    expect(cell.querySelector('.training-calendar-primary').getAttribute('onclick')).toContain(canonical.id);
    const historicalRoutes=Array.from(cell.querySelectorAll('.training-calendar-record')).map(function(button){return button.getAttribute('onclick')});
    expect(historicalRoutes.some(function(route){return route.includes(legacy.id)})).toBe(true);
    expect(historicalRoutes.some(function(route){return route.includes(v13.id)})).toBe(true);
    window.openWinterArcWorkout(date,v13.id);
    expect(window.document.getElementById('winter-arc-content').textContent).toContain(v13.label);
  });

  it('does not let historical-only records hide or satisfy the v1.4 primary',function(){
    const {window,state}=createHarness();
    const date='2026-10-09',historical=completedHistorical(window,'1.3',date);state.trainingSessions[historical.id]=historical;state.workouts=[];state.metrics={run:[]};
    installWorkoutUi(window);window.trainingCalendarCursor='2026-10';window.renderTrainingCalendar();
    expect(window.winterArcCurrentSessionForDate(date)).toBeNull();
    const cell=window.document.querySelector('[data-training-date="'+date+'"]');
    expect(cell.textContent).toContain('CARDIO · Cardio');
    expect(cell.textContent).toContain(historical.label);
    expect(cell.querySelector('.training-calendar-primary').getAttribute('onclick')).not.toContain(historical.id);
  });

  it.each(['1.3','1.4'])('rejects a pre-cutover v%s record during bootstrap/import validation',function(revision){
    const {window}=persistenceHarness({today:'2026-10-05'});
    const impossible=window.buildTrainingSession('2026-10-05');
    expect(impossible.planContentRevision).toBe('1.2');
    impossible.planContentRevision=revision;
    expect(window.winterArcOccurrenceForSession(impossible)).toBeNull();
    const result=window.validateLifeHubState(clone(window,{trainingSessions:{[impossible.id]:impossible}}),{importMode:true});
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('content revision');
  });

  it('strictly validates explicit and revisionless v1.4 exercise identity and set bounds',function(){
    const {window}=persistenceHarness({today:'2026-10-08'});
    const canonical=window.buildTrainingSession('2026-10-08');
    function validate(session){return window.validateLifeHubState(clone(window,{trainingSessions:{[session.id]:session}}),{importMode:true})}
    expect(canonical.planContentRevision).toBe('1.4');
    expect(validate(canonical)).toEqual({ok:true,errors:[]});

    const wrongCode=clone(window,canonical);wrongCode.code='UPPER-A';expect(validate(wrongCode).ok).toBe(false);
    const missing=clone(window,canonical);missing.exercises.pop();expect(validate(missing).ok).toBe(false);
    const tooFew=clone(window,canonical);tooFew.exercises[0].sets.pop();expect(validate(tooFew).ok).toBe(false);
    const foreign=clone(window,canonical);foreign.exercises[0].exerciseId='FOREIGN';foreign.exercises[0].id=foreign.id+'__FOREIGN';foreign.exercises[0].sets.forEach(function(set,index){set.id=foreign.exercises[0].id+'__s'+(index+1)});expect(validate(foreign).ok).toBe(false);

    const revisionless=clone(window,canonical);delete revisionless.planContentRevision;expect(validate(revisionless)).toEqual({ok:true,errors:[]});expect(window.winterArcSessionMatchesOccurrence(revisionless)).toBe(true);
    const invalidRevisionless=clone(window,revisionless);invalidRevisionless.exercises.pop();expect(validate(invalidRevisionless).ok).toBe(false);

    const twelve=clone(window,canonical),exercise=twelve.exercises[0];while(exercise.sets.length<12)exercise.sets.push({...clone(window,exercise.sets[0]),id:exercise.id+'__x'+exercise.sets.length});expect(validate(twelve)).toEqual({ok:true,errors:[]});
    const thirteen=clone(window,twelve);thirteen.exercises[0].sets.push({...clone(window,exercise.sets[0]),id:exercise.id+'__x12'});expect(validate(thirteen).ok).toBe(false);
  });

  it('resolves revisionless v1.3 records by their historical deterministic ID',function(){
    const {window}=persistenceHarness(),historical=completedHistorical(window,'1.3','2026-10-09');delete historical.planContentRevision;
    const before=window.JSON.stringify(historical),resolved=window.winterArcOccurrenceForSession(historical);
    expect(resolved).toMatchObject({code:'UPPER-B',planContentRevision:'1.3'});
    expect(window.validateLifeHubState(clone(window,{trainingSessions:{[historical.id]:historical}}),{importMode:true})).toEqual({ok:true,errors:[]});
    expect(window.JSON.stringify(historical)).toBe(before);
  });

  it.each([
    ['1.1','2026-10-05','planned'],
    ['1.2','2026-10-09','in-progress'],
    ['1.3','2026-10-09','in-progress']
  ])('preserves %s identity and payload through recovery and rest on %s',function(revision,date,status){
    const {window,state}=createHarness({today:date});
    const session=activeHistorical(window,revision,date,status),beforeExercises=window.JSON.stringify(session.exercises),identity={id:session.id,occurrenceId:session.occurrenceId,planContentRevision:session.planContentRevision};
    state.trainingSessions[session.id]=session;
    ['recovery','rest'].forEach(function(choice){
      expect(window.saveDailyCheckIn(date,{sessionChoice:choice})).toBe(true);
      expect(window.reconcileWinterArcSessionSafety(date,session.id)).toBe(true);
      expect(session).toMatchObject(identity);
      expect(session.code).toBe(choice==='rest'?'REST-SAFETY':'REC-SAFETY');
      expect(session.exercises).toEqual([]);
      expect(window.saveDailyCheckIn(date,{sessionChoice:null})).toBe(true);
      expect(window.reconcileWinterArcSessionSafety(date,session.id)).toBe(true);
      expect(session).toMatchObject(identity);
      expect(window.JSON.stringify(session.exercises)).toBe(beforeExercises);
      const validator=persistenceHarness({today:date}).window,result=validator.validateLifeHubState(clone(validator,{trainingSessions:{[session.id]:session}}),{importMode:true});
      expect(result,{choice:choice,errors:result.errors}).toEqual({ok:true,errors:[]});
    });
  });

  it('starts v1.4 beside an untouched v1.3 draft instead of upgrading it',function(){
    const date='2026-10-09',{window,state}=createHarness({today:date}),historical=activeHistorical(window,'1.3',date,'in-progress'),before=window.JSON.stringify(historical);state.trainingSessions[historical.id]=historical;
    const currentId=window.startWinterArcSession(date);
    expect(currentId).not.toBe(historical.id);
    expect(state.trainingSessions[currentId]).toMatchObject({code:'CARDIO',planContentRevision:'1.4'});
    expect(window.JSON.stringify(state.trainingSessions[historical.id])).toBe(before);
  });

  it('keeps v1.4 next targets in range without inventing loads',function(){
    const {window,state}=createHarness({today:'2026-10-10'}),id=window.startWinterArcSession('2026-10-10'),session=state.trainingSessions[id];
    const bridge=session.exercises.find(function(exercise){return exercise.exerciseId==='LB2'}),press=session.exercises.find(function(exercise){return exercise.exerciseId==='LB4'});
    bridge.sets.forEach(function(set){set.reps=12;set.loadKg=0;set.done=true;set.effort='Right'});
    press.sets.forEach(function(set){set.reps=12;set.loadKg=20;set.done=true;set.effort='Right'});
    expect(window.finishWinterArcSession(id)).toBe(true);
    expect(bridge.next).toMatchObject({action:'choose-load',loadKg:0,reps:12});
    expect(press.next).toMatchObject({action:'choose-load',loadKg:20,reps:12});
    const next=window.buildTrainingSession('2026-10-17'),nextBridge=next.exercises.find(function(exercise){return exercise.exerciseId==='LB2'}),nextPress=next.exercises.find(function(exercise){return exercise.exerciseId==='LB4'});
    expect(nextBridge.sets.every(function(set){return set.loadKg===0&&set.reps===12})).toBe(true);
    expect(nextPress.sets.every(function(set){return set.loadKg===20&&set.reps===12})).toBe(true);
  });

  it('accepts a fresh-profile v1.4 session during bootstrap validation',function(){
    const {window,state}=persistenceHarness({today:'2026-10-08'}),session=window.buildTrainingSession('2026-10-08');state.trainingSessions[session.id]=session;
    expect(window.validateLifeHubState(clone(window,state),{importMode:false})).toEqual({ok:true,errors:[]});
  });
});
