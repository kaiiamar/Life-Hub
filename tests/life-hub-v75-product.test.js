import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

function installV75(today,state){
  const h=createHarness({today:today,state:state});
  h.window.nav=function(){};
  h.window.fmtMoney=function(n){return '£'+Number(n||0)};
  h.window.eval(source('js/life-hub-v75.js'));
  return h;
}
function completeState(window,state){return Object.assign({goals:[],habits:state.habits||[],workouts:[],prs:{},income:[],expenses:[],accounts:[],debts:[],savingsGoals:[],metrics:{weight:[],bodyFat:[],steps:[],run:[],moneySaved:[],projectsDone:[]},weeklyPlans:{},reviews:{monthly:{},quarterly:{}},dailyPriorities:{},trainingEvents:[],challenges:state.challenges||{},trainingSessions:state.trainingSessions||{},dailyCheckIns:state.dailyCheckIns||{},reading:{sessions:{},activeSessionId:null},cycle:{},weeklyCheckIns:{},journal:{},mood:{},dailyHighlights:{},skincare:{},tasks:[],relationships:[],gratitude:[],wishlist:[],watchlist:[],roadmapChecklist:{},debtPayments:[],plannedPayments:[],savingsDeposits:[],paydayCheckIns:{},reminders:[],water:state.water||{},waterSettings:{glassMl:250},commitments:[],netWorthSnapshots:[],sweep:{},companion:{},routine:{version:1,stays:{},sundayPlans:{}},study:{version:2,sessions:{}},trainingPlan:null,weeklyIntention:null},state)}

describe('v75 date rules and action priority',function(){
  it('moves weekend paydays to the immediately preceding Friday',function(){
    const {window}=installV75('2026-01-01',createHarness().state);
    expect(window.paydayFor(2026,0)).toBe('2026-01-28');
    expect(window.paydayFor(2026,1)).toBe('2026-02-27');
    expect(window.paydayFor(2027,1)).toBe('2027-02-26');
  });

  it('uses the approved Now priority without pressure actions',function(){
    const payday=installV75('2026-02-27',createHarness().state);
    expect(payday.window.lifeHubNowChoice('2026-02-27',12).kind).toBe('payday');
    const reset=installV75('2026-11-29',createHarness({today:'2026-11-29'}).state);
    reset.window.reconcileDailyBasicsState(reset.state);
    expect(reset.window.lifeHubNowChoice('2026-11-29',12).kind).toBe('reset');
    const sunday=installV75('2026-12-06',createHarness({today:'2026-12-06'}).state);
    sunday.window.reconcileDailyBasicsState(sunday.state);
    expect(sunday.window.lifeHubNowChoice('2026-12-06',12).kind).toBe('weight');
  });

  it('uses the last local Sunday for Monthly Reset',function(){
    const {window}=installV75('2026-11-29',createHarness().state);
    expect(window.lastSunday(2026,10)).toBe('2026-11-29');
    expect(window.lastSunday(2026,11)).toBe('2026-12-27');
    expect(window.monthlyResetDue('2026-11-29',10)).toBe(false);
    expect(window.monthlyResetDue('2026-11-29',11)).toBe(true);
  });
});

