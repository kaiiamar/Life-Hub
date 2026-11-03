import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function managed(state){return state.habits.find(function(item){return item.id==='steps-towards-10k-v1'})}
function workoutHabit(){return {id:'workout-habit',name:'Any workout',freq:'daily',badge:'fit',anchor:'anytime',icon:'',note:'',startDate:'2026-11-02',logs:{},integrationKeys:['lifehub.workout.any'],provenanceVersion:1,logProvenance:{},lifecycle:{version:1,inactivePeriods:[]}}}

describe('Daily Basics evidence integration',function(){
  it('uses the 8,000 threshold and retracts only its owned source',function(){
    const {window,state,emitted}=createHarness({today:'2026-11-02'});expect(window.reconcileDailyBasicsState(state).ok).toBe(true);const habit=managed(state),key='2026-11-02';
    window.setManualHabitCompletion(habit,key,true);habit.logProvenance[key].sources['workout:independent']=true;window.projectHabitLogs(habit);
    expect(window.setDailySteps(key,7999)).toBe(true);expect(habit.logProvenance[key].sources['basics:steps__'+key]).toBeUndefined();expect(window.dailyBasicsStatus(key).rows[0].done).toBe(true);
    expect(window.setDailySteps(key,8000)).toBe(true);expect(emitted.at(-1).domains).toEqual(['dailyCheckIns','habits']);expect(emitted.at(-1).domains).not.toContain('challenges');expect(habit.logProvenance[key].sources['basics:steps__'+key]).toBe(true);
    expect(window.setDailySteps(key,7000)).toBe(true);expect(habit.logProvenance[key]).toEqual({manual:true,sources:{'workout:independent':true}});
    window.setManualHabitCompletion(habit,key,false);window.removeHabitSource('workout','independent');expect(window.dailyBasicsStatus(key).rows[0].done).toBe(false);
  });

  it('keeps generic workout evidence out of Planned workout',function(){
    const {window,state}=createHarness({today:'2026-11-02'});window.reconcileDailyBasicsState(state);state.habits.push(workoutHabit());
    window.applyHabitSource('lifehub.workout.any','2026-11-02','workout','generic_1');expect(window.dailyBasicsStatus('2026-11-02').rows[1].done).toBe(false);
    const id=window.startWinterArcSession('2026-11-02');expect(window.finishWinterArcSession(id)).toBe(true);expect(window.dailyBasicsStatus('2026-11-02').rows[1].done).toBe(true);
    const linked=state.habits.find(function(item){return item.id==='workout-habit'});window.setManualHabitCompletion(linked,'2026-11-02',true);expect(window.removeWinterArcSession(id)).toBe(true);expect(linked.logProvenance['2026-11-02']).toEqual({manual:true,sources:{'workout:generic_1':true}});expect(window.dailyBasicsStatus('2026-11-02').rows[1].done).toBe(false);
  });

  it('never publishes workout evidence for Full Rest',function(){
    const {window,state}=createHarness({today:'2026-11-02'});window.reconcileDailyBasicsState(state);state.habits.push(workoutHabit());expect(window.saveDailyCheckIn('2026-11-02',{sessionChoice:'rest'})).toBe(true);expect(window.startWinterArcSession('2026-11-02')).toBeNull();expect(state.habits.find(function(item){return item.id==='workout-habit'}).logs).toEqual({});expect(window.dailyBasicsStatus('2026-11-02').rows[1].done).toBe(false);
  });
});
