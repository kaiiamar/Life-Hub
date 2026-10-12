import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function installPage(window){
  window.document.body.innerHTML='<div class="page active" id="page-workout"><div class="sub-page active" id="workout-overview"></div></div><div class="page" id="page-winter-arc"><h1 id="winter-arc-page-title"></h1><span id="winter-arc-page-kicker"></span><div id="winter-arc-content"></div></div>';
  window.confirmDelete=function(_message,callback){return callback()};
  window.subNav=function(){};
  window.nav=function(page,callback){window.document.querySelectorAll('.page').forEach(function(node){node.classList.remove('active')});const target=window.document.getElementById('page-'+page);if(target)target.classList.add('active');if(page==='winter-arc')window.renderWinterArcPage();if(callback)callback()};
}
function hasTimerFields(value){return /sessionTimer|restTimer|timerAnchorMs|heartbeatMs|elapsedBeforeSec/.test(JSON.stringify(value))}

describe('timer-free GTPS workout page',function(){
  it.each([
    ['2026-10-14','MOBILITY-PILATES'],
    ['2026-10-17','LOW-IMPACT'],
    ['2026-10-18','ACTIVE-RECOVERY']
  ])('explicitly completes %s %s without timer state',function(date,code){
    const {window,state}=createHarness({today:date});
    const id=window.startWinterArcSession(date),session=state.trainingSessions[id];
    expect(session).toMatchObject({code:code,status:'in-progress',exercises:[]});
    expect(hasTimerFields(session)).toBe(false);
    expect(window.finishWinterArcSession(id)).toBe(true);
    expect(session).toMatchObject({status:'completed',manualCompletion:true,durationSec:0});
    expect(hasTimerFields(session)).toBe(false);
  });

  it('previews future dates without creating records and starts the actual date',function(){
    const {window,state}=createHarness({today:'2026-10-08'});installPage(window);
    window.openWinterArcWorkout('2026-10-09');
    expect(Object.keys(state.trainingSessions)).toHaveLength(0);
    expect(window.document.getElementById('winter-arc-content').textContent).toContain('Preview only');
    window.closeWinterArcPage();
    window.openWinterArcWorkout('2026-10-08');
    expect(Object.keys(state.trainingSessions)).toHaveLength(1);
    expect(state.trainingSessions[Object.keys(state.trainingSessions)[0]]).toMatchObject({code:'LOWER-B',status:'in-progress'});
  });

  it('renders mobile logger controls without timers or visible pain fields',function(){
    const {window,state}=createHarness({today:'2026-10-08'});installPage(window);
    const id=window.startWinterArcSession('2026-10-08');window.renderWinterArcLogger(id);
    const content=window.document.getElementById('winter-arc-content'),text=content.textContent.toLowerCase(),markup=content.innerHTML.toLowerCase();
    expect(text).toContain('finish session');
    expect(text).toContain('+ add set');
    expect(markup).not.toMatch(/countdown|timer|heartbeat/);
    expect(content.querySelector('[name*="pain"],[id*="pain"],.pain-control')).toBeNull();
    expect(state.trainingSessions[id].exercises.every(function(exercise){return exercise.sets.length===exercise.sets.filter(function(set){return !set.extra}).length})).toBe(true);
  });

  it('renders neutral Pilates and GTPS guidance without an invented link',function(){
    const {window}=createHarness({today:'2026-10-14'});installPage(window);
    window.renderWinterArcPreview('2026-10-14');
    const content=window.document.getElementById('winter-arc-content');
    expect(content.textContent).toContain('Choose a beginner Pilates session');
    expect(content.textContent).toContain('Notes for My Physiotherapist');
    expect(content.textContent).toContain('sudden inability to bear weight');
    expect(content.querySelector('a')).toBeNull();
  });
});
