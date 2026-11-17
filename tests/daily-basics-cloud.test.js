import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function clone(window,value){return window.JSON.parse(window.JSON.stringify(value))}
function completeState(window){
  return {goals:[],habits:[],workouts:[],prs:{},income:[],expenses:[],accounts:[],debts:[],savingsGoals:[],metrics:{run:[]},weeklyPlans:{},reviews:{monthly:{}},dailyPriorities:{},trainingEvents:[],challenges:{},trainingSessions:{},dailyCheckIns:{},reading:{sessions:{},activeSessionId:null},cycle:{settings:{},observedStarts:[],estimates:[]},weeklyCheckIns:{},journal:{},mood:{},dailyHighlights:{},skincare:{},tasks:[],relationships:[],gratitude:[{id:'local',date:'2026-11-01',gratitude:'keep'}],wishlist:[],watchlist:[],roadmapChecklist:{},debtPayments:[],debtCharges:[],plannedPayments:[],savingsDeposits:[],savingsWithdrawals:[],reminders:[],water:{},waterSettings:{glassMl:250},commitments:[],netWorthSnapshots:[],sweep:{},companion:{},trainingPlan:null,weeklyIntention:null};
}
function query(records){return {forEach:function(callback){records.forEach(function(record){callback({id:record.id,data:function(){return record.value}})})}}}
function cloudHarness(){
  const harness=createHarness({today:'2026-11-02'}),{window}=harness;
  window.STATE=completeState(window);window.DEFAULT_STATE=completeState(window);window.KEY='yp26_v3';window.setSyncStatus=function(){};window._showSignIn=function(){};harness.loadPersistence();window._scheduleCloudFlush=function(){};return harness;
}
function installCloud(window,records){
  window._firebaseReady=true;window._authUser={uid:'user'};window._ensureSignedIn=function(callback){callback(window._authUser)};
  window.syncDoc={get:function(){return Promise.resolve({exists:false})},collection:function(){return {get:function(){return Promise.resolve(query(records))},doc:function(){return {}}}}};
}
function bookkeeping(window){return window.eval('({revisions:_clone(_domainRevisions),exists:_clone(_domainExists),cloud:_clone(_cloudData),pending:_clone(_pendingDomains),conflicts:_clone(_syncConflicts),snapshots:_clone(_localSnapshots),loaded:_domainSnapshotLoaded})')}

describe('Daily Basics cloud candidate transactions',function(){
  it('does not queue local protected data after malformed cloud bootstrap',async function(){
    const {window}=cloudHarness();window.eval('_domainRevisions={seed:2};_domainExists={seed:true};_cloudData={seed:{safe:true}};_pendingDomains={};_syncConflicts={};_localSnapshots=_clone(STATE);_domainSnapshotLoaded=false');const before=bookkeeping(window),localGratitude=clone(window,window.STATE.gratitude);
    installCloud(window,[{id:'gratitude',value:{data:{malformed:true},deleted:false,revision:7}}]);
    await new Promise(function(resolve){window.loadFromCloud(resolve)});
    expect(window.STATE.gratitude).toEqual(localGratitude);expect(bookkeeping(window)).toEqual(before);expect(window.eval('_bootstrapCloudReadFailed')).toBe(true);
    expect(window.finishDataBootstrap()).toBe(true);expect(window.eval('_clone(_pendingDomains)')).toEqual({});
  });

  it('rolls back refresh metadata, snapshots, queue, and local persistence on rejection',async function(){
    const {window}=cloudHarness(),prepared=window.prepareDailyBasicsCandidate(window.STATE,{importMode:false});window.STATE=prepared.state;window.eval('_syncReady=true;_domainSnapshotLoaded=true;_domainRevisions={gratitude:3};_domainExists={gratitude:true};_cloudData={gratitude:_clone(STATE.gratitude)};_pendingDomains={};_syncConflicts={};_localSnapshots=_clone(STATE);_persistLocalState()');const beforeState=clone(window,window.STATE),before=bookkeeping(window),beforeRaw=window.localStorage.getItem('yp26_v3');
    installCloud(window,[{id:'gratitude',value:{data:{malformed:true},deleted:false,revision:4}}]);
    expect(await window._refreshFromCloud()).toBe(false);expect(window.STATE).toEqual(beforeState);expect(bookkeeping(window)).toEqual(before);expect(window.localStorage.getItem('yp26_v3')).toBe(beforeRaw);
  });

  it('queues a Habits repair against its accepted cloud base after a check-in-only update',async function(){
    const {window}=cloudHarness(),prepared=window.prepareDailyBasicsCandidate(window.STATE,{importMode:false});window.STATE=prepared.state;window.eval('_syncReady=true;_domainSnapshotLoaded=true;_pendingDomains={};_syncConflicts={};_localSnapshots=_clone(STATE);_cloudData=_clone(STATE);_domainRevisions={};_domainExists={};_domainKeys(STATE).forEach(function(domain){_domainRevisions[domain]=domain==="habits"?4:1;_domainExists[domain]=true})');const habitsBase=clone(window,window.STATE.habits);
    installCloud(window,[{id:'dailyCheckIns',value:{data:{'2026-11-02':{date:'2026-11-02',steps:8000}},deleted:false,revision:2}}]);
    expect(await window._refreshFromCloud()).toBe(true);const pending=window.eval('_clone(_pendingDomains.habits)');expect(pending).toMatchObject({domain:'habits',baseRevision:4,baseKnown:true,baseDeleted:false});expect(pending.baseData).toEqual(habitsBase);expect(pending.data.find(function(habit){return habit.managedHabitKey==='daily-basics.steps'}).logProvenance['2026-11-02'].sources['basics:steps__2026-11-02']).toBe(true);
  });
});
