// WORKOUTS
// ============================================================
var activeSessionId=null;
function renderWorkout(){var sessions=STATE.workouts||[];var thisWeek=sessions.filter(function(w){return w.date>=weekKey(new Date())});var totalSets=sessions.reduce(function(s,w){return s+(w.exercises||[]).reduce(function(a,e){return a+(e.sets||[]).length},0)},0);var weekVol=thisWeek.reduce(function(s,w){return s+(w.exercises||[]).reduce(function(a,e){return a+(e.sets||[]).filter(function(st){return st.logged}).reduce(function(b,st){return b+(Number(st.reps)||0)*(Number(st.weight)||0)},0)},0)},0);var runs=((STATE.metrics||{}).run||[]);var thisMonthRuns=runs.filter(function(r){return r.date&&r.date.startsWith(new Date().toISOString().slice(0,7))});var totalKm=thisMonthRuns.reduce(function(s,r){return s+Number(r.distance||0)},0);var wsEl=document.getElementById('workout-stats');if(wsEl)wsEl.innerHTML='<div class="card" style="border-top:3px solid var(--accent)"><div class="card-label">This week</div><div class="stat-big">'+thisWeek.length+'</div><div class="stat-sub">gym sessions</div></div><div class="card" style="border-top:3px solid var(--gold)"><div class="card-label">Week volume</div><div class="stat-big">'+weekVol.toLocaleString()+'</div><div class="stat-sub">kg lifted</div></div><div class="card" style="border-top:3px solid var(--mauve)"><div class="card-label">Total sessions</div><div class="stat-big">'+sessions.length+'</div><div class="stat-sub">all time · '+totalSets+' sets</div></div><div class="card" style="border-top:3px solid var(--teal)"><div class="card-label">Runs this month</div><div class="stat-big">'+thisMonthRuns.length+'</div><div class="stat-sub">'+totalKm.toFixed(1)+' km</div></div>';var activeSess=activeSessionId?sessions.find(function(w){return w.id===activeSessionId}):null;var banEl=document.getElementById('active-session-banner');if(banEl)banEl.innerHTML=activeSess?'<div style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:var(--radius);padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:13px;font-weight:500;color:var(--accent)">Session in progress</div><div style="font-size:12px;color:var(--text2)">'+activeSess.name+'</div></div><button class="btn btn-accent btn-sm" onclick="openModal(\'viewSession\',\''+activeSess.id+'\')">Continue &#8594;</button></div>':'';var recent=sessions.slice(-5).reverse();var rEl=document.getElementById('recent-workouts');if(rEl)rEl.innerHTML=recent.length?recent.map(function(w){return sessionCard(w)}).join(''):'<div class="empty"><div class="empty-icon">&#127947;&#65039;</div>No sessions yet.</div>';var recentRuns=runs.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).slice(0,5);var rrEl=document.getElementById('recent-runs-workout');if(rrEl)rrEl.innerHTML=recentRuns.length?recentRuns.map(function(r){return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:18px">&#127939;</span><div style="flex:1"><div style="font-size:13px;font-weight:500">'+r.distance+'km'+(r.time?' · '+r.time:'')+'</div><div style="font-size:11px;color:var(--text2)">'+fmtDate(r.date)+(r.note?' · '+r.note:'')+'</div></div></div>'}).join(''):'<div class="empty" style="padding:20px 0"><div class="empty-icon">&#127939;</div>No runs yet. <a href="#" onclick="openModal(\'logRun\');return false" style="color:var(--accent)">Log your first run</a></div>';renderAllWorkouts();populateExerciseSelect();renderMyPlanStats()}
function renderMyPlanStats(){var el=document.getElementById('myplan-weight-stats');if(!el)return;var weights=((STATE.metrics||{}).weight||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date)});var goalW=STATE.weightGoal||75;var heightM=STATE.heightM||1.77;var current=weights.length?weights[weights.length-1].value:null;var start=weights.length?weights[0].value:null;var toGoal=current?Math.max(0,(current-goalW)).toFixed(1):null;var bmi=current?(current/(heightM*heightM)).toFixed(1):null;var goalBmi=(goalW/(heightM*heightM)).toFixed(1);var weeksToGoal=toGoal&&toGoal>0?Math.ceil(toGoal/0.5):0;el.innerHTML='<div class="card-sm" style="background:var(--bg2)"><div class="card-label">Current weight</div><div class="stat-big" style="font-size:24px">'+(current?current+' <span style="font-size:14px;color:var(--text2);font-family:var(--sans)">kg</span>':'—')+'</div><div class="stat-sub">Goal: '+goalW+' kg</div><button class="btn btn-sm" style="margin-top:8px;font-size:11px" onclick="openModal(\'logMetric\',\'weight\')">Log weight</button></div><div class="card-sm" style="background:var(--bg2)"><div class="card-label">To goal</div><div class="stat-big" style="font-size:24px">'+(toGoal!==null?toGoal+' <span style="font-size:14px;color:var(--text2);font-family:var(--sans)">kg</span>':'—')+'</div><div class="stat-sub">'+(weeksToGoal>0?'~'+weeksToGoal+' weeks at pace':'On target 🎉')+'</div></div><div class="card-sm" style="background:var(--bg2)"><div class="card-label">BMI</div><div class="stat-big" style="font-size:24px">'+(bmi||'—')+'</div><div class="stat-sub">Goal: '+goalBmi+'</div></div><div class="card-sm" style="background:var(--bg2)"><div class="card-label">Training days</div><div class="stat-big" style="font-size:24px">6 <span style="font-size:14px;color:var(--text2);font-family:var(--sans)">/wk</span></div><div class="stat-sub">3 Hyrox · 2 Gym · 1 Run</div></div>';renderMyPlan(start,current,goalW)}
function sessionCard(w){var exCount=(w.exercises||[]).length;var isHyrox=(w.muscleGroups||[]).indexOf('Hyrox')!==-1;var volume=(w.exercises||[]).reduce(function(s,e){return s+(e.sets||[]).filter(function(st){return st.logged}).reduce(function(a,st){return a+(Number(st.reps)||0)*(Number(st.weight)||0)},0)},0);var badgeText=isHyrox?'⚡ Hyrox':exCount+' exercises';return '<div class="workout-card" onclick="openModal(\'viewSession\',\''+w.id+'\')"><div class="workout-header"><div style="flex:1"><div class="workout-title">'+w.name+'</div><div class="workout-meta">'+fmtDate(w.date)+' &#183; '+((w.muscleGroups||[]).join(', '))+'</div></div><div style="display:flex;gap:6px;align-items:center"><span class="badge badge-fit">'+badgeText+'</span><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteWorkout(\''+w.id+'\')">&#215;</button></div></div>'+(volume>0?'<div style="font-size:12px;color:var(--text2);margin-top:8px">Volume: <span style="color:var(--accent);font-weight:500">'+volume.toLocaleString()+'kg</span></div>':'')+'</div>'}
function getBestPrevSet(sessionId,exerciseName){var prev=(STATE.workouts||[]).filter(function(w){return w.id!==sessionId}).flatMap(function(w){return (w.exercises||[]).filter(function(e){return e.name===exerciseName}).flatMap(function(e){return (e.sets||[]).filter(function(s){return s.logged})})});if(!prev.length)return null;return prev.sort(function(a,b){return Number(b.weight)-Number(a.weight)})[0]}
function renderAllWorkouts(){var el=document.getElementById('all-workouts');if(!el)return;var all=(STATE.workouts||[]).slice().reverse();if(!all.length){el.innerHTML='<div class="empty">No sessions yet</div>';return}el.innerHTML=all.map(function(w){return sessionCard(w)}).join('')}
function filterWorkouts(muscle,btn){document.querySelectorAll('#muscle-filters .filter-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');var el=document.getElementById('all-workouts');if(!el)return;var all=(STATE.workouts||[]).slice().reverse();var filtered=muscle==='All'?all:all.filter(function(w){return (w.muscleGroups||[w.type||'']).includes(muscle)});el.innerHTML=filtered.length?filtered.map(function(w){return sessionCard(w)}).join(''):'<div class="empty">No sessions for '+muscle+'</div>'}
function populateExerciseSelect(){var sel=document.getElementById('progress-exercise-select');if(!sel)return;var gymWorkouts=(STATE.workouts||[]).filter(function(w){return !(w.muscleGroups&&w.muscleGroups.indexOf('Hyrox')!==-1)});var names=Array.from(new Set(gymWorkouts.reduce(function(a,w){return a.concat((w.exercises||[]).map(function(e){return e.name}))},[])));var cur=sel.value;sel.innerHTML='<option value="">Select an exercise...</option>'+names.map(function(n){return '<option value="'+n+'"'+(n===cur?' selected':'')+'>'+n+'</option>'}).join('')}
function renderExerciseProgress(){var name=(document.getElementById('progress-exercise-select')||{}).value;var el=document.getElementById('exercise-progress-charts');if(!el)return;if(!name){el.innerHTML='';return}var points=[];(STATE.workouts||[]).filter(function(w){return !(w.muscleGroups&&w.muscleGroups.indexOf('Hyrox')!==-1)}).slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(w){(w.exercises||[]).filter(function(e){return e.name===name}).forEach(function(e){var best=(e.sets||[]).filter(function(s){return s.logged}).sort(function(a,b){return Number(b.weight)-Number(a.weight)})[0];if(best)points.push({date:w.date,weight:Number(best.weight),reps:Number(best.reps)})})});if(!points.length){el.innerHTML='<div class="empty">No logged sets for '+name+' yet</div>';return}var pr=points.reduce(function(best,p){return Number(p.weight)>Number(best.weight)?p:best},points[0]);el.innerHTML='<div style="display:flex;gap:12px;margin-bottom:16px"><div class="card-sm" style="flex:1"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Best weight</div><div style="font-size:22px;font-family:var(--serif);color:var(--accent)">'+pr.weight+'kg &#215;'+pr.reps+'</div></div></div><div class="card"><div class="card-label">Max weight over time</div><div class="chart-wrap"><canvas id="ex-weight-chart"></canvas></div></div>';setTimeout(function(){var ctx=document.getElementById('ex-weight-chart');if(ctx)new Chart(ctx,{type:'line',data:{labels:points.map(function(p){return fmtDate(p.date)}),datasets:[{data:points.map(function(p){return p.weight}),borderColor:'#a0522d',backgroundColor:'rgba(160,82,45,0.08)',tension:.3,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{ticks:{color:'#b89870',font:{size:10},callback:function(v){return v+'kg'}}}}}})},50)}
function renderWorkoutProgressCharts(){populateExerciseSelect();var gymOnly=(STATE.workouts||[]).filter(function(w){return !(w.muscleGroups&&w.muscleGroups.indexOf('Hyrox')!==-1)});var weeks={};var weekVol={};gymOnly.forEach(function(w){var wk=weekKey(new Date(w.date));weeks[wk]=(weeks[wk]||0)+1;var vol=0;(w.exercises||[]).forEach(function(e){(e.sets||[]).filter(function(s){return s.logged}).forEach(function(s){vol+=Number(s.weight||0)*Number(s.reps||0)})});weekVol[wk]=(weekVol[wk]||0)+vol});var wkKeys=Object.keys(weeks).sort().slice(-8);var sCtx=document.getElementById('sessionsChart');if(sCtx){if(sCtx._ch)sCtx._ch.destroy();sCtx._ch=new Chart(sCtx,{type:'bar',data:{labels:wkKeys.map(function(k){return fmtDate(k)}),datasets:[{data:wkKeys.map(function(k){return weeks[k]}),backgroundColor:'rgba(160,82,45,0.4)',borderColor:'#a0522d',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{ticks:{color:'#b89870',font:{size:10},stepSize:1}}}}})}var vCtx=document.getElementById('volumeChart');if(vCtx){if(vCtx._ch)vCtx._ch.destroy();vCtx._ch=new Chart(vCtx,{type:'bar',data:{labels:wkKeys.map(function(k){return fmtDate(k)}),datasets:[{data:wkKeys.map(function(k){return weekVol[k]||0}),backgroundColor:'rgba(95,158,160,0.4)',borderColor:'#5f9ea0',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{ticks:{color:'#b89870',font:{size:10},callback:function(v){return (v/1000).toFixed(1)+'t'}}}}}})}}
function renderPRs(){var el=document.getElementById('prs-list');if(!el)return;var autoPRs={};(STATE.workouts||[]).forEach(function(w){(w.exercises||[]).forEach(function(e){(e.sets||[]).filter(function(s){return s.logged}).forEach(function(s){if(!autoPRs[e.name]||Number(s.weight)>Number(autoPRs[e.name].weight))autoPRs[e.name]={weight:Number(s.weight),reps:Number(s.reps),date:w.date}})})});var allPRs=Object.assign({},autoPRs);Object.entries(STATE.prs||{}).forEach(function(pair){var k=pair[0];var v=pair[1];if(!allPRs[k]||Number(v.weight||v.value)>Number(allPRs[k].weight))allPRs[k]=v});var entries=Object.entries(allPRs).sort(function(a,b){return a[0].localeCompare(b[0])});el.innerHTML=entries.length?'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">'+entries.map(function(pair){var name=pair[0];var v=pair[1];return '<div class="card-sm"><div style="font-size:12px;color:var(--text3);margin-bottom:5px">'+name+'</div><div style="font-size:22px;font-family:var(--serif);font-weight:600;color:var(--accent)">'+(v.weight||v.value)+'kg</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+(v.reps?'&#215;'+v.reps+' &#183; ':'')+fmtDate(v.date)+'</div></div>'}).join('')+'</div>':'<div class="empty"><div class="empty-icon">&#127942;</div>No PRs yet.</div>'}
function deleteWorkout(id){confirmDelete('Delete this session?',function(){STATE.workouts=(STATE.workouts||[]).filter(function(w){return w.id!==id});if(activeSessionId===id)activeSessionId=null;saveState();renderWorkout()})}
var runCharts={};
function renderRunsTab(){var runs=((STATE.metrics||{}).run||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date)});var totalKm=runs.reduce(function(s,r){return s+Number(r.distance||0)},0);var thisMonth=new Date().toISOString().slice(0,7);var monthRuns=runs.filter(function(r){return r.date&&r.date.startsWith(thisMonth)});var monthKm=monthRuns.reduce(function(s,r){return s+Number(r.distance||0)},0);var bestRun=runs.length?runs.reduce(function(b,r){return Number(r.distance||0)>Number(b.distance||0)?r:b},runs[0]):null;
/* Avg pace across all runs */
var allPaces=runs.filter(function(r){return r.time&&r.distance}).map(function(r){var p=r.time.split(':');return (Number(p[0]||0)+Number(p[1]||0)/60)/Number(r.distance)});var avgPace=allPaces.length?(allPaces.reduce(function(s,v){return s+v},0)/allPaces.length):0;
/* Weekly avg km (last 4 weeks) */
var fourWeeksAgo=new Date();fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);var recentRuns=runs.filter(function(r){return new Date(r.date)>=fourWeeksAgo});var weeklyAvgKm=recentRuns.length?(recentRuns.reduce(function(s,r){return s+Number(r.distance||0)},0)/4):0;
/* PB calculation for standard distances */
var pbDistances=[{label:'1km',dist:1,tol:0.05},{label:'5km',dist:5,tol:0.3},{label:'10km',dist:10,tol:0.5},{label:'Half Marathon',dist:21.1,tol:1},{label:'Marathon',dist:42.2,tol:2}];
var pbsEl=document.getElementById('run-pbs');
if(pbsEl){var pbHtml='';pbDistances.forEach(function(pb){var matching=runs.filter(function(r){return r.time&&r.distance&&Math.abs(Number(r.distance)-pb.dist)<=pb.tol});if(matching.length){var best=matching.reduce(function(b,r){var pA=r.time.split(':');var minsA=Number(pA[0]||0)*60+Number(pA[1]||0)+(Number(pA[2]||0)/60);var pB=b.time.split(':');var minsB=Number(pB[0]||0)*60+Number(pB[1]||0)+(Number(pB[2]||0)/60);return minsA<minsB?r:b},matching[0]);pbHtml+='<div class="card-sm" style="text-align:center;border-top:3px solid var(--gold)"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">'+pb.label+'</div><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--gold)">'+best.time+'</div><div style="font-size:10px;color:var(--text3);margin-top:4px">'+fmtDate(best.date)+'</div></div>'}else{pbHtml+='<div class="card-sm" style="text-align:center;opacity:0.5"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">'+pb.label+'</div><div style="font-size:20px;font-family:var(--serif);color:var(--text3)">—</div><div style="font-size:10px;color:var(--text3);margin-top:4px">no data</div></div>'}});pbsEl.innerHTML=pbHtml}
/* Stats cards */
var rsEl=document.getElementById('run-stats');if(rsEl)rsEl.innerHTML='<div class="card" style="border-top:3px solid var(--teal)"><div class="card-label">Total distance</div><div class="stat-big">'+totalKm.toFixed(1)+'</div><div class="stat-sub">km · '+runs.length+' runs</div></div><div class="card" style="border-top:3px solid var(--accent)"><div class="card-label">This month</div><div class="stat-big">'+monthKm.toFixed(1)+'</div><div class="stat-sub">km · '+monthRuns.length+' runs</div></div><div class="card" style="border-top:3px solid var(--gold)"><div class="card-label">Longest run</div><div class="stat-big">'+(bestRun?bestRun.distance:'—')+'</div><div class="stat-sub">'+(bestRun?'km · '+fmtDate(bestRun.date):'no runs yet')+'</div></div><div class="card" style="border-top:3px solid #8b5cf6"><div class="card-label">Avg pace</div><div class="stat-big">'+(avgPace?avgPace.toFixed(2):'—')+'</div><div class="stat-sub">'+(avgPace?'min/km':'no data')+'</div></div><div class="card" style="border-top:3px solid #ec4899"><div class="card-label">Weekly avg</div><div class="stat-big">'+weeklyAvgKm.toFixed(1)+'</div><div class="stat-sub">km / week (4wk)</div></div>';
if(runCharts.dist){runCharts.dist.destroy();delete runCharts.dist}if(runCharts.pace){runCharts.pace.destroy();delete runCharts.pace}var dCtx=document.getElementById('runDistChart');if(dCtx&&runs.length)runCharts.dist=new Chart(dCtx,{type:'bar',data:{labels:runs.map(function(r){return fmtDate(r.date)}),datasets:[{data:runs.map(function(r){return Number(r.distance||0)}),backgroundColor:'rgba(95,158,160,0.4)',borderColor:'#5f9ea0',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{ticks:{color:'#b89870',font:{size:10},callback:function(v){return v+'km'}}}}}});var pacePoints=runs.filter(function(r){return r.time&&r.distance}).map(function(r){var parts=r.time.split(':');var mins=Number(parts[0]||0)+(Number(parts[1]||0)/60);var pace=mins/Number(r.distance);return {date:r.date,pace:Math.round(pace*100)/100}});var pCtx=document.getElementById('runPaceChart');if(pCtx&&pacePoints.length)runCharts.pace=new Chart(pCtx,{type:'line',data:{labels:pacePoints.map(function(p){return fmtDate(p.date)}),datasets:[{data:pacePoints.map(function(p){return p.pace}),borderColor:'#a0522d',backgroundColor:'rgba(160,82,45,0.08)',tension:.3,pointRadius:4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{reverse:true,ticks:{color:'#b89870',font:{size:10},callback:function(v){return v.toFixed(1)+' min/km'}}}}}});var rlEl=document.getElementById('runs-list-workout');if(rlEl)rlEl.innerHTML=runs.length?runs.slice().reverse().map(function(r){var pStr='';if(r.time&&r.distance){var pp=r.time.split(':');var pm=(Number(pp[0]||0)+Number(pp[1]||0)/60)/Number(r.distance);pStr=' · '+pm.toFixed(2)+' min/km'}return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="font-size:20px">&#127939;</span><div style="flex:1"><div style="font-size:13px;font-weight:500">'+r.distance+'km'+(r.time?' · '+r.time:'')+pStr+'</div><div style="font-size:11px;color:var(--text2)">'+fmtDate(r.date)+(r.note?' · '+r.note:'')+'</div></div><button class="btn btn-sm btn-danger" onclick="deleteRunFromWorkout(\''+r.id+'\')">&#215;</button></div>'}).join(''):'<div class="empty"><div class="empty-icon">&#127939;</div>No runs logged yet.</div>'}
function saveRunFromWorkout(){var dist=(document.getElementById('m-rundist')||{}).value;if(!dist)return;var date=(document.getElementById('m-rundate')||{}).value||new Date().toISOString().slice(0,10);var time=(document.getElementById('m-runtime')||{}).value||'';var note=(document.getElementById('m-runnote')||{}).value||'';if(!STATE.metrics)STATE.metrics={};if(!STATE.metrics.run)STATE.metrics.run=[];STATE.metrics.run.push({id:g(),date:date,distance:Number(dist),time:time,note:note});saveState();closeModal();renderWorkout();var runsTab=document.getElementById('workout-runs');if(runsTab&&runsTab.classList.contains('active'))renderRunsTab()}
function deleteRunFromWorkout(id){confirmDelete('Delete this run?',function(){if(!STATE.metrics||!STATE.metrics.run)return;STATE.metrics.run=STATE.metrics.run.filter(function(r){return r.id!==id});saveState();renderRunsTab();renderWorkout()})}

// ============================================================
// KAI'S PERSONAL PLAN — renders into workout-myplan sub-page
// Called automatically from renderMyPlanStats()
// ============================================================
function renderMyPlan(start, current, goalW) {
  var el = document.getElementById('workout-myplan');
  if (!el) return;

  // ── helpers ──────────────────────────────────────────────
  function ex(num, name, cue, muscles, sets, rest, isSuperset) {
    var pad = isSuperset ? '9px 12px' : '10px 20px';
    var tags = muscles.map(function(m) {
      return '<span style="font-size:9px;padding:1px 6px;border-radius:5px;border:1px solid var(--border2);color:var(--text3)">' + m + '</span>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:start;padding:' + pad + ';border-bottom:1px solid var(--border)">'
      + '<div style="font-size:11px;color:var(--text3);padding-top:2px">' + num + '</div>'
      + '<div><div style="font-size:13px;font-weight:600">' + name + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + cue + '</div>'
      + '<div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">' + tags + '</div></div>'
      + '<div style="text-align:right;white-space:nowrap"><div style="font-size:13px;font-weight:600">' + sets + '</div>'
      + (rest ? '<div style="font-size:10px;color:var(--text3);margin-top:2px">' + rest + '</div>' : '')
      + '</div></div>';
  }

  function superset(label, items) {
    return '<div style="border:1px solid rgba(155,123,138,0.25);border-radius:var(--radius-sm);margin:10px 16px 4px;overflow:hidden">'
      + '<div style="font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--mauve);padding:6px 12px;background:rgba(155,123,138,0.1)">' + label + '</div>'
      + items + '</div>';
  }

  function sectionHead(text) {
    return '<div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);padding:10px 20px 4px;border-bottom:1px solid var(--border)">' + text + '</div>';
  }

  function sessionCard(day, title, sub, duration, content, cardioNote) {
    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">'
      + '<div style="padding:16px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between">'
      + '<div><div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:3px">' + day + '</div>'
      + '<div style="font-size:16px;font-weight:600;font-family:var(--serif);color:var(--text)">' + title + '</div>'
      + '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + sub + '</div></div>'
      + '<span class="badge" style="background:var(--accent-dim);color:var(--accent);font-size:11px;white-space:nowrap">' + duration + '</span>'
      + '</div>' + content
      + (cardioNote ? '<div style="padding:12px 20px;background:var(--mint-dim);border-top:1px solid rgba(107,158,122,0.25);display:flex;align-items:center;justify-content:space-between">'
        + '<div><div style="font-size:12px;font-weight:600;color:var(--mint)">🏃 Cardio finisher</div>'
        + '<div style="font-size:11px;color:var(--teal);margin-top:1px">' + cardioNote + '</div></div>'
        + '<span class="badge badge-per" style="font-size:11px">15–20 min</span></div>' : '')
      + '</div>';
  }

  function miniCard(title, when, body, color) {
    return '<div class="card-sm" style="border-left:3px solid ' + color + '">'
      + '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">' + title + '</div>'
      + '<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:' + color + ';margin-bottom:6px">' + when + '</div>'
      + '<div style="font-size:12px;color:var(--text2);line-height:1.6">' + body + '</div></div>';
  }

  function timelineItem(month, text, color) {
    return '<div style="position:relative;padding-left:20px;margin-bottom:20px">'
      + '<div style="position:absolute;left:0;top:5px;width:10px;height:10px;border-radius:50%;background:' + color + ';border:2px solid var(--bg2)"></div>'
      + '<div style="font-family:var(--serif);font-size:15px;font-weight:600;color:' + color + ';margin-bottom:3px">' + month + '</div>'
      + '<div style="font-size:12px;color:var(--text2);line-height:1.65">' + text + '</div></div>';
  }

  // ── BUILD HTML ────────────────────────────────────────────
  var html = '';

  // GOAL BANNER
  html += '<div style="background:linear-gradient(135deg,#fdf6e8,#f2e8d8);border:1.5px solid var(--gold);border-radius:var(--radius);padding:18px 22px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
    + '<div style="font-size:28px">🏆</div>'
    + '<div style="flex:1"><div style="font-family:var(--serif);font-size:18px;font-weight:600;color:var(--warm-brown)">Goal: Look & feel incredible by Thailand</div>'
    + '<div style="font-size:12px;color:var(--text2);margin-top:3px">Fat loss + muscle gain · HYROX Women Pro · Target: Nov / Dec 2026</div></div>'
    + '<span class="badge" style="background:var(--gold-dim);color:var(--gold);font-size:12px;font-weight:600">~7 months</span></div>';

  // WEIGHT STATS (already rendered by renderMyPlanStats above, just insert placeholder IDs)
  html += '<div class="grid-4" style="margin-bottom:20px" id="myplan-weight-stats-inner"></div>';

  // WEEKLY SCHEDULE
  html += '<div class="card" style="margin-bottom:16px"><div class="card-label">📅 Weekly schedule</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:4px">';

  [
    {d:'Mon',badge:'badge-fit',bt:'Hyrox',title:'Day 1',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)'},
    {d:'Tue',badge:'badge-fin',bt:'Lower',title:'Lower body',sub:'Glutes · Hams · Quads',bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)'},
    {d:'Wed',badge:'badge-fit',bt:'Hyrox',title:'Day 3',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)'},
    {d:'Thu',badge:'badge-fin',bt:'Upper',title:'Upper body',sub:'Push · Pull · Shoulders',bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)'},
    {d:'Fri',badge:'badge-fit',bt:'Hyrox',title:'Day 5',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)'},
    {d:'Sat',badge:'badge-per',bt:'Run',title:'Long run',sub:'Easy pace · +5min/2wks',bg:'var(--mint-dim)',br:'rgba(107,158,122,0.25)',c:'var(--mint)'},
    {d:'Sun',badge:'',bt:'Rest',title:'Recovery',sub:'Walk or rest',bg:'var(--bg3)',br:'var(--border)',c:'var(--text3)'}
  ].forEach(function(day) {
    html += '<div style="background:' + day.bg + ';border:1px solid ' + day.br + ';border-radius:var(--radius-sm);padding:10px 8px;min-height:110px">'
      + '<div style="font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:' + day.c + ';margin-bottom:6px">' + day.d + '</div>'
      + '<span class="badge ' + day.badge + '" style="font-size:9px;padding:2px 7px;margin-bottom:6px;display:inline-block' + (!day.badge ? ';background:var(--bg4);color:var(--text3)' : '') + '">' + day.bt + '</span>'
      + '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px">' + day.title + '</div>'
      + '<div style="font-size:10px;color:var(--text2)">' + day.sub + '</div></div>';
  });
  html += '</div></div>';

  // GYM SESSIONS
  html += '<div class="grid-2" style="margin-bottom:16px">';

  // TUESDAY — LOWER BODY
  var lowerContent = ''
    + ex(1,'Barbell back squat','Feet shoulder-width. Squat to parallel or below. Brace core before every rep.',['Quads','Glutes','Core'],'4 × 8–10','Rest 2 min')
    + ex(2,'Romanian deadlift','Soft knees, push hips back. Stop at a strong hamstring stretch. Don\'t round back.',['Hamstrings','Glutes'],'4 × 10–12','Rest 90 sec')
    + ex(3,'Smith machine hip thrust','Upper back on bench. Drive through heels, squeeze glutes hard for 1 sec at top.',['Glutes','Hamstrings'],'4 × 12–15','Rest 90 sec')
    + ex(4,'Leg press','Feet mid-to-high on platform. Don\'t fully lock out knees at top.',['Quads','Glutes'],'3 × 12–15','Rest 75 sec')
    + ex(5,'Bulgarian split squat','Rear foot on bench. Drop back knee straight down, keep torso upright. Drive through front heel.',['Quads','Glutes','Balance'],'3 × 10 each leg','Rest 75 sec')
    + superset('Superset — do back to back then rest',
        ex('6a','Lying leg curl','3 sec negative. Full stretch at the bottom.',['Hamstrings'],'3 × 12','',true)
      + ex('6b','Plank','Elbows under shoulders. Hips level, don\'t sag.',['Core'],'3 × 45 sec','Rest 60 sec',true));
  html += sessionCard('Tuesday','Lower body','Glutes · Hamstrings · Quads · Core','80–90 min',lowerContent,'Stairmaster or incline treadmill — legs already warm');

  // THURSDAY — UPPER BODY
  var upperContent = ''
    + ex(1,'Barbell bench press','2 sec descent, drive up explosively. Heaviest lift of session — do it fresh.',['Chest','Shoulders','Triceps'],'4 × 8–10','Rest 2 min')
    + ex(2,'Cable seated row','Neutral grip. Squeeze shoulder blades together. Don\'t rock back.',['Lats','Rhomboids','Biceps'],'4 × 10–12','Rest 90 sec')
    + ex(3,'Dumbbell overhead press','Seated. Full lockout, lower to ear height. Don\'t arch aggressively.',['Shoulders','Triceps'],'3 × 10–12','Rest 75 sec')
    + ex(4,'Lat pulldown','Wide overhand grip. Pull to upper chest, squeeze lats. No momentum.',['Lats','Biceps'],'3 × 10–12','Rest 75 sec')
    + ex(5,'Face pull','Cable at head height. Pull to forehead, elbows high. Great for posture + shoulder health.',['Rear delts','Rotator cuff'],'3 × 15','Rest 60 sec')
    + superset('Superset — do back to back then rest',
        ex('6a','Cable tricep pushdown','Rope attachment. Flare at bottom for full contraction.',['Triceps'],'3 × 12','',true)
      + ex('6b','Dumbbell curl','Slow on the way down. 2 sec negative.',['Biceps'],'3 × 12','Rest 60 sec',true))
    + sectionHead('Core finisher')
    + ex('C1','Hanging knee raise','Dead hang. Bring knees above hip height. Control the lower.',['Core','Hip flexors'],'3 × 15','Rest 45 sec')
    + ex('C2','Dead bug','Lower back pressed into floor throughout. Move slowly.',['Core','Stability'],'3 × 10 each','Rest 45 sec');
  html += sessionCard('Thursday','Upper body','Push · Pull · Shoulders · Core','80–90 min',upperContent,'Treadmill incline walk — Zone 2 pace');

  html += '</div>'; // end grid-2

  // SHIN SPLINT PREVENTION
  html += '<div class="card" style="margin-bottom:16px"><div class="card-label">🦵 Shin splint prevention — start from week 1</div>'
    + '<div style="background:var(--rose-dim);border:1px solid var(--rose);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--text2);line-height:1.6">'
    + '⚠️ <strong>You\'re prone to shin splints.</strong> These take 5 minutes daily and will prevent them if started now — before pain appears, not after.</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">'
    + miniCard('Calf raises','Daily · 3 × 20','Off a step edge — slow 3-sec lower, full range. The single most effective shin splint prevention exercise. Do every day including rest days.','var(--teal)')
    + miniCard('Tibialis raises','Daily · 3 × 15–20','Back against wall, feet out — raise toes off the floor repeatedly. Directly strengthens the tibialis anterior. Almost no one does this and it\'s very effective.','var(--teal)')
    + miniCard('Calf foam roll','Post-run · 5 min','Roll calves and lateral lower leg after every run. Do NOT roll directly on the shin bone. Reduces tightness that contributes to shin pain.','var(--blue)')
    + miniCard('Run cadence','Every run','Aim for 170–180 steps per minute. Shorter, quicker strides reduce tibial impact. Use a metronome app or run to music at that BPM.','var(--blue)')
    + miniCard('Correct footwear','Check now','Stability or motion-control shoe required — you overpronate. ASICS Gel-Kayano or Brooks Adrenaline GTS. Never run in neutral or fashion trainers.','var(--gold)')
    + miniCard('10% rule','Always','Never increase weekly running volume by more than 10% week on week. Saturday run: start at 30 min, add 5 min every 2 weeks.','var(--gold)')
    + '</div>'
    + '<div style="margin-top:12px;background:var(--red-dim);border:1px solid var(--red);border-radius:var(--radius-sm);padding:10px 14px;font-size:12px;color:var(--text2);line-height:1.6">'
    + '🚨 <strong>If shin pain starts:</strong> 2–3 days off running immediately. Ice the shin 15 min twice daily. If pain persists beyond a week, see a physio — stress fractures present similarly and must be ruled out.</div></div>';

  // NUTRITION TARGETS
  html += '<div class="card" style="margin-bottom:16px"><div class="card-label">🥗 Nutrition targets</div>'
    + '<div class="grid-2" style="gap:20px;margin-top:4px"><div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">'
    + '<div><div style="font-size:13px;font-weight:600">Training days</div><div style="font-size:11px;color:var(--text2);margin-top:2px">~500 kcal deficit</div>'
    + '<span class="badge badge-fin" style="font-size:9px;margin-top:4px;display:inline-block">Hit this daily</span></div>'
    + '<div style="font-family:var(--serif);font-size:26px;font-weight:600;color:var(--accent)">1,850 <span style="font-size:13px;color:var(--text2);font-family:var(--sans)">kcal</span></div></div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0">'
    + '<div><div style="font-size:13px;font-weight:600">Rest days</div><div style="font-size:11px;color:var(--text2);margin-top:2px">Never go below this</div></div>'
    + '<div style="font-family:var(--serif);font-size:26px;font-weight:600;color:var(--text2)">1,600 <span style="font-size:13px;font-family:var(--sans)">kcal</span></div></div></div>'
    + '<div><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Daily macros — training day</div>'
    + '<div class="grid-3" style="gap:10px">'
    + '<div style="text-align:center;padding:12px 8px;background:var(--blue-dim);border-radius:var(--radius-sm)"><div style="font-family:var(--serif);font-size:24px;font-weight:600;color:var(--blue)">155g</div><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-top:2px">Protein</div><div style="font-size:10px;color:var(--text3)">620 kcal</div></div>'
    + '<div style="text-align:center;padding:12px 8px;background:var(--amber-dim);border-radius:var(--radius-sm)"><div style="font-family:var(--serif);font-size:24px;font-weight:600;color:var(--amber)">185g</div><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-top:2px">Carbs</div><div style="font-size:10px;color:var(--text3)">740 kcal</div></div>'
    + '<div style="text-align:center;padding:12px 8px;background:var(--teal-dim);border-radius:var(--radius-sm)"><div style="font-family:var(--serif);font-size:24px;font-weight:600;color:var(--teal)">55g</div><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-top:2px">Fat</div><div style="font-size:10px;color:var(--text3)">495 kcal</div></div>'
    + '</div>'
    + '<div style="margin-top:14px" id="myplan-weight-progress">'
    + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:5px">'
    + '<span id="myplan-start-label">' + (start ? start + ' kg — Start' : '— Start') + '</span>'
    + '<span style="color:var(--accent);font-weight:600" id="myplan-goal-label">' + (goalW || 75) + ' kg — Goal</span></div>'
    + '<div class="pbar-wrap"><div class="pbar" id="myplan-prog-bar" style="width:' + (function(){if(start&&current&&start>goalW){var pct=Math.min(100,Math.max(0,Math.round((start-current)/(start-goalW)*100)));return pct}return 0}()) + '%;background:linear-gradient(90deg,var(--accent),var(--gold))"></div></div>'
    + '<div style="font-size:10px;color:var(--text3);margin-top:4px" id="myplan-pace-label">' + (function(){if(start&&current&&start>goalW){var lost=(start-current).toFixed(1);var total=(start-goalW).toFixed(1);var pct=Math.min(100,Math.max(0,Math.round((start-current)/(start-goalW)*100)));return lost+'kg lost of '+total+'kg target ('+pct+'%)'}return 'Log weight in Metrics → Body to track progress'}()) + '</div>'
    + '</div></div></div>'
    + '<div style="margin-top:14px;padding:12px 16px;background:var(--accent-dim);border-radius:var(--radius-sm);font-size:12px;color:var(--text2);line-height:1.65">'
    + '📌 <strong>Protein is the priority.</strong> Hit 155g every day before anything else. Your daily split: Greek yoghurt (~20g) + clear whey mid-morning (~20g) + lunch (~38g) + dinner (~42g) + snack (~15g) = on target.</div></div>';

  // SUPPLEMENTS
  html += '<div class="card" style="margin-bottom:16px"><div class="card-label">💊 Supplements — evidence-based only</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:4px">'
    + miniCard('Creatine','5g / day — always','Most evidence-backed supplement there is. Improves strength, power and recovery. Take every day including rest days. Minor water retention in week 1 is normal and temporary.','var(--gold)')
    + miniCard('Clear whey','Mid-morning at desk','Easy to mix into water. Bridges breakfast and lunch, prevents the afternoon snacking spiral. Make at home, take to the office. Don\'t skip it on busy days.','var(--gold)')
    + miniCard('Vitamin D3','2,000–4,000 IU / day','Most UK residents are deficient year-round. Supports recovery, immunity, mood and hormone regulation — especially relevant given your coil.','var(--teal)')
    + miniCard('Magnesium glycinate','300–400mg at bedtime','Improves sleep quality and muscle recovery. Critical at 5+ training days per week. Also helps with period-related cramping.','var(--teal)')
    + miniCard('Omega-3','2g / day with food','Reduces exercise-induced inflammation. Supports joint health under HYROX loading. Take with a meal that contains fat.','var(--blue)')
    + miniCard('Electrolytes','HYROX days + long runs','LMNT or Precision Hydration. You lose sodium, potassium and magnesium through sweat during HYROX sessions. Maintains performance and reduces cramping.','var(--blue)')
    + '</div></div>';

  // PROGRESS TRACKING
  html += '<div class="card" style="margin-bottom:16px"><div class="card-label">📸 Progress tracking</div>'
    + '<div style="background:var(--gold-dim);border:1px solid var(--gold);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:14px;font-size:12px;color:var(--text2);line-height:1.65">'
    + '💛 <strong>Don\'t focus on the scale.</strong> The goal is body composition — how you look and feel. The scale fluctuates 2–3kg across your cycle. Use progress photos as your primary measurement tool.'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">'
    + miniCard('Monthly photo','1st of every month','Same outfit. Same lighting. Same time of day. This is your real measurement tool — refer back when motivation dips.','var(--rose)')
    + miniCard('Weekly weigh-in','Same day · Morning · After toilet','Log in Metrics → Body above. Use a 4-week rolling average — don\'t react to single-day fluctuations or pre-period readings.','var(--teal)')
    + miniCard('Strength numbers','Track in PRs tab','Log hip thrust, squat and bench here. Strength going up = muscle being built. This matters more than the scale number.','var(--mauve)')
    + miniCard('Run times','Log in Runs tab','Saturday run duration and pace tracked here. When your 5km time improves, your HYROX running sections get easier.','var(--mint)')
    + '</div></div>';

  // WRITE TO DOM — preserve the weight stats div then append the rest
  var statsDiv = document.getElementById('myplan-weight-stats');
  if (statsDiv) {
    // Remove all siblings after the stats div, then insert new content
    while (statsDiv.nextSibling) statsDiv.parentNode.removeChild(statsDiv.nextSibling);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    while (wrapper.firstChild) el.appendChild(wrapper.firstChild);
  } else {
    el.innerHTML = html;
  }
}