// SKINCARE — tracking + customisable actives + editable routine
// ============================================================

// Default product lists — seeded into STATE.skincare.products on first use
var SKINCARE_AM_DEFAULT=[
  {name:'CeraVe Blemish Control Cleanser',desc:'Cleanse, rinse, pat dry. Salicylic acid keeps T-zone oiliness in check.'},
  {name:'e.l.f. Keep Your Balance Toner',desc:'Apply with a cotton pad or pat in with hands. Preps skin for serums.'},
  {name:'Garnier Vitamin C Brightening Serum',desc:'Main brightening + PIH-fighting step. Apply and wait 30 seconds before next product.',tag:'⭐ Key step',tagColor:'var(--gold)'},
  {name:'The Ordinary Multi-Antioxidant Radiance Serum',desc:'Layer on top of Vitamin C for extra radiance and environmental protection.'},
  {name:'Simple Hyaluronic Acid & B5 Serum',desc:'Apply to slightly damp skin for maximum hydration.'},
  {name:'B. by Superdrug Defence Moisturiser SPF 50',desc:'Last step — covers moisturiser and SPF in one. UV exposure darkens PIH significantly.',tag:'🚨 Non-negotiable',tagColor:'var(--rose)'}
];
var SKINCARE_PM_DEFAULT=[
  {name:'CeraVe Blemish Control Cleanser',desc:'If worn SPF all day, use micellar water or cleansing balm first, then follow with this.'},
  {name:'e.l.f. Keep Your Balance Toner',desc:'Apply with a cotton pad or pat in with hands.'},
  {name:'Simple Hyaluronic Acid & B5 Serum',desc:'Pat into skin after toner for hydration layer.'},
  {name:'The Ordinary Natural Moisturising Factors + HA',desc:'Seal everything in with moisturiser.'},
  {name:'Dr. Organic Overnight Recovery Oil',desc:'2–3 drops pressed in as the absolute final step to lock everything in overnight.'}
];

// Default actives — user can add/edit/delete. Note: "none" is always available.
var SKINCARE_ACTIVES_DEFAULT=[
  {id:'topicals',name:'Topicals Faded',emoji:'✨',note:'Brightening serum for PIH — tranexamic acid, kojic acid, niacinamide. Apply before moisturiser.',color:'#D4845A'},
  {id:'rest',name:'Rest night',emoji:'🌿',note:'No active — just cleanse, hydrate, moisturise, oil. Let the skin reset.',color:'#6B9E7A'}
];

// Default 7-day schedule (dayOfWeek → {activeId, guaSha})
var SKINCARE_SCHEDULE_DEFAULT={
  0:{activeId:'rest',guaSha:false},     // Sun
  1:{activeId:'topicals',guaSha:true},  // Mon
  2:{activeId:'rest',guaSha:false},     // Tue — was "topicals" but user prefers rest between
  3:{activeId:'topicals',guaSha:true},  // Wed
  4:{activeId:'rest',guaSha:false},     // Thu
  5:{activeId:'topicals',guaSha:true},  // Fri
  6:{activeId:'rest',guaSha:false}      // Sat
};

var GUASHA_PREP=[
  {name:'Cleanse thoroughly',desc:'Full PM cleanse complete. Skin should be clean with no traces of makeup or SPF.'},
  {name:'Apply your toner',desc:'e.l.f. toner as usual to balance and prep the skin.'},
  {name:'Apply Dr. Organic face oil',desc:'3–4 drops warmed between your palms, then pressed into skin. This is your slip — the stone must never drag or pull on bare skin.'},
  {name:'Hold the stone at a flat angle',desc:'Keep it almost flat against your skin — around 15°. Never hold it upright. Use light, gentle pressure throughout.'}
];
var GUASHA_MOVES=[
  {dir:'↓',area:'Neck — always first',desc:'Use the flat edge. Stroke downward from jaw to collarbone — this opens the lymph nodes before you work the face. 5 slow strokes each side.'},
  {dir:'↗',area:'Jawline & chin',desc:'Place the curved edge along your chin. Sweep outward along the jaw toward your ear. 5–6 strokes each side.'},
  {dir:'↗',area:'Cheeks',desc:'Start beside your nose and sweep outward and upward across the cheekbone toward the hairline. 5–6 strokes each side.'},
  {dir:'→',area:'Under eyes',desc:'Use the small notch or curved edge. Sweep gently outward from inner corner to temple. Very light pressure — this skin is delicate. 3 strokes each side.'},
  {dir:'↑',area:'Forehead',desc:'Sweep upward from brow to hairline, then outward from centre to temples. 5 strokes in each direction.'},
  {dir:'↓',area:'Neck again — always last',desc:'Finish by sweeping down the neck toward the collarbone to drain everything you\'ve moved. 5 strokes each side.'}
];

