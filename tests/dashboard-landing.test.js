import {describe,expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {source} from './harness.js';

describe('v75 Dashboard landing navigation',function(){
  it('lands on Dashboard with exactly five ordered destinations',function(){
    const document=new JSDOM(source('index.html')).window.document;
    expect(document.querySelector('.page.active').id).toBe('page-dashboard');
    expect(document.querySelectorAll('.page.active')).toHaveLength(1);
    const expected=['Dashboard','Movement','Finance','Insights','More'];
    expect(Array.from(document.querySelectorAll('.v75-primary-nav .topnav-link')).map(function(x){return x.textContent.trim()})).toEqual(expected);
    expect(Array.from(document.querySelectorAll('.v75-mobile-nav .mobile-command-item span:last-child')).map(function(x){return x.textContent.trim()})).toEqual(expected);
    expect(document.querySelector('.topnav-link.active').getAttribute('data-page')).toBe('dashboard');
    expect(document.querySelector('.mobile-command-item.active').getAttribute('aria-current')).toBe('page');
  });

  it('keeps only retained pages in the active shell',function(){
    const document=new JSDOM(source('index.html')).window.document;
    ['dashboard','workout','winter-arc','finance','insights','more'].forEach(function(page){expect(document.getElementById('page-'+page)).not.toBeNull()});
    ['planner','habits','tasks','gratitude','skincare','relationships','lists','goals','review'].forEach(function(page){expect(document.getElementById('page-'+page)).toBeNull()});
    expect(document.querySelector('#page-workout .page-tabs')).toBeNull();
  });
});
