var activeSessionId=null;
var runCharts={};

// Stub for legacy session viewing
function getBestPrevSet(){return null}

// Default weekly plan — editable and saved to STATE
var DEFAULT_PLAN=[
  {day:'Mon',type:'Hyrox',title:'Hyrox',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
  {day:'Tue',type:'Upper',title:'Upper body',sub:'Push · Pull · Shoulders',bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
  {day:'Wed',type:'Hyrox',title:'Hyrox',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
  {day:'Thu',type:'Lower',title:'Lower body',sub:'Glutes · Hams · Quads',bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
  {day:'Fri',type:'Hyrox',title:'Hyrox',sub:'Hyrox training',bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
  {day:'Sat',type:'Run',title:'Run',sub:'Your choice',bg:'var(--mint-dim)',br:'rgba(107,158,122,0.25)',c:'var(--mint)',badge:'badge-per'},
  {day:'Sun',type:'Rest',title:'Recovery',sub:'Rest or light walk',bg:'var(--bg3)',br:'var(--border)',c:'var(--text3)',badge:''}
];

function getWeeklyPlanData(){
  return STATE.weeklyPlan||DEFAULT_PLAN.map(function(d){return {day:d.day,type:d.type,title:d.title,sub:d.sub}});
}

function renderWorkout(){
  var sessions=STATE.workouts||[];
  var thisWeek=sessions.filter(function(w){return w.date>=weekKey(new Date())});
  var runs=((STATE.metrics||{}).run||[]);
  var thisMonthRuns=runs.filter(function(r){return r.date&&r.date.startsWith(new Date().toISOString().slice(0,7))});
  var totalKm=thisMonthRuns.reduce(function(s,r){return s+Number(r.distance||0)},0);

  var wsEl=document.getElementById('workout-stats');
  if(wsEl)wsEl.innerHTML=
    '<div class="card" style="border-top:3px solid var(--accent)"><div class="card-label">This week</div><div class="stat-big">'+thisWeek.length+'</div><div class="stat-sub">sessions</div></div>'
    +'<div class="card" style="border-top:3px solid var(--mauve)"><div class="card-label">Total sessions</div><div class="stat-big">'+sessions.length+'</div><div class="stat-sub">all time</div></div>'
    +'<div class="card" style="border-top:3px solid var(--teal)"><div class="card-label">Runs this month</div><div class="stat-big">'+thisMonthRuns.length+'</div><div class="stat-sub">'+totalKm.toFixed(1)+' km</div></div>'
    +'<div class="card" style="border-top:3px solid var(--gold)"><div class="card-label">Total runs</div><div class="stat-big">'+runs.length+'</div><div class="stat-sub">all time</div></div>';

  var recent=sessions.slice(-5).reverse();
  var rEl=document.getElementById('recent-workouts');
  if(rEl)rEl.innerHTML=recent.length?recent.map(function(w){return sessionCard(w)}).join(''):'<div class="empty"><div class="empty-icon">&#127947;&#65039;</div>No sessions yet.</div>';

  var recentRuns=runs.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).slice(0,5);
  var rrEl=document.getElementById('recent-runs-workout');
  if(rrEl)rrEl.innerHTML=recentRuns.length?recentRuns.map(function(r){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:18px">&#127939;</span><div style="flex:1"><div style="font-size:13px;font-weight:500">'+r.distance+'km'+(r.time?' · '+r.time:'')+'</div><div style="font-size:11px;color:var(--text2)">'+fmtDate(r.date)+(r.note?' · '+r.note:'')+'</div></div></div>';
  }).join(''):'<div class="empty" style="padding:20px 0"><div class="empty-icon">&#127939;</div>No runs yet.</div>';

  renderAllWorkouts();
  renderMyPlanSchedule();
}

function sessionCard(w){
  var typeLabel=w.type||w.name||'Session';
  return '<div class="workout-card"><div class="workout-header"><div style="flex:1"><div class="workout-title">'+typeLabel+'</div><div class="workout-meta">'+fmtDate(w.date)+(w.note?' · '+w.note:'')+'</div></div><div style="display:flex;gap:6px;align-items:center"><span class="badge badge-fit">'+typeLabel+'</span><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteWorkout(\''+w.id+'\')">&#215;</button></div></div></div>';
}

function deleteWorkout(id){
  confirmDelete('Delete this session?',function(){
    STATE.workouts=(STATE.workouts||[]).filter(function(w){return w.id!==id});
    saveState();renderWorkout();
  });
}

function renderAllWorkouts(){
  var el=document.getElementById('all-workouts');if(!el)return;
  var all=(STATE.workouts||[]).slice().reverse();
  if(!all.length){el.innerHTML='<div class="empty">No sessions yet</div>';return}
  // Build filter buttons
  var fEl=document.getElementById('muscle-filters');
  if(fEl){
    var types=['All'];
    all.forEach(function(w){var t=w.type||'Other';if(types.indexOf(t)===-1)types.push(t)});
    fEl.innerHTML=types.map(function(t,i){return '<button class="filter-btn'+(i===0?' active':'')+'" onclick="filterWorkouts(\''+t+'\',this)">'+t+'</button>'}).join('');
  }
  el.innerHTML=all.map(function(w){return sessionCard(w)}).join('');
}

function filterWorkouts(type,btn){
  document.querySelectorAll('#muscle-filters .filter-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  var el=document.getElementById('all-workouts');if(!el)return;
  var all=(STATE.workouts||[]).slice().reverse();
  var filtered=type==='All'?all:all.filter(function(w){return (w.type||'Other')===type});
  el.innerHTML=filtered.length?filtered.map(function(w){return sessionCard(w)}).join(''):'<div class="empty">No sessions for '+type+'</div>';
}

// Quick log — simple session type logging
function saveQuickLog(){
  var type=(document.getElementById('m-qltype')||{}).value;
  if(!type)return;
  var date=(document.getElementById('m-qldate')||{}).value||localDateKey(new Date());
  var note=(document.getElementById('m-qlnote')||{}).value||'';
  if(!STATE.workouts)STATE.workouts=[];
  STATE.workouts.push({id:g(),date:date,type:type,name:type,note:note,muscleGroups:[type]});
  autoTickHabit('gym',date);
  saveState();closeModal();renderWorkout();
}

// Runs
function renderRunsTab(){
  var runs=((STATE.metrics||{}).run||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date)});
  var totalKm=runs.reduce(function(s,r){return s+Number(r.distance||0)},0);
  var thisMonth=new Date().toISOString().slice(0,7);
  var monthRuns=runs.filter(function(r){return r.date&&r.date.startsWith(thisMonth)});
  var monthKm=monthRuns.reduce(function(s,r){return s+Number(r.distance||0)},0);
  var bestRun=runs.length?runs.reduce(function(b,r){return Number(r.distance||0)>Number(b.distance||0)?r:b},runs[0]):null;
  var allPaces=runs.filter(function(r){return r.time&&r.distance}).map(function(r){var p=r.time.split(':');return (Number(p[0]||0)+Number(p[1]||0)/60)/Number(r.distance)});
  var avgPace=allPaces.length?(allPaces.reduce(function(s,v){return s+v},0)/allPaces.length):0;
  var fourWeeksAgo=new Date();fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  var recentRuns=runs.filter(function(r){return new Date(r.date)>=fourWeeksAgo});
  var weeklyAvgKm=recentRuns.length?(recentRuns.reduce(function(s,r){return s+Number(r.distance||0)},0)/4):0;

  // PBs — exclude 1km
  var pbDistances=[{label:'5km',dist:5,tol:0.3},{label:'10km',dist:10,tol:0.5},{label:'Half Marathon',dist:21.1,tol:1},{label:'Marathon',dist:42.2,tol:2}];
  var pbsEl=document.getElementById('run-pbs');
  if(pbsEl){var pbHtml='';pbDistances.forEach(function(pb){
    var matching=runs.filter(function(r){return r.time&&r.distance&&Math.abs(Number(r.distance)-pb.dist)<=pb.tol});
    if(matching.length){var best=matching.reduce(function(b,r){var pA=r.time.split(':');var minsA=Number(pA[0]||0)*60+Number(pA[1]||0);var pB=b.time.split(':');var minsB=Number(pB[0]||0)*60+Number(pB[1]||0);return minsA<minsB?r:b},matching[0]);
      pbHtml+='<div class="card-sm" style="text-align:center;border-top:3px solid var(--gold)"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">'+pb.label+'</div><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--gold)">'+best.time+'</div><div style="font-size:10px;color:var(--text3);margin-top:4px">'+fmtDate(best.date)+'</div></div>';
    }else{pbHtml+='<div class="card-sm" style="text-align:center;opacity:0.5"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">'+pb.label+'</div><div style="font-size:20px;font-family:var(--serif);color:var(--text3)">—</div><div style="font-size:10px;color:var(--text3);margin-top:4px">no data</div></div>'}
  });pbsEl.innerHTML=pbHtml}

  var rsEl=document.getElementById('run-stats');
  if(rsEl)rsEl.innerHTML='<div class="card" style="border-top:3px solid var(--teal)"><div class="card-label">Total distance</div><div class="stat-big">'+totalKm.toFixed(1)+'</div><div class="stat-sub">km · '+runs.length+' runs</div></div><div class="card" style="border-top:3px solid var(--accent)"><div class="card-label">This month</div><div class="stat-big">'+monthKm.toFixed(1)+'</div><div class="stat-sub">km · '+monthRuns.length+' runs</div></div><div class="card" style="border-top:3px solid var(--gold)"><div class="card-label">Longest run</div><div class="stat-big">'+(bestRun?bestRun.distance:'—')+'</div><div class="stat-sub">'+(bestRun?'km · '+fmtDate(bestRun.date):'no runs yet')+'</div></div><div class="card" style="border-top:3px solid #8b5cf6"><div class="card-label">Avg pace</div><div class="stat-big">'+(avgPace?avgPace.toFixed(2):'—')+'</div><div class="stat-sub">'+(avgPace?'min/km':'no data')+'</div></div><div class="card" style="border-top:3px solid #ec4899"><div class="card-label">Weekly avg</div><div class="stat-big">'+weeklyAvgKm.toFixed(1)+'</div><div class="stat-sub">km / week (4wk)</div></div>';

  // Charts
  if(runCharts.dist){runCharts.dist.destroy();delete runCharts.dist}
  if(runCharts.pace){runCharts.pace.destroy();delete runCharts.pace}
  var dCtx=document.getElementById('runDistChart');
  if(dCtx&&runs.length)runCharts.dist=new Chart(dCtx,{type:'bar',data:{labels:runs.map(function(r){return fmtDate(r.date)}),datasets:[{data:runs.map(function(r){return Number(r.distance||0)}),backgroundColor:'rgba(95,158,160,0.4)',borderColor:'#5f9ea0',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{ticks:{color:'#b89870',font:{size:10},callback:function(v){return v+'km'}}}}}});
  var pacePoints=runs.filter(function(r){return r.time&&r.distance}).map(function(r){var parts=r.time.split(':');var mins=Number(parts[0]||0)+(Number(parts[1]||0)/60);return {date:r.date,pace:Math.round(mins/Number(r.distance)*100)/100}});
  var pCtx=document.getElementById('runPaceChart');
  if(pCtx&&pacePoints.length)runCharts.pace=new Chart(pCtx,{type:'line',data:{labels:pacePoints.map(function(p){return fmtDate(p.date)}),datasets:[{data:pacePoints.map(function(p){return p.pace}),borderColor:'#a0522d',backgroundColor:'rgba(160,82,45,0.08)',tension:.3,pointRadius:4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#b89870',font:{size:10}}},y:{reverse:true,ticks:{color:'#b89870',font:{size:10},callback:function(v){return v.toFixed(1)+' min/km'}}}}}});

  // Run list
  var rlEl=document.getElementById('runs-list-workout');
  if(rlEl)rlEl.innerHTML=runs.length?runs.slice().reverse().map(function(r){
    var pStr='';if(r.time&&r.distance){var pp=r.time.split(':');var pm=(Number(pp[0]||0)+Number(pp[1]||0)/60)/Number(r.distance);pStr=' · '+pm.toFixed(2)+' min/km'}
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="font-size:20px">&#127939;</span><div style="flex:1"><div style="font-size:13px;font-weight:500">'+r.distance+'km'+(r.time?' · '+r.time:'')+pStr+'</div><div style="font-size:11px;color:var(--text2)">'+fmtDate(r.date)+(r.note?' · '+r.note:'')+'</div></div><button class="btn btn-sm btn-danger" onclick="deleteRunFromWorkout(\''+r.id+'\')">&#215;</button></div>';
  }).join(''):'<div class="empty"><div class="empty-icon">&#127939;</div>No runs logged yet.</div>';
}

function saveRunFromWorkout(){
  var dist=(document.getElementById('m-rundist')||{}).value;if(!dist)return;
  var date=(document.getElementById('m-rundate')||{}).value||localDateKey(new Date());
  var time=(document.getElementById('m-runtime')||{}).value||'';
  var note=(document.getElementById('m-runnote')||{}).value||'';
  if(!STATE.metrics)STATE.metrics={};if(!STATE.metrics.run)STATE.metrics.run=[];
  STATE.metrics.run.push({id:g(),date:date,distance:Number(dist),time:time,note:note});
  autoTickHabit('run',date);saveState();closeModal();renderWorkout();
  var runsTab=document.getElementById('workout-runs');
  if(runsTab&&runsTab.classList.contains('active'))renderRunsTab();
}

function deleteRunFromWorkout(id){
  confirmDelete('Delete this run?',function(){
    if(!STATE.metrics||!STATE.metrics.run)return;
    STATE.metrics.run=STATE.metrics.run.filter(function(r){return r.id!==id});
    saveState();renderRunsTab();renderWorkout();
  });
}

// Editable weekly plan
function renderMyPlanSchedule(){
  var el=document.getElementById('myplan-schedule');if(!el)return;
  var plan=getWeeklyPlanData();
  var colorMap={
    'Upper':{bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
    'Lower':{bg:'var(--accent-dim)',br:'rgba(160,82,45,0.2)',c:'var(--accent)',badge:'badge-fin'},
    'Hyrox':{bg:'var(--mauve-dim)',br:'rgba(155,123,138,0.25)',c:'var(--mauve)',badge:'badge-fit'},
    'Run':{bg:'var(--mint-dim)',br:'rgba(107,158,122,0.25)',c:'var(--mint)',badge:'badge-per'},
    'Rest':{bg:'var(--bg3)',br:'var(--border)',c:'var(--text3)',badge:''},
    'Other':{bg:'var(--blue-dim)',br:'rgba(100,149,237,0.25)',c:'var(--blue)',badge:''}
  };
  el.innerHTML=plan.map(function(d,i){
    var cm=colorMap[d.type]||colorMap['Other'];
    return '<div style="background:'+cm.bg+';border:1px solid '+cm.br+';border-radius:var(--radius-sm);padding:10px 8px;min-height:110px;cursor:pointer" onclick="openModal(\'editPlanDay\','+i+')">'
      +'<div style="font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:'+cm.c+';margin-bottom:6px">'+d.day+'</div>'
      +'<span class="badge '+cm.badge+'" style="font-size:9px;padding:2px 7px;margin-bottom:6px;display:inline-block'+(cm.badge?'':';background:var(--bg4);color:var(--text3)')+'">'+d.type+'</span>'
      +'<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px">'+d.title+'</div>'
      +'<div style="font-size:10px;color:var(--text2)">'+d.sub+'</div></div>';
  }).join('');
}

function savePlanDay(){
  var idx=Number((document.getElementById('m-planidx')||{}).value);
  var type=(document.getElementById('m-plantype')||{}).value||'Rest';
  var title=(document.getElementById('m-plantitle')||{}).value||type;
  var sub=(document.getElementById('m-plansub')||{}).value||'';
  var plan=getWeeklyPlanData();
  plan[idx]={day:plan[idx].day,type:type,title:title,sub:sub};
  STATE.weeklyPlan=plan;
  saveState();closeModal();renderMyPlanSchedule();
}
