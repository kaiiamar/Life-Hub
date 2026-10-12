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

const weekDates=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'];

 describe('GTPS-aware 75-day prescription',function(){
  it('keeps the challenge bounds and switches canonically on Day 4',function(){
    const {window}=createHarness();
    expect(window.winterArcOccurrence('2026-10-04')).toBeNull();
    expect(window.winterArcOccurrence('2026-12-19')).toBeNull();
    expect(window.winterArcOccurrence('2026-10-05')).toMatchObject({day:1,date:'2026-10-05',code:'A',planContentRevision:'1.2'});
    expect(window.winterArcOccurrence('2026-12-18')).toMatchObject({day:75,date:'2026-12-18',code:'CARDIO',planContentRevision:'1.4'});
    expect(summary(window.winterArcOccurrence('2026-10-08'))).toEqual({code:'UPPER-B',label:'Upper B',kind:'strength'});
    expect(window.winterArcOccurrence('2026-10-08')).toMatchObject({day:4,week:1,planContentRevision:'1.4'});
  });

  it('maps Monday through Sunday to the exact new weekly schedule',function(){
    const {window}=createHarness();
    expect(weekDates.map(function(date){const occurrence=window.winterArcOccurrence(date);return [occurrence.code,occurrence.label]})).toEqual([
      ['UPPER-A','Upper A'],['MOBILITY-PILATES','Mobility + Pilates'],['LOWER-A','Lower A'],['UPPER-B','Upper B'],['CARDIO','Cardio'],['LOWER-B','Lower B'],['EXTRA-LONG-WALK','Extra-long walk']
    ]);
  });

  it('moves the exact strength definitions without redesigning them',function(){
    const {window}=createHarness();
    const plan=window.winterArcPlan();
    Object.keys(expected).forEach(function(code){
      const definitions=plan.exercises[code];
      expect(window.JSON.stringify(definitions)).toBe(window.JSON.stringify(plan.v13.exercises[code]));
      expect(definitions.map(function(exercise){const range=exercise.reps.consistency;return [exercise.name,exercise.fixedSets,range[0],range[1]]})).toEqual(expected[code]);
      expect(definitions.every(function(exercise){return exercise.startLoadKg===0})).toBe(true);
    });
    expect(window.buildTrainingSession('2026-10-08').exercises.map(function(exercise){return exercise.exerciseId})).toEqual(plan.exercises['UPPER-B'].map(function(exercise){return exercise.id}));
  });

  it('keeps Tuesday Mobility-first with 20 plus 25 minutes and GTPS guidance',function(){
    const {window}=createHarness();
    const tuesday=window.winterArcOccurrence('2026-10-13');
    expect(tuesday).toMatchObject({code:'MOBILITY-PILATES',durationMin:45,blocks:[['Mobility',20],['Beginner Pilates',25]],chosenSessionPlaceholder:'Choose a beginner Pilates session'});
    expect(tuesday.guidance).toContain('outer right hip');
    expect(tuesday).not.toHaveProperty('url');
  });

  it('prescribes exactly 25-minute cycle and 20-minute StairMaster on Friday',function(){
    const {window}=createHarness();
    const friday=window.winterArcOccurrence('2026-10-16');
    expect(friday).toMatchObject({code:'CARDIO',kind:'cardio',durationMin:45});
    expect(friday.blocks).toBeUndefined();
    expect(friday.exercises.map(function(exercise){return [exercise.id,exercise.name,exercise.mode,exercise.prescribedDurationSec]})).toEqual([
      ['CARDIO-CYCLE','Stationary cycle','time',1500],['CARDIO-STAIRMASTER','StairMaster','time',1200]
    ]);
    expect(friday.guidance).toContain('Perform only as tolerated');
    expect(friday.guidance).toContain('GP or physiotherapist guidance always wins');
    expect(friday.guidance).not.toMatch(/warm-up|cool-down|upper-body circuit/i);
  });

  it('prescribes an explicit timer-free walk of at least 90 minutes on Sunday',function(){
    const {window}=createHarness();
    const sunday=window.winterArcOccurrence('2026-10-18');
    expect(sunday).toMatchObject({code:'EXTRA-LONG-WALK',durationMin:90,minimumDurationMin:90});
    expect(sunday.blocks).toBeUndefined();
    expect(sunday.exercises.map(function(exercise){return [exercise.name,exercise.mode,exercise.prescribedDurationSec,exercise.minimumDurationSec]})).toEqual([
      ['Extra-long walk','time',5400,5400]
    ]);
    expect(sunday.guidance).toContain('never force the 10k-step or 90-minute target through pain');
    expect(sunday.guidance).toContain('Modify or stop');
  });

  it('changes phases at the inclusive day boundaries',function(){
    const {window}=createHarness();
    function phase(day){const date=new window.Date('2026-10-05T12:00:00');date.setDate(date.getDate()+day-1);return window.winterArcOccurrence(window.localDateKey(date)).phase.key}
    expect([phase(14),phase(15),phase(35),phase(36),phase(55),phase(56)]).toEqual(['consistency','build','build','strength','strength','consolidate']);
  });

  it('removes superseded daily-core, Friday, and Sunday prescriptions without offering running',function(){
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
    expect(offered.join(' ')).not.toMatch(/seated light upper-body circuit|prescribed hip rehabilitation|gentle upper-back|easy warm-up|cool-down/i);
    expect(plan.safety.running).toBe('Running is excluded following GP advice.');
    expect(plan.phases.find(function(phase){return phase.fromDay===36}).guidance).toContain('no running');
    expect(plan.weekPattern.find(function(day){return day.code==='CARDIO'}).guidance).toContain('No running, jumping, or hard intervals.');
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