// ── STATE helpers ──
function _skinState(){
  if(!STATE.skincare)STATE.skincare={};
  var s=STATE.skincare;
  if(!s.products)s.products={};
  if(!s.products.am||!s.products.am.length)s.products.am=SKINCARE_AM_DEFAULT.map(function(p){return Object.assign({},p)});
  if(!s.products.pm||!s.products.pm.length)s.products.pm=SKINCARE_PM_DEFAULT.map(function(p){return Object.assign({},p)});
  if(!s.actives||!s.actives.length)s.actives=SKINCARE_ACTIVES_DEFAULT.map(function(a){return Object.assign({},a)});
  if(!s.nightSchedule||!Object.keys(s.nightSchedule).length){
    s.nightSchedule={};
    Object.keys(SKINCARE_SCHEDULE_DEFAULT).forEach(function(k){s.nightSchedule[k]=Object.assign({},SKINCARE_SCHEDULE_DEFAULT[k])});
  }
  // Migrate from v1 (guaShaDays → nightSchedule)
  if(s.guaShaDays&&!s._migrated){
    Object.keys(s.guaShaDays).forEach(function(d){
      if(s.nightSchedule[d])s.nightSchedule[d].guaSha=!!s.guaShaDays[d];
    });
    s._migrated=true;
  }
  if(!s.guaShaLog)s.guaShaLog={};
  if(!s.activeLog)s.activeLog={};
  if(!s.photos)s.photos=[];
  return s;
}

function _findSkincareHabit(period){
  var needle='skincare '+period.toLowerCase();
  return (STATE.habits||[]).find(function(h){return h.name.toLowerCase().indexOf(needle)!==-1});
}
function _activeById(id){
  var s=_skinState();
  return s.actives.find(function(a){return a.id===id});
}

// ── RENDER ENTRY POINT ──
function renderSkincare(){
  _skinState();
  renderSkincareToday();
  renderSkincareRoutine();
  renderSkincareGuide();
}