describe('v75 Daily Basics, study, and finance models',function(){
  it('stores 500 ml water choices in the canonical glass-unit store',function(){
    const base=createHarness({today:'2026-11-16'});base.state.waterSettings={glassMl:300};
    const {window,state}=installV75('2026-11-16',base.state);
    expect(window.setWaterLitres(0.5)).toBe(true);
    expect(state.water['2026-11-16']*300).toBeCloseTo(500,8);
    expect(window.setWaterLitres(2)).toBe(true);
    expect(state.water['2026-11-16']*300).toBeCloseTo(2000,8);
    expect(window.clearWaterV75()).toBe(true);
    expect(state.water['2026-11-16']).toBeUndefined();
  });

  it('counts only study sessions of at least 30 minutes and stops after December',function(){
    const h=installV75('2026-11-16',createHarness({today:'2026-11-16'}).state);
    expect(h.window.logStudyMinutesV75(29,'',14)).toBe(true);
    expect(h.window.studyWeekV75('2026-11-16').count).toBe(0);
    expect(h.window.logStudyMinutesV75(30,'',14)).toBe(true);
    expect(h.window.studyWeekV75('2026-11-16')).toMatchObject({count:1,target:3});
    expect(h.window.studyDue('2026-11-16',13)).toBe(false);
    expect(h.window.studyDue('2026-11-16',14)).toBe(false); // qualifying session already logged today
    expect(h.window.studyActive('2026-12-31')).toBe(true);
    expect(h.window.studyActive('2027-01-01')).toBe(false);
  });

  it('records each debt payment and savings transfer once',function(){
    const base=createHarness({today:'2026-11-27'});base.state.debts=[{id:'d1',name:'Card',balance:500,startingBalance:1000}];base.state.savingsGoals=[{id:'s1',name:'Buffer',current:100,target:1000}];base.state.debtPayments=[];base.state.savingsDeposits=[];base.state.metrics={moneySaved:[]};
    const {window,state}=installV75('2026-11-27',base.state);
    expect(window.saveDebtPaymentV75('d1',100,'2026-11-27')).toBe(true);
    expect(window.saveSavingsTransferV75('s1',50,'2026-11-27')).toBe(true);
    expect(state.debts[0].balance).toBe(400);
    expect(state.debtPayments).toHaveLength(1);
    expect(state.savingsGoals[0].current).toBe(150);
    expect(state.savingsDeposits).toHaveLength(1);
    expect(state.metrics.moneySaved).toHaveLength(0);
  });
});

describe('v75 migration and current workout shape',function(){
  it('normalizes stable reminder records while preserving retired records disabled',function(){
    const base=createHarness({today:'2026-11-16'});base.state.reminders=[{id:'water',enabled:true,hour:13,minute:0}];base.state.goals=[];
    const {window,state}=installV75('2026-11-16',base.state);
    expect(window.migrateLifeHubV75().changed).toBe(true);
    expect(state.reminders.filter(function(r){return r.enabled}).map(function(r){return r.id})).toEqual(['aws-study','skincare-am','skincare-pm','monthly-reset']);
    expect(state.reminders.find(function(r){return r.id==='water'}).enabled).toBe(false);
    expect(state.study.commitment).toMatchObject({targetPerWeek:3,minimumMinutes:30,time:'14:00',endDate:'2026-12-31'});
    expect(state.reminders.find(function(r){return r.id==='aws-study'})).toMatchObject({startDate:'2026-11-16',endDate:'2026-12-31'});
  });

  it('stores one strict effort value per exercise and grandfathers legacy set effort',function(){
    const h=createHarness({today:'2026-11-16'});h.window.reconcileDailyBasicsState(h.state);const session=h.window.buildTrainingSession('2026-11-16');
    expect(session.loggingVersion).toBe(2);
    expect(session.exercises.every(function(ex){return ex.phaseWeek!==undefined})).toBe(true);
    expect(session.exercises.every(function(ex){return ex.effort===null&&ex.sets.every(function(set){return set.effort===undefined})})).toBe(true);
    h.state.trainingSessions[session.id]=session;session.status='in-progress';session.startedAt=new h.window.Date().toISOString();
    expect(h.window.setExerciseEffort(session.id,session.exercises[0].id,'Good')).toBe(true);
    expect(session.exercises[0].effort).toBe('Good');
    h.window.DEFAULT_STATE={};h.loadPersistence();
    const currentState=h.window.JSON.parse(h.window.JSON.stringify({trainingSessions:{[session.id]:session}}));
    expect(h.window.validateLifeHubState(currentState,{importMode:true}).ok).toBe(true);
    const invalid=h.window.JSON.parse(h.window.JSON.stringify(session));invalid.exercises[0].sets[0].effort='Hard';
    expect(h.window.validateLifeHubState(h.window.JSON.parse(h.window.JSON.stringify({trainingSessions:{[invalid.id]:invalid}})),{importMode:true}).ok).toBe(false);
    const legacy=h.window.JSON.parse(h.window.JSON.stringify(session));delete legacy.loggingVersion;delete legacy.exercises[0].effort;legacy.exercises[0].sets[0].effort='Right';
    expect(h.window.validateLifeHubState(h.window.JSON.parse(h.window.JSON.stringify({trainingSessions:{[legacy.id]:legacy}})),{importMode:true}).ok).toBe(true);
  });

  it('counts only completed lifting sessions toward the four-session Movement target',function(){
    const base=createHarness({today:'2026-11-16'});base.state.goals=[];base.state.trainingSessions={a:{id:'a',date:'2026-11-16',status:'completed',qualifies:true,planContentRevision:'R2',kind:'strength',label:'Upper A'},b:{id:'b',date:'2026-11-16',status:'completed',qualifies:true,planContentRevision:'R2',kind:'cardio',label:'Minimum'}};
    const {window}=installV75('2026-11-16',base.state);window.document.body.innerHTML='<div id="v75-movement"></div>';window.renderMovementV75();
    expect(window.document.getElementById('v75-movement').textContent).toContain('1 of 4 lifting sessions');
  });

  it('rolls a carried Q4 goal into Q1 of the next year without deleting history',function(){
    const base=createHarness({today:'2026-11-16'});base.state.goals=[{id:'q4',version:2,type:'quarterly',year:2026,quarter:'Q4',title:'Prepare',annualGoalId:null,status:'On track',checkIn:'',outcome:null}];
    const {window,state}=installV75('2026-11-16',base.state);expect(window.closeQuarterGoal('q4','Carry forward')).toBe(true);
    expect(state.goals.find(function(g){return g.carriedFromId==='q4'})).toMatchObject({year:2027,quarter:'Q1',status:'On track'});
    expect(state.goals.find(function(g){return g.id==='q4'}).outcome.kind).toBe('Carry forward');
  });

  it('allows reminder day edits while keeping the approved defaults',function(){
    const base=createHarness({today:'2026-11-16'});base.state.goals=[];const {window,state}=installV75('2026-11-16',base.state);window.migrateLifeHubV75();
    expect(state.reminders.find(function(r){return r.id==='aws-study'}).schedule.days).toEqual([1,4,5]);
    expect(window.toggleStudyDay(2,true)).toBe(true);expect(state.reminders.find(function(r){return r.id==='aws-study'}).schedule.days).toEqual([1,2,4,5]);
    expect(window.updateReminderV75('monthly-reset','monthlyWeekday',6)).toBe(true);expect(state.reminders.find(function(r){return r.id==='monthly-reset'}).schedule.weekday).toBe(6);
  });

  it('keeps the rolling Insights window at exactly 28 local dates',function(){
    const base=createHarness({today:'2026-11-16'});base.state.goals=[];base.state.savingsDeposits=[];base.state.debtPayments=[];base.state.study={version:2,sessions:{}};
    const {window}=installV75('2026-11-16',base.state);
    const model=window.rollingInsightModel('2026-11-16');
    expect(model.start).toBe('2026-10-20');
    expect(model.end).toBe('2026-11-16');
  });
});

