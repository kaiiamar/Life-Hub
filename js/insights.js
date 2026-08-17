// INSIGHTS
// ============================================================
// Chart.js resolves CSS colors only when a chart is created. Read the active
// Field Ledger tokens at render time so light/dark theme changes repaint cleanly.
function insightChartTheme(){
  var cs=getComputedStyle(document.body);
  function token(name,fallback){return (cs.getPropertyValue(name)||fallback).trim()}
  return {
    moss:token('--moss','#3F5A44'),
    mossDark:token('--moss-dark','#314836'),
    mossDim:token('--moss-dim','rgba(63,90,68,0.10)'),
    amber:token('--amber','#C98A2D'),
    amberDim:token('--amber-dim','rgba(201,138,45,0.12)'),
    clay:token('--clay','#B0563C'),
    sky:token('--sky','#6E93AE'),
    skyDim:token('--sky-dim','rgba(110,147,174,0.12)'),
    text:token('--text2','#626B62'),
    grid:token('--border2','rgba(63,90,68,0.08)'),
    card:token('--card','#FFFFFF'),
    mono:'Spline Sans Mono'
  };
}

function insightHabitStats(days,todayKey){
  return habitStatsForDays(STATE.habits||[],days,todayKey||localDateKey(new Date()));
}

// "Habits, Goals and Mood" — used by the pulse contributor line, which has to
// name the components that fed the displayed score. Requirement 2.4.
function insightJoinLabels(labels){
  var list=(labels||[]).slice();
  if(!list.length)return '';
  if(list.length===1)return String(list[0]);
  return list.slice(0,-1).join(', ')+' and '+list[list.length-1];
}

