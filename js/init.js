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
  var migrateKeys=['goals','habits','workouts','gymTemplates','prs','income','expenses','accounts','debts','savingsGoals','metrics','weeklyPlans','reviews','journal','mood','dailyHighlights','projects','relationships','gratitude','wishlist','watchlist','debtPayments','reminders','water','dailyPriorities','trainingEvents'];
  migrateKeys.forEach(function(k){if(!STATE[k])STATE[k]=JSON.parse(JSON.stringify(DEFAULT_STATE[k]))});
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
  if(STATE.gymTemplates&&STATE.gymTemplates.length){var oldNames=['Push Day','Pull Day','Leg Day'];var hasOld=STATE.gymTemplates.some(function(t){return oldNames.indexOf(t.name)!==-1});if(hasOld){STATE.gymTemplates=JSON.parse(JSON.stringify(DEFAULT_STATE.gymTemplates));saveState()}}
  if(!STATE.reviews.quarterly)STATE.reviews.quarterly={};
  if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};
  if(!STATE.roadmapDueDates)STATE.roadmapDueDates={};
  setSyncStatus('saved');setTimeout(function(){setSyncStatus('idle')},2000);
  try{renderDashboard()}catch(e){console.error('Render error:',e)}
});
startClock();

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
    if(el2)el2.innerHTML='<div style="display:flex;justify-content:flex-end;margin-bottom:4px"><button class="btn btn-ghost btn-sm" onclick="openModal(\'notifSettings\')" style="font-size:11px">\uD83D\uDD14 Manage reminders</button></div>';
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
opts=opts||{};var duration=opts.duration||2500;var count=opts.count||80;var colors=opts.colors||['#a0522d','#c9973a','#d4845a','#6b9e7a','#5f9ea0','#8b6fb0','#c97b6e','#f59e0b'];
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
toast.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#a0522d,#6b3a1f);color:#fffdf9;padding:12px 24px;border-radius:14px;font-family:var(--sans);font-size:14px;font-weight:600;z-index:10000;box-shadow:0 8px 32px rgba(107,58,31,0.35);animation:floatIn .3s ease;display:flex;align-items:center;gap:8px';
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
