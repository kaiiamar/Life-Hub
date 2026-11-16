import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

function clone(window,value){return window.JSON.parse(window.JSON.stringify(value))}
function routineHarness(today,state){
  const h=createHarness(state?{today:today,state:state}:{today:today});
  h.window.refreshPlannerCards=function(){};
  h.window.eval(source('js/routine.js'));
  return h;
}
function plannerHarness(today,state){
  const h=routineHarness(today,state);
  h.window.reconcileDailyBasicsState(h.window.STATE);
  h.window.eval(source('js/planner.js'));
  return h;
}

describe('Routine location weeks',function(){
  it('alternates home and Martin’s stays from Sunday to Sunday and allows a manual switch',function(){
    const {window}=routineHarness('2026-11-16');
    expect(window.routineLocation('2026-11-16')).toMatchObject({key:'home',gym:'The Gym Group Peckham',stayStart:'2026-11-15'});
    expect(window.routineLocation('2026-11-21').key).toBe('home');
    expect(window.routineLocation('2026-11-22')).toMatchObject({key:'martin',gym:'PureGym Dartford',stayStart:'2026-11-22'});
    expect(window.routineLocation('2026-11-28').key).toBe('martin');
    expect(window.routineLocation('2026-11-29').key).toBe('home');
    expect(window.toggleRoutineLocation('2026-12-21')).toBe(true);
    expect(window.routineLocation('2026-12-21')).toMatchObject({key:'home',overridden:true});
    expect(window.routineLocation('2026-12-28').key).toBe('home');
    expect(window.STATE.routine.stays).toEqual({'2026-12-20':'home'});
  });
});

describe('Sunday plan',function(){
  it('shows only on Sundays and ticks items on and off',function(){
    const sunday=routineHarness('2026-11-22');
    expect(sunday.window.routineSundayCard('2026-11-22')).toContain('Plan the week');
    expect(sunday.window.routineSundayCard('2026-11-22')).toContain('PureGym Dartford');
    expect(sunday.window.routineSundayCard('2026-11-23')).toBe('');
    expect(sunday.window.toggleSundayItem('2026-11-22','gym-slots')).toBe(true);
    expect(sunday.window.sundayPlan('2026-11-22').filter(function(i){return i.done}).map(function(i){return i.id})).toEqual(['gym-slots']);
    expect(sunday.window.toggleSundayItem('2026-11-22','gym-slots')).toBe(true);
    expect(sunday.window.STATE.routine.sundayPlans).toEqual({});
    expect(sunday.window.toggleSundayItem('2026-11-22','nope')).toBe(false);
  });
});

describe('AWS study tracker',function(){
  it('counts any logged day, including the 15-minute minimum, toward 4 study days',function(){
    let h=routineHarness('2026-11-16');
    expect(h.window.logStudyMinutes(15,'course')).toBe(true);
    expect(h.window.studyWeek('2026-11-16')).toMatchObject({count:1,label:''});
    ['2026-11-17','2026-11-18','2026-11-19'].forEach(function(day,index){
      h=routineHarness(day,clone(h.window,h.window.STATE));
      expect(h.window.logStudyMinutes(45,'course')).toBe(true);
      expect(h.window.studyWeek(day).count).toBe(index+2);
    });
    expect(h.window.studyWeek('2026-11-19')).toMatchObject({count:4,label:'Great week'});
    expect(h.window.studyWeek('2026-11-23').count).toBe(0);
    expect(h.window.logStudyMinutes(0)).toBe(false);
  });

  it('undoes today’s latest log, tracks sections and keeps practice scores newest first',function(){
    const {window}=routineHarness('2026-11-20');
    window.logStudyMinutes(45);window.logStudyMinutes(15);
    expect(window.studyMinutesOn('2026-11-20')).toBe(60);
    expect(window.undoTodayStudy()).toBe(true);
    expect(window.studyMinutesOn('2026-11-20')).toBe(window.STATE.study.sessions[Object.keys(window.STATE.study.sessions)[0]].minutes);
    expect(window.changeStudySections(1)).toBe(true);expect(window.changeStudySections(1)).toBe(true);
    expect(window.STATE.study.course.sectionsDone).toBe(2);
    expect(window.changeStudySections(-5)).toBe(true);expect(window.STATE.study.course.sectionsDone).toBe(0);
    expect(window.addPracticeScore(64)).toBe(true);expect(window.addPracticeScore(81)).toBe(true);expect(window.addPracticeScore(140)).toBe(false);
    expect(window.STATE.study.practiceScores.map(function(s){return s.percent})).toEqual([81,64]);
    expect(window.setExamBooked(true)).toBe(true);expect(window.STATE.study.goal.examBooked).toBe(true);
  });

  it('shows the week’s focus and disappears after the exam date',function(){
    const {window}=routineHarness('2026-11-18');
    const card=window.routineStudyCard('2026-11-18');
    expect(card).toContain('First quarter of the course');
    expect(card).toContain('Log 15 min (minimum)');
    expect(card).toContain('14:00');
    expect(window.routineStudyCard('2026-12-17')).toContain('Exam today');
    expect(window.routineStudyCard('2026-12-18')).toBe('');
  });
});

