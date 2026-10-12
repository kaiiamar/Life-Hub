// Winter Arc: 75 Me Training Plan v1.2
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
    id:'winter-arc-75-me-2026',version:1,contentRevision:'1.2',title:'Winter Arc: 75 Me Training Plan v1.2',
    startDate:'2026-10-05',endDate:'2026-12-18',dayCount:75,weekCount:11,weekStartsOn:1,
    safety:{
      precedence:'Physio or GP guidance always wins.',
      chest:'Chest symptoms or full illness mean full rest and clinician guidance.',
      duringSet:'Any hip, joint or back pain during a set: stop, then swap or skip.',
      choices:[
        {key:'planned',label:'Train as planned'},
        {key:'recovery',label:'Use Recovery instead'},
        {key:'rest',label:'Full rest today'}
      ]
    },
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
        {id:'eating',label:'Whole foods, no takeaway',icon:'🍓',evidence:'manual-confirmation',confirmationKey:'eating'}
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

  var LEGACY_PLAN=PLAN;
  function reps(min,max){return {consistency:[min,max],build:[min,max],strength:[min,max],consolidate:[min,max]}}
  function strength(id,name,sets,min,max,loadType,extra){return Object.assign({id:id,name:name,mode:'reps',unit:'reps',fixedSets:sets,reps:reps(min,max),loadType:loadType,startLoadKg:0,restSec:60},extra||{})}

  PLAN={
    id:'winter-arc-75-me-2026',version:1,contentRevision:'1.3',title:'75-Day Workout Plan — GTPS-Aware Strength, Conditioning & Recovery',
    startDate:'2026-10-05',endDate:'2026-12-18',dayCount:75,weekCount:11,weekStartsOn:1,canonicalFromDay:4,
    safety:{
      condition:'Right-sided greater trochanteric pain syndrome (GTPS).',
      precedence:'Physio guidance always wins. Exercises are options, not guarantees.',
      running:'Running is excluded following GP advice.',
      training:'Use light-to-moderate resistance and good technique. Modify or stop movements that provoke symptoms.',
      duringActivity:'Monitor symptoms during activity and the next morning. Reduce load, range, or volume if symptoms worsen; consult your physiotherapist if symptoms persist.',
      steps:'10,000 steps is a target, never something to force through pain.',
      trainingLoad:'Seven movement days do not mean seven hard days; Wednesday and Sunday recovery sessions count.',
      urgent:'Seek urgent assessment for sudden inability to bear weight, severe post-injury hip pain, or a hot or swollen hip with fever.',
      choices:[
        {key:'planned',label:'Train as planned'},
        {key:'recovery',label:'Use active recovery instead'},
        {key:'rest',label:'Full rest today'}
      ]
    },
    nutrition:{waterTargetMl:2000,guidance:['Include protein and balanced meals.','Use a modest, sustainable deficit if wanted.','Stay hydrated.','Aim for 7–9 hours of sleep.']},
    cycle:LEGACY_PLAN.cycle,
    progressPhotos:[1,25,50,75],
    tracking:['Strength','Comfort','Consistency','Clothing fit'],
    physiotherapistNotes:{
      approvedLowerBody:'Confirm which lower-body exercises are currently approved.',
      avoidModify:'Record movements and ranges to avoid or modify, especially those that provoke the outer right hip.',
      rehabilitation:'Confirm the prescribed hip rehabilitation exercises and weekly frequency.',
      loadGuidance:'Agree load, range, and volume guidance for symptom changes.',
      returnToRunning:'Discuss return-to-running only with GP and physiotherapist approval.'
    },
    challenge:{
      id:'winter-arc-75-me-v1',continuation:'continue',advisory:'Never miss twice. A missed day stays missed; the challenge does not reset.',
      rules:[
        {id:'steps',label:'10k Steps',icon:'👟',evidence:'daily-steps',target:10000},
        {id:'workout',label:'Planned workout',icon:'✨',evidence:'qualifying-session',targetSeconds:2700},
        {id:'water',label:'2L water',icon:'💧',evidence:'water',targetMl:2000},
        {id:'duolingo',label:'Duolingo',icon:'🦉',evidence:'habit',habitKey:'duolingo'},
        {id:'reading',label:'Reading 15 min',icon:'📚',evidence:'reading',targetSeconds:900},
        {id:'manna',label:'Manna',icon:'📖',evidence:'habit',habitKey:'manna'},
        {id:'alcohol',label:'Alcohol special occasions only',icon:'🥂',evidence:'alcohol'},
        {id:'eating',label:'Whole foods, no takeaway',icon:'🍓',evidence:'manual-confirmation',confirmationKey:'eating'}
      ]
    },
    phases:[
      {fromDay:1,toDay:14,key:'consistency',rangeKey:'consistency',label:'Consistency & technique',rir:3,guidance:'Use controlled range of motion and manageable weights, with approximately 3 reps in reserve.'},
      {fromDay:15,toDay:35,key:'build',rangeKey:'build',label:'Steady progression',rir:3,guidance:'Add repetitions or a small amount of weight only with stable technique and symptoms; change one variable at a time.'},
      {fromDay:36,toDay:55,key:'strength',rangeKey:'strength',label:'Gradual strength progression',rir:2,guidance:'Progress gradually, with no lower-body failure and no running.'},
      {fromDay:56,toDay:75,key:'consolidate',rangeKey:'consolidate',label:'Consolidate',rir:3,guidance:'Do not rush recovery; demanding lower-body work is only as tolerated and physiotherapist-approved.'}
    ],
    weekPattern:[
      {dow:1,code:'LOWER-A',label:'Lower A',focus:'Glutes and quads',kind:'strength',durationMin:[45,55],warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:2,code:'UPPER-A',label:'Upper A',focus:'Back, shoulders and arms',kind:'strength',durationMin:45,warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:3,code:'MOBILITY-PILATES',label:'Mobility + Pilates',kind:'recovery',durationMin:45,blocks:[['Mobility',20],['Beginner Pilates',25]],chosenSessionPlaceholder:'Choose a beginner Pilates session',guidance:'Modify or skip positions that provoke the outer right hip, including repeated side-lying leg lifts.',qualifies:true},
      {dow:4,code:'LOWER-B',label:'Lower B',focus:'Glutes and hamstrings',kind:'strength',durationMin:[45,55],warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:5,code:'UPPER-B',label:'Upper B',focus:'Shoulders, back and arms',kind:'strength',durationMin:45,warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:6,code:'LOW-IMPACT',label:'Low-impact conditioning',kind:'conditioning',durationMin:45,blocks:[['Easy warm-up',5],['Stationary bike at a comfortable steady pace, if tolerated',25],['Seated light upper-body circuit',10],['Cool-down',5]],guidance:'If cycling provokes symptoms, replace it with pain-free seated upper-body cardio. No running, jumping, or hard intervals.',qualifies:true},
      {dow:0,code:'ACTIVE-RECOVERY',label:'Active recovery + rehab',kind:'recovery',durationMin:45,blocks:[['Comfortable walking, split if needed',20],['Prescribed hip rehabilitation',15],['Gentle upper-back, shoulder, and ankle mobility',10]],includePhysio:true,qualifies:true}
    ],
    physio:PHYSIO,
    dailyCore:null,
    exercises:{
      'LOWER-A':[
        strength('LA1','Hip thrust machine',3,10,12,'machine',{lowerBody:true}),
        strength('LA2','Leg press',3,10,12,'machine',{lowerBody:true}),
        strength('LA3','Leg extension',3,12,15,'machine',{lowerBody:true}),
        strength('LA4','Seated hamstring curl',3,12,15,'machine',{lowerBody:true}),
        strength('LA5','Hip abduction machine',2,15,20,'machine',{lowerBody:true})
      ],
      'UPPER-A':[
        strength('UA1','Lat pulldown',3,8,12,'cable'),
        strength('UA2','Chest-supported row',3,8,12,'machine'),
        strength('UA3','Seated shoulder press',3,8,12,'machine'),
        strength('UA4','Dumbbell lateral raises',3,12,15,'db-pair'),
        strength('UA5','Bicep curls',2,10,15,'db-pair'),
        strength('UA6','Tricep pressdowns',2,10,15,'cable')
      ],
      'LOWER-B':[
        strength('LB1','Dumbbell Romanian deadlift',3,10,10,'db-pair',{lowerBody:true}),
        strength('LB2','Glute bridge',3,12,12,'bodyweight',{lowerBody:true}),
        strength('LB3','Seated hamstring curl',3,12,12,'machine',{lowerBody:true}),
        strength('LB4','Leg press',2,12,12,'machine',{lowerBody:true}),
        strength('LB5','Hip abduction machine',2,15,20,'machine',{lowerBody:true})
      ],
      'UPPER-B':[
        strength('UB1','Assisted pull-ups',3,6,10,'assistance'),
        strength('UB2','Seated cable row',3,8,12,'cable'),
        strength('UB3','Machine chest press',3,8,12,'machine'),
        strength('UB4','Rear-delt fly',3,12,15,'machine'),
        strength('UB5','Lateral raises',2,12,15,'db-pair'),
        strength('UB6','Bicep curls',2,10,15,'db-pair'),
        strength('UB7','Tricep extensions',2,10,15,'cable')
      ]
    },
    progression:{efforts:['Easy','Right','Hard'],timeIncrementSec:5}
  };
  var V13_PLAN=PLAN;
  PLAN={
    id:V13_PLAN.id,version:V13_PLAN.version,contentRevision:'1.4',title:'75-Day Workout Plan — Weekly Strength, Cardio & Recovery',
    startDate:V13_PLAN.startDate,endDate:V13_PLAN.endDate,dayCount:V13_PLAN.dayCount,weekCount:V13_PLAN.weekCount,weekStartsOn:V13_PLAN.weekStartsOn,canonicalFromDay:4,
    safety:V13_PLAN.safety,
    nutrition:V13_PLAN.nutrition,
    cycle:V13_PLAN.cycle,
    progressPhotos:V13_PLAN.progressPhotos,
    tracking:V13_PLAN.tracking,
    physiotherapistNotes:V13_PLAN.physiotherapistNotes,
    challenge:V13_PLAN.challenge,
    phases:V13_PLAN.phases,
    weekPattern:[
      {dow:1,code:'UPPER-A',label:'Upper A',focus:'Back, shoulders and arms',kind:'strength',durationMin:45,warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:2,code:'MOBILITY-PILATES',label:'Mobility + Pilates',kind:'recovery',durationMin:45,blocks:[['Mobility',20],['Beginner Pilates',25]],chosenSessionPlaceholder:'Choose a beginner Pilates session',guidance:'Modify or skip positions that provoke the outer right hip, including repeated side-lying leg lifts.',qualifies:true},
      {dow:3,code:'LOWER-A',label:'Lower A',focus:'Glutes and quads',kind:'strength',durationMin:[45,55],warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:4,code:'UPPER-B',label:'Upper B',focus:'Shoulders, back and arms',kind:'strength',durationMin:45,warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:5,code:'CARDIO',label:'Cardio',focus:'Stationary cycle and StairMaster',kind:'cardio',durationMin:45,guidance:'Perform only as tolerated. Modify or stop if symptoms are provoked; GP or physiotherapist guidance always wins. No running, jumping, or hard intervals.',qualifies:true},
      {dow:6,code:'LOWER-B',label:'Lower B',focus:'Glutes and hamstrings',kind:'strength',durationMin:[45,55],warmUp:'5–7 min comfortable, pain-free movement',qualifies:true},
      {dow:0,code:'EXTRA-LONG-WALK',label:'Extra-long walk',focus:'At least 90 minutes',kind:'recovery',durationMin:90,minimumDurationMin:90,guidance:'Walk for at least 90 minutes, but never force the 10k-step or 90-minute target through pain. Modify or stop according to symptoms; GP or physiotherapist guidance always wins.',qualifies:true}
    ],
    physio:V13_PLAN.physio,
    dailyCore:null,
    exercises:{
      'LOWER-A':V13_PLAN.exercises['LOWER-A'],
      'UPPER-A':V13_PLAN.exercises['UPPER-A'],
      'LOWER-B':V13_PLAN.exercises['LOWER-B'],
      'UPPER-B':V13_PLAN.exercises['UPPER-B'],
      'CARDIO':[
        {id:'CARDIO-CYCLE',name:'Stationary cycle',mode:'time',unit:'minutes',loadType:'time',fixedSets:1,prescribedDurationSec:1500,targetLabel:'25 minutes',noProgression:true},
        {id:'CARDIO-STAIRMASTER',name:'StairMaster',mode:'time',unit:'minutes',loadType:'time',fixedSets:1,prescribedDurationSec:1200,targetLabel:'20 minutes',noProgression:true}
      ],
      'EXTRA-LONG-WALK':[
        {id:'WALK-90',name:'Extra-long walk',mode:'time',unit:'minutes',loadType:'time',fixedSets:1,prescribedDurationSec:5400,targetLabel:'At least 90 minutes',minimumDurationSec:5400,noProgression:true}
      ]
    },
    progression:V13_PLAN.progression,
    v13:V13_PLAN,
    legacy:LEGACY_PLAN
  };

  global.WINTER_ARC_TRAINING_V1=deepFreeze(PLAN);
})(typeof window!=='undefined'?window:globalThis);
