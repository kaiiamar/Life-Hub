import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function clone(window,value){return window.JSON.parse(window.JSON.stringify(value))}
function harness(today,state){const h=createHarness(state?{today:today,state:state}:{today:today});return h}
function validator(today,state){const h=harness(today,state);h.window.DEFAULT_STATE={};h.loadPersistence();return h}
function validate(window,sessions,extra={}){return window.validateLifeHubState(clone(window,Object.assign({trainingSessions:sessions},extra)),{importMode:true})}

// Starts today's session, ticks every set at the given reps and finishes it.
function completeToday(h,reps){
  const {window}=h,key=window.localDateKey(new window.Date()),id=window.startWinterArcSession(key);
  expect(id).toBeTruthy();
  const session=window.STATE.trainingSessions[id];
  session.exercises.forEach(function(exercise){exercise.sets.forEach(function(set){const patch={done:true};if(reps!==undefined&&exercise.mode!=='time')patch.reps=reps;expect(window.updateTrainingSet(id,exercise.id,set.id,patch)).toBe(true)})});
  expect(window.finishWinterArcSession(id)).toBe(true);
  return window.STATE.trainingSessions[id];
}

describe('R2 four-session rotation',function(){
  it('hands over from R1 on Monday 16 November with Upper A and leaves other days unplanned',function(){
    const {window}=harness('2026-11-16');
    expect(window.currentWorkoutOccurrence('2026-11-15')).toMatchObject({planContentRevision:'R1',code:'EXTRA-LONG-WALK'});
    expect(window.currentWorkoutOccurrence('2026-11-16')).toMatchObject({planContentRevision:'R2',code:'UPPER-A',label:'Upper A',kind:'strength',id:'daily-basics-recurring-2026__R2__2026-11-16__UPPER-A'});
    expect(window.currentWorkoutOccurrence('2026-11-17')).toBeNull();
    expect(window.recurringWorkoutPlan().contentRevision).toBe('R1');
    expect(window.rotationWorkoutPlan().rotation).toEqual(['UPPER-A','LOWER-A','UPPER-B','LOWER-B']);
  });

  it('moves to the next session after a completed one and skips missed days without repaying them',function(){
    const monday=harness('2026-11-16');completeToday(monday);
    const wednesday=harness('2026-11-18',clone(monday.window,monday.window.STATE));
    expect(wednesday.window.currentWorkoutOccurrence('2026-11-16').code).toBe('UPPER-A');
    expect(wednesday.window.currentWorkoutOccurrence('2026-11-17')).toBeNull();
    expect(wednesday.window.currentWorkoutOccurrence('2026-11-18').code).toBe('LOWER-A');
    completeToday(wednesday);
    const friday=harness('2026-11-20',clone(wednesday.window,wednesday.window.STATE));
    expect(friday.window.currentWorkoutOccurrence('2026-11-20').code).toBe('UPPER-B');
    completeToday(friday);
    const saturday=harness('2026-11-21',clone(friday.window,friday.window.STATE));
    expect(saturday.window.currentWorkoutOccurrence('2026-11-21').code).toBe('LOWER-B');
    completeToday(saturday);
    const nextMonday=harness('2026-11-23',clone(saturday.window,saturday.window.STATE));
    expect(nextMonday.window.currentWorkoutOccurrence('2026-11-23').code).toBe('UPPER-A');
  });

  it('counts a minimum session toward the week without advancing the rotation',function(){
    const monday=harness('2026-11-16');completeToday(monday);
    const tuesday=harness('2026-11-17',clone(monday.window,monday.window.STATE));
    expect(tuesday.window.chooseMinimumSession('2026-11-17')).toBe(true);
    expect(tuesday.window.currentWorkoutOccurrence('2026-11-17')).toMatchObject({code:'MIN-CARDIO',kind:'cardio',minimum:true});
    const minimum=completeToday(tuesday);
    expect(minimum).toMatchObject({code:'MIN-CARDIO',status:'completed',qualifies:true});
    expect(tuesday.window.chooseFullSession('2026-11-17')).toBe(false);
    const wednesday=harness('2026-11-18',clone(tuesday.window,tuesday.window.STATE));
    expect(wednesday.window.currentWorkoutOccurrence('2026-11-18').code).toBe('LOWER-A');
    expect(wednesday.window.rotationWeek('2026-11-18')).toMatchObject({count:2,target:4,label:''});
  });

  it('lets a minimum choice be undone before starting',function(){
    const {window}=harness('2026-11-16');
    expect(window.chooseMinimumSession('2026-11-16')).toBe(true);
    expect(window.currentWorkoutOccurrence('2026-11-16').code).toBe('MIN-CARDIO');
    expect(window.chooseFullSession('2026-11-16')).toBe(true);
    expect(window.currentWorkoutOccurrence('2026-11-16').code).toBe('UPPER-A');
    expect(window.chooseMinimumSession('2026-11-17')).toBe(false);
  });

  it('labels 3 sessions a good week and 4 a great week, with no label below that',function(){
    let h=harness('2026-11-16');completeToday(h);
    ['2026-11-17','2026-11-18','2026-11-19'].forEach(function(day,index){
      h=harness(day,clone(h.window,h.window.STATE));
      expect(h.window.rotationWeek(day).count).toBe(index+1);
      expect(h.window.rotationWeek(day).label).toBe(index+1>=3?'Good week':'');
      completeToday(h);
    });
    expect(h.window.rotationWeek('2026-11-19')).toMatchObject({count:4,label:'Great week'});
    expect(h.window.rotationWeek('2026-11-23')).toMatchObject({count:0,label:''});
  });

  it('suggests R2 progression copy at the top of the range',function(){
    const h=harness('2026-11-16'),session=completeToday(h,8);
    const pulldown=session.exercises.find(function(ex){return ex.exerciseId==='R2UA3'}),assisted=session.exercises.find(function(ex){return ex.exerciseId==='R2UA2'}),hang=session.exercises.find(function(ex){return ex.exerciseId==='R2UA1'}),finisher=session.exercises.find(function(ex){return ex.exerciseId==='R2UA-FIN'});
    expect(pulldown.next.reason).toContain('Same load');
    expect(assisted.next.reason).toContain('assistance notch');
    expect(hang.next.reason).toContain('Same target');
    expect(finisher.next.reason).toContain('prescribed duration');
    const top=harness('2026-11-16'),topSession=completeToday(top,20);
    expect(topSession.exercises.find(function(ex){return ex.exerciseId==='R2UA1'}).next.reason).toContain('add 5 seconds');
    expect(topSession.exercises.find(function(ex){return ex.exerciseId==='R2UA3'}).next.reason).toContain('smallest weight step');
    expect(topSession.exercises.find(function(ex){return ex.exerciseId==='R2UA5'}).next.reason).toContain('harder step');
  });

  it('never prescribes running, jumping, lunges, split squats, step-ups or the cross trainer',function(){
    const {window}=harness('2026-11-16'),p=window.rotationWorkoutPlan(),names=Object.keys(p.exercises).flatMap(function(code){return p.exercises[code].map(function(ex){return ex.name.toLowerCase()})});
    ['run','jump','lunge','split squat','step-up','cross trainer','cross-trainer'].forEach(function(word){expect(names.some(function(name){return name.indexOf(word)!==-1})).toBe(false)});
  });
});

