// NAVIGATION
// ============================================================
var activeWeek=localDateKey(habitWeekStart(new Date()));
var goalFilter='all';
var metricCharts={};

// Global keyboard support for div-based buttons (role="button").
// Lets keyboard users activate clickable divs with Enter/Space, so we keep
// the lightweight markup but stay WCAG 2.1.1 compliant.
document.addEventListener('keydown',function(e){
  if(e.key!=='Enter'&&e.key!==' '&&e.key!=='Spacebar')return;
  var t=e.target;
  if(!t||t.getAttribute('role')!=='button')return;
  // Don't hijack real form controls / links / native buttons
  var tag=(t.tagName||'').toLowerCase();
  if(tag==='button'||tag==='a'||tag==='input'||tag==='textarea'||tag==='select')return;
  e.preventDefault();
  t.click();
});

function localDateKey(d){var y=d.getFullYear();var m=('0'+(d.getMonth()+1)).slice(-2);var day=('0'+d.getDate()).slice(-2);return y+'-'+m+'-'+day}
// Monday week convention. habitWeekStart() below is the single week-start helper
// and every weekly window derives from it, so there is one implementation of the
// rule rather than two. Function declarations hoist within a script, so calling
// habitWeekStart from up here is safe — `var activeWeek` at the top of this file
// already relies on that.
function weekKey(d){return localDateKey(habitWeekStart(d))}
// True when `key` is itself a Monday. Makes the Sunday→Monday migration
// self-checking, and therefore a no-op on a second run whatever its flag says.
function isMondayKey(key){return localDateKey(habitWeekStart(key))===key}
// Sunday-keyed week S maps to S+1: the Monday week that contains six of the same
// seven days. Injective over Sunday keys, and a Monday key is left alone.
function mondayKeyForWeekKey(key){return isMondayKey(key)?key:localDateKey(habitWeekStart(habitAddDays(key,1)))}
function weekDays(wk){var parts=wk.split('-');var s=new Date(+parts[0],+parts[1]-1,+parts[2]);return Array.from({length:7},function(_,i){var d=new Date(s);d.setDate(d.getDate()+i);return localDateKey(d)})}function fmtDate(d){return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
function fmtMoney(n){return '\u00a3'+Math.abs(Number(n)).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0})}

// ── SHARED MEASUREMENT CALCULATORS ──
// One definition per measure, living here because js/navigation.js loads third —
// before dashboard.js, insights.js, reviews.js and planner.js, all four of which
// read these. Every calculator reads STATE.tasks and never the retired
// STATE.dailyPriorities. Per Components §A.

// A `days` array turned into a membership lookup, so a 30-day window over a long
// task store stays a single pass rather than a nested scan.
function _dayKeySet(days){var set={};(days||[]).forEach(function(d){if(d)set[d]=true});return set}

// Focus_Task population over `days`. Slate membership is by `focusDate`, the
// permanent record of the day a task was chosen for; a task counts as done only
// when `done === true` and its `doneAt` also falls inside the window. So a task
// slated Monday and finished Wednesday sits in Monday's population without
// counting as a Monday completion — the disambiguation in Design Decision 7.
// Sole definition of the Priorities measure. Requirements 1.1, 1.6, 2.1, 2.2, 15.2.
function focusStats(days){
  var set=_dayKeySet(days);
  var total=0,done=0;
  (STATE.tasks||[]).forEach(function(t){
    if(!t||!t.focusDate||!set[t.focusDate])return;
    total++;
    if(t.done===true&&t.doneAt&&set[t.doneAt])done++;
  });
  return {total:total,done:done,pct:total>0?Math.round(done/total*100):0};
}

// Every task completed inside `days`, counted by `doneAt` — not just Focus_Tasks,
// because the monthly number is what was actually finished that month.
// `capturedInWindow` counts tasks created inside the window; it is context, never
// a denominator, since Decision 8 retires the completion ratio as a Guilt_Metric.
// `createdAt` is a date key on tasks the app writes, so the slice tolerates an
// ISO timestamp from any older record. Requirements 3.1, 3.2, 13.6.
function taskCompletionStats(days){
  var set=_dayKeySet(days);
  var completed=0,capturedInWindow=0;
  (STATE.tasks||[]).forEach(function(t){
    if(!t)return;
    if(t.done===true&&t.doneAt&&set[t.doneAt])completed++;
    if(t.createdAt&&set[String(t.createdAt).slice(0,10)])capturedInWindow++;
  });
  return {completed:completed,capturedInWindow:capturedInWindow};
}

