import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';

const ROOT=path.resolve(import.meta.dirname,'..');

function source(file){return fs.readFileSync(path.join(ROOT,file),'utf8')}

function installClock(window,dateKey){
  const RealDate=window.Date;
  const now=new RealDate(dateKey+'T12:00:00');
  class FixedDate extends RealDate{
    constructor(...args){super(...(args.length?args:[now.getTime()]))}
    static now(){return now.getTime()}
  }
  window.Date=FixedDate;
}

function defaultState(){
  return {
    dailyCheckIns:{},
    trainingSessions:{},
    reading:{sessions:{},activeSessionId:null},
    water:{},
    waterSettings:{glassMl:250},
    habits:[
      {id:'duolingo-habit',name:'Duolingo',freq:'daily',badge:'per',anchor:'anytime',icon:'',note:'',startDate:'2026-10-05',logs:{},integrationKeys:[],provenanceVersion:1,logProvenance:{},lifecycle:{version:1,inactivePeriods:[]}},
      {id:'manna-habit',name:'Manna',freq:'daily',badge:'per',anchor:'anytime',icon:'',note:'',startDate:'2026-10-05',logs:{},integrationKeys:[],provenanceVersion:1,logProvenance:{},lifecycle:{version:1,inactivePeriods:[]}}
    ],
    challenges:{
      'winter-arc-75-me-v1':{
        id:'winter-arc-75-me-v1',title:'Winter Arc: 75 Me',startDate:'2026-10-05',endDate:'2026-12-18',continuation:'continue',waterTargetMl:2000,waterGlassMl:250,definitionVersion:1,planId:'winter-arc-75-me-2026',planVersion:1,
        ruleIds:['steps','workout','water','duolingo','reading','manna','alcohol','eating'],
        habitIds:{duolingo:'duolingo-habit',manna:'manna-habit'}
      }
    }
  };
}

export function createHarness(options={}){
  const dom=new JSDOM('<!doctype html><html><body><div id="modal" style="display:none"><div id="modal-content"></div></div><div id="training-fuel"></div><div id="planner-journey"></div></body></html>',{url:'https://example.test/Life-Hub/',runScripts:'outside-only'});
  const {window}=dom;
  installClock(window,options.today||'2026-10-10');
  window.STATE=options.state||defaultState();
  window.localDateKey=function(value){const d=value instanceof window.Date?value:new window.Date(value);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  window.saveStateOrRollback=function(){return true};
  window.emitLifeHubChange=function(){};
  window.refreshPlannerCards=function(){};
  window.showCelebrationToast=function(){};
  window.escapeHtml=function(value){return String(value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]})};
  window.fmtDate=function(key){return key};
  window.habitDate=function(key){return new window.Date(key+'T12:00:00')};
  window.habitAddDays=function(date,amount){const next=new window.Date(date);next.setDate(next.getDate()+amount);return next};
  window.habitDayDiff=function(a,b){return Math.round((new window.Date(b+'T12:00:00')-new window.Date(a+'T12:00:00'))/86400000)};
  window.weekKey=function(date){const next=new window.Date(date);const shift=(next.getDay()+6)%7;next.setDate(next.getDate()-shift);return window.localDateKey(next)};
  window.getHabitProgress=function(habit,start,end){let count=0;Object.keys(habit.logs||{}).forEach(function(key){if(key>=start&&key<=end&&habit.logs[key]===true)count++});return {count:count,target:3,met:count>=3}};
  window.getHabitDayState=function(){return 'active'};
  window.habitManualCompleted=function(habit,key){return !!(habit.logs&&habit.logs[key])};
  window.toggleHabit=function(id,key){const habit=window.STATE.habits.find(function(item){return item.id===id});if(!habit)return false;if(habit.logs[key])delete habit.logs[key];else habit.logs[key]=true;return true};
  window.closeModal=function(){window.document.getElementById('modal').style.display='none'};
  window.eval(source('js/training-plan-v1.js'));
  window.eval(source('js/winter-arc.js'));
  window.eval(source('js/challenge.js'));
  return {window,document:window.document,state:window.STATE,loadPersistence:function(){window.eval(source('js/persistence.js'))}};
}

export {ROOT,source};
