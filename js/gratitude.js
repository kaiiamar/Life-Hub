// GRATITUDE
// ============================================================
function renderGratitude(){var entries=(STATE.gratitude||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date)});var thisWeekStart=weekKey(new Date());var thisWeek=entries.filter(function(e){return e.date>=thisWeekStart});var streak=0;var checkDate=new Date();for(var i=0;i<365;i++){var k=localDateKey(checkDate);if(entries.some(function(e){return e.date===k}))streak++;else if(i>0)break;checkDate.setDate(checkDate.getDate()-1)}var gwEl=document.getElementById('gratitude-wins');if(gwEl)gwEl.innerHTML=thisWeek.length?thisWeek.map(function(e){return '<div style="padding:9px 0;border-bottom:1px solid var(--border)"><div style="font-size:11px;color:var(--text3);margin-bottom:3px">'+fmtDate(e.date)+'</div>'+(e.wins?'<div style="font-size:13px;font-weight:500;margin-bottom:3px;color:var(--accent)">&#127942; '+e.wins+'</div>':'')+(e.gratitude?'<div style="font-size:12px;color:var(--text2)">'+e.gratitude.split('\n').filter(function(l){return l.trim()}).map(function(l){return '&#128591; '+l.replace(/^\d+.\s*/,'')}).join(' &#183; ')+'</div>':'')+'</div>'}).join(''):'<div style="font-size:13px;color:var(--text3);padding:12px 0;text-align:center">No entries this week yet</div>';var gsEl=document.getElementById('gratitude-stats');if(gsEl)gsEl.innerHTML='<div style="text-align:center;padding:16px 0"><div style="font-size:44px;font-family:var(--serif);font-weight:600;color:var(--gold)">'+streak+'</div><div style="font-size:13px;color:var(--text2);margin-top:3px">day gratitude streak</div><div style="font-size:12px;color:var(--text3);margin-top:6px">'+entries.length+' total entries</div></div>';var gaEl=document.getElementById('gratitude-all');if(gaEl)gaEl.innerHTML=entries.length?entries.slice(0,20).map(function(e){return '<div style="padding:11px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="font-size:12px;font-weight:600">'+fmtDate(e.date)+'</span><button class="btn btn-sm btn-danger" onclick="confirmDelete(\'Delete?\',function(){deleteGratitudeEntry(\''+e.id+'\')})">&#215;</button></div>'+(e.wins?'<div style="font-size:12px;font-weight:500;margin-bottom:3px;color:var(--accent)">&#127942; '+e.wins+'</div>':'')+(e.gratitude?'<div style="font-size:12px;color:var(--text2)">'+e.gratitude.split('\n').filter(function(l){return l.trim()}).map(function(l){return '&#128591; '+l.replace(/^\d+.\s*/,'')}).join('<br>')+'</div>':'')+'</div>'}).join(''):'<div class="empty"><div class="empty-icon">&#128591;</div>No entries yet.</div>'}
function deleteGratitudeEntry(id){STATE.gratitude=(STATE.gratitude||[]).filter(function(e){return e.id!==id});saveState();renderGratitude()}
function saveGratitudeEntry(){var date=(document.getElementById('m-gdate')||{}).value||localDateKey(new Date());var wins=(document.getElementById('m-gwins')||{}).value||'';var gratitude=(document.getElementById('m-ggratitude')||{}).value||'';if(!wins&&!gratitude)return;if(!STATE.gratitude)STATE.gratitude=[];STATE.gratitude.push({id:g(),date:date,wins:wins,gratitude:gratitude});saveState();closeModal();renderGratitude();if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard()}

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
  var target=8;
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:10px;font-weight:700;color:var(--neutral);text-transform:uppercase;letter-spacing:.06em">Hydration</span><span style="font-size:11px;font-weight:700;color:var(--secondary)">'+glasses+'/'+target+'</span></div><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 0">'+Array.from({length:target},function(_,i){var filled=i<glasses;return '<span onclick="logWaterGlass('+(filled?i:i+1)+')" style="font-size:24px;cursor:pointer;transition:all .15s;opacity:'+(filled?'1':'0.25')+'">\uD83D\uDCA7</span>'}).join('')+'</div>'+(glasses>0?'<button class="btn btn-ghost btn-sm" onclick="logWaterGlass('+(glasses-1)+')" style="margin-top:8px;width:100%;justify-content:center;font-size:10px">Undo last</button>':'');
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
  hEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;padding:10px 0">'+days.map(function(d){
    var pct=Math.min(100,(d.count/8)*100);
    var dayLabel=d.date.toLocaleDateString('en-GB',{weekday:'short'});
    return '<div style="text-align:center"><div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">'+dayLabel+'</div><div style="height:80px;background:var(--bg3);border-radius:10px;position:relative;overflow:hidden;display:flex;align-items:flex-end"><div style="width:100%;height:'+pct+'%;background:linear-gradient(180deg,#7CA5C2,#A5C4DC);transition:height 0.5s var(--ease)"></div></div><div style="font-size:11px;font-weight:600;color:var(--fg);margin-top:6px">'+d.count+'/8</div></div>';
  }).join('')+'</div>';
}
function logWaterGlass(count){
  var today=localDateKey(new Date());
  if(!STATE.water)STATE.water={};
  STATE.water[today]=Math.max(0,count);
  saveState();
  renderDashWater();
  renderMetricsWater();
}

