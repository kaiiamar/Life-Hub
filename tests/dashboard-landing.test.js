import {describe,expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {source} from './harness.js';

describe('Today landing navigation',function(){
  it('marks Today as the default page after bootstrap',function(){
    const dom=new JSDOM(source('index.html'));
    const document=dom.window.document;
    expect(document.querySelector('.page.active').id).toBe('page-planner');
    expect(document.querySelectorAll('.page.active')).toHaveLength(1);
    expect(document.querySelector('.topnav-link.active').getAttribute('data-page')).toBe('planner');
    expect(document.querySelector('.sidebar .nav-item.active').getAttribute('onclick')).toBe("nav('planner')");
    expect(document.querySelector('.mobile-command-item.active').getAttribute('data-page')).toBe('planner');
    expect(document.querySelector('.mobile-command-item.active').getAttribute('aria-current')).toBe('page');
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(source('js/init.js')).toMatch(/finishDataBootstrap\(\);\s*try\{renderDashboard\(\)\}[\s\S]{0,160}try\{renderPlanner\(\)\}/);
  });

  it('keeps every explicit page and workout tab route available',function(){
    const dom=new JSDOM(source('index.html'));
    const document=dom.window.document;
    const pageTargets=Array.from(document.querySelectorAll('[onclick]')).map(function(element){
      const match=/^nav\('([^']+)'\)$/.exec(element.getAttribute('onclick'));
      return match&&match[1];
    }).filter(Boolean);
    expect(pageTargets).toEqual(expect.arrayContaining(['dashboard','planner','habits','workout']));
    pageTargets.forEach(function(page){expect(document.getElementById('page-'+page)).not.toBeNull()});
    ['calendar','history'].forEach(function(tab){
      expect(document.querySelector('#page-workout [data-tab="'+tab+'"]')).not.toBeNull();
      expect(document.getElementById('workout-'+tab)).not.toBeNull();
    });
  });
});
