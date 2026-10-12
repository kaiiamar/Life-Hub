import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

function installPage(window){
  window.document.body.innerHTML='<div class="page active" id="page-workout"><div class="sub-page active" id="workout-overview"></div></div><div class="page" id="page-winter-arc"><h1 id="winter-arc-page-title"></h1><span id="winter-arc-page-kicker"></span><div id="winter-arc-content"></div></div>';
  window.confirmDelete=function(_message,callback){return callback()};
  window.subNav=function(){};
  window.nav=function(page,callback){window.document.querySelectorAll('.page').forEach(function(node){node.classList.remove('active')});const target=window.document.getElementById('page-'+page);if(target)target.classList.add('active');if(page==='winter-arc')window.renderWinterArcPage();if(callback)callback()};
}
function hasTimerFields(value){return /sessionTimer|restTimer|timerAnchorMs|heartbeatMs|elapsedBeforeSec/.test(JSON.stringify(value))}

describe('timer-free GTPS workout page',function(){
  it.each([
    ['2026-10-13','MOBILITY-PILATES',[]],
    ['2026-10-16','CARDIO',[1500,1200]],
    ['2026-10-18','EXTRA-LONG-WALK',[5400]]
  ])('explicitly completes %s %s without timer state',function(date,code,durations){
    const {window,state}=createHarness({today:date});
    const id=window.startWinterArcSession(date),session=state.trainingSessions[id];
    expect(session).toMatchObject({code:code,status:'in-progress'});
    expect(session.exercises.flatMap(function(exercise){return exercise.sets.map(function(set){return set.durationSec})})).toEqual(durations);
    expect(hasTimerFields(session)).toBe(false);
    expect(window.finishWinterArcSession(id)).toBe(true);
    expect(session).toMatchObject({status:'completed',manualCompletion:true,durationSec:0});
    expect(hasTimerFields(session)).toBe(false);
  });

  it('previews future dates without creating records and starts Day 4 as Upper B',function(){
    const {window,state}=createHarness({today:'2026-10-08'});installPage(window);
    window.openWinterArcWorkout('2026-10-09');
    expect(Object.keys(state.trainingSessions)).toHaveLength(0);
    expect(window.document.getElementById('winter-arc-content').textContent).toContain('Preview only');
    window.closeWinterArcPage();
    window.openWinterArcWorkout('2026-10-08');
    expect(Object.keys(state.trainingSessions)).toHaveLength(1);
    expect(state.trainingSessions[Object.keys(state.trainingSessions)[0]]).toMatchObject({code:'UPPER-B',status:'in-progress',planContentRevision:'1.4'});
  });

  it('renders mobile strength controls without timers or visible pain fields',function(){
    const {window,state}=createHarness({today:'2026-10-08'});installPage(window);
    const id=window.startWinterArcSession('2026-10-08');window.renderWinterArcLogger(id);
    const content=window.document.getElementById('winter-arc-content'),text=content.textContent.toLowerCase(),markup=content.innerHTML.toLowerCase();
    expect(text).toContain('finish session');
    expect(text).toContain('+ add set');
    expect(markup).not.toMatch(/countdown|timer|heartbeat/);
    expect(content.querySelector('[name*="pain"],[id*="pain"],.pain-control')).toBeNull();
    expect(state.trainingSessions[id].exercises.every(function(exercise){return exercise.sets.length===exercise.sets.filter(function(set){return !set.extra}).length})).toBe(true);
  });

  it('keeps Add Set IDs stable and enforces the 12-set limit on strength days',function(){
    const {window,state}=createHarness({today:'2026-10-08'}),id=window.startWinterArcSession('2026-10-08'),exercise=state.trainingSessions[id].exercises[0];
    const originalIds=exercise.sets.map(function(set){return set.id});
    expect(window.winterArcAddSet(id,exercise.id)).toBe(true);
    expect(exercise.sets.slice(0,originalIds.length).map(function(set){return set.id})).toEqual(originalIds);
    expect(exercise.sets.at(-1).id.startsWith(exercise.id+'__')).toBe(true);
    while(exercise.sets.length<12)expect(window.winterArcAddSet(id,exercise.id)).toBe(true);
    expect(window.winterArcAddSet(id,exercise.id)).toBe(false);
    expect(new Set(exercise.sets.map(function(set){return set.id})).size).toBe(12);
  });

  it('renders Tuesday 20+25-minute content and existing GTPS guidance',function(){
    const {window}=createHarness({today:'2026-10-13'});installPage(window);
    window.renderWinterArcPreview('2026-10-13');
    const content=window.document.getElementById('winter-arc-content');
    expect(content.textContent).toContain('Mobility20 min');
    expect(content.textContent).toContain('Beginner Pilates25 min');
    expect(content.textContent).toContain('Choose a beginner Pilates session');
    expect(content.textContent).toContain('Notes for My Physiotherapist');
    expect(content.textContent).toContain('sudden inability to bear weight');
    expect(content.querySelector('a')).toBeNull();
  });

  it('renders Friday minute fields and explicit completion without strength jargon',function(){
    const {window,state}=createHarness({today:'2026-10-16'});installPage(window);
    const id=window.startWinterArcSession('2026-10-16');window.renderWinterArcLogger(id);
    const content=window.document.getElementById('winter-arc-content'),text=content.textContent,lower=text.toLowerCase(),inputs=Array.from(content.querySelectorAll('.wa-duration-stepper input'));
    expect(text).toContain('Stationary cycle 25 minutes');
    expect(text).toContain('StairMaster 20 minutes');
    expect(inputs.map(function(input){return [input.value,input.getAttribute('aria-label')]})).toEqual([['25','Duration in minutes'],['20','Duration in minutes']]);
    expect(content.querySelectorAll('.wa-prescribed-time .wa-one-tap')).toHaveLength(2);
    expect(lower).toContain('finish session');
    expect(lower).not.toMatch(/\brir\b|same as last time|add set|countdown|timer|heartbeat/);
    const cycle=state.trainingSessions[id].exercises[0],set=cycle.sets[0];window.winterArcSetValue(id,cycle.id,set.id,'durationSec',30*60);
    expect(set.durationSec).toBe(1800);
  });

  it('renders Sunday as at least 90 minutes with no prescribed rehab blocks',function(){
    const {window}=createHarness({today:'2026-10-18'});installPage(window);
    const id=window.startWinterArcSession('2026-10-18');window.renderWinterArcLogger(id);
    const content=window.document.getElementById('winter-arc-content'),text=content.textContent,lower=text.toLowerCase();
    expect(text).toContain('At least 90 minutes');
    expect(content.querySelector('.wa-duration-stepper input').value).toBe('90');
    expect(lower).toContain('never force the 10k-step or 90-minute target through pain');
    expect(lower).toContain('modify or stop');
    expect(content.querySelector('.wa-cardio-session').textContent.toLowerCase()).not.toMatch(/prescribed hip rehabilitation|gentle upper-back/);
    expect(lower).not.toMatch(/countdown|timer|heartbeat/);
  });

  it('shows the exact non-strength targets on the Today card without RIR copy',function(){
    const {window}=createHarness({today:'2026-10-16'});window.eval(source('js/planner.js'));
    const friday=window.plannerTrainingCard('2026-10-16');
    expect(friday).toContain('25 min stationary cycle · 20 min StairMaster');
    expect(friday).not.toMatch(/RIR/);
    const sunday=window.plannerTrainingCard('2026-10-18');
    expect(sunday).toContain('At least 90 minutes');
    expect(sunday).not.toMatch(/RIR/);
  });
});
