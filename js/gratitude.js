// GRATITUDE
// ============================================================
function renderGratitude(){var entries=(STATE.gratitude||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date)});var thisWeekStart=weekKey(new Date());var thisWeek=entries.filter(function(e){return e.date>=thisWeekStart});var streak=0;var checkDate=new Date();for(var i=0;i<365;i++){var k=localDateKey(checkDate);if(entries.some(function(e){return e.date===k}))streak++;else if(i>0)break;checkDate.setDate(checkDate.getDate()-1)}var gwEl=document.getElementById('gratitude-wins');if(gwEl)gwEl.innerHTML=thisWeek.length?thisWeek.map(function(e){return '<div style="padding:9px 0;border-bottom:1px solid var(--border)"><div style="font-size:11px;color:var(--text3);margin-bottom:3px">'+fmtDate(e.date)+'</div>'+(e.wins?'<div style="font-size:13px;font-weight:500;margin-bottom:3px;color:var(--accent)">&#127942; '+e.wins+'</div>':'')+(e.gratitude?'<div style="font-size:12px;color:var(--text2)">'+e.gratitude.split('\n').filter(function(l){return l.trim()}).map(function(l){return '&#128591; '+l.replace(/^\d+.\s*/,'')}).join(' &#183; ')+'</div>':'')+'</div>'}).join(''):'<div style="font-size:13px;color:var(--text3);padding:12px 0;text-align:center">No entries this week yet</div>';var gsEl=document.getElementById('gratitude-stats');if(gsEl)gsEl.innerHTML='<div style="text-align:center;padding:16px 0"><div style="font-size:44px;font-family:var(--serif);font-weight:600;color:var(--gold)">'+streak+'</div><div style="font-size:13px;color:var(--text2);margin-top:3px">day gratitude streak</div><div style="font-size:12px;color:var(--text3);margin-top:6px">'+entries.length+' total entries</div></div>';var gaEl=document.getElementById('gratitude-all');if(gaEl)gaEl.innerHTML=entries.length?entries.slice(0,20).map(function(e){return '<div style="padding:11px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="font-size:12px;font-weight:600">'+fmtDate(e.date)+'</span><button class="btn btn-sm btn-danger" onclick="confirmDelete(\'Delete?\',function(){deleteGratitudeEntry(\''+e.id+'\')})">&#215;</button></div>'+(e.wins?'<div style="font-size:12px;font-weight:500;margin-bottom:3px;color:var(--accent)">&#127942; '+e.wins+'</div>':'')+(e.gratitude?'<div style="font-size:12px;color:var(--text2)">'+e.gratitude.split('\n').filter(function(l){return l.trim()}).map(function(l){return '&#128591; '+l.replace(/^\d+.\s*/,'')}).join('<br>')+'</div>':'')+'</div>'}).join(''):'<div class="empty"><div class="empty-icon">&#128591;</div>No entries yet.</div>';renderGratitudeFlashback();renderGratitudeHeatmap()}
function deleteGratitudeEntry(id){STATE.gratitude=(STATE.gratitude||[]).filter(function(e){return e.id!==id});saveState();renderGratitude()}
function saveGratitudeEntry(){var date=(document.getElementById('m-gdate')||{}).value||localDateKey(new Date());var wins=(document.getElementById('m-gwins')||{}).value||'';var gratitude=(document.getElementById('m-ggratitude')||{}).value||'';if(!wins&&!gratitude)return;if(!STATE.gratitude)STATE.gratitude=[];var isFirstEver=STATE.gratitude.length===0;STATE.gratitude.push({id:g(),date:date,wins:wins,gratitude:gratitude});saveState();closeModal();renderGratitude();if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();celebrateGratitudeMilestone(date,isFirstEver)}
function celebrateGratitudeMilestone(entryDate,isFirstEver){
  if(entryDate!==localDateKey(new Date()))return;
  if(isFirstEver){fireConfetti({count:80});showCelebrationToast('First gratitude entry — welcome in.','🙏');return}
  // Compute current streak
  var entries=STATE.gratitude||[];
  var streak=0;var checkDate=new Date();
  for(var i=0;i<365;i++){
    var k=localDateKey(checkDate);
    if(entries.some(function(e){return e.date===k}))streak++;
    else if(i>0)break;
    checkDate.setDate(checkDate.getDate()-1);
  }
  if(streak===3){fireConfetti({count:70});showCelebrationToast('3 day gratitude streak — it\'s becoming a habit.','🙏')}
  else if(streak===7){fireConfetti({count:100});showCelebrationToast('A full week of gratitude!','✨')}
  else if(streak===14){fireConfetti({count:130});showCelebrationToast('Two weeks of gratitude — beautiful consistency.','💛')}
  else if(streak===30){fireConfetti({count:180,duration:3500});showCelebrationToast('30 days of gratitude — a life practice.','🌟')}
  else if(streak===100){fireConfetti({count:220,duration:4000});showCelebrationToast('100 days. You are a person of gratitude.','🏆')}
}

