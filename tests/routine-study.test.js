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
    expect(window.plannerTodayOrder()).toEqual(['basics','sunday','training','habits','study','focus','schedule','capture']);
    expect(window.PLANNER_CARDS.sunday.build('2026-11-22')).toContain('Plan the week');
    expect(window.PLANNER_CARDS.study.build('2026-11-23')).toContain('AWS AI Practitioner');
  });
});
