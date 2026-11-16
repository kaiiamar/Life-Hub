import {describe,expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {source} from './harness.js';

describe('v75 navigation',function(){
  it('forwards completion callbacks used by Start Workout',async function(){
    const dom=new JSDOM('<!doctype html><body><nav><button class="topnav-link active" data-page="dashboard" aria-current="page"></button><button class="topnav-link" data-page="workout"></button></nav><div class="page active" id="page-dashboard"></div><div class="page" id="page-winter-arc"></div></body>',{url:'https://example.test',runScripts:'outside-only'});
    const {window}=dom;
    window.scrollTo=function(){};
    window.renderWinterArcPage=function(){};
    window.eval(source('js/navigation.js'));
    let completed=false;
    window.nav('winter-arc',function(){completed=true});
    await new Promise(function(resolve){setTimeout(resolve,210)});
    expect(completed).toBe(true);
    expect(window.document.querySelector('[data-page="dashboard"]').hasAttribute('aria-current')).toBe(false);
    expect(window.document.querySelector('[data-page="workout"]').getAttribute('aria-current')).toBe('page');
  });
});