// ── TAB 1: TODAY ──
function renderSkincareToday(){
  var el=document.getElementById('skincare-today');
  if(!el)return;
  var s=_skinState();
  var todayKey=localDateKey(new Date());
  var amHabit=_findSkincareHabit('AM');
  var pmHabit=_findSkincareHabit('PM');
  var amDone=amHabit&&amHabit.logs&&amHabit.logs[todayKey];
  var pmDone=pmHabit&&pmHabit.logs&&pmHabit.logs[todayKey];

  if((amDone||pmDone)&&!s.startedOn){
    s.startedOn=todayKey;saveState();
  }

  // Tonight's active from schedule
  var dayOfWeek=new Date().getDay();
  var slot=s.nightSchedule[dayOfWeek]||{activeId:'rest',guaSha:false};
  var scheduledActive=_activeById(slot.activeId)||{name:'Rest',emoji:'🌿',note:''};
  var scheduledGuaSha=!!slot.guaSha;
  var guaShaDone=!!s.guaShaLog[todayKey];
  var todayActiveId=s.activeLog[todayKey];  // what you actually used tonight (if logged)

  var html='';

  // Progress hero
  if(s.startedOn){
    var started=new Date(s.startedOn+'T12:00:00');
    var daysIn=Math.max(1,Math.floor((new Date()-started)/86400000)+1);
    var weeksIn=Math.ceil(daysIn/7);

    var history7=[];
    for(var i=6;i>=0;i--){
      var d=new Date();d.setDate(d.getDate()-i);
      var k=localDateKey(d);
      history7.push({
        key:k,date:d,
        am:amHabit&&amHabit.logs&&amHabit.logs[k],
        pm:pmHabit&&pmHabit.logs&&pmHabit.logs[k],
        gua:!!s.guaShaLog[k],
        activeId:s.activeLog[k]
      });
    }

    var streak=0;var check=new Date();
    for(var j=0;j<365;j++){
      var ck=localDateKey(check);
      var hasTick=(amHabit&&amHabit.logs&&amHabit.logs[ck])||(pmHabit&&pmHabit.logs&&pmHabit.logs[ck]);
      if(hasTick)streak++;
      else if(j>0)break;
      check.setDate(check.getDate()-1);
    }

    html+='<div class="sk-progress-card">';
    html+='<div class="sk-progress-head"><div><div class="sk-progress-week">Week '+weeksIn+'</div><div class="sk-progress-sub">of your glow journey · started '+fmtDate(s.startedOn)+'</div></div><div class="sk-progress-streak"><span class="sk-streak-num">'+streak+'</span><span class="sk-streak-lbl">day streak</span></div></div>';
    html+='<div class="sk-history-strip">'+history7.map(function(h){
      var lbl=h.date.toLocaleDateString('en-GB',{weekday:'narrow'});
      var isToday=h.key===todayKey;
      var act=h.activeId?_activeById(h.activeId):null;
      var actTag=act?'<span class="sk-dot active" title="'+escapeHtml(act.name)+'" style="color:'+(act.color||'var(--accent)')+'">'+act.emoji+'</span>':'';
      return '<div class="sk-history-day'+(isToday?' today':'')+'"><div class="sk-history-date">'+lbl+'</div><div class="sk-history-dots"><span class="sk-dot'+(h.am?' am':'')+'" title="AM">☀</span><span class="sk-dot'+(h.pm?' pm':'')+'" title="PM">🌙</span>'+(h.gua?'<span class="sk-dot gua" title="Gua sha">🪨</span>':'')+actTag+'</div></div>';
    }).join('')+'</div>';
    html+='</div>';
  }else{
    html+='<div class="sk-progress-card sk-progress-empty"><div class="sk-progress-head"><div><div class="sk-progress-week">Ready when you are</div><div class="sk-progress-sub">Your glow journey starts with your first tick.</div></div></div></div>';
  }

  // AM + PM tick cards
  html+='<div class="sk-today-grid">';
  html+=_skincareTickCard('AM','☀️','Morning routine','Protect · Brighten · Hydrate',amDone,amHabit);
  html+=_skincareTickCard('PM','🌙','Evening routine','Cleanse · Hydrate · Recover',pmDone,pmHabit);
  html+='</div>';

  // Tonight's plan (adaptive to schedule)
  var actColor=scheduledActive.color||'var(--accent)';
  html+='<div class="sk-active-card" style="border-left:4px solid '+actColor+'">';
  html+='<div class="sk-active-head">';
  html+='<span class="sk-active-emoji" style="background:'+actColor+'22">'+(scheduledActive.emoji||'✨')+'</span>';
  html+='<div><div class="sk-active-label">Tonight\'s plan</div><div class="sk-active-title">'+escapeHtml(scheduledActive.name)+(scheduledGuaSha?' + Gua sha':'')+'</div>'+(scheduledActive.note?'<div class="sk-active-note">'+escapeHtml(scheduledActive.note)+'</div>':'')+'</div>';
  html+='</div>';

  // Action buttons
  html+='<div class="sk-active-actions">';
  // Log active
  var activeLogged=!!todayActiveId;
  var logBtnLabel=activeLogged?'✓ '+escapeHtml((_activeById(todayActiveId)||{}).name||'Logged'):'Log tonight\'s active';
  html+='<button class="sk-active-btn'+(activeLogged?' done':'')+'" onclick="openSkincareActivePicker()">'+logBtnLabel+'</button>';
  if(scheduledGuaSha||guaShaDone){
    html+='<button class="sk-active-btn'+(guaShaDone?' done':'')+' sk-active-btn-secondary" onclick="toggleGuaShaToday()">'+(guaShaDone?'✓ Gua sha done':'Log gua sha')+'</button>';
  }else{
    html+='<button class="sk-active-btn sk-active-btn-secondary" onclick="toggleGuaShaToday()">+ Gua sha</button>';
  }
  html+='</div>';
  html+='<div class="sk-active-hint">These logs build your 7-day history above and your glow streak — they don\'t replace your AM/PM ticks.</div>';
  html+='</div>';

  // Photo log
  html+='<div class="sk-photo-card">';
  html+='<div class="sk-photo-head"><div class="card-label" style="margin:0">📸 Progress notes</div><button class="btn btn-ghost btn-sm" onclick="openModal(\'addSkincarePhoto\')">+ Add note</button></div>';
  if(!s.photos.length){
    html+='<div class="sk-photo-empty">Log what you notice — breakouts healing, brightness returning, texture changing. Full photo uploads coming later.</div>';
  }else{
    html+='<div class="sk-photo-list">'+s.photos.slice().reverse().slice(0,6).map(function(p){
      return '<div class="sk-photo-item"><div class="sk-photo-date">'+fmtDate(p.date)+'</div><div class="sk-photo-note">'+escapeHtml(p.note||'')+'</div><button class="sk-photo-del" onclick="deleteSkincarePhoto(\''+p.id+'\')" title="Delete">×</button></div>';
    }).join('')+'</div>';
  }
  html+='</div>';

  el.innerHTML=html;
}

