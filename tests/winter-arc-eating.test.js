import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

describe('75 Me whole-foods rule',function(){
  it('keeps exactly eight rules with the qualitative rule eighth',function(){
    const {window}=createHarness();
    const rules=window.WINTER_ARC_TRAINING_V1.challenge.rules;
    expect(rules).toHaveLength(8);
    expect(new Set(rules.map(function(rule){return rule.id})).size).toBe(8);
    expect(rules[7]).toEqual({id:'eating',label:'Whole foods, no takeaway',icon:'🍓',evidence:'manual-confirmation',confirmationKey:'eating'});
    expect(rules[7]).not.toHaveProperty('proteinMinG');
    expect(rules[7]).not.toHaveProperty('caloriesMin');
    expect(rules[7]).not.toHaveProperty('caloriesMax');
  });

  it('ignores legacy nutrition evidence until explicitly confirmed',function(){
    const {window,state}=createHarness();
    const key='2026-10-09';
    state.dailyCheckIns[key]={date:key,proteinG:150,calories:1900,balancedPortionsConfirmed:true};
    const eating=window.winterArcDailyStatus(key).rows.find(function(row){return row.id==='eating'});
    expect(eating).toMatchObject({done:false,meta:'Tap to confirm'});
  });

  it('writes true, undoes by omission, and preserves legacy fields',function(){
    const {window,state}=createHarness();
    const key='2026-10-09';
    state.dailyCheckIns[key]={date:key,proteinG:150,calories:1900,balancedPortionsConfirmed:true};
    expect(window.setWinterArcManualConfirmation(key,'eating',true)).toBe(true);
    expect(state.dailyCheckIns[key]).toMatchObject({proteinG:150,calories:1900,balancedPortionsConfirmed:true,manualConfirmations:{eating:true}});
    expect(window.winterArcDailyStatus(key).rows.find(function(row){return row.id==='eating'})).toMatchObject({done:true,meta:'Confirmed'});
    expect(window.setWinterArcManualConfirmation(key,'eating',false)).toBe(true);
    expect(state.dailyCheckIns[key]).toMatchObject({proteinG:150,calories:1900,balancedPortionsConfirmed:true});
    expect(state.dailyCheckIns[key]).not.toHaveProperty('manualConfirmations');
  });

  it('contributes one check to 8/8 and rejects future confirmation',function(){
    const {window,state}=createHarness({today:'2026-10-10'});
    const key='2026-10-10';
    state.dailyCheckIns[key]={date:key,steps:10000,alcoholState:'none',manualConfirmations:{workout:true,reading:true,eating:true}};
    state.water[key]=8;
    state.habits.forEach(function(habit){habit.logs[key]=true});
    expect(window.winterArcDailyStatus(key)).toMatchObject({done:8,total:8,complete:true});
    delete state.dailyCheckIns[key].manualConfirmations.eating;
    expect(window.winterArcDailyStatus(key)).toMatchObject({done:7,total:8,complete:false});
    expect(window.setWinterArcManualConfirmation('2026-10-11','eating',true)).toBe(false);
    expect(state.dailyCheckIns['2026-10-11']).toBeUndefined();
  });
});
