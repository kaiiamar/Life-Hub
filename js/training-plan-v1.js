// Winter Arc: 75 Me Training Plan v1.1
// This immutable definition is the single source of truth for the dated block.
// Execution records reference stable plan/session/exercise IDs and never copy a
// mutable weekly template into historical data.
(function(global){
  'use strict';

  function deepFreeze(value){
    if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
    Object.keys(value).forEach(function(key){deepFreeze(value[key])});
    return Object.freeze(value);
  }

  var PHYSIO=[
    {id:'P1',name:'Supine bridge with band',mode:'reps',sets:2,reps:{min:10,max:10},holdSec:10,restSec:45,videoId:'xrS2naqqB1E',technique:'Keep knees open against the band and lift without over-arching.'},
    {id:'P2',name:'Supine hip abduction with band',mode:'reps',sets:2,reps:{min:10,max:10},holdSec:10,restSec:45,videoId:'x3M43tCUCUQ',technique:'Open with control while your pelvis stays still.'},
    {id:'P3',name:'Standing hip abduction with band',mode:'reps',sets:2,reps:{min:10,max:10},sides:'each',restSec:45,videoId:'mH631V-5K6s',technique:'Stay tall and move the leg out without leaning.'},
    {id:'P4',name:'Half wall squat',mode:'reps',sets:1,reps:{min:10,max:10},restSec:45,videoId:'vSrxia0hZiY',technique:'Use a comfortable half depth and keep knees aligned over feet.'}
  ];

  var EXERCISES={
    A:[
      {id:'A1',name:'Goblet box squat',mode:'reps',loadType:'db',startLoadKg:8,incrementKg:2,restSec:90,lowerBody:true,reps:{foundation:[8,10],build:[8,10],strength:[6,8]},swap:'Leg press'},
      {id:'A2',name:'Dumbbell Romanian deadlift',mode:'reps',loadType:'db-pair',startLoadKg:8,incrementKg:2,restSec:90,lowerBody:true,reps:{foundation:[8,10],build:[8,10],strength:[6,8]},swap:'Hamstring curl'},
      {id:'A3',name:'Barbell hip thrust',mode:'reps',loadType:'barbell',startLoadKg:20,incrementKg:5,restSec:90,lowerBody:true,reps:{foundation:[10,12],build:[8,10],strength:[6,8]},swap:'Glute bridge'},
      {id:'A4',name:'Leg press',mode:'reps',loadType:'machine',startLoadKg:40,incrementKg:5,restSec:90,lowerBody:true,reps:{foundation:[10,12],build:[10,12],strength:[8,10]},swap:'Leg press at a shorter depth'},
      {id:'A5',name:'Supported split squat',mode:'reps',loadType:'bodyweight',startLoadKg:0,incrementKg:8,restSec:60,lowerBody:true,sides:'each',optional:true,phaseSets:{foundation:0,build:2,deload:0,strength:3,taper:0},reps:{foundation:[8,8],build:[8,8],strength:[8,8]},swap:'One extra A4 set'},
      {id:'A6',name:'Machine hamstring curl',mode:'reps',loadType:'machine',startLoadKg:15,incrementKg:5,restSec:60,lowerBody:true,reps:{foundation:[12,15],build:[10,12],strength:[10,12]}},
      {id:'A7',name:'Dead bug / hollow hold',mode:'time',loadType:'time',incrementSec:5,restSec:45,timeSec:{foundation:8,build:20,strength:30},sides:'each in Foundation'}
    ],
    B:[
      {id:'B1',name:'Pull-up skill',mode:'skill',loadType:'bodyweight',restSec:90,skill:{foundation:'Hangs and scapular pulls',build:'Controlled negatives',strength:'Negatives plus one attempt'}},
      {id:'B2',name:'Push-up ladder',mode:'ladder',loadType:'bodyweight',restSec:90,rungs:7,reps:{foundation:[6,10],build:[6,10],strength:[1,3]}},
      {id:'B3',name:'Lat pulldown',mode:'reps',loadType:'cable',startLoadKg:25,incrementKg:2.5,restSec:90,reps:{foundation:[8,10],build:[8,10],strength:[5,6]}},
      {id:'B4',name:'Assisted pull-up',mode:'reps',loadType:'assistance',startLoadKg:60,incrementKg:2.5,restSec:90,reps:{foundation:[5,8],build:[5,8],strength:[4,6]}},
      {id:'B5',name:'Dumbbell bench press',mode:'reps',loadType:'db-pair',startLoadKg:8,incrementKg:2,restSec:90,reps:{foundation:[8,10],build:[8,10],strength:[5,6]}},
      {id:'B6',name:'Seated cable row',mode:'reps',loadType:'cable',startLoadKg:25,incrementKg:2.5,restSec:60,reps:{foundation:[10,12],build:[8,10],strength:[8,10]}},
      {id:'B7',name:'Plank',mode:'time',loadType:'time',incrementSec:5,restSec:45,timeRangeSec:{foundation:[20,30],build:[30,45],strength:[45,60]}}
    ],
    C:[
      {id:'C1',name:'Trap-bar deadlift',mode:'reps',loadType:'barbell',startLoadKg:40,incrementKg:5,restSec:120,lowerBody:true,reps:{foundation:[6,8],build:[5,6],strength:[4,6]},swap:'Dumbbell Romanian deadlift'},
      {id:'C2',name:'Seated dumbbell shoulder press',mode:'reps',loadType:'db-pair',startLoadKg:6,incrementKg:2,restSec:90,reps:{foundation:[8,10],build:[8,10],strength:[6,8]},swap:'Landmine press'},
      {id:'C3',name:'Smith inverted-row ladder',mode:'ladder',loadType:'notch',rungs:7,restSec:90,reps:{foundation:[6,10],build:[6,10],strength:[6,10]},swap:'Cable row'},
      {id:'C4',name:'Low step-up',mode:'reps',loadType:'bodyweight',startLoadKg:0,incrementKg:2,bodyweightAddKg:8,restSec:60,lowerBody:true,sides:'each',reps:{foundation:[8,8],build:[8,8],strength:[8,8]},swap:'Leg press'},
      {id:'C5',name:'Incline push-up ladder',mode:'ladder',loadType:'bodyweight',rungs:7,restSec:60,linkedExerciseId:'B2',reps:{foundation:[6,10],build:[6,10],strength:[6,10]},instruction:'Stop at the prescribed RIR.'},
      {id:'C6',name:'Farmer carry',mode:'distance',loadType:'db-pair',startLoadKg:12,incrementKg:2,restSec:60,distanceM:30},
      {id:'C7',name:'Pallof press',mode:'reps',loadType:'cable',startLoadKg:5,incrementKg:2.5,restSec:45,sides:'each',reps:{foundation:[10,10],build:[10,10],strength:[12,12]}}
    ]
  };

  var DAILY_CORE={
    version:1,
    label:'Daily core coverage',
    durationMin:6,
    guidance:'Keep three reps in reserve, breathe normally, and stop for hip, joint or back pain. Chest symptoms or full illness still mean full rest.',
    coverage:{
      A:{type:'embedded',label:'A7 dead bug / hollow hold'},
      Z2:{type:'supplemental',label:'Dead bug + side plank',cardioMinutes:39},
      REC:{type:'embedded',label:'10-minute recovery core block'},
      B:{type:'embedded',label:'B7 plank'},
      INT:{type:'supplemental',label:'Bird dog + Pallof press',cardioMinutes:39},
      C:{type:'embedded',label:'C7 Pallof press'},
      AR:{type:'supplemental',label:'90/90 breathing + bird dog',cardioMinutes:39}
    },
    supplemental:{
      Z2:[
        {id:'DC1',name:'Dead bug',mode:'reps',unit:'reps',loadType:'bodyweight',fixedSets:2,coreMicrodose:true,restSec:30,sides:'each',reps:{foundation:[6,8],build:[6,8],strength:[6,8]}},
        {id:'DC2',name:'Side plank from knees',mode:'time',loadType:'time',fixedSets:2,coreMicrodose:true,restSec:30,sides:'each',timeRangeSec:{foundation:[15,20],build:[15,20],strength:[15,20]}}
      ],
      INT:[
        {id:'DC3',name:'Bird dog',mode:'reps',unit:'reps',loadType:'bodyweight',fixedSets:2,coreMicrodose:true,restSec:30,sides:'each',reps:{foundation:[6,8],build:[6,8],strength:[6,8]}},
        {id:'DC4',name:'Pallof press',mode:'reps',unit:'reps',loadType:'cable',startLoadKg:5,incrementKg:2.5,fixedSets:2,coreMicrodose:true,restSec:30,sides:'each',reps:{foundation:[10,12],build:[10,12],strength:[10,12]}}
      ],
      AR:[
        {id:'DC5',name:'90/90 breathing with abdominal brace',mode:'breathing',unit:'breaths',loadType:'bodyweight',fixedSets:1,coreMicrodose:true,noProgression:true,restSec:20,reps:{foundation:[5,5],build:[5,5],strength:[5,5]}},
        {id:'DC3',name:'Bird dog',mode:'reps',unit:'reps',loadType:'bodyweight',fixedSets:2,coreMicrodose:true,restSec:30,sides:'each',reps:{foundation:[6,8],build:[6,8],strength:[6,8]}}
      ]
    }
  };

  var PLAN={
    id:'winter-arc-75-me-2026',version:1,contentRevision:'1.1',title:'Winter Arc: 75 Me Training Plan v1.1',
    startDate:'2026-10-05',endDate:'2026-12-18',dayCount:75,weekCount:11,weekStartsOn:1,
    safety:{precedence:'Physio or GP guidance always wins.',chest:'Chest symptoms or full illness mean full rest and clinician guidance.',duringSet:'Any hip or joint pain during a set: stop, then swap or skip.',morning:[
      {min:0,max:1,action:'planned',label:'Follow the planned session.'},
      {min:2,max:2,action:'hold-lower',label:'Upper body as planned. No lower-body increases; split steps.'},
      {min:3,max:10,action:'recovery',label:'Replace the plan with the Recovery session.'}
    ],persistent:'Hip pain of 3+ on two consecutive mornings: message your physio.'},
    nutrition:{caloriesTarget:1900,caloriesFloor:1700,caloriesRuleMax:2100,proteinTargetG:140,proteinRuleMinG:120,fatTargetG:62,carbsTargetG:200,waterTargetMl:2000,gymWaterRangeMl:[2500,3000]},
    checkIns:[
      {id:'baseline',from:'2026-10-03',to:'2026-10-05',label:'Baseline'},
      {id:'check-1',date:'2026-11-01',label:'Check-in 1'},
      {id:'check-2',date:'2026-11-29',label:'Check-in 2'},
      {id:'final',date:'2026-12-18',label:'Final review'}
    ],
    cycle:{defaultLengthDays:30,knownDate:'2026-10-02',knownCycleDay:17,estimatedStarts:['2026-10-16','2026-11-15','2026-12-15'],predictionLabel:'Estimate'},
    challenge:{
      id:'winter-arc-75-me-v1',continuation:'continue',advisory:'Never miss twice. A missed day stays missed; the challenge does not reset.',
      rules:[
        {id:'steps',label:'10,000 steps',icon:'👟',evidence:'daily-steps',target:10000},
        {id:'workout',label:'45-minute plan workout',icon:'✨',evidence:'qualifying-session',targetSeconds:2700},
        {id:'water',label:'2 litres of water',icon:'💧',evidence:'water',targetMl:2000},
        {id:'duolingo',label:'Duolingo',icon:'🦉',evidence:'habit',habitKey:'duolingo'},
        {id:'reading',label:'Read for 15 minutes',icon:'📚',evidence:'reading',targetSeconds:900},
        {id:'manna',label:'Manna',icon:'📖',evidence:'habit',habitKey:'manna'},
        {id:'alcohol',label:'Alcohol: special occasions only',icon:'🥂',evidence:'alcohol'},
        {id:'eating',label:'Eat well',icon:'🍓',evidence:'nutrition',proteinMinG:120,caloriesMin:1700,caloriesMax:2100}
      ]
    },
    phases:[
      {week:1,key:'foundation',label:'Foundation · calibration',mainSets:2,rir:3,rangeKey:'foundation'},
      {week:2,key:'foundation',label:'Foundation',mainSets:3,rir:3,rangeKey:'foundation'},
      {week:3,key:'foundation',label:'Foundation',mainSets:3,rir:2.5,rangeKey:'foundation'},
      {week:4,key:'foundation',label:'Foundation',mainSets:3,rir:2.5,rangeKey:'foundation'},
      {week:5,key:'build',label:'Build',mainSets:4,rir:2,rangeKey:'build'},
      {week:6,key:'build',label:'Build',mainSets:4,rir:2,rangeKey:'build'},
      {week:7,key:'build',label:'Build',mainSets:4,rir:1.5,rangeKey:'build'},
      {week:8,key:'deload',label:'Deload',mainSets:2,rir:3,rangeKey:'build',loadFactor:0.9,noProgression:true},
      {week:9,key:'strength',label:'Strength',mainSets:4,rir:2,rangeKey:'strength'},
      {week:10,key:'strength',label:'Strength',mainSets:4,rir:1.5,rangeKey:'strength'},
      {week:11,key:'taper',label:'Taper / test',mainSets:2,rir:3,rangeKey:'strength',loadFactor:0.9,noProgression:true,testDate:'2026-12-18'}
    ],
    weekPattern:[
      {dow:1,code:'A',label:'Gym A · Lower foundations',kind:'strength',durationMin:45,includePhysio:true,qualifies:true},
      {dow:2,code:'Z2',label:'Zone 2 + core',kind:'cardio',durationMin:45,effort:'4–5/10',options:['39 minutes bike','39 minutes cross-trainer','39 minutes incline walk','Brisk walking blocks totalling 39 minutes'],qualifies:true},
      {dow:3,code:'REC',label:'Recovery',kind:'recovery',durationMin:45,includePhysio:true,blocks:[['Physio',15],['Core',10],['Mobility',5],['Easy walk or bike',15]],qualifies:true},
      {dow:4,code:'B',label:'Gym B · Upper & pull-up skill',kind:'strength',durationMin:45,includePhysio:true,qualifies:true},
      {dow:5,code:'INT',label:'Intervals + core',kind:'cardio',durationMin:45,qualifies:true},
      {dow:6,code:'C',label:'Gym C · Full body',kind:'strength',durationMin:45,includePhysio:true,qualifies:true},
      {dow:0,code:'AR',label:'Active recovery + core',kind:'recovery',durationMin:45,options:['39 minutes easy bike','Brisk walking blocks totalling 39 minutes','39 minutes front-crawl swim'],qualifies:true}
    ],
    intervals:{foundation:{label:'Bike · 8 × 1 min work / 1 min easy',rounds:8,workSec:60,recoverySec:60},build:{label:'Bike · 10 × 1 min work / 1 min easy',rounds:10,workSec:60,recoverySec:60},deload:{label:'Bike · 6 moderate × 1 min / 1 min easy',rounds:6,workSec:60,recoverySec:60},strength:{label:'SkiErg 10 × 30 sec / 90 sec or bike 6 × 2 min / 2 min',options:[{rounds:10,workSec:30,recoverySec:90},{rounds:6,workSec:120,recoverySec:120}]},taper:{label:'Bike · 6 × 1 min work / 1 min easy',rounds:6,workSec:60,recoverySec:60}},
    physio:PHYSIO,
    dailyCore:DAILY_CORE,
    exercises:EXERCISES,
    progression:{efforts:['Easy','Right','Hard'],pain:['None','Niggle','Stop'],phaseFormula:'Epley',deloadLoadFactor:0.9,reductionFactor:0.9,timeIncrementSec:5,ladderMaxReps:10,ladderResetReps:6,bodyweightAddKg:8}
  };

  global.WINTER_ARC_TRAINING_V1=deepFreeze(PLAN);
})(typeof window!=='undefined'?window:globalThis);
