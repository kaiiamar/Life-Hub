import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {ROOT} from './harness.js';

describe('v77 shell release',function(){
  it('keeps every local shell query and service worker version aligned',function(){
    const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const serviceWorker=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
    const assets=Array.from(index.matchAll(/(?:src|href)="(js\/[^"?]+|style-new\.css)\?v=(\d+)"/g));
    expect(assets).toHaveLength(18);
    expect(new Set(assets.map(function(match){return match[2]}))).toEqual(new Set(['77']));
    expect(serviceWorker).toContain("var VERSION='v77';");
    assets.filter(function(match){return match[1].startsWith('js/')}).forEach(function(match){expect(serviceWorker).toContain("'"+match[1]+"'")});
    expect(index).not.toContain('?v=75');
  });

  it('contains v77 responsive, focus, and reduced-motion rules',function(){
    const css=fs.readFileSync(path.join(ROOT,'style-new.css'),'utf8');
    expect(css).toContain('@media(max-width:390px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('.v75-mobile-nav{grid-template-columns:repeat(5,minmax(0,1fr))}');
  });
});