describe('Today rotation card',function(){
  it('shows next session, gym, week count and the minimum option without guilt language',function(){
    const {window}=plannerHarness('2026-11-16');
    const card=window.plannerTrainingCard('2026-11-16');
    expect(card).toContain('Next up: Upper A · Pull focus');
    expect(card).toContain('The Gym Group Peckham');
    expect(card).toContain('0 of 4 this week');
    expect(card).toContain('20-min minimum instead');
    ['missed','overdue','behind','failed'].forEach(function(word){expect(card.toLowerCase()).not.toContain(word+' ')});
    window.plannerChooseMinimum('2026-11-16');
    const minimum=window.plannerTrainingCard('2026-11-16');
    expect(minimum).toContain('Minimum session');
    expect(minimum).toContain('Back to the full session');
  });

  it('places the new cards in the Today order',function(){
    const {window}=plannerHarness('2026-11-22');
    expect(window.plannerTodayOrder()).toEqual(['reminders','now','basics','sunday','training','habits','study','checkin','focus','schedule','capture']);
    expect(window.PLANNER_CARDS.sunday.build('2026-11-22')).toContain('Plan the week');
    expect(window.PLANNER_CARDS.study.build('2026-11-23')).toContain('AWS AI Practitioner');
  });
});

describe('Quieter Today (step 1)',function(){
  it('keeps the workout card to two choices with recovery and rest tucked under Not today',function(){
    const {window}=plannerHarness('2026-11-16');
    const card=window.plannerTrainingCard('2026-11-16'),top=card.slice(0,card.indexOf('<details'));
    expect((top.match(/<button/g)||[]).length).toBe(3); // Switch link + Start + 20-min minimum
    expect(top).toContain('Start workout');
    expect(top).toContain('20-min minimum instead');
    expect(top).not.toContain('Rest today');
    const more=card.slice(card.indexOf('<details'));
    expect(more).toContain('Not today');
    expect(more).toContain('Recovery instead');
    expect(more).toContain('Rest today');
  });

  it('drops the workout row and the In progress labels from Daily Basics on Today only',function(){
    const {window}=plannerHarness('2026-11-16');
    const today=window.PLANNER_CARDS.basics.build('2026-11-16');
    expect(today).toContain('data-daily-basic="steps"');
    expect(today).toContain('data-daily-basic="water"');
    expect(today).not.toContain('data-daily-basic="workout"');
    expect(today).not.toContain('In progress');
    expect(window.renderDailyBasicsCard('2026-11-16')).toContain('data-daily-basic="workout"');
    expect(window.dailyBasicsStatus('2026-11-16').rows.map(function(r){return r.id})).toEqual(['steps','workout','water']);
  });

  it('hides empty cards and keeps their entry points on the capture card',function(){
    const {window}=plannerHarness('2026-11-16');
    expect(window.PLANNER_CARDS.habits.build('2026-11-16')).toBe('');
    expect(window.PLANNER_CARDS.focus.build('2026-11-16')).toBe('');
    expect(window.PLANNER_CARDS.schedule.build('2026-11-16')).toBe('');
    const capture=window.PLANNER_CARDS.capture.build('2026-11-16');
    expect(capture).toContain('Pick today’s focus');
    expect(capture).toContain('+ Time block');
    window.STATE.tasks=[{id:'t1',text:'Book the exam',done:false,focusDate:'2026-11-16'}];
    expect(window.PLANNER_CARDS.focus.build('2026-11-16')).toContain('Book the exam');
    expect(window.PLANNER_CARDS.capture.build('2026-11-16')).not.toContain('Pick today’s focus');
  });

  it('folds course progress on the study card and remembers when it is opened',function(){
    const {window}=routineHarness('2026-11-18');
    let card=window.routineStudyCard('2026-11-18');
    const top=card.slice(0,card.indexOf('<details'));
    expect(top).toContain('Log 45 min');
    expect(top).not.toContain('Exam booked');
    expect(card).toContain('<details class="routine-more" id="routine-study-details" ontoggle');
    expect(card).toContain('Course progress · 0 of 14 sections · exam not booked yet');
    window.routineStudyDetailsToggled(true);window.changeStudySections(1);
    card=window.routineStudyCard('2026-11-18');
    expect(card).toContain('id="routine-study-details" open');
    expect(card).toContain('Course progress · 1 of 14 sections');
  });
});