// ============================================================
// DAILY HIGHLIGHT & CLOCK
// ============================================================
function saveDailyHighlight(){var today=localDateKey(new Date());var val=(document.getElementById('daily-highlight')||{}).value||'';if(!STATE.dailyHighlights)STATE.dailyHighlights={};STATE.dailyHighlights[today]=val;saveState();var btn=event.target;var orig=btn.textContent;btn.textContent='Saved!';setTimeout(function(){btn.textContent=orig},1500)}
function loadDailyHighlight(){var today=localDateKey(new Date());var el=document.getElementById('daily-highlight');if(el)el.value=(STATE.dailyHighlights||{})[today]||''}
function startClock(){function tick(){var now=new Date();var timeStr=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});var dateStr=now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});var sdEl=document.getElementById('sidebar-date');if(sdEl)sdEl.textContent=timeStr+' · '+dateStr;var mdEl=document.getElementById('mobile-date');if(mdEl)mdEl.textContent=timeStr}tick();setInterval(tick,1000)}

// ============================================================
// MOOD
// ============================================================
function renderDashMoodCheckin(){var el=document.getElementById('dash-mood-checkin');if(!el)return;var today=localDateKey(new Date());var m=(STATE.mood||{})[today]||{};var moodEm=['','&#128542;','&#128528;','&#128578;','&#128522;','&#129321;'];var energyEm=['','&#129803;','&#128564;','&#9889;','&#128293;','&#128640;'];var moodLabels=['','Low','Meh','Okay','Good','Great'];var energyLabels=['','Drained','Tired','Okay','High','Buzzing'];if(m.mood){el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr'+(m.sleep?' 1fr':'')+';gap:8px"><div style="display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.3);padding:12px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.4)"><span style="font-size:24px;margin-bottom:4px">'+(moodEm[m.mood]||'&#8212;')+'</span><span style="font-size:10px;color:var(--neutral);text-transform:uppercase;font-weight:600">Mood</span><span style="font-size:12px;font-weight:700;color:var(--primary)">'+(moodLabels[m.mood]||'')+'</span></div><div style="display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.3);padding:12px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.4)"><span style="font-size:24px;margin-bottom:4px">'+(energyEm[m.energy]||'&#8212;')+'</span><span style="font-size:10px;color:var(--neutral);text-transform:uppercase;font-weight:600">Energy</span><span style="font-size:12px;font-weight:700;color:var(--peach)">'+(energyLabels[m.energy]||'')+'</span></div>'+(m.sleep?'<div style="display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.3);padding:12px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.4)"><span style="font-size:24px;margin-bottom:4px">&#128564;</span><span style="font-size:10px;color:var(--neutral);text-transform:uppercase;font-weight:600">Sleep</span><span style="font-size:12px;font-weight:700;color:var(--secondary)">'+m.sleep+'h</span></div>':'')+'</div><button class="btn btn-ghost btn-sm" onclick="openModal(\'logMood\',\''+today+'\')" style="margin-top:10px;width:100%;justify-content:center">Edit check-in</button>'}else{el.innerHTML='<div style="font-size:13px;color:var(--text2);margin-bottom:10px">How are you feeling today?</div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><div style="display:flex;gap:5px">'+['&#128542;','&#128528;','&#128578;','&#128522;','&#129321;'].map(function(e,i){return '<button onclick="quickLogMood('+(i+1)+',\''+today+'\')" style="font-size:22px;background:var(--bg3);border:1.5px solid var(--border2);border-radius:10px;padding:5px 7px;cursor:pointer">'+e+'</button>'}).join('')+'</div><button class="btn btn-sm" onclick="openModal(\'logMood\',\''+today+'\')" style="margin-left:auto">Full check-in</button></div>'}}
function quickLogMood(moodVal,date){if(!STATE.mood)STATE.mood={};if(!STATE.mood[date])STATE.mood[date]={};STATE.mood[date].mood=moodVal;saveState();renderDashMoodCheckin()}