function _skincareTickCard(period,icon,title,sub,done,habit){
  var action=habit?'onclick="toggleSkincareToday(\''+period+'\')"':'';
  var h='<div class="sk-tick-card'+(done?' done':'')+'" '+action+'>';
  h+='<div class="sk-tick-emoji">'+icon+'</div>';
  h+='<div class="sk-tick-body"><div class="sk-tick-title">'+title+'</div><div class="sk-tick-sub">'+sub+'</div></div>';
  h+='<div class="sk-tick-check">'+(done?'✓':'')+'</div>';
  h+='</div>';
  if(!habit){
    h='<div class="sk-tick-card sk-tick-missing"><div class="sk-tick-emoji">'+icon+'</div><div class="sk-tick-body"><div class="sk-tick-title">'+title+'</div><div class="sk-tick-sub">No "Skincare '+period+'" habit yet. <a href="#" onclick="nav(\'habits\');return false" style="color:var(--accent-dark)">Add it →</a></div></div></div>';
  }
  return h;
}

function toggleSkincareToday(period){
  var habit=_findSkincareHabit(period);
  if(!habit)return;
  var todayKey=localDateKey(new Date());
  if(!habit.logs)habit.logs={};
  var wasDone=habit.logs[todayKey];
  habit.logs[todayKey]=!wasDone;
  var s=_skinState();
  if(!wasDone&&!s.startedOn)s.startedOn=todayKey;
  saveState();
  renderSkincareToday();
  // Cross-page sync — habits and dashboard pages may be in DOM
  if(typeof renderHabits==='function'&&document.getElementById('page-habits'))renderHabits();
  if(typeof renderDashboard==='function'&&document.getElementById('page-dashboard'))renderDashboard();
  if(!wasDone){
    var streak=typeof habitStreak==='function'?habitStreak(habit):0;
    if(streak===7||streak===14||streak===21||streak===30){
      fireConfetti();
      showCelebrationToast(habit.name+' — '+streak+' day streak!','🔥');
    }
    if(typeof checkAllDoneToday==='function')checkAllDoneToday();
  }
}