describe('v75 active product surface',function(){
  it('contains only the approved More sections and exact reset prompts',function(){
    const html=source('index.html'),script=source('js/life-hub-v75.js');
    expect(html).toContain('Year Ahead');expect(html).toContain('Monthly Reset');expect(html).toContain('Settings');
    ['What worked?','What got in the way?','What will I change next month?','What matters most next month?'].forEach(function(prompt){expect(script).toContain(prompt)});
    expect(script).not.toMatch(/countdown timer/i);
    const init=source('js/init.js');expect(init).toContain("timeZone:timeZone,reminders:reminders");expect(init).not.toContain('dedupeKey:r.id');
  });

  it('shows AWS study only on a due day at or after 14:00',function(){
    const before=installV75('2026-11-16',createHarness({today:'2026-11-16'}).state);
    before.window.document.body.innerHTML='<div id="v75-dashboard"></div>';
    before.window.renderDashboardV75();
    expect(before.window.document.getElementById('v75-dashboard').textContent).not.toContain('TEMPORARY COMMITMENT');
    expect(before.window.logStudyMinutesV75(30)).toBe(false);

    const due=installV75('2026-11-16',createHarness({today:'2026-11-16'}).state);
    const BaseDate=due.window.Date;
    due.window.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:['2026-11-16T14:00:00']))}static now(){return new BaseDate('2026-11-16T14:00:00').getTime()}};
    due.window.document.body.innerHTML='<div id="v75-dashboard"></div>';
    due.window.renderDashboardV75();
    expect(due.window.document.getElementById('v75-dashboard').textContent).toContain('TEMPORARY COMMITMENT');
    expect(due.window.logStudyMinutesV75(30)).toBe(true);

    const tuesday=installV75('2026-11-17',createHarness({today:'2026-11-17'}).state);
    expect(tuesday.window.logStudyMinutesV75(30,'',14)).toBe(false);
  });

  it('renders reset trends and readable current and legacy archives',function(){
    const base=createHarness({today:'2026-11-29'});
    base.state.goals=[];
    base.state.trainingSessions={
      first:{id:'first',date:'2026-11-02',status:'completed',qualifies:true,planContentRevision:'R2',kind:'strength',exercises:[{exerciseId:'press',name:'Press',sets:[{done:true,loadKg:20,reps:8}]}]},
      second:{id:'second',date:'2026-11-23',status:'completed',qualifies:true,planContentRevision:'R2',kind:'strength',exercises:[{exerciseId:'press',name:'Press',sets:[{done:true,loadKg:25,reps:8}]}]}
    };
    base.state.metrics={weight:[{date:'2026-11-08',value:72},{date:'2026-11-29',value:71.5}]};
    base.state.reviews={monthly:{'2026-11':{version:2,month:'2026-11',worked:'Kept sessions short',blocked:'Travel',change:'Pack kit',matters:'Consistency'},'2026-10':{wins:'Protected weekends',lessons:'Plan earlier',ratings:{overall:7}}},quarterly:{}};
    const {window}=installV75('2026-11-29',base.state);
    window.document.body.innerHTML='<div id="v75-reset"></div><div id="v75-dashboard"></div>';
    window.renderResetV75();
    const text=window.document.getElementById('v75-reset').textContent;
    expect(text).toContain('Training direction:');expect(text).toContain('clear upward direction');
    expect(text).toContain('Weight moved down 0.5');expect(text).toContain('Kept sessions short');
    expect(text).toContain('Protected weekends');expect(text).toContain('Legacy ratings: overall: 7');
  });

  it('archives completed prior Year Ahead years without mixing them into active goals',function(){
    const base=createHarness({today:'2026-11-16'});base.state.goals=[
      {id:'old-a',version:2,type:'annual',year:2025,title:'Old annual',why:'',success:'Done',primary:true,status:'Complete',checkIn:'Finished'},
      {id:'old-q',version:2,type:'quarterly',year:2025,quarter:'Q4',title:'Old quarter',annualGoalId:'old-a',status:'Complete',checkIn:'Closed',outcome:{kind:'Complete',at:'2025-12-31T12:00:00Z'}},
      {id:'now',version:2,type:'annual',year:2026,title:'Current annual',why:'',success:'Current success',primary:true,status:'On track',checkIn:''}
    ];
    const {window}=installV75('2026-11-16',base.state);window.document.body.innerHTML='<div id="v75-goals"></div>';window.renderGoalsV75();
    const host=window.document.getElementById('v75-goals');
    expect(host.textContent).toContain('Completed years');expect(host.textContent).toContain('Old annual');expect(host.textContent).toContain('Current annual');
    expect(host.querySelectorAll('.v75-goal')).toHaveLength(1);
  });

  it('surfaces sync conflicts in Settings instead of claiming quiet sync',function(){
    const h=installV75('2026-11-16',createHarness({today:'2026-11-16'}).state);
    h.window.eval("var _authUser={email:'kai@example.test'},_cloudIssue=null,_storageIssue=false,_lastCloudUpdatedAt=null,_syncConflicts={goals:{}};");
    h.window.document.body.innerHTML='<div id="v75-settings"></div>';h.window.renderSettingsV75();
    const text=h.window.document.getElementById('v75-settings').textContent;
    expect(text).toContain('1 area needs a sync choice');expect(text).toContain('Review sync');expect(text).not.toContain('working quietly');
  });

  it('shows a persistence failure inline when Start Workout cannot save',function(){
    const h=createHarness({today:'2026-11-16',saveResult:false});h.window.document.body.innerHTML='<div id="v75-start-error" hidden></div>';
    expect(h.window.openWinterArcWorkout('2026-11-16',null,'v75-start-error')).toBe(null);
    const message=h.window.document.getElementById('v75-start-error');
    expect(message.hidden).toBe(false);expect(message.textContent).toContain('could not be started');expect(message.textContent).not.toContain('Full rest');
  });
});
