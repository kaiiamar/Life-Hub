import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

function clone(window,value){return window.JSON.parse(window.JSON.stringify(value))}
function persistenceHarness(options={}){const harness=createHarness(options);harness.window.DEFAULT_STATE={};harness.loadPersistence();return harness}
function completedLegacy(window,revision,date='2026-10-09'){
  const occurrence=window.winterArcLegacyOccurrence(date);
  return {
    id:occurrence.id,occurrenceId:occurrence.id,planId:occurrence.planId,planVersion:occurrence.planVersion,planContentRevision:revision,date:date,
    code:occurrence.code,label:'Preserved legacy '+occurrence.code,kind:occurrence.kind,status:'completed',qualifies:true,durationSec:2700,manualCompletion:true,
    startedAt:date+'T09:00:00.000Z',completedAt:date+'T09:45:00.000Z',
    exercises:[{id:occurrence.id+'__historic',exerciseId:'historic',name:'Historical movement',sets:[{id:occurrence.id+'__historic__s1',loadKg:17,reps:7,done:true,pain:'Niggle'}]}]
  };
}
function activeLegacy(window,revision,date,status){
  const session=completedLegacy(window,revision,date);
  session.status=status;session.durationSec=0;delete session.manualCompletion;delete session.completedAt;
  if(status==='planned')delete session.startedAt;
  return session;
}
function installWorkoutUi(window){
  window.document.body.innerHTML='<div class="page active" id="page-workout"><div class="sub-page active" id="workout-history"><div id="muscle-filters"></div><div id="all-workouts"></div></div><div id="training-calendar"></div></div><div class="page" id="page-winter-arc"><h1 id="winter-arc-page-title"></h1><span id="winter-arc-page-kicker"></span><div id="winter-arc-content"></div></div>';
  window.confirmDelete=function(_message,callback){return callback()};
  window.nav=function(page,callback){window.document.querySelectorAll('.page').forEach(function(node){node.classList.remove('active')});const target=window.document.getElementById('page-'+page);if(target)target.classList.add('active');if(page==='winter-arc'&&typeof window.renderWinterArcPage==='function')window.renderWinterArcPage();if(callback)callback()};
  window.eval(source('js/workouts.js'));
}