function renderWaterInto(el){
  if(!el)return;
  var today=localDateKey(new Date());
  if(!STATE.water)STATE.water={};
  var glasses=STATE.water[today]||0;
  var target=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  var ml=Number((STATE.waterSettings&&STATE.waterSettings.glassMl)||250);
  var totalMl=glasses*ml;
  var targetMl=target*ml;
  var totalL=(totalMl/1000).toFixed(totalMl>=1000?1:2);
  var targetL=(targetMl/1000).toFixed(targetMl>=1000?1:2);
  var pct=Math.min(100,Math.round((glasses/Math.max(1,target))*100));
  var progressColor=glasses>=target?'var(--mint)':glasses>=Math.ceil(target/2)?'var(--secondary)':'var(--text2)';

  el.innerHTML=''
    +'<div class="water-hero">'
      +'<div class="water-num"><span class="water-glasses">'+glasses+'</span><span class="water-divider">/</span><span class="water-target">'+target+'</span><span class="water-unit">glasses</span></div>'
      +'<div class="water-ml">'+totalL+'L of '+targetL+'L · '+pct+'%</div>'
    +'</div>'
    +'<div class="water-bar"><div class="water-bar-fill" style="width:'+pct+'%;background:'+progressColor+'"></div></div>'
    +'<div class="water-glass-row">'
      +Array.from({length:target},function(_,i){
        var filled=i<glasses;
        return '<button class="water-glass'+(filled?' filled':'')+'" onclick="logWaterGlass('+(filled?i:i+1)+')" title="Glass '+(i+1)+'">💧</button>';
      }).join('')
    +'</div>'
    +'<div class="water-actions">'
      +'<button class="btn btn-sm btn-accent" onclick="logWaterGlass('+(glasses+1)+')">+ Add glass</button>'
      +(glasses>0?'<button class="btn btn-sm btn-ghost" onclick="logWaterGlass('+(glasses-1)+')">Undo</button>':'')
      +'<button class="btn btn-sm btn-ghost" onclick="openModal(\'waterSettings\')" title="Adjust target or glass size">⚙️</button>'
    +'</div>';
}
function renderDashWater(){renderWaterInto(document.getElementById('dash-water-tracker'))}
function renderMetricsWater(){
  renderWaterInto(document.getElementById('metrics-water-tracker'));
  var hEl=document.getElementById('metrics-water-history');
  if(!hEl)return;
  var days=[];
  for(var i=6;i>=0;i--){
    var d=new Date();d.setDate(d.getDate()-i);
    var k=localDateKey(d);
    var count=(STATE.water||{})[k]||0;
    days.push({date:d,key:k,count:count});
  }
  var target=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  hEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;padding:10px 0">'+days.map(function(d){
    var pct=Math.min(100,(d.count/target)*100);
    var dayLabel=d.date.toLocaleDateString('en-GB',{weekday:'short'});
    return '<div style="text-align:center"><div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">'+dayLabel+'</div><div style="height:80px;background:var(--bg3);border-radius:10px;position:relative;overflow:hidden;display:flex;align-items:flex-end"><div style="width:100%;height:'+pct+'%;background:linear-gradient(180deg,#7CA5C2,#A5C4DC);transition:height 0.5s var(--ease)"></div></div><div style="font-size:11px;font-weight:600;color:var(--fg);margin-top:6px">'+d.count+'/'+target+'</div></div>';
  }).join('')+'</div>';
}
function logWaterGlass(count){
  var today=localDateKey(new Date());
  if(!STATE.water)STATE.water={};
  var prev=STATE.water[today]||0;
  STATE.water[today]=Math.max(0,count);
  saveState();
  renderDashWater();
  renderMetricsWater();
  // Celebrate hitting the daily target (crossing, not already there)
  var target=Number((STATE.waterSettings&&STATE.waterSettings.target)||8);
  if(prev<target&&STATE.water[today]>=target){
    celebrateOnce('water-goal',function(){
      fireConfetti({count:60,duration:1800,colors:['#7CA5C2','#A5C4DC','#5A8FB0','#89B5D1']});
      showCelebrationToast('Hydration goal hit!','💧');
    });
  }
}

