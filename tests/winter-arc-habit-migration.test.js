import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function clone(window,value){return window.JSON.parse(window.JSON.stringify(value))}
function linkedWorkoutHabit(){return {id:'workout-habit',name:'Any workout',freq:'daily',badge:'fit',anchor:'anytime',icon:'',note:'',startDate:'2026-01-01',logs:{'2026-02-01':true},integrationKeys:['lifehub.workout.any'],provenanceVersion:1,logProvenance:{'2026-02-01':{manual:true,sources:{}}},lifecycle:{version:1,inactivePeriods:[]}}}

function legacyState(harness){
  const {window,state}=harness;
  const steps=state.habits.find(function(habit){return habit.id==='steps-towards-10k-v1'});
  steps.integrationKeys=[];
  steps.logs={'2026-01-15':true};
  steps.logProvenance={'2026-01-15':{manual:true,sources:{}}};
  steps.lifecycle={version:1,inactivePeriods:[{kind:'paused',from:'2026-03-01',to:'2026-03-03'},{kind:'archived',from:'2026-10-05',to:null}]};
  delete state.challenges['winter-arc-75-me-v1'].habitIds.steps;
  state.challenges['intentional-75-2026']={habitIds:{steps:steps.id,career:'career-habit'}};
  state.habits.push(linkedWorkoutHabit());
  state.dailyCheckIns['2026-10-07']={date:'2026-10-07',steps:11000,manualConfirmations:{workout:true,eating:true}};
  state.workouts=[{id:'generic-workout',date:'2026-10-06'}];
  state.metrics={run:[{id:'generic-run',date:'2026-10-06'}]};
  const session=window.buildTrainingSession('2026-10-09');
  session.status='completed';session.manualCompletion=true;session.startedAt='2026-10-09T09:00:00.000Z';session.completedAt='2026-10-09T10:00:00.000Z';
  state.trainingSessions[session.id]=session;
  return {steps:steps,session:session};
}

describe('Winter Arc Habit integration migration',function(){
  it('is idempotent and preserves history outside repaired links',function(){
    const harness=createHarness();
    const {window,state}=harness;
    const {steps,session}=legacyState(harness);
    const preserved={
      oldCompletion:clone(window,steps.logProvenance['2026-01-15']),
      priorRange:clone(window,steps.lifecycle.inactivePeriods[0]),
      session:clone(window,session),
      checkIn:clone(window,state.dailyCheckIns['2026-10-07']),
      workouts:clone(window,state.workouts),
      metrics:clone(window,state.metrics),
      habitIds:state.habits.map(function(habit){return habit.id})
    };

    expect(window.migrateWinterArcHabitIntegrationV2()).toBe(true);
    expect(state.__winterArcHabitIntegrationV2).toBe(true);
    expect(state.challenges['winter-arc-75-me-v1'].habitIds).toMatchObject({steps:steps.id,duolingo:'duolingo-habit',manna:'manna-habit'});
    expect(steps.integrationKeys).toContain('lifehub.steps.10000');
    expect(steps.lifecycle.inactivePeriods).toEqual([preserved.priorRange,{kind:'archived',from:'2026-12-19',to:null}]);
    expect(steps.logProvenance['2026-01-15']).toEqual(preserved.oldCompletion);
    expect(steps.logProvenance['2026-10-07'].sources['challenge:winter-arc-75-me-v1__steps__2026-10-07']).toBe(true);
    const workout=state.habits.find(function(habit){return habit.id==='workout-habit'});
    expect(workout.logProvenance['2026-10-09'].sources['workout:'+session.id]).toBe(true);
    expect(workout.logProvenance['2026-10-07'].sources['challenge:winter-arc-75-me-v1__workout__2026-10-07']).toBe(true);
    expect(state.trainingSessions[session.id]).toEqual(preserved.session);
    expect(state.dailyCheckIns['2026-10-07']).toEqual(preserved.checkIn);
    expect(state.workouts).toEqual(preserved.workouts);
    expect(state.metrics).toEqual(preserved.metrics);
    expect(state.habits.map(function(habit){return habit.id})).toEqual(preserved.habitIds);

    const once=window.JSON.stringify(state);
    expect(window.migrateWinterArcHabitIntegrationV2()).toBe(true);
    expect(window.JSON.stringify(state)).toBe(once);
  });

  it('uses the legacy mapping only when the stable step Habit is unavailable',function(){
    const harness=createHarness();
    const {window,state}=harness;
    const fallback=state.habits.find(function(habit){return habit.id==='steps-towards-10k-v1'});
    fallback.id='user-step-habit';
    fallback.integrationKeys=[];
    delete state.challenges['winter-arc-75-me-v1'].habitIds.steps;
    state.challenges['intentional-75-2026']={habitIds:{steps:fallback.id}};
    expect(window.migrateWinterArcHabitIntegrationV2()).toBe(true);
    expect(state.challenges['winter-arc-75-me-v1'].habitIds.steps).toBe(fallback.id);
    expect(fallback.integrationKeys).toContain('lifehub.steps.10000');
  });

  it('loads legacy state but requires Steps after the V2 marker is set',function(){
    const harness=createHarness();
    const {window,state}=harness;
    window.DEFAULT_STATE={};harness.loadPersistence();
    delete state.challenges['winter-arc-75-me-v1'].habitIds.steps;
    expect(window.validateLifeHubState(clone(window,state),{importMode:false}).ok).toBe(true);
    state.__winterArcHabitIntegrationV2=true;
    const migrated=window.validateLifeHubState(clone(window,state),{importMode:false});
    expect(migrated.ok).toBe(false);
    expect(migrated.errors.join(' ')).toContain('habitIds.steps');
  });

  it('rolls back all data and the version flag when persistence fails',function(){
    const harness=createHarness({saveResult:false});
    const {window}=harness;
    legacyState(harness);
    const before=window.JSON.stringify(window.STATE);
    expect(window.migrateWinterArcHabitIntegrationV2()).toBe(false);
    expect(window.JSON.stringify(window.STATE)).toBe(before);
    expect(window.STATE.__winterArcHabitIntegrationV2).toBeUndefined();
  });
});
