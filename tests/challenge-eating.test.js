import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

describe('75 Me eating interactions',function(){
  it('renders and reverses today’s one-tap tile',function(){
    const {window,state}=createHarness({today:'2026-10-10'});
    let html=window.renderChallenge75Card('2026-10-10');
    expect(html).toContain('Whole foods, no takeaway');
    expect(html).toContain('Tap to confirm');
    expect(html).toContain("challenge75EatingAction('2026-10-10')");
    expect(window.challenge75EatingAction('2026-10-10')).toBe(true);
    expect(state.dailyCheckIns['2026-10-10'].manualConfirmations.eating).toBe(true);
    html=window.renderChallenge75Card('2026-10-10');
    expect(html).toContain('Confirmed');
    expect(window.challenge75EatingAction('2026-10-10')).toBe(true);
    expect(state.dailyCheckIns['2026-10-10']).not.toHaveProperty('manualConfirmations');
  });

  it('amends and undoes an elapsed day while future days stay locked',function(){
    const {window,document,state}=createHarness({today:'2026-10-10'});
    const past='2026-10-07';
    expect(window.openChallenge75Amend(past)).toBe(true);
    const foodRow=Array.from(document.querySelectorAll('.challenge-amend-row')).find(function(row){return row.querySelector('strong').textContent==='Whole foods, no takeaway'});
    expect(foodRow.querySelector('button').textContent).toBe('Mark complete');
    expect(window.challenge75AmendRule('eating',past)).toBe(true);
    expect(state.dailyCheckIns[past].manualConfirmations.eating).toBe(true);
    expect(Array.from(document.querySelectorAll('.challenge-amend-row')).find(function(row){return row.querySelector('strong').textContent==='Whole foods, no takeaway'}).querySelector('button').textContent).toBe('Undo');
    expect(window.challenge75AmendRule('eating',past)).toBe(true);
    expect(state.dailyCheckIns[past]).not.toHaveProperty('manualConfirmations');
    expect(window.openChallenge75Amend('2026-10-11')).toBe(false);
    expect(window.challenge75EatingAction('2026-10-11')).toBe(false);
    window.renderChallenge75Journey();
    expect(document.querySelector('[data-challenge-date="2026-10-11"]')).toBeNull();
    expect(document.querySelector('.challenge-calendar-day.future')).not.toBeNull();
  });

  it('shows optional Fuel guidance with no macro completion action',function(){
    const {window,document}=createHarness({today:'2026-10-10'});
    window.renderTrainingFuel();
    const html=document.getElementById('training-fuel').innerHTML;
    expect(html).toContain('OPTIONAL GUIDANCE');
    expect(html).toContain('Whole foods, no takeaway');
    expect(html).toContain('Confirm for today');
    expect(html).toContain('not 75 Me completion criteria');
    expect(html).not.toMatch(/wa-quick-protein|wa-quick-calories|Save macros|1,700–2,100|120g\+ protein/i);
    expect(source('js/winter-arc.js')).not.toMatch(/openWinterArcEating|saveWinterArcMacros|wa-quick-protein|wa-quick-calories/);
  });
});
