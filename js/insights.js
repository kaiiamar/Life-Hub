// INSIGHTS
// ============================================================
function renderInsights(){
var last30=Array.from({length:30},function(_,i){var d=new Date();d.setDate(d.getDate()-i);return localDateKey(d)});
var todayKey=localDateKey(new Date());

// Pulse check
var scores=[];
// Habits — % completed last 30 days
var habitTotal=0,habitDone=0;
STATE.habits.forEach(function(h){last30.forEach(function(d){habitTotal++;if(h.logs[d])habitDone++})});
var habitPct=habitTotal>0?Math.round(habitDone/habitTotal*100):0;
scores.push({label:'Habits',pct:habitPct,color:'var(--accent)',tip:habitPct>=70?'Solid consistency':'Try to hit at least 70%'});
// Goals — average progress across all goals
var goalAvg=STATE.goals.length?Math.round(STATE.goals.reduce(function(s,g){return s+goalPct(g)},0)/STATE.goals.length):0;
scores.push({label:'Goals',pct:goalAvg,color:'var(--gold)',tip:goalAvg>=50?'Making good progress':'Keep pushing forward'});
// Gym — sessions this month vs 3x/week target
var thisMonth=new Date().toISOString().slice(0,7);
var daysInMonth=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
var dayOfMonth=new Date().getDate();
var gymTarget=Math.round((dayOfMonth/7)*3);
var gymCount=(STATE.workouts||[]).filter(function(w){return w.date&&w.date.startsWith(thisMonth)}).length;
var gymPct=gymTarget>0?Math.min(100,Math.round(gymCount/gymTarget*100)):0;
scores.push({label:'Gym',pct:gymPct,color:'var(--mauve)',tip:gymCount+'/'+gymTarget+' sessions (3×/week pace)'});
// Mood — average mood last 30 days (1-5 scale → %)
var moodDays=last30.filter(function(d){return (STATE.mood||{})[d]&&(STATE.mood||{})[d].mood});
var moodAvg=moodDays.length?Math.round(moodDays.reduce(function(s,d){return s+Number(STATE.mood[d].mood)},0)/moodDays.length*20):0;
scores.push({label:'Mood',pct:moodAvg,color:'var(--peach)',tip:moodDays.length?moodDays.length+' days logged':'Log your mood daily for better insights'});
// Roadmap — current month progress only
var curRmMonth=RM_MONTHS[rmGetCurrentMonthIdx?rmGetCurrentMonthIdx():0];
var curRmProg=curRmMonth?rmGetProgress(curRmMonth):{done:0,total:0};
var rmPct=curRmProg.total>0?Math.round(curRmProg.done/curRmProg.total*100):0;
scores.push({label:'Roadmap',pct:rmPct,color:'var(--teal)',tip:curRmProg.done+'/'+curRmProg.total+' items this month'});

// Overall composite (weighted)
var weights=[0.25,0.2,0.15,0.2,0.2];
var overall=Math.round(scores.reduce(function(s,sc,i){return s+sc.pct*weights[i]},0));
var overallLabel=overall>=80?'Crushing it':overall>=60?'On track':overall>=40?'Room to grow':'Needs attention';
var overallColor=overall>=80?'var(--mint)':overall>=60?'var(--accent)':overall>=40?'var(--gold)':'var(--peach)';

// Render overall ring
var oRing=document.getElementById('pulse-overall-ring');
var oNum=document.getElementById('pulse-overall-num');
var oLabel=document.getElementById('pulse-overall-label');
if(oRing){var oc=2*Math.PI*46;oRing.setAttribute('stroke-dashoffset',oc-(overall/100)*oc);oRing.setAttribute('stroke',overallColor)}
if(oNum)oNum.textContent=overall;
if(oLabel){oLabel.textContent=overallLabel;oLabel.style.color=overallColor}

// Render horizontal bars
var barsEl=document.getElementById('pulse-bars');
if(barsEl)barsEl.innerHTML=scores.map(function(s){
return '<div>'
+'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><span style="font-size:12px;font-weight:600;color:var(--text)">'+s.label+'</span><span style="font-size:11px;color:var(--text3)">'+s.pct+'%</span></div>'
+'<div style="height:8px;background:var(--bg4);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+s.pct+'%;background:'+s.color+';border-radius:4px;transition:width .6s ease"></div></div>'
+'<div style="font-size:10px;color:var(--text3);margin-top:2px">'+s.tip+'</div>'
+'</div>'
}).join('');

// Habit consistency chart (last 4 weeks)
renderInsightHabitChart(last30);

// Mood trend chart
renderInsightMoodChart();

// Smart insight cards
var cards=[];
var habitScores=STATE.habits.map(function(h){var done=last30.filter(function(d){return h.logs[d]}).length;return {name:h.name,pct:Math.round(done/30*100)}}).sort(function(a,b){return b.pct-a.pct});
if(habitScores.length){var best=habitScores[0];var worst=habitScores[habitScores.length-1];cards.push(mkInsightCard('🏆','Strongest habit',best.name+' — '+best.pct+'% in the last 30 days','positive'));if(worst.pct<40)cards.push(mkInsightCard('⚠️','Needs attention',worst.name+' is only '+worst.pct+'% this month. What small change could help?','warning'))}
var atRisk=STATE.goals.filter(function(g){var p=goalPct(g);var dl=Math.ceil((new Date(g.deadline)-new Date())/86400000);return p<30&&dl<90&&dl>0});
if(atRisk.length)cards.push(mkInsightCard('🚨','Goals at risk',atRisk.map(function(g){return g.name}).join(', ')+' — under 90 days with under 30% progress.','danger'));
var onTrack=STATE.goals.filter(function(g){return goalPct(g)>=70});
if(onTrack.length)cards.push(mkInsightCard('✅','Goals on track',onTrack.map(function(g){return g.name}).join(', '),'positive'));
var totalDebt=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance)},0);
var inc=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0);
var exp=(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);
var leftover=inc-exp;
if(leftover>0&&totalDebt>0)cards.push(mkInsightCard('💳','Debt-free timeline','At '+fmtMoney(leftover)+'/month leftover, you could clear all debt in ~'+Math.ceil(totalDebt/leftover)+' months.','info'));
if(leftover<0)cards.push(mkInsightCard('⚠️','Overspending','Expenses exceed income by '+fmtMoney(Math.abs(leftover))+'/month. Review your budget.','danger'));
var thisWeekWo=(STATE.workouts||[]).filter(function(w){return w.date>=weekKey(new Date())}).length;
if(thisWeekWo===0)cards.push(mkInsightCard('🏋️','No gym sessions yet this week','You still have time — go smash it!','warning'));
else if(thisWeekWo>=3)cards.push(mkInsightCard('💪','Strong gym week!',thisWeekWo+' sessions this week. Consistency is key!','positive'));
cards.push(mkInsightCard('🗓️','Roadmap progress',rmPct+'% of your overall plan completed. <button onclick="nav(\'roadmap\')" style="background:none;border:none;color:var(--teal);cursor:pointer;font-weight:600;font-size:13px;font-family:var(--sans)">View Roadmap →</button>',rmPct>=50?'positive':'info'));
var grid=document.getElementById('insights-grid');
if(grid)grid.innerHTML=cards.length?cards.join(''):'<div class="card" style="text-align:center;padding:40px;grid-column:1/-1"><div style="font-size:36px;margin-bottom:12px">🌿</div><div style="font-size:14px;color:var(--text2)">Start logging to unlock insights!</div></div>';

