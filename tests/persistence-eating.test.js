import {describe,expect,it} from 'vitest';
import {createHarness} from './harness.js';

function persistenceHarness(){
  const harness=createHarness();
  harness.window.DEFAULT_STATE={};
  harness.loadPersistence();
  return harness;
}

function inWindow(window,value){return window.JSON.parse(JSON.stringify(value))}
function validation(window,row){return window.validateLifeHubState(inWindow(window,{dailyCheckIns:{'2026-10-09':row}}),{importMode:true})}

function compatibleSession(window,revision){
  const occurrence=window.winterArcOccurrence('2026-10-09');
  return {
    id:occurrence.id,occurrenceId:occurrence.id,planId:occurrence.planId,planVersion:occurrence.planVersion,planContentRevision:revision,date:occurrence.date,
    code:'REST-SAFETY',kind:'rest',status:'planned',qualifies:false,durationSec:0,exercises:[]
  };
}

describe('eating confirmation persistence',function(){
  it('accepts eating true alongside preserved nutrition history',function(){
    const {window}=persistenceHarness();
    const row={date:'2026-10-09',proteinG:150,calories:1900,balancedPortionsConfirmed:true,manualConfirmations:{reading:true,workout:true,eating:true}};
    expect(validation(window,row)).toEqual({ok:true,errors:[]});
    expect(row).toMatchObject({proteinG:150,calories:1900,balancedPortionsConfirmed:true});
  });

  it('rejects false and unsupported manual confirmation keys',function(){
    const {window}=persistenceHarness();
    const falseResult=validation(window,{date:'2026-10-09',manualConfirmations:{eating:false}});
    expect(falseResult.ok).toBe(false);
    expect(falseResult.errors.join(' ')).toContain('must be true or omitted');
    const unsupported=validation(window,{date:'2026-10-09',manualConfirmations:{nutrition:true}});
    expect(unsupported.ok).toBe(false);
    expect(unsupported.errors.join(' ')).toContain('is not supported');
  });

  it('continues to validate v1.1 and v1.2 session history',function(){
    const {window}=persistenceHarness();
    ['1.1','1.2'].forEach(function(revision){
      const session=compatibleSession(window,revision);
      const result=window.validateLifeHubState(inWindow(window,{trainingSessions:{[session.id]:session}}),{importMode:true});
      expect(result,{revision:revision,errors:result.errors}).toEqual({ok:true,errors:[]});
    });
  });
});
