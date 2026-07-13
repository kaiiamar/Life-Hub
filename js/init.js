// SIDEBAR QUOTE & INIT
var quotes=['Be intentional \u{1F928}','God\'s timing is perfect \u2728','Make happiness the priority \u{1F973}','Character energy only \u{1F451}','You are so much stronger than you think \u{1F4AA}','Debt free era loading\u2026 \u{1F4B8}','Future you says thanks \u{1F929}','She believed she could, so she did \u{1F4AA}\u{1F3FE}'];
var qEl=document.getElementById('sidebar-quote');if(qEl)qEl.textContent=quotes[Math.floor(Math.random()*quotes.length)];

// Auto night mode — applied immediately on load (respects user pref)
(function(){
  var pref=null;
  try{pref=localStorage.getItem('lh_theme')}catch(e){}
  if(pref==='dark')document.body.classList.add('night-mode');
  else if(pref==='light')document.body.classList.remove('night-mode');
  else{
    var h=new Date().getHours();
    if(h>=21||h<5)document.body.classList.add('night-mode');
  }
})();

if(_firebaseReady)setSyncStatus('saving');
loadFromCloud(function(){
  var migrateKeys=['goals','habits','workouts','prs','income','expenses','accounts','debts','savingsGoals','metrics','weeklyPlans','reviews','journal','mood','dailyHighlights','relationships','gratitude','wishlist','watchlist','debtPayments','reminders','water','dailyPriorities','trainingEvents','trainingPlan','tasks','commitments','weeklyIntention'];
  migrateKeys.forEach(function(k){if(!STATE[k])STATE[k]=JSON.parse(JSON.stringify(DEFAULT_STATE[k]||(k==='tasks'?[]:{})))});
  if(!STATE.tasks)STATE.tasks=[];
  if(!STATE.metrics.projectsDone)STATE.metrics.projectsDone=[];
  if(!STATE.reviews.monthly)STATE.reviews.monthly={};
  (STATE.debts||[]).forEach(function(d){if(!d.startingBalance){var dPaid=(STATE.debtPayments||[]).filter(function(p){return p.debtId===d.id}).reduce(function(s,p){return s+Number(p.amount)},0);d.startingBalance=Number(d.balance)+dPaid}});
  // Backfill startDate on existing habits — use earliest log date, or today if no logs
  (STATE.habits||[]).forEach(function(h){
    if(h.startDate)return;
    var logKeys=h.logs?Object.keys(h.logs):[];
    if(logKeys.length){logKeys.sort();h.startDate=logKeys[0]}
    else h.startDate=localDateKey(new Date());
  });
  // Backfill anchor on existing habits — auto-suggest from name
  (STATE.habits||[]).forEach(function(h){
    if(h.anchor)return;
    if(typeof autoSuggestAnchor==='function')h.anchor=autoSuggestAnchor(h.name);
    else h.anchor='anytime';
  });

  // ---- TRAINING PLAN MIGRATION (one-shot) ---------------------------------
  // Move gym/running out of the habit tracker into the dedicated training plan.
  // Remove the old 'Gym session' and 'Run once a week' habits, seed the half
  // marathon plan + race event. Guarded so it only runs once.
  if(!STATE.__trainingMigrated){
    STATE.habits=(STATE.habits||[]).filter(function(h){
      var n=(h.name||'').toLowerCase();
      return !(n.indexOf('gym session')!==-1||n==='run once a week'||n.indexOf('run once')!==-1);
    });
    if(!STATE.trainingPlan&&typeof TRAINING_TEMPLATE!=='undefined'){
      STATE.trainingPlan={template:JSON.parse(JSON.stringify(TRAINING_TEMPLATE)),checks:{}};
    }
    // Seed race event if not already present
    if(!STATE.trainingEvents)STATE.trainingEvents=[];
    var hasRace=STATE.trainingEvents.some(function(e){return e.date==='2026-09-20'||/half\s*marathon/i.test(e.name||'')});
    if(!hasRace){
      STATE.trainingEvents.push({id:g(),name:'Half Marathon',date:'2026-09-20',note:'21.1km race day'});
    }
    STATE.__trainingMigrated=true;
    saveState();
  }

  // ---- HALF MARATHON RACE BLOCK SEED (one-shot) ---------------------------
  // Load the dated 10-week block (13 Jul – 20 Sep 2026) and adopt the block-
  // arranged weekly template. Guarded with __hmBlockSeeded so it runs once.
  // HM_RACE_BLOCK + TRAINING_TEMPLATE come from workouts.js (loaded before
  // init.js per index.html script order). (addendum §1)
  if(!STATE.__hmBlockSeeded){
    if(!STATE.trainingPlan)STATE.trainingPlan={template:[],checks:{}};
    if(typeof TRAINING_TEMPLATE!=='undefined')STATE.trainingPlan.template=JSON.parse(JSON.stringify(TRAINING_TEMPLATE));
    if(typeof HM_RACE_BLOCK!=='undefined')STATE.trainingPlan.raceBlock=JSON.parse(JSON.stringify(HM_RACE_BLOCK));
    if(!STATE.trainingPlan.checks)STATE.trainingPlan.checks={};
    STATE.__hmBlockSeeded=true;
    saveState();
  }

  // ---- TASKS MIGRATION (one-shot) -----------------------------------------
  // Old data: STATE.dailyPriorities[date] = [{text,done}]
  //           STATE.weeklyPlans[wkKey].priorities = [3 strings]
  // New data: STATE.tasks = [{id,text,done,dueDate?,doneAt?,createdAt,weekPriority?}]
  // Migrate once, mark with __tasksMigrated so we don't run twice.
  if(!STATE.__tasksMigrated){
    if(!STATE.tasks)STATE.tasks=[];
    var existingTexts={};
    STATE.tasks.forEach(function(t){if(t.text)existingTexts[t.text.toLowerCase()+'|'+(t.dueDate||'')]=true});
    // Migrate daily priorities
    var dp=STATE.dailyPriorities||{};
    Object.keys(dp).forEach(function(d){
      (dp[d]||[]).forEach(function(p){
        if(!p||!p.text)return;
        var key=p.text.toLowerCase()+'|'+d;
        if(existingTexts[key])return;
        STATE.tasks.push({
          id:g(),
          text:p.text,
          done:!!p.done,
          dueDate:d,
          doneAt:p.done?d:null,
          createdAt:d
        });
        existingTexts[key]=true;
      });
    });
    // Migrate weekly priorities — set weekPriority + dueDate to end of that week
    var wp=STATE.weeklyPlans||{};
    Object.keys(wp).forEach(function(wkKey){
      var plan=wp[wkKey];
      if(!plan||!plan.priorities)return;
      var parts=wkKey.split('-');
      var wkStart=new Date(+parts[0],+parts[1]-1,+parts[2]);
      var wkEnd=new Date(wkStart);wkEnd.setDate(wkEnd.getDate()+6);
      var wkEndKey=localDateKey(wkEnd);
      plan.priorities.forEach(function(text,i){
        if(!text||!text.trim())return;
        var done=!!(plan.prioritiesDone&&plan.prioritiesDone[i]);
        var key=text.toLowerCase()+'|'+wkEndKey;
        if(existingTexts[key])return;
        STATE.tasks.push({
          id:g(),
          text:text,
          done:done,
          dueDate:wkEndKey,
          doneAt:done?wkEndKey:null,
          createdAt:wkKey,
          weekPriority:wkKey
        });
        existingTexts[key]=true;
      });
    });
    STATE.__tasksMigrated=true;
    saveState();
  }

  // ---- PLANNER MIGRATION (one-shot) ---------------------------------------
  // New planner fields: STATE.commitments (time-blocked blocks) and
  // STATE.weeklyIntention ({weekKey,text}). Also carry forward any unfinished
  // weekly task whose weekPriority points at a *past* week to the current week
  // key, so stale weekly tasks are never treated as overdue. Guarded so it
  // only runs once.
  if(!STATE.__plannerMigrated){
    if(!STATE.commitments)STATE.commitments=[];
    // migrateKeys may have coerced an absent weeklyIntention to {}; normalise
    // anything without a real intention back to null (per data model).
    if(!STATE.weeklyIntention||!STATE.weeklyIntention.text)STATE.weeklyIntention=null;
    var _curWk=(typeof weekKey==='function')?weekKey(new Date()):null;
    if(_curWk){
      (STATE.tasks||[]).forEach(function(t){
        if(t.weekPriority&&t.weekPriority<_curWk&&!t.done)t.weekPriority=_curWk;
      });
    }
    STATE.__plannerMigrated=true;
    saveState();
  }
  // Daily hygiene (runs every load — NOT guarded): focus is a per-day thing, so
  // clear any focusDate left over from a previous day. The task itself stays in
  // the inbox / week list; only the "today's focus" stamp resets, so yesterday's
  // focus never lingers as clutter (auto-cleanup, no manual tidying).
  (function(){
    var _today=localDateKey(new Date());
    var _changed=false;
    (STATE.tasks||[]).forEach(function(t){
      if(t.focusDate&&t.focusDate<_today){delete t.focusDate;_changed=true}
    });
    if(_changed)saveState();
  })();
  // Auto-correct "debt free" type goals: target should be 0, startProgress = initial debt total
  (STATE.goals||[]).forEach(function(go){
    var name=(go.name||'').toLowerCase();
    if(go.cat==='Finance'&&go.direction==='down'&&/debt free|pay off|clear debt/i.test(go.name)){
      // Set target to 0 (debt free means 0 debt)
      if(go.target!==0)go.target=0;
      // Set startProgress from sum of debt starting balances
      if(!go.startProgress){
        var startSum=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.startingBalance||d.balance||0)},0);
        go.startProgress=startSum;
      }
    }
  });
  // Seed startProgress for auto-linked goals that track 'down' (so % calc works)
  (STATE.goals||[]).forEach(function(go){
    if(!go.startProgress&&go.direction==='down'&&typeof getGoalSource==='function'){
      var s=getGoalSource(go);
      if(s.source!=='manual')go.startProgress=s.progress||go.progress||go.target*2;
    }
  });
  // Clean up dormant data left over from removed features
  if(STATE.gymTemplates)delete STATE.gymTemplates;
  if(STATE.projects)delete STATE.projects;
  if(!STATE.reviews.quarterly)STATE.reviews.quarterly={};
  if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};
  if(!STATE.roadmapDueDates)STATE.roadmapDueDates={};
  setSyncStatus('saved');setTimeout(function(){setSyncStatus('idle')},2000);
  try{renderPlanner()}catch(e){console.error('Render error:',e)}
  try{updateAppBadge()}catch(e){}
});
startClock();

