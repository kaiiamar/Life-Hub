import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {ROOT} from './harness.js';

describe('v64 shell release',function(){
  it('keeps every local shell query and service worker version aligned',function(){
    const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const serviceWorker=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
    const versions=Array.from(index.matchAll(/(?:src|href)="(?:js\/[^"?]+|style-new\.css)\?v=(\d+)"/g),function(match){return match[1]});
    expect(versions).toHaveLength(19);
    expect(new Set(versions)).toEqual(new Set(['64']));
    expect(serviceWorker).toContain("var VERSION='v64';");
    expect(index).not.toContain('?v=63');
  });

  it('retains responsive tile and amendment geometry rules',function(){
    const css=fs.readFileSync(path.join(ROOT,'style-new.css'),'utf8');
    expect(css).toContain('@media(max-width:600px)');
    expect(css).toMatch(/#planner-today \.challenge75-grid\{grid-template-columns:1fr\}/);
    expect(css).toMatch(/\.challenge-amend-row\{display:grid;grid-template-columns:34px minmax\(0,1fr\) auto/);
    expect(css).toMatch(/@media\(max-width:420px\).*?\.challenge-amend-row/s);
  });
});
