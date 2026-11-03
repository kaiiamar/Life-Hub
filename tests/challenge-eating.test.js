import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

describe('Daily Basics presentation',function(){
  it('renders exactly three canonical action rows without shadow checkboxes',function(){
    const {window,state}=createHarness({today:'2026-11-02'});window.reconcileDailyBasicsState(state);window.document.body.innerHTML='<div id="host"></div>';const host=window.document.getElementById('host');host.innerHTML=window.renderDailyBasicsCard('2026-11-02');
    expect(Array.from(host.querySelectorAll('[data-daily-basic]')).map(function(row){return row.getAttribute('data-daily-basic')})).toEqual(['steps','workout','water']);expect(host.querySelector('input[type="checkbox"]')).toBeNull();expect(host.textContent).not.toMatch(/75 Me|Day \d+|8\/8|amend|repair/i);
  });

  it('reads Steps and Water from their canonical stores',function(){
    const {window,state}=createHarness({today:'2026-11-02'});window.reconcileDailyBasicsState(state);state.waterSettings.glassMl=250;state.water['2026-11-02']=7;window.setDailySteps('2026-11-02',7999);let rows=window.dailyBasicsStatus('2026-11-02').rows;expect(rows.map(function(row){return row.done})).toEqual([false,false,false]);window.setDailySteps('2026-11-02',8000);state.water['2026-11-02']=8;rows=window.dailyBasicsStatus('2026-11-02').rows;expect(rows[0].done).toBe(true);expect(rows[2]).toMatchObject({done:true,value:2000});
  });

  it('keeps modal focus contained and restores its invoking Basics row',async function(){
    const {window,state}=createHarness({today:'2026-11-02'});window.reconcileDailyBasicsState(state);window.document.body.innerHTML='<div class="app"><button data-daily-basic="steps">Steps</button></div><div id="modal" style="display:none"><div id="modal-content"></div></div>';window.eval(source('js/modals.js'));const opener=window.document.querySelector('[data-daily-basic="steps"]');opener.focus();window.presentModal('<h2>Log steps</h2><input autofocus><button>Save</button>');await new Promise(function(resolve){window.setTimeout(resolve,0)});expect(window.document.activeElement.tagName).toBe('INPUT');expect(window.document.querySelector('.app').inert).toBe(true);window.closeModal();await new Promise(function(resolve){window.setTimeout(resolve,0)});expect(window.document.activeElement).toBe(opener);expect(window.document.querySelector('.app').inert).toBe(false);
  });
});