function saveWaterSettings(){
  var t=Number((document.getElementById('m-water-target')||{}).value)||8;
  var ml=Number((document.getElementById('m-water-ml')||{}).value)||250;
  if(!STATE.waterSettings)STATE.waterSettings={};
  STATE.waterSettings.target=Math.max(1,Math.min(20,t));
  STATE.waterSettings.glassMl=Math.max(50,Math.min(2000,ml));
  saveState();
  closeModal();
  renderDashWater();
  renderMetricsWater();
}



// ── GRATITUDE FLASHBACK & HEATMAP ──
function renderGratitudeFlashback(){
  var card=document.getElementById('gratitude-flashback-card');
  var el=document.getElementById('gratitude-flashback');
  if(!card||!el)return;
  var entries=STATE.gratitude||[];
  if(!entries.length){card.style.display='none';return}
  // Try to find an entry from ~1 year, 6 months, 3 months, 1 month ago (in that order of preference)
  var today=new Date();
  var targets=[{days:365,label:'A year ago today'},{days:180,label:'6 months ago'},{days:90,label:'3 months ago'},{days:30,label:'A month ago'}];
  var found=null;
  for(var i=0;i<targets.length;i++){
    var t=new Date(today);t.setDate(t.getDate()-targets[i].days);
    // Find entry within ±3 days of target for some forgiveness
    var best=null;var bestDiff=999;
    entries.forEach(function(e){
      if(!e.date)return;
      var parts=e.date.split('-');
      var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
      var diff=Math.abs((d-t)/86400000);
      if(diff<=3&&diff<bestDiff){best=e;bestDiff=diff}
    });
    if(best){found={entry:best,label:targets[i].label};break}
  }
  if(!found){card.style.display='none';return}
  var e=found.entry;
  var parts=e.date.split('-');
  var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  var dateStr=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var html='<div style="padding:14px 4px 8px"><div style="font-size:11px;color:var(--accent-dark);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">'+found.label+'</div><div style="font-size:12px;color:var(--text3);margin-bottom:12px">'+dateStr+'</div>';
  if(e.wins)html+='<div style="font-size:14px;font-weight:500;margin-bottom:10px;color:var(--accent);line-height:1.5"><span style="margin-right:6px">&#127942;</span>'+e.wins+'</div>';
  if(e.gratitude){
    var lines=e.gratitude.split('\n').filter(function(l){return l.trim()}).map(function(l){return l.replace(/^\d+\.\s*/,'')});
    html+='<div style="font-size:13px;color:var(--text2);line-height:1.6">'+lines.map(function(l){return '<div style="display:flex;gap:8px;padding:3px 0"><span style="color:var(--gold)">&#128591;</span><span>'+l+'</span></div>'}).join('')+'</div>';
  }
  html+='<div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)"><button class="btn btn-ghost btn-sm" onclick="gratitudeFlashbackNext()">Show me another →</button><button class="btn btn-ghost btn-sm" onclick="gratitudeFlashbackDismiss()" style="color:var(--text3)">Dismiss for today</button></div>';
  html+='</div>';
  el.innerHTML=html;
  // Check dismissal
  var dismissed=null;try{dismissed=sessionStorage.getItem('lh_flashback_dismissed')}catch(err){}
  card.style.display=(dismissed===localDateKey(new Date()))?'none':'';
}
function gratitudeFlashbackNext(){
  // Just re-render with a random older entry (>14 days old)
  var el=document.getElementById('gratitude-flashback');
  if(!el)return;
  var entries=STATE.gratitude||[];
  var todayKey=localDateKey(new Date());
  var two=new Date();two.setDate(two.getDate()-14);var cutoff=localDateKey(two);
  var pool=entries.filter(function(e){return e.date&&e.date<cutoff});
  if(!pool.length)return;
  var e=pool[Math.floor(Math.random()*pool.length)];
  var parts=e.date.split('-');
  var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  var today=new Date();
  var daysAgo=Math.round((today-d)/86400000);
  var label=daysAgo>=365?Math.floor(daysAgo/365)+' year'+(daysAgo>=730?'s':'')+' ago':daysAgo>=30?Math.floor(daysAgo/30)+' month'+(daysAgo>=60?'s':'')+' ago':daysAgo+' days ago';
  var dateStr=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var html='<div style="padding:14px 4px 8px"><div style="font-size:11px;color:var(--accent-dark);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">'+label+'</div><div style="font-size:12px;color:var(--text3);margin-bottom:12px">'+dateStr+'</div>';
  if(e.wins)html+='<div style="font-size:14px;font-weight:500;margin-bottom:10px;color:var(--accent);line-height:1.5"><span style="margin-right:6px">&#127942;</span>'+e.wins+'</div>';
  if(e.gratitude){
    var lines=e.gratitude.split('\n').filter(function(l){return l.trim()}).map(function(l){return l.replace(/^\d+\.\s*/,'')});
    html+='<div style="font-size:13px;color:var(--text2);line-height:1.6">'+lines.map(function(l){return '<div style="display:flex;gap:8px;padding:3px 0"><span style="color:var(--gold)">&#128591;</span><span>'+l+'</span></div>'}).join('')+'</div>';
  }
  html+='<div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)"><button class="btn btn-ghost btn-sm" onclick="gratitudeFlashbackNext()">Show me another →</button><button class="btn btn-ghost btn-sm" onclick="gratitudeFlashbackDismiss()" style="color:var(--text3)">Dismiss for today</button></div>';
  html+='</div>';
  el.innerHTML=html;
}
function gratitudeFlashbackDismiss(){
  try{sessionStorage.setItem('lh_flashback_dismissed',localDateKey(new Date()))}catch(e){}
  var card=document.getElementById('gratitude-flashback-card');
  if(card)card.style.display='none';
}