// ============================================================
// PWA APP-ICON BADGE (3.5)
// ============================================================
// Reflect today's incomplete focus tasks (focusDate===today && !done) on the
// installed app icon. Guarded for browsers without the Badging API. Called on
// load and after every planner render (see renderPlanner) so it stays in sync
// with focus/task toggles for free.
function updateAppBadge(){
  try{
    if(!('setAppBadge' in navigator))return;
    var today=localDateKey(new Date());
    var n=(STATE.tasks||[]).filter(function(t){return t&&t.focusDate===today&&!t.done}).length;
    if(n>0){
      navigator.setAppBadge(n).catch(function(){});
    }else if('clearAppBadge' in navigator){
      navigator.clearAppBadge().catch(function(){});
    }else{
      navigator.setAppBadge(0).catch(function(){});
    }
  }catch(e){}
}

// Bloom checkmark micro-interaction (Part 4.3.4). Tick handlers re-render their
// list synchronously, which replaces the tapped node — so we replay the pop on
// the freshly rendered element, identified by a data-tick key, on the next
// frame. No-op when the user prefers reduced motion. Only call this when an
// item newly BECOMES done (never on un-tick).
function bloomTick(key){
  try{
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    requestAnimationFrame(function(){
      var el=document.querySelector('[data-tick="'+key+'"]');
      if(!el)return;
      el.classList.add('just-ticked');
      setTimeout(function(){el.classList.remove('just-ticked')},260);
    });
  }catch(e){}
}

