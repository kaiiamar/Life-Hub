import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function habit(state,id){return state.habits.find(function(item){return item.id===id})}
function rule(window,id,key='2026-10-10'){return window.winterArcDailyStatus(key).rows.find(function(item){return item.id===id})}
function workoutHabit(){return {id:'workout-habit',name:'Any workout',freq:'daily',badge:'fit',anchor:'anytime',icon:'',note:'',startDate:'2026-10-05',logs:{},integrationKeys:['lifehub.workout.any'],provenanceVersion:1,logProvenance:{},lifecycle:{version:1,inactivePeriods:[]}}}

describe('75 Me and Habit integration',function(){
  it('publishes current and historical 10k evidence through provenance',function(){
    const {window,state,emitted}=createHarness();
    ['2026-10-10','2026-10-07'].forEach(function(key){
      expect(window.saveDailyCheckIn(key,{steps:10000})).toBe(true);
      const steps=habit(state,'steps-towards-10k-v1');
      expect(steps.logProvenance[key].sources['challenge:winter-arc-75-me-v1__steps__'+key]).toBe(true);
      expect(steps.logs[key]).toBe(true);
      expect(rule(window,'steps',key)).toMatchObject({done:true,value:10000,habitId:steps.id});
    });
    expect(emitted.at(-1)).toMatchObject({habitIds:['steps-towards-10k-v1'],domains:['dailyCheckIns','habits']});
  });

  it('removes only linked step evidence below threshold or on clear',function(){
    const {window,state}=createHarness();
    const key='2026-10-10',steps=habit(state,'steps-towards-10k-v1');
    window.setManualHabitCompletion(steps,key,true);
    window.saveDailyCheckIn(key,{steps:12000});
    steps.logProvenance[key].sources['workout:independent_record']=true;
    window.projectHabitLogs(steps);
    window.saveDailyCheckIn(key,{steps:9000});
    expect(steps.logProvenance[key]).toEqual({manual:true,sources:{'workout:independent_record':true}});
    expect(rule(window,'steps',key)).toMatchObject({done:true,value:9000});
    window.setManualHabitCompletion(steps,key,false);
    window.removeHabitSource('workout','independent_record');
    expect(rule(window,'steps',key).done).toBe(false);
    window.saveDailyCheckIn(key,{steps:11000});
    window.saveDailyCheckIn(key,{steps:null});
    expect(steps.logProvenance[key]).toBeUndefined();
    expect(steps.logs[key]).toBeUndefined();
    expect(rule(window,'steps',key)).toMatchObject({done:false,value:0});
  });

  it('reflects manual Habit completion and undo when no numeric evidence remains',function(){
    const {window,state}=createHarness();
    const key='2026-10-10',steps=habit(state,'steps-towards-10k-v1');
    expect(window.toggleHabit(steps.id,key)).toBe(true);
    expect(rule(window,'steps',key)).toMatchObject({done:true,value:0});
    expect(window.toggleHabit(steps.id,key)).toBe(true);
    expect(rule(window,'steps',key)).toMatchObject({done:false,value:0});
  });

  it('rolls both domains back when a linked check-in save is refused',function(){
    const {window}=createHarness({saveResult:false});
    const before=window.JSON.stringify(window.STATE);
    expect(window.saveDailyCheckIn('2026-10-10',{steps:10000})).toBe(false);
    expect(window.JSON.stringify(window.STATE)).toBe(before);
  });

  it('finishes a timer-free typed session and retracts only its workout source',function(){
    const {window,state,emitted}=createHarness();
    state.habits.push(workoutHabit());
    const id=window.startWinterArcSession('2026-10-10');
    expect(window.finishWinterArcSession(id)).toBe(true);
    const linked=habit(state,'workout-habit'),session=state.trainingSessions[id];
    expect(session).toMatchObject({status:'completed',manualCompletion:true,durationSec:0});
    expect(state.dailyCheckIns['2026-10-10']).toBeUndefined();
    expect(linked.logProvenance['2026-10-10'].sources['workout:'+id]).toBe(true);
    expect(rule(window,'workout')).toMatchObject({done:true,value:2700});
    expect(emitted.at(-1).domains).toEqual(['trainingSessions','habits']);

    window.setManualHabitCompletion(linked,'2026-10-10',true);
    linked.logProvenance['2026-10-10'].sources['challenge:winter-arc-75-me-v1__workout__2026-10-10']=true;
    window.projectHabitLogs(linked);
    expect(window.removeWinterArcSession(id)).toBe(true);
    expect(state.trainingSessions[id]).toBeUndefined();
    expect(linked.logProvenance['2026-10-10']).toEqual({manual:true,sources:{'challenge:winter-arc-75-me-v1__workout__2026-10-10':true}});
  });

  it('keeps workout amendments independent from typed and generic evidence',function(){
    const {window,state}=createHarness();
    state.habits.push(workoutHabit());
    const linked=habit(state,'workout-habit'),key='2026-10-10';
    window.applyHabitSource('lifehub.workout.any',key,'workout','generic_1');
    expect(rule(window,'workout',key).done).toBe(false);
    expect(window.setWinterArcManualConfirmation(key,'workout',true)).toBe(true);
    expect(linked.logProvenance[key].sources).toEqual({
      'workout:generic_1':true,
      'challenge:winter-arc-75-me-v1__workout__2026-10-10':true
    });
    expect(rule(window,'workout',key)).toMatchObject({done:true,manual:true});
    window.setManualHabitCompletion(linked,key,true);
    expect(window.setWinterArcManualConfirmation(key,'workout',false)).toBe(true);
    expect(linked.logProvenance[key]).toEqual({manual:true,sources:{'workout:generic_1':true}});
    expect(rule(window,'workout',key).done).toBe(false);
  });
});