function toggleGuaShaToday(){
  var s=_skinState();
  var todayKey=localDateKey(new Date());
  var wasDone=!!s.guaShaLog[todayKey];
  if(wasDone)delete s.guaShaLog[todayKey];
  else s.guaShaLog[todayKey]=true;
  saveState();
  renderSkincareToday();
  if(!wasDone)showCelebrationToast('Gua sha logged — that glow is earned','🪨');
}

// Popover to pick tonight's active (overrides the scheduled default)
function openSkincareActivePicker(){
  var s=_skinState();
  var todayKey=localDateKey(new Date());
  var opts=s.actives.map(function(a){
    var isSelected=s.activeLog[todayKey]===a.id;
    return '<button class="sk-picker-opt'+(isSelected?' selected':'')+'" onclick="logSkincareActive(\''+a.id+'\')"><span class="sk-picker-emoji">'+a.emoji+'</span><span class="sk-picker-name">'+escapeHtml(a.name)+'</span></button>';
  }).join('');
  // Add "skipped" option
  var skipSelected=s.activeLog[todayKey]==='__skip__';
  opts+='<button class="sk-picker-opt'+(skipSelected?' selected':'')+'" onclick="logSkincareActive(\'__skip__\')"><span class="sk-picker-emoji">⏭</span><span class="sk-picker-name">Skipped tonight</span></button>';
  var html='<h2>What did you use tonight?</h2><div class="modal-sub">Tap one to log, or swap from your planned active.</div><div class="sk-picker-list">'+opts+'</div><div class="modal-btns"><button class="btn" onclick="clearSkincareActive()">Clear</button><button class="btn btn-accent" onclick="closeModal()">Done</button></div>';
  var mc=document.getElementById('modal-content');
  if(mc){mc.innerHTML=html;document.getElementById('modal').style.display='flex'}
}
function logSkincareActive(id){
  var s=_skinState();
  var todayKey=localDateKey(new Date());
  s.activeLog[todayKey]=id;
  saveState();
  closeModal();
  renderSkincareToday();
  var a=_activeById(id);
  if(a)showCelebrationToast(a.name+' logged','✨');
  else if(id==='__skip__')showCelebrationToast('Rest noted','🌿');
}
function clearSkincareActive(){
  var s=_skinState();
  var todayKey=localDateKey(new Date());
  delete s.activeLog[todayKey];
  saveState();
  closeModal();
  renderSkincareToday();
}

// ── TAB 2: ROUTINE (editable) ──
function renderSkincareRoutine(){
  var amEl=document.getElementById('skincare-am-steps');
  var pmEl=document.getElementById('skincare-pm-steps');
  var s=_skinState();
  if(amEl)amEl.innerHTML=_renderProductList('am',s.products.am);
  if(pmEl)pmEl.innerHTML=_renderProductList('pm',s.products.pm);

  // Actives library
  var actEl=document.getElementById('skincare-actives-list');
  if(actEl){
    actEl.innerHTML=s.actives.map(function(a,i){
      return '<div class="sk-active-item" style="border-left:4px solid '+(a.color||'var(--accent)')+'">'
        +'<span class="sk-active-emoji-sm">'+a.emoji+'</span>'
        +'<div class="sk-active-item-body"><div class="sk-active-item-name">'+escapeHtml(a.name)+'</div>'+(a.note?'<div class="sk-active-item-note">'+escapeHtml(a.note)+'</div>':'')+'</div>'
        +'<div class="sk-step-actions">'
          +'<button class="sk-step-btn" onclick="editSkincareActive(\''+a.id+'\')" title="Edit">✎</button>'
          +(s.actives.length>1?'<button class="sk-step-btn danger" onclick="deleteSkincareActive(\''+a.id+'\')" title="Delete">×</button>':'')
        +'</div>'
        +'</div>';
    }).join('');
    actEl.innerHTML+='<button class="sk-step-add" onclick="addSkincareActive()">+ Add active (e.g. Retinol)</button>';
  }

  // Night schedule (customisable — active + gua sha per day)
  var nsEl=document.getElementById('skincare-night-schedule');
  if(nsEl){
    var dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    nsEl.innerHTML='<div class="sk-night-grid">'+dayNames.map(function(n,i){
      var slot=s.nightSchedule[i]||{activeId:'rest',guaSha:false};
      var act=_activeById(slot.activeId)||{name:'Rest',emoji:'🌿',color:'var(--border2)'};
      var hasGua=!!slot.guaSha;
      return '<div class="sk-night-day'+(hasGua?' on':'')+'" onclick="editNightSlot('+i+')" style="border-left:3px solid '+(act.color||'var(--border2)')+'">'
        +'<div class="sk-night-name">'+n+'</div>'
        +'<div class="sk-night-emoji">'+act.emoji+'</div>'
        +'<div class="sk-night-active">'+escapeHtml(act.name)+'</div>'
        +(hasGua?'<div class="sk-night-gua">+🪨 Gua sha</div>':'<div class="sk-night-gua-empty">&nbsp;</div>')
        +'</div>';
    }).join('')+'</div><div class="sk-night-hint">Tap any day to change its active or toggle gua sha.</div>';
  }
}