// ============================================================
// SERVICE WORKER & PUSH NOTIFICATIONS
// ============================================================
var NOTIF_API='https://lifehub-notifications.vercel.app';// Set to your Vercel URL after deploy, e.g. 'https://lifehub-notifications.vercel.app'
var NOTIF_USER_ID='kai-lifehub';

if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){})}

function setupReminders(){
  if(!('Notification' in window)){return}
  if(Notification.permission==='default'){
    var el=document.getElementById('dash-notification-prompt');
    if(el)el.innerHTML='<div style="background:var(--accent-dim);border:1.5px solid var(--accent);border-radius:var(--radius-sm);padding:12px 16px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="requestNotifPermission()"><span style="font-size:20px">\uD83D\uDD14</span><div style="flex:1"><div style="font-size:13px;font-weight:500">Enable push reminders</div><div style="font-size:11px;color:var(--text2)">Get notifications even when the app is closed</div></div><button class="btn btn-accent btn-sm" onclick="event.stopPropagation();requestNotifPermission()">Enable</button></div>'
  }
  if(Notification.permission==='granted'){
    var el2=document.getElementById('dash-notification-prompt');
    if(el2)el2.innerHTML='';
    subscribeToPush();
    setupInAppReminders()
  }
}
function requestNotifPermission(){
  Notification.requestPermission().then(function(p){
    if(p==='granted'){setupReminders()}
  })
}
function subscribeToPush(){
  if(!NOTIF_API||!navigator.serviceWorker)return;
  navigator.serviceWorker.ready.then(function(reg){
    fetch(NOTIF_API+'/api/vapid-key').then(function(r){return r.json()}).then(function(data){
      if(!data.publicKey)return;
      var key=urlBase64ToUint8Array(data.publicKey);
      return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
    }).then(function(sub){
      if(!sub)return;
      return fetch(NOTIF_API+'/api/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({subscription:sub.toJSON(),userId:NOTIF_USER_ID})
      })
    }).catch(function(e){console.log('Push subscribe failed:',e)})
  })
}
function syncRemindersToBackend(){
  if(!NOTIF_API){showCelebrationToast('No backend URL set','⚠️');return}
  var reminders=getReminders();
  var enabledCount=reminders.filter(function(r){return r.enabled}).length;
  fetch(NOTIF_API+'/api/reminders',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userId:NOTIF_USER_ID,reminders:reminders})
  }).then(function(r){return r.json()}).then(function(data){
    console.log('Reminders synced:',data);
    if(typeof data.schedules==='string'&&data.schedules.indexOf('skipped')===0){
      showCelebrationToast('Synced locally only — backend not configured','⚠️');
    }else if(data.scheduled!==undefined){
      showCelebrationToast('Synced '+data.scheduled+'/'+enabledCount+' reminders','🔔');
    }else if(data.error){
      showCelebrationToast('Sync failed: '+data.error,'⚠️');
    }
  }).catch(function(e){console.error('Sync failed:',e);showCelebrationToast('Sync failed — check connection','⚠️')})
}
function urlBase64ToUint8Array(base64String){
  var padding='='.repeat((4-base64String.length%4)%4);
  var base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  var raw=atob(base64);var arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return arr
}
function getReminders(){
  if(!STATE.reminders)STATE.reminders=[
    {id:'morning',label:'Morning habits',emoji:'\u2600\uFE0F',message:'Time to start ticking off those habits!',hour:7,minute:0,enabled:true,condition:'habits'},
    {id:'water',label:'Water check',emoji:'\uD83D\uDCA7',message:'Keep sipping! Stay hydrated.',hour:13,minute:0,enabled:true,condition:'water'},
    {id:'gratitude',label:'Gratitude journal',emoji:'\uD83D\uDE4F',message:'Log your win and gratitude for today',hour:21,minute:0,enabled:true,condition:'gratitude'},
    {id:'sleep',label:'Bedtime reminder',emoji:'\uD83D\uDE34',message:'Time to wind down. 10pm bedtime!',hour:21,minute:30,enabled:true,condition:'none'},
    {id:'gym',label:'Gym reminder',emoji:'\uD83C\uDFCB\uFE0F',message:'Don\'t skip today \u2014 get it done!',hour:6,minute:0,enabled:false,condition:'none'}
  ];
  return STATE.reminders
}
var _notifFired={};
function setupInAppReminders(){
  setInterval(function(){
    var now=new Date();var h=now.getHours();var m=now.getMinutes();var today=localDateKey(now);
    getReminders().forEach(function(r){
      if(!r.enabled||h!==r.hour||m!==r.minute)return;
      var fk=r.id+'-'+today;if(_notifFired[fk])return;
      var skip=false;
      if(r.condition==='habits'){if((STATE.habits||[]).filter(function(hab){return hab.logs[today]}).length>0)skip=true}
      if(r.condition==='water'){if(((STATE.water||{})[today]||0)>=4)skip=true}
      if(r.condition==='gratitude'){if((STATE.gratitude||[]).some(function(e){return e.date===today}))skip=true}
      if(!skip){
        if(Notification.permission==='granted')new Notification(r.emoji+' '+r.label,{body:r.message});
        _notifFired[fk]=true
      }
    })
  },60000)
}
setupReminders();