// The days inside `days` whose Focus_Slate was non-empty and fully complete,
// ascending. Slate membership is by `focusDate` and completion by the `done`
// flag alone — a task slated Monday and finished Wednesday means Monday's slate
// was completed, just late, so Monday is counted (Design Decision 7). Days with
// no slate at all are never counted, so an untouched day cannot read as a win.
// Reconstructing this from the task store is only possible because the daily
// `focusDate` hygiene sweep is gone; stamps predating that removal are lost, so
// the count fills in from the day it shipped forward. Requirement 15.3.
function focusSlateDays(days){
  var set=_dayKeySet(days);
  var byDay={};
  (STATE.tasks||[]).forEach(function(t){
    if(!t||!t.focusDate||!set[t.focusDate])return;
    (byDay[t.focusDate]||(byDay[t.focusDate]=[])).push(t);
  });
  // Date keys are ISO, so a lexicographic sort is a chronological one, and the
  // set collapses any duplicate day the caller passed.
  return Object.keys(set).sort().filter(function(d){
    var slate=byDay[d]||[];
    return slate.length>0&&slate.every(function(t){return t.done===true});
  });
}

// Water logging over `days`. `loggedDays` counts the days carrying at least one
// glass, `glasses` the total logged across them, and `target` is the daily
// preference — 8 when unset, the same fallback every existing water reader uses
// (js/gratitude.js, js/planner.js, the waterSettings modal), so the calculator
// and the cards never disagree about what the target is. The window is walked
// rather than the store, so a day repeated in `days` is counted once.
// Sole definition of the water measure. Requirements 12.4, 12.5.
function waterStats(days){
  var set=_dayKeySet(days);
  var water=STATE.water||{};
  var loggedDays=0,glasses=0;
  Object.keys(set).forEach(function(d){
    var n=Number(water[d]||0);
    // Excludes 0, a negative, and a non-numeric leftover: a day with no water
    // logged is not a logged day.
    if(!(n>0))return;
    loggedDays++;
    glasses+=n;
  });
  return {loggedDays:loggedDays,glasses:glasses,target:Number((STATE.waterSettings&&STATE.waterSettings.target)||8)};
}

// Gratitude entries over `days`. `entries` counts records, `entryDays` the
// distinct days holding at least one — the app writes one entry per day, but the
// two are reported separately so neither caller has to assume that. An entry
// counts by its `date` alone, exactly as dayHadActivity() reads the domain.
// Sole definition of the gratitude measure. Requirements 7.2, 12.4.
function gratitudeStats(days){
  var set=_dayKeySet(days);
  var seen={};
  var entries=0,entryDays=0;
  (STATE.gratitude||[]).forEach(function(e){
    if(!e||!e.date||!set[e.date])return;
    entries++;
    if(!seen[e.date]){seen[e.date]=true;entryDays++}
  });
  return {entryDays:entryDays,entries:entries};
}

