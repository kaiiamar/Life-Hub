import {describe,expect,it} from 'vitest';
import {createHarness,source} from './harness.js';

function install(today='2026-11-16'){
  const h=createHarness({today});
  Object.assign(h.state,{goals:[],debts:[{id:'amex',name:'Amex',balance:125,startingBalance:300}],savingsGoals:[{id:'holiday',name:'Holiday',target:1000,current:250}],debtPayments:[],debtCharges:[],savingsDeposits:[],savingsWithdrawals:[],metrics:{weight:[]},reminders:[],paydayCheckIns:{},study:{version:2,sessions:{}}});
  h.window.nav=function(){};
  h.window.fmtMoney=function(value){return '£'+Number(value).toFixed(2)};
  h.window.eval(source('js/life-hub-v75.js'));
  return h;
}

describe('Cherry Gilt v77 composition',function(){
  it('builds a crafted shell with ordered sticker navigation',function(){
    const html=source('index.html'),css=source('style-new.css');
    expect(html).toContain('cg-brand-seal');
    expect(html).toContain('cg-brand-note');
    expect(html).toContain('cg-date-sticker');
    expect(html).toContain('cg-page-intro');
    expect(html).toContain('cg-paper-sheet');
    expect((html.match(/class="mobile-command-item/g)||[])).toHaveLength(5);
    ['Dashboard','Movement','Finance','Insights','More'].reduce(function(position,label){const next=html.indexOf('>'+label+'<',position+1);expect(next).toBeGreaterThan(position);return next},-1);
    expect(css).toContain('.topnav-link.active');
    expect(css).toContain('.mobile-command-item.active');
    expect(css).toContain('box-shadow:3px 3px 0 var(--cg-plum)');
    expect(css).toContain('min-height:44px');
    expect(html).not.toContain('fonts.googleapis.com');
  });

  it('renders action-first Dashboard scrapbook structure without duplicate workout actions',function(){
    const {window}=install();
    window.document.body.innerHTML='<div id="v75-dashboard"></div>';
    window.renderDashboardV75();
    const host=window.document.getElementById('v75-dashboard');
    expect(host.querySelector('.cg-dashboard-intro')).not.toBeNull();
    expect(host.querySelector('.cg-statement-card')).not.toBeNull();
    expect(host.querySelector('.cg-basics-ledger')).not.toBeNull();
    expect(host.querySelectorAll('.cg-basic-sticker')).toHaveLength(3);
    expect(host.querySelectorAll('.cg-water-chip')).toHaveLength(4);
    expect(host.querySelector('.cg-basic-steps progress[max="8000"]')).not.toBeNull();
    expect(host.querySelector('.cg-exact-value').textContent).toContain('/ 8,000');
    expect(host.querySelectorAll('[data-v77-workout-date]')).toHaveLength(1);
    expect(host.textContent.indexOf('Start workout')).toBeLessThan(host.textContent.indexOf('Daily Basics'));
    expect(host.querySelectorAll('[onclick],[onchange],[oninput]')).toHaveLength(0);
  });

  it('uses distinct Movement, Finance, Insights, and settings surfaces',function(){
    const {window}=install();
    window.document.body.innerHTML='<div id="v75-movement"></div><div id="v75-finance"></div><div id="v75-insights"></div><div id="v75-settings"></div>';
    window.renderMovementV75();window.renderFinanceV75();window.renderInsightsV75();
    expect(window.document.querySelector('.cg-session-statement')).not.toBeNull();
    expect(window.document.querySelector('.cg-week-card progress')).not.toBeNull();
    expect(window.document.querySelectorAll('.cg-ledger-section')).toHaveLength(2);
    expect(window.document.querySelectorAll('.cg-ledger-card')).toHaveLength(2);
    expect(window.document.querySelector('.cg-ledger-card').textContent).toContain('Current');
    expect(window.document.querySelectorAll('.cg-insight-grid .cg-insight-plot').length).toBeGreaterThanOrEqual(4);
    expect(window.document.querySelectorAll('#v75-finance [onclick],[onchange],[oninput]')).toHaveLength(0);
  });

  it('keeps the Finance sheet DOM-bound and user text in text-safe sinks',function(){
    const modal=source('js/modals.js'),renderer=source('js/life-hub-v75.js');
    expect(modal).toContain("context.textContent=item.name||'Finance record'");
    expect(modal).toContain("cancel.addEventListener('click',closeModal)");
    expect(modal).toContain("form.addEventListener('submit'");
    expect(renderer).toContain("/^[A-Za-z0-9_-]{1,160}$/.test(workoutSession)");
    expect(renderer).not.toMatch(/style="width:'\+/);
  });

  it('enforces the motif, color, responsive, focus, and motion rules',function(){
    const all=source('index.html')+source('style-new.css')+source('js/life-hub-v75.js');
    const css=source('style-new.css');
    expect(all).not.toMatch(/\b(?:bow|ribbon)\b/i);
    const pinkUses=css.split('\n').filter(function(line){return line.includes('var(--cg-hot-pink)')&&!line.includes('--cg-hot-pink:')});
    expect(pinkUses.length).toBeGreaterThan(0);
    expect(pinkUses.every(function(line){return /wa-exercise-effort|wa-one-tap/.test(line)})).toBe(true);
    expect(css).toContain('@media(max-width:960px){\n  .topnav-name{display:inline}');
    expect(css).toContain('.mobile-command-item>span:last-child{max-width:100%;text-align:center;line-height:1.15;overflow-wrap:anywhere}');
    expect(css).toContain('@media(min-width:1024px)');
    expect(css).toContain('@media(max-width:390px)');
    expect(css).toContain('@media(max-width:340px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('outline:3px solid var(--cg-focus)');
    expect(css).toContain('grid-template-columns:repeat(12,minmax(0,1fr))');
    expect(css).not.toMatch(/transform:rotate\([^)]*\)[^\n]*(?:input|textarea|select)/i);
  });
});
