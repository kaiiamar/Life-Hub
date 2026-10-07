import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function stepHabit(state){return state.habits.find(function(habit){return habit.id==='steps-towards-10k-v1'})}

function persistenceHarness(){
  const harness=createHarness();
  harness.window.DEFAULT_STATE={};
  harness.loadPersistence();
  return harness;
}

describe('challenge habit provenance contract',function(){
  it('accepts canonical challenge sources and rejects malformed records',function(){
    const {window,state}=persistenceHarness();
    const habit=stepHabit(state);
    habit.logProvenance={'2026-10-10':{sources:{'challenge:winter-arc-75-me-v1__steps__2026-10-10':true}}};
    window.projectHabitLogs(habit);
    expect(window.validateHabitDomainData(state.habits)).toMatchObject({ok:true,errors:[]});

    habit.logProvenance['2026-10-10'].sources={'challenge:winter-arc-75-me-v1__steps__not-a-date':true};
    expect(window.validateHabitDomainData(state.habits).ok).toBe(false);
    habit.logProvenance['2026-10-10'].sources={'challenge:winter-arc-75-me-v1__reading__2026-10-10':true};
    expect(window.validateHabitDomainData(state.habits).ok).toBe(false);
    habit.logProvenance['2026-10-10'].sources={'challenge:winter-arc-75-me-v1__steps__2026-02-30':true};
    expect(window.validateHabitDomainData(state.habits).ok).toBe(false);
  });

  it('projects source changes while preserving independent manual completion',function(){
    const {window,state}=createHarness();
    const habit=stepHabit(state),key='2026-10-10',record='winter-arc-75-me-v1__steps__'+key;
    window.setManualHabitCompletion(habit,key,true);
    expect(window.applyHabitSource('lifehub.steps.10000',key,'challenge',record)).toEqual([habit.id]);
    expect(habit.logProvenance[key]).toEqual({manual:true,sources:{['challenge:'+record]:true}});
    expect(habit.logs[key]).toBe(true);
    expect(window.removeHabitSource('challenge',record)).toEqual([habit.id]);
    expect(habit.logProvenance[key]).toEqual({manual:true,sources:{}});
    expect(habit.logs[key]).toBe(true);
  });

  it('merges independent source keys and projects the merged log',function(){
    const {window}=persistenceHarness();
    const key='2026-10-10';
    const merged=window._mergeHabitProvenance(
      {},
      {[key]:{sources:{'challenge:winter-arc-75-me-v1__steps__2026-10-10':true}}},
      {[key]:{sources:{'workout:session_1':true}}}
    );
    expect(merged.clean).toBe(true);
    expect(merged.local[key].sources).toEqual({
      'challenge:winter-arc-75-me-v1__steps__2026-10-10':true,
      'workout:session_1':true
    });
    const habit={logProvenance:merged.local,logs:{}};
    window.projectHabitLogs(habit);
    expect(habit.logs).toEqual({[key]:true});
  });
});