// Auto-link goal progress to real data sources
function getGoalSource(g){
  if(!g||g.manualOverride)return {source:'manual',progress:g.progress||0};
  var name=(g.name||'').toLowerCase();
  var cat=g.cat;
  var unit=(g.unit||'').toLowerCase();
  var dir=g.direction;

  // Finance — debt (down + £ + debt keywords)
  if(cat==='Finance'&&dir==='down'&&(unit==='£'||unit==='\u00a3')&&/debt|credit|loan|klarna|chase|amex|bnpl/i.test(name)){
    var total=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance||0)},0);
    return {source:'debt',progress:total,label:'🔗 Linked to Debts'};
  }
  // Finance — savings/house deposit (up + £ + save keywords)
  if(cat==='Finance'&&dir==='up'&&(unit==='£'||unit==='\u00a3')&&/save|saving|deposit|fund|house|emergency|thailand/i.test(name)){
    // Try matching name to a specific savings goal or account first
    var nameWords=name.split(/\s+/);
    var matchedGoal=(STATE.savingsGoals||[]).find(function(sg){
      var sgName=(sg.name||'').toLowerCase();
      return nameWords.some(function(w){return w.length>3&&sgName.indexOf(w)!==-1});
    });
    if(matchedGoal)return {source:'savings-goal',progress:Number(matchedGoal.current||0),label:'🔗 Linked to Savings'};
    var matchedAccount=(STATE.accounts||[]).find(function(a){
      var aName=(a.name||'').toLowerCase();
      return nameWords.some(function(w){return w.length>3&&aName.indexOf(w)!==-1});
    });
    if(matchedAccount)return {source:'account',progress:Number(matchedAccount.balance||0),label:'🔗 Linked to Accounts'};
    // Fallback: sum of all money saved entries
    var saved=((STATE.metrics||{}).moneySaved||[]).reduce(function(s,m){return s+Number(m.amount||0)},0);
    return {source:'moneySaved',progress:saved,label:'🔗 Linked to Money saved'};
  }
  // Fitness — weight (kg + down)
  if(cat==='Fitness'&&unit==='kg'&&dir==='down'){
    var weights=((STATE.metrics||{}).weight||[]);
    if(weights.length){
      var latest=weights.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).pop();
      return {source:'weight',progress:Number(latest.value),label:'🔗 Linked to Weight log'};
    }
    return {source:'weight',progress:g.progress||0};
  }
  // Fitness — run time PB (min + down + distance keyword)
  if(cat==='Fitness'&&unit==='min'&&dir==='down'&&/5k|10k|run/i.test(name)){
    var targetDist=/10k/i.test(name)?10:5;
    var tol=targetDist===10?0.5:0.3;
    var runs=((STATE.metrics||{}).run||[]).filter(function(r){return r.time&&r.distance&&Math.abs(Number(r.distance)-targetDist)<=tol});
    if(runs.length){
      var best=runs.reduce(function(b,r){
        var ap=r.time.split(':');var bp=b.time.split(':');
        var am=Number(ap[0]||0)+Number(ap[1]||0)/60;
        var bm=Number(bp[0]||0)+Number(bp[1]||0)/60;
        return am<bm?r:b;
      },runs[0]);
      var parts=best.time.split(':');
      var mins=Number(parts[0]||0)+Number(parts[1]||0)/60;
      return {source:'run',progress:Math.round(mins*10)/10,label:'🔗 Linked to Runs'};
    }
    return {source:'run',progress:g.progress||0};
  }
  // Fitness — half marathon distance (km + up + half marathon)
  if(cat==='Fitness'&&unit==='km'&&dir==='up'&&/half marathon|marathon/i.test(name)){
    var longest=((STATE.metrics||{}).run||[]).reduce(function(b,r){return Number(r.distance||0)>b?Number(r.distance||0):b},0);
    return {source:'run-distance',progress:longest,label:'🔗 Linked to Runs'};
  }
  // Fitness — sessions count (sessions + up)
  if(cat==='Fitness'&&dir==='up'&&/session|hyrox|gym|workout/i.test(name)){
    var count=(STATE.workouts||[]).length;
    return {source:'workouts',progress:count,label:'🔗 Linked to Training'};
  }
  // Fitness — consistent months (months + up)
  if(cat==='Finance'&&dir==='up'&&/month/i.test(name)&&/save|invest/i.test(name)){
    // Count months with at least one moneySaved entry
    var moneySaved=((STATE.metrics||{}).moneySaved||[]);
    var monthsSet={};
    moneySaved.forEach(function(m){if(m.date){monthsSet[m.date.slice(0,7)]=true}});
    return {source:'save-streak',progress:Object.keys(monthsSet).length,label:'🔗 Linked to Money saved'};
  }
  return {source:'manual',progress:g.progress||0};
}

function goalPct(g){
  var src=getGoalSource(g);
  var progress=src.progress;
  if(progress===undefined||progress===null)return 0;
  if(g.direction==='up'){
    if(!g.target)return 0;
    return Math.min(100,Math.round((progress/g.target)*100));
  }
  if(g.direction==='down'){
    // Target is the "finish line" you want progress to reach (e.g. 0 for debt free, 80 for weight)
    // startProgress is where you began
    var start=g.startProgress||g.initialProgress||progress;
    var target=Number(g.target)||0;
    // If already at or below target, 100%
    if(progress<=target)return 100;
    // If start is below or equal to target, can't compute meaningful %
    if(start<=target)return 0;
    return Math.min(100,Math.max(0,Math.round(((start-progress)/(start-target))*100)));
  }
  return 0;
}
function pbarColor(p){return p>=80?'#6b9e7a':p>=50?'#c9973a':'var(--accent)'}
function daysLeft(dl){return Math.ceil((new Date(dl)-new Date())/86400000)}
function statusBadge(g){var p=goalPct(g);var dl=daysLeft(g.deadline);if(p>=100)return '<span class="badge badge-done">Done</span>';if(dl<0)return '<span class="badge">Past target date</span>';if(dl<30&&p<70)return '<span class="badge">Target approaching</span>';if(p>0)return '<span class="badge badge-track">On track</span>';return '<span class="badge badge-pend">Not started</span>'}
// Canonical habit cadence engine. Every habit surface should use these
// helpers so daily, weekly, fortnightly, and monthly progress agree.
var HABIT_FORTNIGHT_ANCHOR='2024-01-01'; // A stable Monday anchor.