function renderGratitudeHeatmap(){
  var el=document.getElementById('gratitude-heatmap');
  if(!el)return;
  var entries=STATE.gratitude||[];
  // Build a set of logged dates
  var logged={};
  entries.forEach(function(e){if(e.date)logged[e.date]=true});

  // Build 53-week grid ending today (GitHub-style)
  var today=new Date();today.setHours(0,0,0,0);
  var end=new Date(today);
  // Start: 52 weeks ago, snapped back to the nearest Sunday
  var start=new Date(end);
  start.setDate(start.getDate()-(52*7));
  while(start.getDay()!==0)start.setDate(start.getDate()-1);

  var weeks=[];
  var cur=new Date(start);
  var totalDays=0,loggedDays=0;
  while(cur<=end){
    var week=[];
    for(var i=0;i<7;i++){
      if(cur>end){week.push(null)}
      else{
        var k=localDateKey(cur);
        var isLogged=!!logged[k];
        week.push({key:k,logged:isLogged,date:new Date(cur)});
        totalDays++;
        if(isLogged)loggedDays++;
      }
      cur.setDate(cur.getDate()+1);
    }
    weeks.push(week);
  }

  // Month labels (show month when it changes across weeks, at week index)
  var monthLabels=[];
  var lastMonth=-1;
  weeks.forEach(function(w,wi){
    var firstDay=w[0];
    if(!firstDay)return;
    var m=firstDay.date.getMonth();
    if(m!==lastMonth){
      monthLabels.push({wi:wi,label:firstDay.date.toLocaleDateString('en-GB',{month:'short'})});
      lastMonth=m;
    }
  });

  var consistencyPct=totalDays>0?Math.round((loggedDays/totalDays)*100):0;

  var html='<div class="gr-heatmap-wrap">';
  html+='<div class="gr-heatmap-summary"><div><span class="gr-heatmap-stat">'+loggedDays+'</span><span class="gr-heatmap-stat-label">days logged</span></div><div><span class="gr-heatmap-stat">'+consistencyPct+'%</span><span class="gr-heatmap-stat-label">of the year</span></div></div>';
  html+='<div class="gr-heatmap-scroll">';
  html+='<div class="gr-heatmap-months">'+monthLabels.map(function(m){return '<span style="grid-column:'+(m.wi+2)+' / span 1">'+m.label+'</span>'}).join('')+'</div>';
  html+='<div class="gr-heatmap-body">';
  // Day labels column
  html+='<div class="gr-heatmap-days"><span></span><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span></div>';
  // Week columns
  weeks.forEach(function(w){
    html+='<div class="gr-heatmap-week">'+w.map(function(d){
      if(!d)return '<div class="gr-heatmap-cell gr-heatmap-empty"></div>';
      var dateStr=d.date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      var title=d.logged?'✓ '+dateStr:dateStr+' — nothing logged';
      return '<div class="gr-heatmap-cell'+(d.logged?' gr-heatmap-logged':'')+'" title="'+title+'"></div>';
    }).join('')+'</div>';
  });
  html+='</div></div></div>';
  el.innerHTML=html;
}