// ============================================================
// CONFETTI CELEBRATION
// ============================================================
var confettiCanvas=null;
function fireConfetti(opts){
opts=opts||{};
// Celebrations scaled down for a calmer, less over-stimulating hit: cap the
// piece count and duration regardless of what a caller requests, so even the
// big milestone bursts stay gentle.
var duration=Math.min(opts.duration||1600,1800);var count=Math.min(opts.count||40,55);var colors=opts.colors||['#9B7ED6','#E75F9C','#B79BE6','#7FA8D8','#7ED6B0','#F0C860','#C99BE6','#F59E0B'];
if(!confettiCanvas){confettiCanvas=document.createElement('canvas');confettiCanvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';document.body.appendChild(confettiCanvas)}
var cv=confettiCanvas;var ctx=cv.getContext('2d');cv.width=window.innerWidth;cv.height=window.innerHeight;
var pieces=[];for(var i=0;i<count;i++){pieces.push({x:cv.width*(.2+Math.random()*.6),y:cv.height*-.1-Math.random()*cv.height*.3,w:6+Math.random()*6,h:4+Math.random()*4,color:colors[Math.floor(Math.random()*colors.length)],vx:(Math.random()-.5)*6,vy:2+Math.random()*4,rot:Math.random()*360,vr:(Math.random()-.5)*8,opacity:1})}
var start=Date.now();
function frame(){var elapsed=Date.now()-start;var progress=elapsed/duration;ctx.clearRect(0,0,cv.width,cv.height);
if(progress>=1){ctx.clearRect(0,0,cv.width,cv.height);return}
pieces.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.rot+=p.vr;p.opacity=Math.max(0,1-progress*1.2);
ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.globalAlpha=p.opacity;ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()});
requestAnimationFrame(frame)}
frame()}

