import {describe,expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {createHarness,source} from './harness.js';

function completeState(state){
  return Object.assign({
    goals:[],habits:state.habits||[],workouts:[],prs:{},income:[],expenses:[],accounts:[],debts:[],savingsGoals:[],
    metrics:{weight:[],bodyFat:[],steps:[],run:[],moneySaved:[],projectsDone:[]},weeklyPlans:{},reviews:{monthly:{},quarterly:{}},
    dailyPriorities:{},trainingEvents:[],challenges:state.challenges||{},trainingSessions:state.trainingSessions||{},dailyCheckIns:state.dailyCheckIns||{},
    reading:{sessions:{},activeSessionId:null},cycle:{settings:{defaultLengthDays:30},observedStarts:[],estimates:[]},weeklyCheckIns:{},journal:{},mood:{},dailyHighlights:{},skincare:{},tasks:[],
    relationships:[],gratitude:[],wishlist:[],watchlist:[],roadmapChecklist:{},debtPayments:[],plannedPayments:[],savingsDeposits:[],
    paydayCheckIns:{},reminders:[],water:state.water||{},waterSettings:{glassMl:250},commitments:[],netWorthSnapshots:[],sweep:{},companion:{},
    routine:{version:1,stays:{},sundayPlans:{}},study:{version:2,sessions:{}},trainingPlan:null,weeklyIntention:null
  },state);
}

function installV75(today,state,options={}){
  const h=createHarness({today:today,state:state,saveResult:options.saveResult});
  h.window.nav=options.nav||function(){};
  h.window.fmtMoney=function(value){return '£'+Number(value||0)};
  h.window.eval("var _authUser=null,_cloudIssue=null,_storageIssue=false,_syncConflicts={},_lastCloudUpdatedAt=null;");
  h.window.eval(source('js/life-hub-v75.js'));
  return h;
}

function resetMarkup(){
  return '<div id="v75-reset"></div><div id="v75-dashboard"></div>'+
    ['worked','blocked','change','matters'].map(function(field){return '<textarea id="v75-reset-'+field+'">'+field+'</textarea>'}).join('');
}

describe('v75 review security and compatibility fixes',function(){
  it('keeps imported IDs out of executable handlers and rejects unsafe v75 references',function(){
    const malicious="x');window.injected=true;//";
    const base=completeState(createHarness({today:'2026-11-16'}).state);
    base.goals=[{id:malicious,version:2,type:'annual',year:2026,title:'Imported',why:'',success:'Safe outcome',primary:true,status:'On track',checkIn:''}];
    base.debts=[{id:malicious,name:'Imported debt',balance:100,startingBalance:100}];
    base.savingsGoals=[{id:malicious,name:'Imported savings',current:0,target:100}];
    const {window}=installV75('2026-11-16',base);
    window.document.body.innerHTML='<div id="v75-goals"></div><div id="v75-finance"></div>';
    window.renderGoalsV75();window.renderFinanceV75();
    expect(window.document.querySelectorAll('.v75-goal [onclick],.v75-goal [onchange],.v75-plan-input input[onchange]')).toHaveLength(0);
    expect(window.document.querySelector('.v75-goal [data-v75-id]').getAttribute('data-v75-id')).toBe(malicious);
    window.DEFAULT_STATE={};window.eval(source('js/persistence.js'));
    const result=window.validateLifeHubState(base,{importMode:true});
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('safe stable ID');

    const dangling=window.JSON.parse(window.JSON.stringify(base));
    dangling.goals=[{id:'quarter_safe',version:2,type:'quarterly',year:2026,quarter:'Q4',title:'Quarter',annualGoalId:'missing_annual',status:'On track',checkIn:'',outcome:null}];
    expect(window.validateLifeHubState(dangling,{importMode:true}).errors.join('\n')).toContain('must reference an existing v75 annual goal');
  });

  it('preserves a same-month legacy review through save and import preparation',function(){
    const legacy={wins:'Protected weekends',ratings:{overall:7}};
    const base=completeState(createHarness({today:'2026-11-29'}).state);
    base.goals=[];base.reviews={monthly:{'2026-11':legacy},quarterly:{}};
    const {window}=installV75('2026-11-29',base);
    window.migrateLifeHubV75();
    window.document.body.innerHTML=resetMarkup();
    expect(window.saveMonthlyReset()).toBe(true);
    expect(window.STATE.reviews.monthly['2026-11']).toMatchObject({version:2,worked:'worked',blocked:'blocked',change:'change',matters:'matters'});
    expect(window.STATE.reviews.legacyMonthly['2026-11']).toEqual(legacy);
    const backup=window.JSON.parse(window.JSON.stringify(window.STATE));
    window.DEFAULT_STATE={};window.eval(source('js/persistence.js'));
    const prepared=window.prepareDailyBasicsCandidate(backup,{importMode:true});
    expect(prepared,{errors:prepared.errors}).toMatchObject({ok:true});
    expect(prepared.state.reviews.legacyMonthly['2026-11']).toEqual(legacy);
    window.STATE=prepared.state;window.document.body.innerHTML='<div id="v75-reset"></div>';
    window.renderResetV75();
    expect(window.document.getElementById('v75-reset').textContent).toContain('Protected weekends');
  });

  it('keeps every More section available as an ordinary keyboard button',function(){
    const document=new JSDOM(source('index.html')).window.document;
    const controls=Array.from(document.querySelectorAll('#page-more .v75-segmented button'));
    expect(controls).toHaveLength(3);
    expect(controls.every(function(button){return !button.hasAttribute('role')&&!button.hasAttribute('tabindex')})).toBe(true);
    expect(document.querySelector('#page-more [role="tablist"]')).toBeNull();

    const h=installV75('2026-11-16',completeState(createHarness().state));
    h.window.document.body.innerHTML='<div class="page active" id="page-more"><button id="more-tab-goals" aria-pressed="true"></button><button id="more-tab-reset" aria-pressed="false"></button><button id="more-tab-settings" aria-pressed="false"></button><section id="more-goals"><div id="v75-goals"></div></section><section id="more-reset"><div id="v75-reset"></div></section><section id="more-settings"><div id="v75-settings"></div></section></div>';
    const settings=h.window.document.getElementById('more-tab-settings');
    expect(h.window.switchMoreTab('settings',settings)).toBe(true);
    expect(Array.from(h.window.document.querySelectorAll('#page-more button')).every(function(button){return button.tabIndex===0})).toBe(true);
    expect(settings.getAttribute('aria-pressed')).toBe('true');
  });

  it('rolls back refused debt and savings plans and announces each error',function(){
    const base=completeState(createHarness().state);
    base.debts=[{id:'debt_safe',name:'Card',balance:500,startingBalance:1000,monthlyTarget:50}];
    base.savingsGoals=[{id:'saving_safe',name:'Buffer',current:100,target:1000,monthlyContribution:25}];
    const debt=installV75('2026-11-16',base,{saveResult:false});
    debt.window.document.body.innerHTML='<div id="v75-finance"></div>';
    expect(debt.window.saveDebtPlanV75('debt_safe',75)).toBe(false);
    expect(debt.window.STATE.debts[0].monthlyTarget).toBe(50);
    expect(debt.window.document.getElementById('v75-finance-error').textContent).toContain('previous value is unchanged');
    expect(debt.window.document.querySelector('[data-v75-action="debt-plan"]').value).toBe('50');

    const savings=installV75('2026-11-16',completeState(base),{saveResult:false});
    savings.window.document.body.innerHTML='<div id="v75-finance"></div>';
    expect(savings.window.saveSavingsPlanV75('saving_safe',40)).toBe(false);
    expect(savings.window.STATE.savingsGoals[0].monthlyContribution).toBe(25);
    expect(savings.window.document.getElementById('v75-finance-error').textContent).toContain('previous value is unchanged');
    expect(savings.window.document.querySelector('[data-v75-action="savings-plan"]').value).toBe('25');
  });

  it('rejects malformed v76 finance data before migration can repair or erase it',function(){
    const base=completeState(createHarness({today:'2026-11-16'}).state),{window}=installV75('2026-11-16',base);
    base.debts=[{id:'debt_safe',name:'Card',balance:10,balancePence:1000,startingBalance:10,startingBalancePence:1000}];base.savingsGoals=[{id:'goal_safe',name:'Buffer',target:100,targetPence:10000,current:10,currentPence:1000}];base.debtPayments=[];base.debtCharges=[];base.savingsDeposits=[];base.savingsWithdrawals=[];base.__lifeHubV76=true;
    window.DEFAULT_STATE={};window.eval(source('js/persistence.js'));
    const missingHistory=window.JSON.parse(window.JSON.stringify(base));missingHistory.debtCharges={lost:'history'};const missingBefore=JSON.stringify(missingHistory),missingResult=window.prepareDailyBasicsCandidate(missingHistory,{importMode:true});expect(missingResult.ok).toBe(false);expect(missingResult.code).toBe('current-validation');expect(missingResult.errors.join(' ')).toContain('expected array');expect(JSON.stringify(missingHistory)).toBe(missingBefore);
    const wrongType=window.JSON.parse(window.JSON.stringify(base));wrongType.debtCharges=[{id:'charge_safe',version:7,type:'payment',debtId:'debt_safe',date:'2026-11-16',amount:1,amountPence:100}];const wrongResult=window.prepareDailyBasicsCandidate(wrongType,{importMode:true});expect(wrongResult.ok).toBe(false);expect(wrongResult.errors.join(' ')).toMatch(/version 2|type.*invalid/);
    const conflict=window.JSON.parse(window.JSON.stringify(base));conflict.debts[0].balance=11;const conflictResult=window.prepareDailyBasicsCandidate(conflict,{importMode:true});expect(conflictResult.ok).toBe(false);expect(conflictResult.errors.join(' ')).toContain('exactly match canonical pence');
    const legacy=window.JSON.parse(window.JSON.stringify(base));legacy.__lifeHubV76=false;legacy.savingsWithdrawals={bad:true};const legacyResult=window.prepareDailyBasicsCandidate(legacy,{importMode:true});expect(legacyResult.ok).toBe(false);expect(legacyResult.errors.join(' ')).toContain('expected array');
  });

  it('restores allowlisted retained and retired hash routes at startup',function(){
    function route(hash){
      const h=createHarness();let opened=null;
      h.window.location.hash=hash;h.window.nav=function(page,done){opened=page;if(done)done()};h.window.fmtMoney=function(value){return '£'+Number(value||0)};
      h.window.eval(source('js/life-hub-v75.js'));
      h.window.nav(h.window.initialLifeHubRoute());
      return {window:h.window,opened:opened};
    }
    expect(route('#insights').opened).toBe('insights');
    expect(route('#calendar').opened).toBe('workout');
    expect(route('#settings').opened).toBe('more');
    const unknown=route('#not-a-page');
    expect(unknown.opened).toBe('dashboard');expect(unknown.window.location.hash).toBe('#dashboard');
    expect(source('js/init.js')).toContain("initialLifeHubRoute():'dashboard'");
  });

  it('does not compare a prescribed exercise with a substituted movement',function(){
    const {window}=installV75('2026-11-29',completeState(createHarness().state));
    const model={sessions:[
      {date:'2026-11-02',exercises:[{exerciseId:'press',name:'Press',sets:[{done:true,loadKg:20,reps:8}]}]},
      {date:'2026-11-23',exercises:[{exerciseId:'press',name:'Chest press machine',swapAccepted:true,substitutedName:'Chest press machine',sets:[{done:true,loadKg:30,reps:8}]}]}
    ]};
    expect(window.strengthTrendV75(model)).toBe('Comparable strength changes will appear after two matching completed exercise logs.');
  });
});