describe('One-tap Today (step 2)',function(){
  it('suggests one thing by time of day and nothing once it is done',function(){
    const {window}=plannerHarness('2026-11-16');
    expect(window.routineNowChoice('2026-11-16',9).kind).toBe('workout');
    expect(window.routineNowChoice('2026-11-16',15).kind).toBe('study');
    expect(window.routineNowChoice('2026-11-16',18).kind).toBe('workout');
    expect(window.routineNowChoice('2026-11-16',21).kind).toBe('close');
    expect(window.routineNowChoice('2026-11-17',9)).toBeNull();
    const card=window.routineNowCard('2026-11-16',9);
    expect(card).toContain('Upper A · The Gym Group Peckham');
    expect((card.match(/<button/g)||[]).length).toBe(1);
    expect(window.logStudyMinutes(15)).toBe(true);
    expect(window.routineNowChoice('2026-11-16',15).kind).toBe('workout');
    window.STATE.trainingSessions={};
    const id=window.startWinterArcSession('2026-11-16');
    expect(window.routineNowCard('2026-11-16',15)).toContain('Resume workout');
    window.STATE.trainingSessions[id].exercises.forEach(function(ex){ex.sets.forEach(function(set){window.updateTrainingSet(id,ex.id,set.id,{done:true})})});
    expect(window.finishWinterArcSession(id)).toBe(true);
    expect(window.routineNowChoice('2026-11-16',15)).toBeNull();
    expect(window.routineNowCard('2026-11-16',15)).toBe('');
  });

  it('skips the study suggestion at weekends',function(){
    const {window}=plannerHarness('2026-11-21');
    expect(window.routineNowChoice('2026-11-21',15).kind).toBe('workout');
  });

  it('logs mood in one tap and asks for one weigh-in a week',function(){
    const {window}=plannerHarness('2026-11-16');
    window.quickLogMood=function(value,date){if(!window.STATE.mood)window.STATE.mood={};window.STATE.mood[date]={mood:value}};
    let card=window.routineCheckinCard('2026-11-16');
    expect((card.match(/routineLogMood\(/g)||[]).length).toBe(5);
    expect(card).toContain('Weekly weigh-in');
    expect(window.routineLogMood(4)).toBe(true);
    expect(window.STATE.mood['2026-11-16'].mood).toBe(4);
    card=window.routineCheckinCard('2026-11-16');
    expect(card).not.toContain('routineLogMood(');
    window.document.body.innerHTML=card;
    window.document.getElementById('routine-weight-input').value='90.9';
    expect(window.routineSaveWeighIn()).toBe(true);
    expect(window.STATE.metrics.weight.slice(-1)[0]).toMatchObject({date:'2026-11-16',value:90.9});
    expect(window.routineCheckinCard('2026-11-16')).toBe('');
    window.document.body.innerHTML='<input id="routine-weight-input" value="900">';
    expect(window.routineSaveWeighIn()).toBe(false);
    expect(window.routineLogMood(9)).toBe(false);
  });

  it('adds a one-tap glass to the water row on Today only',function(){
    const {window}=plannerHarness('2026-11-16');
    window.STATE.water={'2026-11-16':2};
    const today=window.PLANNER_CARDS.basics.build('2026-11-16');
    expect(today).toContain('onclick="logWaterGlass(3)"');
    expect(today).toContain('+1 glass');
    expect(window.renderDailyBasicsCard('2026-11-16')).not.toContain('logWaterGlass(');
  });

  it('offers three default reminders once and never doubles them',function(){
    const {window}=plannerHarness('2026-11-16');
    window.Notification={permission:'default',requestPermission:function(){window.Notification.permission='granted';return Promise.resolve('granted')}};
    expect(window.routineRemindersCard()).toContain('Turn on reminders');
    window.STATE.reminders=[];
    expect(window.routineSeedReminders()).toBe(true);
    expect(window.STATE.reminders.map(function(r){return r.id+'@'+r.hour+':'+r.minute+':'+r.enabled})).toEqual(['plan@8:30:true','study@14:0:true','close@21:0:true']);
    expect(window.routineSeedReminders()).toBe(false);
    expect(window.STATE.reminders).toHaveLength(3);
    window.Notification.permission='granted';
    expect(window.routineRemindersCard()).toBe('');
    window.Notification.permission='denied';
    expect(window.routineRemindersCard()).toContain('blocked');
    expect(window.routineRemindersCard()).not.toContain('Turn on reminders');
  });
});
