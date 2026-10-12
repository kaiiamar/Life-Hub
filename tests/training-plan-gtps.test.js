import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function summary(occurrence){
  return {code:occurrence.code,label:occurrence.label,kind:occurrence.kind};
}

const expected={
  'LOWER-A':[
    ['Hip thrust machine',3,10,12],['Leg press',3,10,12],['Leg extension',3,12,15],['Seated hamstring curl',3,12,15],['Hip abduction machine',2,15,20]
  ],
  'UPPER-A':[
    ['Lat pulldown',3,8,12],['Chest-supported row',3,8,12],['Seated shoulder press',3,8,12],['Dumbbell lateral raises',3,12,15],['Bicep curls',2,10,15],['Tricep pressdowns',2,10,15]
  ],
  'LOWER-B':[
    ['Dumbbell Romanian deadlift',3,10,10],['Glute bridge',3,12,12],['Seated hamstring curl',3,12,12],['Leg press',2,12,12],['Hip abduction machine',2,15,20]
  ],
  'UPPER-B':[
    ['Assisted pull-ups',3,6,10],['Seated cable row',3,8,12],['Machine chest press',3,8,12],['Rear-delt fly',3,12,15],['Lateral raises',2,12,15],['Bicep curls',2,10,15],['Tricep extensions',2,10,15]
  ]
};

describe('GTPS-aware 75-day prescription',function(){
  it('keeps the challenge bounds and switches canonically on Day 4',function(){
    const {window}=createHarness();
    expect(window.winterArcOccurrence('2026-10-04')).toBeNull();
    expect(window.winterArcOccurrence('2026-12-19')).toBeNull();
    expect(window.winterArcOccurrence('2026-10-05')).toMatchObject({day:1,date:'2026-10-05',code:'A',planContentRevision:'1.2'});
    expect(window.winterArcOccurrence('2026-12-18')).toMatchObject({day:75,date:'2026-12-18',code:'UPPER-B',planContentRevision:'1.3'});
    expect(summary(window.winterArcOccurrence('2026-10-08'))).toEqual({code:'LOWER-B',label:'Lower B',kind:'strength'});
    expect(window.winterArcOccurrence('2026-10-08')).toMatchObject({day:4,week:1});
  });

  it('maps a full Monday-to-Sunday week to all seven named sessions',function(){
    const {window}=createHarness();
    const dates=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'];
    expect(dates.map(function(date){const occurrence=window.winterArcOccurrence(date);return [occurrence.code,occurrence.label]})).toEqual([
      ['LOWER-A','Lower A'],['UPPER-A','Upper A'],['MOBILITY-PILATES','Mobility + Pilates'],['LOWER-B','Lower B'],['UPPER-B','Upper B'],['LOW-IMPACT','Low-impact conditioning'],['ACTIVE-RECOVERY','Active recovery + rehab']
    ]);
  });

  it('uses the exact strength exercises, base sets, rep ranges, and blank loads',function(){
    const {window}=createHarness();
    const plan=window.winterArcPlan();
    Object.keys(expected).forEach(function(code){
      const definitions=plan.exercises[code];
      expect(definitions.map(function(exercise){const range=exercise.reps.consistency;return [exercise.name,exercise.fixedSets,range[0],range[1]]})).toEqual(expected[code]);
      expect(definitions.every(function(exercise){return exercise.startLoadKg===0})).toBe(true);
    });
    const draft=window.buildTrainingSession('2026-10-09');
    expect(draft.exercises.every(function(exercise){return exercise.sets.every(function(set){return set.loadKg===0})})).toBe(true);
  });

  it('changes phases at the inclusive day boundaries',function(){
    const {window}=createHarness();
    function phase(day){const date=new window.Date('2026-10-05T12:00:00');date.setDate(date.getDate()+day-1);return window.winterArcOccurrence(window.localDateKey(date)).phase.key}
    expect([phase(14),phase(15),phase(35),phase(36),phase(55),phase(56)]).toEqual(['consistency','build','build','strength','strength','consolidate']);
  });

  it('never offers running and retains the supplied clinical boundaries',function(){
    const {window}=createHarness();
    const plan=window.winterArcPlan();
    const offered=[];
    plan.weekPattern.forEach(function(day){
      offered.push(day.label,day.focus||'',day.chosenSessionPlaceholder||'');
      (day.blocks||[]).forEach(function(block){offered.push(block[0])});
      (day.options||[]).forEach(function(option){offered.push(option)});
    });
    Object.values(plan.exercises).flat().forEach(function(exercise){offered.push(exercise.name,exercise.swap||'')});
    expect(offered.join(' ')).not.toMatch(/\brun(?:ning)?\b/i);
    expect(plan.safety.running).toBe('Running is excluded following GP advice.');
    expect(plan.phases.find(function(phase){return phase.fromDay===36}).guidance).toContain('no running');
    expect(plan.weekPattern.find(function(day){return day.code==='LOW-IMPACT'}).guidance).toContain('No running, jumping, or hard intervals.');
    expect(plan.weekPattern.find(function(day){return day.code==='MOBILITY-PILATES'})).not.toHaveProperty('url');
    expect(plan.dailyCore).toBeNull();
    expect(plan.progressPhotos).toEqual([1,25,50,75]);
  });

  it('keeps the exact eight challenge rules',function(){
    const {window}=createHarness();
    expect(window.winterArcPlan().challenge.rules.map(function(rule){return [rule.id,rule.label]})).toEqual([
      ['steps','10k Steps'],['workout','Planned workout'],['water','2L water'],['duolingo','Duolingo'],['reading','Reading 15 min'],['manna','Manna'],['alcohol','Alcohol special occasions only'],['eating','Whole foods, no takeaway']
    ]);
  });
});