function renderInsights(){
var last30=Array.from({length:30},function(_,i){var d=new Date();d.setDate(d.getDate()-i);return localDateKey(d)});
var todayKey=localDateKey(new Date());

// Pulse check
var scores=[];
// Habits — only count check-ins that were actually available for each habit.
var habitStats=insightHabitStats(last30,todayKey);
var habitTotal=habitStats.total,habitDone=habitStats.done,habitPct=habitStats.pct;
scores.push({label:'Habits',pct:habitPct,color:'var(--moss)',tip:habitTotal?habitDone+'/'+habitTotal+' available check-ins logged':'No habit check-ins yet'});
// Goals — average progress across all goals
var goalAvg=STATE.goals.length?Math.round(STATE.goals.reduce(function(s,g){return s+goalPct(g)},0)/STATE.goals.length):0;
scores.push({label:'Goals',pct:goalAvg,color:'var(--amber)',tip:STATE.goals.length?'Average progress across '+STATE.goals.length+' goal'+(STATE.goals.length===1?'':'s'):'No goals added yet'});
// Training — non-rest sessions this local month vs a 3×/week reference pace.
var thisMonth=todayKey.slice(0,7);
var dayOfMonth=new Date().getDate();
var gymTarget=Math.max(1,Math.round((dayOfMonth/7)*3));
var gymCount=(STATE.workouts||[]).filter(function(w){return w.date&&w.date.startsWith(thisMonth)&&String(w.type||w.name||'').toLowerCase()!=='rest'&&String(w.name||'').toLowerCase()!=='rest day'}).length;
gymCount+=((((STATE.metrics||{}).run)||((STATE.metrics||{}).runs)||[]).filter(function(run){return run.date&&run.date.startsWith(thisMonth)}).length);
var gymPct=Math.min(100,Math.round(gymCount/gymTarget*100));
scores.push({label:'Training',pct:gymPct,color:'var(--clay)',tip:gymCount+' sessions this month · '+gymTarget+' at 3×/week pace'});
// Mood — average mood last 30 days (1-5 scale → %)
var moodDays=last30.filter(function(d){return (STATE.mood||{})[d]&&(STATE.mood||{})[d].mood});
var moodAvg=moodDays.length?Math.round(moodDays.reduce(function(s,d){return s+Number(STATE.mood[d].mood)},0)/moodDays.length*20):0;
scores.push({label:'Mood',pct:moodAvg,color:'var(--sky)',tip:moodDays.length?moodDays.length+' days logged':'Mood patterns will appear as you log'});
// Priorities — Focus_Tasks in the unified task store over the window, via the
// sole definition of the measure. The retired STATE.dailyPriorities is never
// read. Requirements 2.1, 2.2.
var focus=focusStats(last30);
scores.push({label:'Priorities',pct:focus.total>0?focus.pct:0,color:'var(--moss-dark)',empty:focus.total===0,tip:focus.total>0?focus.done+'/'+focus.total+' completed (30d)':'No focus tasks slated in the last 30 days'});

// Overall composite (weighted) — five dimensions, weights sum to 1. A component
// with nothing measured has no score to contribute, so it drops out of the
// average and the remaining weights are renormalised over their own sum: the
// displayed number stays a weighted average of the components that did measure
// something, rather than one dragged down by a zero that means "no data".
// Requirements 2.3, 2.4.
var weights=[0.24,0.18,0.18,0.18,0.22];
scores.forEach(function(sc,i){sc.weight=weights[i]});
var contributing=scores.filter(function(sc){return !sc.empty});
var weightSum=contributing.reduce(function(s,sc){return s+sc.weight},0);
var overall=weightSum>0?Math.round(contributing.reduce(function(s,sc){return s+sc.pct*sc.weight},0)/weightSum):0;
var overallLabel=overall>=80?'Well established':overall>=60?'Taking shape':overall>=40?'Building':'Starting point';
var overallColor=overall>=80?'var(--moss)':overall>=60?'var(--sky)':overall>=40?'var(--amber)':'var(--text2)';

// Render overall ring
var oRing=document.getElementById('pulse-overall-ring');
var oNum=document.getElementById('pulse-overall-num');
var oLabel=document.getElementById('pulse-overall-label');
if(oRing){var oc=2*Math.PI*46;oRing.setAttribute('stroke-dashoffset',oc-(overall/100)*oc);oRing.setAttribute('stroke',overallColor)}
if(oNum)oNum.textContent=overall;
if(oLabel){oLabel.textContent=overallLabel;oLabel.style.color=overallColor}

// Render horizontal bars — every component renders, including one in an empty
// state, which reads "—" rather than 0% so a missing measurement never looks
// like a measured zero. Requirement 2.5.
var barsEl=document.getElementById('pulse-bars');
if(barsEl)barsEl.innerHTML=scores.map(function(s){
return '<div data-pulse-bar="'+escapeHtml(s.label)+'"'+(s.empty?' data-pulse-empty="true"':'')+'>'
+'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><span style="font-size:12px;font-weight:600;color:var(--text)">'+escapeHtml(s.label)+'</span><span style="font-size:11px;color:var(--text3)">'+(s.empty?'—':s.pct+'%')+'</span></div>'
+'<div style="height:8px;background:var(--bg4);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+(s.empty?0:s.pct)+'%;background:'+s.color+';border-radius:4px;transition:width .6s ease"></div></div>'
+'<div style="font-size:10px;color:var(--text3);margin-top:2px">'+escapeHtml(s.tip)+'</div>'
+'</div>'
}).join('')
// The contributor line names exactly the components behind the displayed score,
// so an excluded component is visible in the composite rather than silent.
// Requirement 2.4.
+(contributing.length===scores.length?'':'<div id="pulse-contributors" data-pulse-contributors="'+escapeHtml(contributing.map(function(s){return s.label}).join(','))+'" style="font-size:11px;color:var(--text3);line-height:1.5;border-top:1px solid var(--border2);padding-top:8px">'
+(contributing.length?'Score from '+escapeHtml(insightJoinLabels(contributing.map(function(s){return s.label})))+'.':'No components have data for this window yet.')
+'</div>');

// Habit consistency chart (last 4 weeks)
renderInsightHabitChart(last30);

// Mood trend chart
renderInsightMoodChart();

// Smart insight cards
var cards=[];

// ── Week-vs-last-week deltas (item 9) ──
var thisWkStart=weekKey(new Date());
var thisWkDays=weekDays(thisWkStart);
var lastWkStartDate=new Date(thisWkStart);lastWkStartDate.setDate(lastWkStartDate.getDate()-7);
var lastWkStart=localDateKey(lastWkStartDate);
var lastWkDays=weekDays(lastWkStart);

// Habit completion delta, respecting each habit's actual cadence.
var thisWkHabit=insightHabitStats(thisWkDays.filter(function(day){return day<=todayKey}),todayKey);
var lastWkHabit=insightHabitStats(lastWkDays,todayKey);
var thisWkPct=thisWkHabit.pct;
var lastWkPct=lastWkHabit.pct;
if(thisWkHabit.total>0&&lastWkHabit.total>0){
  var delta=thisWkPct-lastWkPct;
  var arrow=delta>0?'↑':delta<0?'↓':'→';
  var tone=delta>0?'positive':'info';
  var deltaText=delta===0?'About the same as last week':(delta>0?'+'+delta:delta)+' percentage points from last week';
  cards.push(mkInsightCard('📈','Habits '+arrow+' '+thisWkPct+'%',deltaText,tone));
}

// Workouts delta
var thisWkWo=typeof dashboardTrainingCount==='function'?dashboardTrainingCount(thisWkDays):(STATE.workouts||[]).filter(function(w){return thisWkDays.indexOf(w.date)!==-1&&String(w.type||w.name||'').toLowerCase()!=='rest'}).length;
var lastWkWo=typeof dashboardTrainingCount==='function'?dashboardTrainingCount(lastWkDays):(STATE.workouts||[]).filter(function(w){return lastWkDays.indexOf(w.date)!==-1&&String(w.type||w.name||'').toLowerCase()!=='rest'}).length;
if(thisWkWo+lastWkWo>0){
  var woDelta=thisWkWo-lastWkWo;
  var woArrow=woDelta>0?'↑':woDelta<0?'↓':'→';
  var woTone=woDelta>0?'positive':'info';
  var woText=woDelta===0?'Same as last week':(woDelta>0?'+'+woDelta:woDelta)+' compared with last week';
  cards.push(mkInsightCard('🏋️','Sessions '+woArrow+' '+thisWkWo,woText,woTone));
}

// Mood delta
var thisWkMood=thisWkDays.filter(function(d){return d<=todayKey&&(STATE.mood||{})[d]&&(STATE.mood||{})[d].mood});
var lastWkMood=lastWkDays.filter(function(d){return (STATE.mood||{})[d]&&(STATE.mood||{})[d].mood});
if(thisWkMood.length>0&&lastWkMood.length>0){
  var thisAvg=thisWkMood.reduce(function(s,d){return s+Number((STATE.mood||{})[d].mood)},0)/thisWkMood.length;
  var lastAvg=lastWkMood.reduce(function(s,d){return s+Number((STATE.mood||{})[d].mood)},0)/lastWkMood.length;
  var moodDelta=Math.round((thisAvg-lastAvg)*10)/10;
  if(Math.abs(moodDelta)>=0.5){
    var moodArrow=moodDelta>0?'↑':'↓';
    var moodTone=moodDelta>0?'positive':'info';
    cards.push(mkInsightCard('🌈','Mood '+moodArrow+' '+thisAvg.toFixed(1),(moodDelta>0?'+'+moodDelta:moodDelta)+' from last week\'s '+lastAvg.toFixed(1),moodTone));
  }
}

var habitScores=(STATE.habits||[]).filter(function(h){return habitLifecycleStatus(h,todayKey)==='active'}).map(function(h){
  var stats=getHabitHistoricalConsistency(h,todayKey,4),trend=habitCompletedPeriodTrend(h,todayKey,4);
  return {name:h.name,pct:stats.pct,periods:stats.total,trend:trend};
}).filter(function(item){return item.periods>=3}).sort(function(a,b){return b.pct-a.pct});
if(habitScores.length){
  var best=habitScores[0],quietest=habitScores[habitScores.length-1];
  cards.push(mkInsightCard('🌿','Most settled rhythm',best.name+' · '+best.pct+'% across recent completed periods','positive'));
  if(quietest.pct<40)cards.push(mkInsightCard('🪴','A rhythm to support',quietest.name+' · '+quietest.pct+'% recently. A smaller version may fit more easily.','info'));
}
var goalsToRevisit=STATE.goals.filter(function(g){var p=goalPct(g);var dl=Math.ceil((new Date(g.deadline)-new Date())/86400000);return p<30&&dl<90&&dl>0});
if(goalsToRevisit.length)cards.push(mkInsightCard('🗓️','Goals to revisit',goalsToRevisit.map(function(g){return g.name}).join(', ')+' · target dates are within 90 days.','info'));
var establishedGoals=STATE.goals.filter(function(g){return goalPct(g)>=70});
if(establishedGoals.length)cards.push(mkInsightCard('✅','Goals taking shape',establishedGoals.map(function(g){return g.name}).join(', '),'positive'));
var totalDebt=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance)},0);
var inc=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0);
var exp=(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);
var leftover=inc-exp;
if(leftover>0&&totalDebt>0)cards.push(mkInsightCard('💳','Debt-free timeline','At '+fmtMoney(leftover)+'/month leftover, you could clear all debt in ~'+Math.ceil(totalDebt/leftover)+' months.','info'));
if(leftover<0)cards.push(mkInsightCard('🧮','Budget gap','Expenses are '+fmtMoney(Math.abs(leftover))+'/month above income. Review the plan when useful.','info'));
var thisWeekWo=typeof dashboardTrainingCount==='function'?dashboardTrainingCount(weekDays(weekKey(new Date())).filter(function(day){return day<=todayKey})):(STATE.workouts||[]).filter(function(w){return w.date>=weekKey(new Date())&&String(w.type||w.name||'').toLowerCase()!=='rest'}).length;
if(thisWeekWo===0)cards.push(mkInsightCard('🏋️','Training log is open','No sessions logged this week yet.','info'));
else if(thisWeekWo>=3)cards.push(mkInsightCard('💪','Training this week',thisWeekWo+' sessions logged.','positive'));
var grid=document.getElementById('insights-grid');
if(grid)grid.innerHTML=cards.length?cards.join(''):'<div class="card" style="text-align:center;padding:40px;grid-column:1/-1"><div style="font-size:36px;margin-bottom:12px">🌿</div><div style="font-size:14px;color:var(--text2)">Patterns will appear as you log.</div></div>';

renderDebtCalc();renderCountdowns();renderInsightReviewTrends();renderMoodCorrelations();renderInsightsNarrative()}