function habitDate(value){
  if(value instanceof Date)return new Date(value.getFullYear(),value.getMonth(),value.getDate());
  var parts=String(value||'').slice(0,10).split('-');
  if(parts.length===3&&parts.every(function(part){return /^\d+$/.test(part)}))return new Date(+parts[0],+parts[1]-1,+parts[2]);
  var parsed=new Date(value);return new Date(parsed.getFullYear(),parsed.getMonth(),parsed.getDate());
}
function habitAddDays(value,days){var d=habitDate(value);d.setDate(d.getDate()+days);return d}
function habitDayDiff(from,to){var a=habitDate(from),b=habitDate(to);return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000)}
function habitFrequency(habit){
  var f=String(typeof habit==='string'?habit:(habit&&habit.freq)||'daily').trim().toLowerCase();
  if(f==='bi-monthly')f='fortnightly';
  if(f==='daily'||f==='weekly'||f==='fortnightly'||f==='monthly'||/^\d+x\/week$/.test(f))return f;
  return 'daily';
}
function habitFrequencyTarget(frequency){var f=habitFrequency(frequency);if(/^\d+x\/week$/.test(f))return Math.max(1,Math.min(7,Number(f.split('x')[0])||1));return 1}
function habitWeekStart(value){var d=habitDate(value);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function habitWeekDays(value){var start=habitWeekStart(value);return Array.from({length:7},function(_,i){return localDateKey(habitAddDays(start,i))})}

function getHabitPeriod(habit,dateValue){
  var date=habitDate(dateValue||new Date());
  var f=habitFrequency(habit);
  var start,end,target=habitFrequencyTarget(f);
  if(f==='daily'){start=date;end=date}
  else if(f==='weekly'||/^\d+x\/week$/.test(f)){start=habitWeekStart(date);end=habitAddDays(start,6)}
  else if(f==='monthly'){start=new Date(date.getFullYear(),date.getMonth(),1);end=new Date(date.getFullYear(),date.getMonth()+1,0)}
  else{
    var anchor=habitDate(HABIT_FORTNIGHT_ANCHOR);
    var periodIndex=Math.floor(habitDayDiff(anchor,date)/14);
    start=habitAddDays(anchor,periodIndex*14);end=habitAddDays(start,13);
  }
  var startKey=localDateKey(start),endKey=localDateKey(end);
  return {frequency:f,start:startKey,end:endKey,target:target,key:f+':'+startKey,unit:f==='daily'?'day':(f==='monthly'?'month':(f==='fortnightly'?'fortnight':'week'))};
}
function habitPeriodOffset(habit,dateValue,offset){
  var period=getHabitPeriod(habit,dateValue),reference=habitDate(period.start),f=period.frequency;
  if(f==='monthly')reference=new Date(reference.getFullYear(),reference.getMonth()+offset,1);
  else reference=habitAddDays(reference,offset*(f==='daily'?1:(f==='fortnightly'?14:7)));
  return getHabitPeriod(habit,reference);
}
function habitLifecycleRanges(habit){
  var lifecycle=habit&&habit.lifecycle;
  return lifecycle&&lifecycle.version===1&&Array.isArray(lifecycle.inactivePeriods)?lifecycle.inactivePeriods:[];
}
function habitInactiveKindOnDate(habit,dateValue){
  var dateKey=localDateKey(habitDate(dateValue));
  var ranges=habitLifecycleRanges(habit);
  for(var i=ranges.length-1;i>=0;i--){
    var range=ranges[i];
    if(range&&range.from<=dateKey&&(range.to===null||range.to===undefined||dateKey<range.to))return range.kind;
  }
  return null;
}
function habitIsActiveOnDate(habit,dateValue){
  var dateKey=localDateKey(habitDate(dateValue));
  return !(habit&&habit.startDate&&dateKey<habit.startDate)&&!habitInactiveKindOnDate(habit,dateKey);
}
function habitLifecycleStatus(habit,dateValue){return habitInactiveKindOnDate(habit,dateValue||new Date())||'active'}
function habitPeriodEligibility(habit,period){
  var startKey=period.start;
  if(habit&&habit.startDate&&habit.startDate>startKey)startKey=habit.startDate;
  if(startKey>period.end)return {start:startKey,days:[],activeDays:[],active:false,interrupted:false};
  var days=[],activeDays=[];
  for(var day=habitDate(startKey);localDateKey(day)<=period.end;day=habitAddDays(day,1)){
    var key=localDateKey(day);days.push(key);if(habitIsActiveOnDate(habit,key))activeDays.push(key);
  }
  return {start:startKey,days:days,activeDays:activeDays,active:activeDays.length>0,interrupted:activeDays.length>0&&activeDays.length!==days.length};
}
function habitCountInRange(h,startDate,endDate){
  var startKey=localDateKey(habitDate(startDate)),endKey=localDateKey(habitDate(endDate));
  return Object.keys((h&&h.logs)||{}).filter(function(key){return !!h.logs[key]&&key>=startKey&&key<=endKey&&habitIsActiveOnDate(h,key)}).length;
}
function habitLogKeysInPeriod(h,period,asOfKey){
  var eligibility=habitPeriodEligibility(h,period),endKey=period.end;
  if(asOfKey&&asOfKey<endKey)endKey=asOfKey;
  return Object.keys((h&&h.logs)||{}).filter(function(key){return !!h.logs[key]&&key>=eligibility.start&&key<=endKey&&habitIsActiveOnDate(h,key)}).sort();
}
function getHabitProgress(h,dateValue,asOfValue){
  var period=getHabitPeriod(h,dateValue),asOfKey=localDateKey(habitDate(asOfValue||new Date()));
  var eligibility=habitPeriodEligibility(h,period);
  var target=eligibility.active?Math.min(period.target,eligibility.activeDays.length):0;
  var logKeys=target?habitLogKeysInPeriod(h,period,asOfKey):[];
  var count=logKeys.length;
  return {period:period,target:target,count:count,met:target>0&&count>=target,active:eligibility.active,interrupted:eligibility.interrupted,eligibleDays:eligibility.activeDays,logKeys:logKeys};
}
function getHabitDayState(h,dateValue,asOfValue){
  var dateKey=localDateKey(habitDate(dateValue)),asOfKey=localDateKey(habitDate(asOfValue||new Date()));
  if(dateKey>asOfKey)return 'future';
  if(h.startDate&&dateKey<h.startDate)return 'pre-start';
  if(!habitIsActiveOnDate(h,dateKey))return 'inactive';
  if(h.logs&&h.logs[dateKey])return 'done';
  var progress=getHabitProgress(h,dateKey,asOfKey);
  if(!progress.active)return 'pre-start';
  if(progress.met){
    var optionalExtras=Math.max(0,Math.floor(Number(h.optionalExtraPerPeriod)||0));
    if(optionalExtras&&progress.count<progress.target+optionalExtras)return 'optional';
    return 'rest';
  }
  return 'todo';
}
function habitDayStatus(h,dateKey){return getHabitDayState(h,dateKey,new Date())}

function habitStatsForDays(habits,days,asOfValue){
  var uniqueDays=(days||[]).filter(function(day,index,list){return list.indexOf(day)===index}).sort();
  if(!uniqueDays.length)return {done:0,total:0,pct:0};
  var requestedAsOf=localDateKey(habitDate(asOfValue||new Date()));
  var cutoff=uniqueDays[uniqueDays.length-1]<requestedAsOf?uniqueDays[uniqueDays.length-1]:requestedAsOf;
  var total=0,done=0;
  (habits||[]).forEach(function(h,habitIndex){
    var seen={};
    uniqueDays.forEach(function(day){
      if(day>cutoff||(h.startDate&&day<h.startDate))return;
      var period=getHabitPeriod(h,day),token=habitIndex+':'+period.key;
      if(seen[token])return;seen[token]=true;
      var progress=getHabitProgress(h,day,cutoff);
      if(!progress.active||progress.interrupted||!progress.target)return;
      total+=progress.target;done+=Math.min(progress.count,progress.target);
    });
  });
  return {done:done,total:total,pct:total?Math.round(done/total*100):0};
}
function getHabitHistoricalConsistency(h,asOfValue,windowSize,skipPeriods){
  var f=habitFrequency(h),limit=windowSize||(f==='daily'?30:(f==='weekly'||/^\d+x\/week$/.test(f)?5:6));
  var total=0,done=0,offset=-1,scanned=0,skip=Math.max(0,skipPeriods||0);
  while(total<limit&&scanned<800){
    var period=habitPeriodOffset(h,asOfValue||new Date(),offset--);scanned++;
    if(h.startDate&&period.end<h.startDate)break;
    if(h.startDate&&period.start<h.startDate)continue;
    var progress=getHabitProgress(h,period.start,period.end);
    if(!progress.active||progress.interrupted)continue;
    if(skip){skip--;continue}
    total++;if(progress.met)done++;
  }
  return {pct:total?Math.round(done/total*100):0,done:done,total:total,unit:getHabitPeriod(h,asOfValue||new Date()).unit,window:limit};
}
function habitCompletedPeriodTrend(h,asOfValue,windowSize){
  var size=windowSize||4,recent=getHabitHistoricalConsistency(h,asOfValue,size,0);
  var earlier=getHabitHistoricalConsistency(h,asOfValue,size,size);
  if(recent.total<2||earlier.total<2)return {available:false,recent:recent,earlier:earlier,label:'More history will reveal a rhythm'};
  var delta=recent.pct-earlier.pct,label=Math.abs(delta)<15?'Recent and earlier rhythm are similar':delta>0?'Recent rhythm feels steadier':'Recent rhythm is quieter';
  return {available:true,recent:recent,earlier:earlier,delta:delta,label:label};
}
function habitStreak(h){
  var current=getHabitProgress(h,new Date(),new Date());
  var offset=current.met&&!current.interrupted?0:-1,streak=0,scanned=0;
  while(scanned<800){
    var period=habitPeriodOffset(h,new Date(),offset--);scanned++;
    if(h.startDate&&period.end<h.startDate)break;
    if(h.startDate&&period.start<h.startDate)continue;
    var progress=getHabitProgress(h,period.start,period.end);
    if(!progress.active||progress.interrupted)continue;
    if(!progress.met)break;
    streak++;
  }
  return streak;
}
function habitTargetPerWeek(h){var f=habitFrequency(h);if(f==='daily')return 7;if(/^\d+x\/week$/.test(f))return habitFrequencyTarget(f);if(f==='weekly')return 1;if(f==='fortnightly')return 0.5;if(f==='monthly')return 7/30;return 7}
function habitWeekPct(h,wk){return habitStatsForDays([h],habitWeekDays(wk),habitAddDays(habitWeekStart(wk),6)).pct}

// The roadmap feature was removed. Finance and navigation flows still call
// refreshRoadmapLiveCards(); keep a no-op stub so those calls don't throw.
function refreshRoadmapLiveCards(){}

// Chart.js (~200KB) is only needed on Insights, Training-body and Finance.
// Load it on demand the first time one of those views renders, then run the
// waiting callbacks so the canvases actually draw. Cached: the script is only
// ever injected once (Part 5.3).
var _chartJsState='idle';// idle | loading | ready
var _chartJsWaiters=[];
function ensureChartJs(cb){
  if(typeof Chart!=='undefined'){_chartJsState='ready';if(cb)cb();return}
  if(cb)_chartJsWaiters.push(cb);
  if(_chartJsState==='loading')return;
  _chartJsState='loading';
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
  s.async=true;
  s.onload=function(){
    _chartJsState='ready';
    var w=_chartJsWaiters.slice();_chartJsWaiters=[];
    w.forEach(function(fn){try{fn()}catch(e){}});
  };
  s.onerror=function(){_chartJsState='idle';_chartJsWaiters=[]};
  document.head.appendChild(s);
}

function nav(page){
  // Transition out current page
  var current=document.querySelector('.page.active');
  var pageEl=document.getElementById('page-'+page);
  if(!pageEl)return;

  function applyNav(){
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
    document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');b.removeAttribute('aria-current')});
    document.querySelectorAll('.topnav-link').forEach(function(b){b.classList.remove('active')});
    document.querySelectorAll('.mobile-command-item').forEach(function(b){b.classList.remove('active');b.removeAttribute('aria-current')});
    pageEl.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(b){if(b.getAttribute('onclick')==="nav('"+page+"')"){b.classList.add('active');b.setAttribute('aria-current','page')}});
    var mainPages=['dashboard','habits','workout','skincare','gratitude'];
    var matched=false;
    document.querySelectorAll('.topnav-link').forEach(function(b){if(b.getAttribute('data-page')===page){b.classList.add('active');matched=true}});
    document.querySelectorAll('.mobile-command-item[data-page]').forEach(function(b){if(b.getAttribute('data-page')===page){b.classList.add('active');b.setAttribute('aria-current','page')}});
    var mobileDirect=['planner','dashboard','habits','workout'];
    var mobileMore=document.getElementById('mobile-command-more');
    if(mobileMore&&mobileDirect.indexOf(page)===-1){mobileMore.classList.add('active');mobileMore.setAttribute('aria-current','page')}
    // If not a main tab, highlight the More button instead
    if(!matched&&mainPages.indexOf(page)===-1){
      var moreBtn=document.getElementById('topnav-more-btn');
      if(moreBtn)moreBtn.classList.add('active');
    }
    var titles={planner:'75 Me Challenge',dashboard:'Dashboard',goals:'Goals',habits:'Habits',workout:'Movement',finance:'Finance',review:'Reviews',insights:'Insights',relationships:'Relationships',gratitude:'Gratitude',watchlist:'Watch List',wishlist:'Wishlist',skincare:'Skincare',tasks:'Tasks'};
    var mTitle=document.getElementById('mobile-title');if(mTitle)mTitle.textContent=titles[page]||'';
    closeSidebar();
    renderPage(page);
    if(page==='roadmap')refreshRoadmapLiveCards();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  if(current&&current!==pageEl){
    current.classList.add('page-leaving');
    setTimeout(function(){
      current.classList.remove('page-leaving');
      applyNav();
    },180);
  }else{
    applyNav();
  }
}

function subNav(section,tab){var btns=document.querySelectorAll('#page-'+section+' .page-tab');var pages=document.querySelectorAll('#page-'+section+' .sub-page');btns.forEach(function(b){b.classList.remove('active')});pages.forEach(function(p){p.classList.remove('active')});event.target.classList.add('active');var spEl=document.getElementById(section+'-'+tab);if(spEl)spEl.classList.add('active');if(section==='finance'){renderFinance(tab);if(typeof Chart==='undefined')ensureChartJs(function(){renderFinance(tab)});if(tab!=='overview')refreshRoadmapLiveCards()}if(section==='workout'){if(tab==='history')renderAllWorkouts();if(tab==='body'){renderTrainingBody();if(typeof Chart==='undefined')ensureChartJs(renderTrainingBody)}if(tab==='fuel')renderTrainingFuel();if(tab==='overview')renderTrainingOverview()}if(section==='review'){if(tab==='monthly')renderMonthlyReview()}if(section==='lists'){var addBtn=document.getElementById('lists-add-btn');if(tab==='watch'){renderWatchlist();if(addBtn)addBtn.setAttribute('onclick',"openModal('addWatchItem')")}else if(tab==='wish'){renderWishlist();if(addBtn)addBtn.setAttribute('onclick',"openModal('addWishItem')")}}}

function renderPage(page){if(page==='planner')renderPlanner();if(page==='dashboard')renderDashboard();if(page==='goals')renderGoals();if(page==='habits')renderHabits();if(page==='workout'){renderWorkout();if(typeof Chart==='undefined')ensureChartJs(renderWorkout)}if(page==='finance'){renderFinance('plan');if(typeof Chart==='undefined')ensureChartJs(function(){renderFinance('plan')})}if(page==='review')renderReview();if(page==='relationships')renderRelationships();if(page==='gratitude')renderGratitude();if(page==='lists'){renderWatchlist();renderWishlist()}if(page==='skincare')renderSkincare();if(page==='tasks')renderTasksArchive()}

var sidebarReturnFocus=null;
function setSidebarOpen(open){
  var sidebar=document.getElementById('sidebar'),overlay=document.getElementById('mobile-overlay');
  var topButton=document.getElementById('topnav-menu-btn'),moreButton=document.getElementById('mobile-command-more');
  var wasOpen=!!(sidebar&&sidebar.classList.contains('open'));
  if(open&&!wasOpen)sidebarReturnFocus=document.activeElement;
  if(sidebar){sidebar.classList.toggle('open',!!open);sidebar.setAttribute('aria-hidden',open?'false':'true');sidebar.inert=!open}
  if(overlay)overlay.classList.toggle('open',!!open);
  if(topButton)topButton.setAttribute('aria-expanded',open?'true':'false');
  if(moreButton)moreButton.setAttribute('aria-expanded',open?'true':'false');
  var shellTargets=[document.querySelector('.topnav'),document.querySelector('.main'),document.querySelector('.mobile-command-nav')];
  shellTargets.forEach(function(target){if(target)target.inert=!!open});
  document.body.classList.toggle('nav-open',!!open);
  if(open&&sidebar){setTimeout(function(){var first=sidebar.querySelector('.nav-item');if(first)first.focus()},0)}
  else if(wasOpen&&sidebarReturnFocus&&typeof sidebarReturnFocus.focus==='function'){sidebarReturnFocus.focus();sidebarReturnFocus=null}
}
function toggleSidebar(){var sidebar=document.getElementById('sidebar');setSidebarOpen(!(sidebar&&sidebar.classList.contains('open')))}
function closeSidebar(){setSidebarOpen(false)}
document.addEventListener('keydown',function(event){
  var sidebar=document.getElementById('sidebar');if(!sidebar||!sidebar.classList.contains('open'))return;
  if(event.key==='Escape'){event.preventDefault();closeSidebar();return}
  if(event.key!=='Tab')return;
  var focusable=Array.prototype.slice.call(sidebar.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
  if(!focusable.length){event.preventDefault();return}
  var first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});




// Top nav dropdown toggle
document.addEventListener('DOMContentLoaded',function(){
  var moreBtn=document.getElementById('topnav-more-btn');
  var dropdown=document.getElementById('topnav-dropdown');
  if(moreBtn&&dropdown){
    moreBtn.addEventListener('click',function(e){
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click',function(e){
      if(!dropdown.contains(e.target)&&e.target!==moreBtn){
        dropdown.classList.remove('open');
      }
    });
    // Close on nav click
    dropdown.querySelectorAll('.topnav-drop-item').forEach(function(item){
      item.addEventListener('click',function(){dropdown.classList.remove('open')});
    });
  }
});


// ── TOPNAV SLIDING PILL + SCROLL BLUR ──
function updateTopnavPill(){
  var pill=document.getElementById('topnav-pill');
  var active=document.querySelector('.topnav-link.active');
  if(!pill||!active)return;
  var rect=active.getBoundingClientRect();
  var parentRect=active.parentElement.getBoundingClientRect();
  pill.style.left=(rect.left-parentRect.left)+'px';
  pill.style.width=rect.width+'px';
  pill.classList.add('visible');
}
window.addEventListener('load',function(){setTimeout(updateTopnavPill,100)});
window.addEventListener('resize',updateTopnavPill);
// Re-run after every nav
var _origNav=window.nav;
window.nav=function(page){
  _origNav(page);
  setTimeout(updateTopnavPill,50);
};

// Scroll blur on topnav
window.addEventListener('scroll',function(){
  var topnav=document.getElementById('topnav');
  if(!topnav)return;
  if(window.scrollY>8)topnav.classList.add('scrolled');
  else topnav.classList.remove('scrolled');
},{passive:true});

// ── HERO DEPTH ──
document.addEventListener('mousemove',function(e){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var inner=document.getElementById('hero-inner');
  var hero=document.getElementById('hero');
  if(!inner||!hero)return;
  var rect=hero.getBoundingClientRect();
  if(rect.bottom<0||rect.top>window.innerHeight)return;
  var x=(e.clientX/window.innerWidth-0.5)*4;
  var y=(e.clientY/window.innerHeight-0.5)*3;
  inner.style.transform='translate('+x+'px,'+y+'px)';
});


// Repaint canvas charts after a theme change because Chart.js snapshots CSS
// colors at render time. Guard every renderer so the early bootstrap call is safe.
function refreshThemeCharts(){
  setTimeout(function(){
    var bodyTab=document.getElementById('workout-body');
    if(bodyTab&&bodyTab.classList.contains('active')&&typeof renderTrainingBody==='function')renderTrainingBody();
    var financePage=document.getElementById('page-finance');
    if(financePage&&financePage.classList.contains('active')&&typeof renderFinance==='function'){
      var active=financePage.querySelector('.sub-page.active');
      renderFinance(active&&active.id==='finance-progress'?'progress':'plan');
    }
    var dashboardPage=document.getElementById('page-dashboard');
    var insightsTab=document.getElementById('dash-tab-insights');
    if(dashboardPage&&dashboardPage.classList.contains('active')&&insightsTab&&insightsTab.classList.contains('active')&&typeof renderInsights==='function')renderInsights();
  },0);
}

// ── THEME TOGGLE ──
function applyTheme(){
  var pref=localStorage.getItem('lh_theme');  // 'light' | 'dark' | null (auto)
  if(pref==='dark')document.body.classList.add('night-mode');
  else if(pref==='light')document.body.classList.remove('night-mode');
  else{
    // Auto — based on time of day
    var h=new Date().getHours();
    if(h>=21||h<5)document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
  }
  var icon=document.getElementById('theme-toggle-icon');
  if(icon)icon.textContent=document.body.classList.contains('night-mode')?'☀️':'🌙';
  refreshThemeCharts();
}

function toggleTheme(){
  var isDark=document.body.classList.contains('night-mode');
  localStorage.setItem('lh_theme',isDark?'light':'dark');
  applyTheme();
}

// Apply on load
document.addEventListener('DOMContentLoaded',applyTheme);
applyTheme();


// ── EXPORT / IMPORT ──
// The persistence module owns schema validation, automatic rollback backups,
// safe download names, and revision-aware import queuing. These wrappers keep
// the existing HTML actions stable.
function exportLifeHubData(){
  try{return downloadLifeHubBackup()}
  catch(e){alert('Export failed: '+e.message)}
}

function importLifeHubData(){return importLifeHubBackup()}
