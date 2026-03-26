// SIDEBAR QUOTE & INIT
var quotes=['Be intentional 🤨','God\'s timing is perfect ✨','Make happiness the priority 🥳','Character energy only 👑','You are so much stronger than you think 💪','Debt free era loading… 💸','Future you says thanks 🤩','She believed she could, so she did 💪🏾'];
var qEl=document.getElementById('sidebar-quote');if(qEl)qEl.textContent=quotes[Math.floor(Math.random()*quotes.length)];

if(_firebaseReady)setSyncStatus('saving');
loadFromCloud(function(){
  var migrateKeys=['goals','habits','workouts','gymTemplates','prs','income','expenses','accounts','debts','savingsGoals','metrics','weeklyPlans','reviews','journal','mood','dailyHighlights','projects','relationships','gratitude','wishlist','watchlist','debtPayments'];
  migrateKeys.forEach(function(k){if(!STATE[k])STATE[k]=JSON.parse(JSON.stringify(DEFAULT_STATE[k]))});
  if(!STATE.metrics.projectsDone)STATE.metrics.projectsDone=[];
  if(!STATE.reviews.monthly)STATE.reviews.monthly={};
  /* Backfill startingBalance for existing debts */
  (STATE.debts||[]).forEach(function(d){if(!d.startingBalance){var dPaid=(STATE.debtPayments||[]).filter(function(p){return p.debtId===d.id}).reduce(function(s,p){return s+Number(p.amount)},0);d.startingBalance=Number(d.balance)+dPaid}});
  /* Replace old gym templates with correct Tuesday/Thursday split */
  if(STATE.gymTemplates&&STATE.gymTemplates.length){var oldNames=['Push Day','Pull Day','Leg Day'];var hasOld=STATE.gymTemplates.some(function(t){return oldNames.indexOf(t.name)!==-1});if(hasOld){STATE.gymTemplates=JSON.parse(JSON.stringify(DEFAULT_STATE.gymTemplates));saveState()}}
  if(!STATE.reviews.quarterly)STATE.reviews.quarterly={};
  if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};
  if(!STATE.roadmapDueDates)STATE.roadmapDueDates={};
  setSyncStatus('saved');setTimeout(function(){setSyncStatus('idle')},2000);
  try{renderDashboard()}catch(e){console.error('Render error:',e)}
});
startClock();

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
toast.innerHTML='<span style="font-size:20px">'+(emoji||'🎉')+'</span> '+msg;
document.body.appendChild(toast);
setTimeout(function(){toast.style.transition='opacity .4s,transform .4s';toast.style.opacity='0';toast.style.transform='translateX(-50%) translateY(-10px)';setTimeout(function(){toast.remove()},400)},2800)}