function renderInsightReviewTrends(){
var reviews=STATE.reviews&&STATE.reviews.monthly?STATE.reviews.monthly:{};
var keys=Object.keys(reviews).sort().slice(-6);
var chartEl=document.getElementById('insightReviewChart');
var summaryEl=document.getElementById('review-trend-summary');
var snapEl=document.getElementById('review-latest-snapshot');

if(!keys.length){
if(chartEl){var ctx=chartEl.getContext('2d');ctx.clearRect(0,0,chartEl.width,chartEl.height)}
if(summaryEl)summaryEl.innerHTML='<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px 0">Complete a monthly review to see trends here</div>';
if(snapEl)snapEl.innerHTML='<div style="font-size:13px;color:var(--text3);text-align:center;padding:20px 0">No reviews yet</div>';
return}

var theme=insightChartTheme();
var labels=keys.map(function(k){var p=k.split('-');return new Date(Number(p[0]),Number(p[1])-1).toLocaleDateString('en-GB',{month:'short'})});
var colors={overall:theme.moss,health:theme.mossDark,finance:theme.amber,career:theme.sky,mindset:theme.clay,social:theme.text};
var datasets=RATING_CATS.map(function(cat){return {label:cat.label,data:keys.map(function(k){return reviews[k].ratings?reviews[k].ratings[cat.id]||0:0}),borderColor:colors[cat.id]||theme.moss,backgroundColor:'transparent',tension:0.3,pointRadius:4,pointBackgroundColor:colors[cat.id]||theme.moss,pointBorderColor:theme.card,pointBorderWidth:1.5,borderWidth:2}});

if(window._reviewChart){window._reviewChart.destroy()}
if(chartEl&&typeof Chart==='undefined')ensureChartJs(renderInsightReviewTrends);
if(chartEl&&typeof Chart!=='undefined')window._reviewChart=new Chart(chartEl,{type:'line',data:{labels:labels,datasets:datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10,family:theme.mono},color:theme.text}}},scales:{x:{ticks:{color:theme.text,font:{size:10,family:theme.mono}},grid:{color:theme.grid}},y:{min:0,max:10,ticks:{color:theme.text,font:{size:10,family:theme.mono},stepSize:2},grid:{color:theme.grid}}}}});

var latest=reviews[keys[keys.length-1]];
if(summaryEl&&keys.length>=2){var prev=reviews[keys[keys.length-2]];var latestAvg=0,prevAvg=0;if(latest.ratings){var lv=Object.values(latest.ratings);latestAvg=lv.reduce(function(s,v){return s+v},0)/lv.length}if(prev.ratings){var pv=Object.values(prev.ratings);prevAvg=pv.reduce(function(s,v){return s+v},0)/pv.length}var diff=Math.round((latestAvg-prevAvg)*10)/10;var arrow=diff>0?'↑':diff<0?'↓':'→';var col=diff>0?'var(--moss)':diff<0?'var(--sky)':'var(--text3)';summaryEl.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center"><span style="font-family:var(--mono);color:'+col+';font-weight:600">'+arrow+' '+(diff>0?'+':'')+diff+'</span> vs previous month</div>'}

if(snapEl&&latest){var avgR=0;if(latest.ratings){var vals=Object.values(latest.ratings);avgR=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0}var rCol=avgR>=7?'var(--moss)':avgR>=5?'var(--amber)':'var(--sky)';snapEl.innerHTML='<div style="text-align:center;padding:8px 0"><div style="font-family:var(--mono);font-size:36px;font-weight:700;color:'+rCol+'">'+avgR+'<span style="font-size:14px;color:var(--text3)">/10</span></div><div style="font-size:11px;color:var(--text3);margin-bottom:12px">Average rating</div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">'+RATING_CATS.map(function(cat){var v=latest.ratings?latest.ratings[cat.id]:0;var c=v>=7?'var(--moss)':v>=5?'var(--amber)':'var(--sky)';return '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:8px 4px;text-align:center"><div style="font-size:9px;color:var(--text3)">'+cat.emoji+'</div><div style="font-family:var(--mono);font-size:16px;font-weight:700;color:'+c+'">'+v+'</div><div style="font-size:9px;color:var(--text3)">'+cat.label+'</div></div>'}).join('')+'</div>'+(latest.wins?'<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px"><div style="font-size:10px;font-weight:600;color:var(--moss);margin-bottom:3px">🏆 Wins</div><div style="font-size:12px;color:var(--text2);line-height:1.5;white-space:pre-line;max-height:80px;overflow:hidden">'+latest.wins+'</div></div>':'')+'<div style="margin-top:10px;text-align:center"><button onclick="nav(\'review\')" style="background:none;border:none;color:var(--moss);cursor:pointer;font-weight:600;font-size:12px;font-family:var(--sans)">View all reviews →</button></div>'}}

function renderInsightHabitChart(){
var todayKey=localDateKey(new Date());
var currentStart=new Date(weekKey(new Date())+'T12:00:00');
var weeks=[];
for(var offset=3;offset>=0;offset--){var start=new Date(currentStart);start.setDate(start.getDate()-offset*7);var days=weekDays(localDateKey(start));if(offset===0)days=days.filter(function(day){return day<=todayKey});weeks.push(days)}
var labels=['3 weeks ago','2 weeks ago','Last week','This week'];
var data=weeks.map(function(days){return insightHabitStats(days,todayKey).pct});
var summary=document.getElementById('insight-habit-summary');
if(summary)summary.textContent='This week is '+data[data.length-1]+'%, compared with '+data[data.length-2]+'% last week. Only available check-ins are counted.';
var ctx=document.getElementById('insightHabitChart');
if(!ctx)return;
if(typeof Chart==='undefined'){ensureChartJs(renderInsightHabitChart);return}
if(ctx._insChart)ctx._insChart.destroy();
var theme=insightChartTheme();
var fills=data.map(function(v){return v>=70?theme.mossDim:v>=40?theme.amberDim:theme.skyDim});
var strokes=data.map(function(v){return v>=70?theme.moss:v>=40?theme.amber:theme.sky});
ctx._insChart=new Chart(ctx,{type:'bar',data:{labels:labels,datasets:[{data:data,backgroundColor:fills,borderColor:strokes,borderWidth:1.5,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:theme.text,font:{size:11,family:theme.mono}},grid:{display:false}},y:{max:100,ticks:{color:theme.text,font:{size:10,family:theme.mono},callback:function(v){return v+'%'}},grid:{color:theme.grid}}}}})}

function renderInsightMoodChart(){
var days=Array.from({length:14},function(_,i){var d=new Date();d.setDate(d.getDate()-13+i);return localDateKey(d)});
var moodData=days.map(function(d){var m=(STATE.mood||{})[d];return m&&m.mood?Number(m.mood):null});
var energyData=days.map(function(d){var m=(STATE.mood||{})[d];return m&&m.energy?Number(m.energy):null});
var moodLogged=moodData.filter(function(value){return value!=null});
var energyLogged=energyData.filter(function(value){return value!=null});
var summary=document.getElementById('insight-mood-summary');
if(summary){
  var moodAvg=moodLogged.length?Math.round(moodLogged.reduce(function(sum,value){return sum+value},0)/moodLogged.length*10)/10:null;
  var energyAvg=energyLogged.length?Math.round(energyLogged.reduce(function(sum,value){return sum+value},0)/energyLogged.length*10)/10:null;
  summary.textContent=moodAvg==null?'No mood entries in the last 14 days.':'Average mood '+moodAvg+'/5 across '+moodLogged.length+' entries'+(energyAvg==null?'.':'; average energy '+energyAvg+'/5.');
}
var ctx=document.getElementById('insightMoodChart');
if(!ctx)return;
if(typeof Chart==='undefined'){ensureChartJs(renderInsightMoodChart);return}
if(ctx._insChart)ctx._insChart.destroy();
var theme=insightChartTheme();
ctx._insChart=new Chart(ctx,{type:'line',data:{labels:days.map(function(d){return new Date(d).getDate()+'/'+(new Date(d).getMonth()+1)}),datasets:[{label:'Mood',data:moodData,borderColor:theme.moss,backgroundColor:theme.mossDim,tension:.4,pointRadius:4,pointBackgroundColor:theme.moss,pointBorderColor:theme.card,pointBorderWidth:1.5,spanGaps:true},{label:'Energy',data:energyData,borderColor:theme.sky,backgroundColor:theme.skyDim,tension:.4,pointRadius:4,pointBackgroundColor:theme.sky,pointBorderColor:theme.card,pointBorderWidth:1.5,spanGaps:true,borderDash:[4,3]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:theme.text,font:{size:11,family:theme.mono},boxWidth:12,padding:12}}},scales:{x:{ticks:{color:theme.text,font:{size:10,family:theme.mono}},grid:{color:theme.grid}},y:{min:1,max:5,ticks:{color:theme.text,font:{size:10,family:theme.mono},stepSize:1,callback:function(v){var em=['','😞','😐','🙂','😊','🤩'];return em[v]||v}},grid:{color:theme.grid}}}}})}