function _renderProductList(period,list){
  var html='';
  list.forEach(function(p,i){
    var tag=p.tag?'<span class="sk-step-tag" style="background:'+(p.tagColor||'var(--accent-dim)')+'15;color:'+(p.tagColor||'var(--accent)')+'">'+escapeHtml(p.tag)+'</span>':'';
    html+='<div class="sk-step">';
    html+='<div class="sk-step-num">'+(i+1)+'</div>';
    html+='<div class="sk-step-body">';
    html+='<div class="sk-step-name">'+escapeHtml(p.name)+'</div>';
    html+='<div class="sk-step-desc">'+escapeHtml(p.desc||'')+'</div>';
    if(tag)html+=tag;
    html+='</div>';
    html+='<div class="sk-step-actions">';
    if(i>0)html+='<button class="sk-step-btn" onclick="moveSkincareStep(\''+period+'\','+i+',-1)" title="Move up">↑</button>';
    if(i<list.length-1)html+='<button class="sk-step-btn" onclick="moveSkincareStep(\''+period+'\','+i+',1)" title="Move down">↓</button>';
    html+='<button class="sk-step-btn" onclick="editSkincareStep(\''+period+'\','+i+')" title="Edit">✎</button>';
    html+='<button class="sk-step-btn danger" onclick="deleteSkincareStep(\''+period+'\','+i+')" title="Delete">×</button>';
    html+='</div>';
    html+='</div>';
  });
  html+='<button class="sk-step-add" onclick="addSkincareStep(\''+period+'\')">+ Add step</button>';
  return html;
}

function addSkincareStep(period){openModal('skincareStep',period+':new')}
function editSkincareStep(period,idx){openModal('skincareStep',period+':'+idx)}
function deleteSkincareStep(period,idx){
  confirmDelete('Delete this step?',function(){
    var s=_skinState();
    s.products[period].splice(idx,1);
    saveState();renderSkincareRoutine();
  });
}
function moveSkincareStep(period,idx,dir){
  var s=_skinState();
  var list=s.products[period];
  var ni=idx+dir;
  if(ni<0||ni>=list.length)return;
  var tmp=list[idx];list[idx]=list[ni];list[ni]=tmp;
  saveState();renderSkincareRoutine();
}
function saveSkincareStep(period,idxStr){
  var s=_skinState();
  var name=(document.getElementById('m-sk-name')||{}).value||'';
  var desc=(document.getElementById('m-sk-desc')||{}).value||'';
  var tag=(document.getElementById('m-sk-tag')||{}).value||'';
  if(!name.trim())return;
  var entry={name:name.trim(),desc:desc.trim()};
  if(tag.trim())entry.tag=tag.trim();
  if(idxStr==='new')s.products[period].push(entry);
  else{
    var idx=Number(idxStr);
    if(s.products[period][idx]&&s.products[period][idx].tagColor)entry.tagColor=s.products[period][idx].tagColor;
    s.products[period][idx]=entry;
  }
  saveState();closeModal();renderSkincareRoutine();
}