describe('R2 persistence',function(){
  it('accepts planned, completed and minimum R2 sessions and a minimum choice',function(){
    const monday=harness('2026-11-16'),done=completeToday(monday);
    const tuesday=harness('2026-11-17',clone(monday.window,monday.window.STATE));tuesday.window.chooseMinimumSession('2026-11-17');const minimum=completeToday(tuesday);
    const v=validator('2026-11-17',clone(tuesday.window,tuesday.window.STATE));
    expect(validate(v.window,{[done.id]:done,[minimum.id]:minimum},{dailyCheckIns:{'2026-11-17':{date:'2026-11-17',sessionChoice:'minimum'}}})).toEqual({ok:true,errors:[]});
    const planned=v.window.buildTrainingSession('2026-11-17');
    expect(planned).toMatchObject({code:'MIN-CARDIO'});
  });

  it('rejects R1 identity after the switch and R2 identity before it',function(){
    const {window}=validator('2026-11-16'),session=window.buildTrainingSession('2026-11-16');
    expect(validate(window,{[session.id]:session})).toEqual({ok:true,errors:[]});
    const asR1=clone(window,session);asR1.planContentRevision='R1';expect(validate(window,{[asR1.id]:asR1}).ok).toBe(false);
    const early=validator('2026-11-09').window,r1=early.buildTrainingSession('2026-11-09');expect(r1.planContentRevision).toBe('R1');
    const asR2=clone(early,r1);asR2.planContentRevision='R2';expect(validate(early,{[asR2.id]:asR2}).ok).toBe(false);
    const wrongCode=clone(window,session);wrongCode.code='CARDIO';expect(validate(window,{[wrongCode.id]:wrongCode}).ok).toBe(false);
  });

  it('accepts sessions whose stored objects come back from the cloud with keys in a different order',function(){
    const early=validator('2026-11-03').window,session=early.buildTrainingSession('2026-11-03');
    expect(session.code).toBe('MOBILITY-PILATES');
    const shuffle=function(obj){return Object.keys(obj).reverse().reduce(function(out,key){out[key]=obj[key];return out},{})};
    const reordered=clone(early,session);reordered.phase=shuffle(reordered.phase);reordered.blockLogs=reordered.blockLogs.map(shuffle);reordered.status='completed';reordered.manualCompletion=true;reordered.startedAt='2026-11-03T11:59:24.686Z';reordered.completedAt='2026-11-03T12:00:27.734Z';reordered.updatedAt=reordered.completedAt;
    expect(early.workoutSessionMatchesOccurrence(reordered)).toBe(true);
    const later=validator('2026-11-16').window;
    expect(validate(later,{[reordered.id]:reordered})).toEqual({ok:true,errors:[]});
    const monday=harness('2026-11-16'),done=completeToday(monday),r2=clone(monday.window,done);r2.phase=shuffle(r2.phase);r2.exercises=r2.exercises.map(function(ex){const out=shuffle(ex);out.sets=ex.sets.map(shuffle);return out});
    expect(monday.window.workoutSessionMatchesOccurrence(r2)).toBe(true);
  });

  it('rejects malformed routine and study areas',function(){
    const {window}=validator('2026-11-16');
    expect(validate(window,{},{routine:[]}).ok).toBe(false);
    expect(validate(window,{},{study:'x'}).ok).toBe(false);
    expect(validate(window,{},{routine:{stays:{}},study:{sessions:{}}})).toEqual({ok:true,errors:[]});
  });
});