function showCelebrationToast(msg,emoji){
var toast=document.createElement('div');
toast.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#9B7ED6,#E75F9C);color:#fff;padding:12px 24px;border-radius:14px;font-family:var(--sans);font-size:14px;font-weight:600;z-index:10000;box-shadow:0 8px 32px rgba(155,126,214,0.35);animation:floatIn .3s ease;display:flex;align-items:center;gap:8px';
toast.innerHTML='<span style="font-size:20px">'+(emoji||'\uD83C\uDF89')+'</span> '+msg;
document.body.appendChild(toast);
setTimeout(function(){toast.style.transition='opacity .4s,transform .4s';toast.style.opacity='0';toast.style.transform='translateX(-50%) translateY(-10px)';setTimeout(function(){toast.remove()},400)},2800)}

// ── CELEBRATION GUARDS — prevent re-firing the same event ──
// Stores event keys that have fired today, so we can hook celebrations into
// re-renders without spamming confetti. Keys are prefixed with the ISO date.
function celebrateOnce(key,fn){
  try{
    var today=new Date().toISOString().slice(0,10);
    var fullKey='lh_celebrated:'+today+':'+key;
    if(sessionStorage.getItem(fullKey))return false;
    sessionStorage.setItem(fullKey,'1');
    fn();
    return true;
  }catch(e){fn();return true}
}