// ── ACTIVES library (add/edit/delete) ──
function addSkincareActive(){openModal('skincareActive','new')}
function editSkincareActive(id){openModal('skincareActive',id)}
function deleteSkincareActive(id){
  var s=_skinState();
  confirmDelete('Delete this active? Any scheduled nights using it will fall back to rest.',function(){
    s.actives=s.actives.filter(function(a){return a.id!==id});
    // Clean up schedule references
    Object.keys(s.nightSchedule).forEach(function(k){
      if(s.nightSchedule[k].activeId===id)s.nightSchedule[k].activeId=(s.actives[0]||{id:'rest'}).id;
    });
    saveState();renderSkincareRoutine();renderSkincareToday();
  });
}
function saveSkincareActive(idArg){
  var s=_skinState();
  var name=(document.getElementById('m-ska-name')||{}).value||'';
  var emoji=(document.getElementById('m-ska-emoji')||{}).value||'✨';
  var note=(document.getElementById('m-ska-note')||{}).value||'';
  var color=(document.getElementById('m-ska-color')||{}).value||'#D4845A';
  if(!name.trim())return;
  if(idArg==='new'){
    var id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,20)+'-'+Date.now().toString(36);
    s.actives.push({id:id,name:name.trim(),emoji:emoji,note:note.trim(),color:color});
  }else{
    var a=s.actives.find(function(x){return x.id===idArg});
    if(a){a.name=name.trim();a.emoji=emoji;a.note=note.trim();a.color=color}
  }
  saveState();closeModal();renderSkincareRoutine();renderSkincareToday();
}

// ── NIGHT SLOT EDITOR ──
function editNightSlot(dayIdx){openModal('nightSlot',String(dayIdx))}
function saveNightSlot(dayIdx){
  var s=_skinState();
  var activeId=(document.getElementById('m-ns-active')||{}).value||'rest';
  var guaSha=(document.getElementById('m-ns-gua')||{}).checked;
  s.nightSchedule[dayIdx]={activeId:activeId,guaSha:guaSha};
  saveState();closeModal();renderSkincareRoutine();renderSkincareToday();
}

// ── TAB 3: GUIDE (static) ──
function renderSkincareGuide(){
  var prepEl=document.getElementById('skincare-guasha-prep');
  if(prepEl)prepEl.innerHTML=GUASHA_PREP.map(function(s,i){return _guideStep(i+1,s.name,s.desc)}).join('');
  var movesEl=document.getElementById('skincare-guasha-moves');
  if(movesEl)movesEl.innerHTML=GUASHA_MOVES.map(function(m){
    return '<div class="sk-guide-step sk-guide-move">'
      +'<div class="sk-guide-num">'+m.dir+'</div>'
      +'<div class="sk-step-body"><div class="sk-step-name">'+m.area+'</div><div class="sk-step-desc">'+m.desc+'</div></div>'
      +'</div>';
  }).join('');
}
function _guideStep(num,name,desc){
  return '<div class="sk-guide-step"><div class="sk-guide-num">'+num+'</div><div class="sk-step-body"><div class="sk-step-name">'+name+'</div><div class="sk-step-desc">'+desc+'</div></div></div>';
}

// ── PHOTO LOG ──
function saveSkincarePhoto(){
  var s=_skinState();
  var date=(document.getElementById('m-skp-date')||{}).value||localDateKey(new Date());
  var note=(document.getElementById('m-skp-note')||{}).value||'';
  if(!note.trim())return;
  s.photos.push({id:g(),date:date,note:note.trim()});
  saveState();closeModal();renderSkincareToday();
}
function deleteSkincarePhoto(id){
  confirmDelete('Delete this note?',function(){
    var s=_skinState();
    s.photos=s.photos.filter(function(p){return p.id!==id});
    saveState();renderSkincareToday();
  });
}