renderDebtCalc();renderCountdowns();renderInsightReviewTrends()}

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

var labels=keys.map(function(k){var p=k.split('-');return new Date(Number(p[0]),Number(p[1])-1).toLocaleDateString('en-GB',{month:'short'})});
var datasets=RATING_CATS.map(function(cat){var colors={overall:'#a0522d',health:'#6b9e7a',finance:'#c9973a',career:'#5f9ea0',mindset:'#8b5cf6',social:'#ec4899'};return {label:cat.label,data:keys.map(function(k){return reviews[k].ratings?reviews[k].ratings[cat.id]||0:0}),borderColor:colors[cat.id]||'var(--accent)',backgroundColor:'transparent',tension:0.3,pointRadius:4,borderWidth:2}});

if(window._reviewChart){window._reviewChart.destroy()}
if(chartEl)window._reviewChart=new Chart(chartEl,{type:'line',data:{labels:labels,datasets:datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10},color:'#b89870'}}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{min:0,max:10,ticks:{color:'#b89870',font:{size:10},stepSize:2}}}}});

var latest=reviews[keys[keys.length-1]];
if(summaryEl&&keys.length>=2){var prev=reviews[keys[keys.length-2]];var latestAvg=0,prevAvg=0;if(latest.ratings){var lv=Object.values(latest.ratings);latestAvg=lv.reduce(function(s,v){return s+v},0)/lv.length}if(prev.ratings){var pv=Object.values(prev.ratings);prevAvg=pv.reduce(function(s,v){return s+v},0)/pv.length}var diff=Math.round((latestAvg-prevAvg)*10)/10;var arrow=diff>0?'↑':diff<0?'↓':'→';var col=diff>0?'var(--mint)':diff<0?'var(--peach)':'var(--text3)';summaryEl.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center"><span style="color:'+col+';font-weight:600">'+arrow+' '+(diff>0?'+':'')+diff+'</span> vs previous month</div>'}

if(snapEl&&latest){var avgR=0;if(latest.ratings){var vals=Object.values(latest.ratings);avgR=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0}var rCol=avgR>=7?'var(--mint)':avgR>=5?'var(--gold)':'var(--peach)';snapEl.innerHTML='<div style="text-align:center;padding:8px 0"><div style="font-family:var(--serif);font-size:36px;font-weight:700;color:'+rCol+'">'+avgR+'<span style="font-size:14px;color:var(--text3)">/10</span></div><div style="font-size:11px;color:var(--text3);margin-bottom:12px">Average rating</div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">'+RATING_CATS.map(function(cat){var v=latest.ratings?latest.ratings[cat.id]:0;var c=v>=7?'var(--mint)':v>=5?'var(--gold)':'var(--peach)';return '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:8px 4px;text-align:center"><div style="font-size:9px;color:var(--text3)">'+cat.emoji+'</div><div style="font-size:16px;font-weight:700;color:'+c+'">'+v+'</div><div style="font-size:9px;color:var(--text3)">'+cat.label+'</div></div>'}).join('')+'</div>'+(latest.wins?'<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px"><div style="font-size:10px;font-weight:600;color:var(--accent);margin-bottom:3px">🏆 Wins</div><div style="font-size:12px;color:var(--text2);line-height:1.5;white-space:pre-line;max-height:80px;overflow:hidden">'+latest.wins+'</div></div>':'')+'<div style="margin-top:10px;text-align:center"><button onclick="nav(\'review\')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600;font-size:12px;font-family:var(--sans)">View all reviews →</button></div>'}}