describe('Winter Arc revision compatibility',function(){
  it('validates v1.1/v1.2 against frozen identities and preserves their payload',function(){
    ['1.1','1.2'].forEach(function(revision){
      const {window}=persistenceHarness();
      const session=completedLegacy(window,revision),before=window.JSON.stringify(session);
      const result=window.validateLifeHubState(clone(window,{trainingSessions:{[session.id]:session}}),{importMode:true});
      expect(result,{revision:revision,errors:result.errors}).toEqual({ok:true,errors:[]});
      window.STATE.trainingSessions[session.id]=session;
      expect(window.winterArcDailyStatus(session.date).rows.find(function(rule){return rule.id==='workout'}).done).toBe(true);
      expect(window.JSON.stringify(window.STATE.trainingSessions[session.id])).toBe(before);
    });
  });

  it('shows and opens the exact legacy record in Calendar and History',function(){
    const {window,state}=createHarness();
    const session=completedLegacy(window,'1.2');state.trainingSessions[session.id]=session;state.workouts=[];state.metrics={run:[]};
    installWorkoutUi(window);
    window.trainingCalendarCursor='2026-10';
    window.renderTrainingCalendar();window.renderAllWorkouts();
    expect(window.document.getElementById('training-calendar').textContent).toContain('INT · Preserved legacy INT');
    expect(window.document.getElementById('all-workouts').textContent).toContain('Preserved legacy INT');
    const open=window.document.querySelector('.wa-history-open');expect(open.getAttribute('onclick')).toContain(session.id);
    window.openWinterArcWorkout(session.date,session.id);
    expect(window.document.getElementById('winter-arc-content').textContent).toContain('Preserved legacy INT');
  });

  it('represents coexisting canonical and legacy records with exact Calendar routes',function(){
    const {window,state}=createHarness();
    const date='2026-10-09',legacy=completedLegacy(window,'1.2',date),canonical=window.buildTrainingSession(date);
    canonical.status='completed';canonical.manualCompletion=true;canonical.startedAt=date+'T10:00:00.000Z';canonical.completedAt=date+'T10:45:00.000Z';
    state.trainingSessions[legacy.id]=legacy;state.trainingSessions[canonical.id]=canonical;state.workouts=[];state.metrics={run:[]};
    installWorkoutUi(window);window.trainingCalendarCursor='2026-10';window.renderTrainingCalendar();
    const cell=window.document.querySelector('[data-training-date="'+date+'"]');
    expect(cell.textContent).toContain('UPPER-B · Upper B');
    expect(cell.textContent).toContain('INT · Preserved legacy INT');
    const legacyRoute=cell.querySelector('.training-calendar-record');
    expect(legacyRoute.getAttribute('onclick')).toContain(legacy.id);
    window.openWinterArcWorkout(date,legacy.id);
    expect(window.document.getElementById('winter-arc-content').textContent).toContain('Preserved legacy INT');
  });

  it('rejects a pre-cutover v1.3 record during bootstrap/import validation',function(){
    const {window}=persistenceHarness({today:'2026-10-05'});
    const impossible=window.buildTrainingSession('2026-10-05');
    expect(impossible.planContentRevision).toBe('1.2');
    impossible.planContentRevision='1.3';
    expect(window.winterArcOccurrenceForSession(impossible)).toBeNull();
    const result=window.validateLifeHubState(clone(window,{trainingSessions:{[impossible.id]:impossible}}),{importMode:true});
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('content revision');
  });

  it('strictly validates explicit and revisionless v1.3 exercise identity and set bounds',function(){
    const {window}=persistenceHarness({today:'2026-10-08'});
    const canonical=window.buildTrainingSession('2026-10-08');
    function validate(session){return window.validateLifeHubState(clone(window,{trainingSessions:{[session.id]:session}}),{importMode:true})}
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

  it.each([
    ['1.1','2026-10-05','planned'],
    ['1.2','2026-10-09','in-progress']
  ])('preserves %s identity and payload through recovery and rest on %s',function(revision,date,status){
    const {window,state}=createHarness({today:date});
    const session=activeLegacy(window,revision,date,status),beforeExercises=window.JSON.stringify(session.exercises),identity={id:session.id,occurrenceId:session.occurrenceId,planContentRevision:session.planContentRevision};
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

  it('keeps v1.3 next targets in range without inventing loads',function(){
    const {window,state}=createHarness({today:'2026-10-08'}),id=window.startWinterArcSession('2026-10-08'),session=state.trainingSessions[id];
    const bridge=session.exercises.find(function(exercise){return exercise.exerciseId==='LB2'}),press=session.exercises.find(function(exercise){return exercise.exerciseId==='LB4'});
    bridge.sets.forEach(function(set){set.reps=12;set.loadKg=0;set.done=true;set.effort='Right'});
    press.sets.forEach(function(set){set.reps=12;set.loadKg=20;set.done=true;set.effort='Right'});
    expect(window.finishWinterArcSession(id)).toBe(true);
    expect(bridge.next).toMatchObject({action:'choose-load',loadKg:0,reps:12});
    expect(press.next).toMatchObject({action:'choose-load',loadKg:20,reps:12});
    const next=window.buildTrainingSession('2026-10-15'),nextBridge=next.exercises.find(function(exercise){return exercise.exerciseId==='LB2'}),nextPress=next.exercises.find(function(exercise){return exercise.exerciseId==='LB4'});
    expect(nextBridge.sets.every(function(set){return set.loadKg===0&&set.reps===12})).toBe(true);
    expect(nextPress.sets.every(function(set){return set.loadKg===20&&set.reps===12})).toBe(true);
  });
});