function mkInsightCard(emoji,title,body,type){var colors={positive:{bg:'var(--moss-dim)',border:'var(--moss)',col:'var(--moss-dark)'},warning:{bg:'var(--amber-dim)',border:'var(--amber)',col:'var(--amber)'},danger:{bg:'var(--clay-dim)',border:'var(--clay)',col:'var(--clay)'},info:{bg:'var(--sky-dim)',border:'var(--sky)',col:'var(--text)'}};var c=colors[type]||colors.info;return '<div style="background:'+c.bg+';border:1px solid '+c.border+';border-radius:var(--radius);padding:16px 20px;cursor:default"><div style="display:flex;align-items:flex-start;gap:12px"><span style="font-size:22px;flex-shrink:0">'+emoji+'</span><div><div style="font-size:14px;font-weight:600;color:'+c.col+';margin-bottom:4px">'+title+'</div><div style="font-size:13px;color:var(--text2);line-height:1.5">'+body+'</div></div></div></div>'}
function renderDebtCalc(){
var el=document.getElementById('debt-calc-auto');if(!el)return;
var debts=(STATE.debts||[]).filter(function(d){return Number(d.balance)>0});
var totalPaid=(STATE.debtPayments||[]).reduce(function(s,p){return s+Number(p.amount)},0);
if(!debts.length){el.innerHTML='<div style="text-align:center;padding:24px"><div style="font-size:28px;margin-bottom:8px">🎉</div><div style="font-size:14px;font-weight:600;color:var(--moss)">Debt free!</div>'+(totalPaid>0?'<div style="font-family:var(--mono);font-size:12px;color:var(--text3);margin-top:4px">'+fmtMoney(totalPaid)+' paid off total</div>':'')+'</div>';return}
var totalDebt=debts.reduce(function(s,d){return s+Number(d.balance)},0);
var grandTotal=totalDebt+totalPaid;
var paidPct=grandTotal>0?Math.round(totalPaid/grandTotal*100):0;
var surplus=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0)-(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);
var totalTarget=debts.reduce(function(s,d){return s+Number(d.monthlyTarget||0)},0);
var payment=totalTarget>0?totalTarget:Math.max(0,surplus);
var months=payment>0?Math.ceil(totalDebt/payment):0;
var freeDate=new Date();freeDate.setMonth(freeDate.getMonth()+months);
var freeDateStr=months>0?freeDate.toLocaleDateString('en-GB',{month:'short',year:'numeric'}):'—';
var h='<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px"><div style="text-align:center;flex-shrink:0">';
var r=36,circ=2*Math.PI*r;
h+='<div style="position:relative;width:80px;height:80px"><svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="'+r+'" fill="none" stroke="var(--bg4)" stroke-width="6"/><circle cx="40" cy="40" r="'+r+'" fill="none" stroke="var(--moss)" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+(circ-circ*Math.min(paidPct,100)/100)+'" transform="rotate(-90 40 40)" style="transition:stroke-dashoffset .6s"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--text)">'+paidPct+'%</div><div style="font-size:8px;color:var(--text3)">paid</div></div></div></div>';
h+='<div style="flex:1"><div style="font-size:20px;font-family:var(--mono);font-weight:600;color:var(--ink)">'+fmtMoney(totalDebt)+'</div><div style="font-size:11px;color:var(--text3)">remaining across '+debts.length+' debt'+(debts.length>1?'s':'')+'</div>';
if(totalPaid>0)h+='<div style="font-family:var(--mono);font-size:11px;color:var(--moss);font-weight:600;margin-top:2px">'+fmtMoney(totalPaid)+' paid off</div>';
h+='</div></div>';
h+='<div style="height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:'+paidPct+'%;background:var(--moss);border-radius:4px;transition:width .4s"></div></div>';
if(payment>0){h+='<div style="background:var(--moss-dim);border:1px solid var(--moss);border-radius:var(--radius-sm);padding:10px;text-align:center"><div style="font-size:10px;color:var(--moss-dark);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Debt-free by</div><div style="font-family:var(--mono);font-size:18px;font-weight:600;color:var(--moss-dark)">'+freeDateStr+'</div><div style="font-size:10px;color:var(--text2)">~'+months+' months at '+fmtMoney(payment)+'/mo</div></div>';}
else{h+='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px 0">Set monthly targets in <button class="btn btn-sm btn-ghost" onclick="nav(\'finance\')" style="font-size:11px;padding:2px 6px">Finance → Debts</button> to see your timeline</div>';}
el.innerHTML=h}
function renderCountdowns(){
var el=document.getElementById('countdown-grid');if(!el)return;
var goals=STATE.goals.filter(function(g){return g.deadline}).map(function(g){var totalDays=Math.ceil((new Date(g.deadline)-new Date(g.deadline.slice(0,4)+'-01-01'))/86400000+180);var daysLeft=Math.ceil((new Date(g.deadline)-new Date())/86400000);var elapsed=Math.max(0,totalDays-daysLeft);var pct=totalDays>0?Math.min(100,Math.round(elapsed/totalDays*100)):0;return {name:g.name,days:daysLeft,deadline:g.deadline,pct:pct}}).filter(function(g){return g.days>0}).sort(function(a,b){return a.days-b.days});
el.innerHTML=goals.length?'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">'+goals.slice(0,8).map(function(g){var timing=g.days<30?'var(--amber)':g.days<90?'var(--sky)':'var(--moss)';var r=28,c=2*Math.PI*r,offset=c-(g.pct/100)*c;return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;text-align:center"><div style="position:relative;width:64px;height:64px;margin:0 auto 8px"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="'+r+'" fill="none" stroke="var(--bg4)" stroke-width="4"/><circle cx="32" cy="32" r="'+r+'" fill="none" stroke="'+timing+'" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset .6s ease"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:18px;font-weight:600;color:'+timing+'">'+g.days+'</div></div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">days left</div><div style="font-size:11px;font-weight:600;line-height:1.3">'+g.name+'</div><div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:3px">'+fmtDate(g.deadline)+'</div></div>'}).join('')+'</div>':'<div style="font-size:13px;color:var(--text3);padding:12px 0">Set deadlines on your goals to see countdowns</div>'}



// ── MOOD BUCKET MEANS ──
// The mood-shift arithmetic and its activity buckets were closures inside
// renderMoodCorrelations, so nothing outside that render function could call
// them. They are lifted here unchanged and renderMoodCorrelations delegates, so
// the Numbers_Surface reuses the same means rather than restating them.
// Requirement 12.9.

// Every date carrying a logged mood, unordered.
function moodLoggedDates(){
  var mood=STATE.mood||{};
  return Object.keys(mood).filter(function(d){return mood[d]&&mood[d].mood});
}

// The activity buckets the correlations card uses, as date-key lookups: gym
// days, run days, days a task was completed, days gratitude was logged, and
// days the water goal was hit. Read exactly as before — runs come from
// `metrics.run`, task days from `doneAt` on the unified task store. Hydrated
// days are measured against the current daily target (the same fallback of 8
// every water reader uses); past days are judged by today's target since
// target history isn't tracked.
function moodActivityDateSets(){
  var gymDates={},runDates={},taskDates={},gratitudeDates={},hydratedDates={};
  (STATE.workouts||[]).forEach(function(w){if(w.date&&(w.type||'').toLowerCase()!=='rest')gymDates[w.date]=true});
  (((STATE.metrics||{}).run)||[]).forEach(function(r){if(r.date)runDates[r.date]=true});
  (STATE.tasks||[]).forEach(function(t){if(t.done&&t.doneAt)taskDates[t.doneAt]=true});
  (STATE.gratitude||[]).forEach(function(g){if(g.date)gratitudeDates[g.date]=true});
  var waterTarget=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  Object.keys(STATE.water||{}).forEach(function(d){if(Number(STATE.water[d])>=waterTarget)hydratedDates[d]=true});
  return {gym:gymDates,run:runDates,task:taskDates,gratitude:gratitudeDates,hydrated:hydratedDates};
}

// Mean logged mood across the days in `dateSet`, or null below two days — the
// same floor the correlations card has always applied, so a single day never
// reads as a pattern. `dates` defaults to every mood-logged date.
function moodBucketMean(dateSet,dates){
  var mood=STATE.mood||{};
  var all=dates||moodLoggedDates();
  var vals=all.filter(function(d){return dateSet&&dateSet[d]}).map(function(d){return Number(mood[d].mood)});
  return vals.length>=2?{mean:vals.reduce(function(s,v){return s+v},0)/vals.length,n:vals.length}:null;
}

// ── MOOD CORRELATIONS ──
function renderMoodCorrelations(){
  var el=document.getElementById('mood-correlations');
  if(!el)return;
  var mood=STATE.mood||{};
  var allDates=moodLoggedDates();
  if(allDates.length<5){
    el.innerHTML='<div class="empty" style="padding:20px 0">Log your mood for at least 5 days to see patterns.</div>';
    return;
  }

  // Build buckets — moodActivityDateSets() holds the sole definition, shared with
  // the Numbers_Surface. Days where a task was completed come from the unified
  // tasks list.
  var _buckets=moodActivityDateSets();
  var gymDates=_buckets.gym,runDates=_buckets.run,taskDates=_buckets.task,gratitudeDates=_buckets.gratitude;

  // Overall mean
  var allMoods=allDates.map(function(d){return Number(mood[d].mood)});
  var overallMean=allMoods.reduce(function(s,v){return s+v},0)/allMoods.length;

  // Delegates to the lifted calculator so there is one definition of the mean.
  function bucketMean(dateSet){
    return moodBucketMean(dateSet,allDates);
  }

  var buckets=[
    {label:'gym days',emoji:'💪',data:bucketMean(gymDates),color:'var(--accent-dark)'},
    {label:'run days',emoji:'🏃',data:bucketMean(runDates),color:'var(--blue)'},
    {label:'days you completed a task',emoji:'✅',data:bucketMean(taskDates),color:'var(--mint)'},
    {label:'days you logged gratitude',emoji:'🙏',data:bucketMean(gratitudeDates),color:'var(--gold)'},
    {label:'days you hit your water goal',emoji:'💧',data:bucketMean(_buckets.hydrated),color:'var(--sky)'}
  ].filter(function(b){return b.data});

  // Energy bucket
  var energyDates=allDates.filter(function(d){return mood[d].energy});
  if(energyDates.length>=5){
    var highEnergy={};
    energyDates.forEach(function(d){if(Number(mood[d].energy)>=4)highEnergy[d]=true});
    var he=bucketMean(highEnergy);
    if(he)buckets.push({label:'high-energy days',emoji:'⚡',data:he,color:'var(--purple)'});
  }

  // Sleep bucket — days with 7+ hours
  var wellRested={};
  allDates.forEach(function(d){if(mood[d].sleep&&Number(mood[d].sleep)>=7)wellRested[d]=true});
  var wr=bucketMean(wellRested);
  if(wr)buckets.push({label:'7+ hrs sleep',emoji:'😴',data:wr,color:'var(--teal)'});

  if(!buckets.length){
    el.innerHTML='<div class="empty" style="padding:20px 0">Keep logging — patterns will emerge once there is more data.</div>';
    return;
  }

  // Sort by delta (biggest positive first)
  buckets.sort(function(a,b){return (b.data.mean-overallMean)-(a.data.mean-overallMean)});

  el.innerHTML='<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Your average mood is <strong>'+overallMean.toFixed(1)+'/5</strong>. Here is how it shifts:</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">'
    +buckets.map(function(b){
      var delta=b.data.mean-overallMean;
      var sign=delta>=0?'+':'';
      var deltaStr=sign+delta.toFixed(1);
      var color=delta>0.3?'var(--mint)':delta<-0.3?'var(--accent-dark)':'var(--text2)';
      return '<div class="stat-card" style="padding:14px 16px">'
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
          +'<span style="font-size:20px">'+b.emoji+'</span>'
          +'<span style="font-size:12px;font-weight:500;color:var(--text2)">'+b.label+'</span>'
        +'</div>'
        +'<div style="font-family:var(--serif);font-size:24px;font-weight:500;color:'+color+';letter-spacing:-0.02em">'+deltaStr+'<span style="font-size:14px;color:var(--text3);font-weight:400"> mood</span></div>'
        +'<div style="font-size:10px;color:var(--text3);margin-top:2px">across '+b.data.n+' days</div>'
      +'</div>';
    }).join('')
    +'</div>';
}


// ── AI NARRATIVE — "this week's story" ──
// Computes a compact week-vs-last-week stat summary client-side, then asks the
// backend (Claude Haiku) for a 2-3 sentence narrative. Cached per-day in
// localStorage so we don't spend tokens on every Insights visit.
function renderInsightsNarrative(){
  var card=document.getElementById('insights-narrative-card');
  var el=document.getElementById('insights-narrative');
  if(!card||!el)return;
  if(typeof NOTIF_API==='undefined'||!NOTIF_API)return;

  var todayKey=localDateKey(new Date());
  var cacheKey='lh_narrative_'+todayKey;
  // Serve cached narrative for today if present
  try{
    var cached=localStorage.getItem(cacheKey);
    if(cached){card.style.display='';el.textContent=cached;return}
  }catch(e){}

  var stats=computeWeekStats();
  // Need a baseline of data to bother
  if(stats.habitsThisWeek==null&&stats.sessionsThisWeek==null&&stats.avgMoodThisWeek==null){
    card.style.display='none';return;
  }

  card.style.display='';
  el.innerHTML='<span class="insights-narrative-loading">Reading your week…</span>';

  lifeHubApiFetch(NOTIF_API+'/api/ai-narrative',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({stats:stats})
  }).then(function(r){return r.json()}).then(function(data){
    if(data&&data.narrative){
      el.textContent=data.narrative;
      try{localStorage.setItem(cacheKey,data.narrative)}catch(e){}
    }else{
      card.style.display='none';
    }
  }).catch(function(){card.style.display='none'});
}

function computeWeekStats(){
  var todayKey=localDateKey(new Date());
  var thisWk=habitWeekDays(new Date());
  var lastWkStartD=habitAddDays(habitWeekStart(new Date()),-7);
  var lastWk=habitWeekDays(lastWkStartD);

  function habitPct(days){
    var stats=habitStatsForDays(STATE.habits||[],days,todayKey);
    return stats.total>0?stats.pct:null;
  }
  function sessions(days){
    return (STATE.workouts||[]).filter(function(w){return days.indexOf(w.date)!==-1&&(w.type||'').toLowerCase()!=='rest'}).length
      +(((STATE.metrics||{}).run)||[]).filter(function(r){return days.indexOf(r.date)!==-1}).length;
  }
  function avgMood(days){
    var vals=days.filter(function(d){return d<=todayKey&&(STATE.mood||{})[d]&&(STATE.mood||{})[d].mood}).map(function(d){return Number(STATE.mood[d].mood)});
    return vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:null;
  }
  function avgSleep(days){
    var vals=days.filter(function(d){return (STATE.mood||{})[d]&&(STATE.mood||{})[d].sleep}).map(function(d){return Number(STATE.mood[d].sleep)});
    return vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:null;
  }

  var tasksDone=(STATE.tasks||[]).filter(function(t){return t.done&&t.doneAt&&thisWk.indexOf(t.doneAt)!==-1}).length;

  // Upcoming training event / nearest goal deadline
  var upcoming=null;
  var soonGoal=(STATE.goals||[]).filter(function(g){return !g.done&&g.deadline&&g.deadline>=todayKey}).sort(function(a,b){return a.deadline.localeCompare(b.deadline)})[0];
  if(soonGoal){
    var dl=Math.ceil((new Date(soonGoal.deadline)-new Date())/86400000);
    if(dl<=30)upcoming=soonGoal.name+' in '+dl+' days';
  }

  return {
    habitsThisWeek:habitPct(thisWk),
    habitsLastWeek:habitPct(lastWk),
    sessionsThisWeek:sessions(thisWk),
    sessionsLastWeek:sessions(lastWk),
    avgMoodThisWeek:avgMood(thisWk),
    avgMoodLastWeek:avgMood(lastWk),
    avgSleepThisWeek:avgSleep(thisWk),
    avgSleepLastWeek:avgSleep(lastWk),
    tasksDoneThisWeek:tasksDone,
    upcomingEvent:upcoming
  };
}

// ── NUMBERS SURFACE — DATA LAYER ──
// Components §H and Design Decision 6. `numbersSignals()` assembles the signal
// list; `classifyNumbersSignal()` groups it. Every measure here arrives from an
// existing calculator — insightHabitStats, getHabitHistoricalConsistency,
// habitCompletedPeriodTrend, dashboardTrainingCount, dashboardDelta,
// dashboardMoodStats, goalPct, moodBucketMean, focusStats, waterStats,
// gratitudeStats and financeTotals — so no measure has a second implementation
// here to drift from its owner. Requirements 12.2, 12.3, 12.4, 12.9.
//
// Every signal is {domain, label, value, unit, window, current, previous,
// target} plus two presentation extras, `detail` and `comparison`. `value` is the
// figure to state, `unit` is appended to it directly (so it carries its own
// leading space where one is wanted), and `window` names the comparison period,
// which is what makes Requirement 12.3 satisfiable by the renderer. `current`,
// `previous` and `target` are the three numbers the classification rule reads;
// any of them is null when the domain holds nothing for that side.
//
// Labels, units and detail text state a measured quantity and its period and
// nothing else: no grade letters, no ranking words, no evaluative adjectives.
// Requirement 12.7. Text is raw here — user-supplied habit and goal names are
// escaped by the renderer, not by this layer.

function _numbersPlural(n,word,plural){return Number(n)===1?word:(plural||word+'s')}

// Both sides of a week-over-week pair are the same length: a Tuesday count is
// compared with the first two days of last week, never with a full seven, so
// mid-week is never stated as a shortfall. Both weeks start on Monday, via
// habitWeekStart.
function numbersWindows(){
  var now=new Date();
  var todayKey=localDateKey(now);
  var thisWeek=habitWeekDays(now).filter(function(d){return d<=todayKey});
  var lastWeekFull=habitWeekDays(habitAddDays(habitWeekStart(now),-7));
  var lastWeek=lastWeekFull.slice(0,thisWeek.length||1);
  var last7=Array.from({length:7},function(_,i){var d=new Date(now);d.setDate(d.getDate()-i);return localDateKey(d)});
  return {
    now:now,
    todayKey:todayKey,
    thisWeek:thisWeek,
    lastWeek:lastWeek,
    lastWeekFull:lastWeekFull,
    last7:last7,
    weekWindow:'this week so far, against the same days last week'
  };
}

function numbersSignal(s){
  return {
    domain:s.domain,
    label:s.label,
    value:s.value==null?null:s.value,
    unit:s.unit||'',
    window:s.window||'',
    current:s.current==null?null:s.current,
    previous:s.previous==null?null:s.previous,
    target:s.target==null?null:s.target,
    detail:s.detail||'',
    comparison:s.comparison||''
  };
}

// Design Decision 6's rule, which is total and has no thresholds and no bands:
// a target beats a previous period, ties resolve to Strength, and a signal with
// neither comparison available is an empty state named by its domain. A signal
// with no measured `current` is likewise an empty state — there is nothing to
// compare. Requirement 12.2.
function classifyNumbersSignal(signal){
  if(!signal)return 'empty';
  var current=Number(signal.current);
  if(signal.current==null||!isFinite(current))return 'empty';
  if(signal.target!=null&&isFinite(Number(signal.target)))return current>=Number(signal.target)?'strength':'room';
  if(signal.previous!=null&&isFinite(Number(signal.previous)))return current>=Number(signal.previous)?'strength':'room';
  return 'empty';
}

function numbersSignals(){
  var w=numbersWindows();
  var out=[];

  // Habit check-ins — insightHabitStats, which is habitStatsForDays.
  var habitsNow=insightHabitStats(w.thisWeek,w.todayKey);
  var habitsPrev=insightHabitStats(w.lastWeek,w.todayKey);
  var habitsNowPct=habitsNow.total>0?habitsNow.pct:null;
  var habitsPrevPct=habitsPrev.total>0?habitsPrev.pct:null;
  out.push(numbersSignal({
    domain:'Habits',
    label:'Habit check-ins logged',
    value:habitsNowPct,
    unit:'%',
    window:w.weekWindow,
    current:habitsNowPct,
    previous:habitsPrevPct,
    target:null,
    detail:habitsNow.total>0?habitsNow.done+' of '+habitsNow.total+' available check-ins':'No habit check-ins were available this week',
    comparison:dashboardDelta(habitsNowPct,habitsPrevPct,'%')
  }));

  // Per-habit rhythm and its direction — getHabitHistoricalConsistency for the
  // rhythm, habitCompletedPeriodTrend for the direction. When the trend has
  // enough history its own recent and earlier windows are the comparison pair;
  // otherwise the rhythm is stated with no comparison, which the rule sends to
  // the empty-state group.
  (STATE.habits||[]).forEach(function(h){
    if(!h)return;
    var consistency=getHabitHistoricalConsistency(h,w.now);
    var trend=habitCompletedPeriodTrend(h,w.now);
    var unit=consistency.unit||'period';
    if(trend.available){
      out.push(numbersSignal({
        domain:'Habits',
        label:(h.name||'Habit')+' rhythm',
        value:trend.recent.pct,
        unit:'%',
        window:'the last '+trend.recent.total+' '+_numbersPlural(trend.recent.total,unit)+', against the '+trend.earlier.total+' before',
        current:trend.recent.pct,
        previous:trend.earlier.pct,
        target:null,
        detail:trend.recent.done+' of '+trend.recent.total+' '+_numbersPlural(trend.recent.total,unit)+' met'
      }));
      return;
    }
    out.push(numbersSignal({
      domain:'Habits',
      label:(h.name||'Habit')+' rhythm',
      value:consistency.total>0?consistency.pct:null,
      unit:'%',
      window:consistency.total>0?'the last '+consistency.total+' '+_numbersPlural(consistency.total,unit):'no completed '+_numbersPlural(2,unit)+' yet',
      current:consistency.total>0?consistency.pct:null,
      previous:null,
      target:null,
      detail:consistency.total>0?consistency.done+' of '+consistency.total+' '+_numbersPlural(consistency.total,unit)+' met':trend.label
    }));
  });

  // Training sessions — dashboardTrainingCount, comparison wording from
  // dashboardDelta.
  var trainingNow=dashboardTrainingCount(w.thisWeek);
  var trainingPrev=dashboardTrainingCount(w.lastWeek);
  var trainingLogged=trainingNow>0||trainingPrev>0;
  out.push(numbersSignal({
    domain:'Training',
    label:'Training sessions logged',
    value:trainingLogged?trainingNow:null,
    unit:' '+_numbersPlural(trainingNow,'session'),
    window:w.weekWindow,
    current:trainingLogged?trainingNow:null,
    previous:trainingLogged?trainingPrev:null,
    target:null,
    detail:trainingLogged?trainingPrev+' '+_numbersPlural(trainingPrev,'session')+' in the same days last week':'No training logged in either week',
    comparison:dashboardDelta(trainingLogged?trainingNow:null,trainingLogged?trainingPrev:null,'')
  }));

  // Focus_Task completion — focusStats, the single definition in §A.
  var focusNow=focusStats(w.thisWeek);
  var focusPrev=focusStats(w.lastWeek);
  var focusLogged=focusNow.total>0||focusPrev.total>0;
  out.push(numbersSignal({
    domain:'Focus tasks',
    label:'Focus tasks completed',
    value:focusLogged?focusNow.done:null,
    unit:' '+_numbersPlural(focusNow.done,'task'),
    window:w.weekWindow,
    current:focusLogged?focusNow.done:null,
    previous:focusPrev.total>0?focusPrev.done:null,
    target:null,
    detail:focusLogged?focusNow.done+' of '+focusNow.total+' slated this week':'No focus slate set in either week',
    comparison:dashboardDelta(focusLogged?focusNow.done:null,focusPrev.total>0?focusPrev.done:null,'')
  }));

  // Mood average and check-in count — both from dashboardMoodStats.
  var moodNow=dashboardMoodStats(w.thisWeek);
  var moodPrev=dashboardMoodStats(w.lastWeek);
  out.push(numbersSignal({
    domain:'Mood',
    label:'Average mood',
    value:moodNow.mood,
    unit:' out of 5',
    window:w.weekWindow,
    current:moodNow.mood,
    previous:moodPrev.mood,
    target:null,
    detail:moodNow.logged>0?'across '+moodNow.logged+' '+_numbersPlural(moodNow.logged,'check-in'):'No mood logged this week',
    comparison:dashboardDelta(moodNow.mood,moodPrev.mood,'')
  }));
  var moodLogged=moodNow.logged>0||moodPrev.logged>0;
  out.push(numbersSignal({
    domain:'Mood',
    label:'Mood check-ins logged',
    value:moodLogged?moodNow.logged:null,
    unit:' '+_numbersPlural(moodNow.logged,'check-in'),
    window:w.weekWindow,
    current:moodLogged?moodNow.logged:null,
    previous:moodLogged?moodPrev.logged:null,
    target:null,
    detail:moodLogged?moodPrev.logged+' in the same days last week':'No mood logged in either week',
    comparison:dashboardDelta(moodLogged?moodNow.logged:null,moodLogged?moodPrev.logged:null,'')
  }));

  // Goal progress — goalPct. The target is the one the user set, so the
  // comparison is against 100% of it and nothing else.
  var goals=(STATE.goals||[]).filter(function(g){return g&&!g.done});
  goals.forEach(function(g){
    var pct=goalPct(g);
    out.push(numbersSignal({
      domain:'Goals',
      label:(g.name||'Goal')+' progress',
      value:pct,
      unit:'%',
      window:'against the target you set',
      current:pct,
      previous:null,
      target:100,
      detail:g.target?'target '+g.target+(g.unit?' '+g.unit:''):'no target set'
    }));
  });
  if(!goals.length){
    out.push(numbersSignal({
      domain:'Goals',
      label:'Goal progress',
      value:null,
      unit:'%',
      window:'no active goals to compare',
      current:null,
      previous:null,
      target:null,
      detail:'No active goals'
    }));
  }

  // Mood shift by activity bucket — the bucketMean means, now callable as
  // moodBucketMean, compared against the same overall mean the correlations card
  // states.
  var moodDates=moodLoggedDates();
  var moodAllSet={};
  moodDates.forEach(function(d){moodAllSet[d]=true});
  var overall=moodBucketMean(moodAllSet,moodDates);
  var overallMean=overall?Math.round(overall.mean*10)/10:null;
  var activitySets=moodActivityDateSets();
  [
    {label:'gym days',set:activitySets.gym},
    {label:'run days',set:activitySets.run},
    {label:'days you completed a task',set:activitySets.task},
    {label:'days you logged gratitude',set:activitySets.gratitude}
  ].forEach(function(b){
    var bucket=moodBucketMean(b.set,moodDates);
    var mean=bucket?Math.round(bucket.mean*10)/10:null;
    out.push(numbersSignal({
      domain:'Mood',
      label:'Mood on '+b.label,
      value:mean,
      unit:' out of 5',
      window:overallMean!=null?'against your overall average of '+overallMean+' out of 5':'no overall average to compare against yet',
      current:mean,
      previous:overallMean,
      target:null,
      detail:bucket?'across '+bucket.n+' '+_numbersPlural(bucket.n,'day'):'Fewer than two logged days in this bucket'
    }));
  });

  // Water logging — waterStats, the single definition in §A. The target is the
  // daily one from the user's water settings.
  var waterToday=waterStats([w.todayKey]);
  var waterWeek=waterStats(w.last7);
  var waterLogged=waterToday.glasses>0||waterWeek.loggedDays>0;
  out.push(numbersSignal({
    domain:'Water',
    label:'Water logged today',
    value:waterLogged?waterToday.glasses:null,
    unit:' '+_numbersPlural(waterToday.glasses,'glass','glasses'),
    window:'today, against the daily target you set of '+waterToday.target,
    current:waterLogged?waterToday.glasses:null,
    previous:null,
    target:waterLogged?waterToday.target:null,
    detail:waterLogged?waterWeek.loggedDays+' of the last 7 days logged':'No water logged in the last 7 days'
  }));

  // Gratitude entries — gratitudeStats, the single definition in §A.
  var gratitudeNow=gratitudeStats(w.thisWeek);
  var gratitudePrev=gratitudeStats(w.lastWeek);
  var gratitudeLogged=gratitudeNow.entries>0||gratitudePrev.entries>0;
  out.push(numbersSignal({
    domain:'Gratitude',
    label:'Days gratitude was logged',
    value:gratitudeLogged?gratitudeNow.entryDays:null,
    unit:' '+_numbersPlural(gratitudeNow.entryDays,'day'),
    window:w.weekWindow,
    current:gratitudeLogged?gratitudeNow.entryDays:null,
    previous:gratitudeLogged?gratitudePrev.entryDays:null,
    target:null,
    detail:gratitudeLogged?gratitudeNow.entries+' '+_numbersPlural(gratitudeNow.entries,'entry','entries')+' this week':'No gratitude logged in either week',
    comparison:dashboardDelta(gratitudeLogged?gratitudeNow.entryDays:null,gratitudeLogged?gratitudePrev.entryDays:null,'')
  }));

  // Finance totals — financeTotals, the extracted single definition. Income is
  // the measured figure and logged expenses are the line it is compared with, so
  // both numbers come from the same call and neither is invented.
  var finance=financeTotals();
  var financeLogged=finance.income>0||finance.expenses>0;
  out.push(numbersSignal({
    domain:'Finance',
    label:'Income against expenses',
    // A money figure is stated as money, so `value` carries the formatted string
    // while `current` keeps the number the rule compares.
    value:financeLogged?fmtMoney(finance.income):null,
    unit:'',
    window:'your current budget, against '+fmtMoney(finance.expenses)+' of logged expenses',
    current:financeLogged?finance.income:null,
    previous:null,
    target:financeLogged?finance.expenses:null,
    // fmtMoney reports magnitudes, so a negative margin is named rather than
    // shown as a positive figure.
    detail:!financeLogged?'No income or expenses logged':(finance.margin>=0?'margin of '+fmtMoney(finance.margin)+', savings balance of '+fmtMoney(finance.savings):fmtMoney(finance.margin)+' more in logged expenses than income, savings balance of '+fmtMoney(finance.savings))
  }));

  return out;
}

// ── NUMBERS SURFACE — RHYTHM STATEMENTS ──
// Requirement 12.5: at least one statement giving a count and a window. Each one
// reuses an existing calculator over the same trailing 7 days — dayHadActivity
// for the days that carry an Activity_Event, waterStats for water, focusStats for
// the focus slate — so the rhythm block never introduces a measure of its own.
//
// The activity statement is unconditional, which is what makes "at least one"
// structural rather than a matter of how much data happens to exist: it always
// has a count (0 is a measured count, stated as one) and always names its window.
// The water and focus statements only appear once their domain has something in
// the window, so an untouched domain is named by the empty-state group instead of
// reading as a run of zeros here.
function rhythmStatements(){
  var w=numbersWindows();
  var out=[];

  var activeDays=w.last7.filter(function(d){return dayHadActivity(d)}).length;
  out.push('Something logged on '+activeDays+' of the last 7 days');

  var water=waterStats(w.last7);
  if(water.loggedDays>0)out.push('Water logged on '+water.loggedDays+' of the last 7 days');

  var focus=focusStats(w.last7);
  if(focus.total>0)out.push(focus.done+' of '+focus.total+' focus '+_numbersPlural(focus.total,'task')+' completed in the last 7 days');

  var gratitude=gratitudeStats(w.last7);
  if(gratitude.entryDays>0)out.push('Gratitude logged on '+gratitude.entryDays+' of the last 7 days');

  return out;
}

// ── NUMBERS SURFACE — RENDERER ──
// Requirements 12.1, 12.2, 12.3, 12.6, 12.7, 12.8, 12.10. Presentation only:
// every figure arrives from numbersSignals() and every grouping decision from
// classifyNumbersSignal(), so this function decides nothing about the numbers.
//
// Strength and Room are separate groups under their own labels, "Where you're
// doing well" and "Where there's room" — labels that describe the measure rather
// than the person (12.2). Each entry states its value and the period it was
// measured over and stops there: no grade letter, no ranking, no adjective
// (12.3, 12.6, 12.7). Domains with nothing to compare are named once each in
// their own group rather than shown as zero scores (12.8). Colour comes only
// from the Neutral_Palette — --text2, --text3, --mint, --sky, --gold, --accent —
// and never from --red (12.10).
//
// Every interpolated string passes through escapeHtml: labels and detail text
// carry user-supplied habit and goal names straight from STATE (Requirement 26.3).

function _numbersValueText(sig){
  if(!sig||sig.value==null)return '';
  return escapeHtml(String(sig.value))+escapeHtml(String(sig.unit||''));
}

// One entry: the label, the measured value, then the comparison period and any
// supporting detail on a second line. `color` is the palette token the value is
// stated in, chosen by the group rather than by any threshold.
function _numbersEntry(sig,group,color){
  var value=_numbersValueText(sig);
  var meta=[];
  if(sig.window)meta.push(escapeHtml(String(sig.window)));
  if(sig.detail)meta.push(escapeHtml(String(sig.detail)));
  if(sig.comparison)meta.push(escapeHtml(String(sig.comparison)));
  return '<div class="numbers-entry" data-numbers-entry="'+escapeHtml(String(sig.label||''))+'" data-numbers-group="'+escapeHtml(group)+'" data-numbers-domain="'+escapeHtml(String(sig.domain||''))+'" style="padding:9px 0">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">'
      +'<span style="font-size:13px;font-weight:600;color:var(--text2)">'+escapeHtml(String(sig.label||''))+'</span>'
      +(value?'<span class="stat-num" data-numbers-value="1" style="font-size:14px;font-weight:600;white-space:nowrap;color:'+color+'">'+value+'</span>':'')
    +'</div>'
    +(meta.length?'<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-top:2px">'+meta.join(' · ')+'</div>':'')
    +'</div>';
}

// A labelled group. An empty group keeps its label and says plainly that nothing
// is measured in it yet, so the two halves of 12.2 are always both present.
function _numbersGroup(group,label,entriesHtml,emptyLine){
  return '<section class="card" data-numbers-section="'+escapeHtml(group)+'" style="margin-bottom:16px" aria-labelledby="numbers-head-'+escapeHtml(group)+'">'
    +'<div class="card-label" id="numbers-head-'+escapeHtml(group)+'">'+escapeHtml(label)+'</div>'
    +(entriesHtml||'<div style="font-size:12px;color:var(--text3);line-height:1.5">'+escapeHtml(emptyLine)+'</div>')
    +'</section>';
}

function renderNumbersSurface(){
  var el=document.getElementById('numbers-surface');
  if(!el)return;

  var signals=(typeof numbersSignals==='function'?numbersSignals():[])||[];
  var strength=[],room=[],emptyOrder=[],emptyByDomain={};
  signals.forEach(function(sig){
    var group=classifyNumbersSignal(sig);
    if(group==='strength'){strength.push(sig);return}
    if(group==='room'){room.push(sig);return}
    // Each domain with nothing to compare is named exactly once, with the
    // measures still waiting listed under it. Requirement 12.8.
    var domain=String(sig.domain||'Other');
    if(!emptyByDomain[domain]){emptyByDomain[domain]=[];emptyOrder.push(domain)}
    emptyByDomain[domain].push(sig);
  });

  var html='<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-bottom:12px">Every figure below states what was measured and the period it was measured over.</div>';

  html+=_numbersGroup('strength','Where you\'re doing well',
    strength.map(function(sig){return _numbersEntry(sig,'strength','var(--mint)')}).join(''),
    'Nothing in this group has a comparison yet.');

  html+=_numbersGroup('room','Where there\'s room',
    room.map(function(sig){return _numbersEntry(sig,'room','var(--sky)')}).join(''),
    'Nothing in this group has a comparison yet.');

  // The rhythm block — counts and windows, always at least one. Requirement 12.5.
  var rhythm=(typeof rhythmStatements==='function'?rhythmStatements():[])||[];
  html+=_numbersGroup('rhythm','Your rhythm',
    rhythm.map(function(line){
      return '<div data-numbers-rhythm="1" style="font-size:13px;color:var(--text2);line-height:1.6;padding:3px 0">'+escapeHtml(String(line))+'</div>';
    }).join(''),
    'No rhythm statement available.');

  if(emptyOrder.length){
    html+=_numbersGroup('empty','Not measured in this period',
      emptyOrder.map(function(domain){
        var labels=emptyByDomain[domain].map(function(sig){return String(sig.label||'')}).filter(function(s){return s}).join(', ');
        return '<div data-numbers-empty-domain="'+escapeHtml(domain)+'" style="padding:7px 0">'
          +'<div style="font-size:13px;font-weight:600;color:var(--text2)">'+escapeHtml(domain)+'</div>'
          +'<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-top:2px">No data for this comparison period'+(labels?': '+escapeHtml(labels):'')+'</div>'
          +'</div>';
      }).join(''),
      '');
  }

  el.innerHTML=html;
}