function renderInsightHabitChart(last30){
var weeks=[[],[],[],[]];
for(var w=0;w<4;w++){for(var d=0;d<7;d++){weeks[w].push(last30[w*7+d])}}
var labels=['This week','1 week ago','2 weeks ago','3 weeks ago'].reverse();
weeks.reverse();
var data=weeks.map(function(wk){var total=0,done=0;STATE.habits.forEach(function(h){wk.forEach(function(d){if(d){total++;if(h.logs[d])done++}})});return total>0?Math.round(done/total*100):0});
var ctx=document.getElementById('insightHabitChart');
if(!ctx)return;
if(ctx._insChart)ctx._insChart.destroy();
ctx._insChart=new Chart(ctx,{type:'bar',data:{labels:labels,datasets:[{data:data,backgroundColor:data.map(function(v){return v>=70?'rgba(107,158,122,0.6)':v>=40?'rgba(201,151,58,0.6)':'rgba(192,57,43,0.4)'}),borderColor:data.map(function(v){return v>=70?'#6b9e7a':v>=40?'#c9973a':'#c0392b'}),borderWidth:1.5,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:11}}},y:{max:100,ticks:{color:'#b89870',font:{size:10},callback:function(v){return v+'%'}}}}}})}

function renderInsightMoodChart(){
var days=Array.from({length:14},function(_,i){var d=new Date();d.setDate(d.getDate()-13+i);return localDateKey(d)});
var moodData=days.map(function(d){var m=(STATE.mood||{})[d];return m&&m.mood?Number(m.mood):null});
var energyData=days.map(function(d){var m=(STATE.mood||{})[d];return m&&m.energy?Number(m.energy):null});
var ctx=document.getElementById('insightMoodChart');
if(!ctx)return;
if(ctx._insChart)ctx._insChart.destroy();
ctx._insChart=new Chart(ctx,{type:'line',data:{labels:days.map(function(d){return new Date(d).getDate()+'/'+(new Date(d).getMonth()+1)}),datasets:[{label:'Mood',data:moodData,borderColor:'#d4845a',backgroundColor:'rgba(212,132,90,0.1)',tension:.4,pointRadius:4,pointBackgroundColor:'#d4845a',spanGaps:true},{label:'Energy',data:energyData,borderColor:'#5f9ea0',backgroundColor:'rgba(95,158,160,0.1)',tension:.4,pointRadius:4,pointBackgroundColor:'#5f9ea0',spanGaps:true,borderDash:[4,3]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8a6545',font:{size:11},boxWidth:12,padding:12}}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{min:1,max:5,ticks:{color:'#b89870',font:{size:10},stepSize:1,callback:function(v){var em=['','😞','😐','🙂','😊','🤩'];return em[v]||v}}}}}})}


function mkInsightCard(emoji,title,body,type){var colors={positive:{bg:'#f0f7f1',border:'#b8d8b8',col:'#2d6a35'},warning:{bg:'#fdf6e8',border:'#e8c87a',col:'#8a6000'},danger:{bg:'#fdf0ee',border:'#e8b0a8',col:'#8a2a1e'},info:{bg:'#f0f4f8',border:'#b8cce0',col:'#2a4a6a'}};var c=colors[type]||colors.info;return '<div style="background:'+c.bg+';border:1.5px solid '+c.border+';border-radius:var(--radius);padding:16px 20px;transition:transform .15s,box-shadow .15s;cursor:default" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 16px rgba(0,0,0,0.08)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\'"><div style="display:flex;align-items:flex-start;gap:12px"><span style="font-size:22px;flex-shrink:0">'+emoji+'</span><div><div style="font-size:14px;font-weight:600;color:'+c.col+';margin-bottom:4px">'+title+'</div><div style="font-size:13px;color:var(--text2);line-height:1.5">'+body+'</div></div></div></div>'}
function renderDebtCalc(){
var el=document.getElementById('debt-calc-auto');if(!el)return;
var debts=(STATE.debts||[]).filter(function(d){return Number(d.balance)>0});
var totalPaid=(STATE.debtPayments||[]).reduce(function(s,p){return s+Number(p.amount)},0);
if(!debts.length){el.innerHTML='<div style="text-align:center;padding:24px"><div style="font-size:28px;margin-bottom:8px">🎉</div><div style="font-size:14px;font-weight:600;color:var(--mint)">Debt free!</div>'+(totalPaid>0?'<div style="font-size:12px;color:var(--text3);margin-top:4px">'+fmtMoney(totalPaid)+' paid off total</div>':'')+'</div>';return}
var totalDebt=debts.reduce(function(s,d){return s+Number(d.balance)},0);
var grandTotal=totalDebt+totalPaid;
var paidPct=grandTotal>0?Math.round(totalPaid/grandTotal*100):0;
var surplus=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0)-(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);
var totalTarget=debts.reduce(function(s,d){return s+Number(d.monthlyTarget||0)},0);
var payment=totalTarget>0?totalTarget:Math.max(0,surplus);
var months=payment>0?Math.ceil(totalDebt/payment):0;
var freeDate=new Date();freeDate.setMonth(freeDate.getMonth()+months);
var freeDateStr=months>0?freeDate.toLocaleDateString('en-GB',{month:'short',year:'numeric'}):'—';
/* Compact insight layout */
var h='<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px"><div style="text-align:center;flex-shrink:0">';
var r=36,circ=2*Math.PI*r;
h+='<div style="position:relative;width:80px;height:80px"><svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="'+r+'" fill="none" stroke="var(--bg4)" stroke-width="6"/><circle cx="40" cy="40" r="'+r+'" fill="none" stroke="var(--mint)" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+(circ-circ*Math.min(paidPct,100)/100)+'" transform="rotate(-90 40 40)" style="transition:stroke-dashoffset .6s"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-family:var(--serif);font-size:14px;font-weight:700;color:var(--text)">'+paidPct+'%</div><div style="font-size:8px;color:var(--text3)">paid</div></div></div></div>';
h+='<div style="flex:1"><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--red)">'+fmtMoney(totalDebt)+'</div><div style="font-size:11px;color:var(--text3)">remaining across '+debts.length+' debt'+(debts.length>1?'s':'')+'</div>';
if(totalPaid>0)h+='<div style="font-size:11px;color:var(--mint);font-weight:600;margin-top:2px">'+fmtMoney(totalPaid)+' paid off</div>';
h+='</div></div>';
/* Progress bar */
h+='<div style="height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:'+paidPct+'%;background:var(--mint);border-radius:4px;transition:width .4s"></div></div>';
/* Debt-free estimate */
if(payment>0){h+='<div style="background:linear-gradient(135deg,#f0fdf4,#e8f5e9);border:1px solid #b8d8b8;border-radius:var(--radius-sm);padding:10px;text-align:center"><div style="font-size:10px;color:#2d6a35;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Debt-free by</div><div style="font-family:var(--serif);font-size:18px;font-weight:600;color:#2d6a35">'+freeDateStr+'</div><div style="font-size:10px;color:var(--text2)">~'+months+' months at '+fmtMoney(payment)+'/mo</div></div>';}
else{h+='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px 0">Set monthly targets in <button class="btn btn-sm btn-ghost" onclick="nav(\'finance\')" style="font-size:11px;padding:2px 6px">Finance → Debts</button> to see your timeline</div>';}
el.innerHTML=h}
function renderDebtPayoffPlanner(){}
function renderDebtPaymentHistory(){}
function setDebtMonthlyTarget(debtId,val){var debt=(STATE.debts||[]).find(function(d){return d.id===debtId});if(!debt)return;debt.monthlyTarget=Number(val)||0;saveState()}
function renderCountdowns(){var el=document.getElementById('countdown-grid');if(!el)return;var goals=STATE.goals.filter(function(g){return g.deadline}).map(function(g){var totalDays=Math.ceil((new Date(g.deadline)-new Date(g.deadline.slice(0,4)+'-01-01'))/86400000+180);var daysLeft=Math.ceil((new Date(g.deadline)-new Date())/86400000);var elapsed=Math.max(0,totalDays-daysLeft);var pct=totalDays>0?Math.min(100,Math.round(elapsed/totalDays*100)):0;return {name:g.name,days:daysLeft,deadline:g.deadline,pct:pct}}).filter(function(g){return g.days>0}).sort(function(a,b){return a.days-b.days});el.innerHTML=goals.length?'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">'+goals.slice(0,8).map(function(g){var urgency=g.days<30?'#c0392b':g.days<90?'#c9973a':'#6b9e7a';var r=28,c=2*Math.PI*r,offset=c-(g.pct/100)*c;return '<div style="background:var(--bg3);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px;text-align:center;transition:transform .15s;cursor:default" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'"><div style="position:relative;width:64px;height:64px;margin:0 auto 8px"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="'+r+'" fill="none" stroke="var(--bg4)" stroke-width="4"/><circle cx="32" cy="32" r="'+r+'" fill="none" stroke="'+urgency+'" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset .6s ease"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:18px;font-weight:600;color:'+urgency+'">'+g.days+'</div></div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">days left</div><div style="font-size:11px;font-weight:600;line-height:1.3">'+g.name+'</div><div style="font-size:10px;color:var(--text3);margin-top:3px">'+fmtDate(g.deadline)+'</div></div>'}).join('')+'</div>':'<div style="font-size:13px;color:var(--text3);padding:12px 0">Set deadlines on your goals to see countdowns</div>'}

