// DASHBOARD
// ============================================================
function focusBar(icon,label,val,pct,grad){
  return '<div class="focus-bar">'
    +'<span class="focus-bar-icon">'+icon+'</span>'
    +'<span class="focus-bar-label">'+label+'</span>'
    +'<div class="focus-bar-track"><div class="focus-bar-fill" data-w="'+pct+'" style="background:'+grad+'"></div></div>'
    +'<span class="focus-bar-val">'+val+'</span>'
    +'</div>';
}
function setStat(key,val,pct){
  var v=document.getElementById('stat-'+key);if(v)v.textContent=val;
  var b=document.getElementById('stat-'+key+'-bar');if(b){setTimeout(function(){b.style.width=pct+'%'},120)}
}

// Smooth number tick animation
function tickNumber(el,targetStr,duration){
  if(!el)return;
  duration=duration||900;
  var target=parseInt(targetStr,10);
  if(isNaN(target)){el.textContent=targetStr;return}
  var start=parseInt(el.getAttribute('data-current')||'0',10);
  var t0=performance.now();
  function step(t){
    var p=Math.min(1,(t-t0)/duration);
    // easeOutCubic
    var eased=1-Math.pow(1-p,3);
    var v=Math.round(start+(target-start)*eased);
    el.firstChild?el.firstChild.nodeValue=v:el.textContent=v;
    if(p<1)requestAnimationFrame(step);
    else el.setAttribute('data-current',target);
  }
  requestAnimationFrame(step);
}

// Time-based theming
function getTimeContext(){
  var h=new Date().getHours();
  if(h>=5&&h<12)return {slot:'morning',greeting:'Good morning',class:'time-morning'};
  if(h>=12&&h<17)return {slot:'afternoon',greeting:'Good afternoon',class:'time-afternoon'};
  if(h>=17&&h<21)return {slot:'evening',greeting:'Good evening',class:'time-evening'};
  return {slot:'night',greeting:'Winding down',class:'time-night'};
}
var CONTEXTUAL_QUOTES={
  morning:['You did not wake up to be mediocre.','A quiet start. Make it count.','First hour, best hour.','Begin with one small intention.'],
  afternoon:['Midday check — are you still with you?','Half the day remains. Use it well.','Keep moving. Softly.','The afternoon rewards the focused.'],
  evening:['Soft landings make better days tomorrow.','Celebrate the small wins today.','Evening is for reflection, not regret.','You did enough. You are enough.'],
  night:['Time to wind down.','Rest is part of the plan.','Dim the screen, quiet the mind.','Tomorrow starts with tonight\'s rest.']
};

function renderDashboard(){
  var now=new Date();var todayKey=localDateKey(now);
  var ctx=getTimeContext();
  // Auto night mode after 9pm / before 5am
  if(ctx.slot==='night')document.body.classList.add('night-mode');
  else document.body.classList.remove('night-mode');
  var gEl=document.getElementById('dash-greeting');if(gEl)gEl.innerHTML=ctx.greeting+', <em>Kai</em>.';
  // Apply time-based class to hero
  var hero=document.getElementById('hero');
  if(hero){
    hero.classList.remove('time-morning','time-afternoon','time-evening','time-night');
    hero.classList.add(ctx.class);
  }
  var dEl=document.getElementById('dash-date-sub');
  var tbd=document.getElementById('top-bar-date');if(tbd)tbd.textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  var qEl=document.getElementById('dash-quote');
  if(qEl){
    var pool=CONTEXTUAL_QUOTES[ctx.slot]||CONTEXTUAL_QUOTES.morning;
    // Stable-per-day choice — same quote all day, refreshes next day
    var seed=now.getFullYear()*366+now.getMonth()*31+now.getDate();
    qEl.textContent=pool[seed%pool.length];
  }
  loadDailyHighlight();

  var goalsDone=STATE.goals.filter(function(g){return g.done}).length;
  var habitsToday=STATE.habits.filter(function(h){return h.logs[todayKey]}).length;
  var rmProgress=function(){var td=0,ti=0;RM_MONTHS.forEach(function(m){var p=rmGetProgress(m);td+=p.done;ti+=p.total});return ti===0?0:Math.round(td/ti*100)}();

  var priData=(function(){var wk=weekKey(now);var plan=(STATE.weeklyPlans||{})[wk]||{};var pris=(plan.priorities||[]).filter(function(p){return p&&p.trim()});var done=0;var td=plan.prioritiesDone||{};pris.forEach(function(_,i){if(td[i])done++});return {done:done,total:pris.length}})();
  var priPct=priData.total>0?Math.round(priData.done/priData.total*100):0;
  var habPct=STATE.habits.length>0?Math.round(habitsToday/STATE.habits.length*100):0;

  // Smart hero subtext
  if(dEl){
    var dateStr=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    var parts=[];
    if(habitsToday>0)parts.push('<strong>'+habitsToday+'</strong> habit'+(habitsToday===1?'':'s')+' done');
    if(priData.done>0)parts.push('<strong>'+priData.done+'</strong> priorit'+(priData.done===1?'y':'ies')+' ticked');
    var insight=parts.length?parts.join(' · ')+'.':'A clean slate to work with.';
    dEl.innerHTML=dateStr+'. '+insight;
  }

  // Smart focus card — 50/50 habits + daily priorities (day-scoped)
  var focusStatEl=document.getElementById('focus-stat');
  var focusSubEl=document.getElementById('focus-sub');
  var focusBarsEl=document.getElementById('focus-bars');
  if(focusStatEl&&focusSubEl&&focusBarsEl){
    if(!STATE.dailyPriorities)STATE.dailyPriorities={};
    var todayPris=STATE.dailyPriorities[todayKey]||[];
    var priDone=todayPris.filter(function(p){return p.done}).length;
    var priTotal=todayPris.length;
    var dailyPriPct=priTotal>0?Math.round((priDone/priTotal)*100):0;
    // Weighted score: if no priorities set, use habits only
    var overall=priTotal>0?Math.round((habPct+dailyPriPct)/2):habPct;
    var msg;
    if(overall>=75)msg='You\'re <em>flying</em>. Keep it going.';
    else if(overall>=50)msg='Good rhythm today — one more win to go.';
    else if(overall>=25)msg='Small steps compound. Pick one thing.';
    else msg='A fresh start. Begin with the smallest win.';
    if(!focusStatEl.querySelector('.focus-stat-num')){
      focusStatEl.innerHTML='<span class="focus-stat-num">0</span><span class="focus-stat-suffix"> /100</span>';
    }
    var numEl=focusStatEl.querySelector('.focus-stat-num');
    tickNumber(numEl,String(overall),1000);
    focusSubEl.innerHTML=msg;
    var barsHtml=focusBar('✅','Habits',habitsToday+'/'+STATE.habits.length,habPct,'var(--grad-green)');
    if(priTotal>0){
      barsHtml+=focusBar('📝','Tasks',priDone+'/'+priTotal,dailyPriPct,'var(--grad-accent)');
    }
    focusBarsEl.innerHTML=barsHtml;
    setTimeout(function(){
      focusBarsEl.querySelectorAll('.focus-bar-fill').forEach(function(el){
        var w=el.getAttribute('data-w');el.style.width=w+'%';
      });
    },80);
  }

  // Mini stat orbs on the right
  setStat('priorities',priData.done+' / '+priData.total,priPct);
  setStat('habits',habitsToday+' / '+STATE.habits.length,habPct);
  setStat('roadmap',rmProgress+'%',rmProgress);

  var ppEl=document.getElementById('dash-priorities-preview');
  if(ppEl){
    if(!STATE.dailyPriorities)STATE.dailyPriorities={};
    var todayPris=STATE.dailyPriorities[todayKey]||[];
    var html='';
    if(todayPris.length){
      html=todayPris.map(function(p,i){
        var done=p.done;
        return '<div class="daily-pri-row'+(done?' done':'')+'">'
          +'<div class="daily-pri-check" onclick="toggleDailyPri(\''+todayKey+'\','+i+')">'+(done?'<span>\u2713</span>':'')+'</div>'
          +'<span class="daily-pri-text">'+escapeHtml(p.text)+'</span>'
          +'<button class="daily-pri-action" title="Move to tomorrow" onclick="moveDailyPriToTomorrow(\''+todayKey+'\','+i+')">→</button>'
          +'<button class="daily-pri-action daily-pri-delete" title="Remove" onclick="deleteDailyPri(\''+todayKey+'\','+i+')">×</button>'
          +'</div>';
      }).join('');
    }else{
      html='<div class="empty-prompt-mini">What do you need to get done today?</div>';
    }
    html+='<div class="daily-pri-add-row">'
      +'<input type="text" id="daily-pri-input" placeholder="Add a task for today..." onkeydown="if(event.key===\'Enter\'){addDailyPri()}">'
      +'<button class="daily-pri-add-btn" onclick="addDailyPri()">+</button>'
      +'</div>';
    ppEl.innerHTML=html;
  }
  var days7=weekDays(weekKey(now));var dl=['S','M','T','W','T','F','S'];
  var hpEl=document.getElementById('dash-habits-preview');
  if(hpEl)hpEl.innerHTML=STATE.habits.slice(0,5).map(function(h){return '<div class="habit-row"><div style="flex:1;min-width:0"><div class="habit-name">'+h.name+'</div></div><div class="habit-dots">'+days7.map(function(d,i){var done=h.logs[d];var isT=d===todayKey;return '<div class="dot'+(done?' done':'')+(isT&&!done?' today':'')+'" onclick="quickToggleHabit(\''+h.id+'\',\''+d+'\')">'+dl[i]+'</div>'}).join('')+'</div></div>'}).join('')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'habits\')" style="margin-top:10px;width:100%;justify-content:center">View all \u2192</button>';
  renderDashMoodCheckin();
  renderDashWater();
  var gEl2=document.getElementById('dash-gratitude-preview');
  if(gEl2){var todayEntries=(STATE.gratitude||[]).filter(function(e){return e.date===todayKey});if(todayEntries.length){gEl2.innerHTML=todayEntries.map(function(e){return (e.wins?'<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)"><span style="color:var(--accent)">\ud83c\udfc6</span><span style="font-size:12px">'+e.wins+'</span></div>':'')+(e.gratitude?'<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)"><span style="color:var(--gold)">\ud83d\ude4f</span><span style="font-size:12px">'+e.gratitude+'</span></div>':'')}).join('')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'gratitude\')" style="margin-top:6px;width:100%;justify-content:center">View all \u2192</button>'}else{gEl2.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px 0">Nothing logged today</div><button class="btn btn-accent btn-sm" onclick="openModal(\'addGratitude\')" style="width:100%;justify-content:center">+ Log gratitude</button>'}}
  var recent=(STATE.workouts||[]).slice(-3).reverse();
  var recentRuns=((STATE.metrics||{}).run||[]).slice(-3).reverse();
  var combined=recent.map(function(w){return {type:'gym',date:w.date,name:w.name,sub:(w.muscleGroups||[]).join(', '),icon:((w.muscleGroups||[]).indexOf('Hyrox')!==-1)?'\u26a1':'\ud83c\udfcb\ufe0f'}}).concat(recentRuns.map(function(r){return {type:'run',date:r.date,name:r.distance+'km'+(r.time?' \u00b7 '+r.time:''),sub:r.note||'Run',icon:'\ud83c\udfc3'}})).sort(function(a,b){return b.date.localeCompare(a.date)}).slice(0,5);
  var wpEl=document.getElementById('dash-workouts-preview');
  if(wpEl)wpEl.innerHTML=combined.length?combined.map(function(w){var bgCol=w.type==='run'?'var(--secondary-dim)':'var(--primary-dim)';var iconCol=w.type==='run'?'var(--secondary)':'var(--primary)';return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:36px;height:36px;border-radius:12px;background:'+bgCol+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:16px">'+w.icon+'</span></div><div style="flex:1"><div style="font-size:13px;font-weight:600">'+w.name+'</div><div style="font-size:10px;color:var(--neutral);text-transform:uppercase;font-weight:500;margin-top:2px">'+w.sub+' \u00b7 '+fmtDate(w.date)+'</div></div></div>'}).join('')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'workout\')" style="margin-top:8px;width:100%;justify-content:center">View all \u2192</button>':'<div class="empty" style="padding:12px 0"><div style="font-size:28px;margin-bottom:6px">\ud83c\udfcb\ufe0f</div>No sessions yet</div><button class="btn btn-accent btn-sm" onclick="openModal(\'startSession\')" style="width:100%;justify-content:center">+ Start session</button>';
  renderDashboardRelationships();
  var tExp=(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);var tInc=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0);var tDebt=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance)},0);var tSav=(STATE.accounts||[]).reduce(function(s,a){return s+Number(a.balance)},0);var left=tInc-tExp;
  var fpEl=document.getElementById('dash-finance-preview');
  if(fpEl)fpEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div style="background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.4);border-radius:12px;padding:14px;text-align:center"><div style="font-size:10px;color:var(--neutral);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Savings</div><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--secondary);margin-top:4px">'+fmtMoney(tSav)+'</div></div><div style="background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.4);border-radius:12px;padding:14px;text-align:center"><div style="font-size:10px;color:var(--neutral);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Total debt</div><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--primary);margin-top:4px">'+fmtMoney(tDebt)+'</div></div></div><div style="font-size:11px;color:var(--on-surface-variant)">'+fmtMoney(tInc)+' in \u00b7 '+fmtMoney(tExp)+' out \u00b7 <span style="color:'+(left>=0?'var(--mint)':'var(--red)')+';font-weight:600">'+fmtMoney(Math.abs(left))+' '+(left>=0?'left over':'over')+'</span></div><button class="btn btn-ghost btn-sm" onclick="nav(\'finance\')" style="margin-top:8px;width:100%;justify-content:center">View finance \u2192</button>';
  var rpEl=document.getElementById('dash-roadmap-preview');
  if(rpEl){var curRM=RM_MONTHS.find(function(m){return m.year===now.getFullYear().toString()&&m.name===now.toLocaleDateString('en-GB',{month:'long'})});if(!curRM)curRM=RM_MONTHS[0];var rp=rmGetProgress(curRM);var nextItems=[];curRM.sections.forEach(function(sec,si){sec.items.forEach(function(item,ii){if(!rmIsDone(curRM.id,si,ii))nextItems.push({text:item.text})})});rpEl.innerHTML='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="font-weight:600">'+curRM.name+' '+curRM.year+'</span><span style="color:'+rmPctColor(rp.pct)+'">'+rp.pct+'%</span></div><div class="pbar-wrap"><div class="pbar" style="width:'+rp.pct+'%;background:'+rmPctColor(rp.pct)+'"></div></div><div style="font-size:11px;color:var(--text3)">'+rp.done+'/'+rp.total+' tasks done</div></div>'+(nextItems.length?nextItems.slice(0,3).map(function(i){return '<div style="font-size:11px;color:var(--text2);padding:5px 0;border-bottom:1px solid var(--border);display:flex;gap:6px"><span style="color:var(--text3)">\u2192</span>'+i.text+'</div>'}).join(''):'<div style="font-size:11px;color:var(--mint);padding:8px 0">\u2713 All tasks complete this month!</div>')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'roadmap\')" style="margin-top:8px;width:100%;justify-content:center">Open Roadmap \u2192</button>'}
}

function quickToggleHabit(hid,day){var h=STATE.habits.find(function(x){return x.id===hid});if(!h)return;var wasDone=h.logs[day];h.logs[day]=!h.logs[day];saveState();renderDashboard();if(!wasDone&&h.logs[day]){var s=habitStreak(h);if(s===7||s===14||s===21||s===30){fireConfetti();showCelebrationToast(h.name+' — '+s+' day streak!','🔥')}}}
function toggleDashPriority(idx){var wk=weekKey(new Date());if(!STATE.weeklyPlans)STATE.weeklyPlans={};if(!STATE.weeklyPlans[wk])STATE.weeklyPlans[wk]={priorities:[]};if(!STATE.weeklyPlans[wk].prioritiesDone)STATE.weeklyPlans[wk].prioritiesDone={};STATE.weeklyPlans[wk].prioritiesDone[idx]=!STATE.weeklyPlans[wk].prioritiesDone[idx];saveState();renderDashboard()}

// GOALS (simplified)
function renderGoals(){var catColors={Finance:'#7a8fa6',Fitness:'#9b7b8a',Career:'#d4845a',Personal:'#6b9e7a'};var all=STATE.goals||[];var doneCount=all.filter(function(g){return g.done}).length;var total=all.length;var pct=total>0?Math.round(doneCount/total*100):0;var sumEl=document.getElementById('goals-summary');if(sumEl&&total>0){var sh='<div style="display:flex;gap:12px;flex-wrap:wrap">';
/* Overall progress card */
sh+='<div class="card" style="flex:1;min-width:200px;padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap"><div style="font-size:13px;font-weight:500;color:var(--text2)">'+doneCount+' of '+total+' goals completed</div><div style="flex:1;min-width:120px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--mint);border-radius:3px;transition:width .4s"></div></div><span style="font-size:13px;font-weight:600;color:var(--mint)">'+pct+'%</span></div>';
/* Category breakdown */
var cats=['Finance','Fitness','Career','Personal'];
sh+='<div class="card" style="min-width:200px;padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">';
cats.forEach(function(c){var catAll=all.filter(function(g){return g.cat===c});var catDone=catAll.filter(function(g){return g.done}).length;if(catAll.length>0)sh+='<div style="text-align:center"><div style="font-size:16px;font-family:var(--serif);font-weight:600;color:'+(catColors[c]||'var(--accent)')+'">'+catDone+'/'+catAll.length+'</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">'+c+'</div></div>'});
sh+='</div></div>';
/* Up next — most urgent undone goal */
var upcoming=all.filter(function(g){return !g.done&&g.deadline}).sort(function(a,b){return a.deadline.localeCompare(b.deadline)});
if(upcoming.length){var ug=upcoming[0];var udl=daysLeft(ug.deadline);var overdue=udl<0;sh+='<div style="background:linear-gradient(135deg,#fdf6e8,#f2e8d8);border:1.5px solid '+(overdue?'var(--red)':'var(--gold)')+';border-radius:var(--radius);padding:12px 18px;margin-top:12px;display:flex;align-items:center;gap:12px"><div style="font-size:22px">'+(overdue?'⚠️':'🎯')+'</div><div style="flex:1"><div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:'+(overdue?'var(--red)':'var(--gold)')+'">Up next</div><div style="font-size:14px;font-weight:600;margin-top:2px">'+ug.name+'</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:600;color:'+(overdue?'var(--red)':'var(--text)')+'">'+( overdue?Math.abs(udl)+' days overdue':udl+' days left')+'</div><div style="font-size:10px;color:var(--text3)">'+fmtDate(ug.deadline)+'</div></div></div>'}
sumEl.innerHTML=sh}else if(sumEl){sumEl.innerHTML=''}
var filtered=all;if(goalFilter==='Done')filtered=all.filter(function(g){return g.done});else if(goalFilter==='Active')filtered=all.filter(function(g){return !g.done});else if(goalFilter!=='all')filtered=all.filter(function(g){return g.cat===goalFilter});
var el=document.getElementById('goals-container');if(!el)return;if(!filtered.length){el.innerHTML='<div class="empty"><div class="empty-icon">\ud83c\udfaf</div>'+(total>0?'No goals match this filter':'No goals yet. Add one!')+'</div>';return}
el.innerHTML=filtered.map(function(go){var isDone=go.done;var dl=daysLeft(go.deadline);var col=catColors[go.cat]||'var(--accent)';var overdue=!isDone&&dl<0;
var h='<div class="card goal-item" style="margin-bottom:12px;border-left:4px solid '+col+';'+(isDone?'opacity:0.65;':'')+'"><div style="display:flex;align-items:flex-start;gap:14px">';
/* Tickbox */
h+='<div onclick="toggleGoalDone(\''+go.id+'\')" style="width:28px;height:28px;border-radius:50%;border:2px solid '+(isDone?'var(--mint)':col)+';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .15s;background:'+(isDone?'var(--mint)':'transparent')+'">'+(isDone?'<span style="color:#fff;font-size:14px;font-weight:700">✓</span>':'')+'</div>';
/* Content */
h+='<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px"><span class="badge badge-'+go.badge+'">'+go.cat+'</span>';
if(isDone)h+='<span class="badge badge-done">Done</span>';
else if(overdue)h+='<span class="badge badge-risk">Overdue</span>';
h+='</div>';
h+='<div style="font-size:15px;font-weight:600;'+(isDone?'text-decoration:line-through;color:var(--text3)':'')+'">'+go.name+'</div>';
if(go.desc)h+='<div style="font-size:12px;color:var(--text2);margin-top:3px;'+(isDone?'text-decoration:line-through':'')+'">'+go.desc+'</div>';
/* Deadline */
if(go.deadline){h+='<div style="font-size:11px;margin-top:6px;color:'+(overdue?'var(--red)':'var(--text3)')+'">📅 '+(isDone?'Completed':'Due '+fmtDate(go.deadline)+(dl>0?' · '+dl+' days left':''))+'</div>'}
h+='<button class="goal-roadmap-link" onclick="nav(\'roadmap\')">\ud83d\uddd3\ufe0f Monthly steps in Roadmap</button>';
h+='</div>';
/* Actions */
h+='<div class="goal-actions"><button class="btn btn-sm btn-ghost" onclick="openModal(\'editGoal\',\''+go.id+'\')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteGoal(\''+go.id+'\')">×</button></div>';
h+='</div></div>';return h}).join('')}
function filterGoals(cat,btn){goalFilter=cat;document.querySelectorAll('#goal-filters .filter-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');renderGoals()}
function toggleGoalDone(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;var wasDone=goal.done;goal.done=!goal.done;if(goal.done)goal.progress=goal.target;saveState();renderGoals();if(!wasDone&&goal.done){fireConfetti({count:150,duration:3000});showCelebrationToast('Goal complete: '+goal.name,'🎯')}}
function saveGoal(){var name=((document.getElementById('m-gname')||{}).value||'').trim();if(!name)return;var cat=(document.getElementById('m-gcat')||{}).value||'Personal';var badges={Finance:'fin',Fitness:'fit',Career:'car',Personal:'per'};STATE.goals.push({id:g(),name:name,cat:cat,badge:badges[cat]||'per',desc:(document.getElementById('m-gdesc')||{}).value||'',target:100,unit:'%',direction:'up',deadline:(document.getElementById('m-gdeadline')||{}).value||'2026-12-31',progress:0,done:false,subGoals:[]});saveState();closeModal();renderGoals()}
function updateGoalProgress(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;var wasDone=goalPct(goal)>=100;goal.progress=Number((document.getElementById('m-gprogress')||{}).value)||0;saveState();closeModal();renderGoals();if(!wasDone&&goalPct(goal)>=100){fireConfetti({count:150,duration:3000});showCelebrationToast('Goal complete: '+goal.name,'🎯')}}
function editGoalSave(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;goal.name=(document.getElementById('m-gname')||{}).value||goal.name;goal.deadline=(document.getElementById('m-gdeadline')||{}).value||goal.deadline;goal.desc=(document.getElementById('m-gdesc')||{}).value||'';var cat=(document.getElementById('m-gcat')||{}).value;if(cat){goal.cat=cat;var badges={Finance:'fin',Fitness:'fit',Career:'car',Personal:'per'};goal.badge=badges[cat]||goal.badge}saveState();closeModal();renderGoals()}
function deleteGoal(id){confirmDelete('Delete this goal?',function(){STATE.goals=STATE.goals.filter(function(g){return g.id!==id});saveState();renderGoals()})}
function saveMetric(type){if(!STATE.metrics)STATE.metrics={};var date=(document.getElementById('m-mdate')||{}).value||localDateKey(new Date());var note=(document.getElementById('m-mnote')||{}).value||'';var entry={id:g(),date:date};if(type==='project'){var name=((document.getElementById('m-mname')||{}).value||'').trim();if(!name)return;entry.name=name}else if(type==='run'){var val=(document.getElementById('m-mval')||{}).value;if(!val)return;entry.distance=Number(val);entry.time=(document.getElementById('m-mtime')||{}).value||'';entry.note=note}else if(type==='moneySaved'){var val=(document.getElementById('m-mval')||{}).value;if(!val)return;entry.amount=Number(val);entry.note=note}else{var val=(document.getElementById('m-mval')||{}).value;if(!val)return;entry.value=Number(val);entry.note=note}if(!STATE.metrics[type])STATE.metrics[type]=[];STATE.metrics[type].push(entry);saveState();closeModal();renderMetrics();if(type==='run'){var rrEl=document.getElementById('recent-runs-workout');if(rrEl)renderWorkout()}}




// ── DAILY PRIORITIES ──
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function addDailyPri(){
  var input=document.getElementById('daily-pri-input');
  if(!input)return;
  var text=input.value.trim();
  if(!text)return;
  var key=localDateKey(new Date());
  if(!STATE.dailyPriorities)STATE.dailyPriorities={};
  if(!STATE.dailyPriorities[key])STATE.dailyPriorities[key]=[];
  STATE.dailyPriorities[key].push({text:text,done:false});
  input.value='';
  saveState();
  renderDashboard();
}
function toggleDailyPri(dateKey,idx){
  var list=(STATE.dailyPriorities||{})[dateKey];
  if(!list||!list[idx])return;
  list[idx].done=!list[idx].done;
  saveState();
  renderDashboard();
}
function deleteDailyPri(dateKey,idx){
  var list=(STATE.dailyPriorities||{})[dateKey];
  if(!list)return;
  list.splice(idx,1);
  saveState();
  renderDashboard();
}
function moveDailyPriToTomorrow(dateKey,idx){
  var list=(STATE.dailyPriorities||{})[dateKey];
  if(!list||!list[idx])return;
  var item=list[idx];
  item.done=false;
  // Compute tomorrow from dateKey
  var parts=dateKey.split('-');
  var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  d.setDate(d.getDate()+1);
  var tomorrowKey=localDateKey(d);
  if(!STATE.dailyPriorities[tomorrowKey])STATE.dailyPriorities[tomorrowKey]=[];
  STATE.dailyPriorities[tomorrowKey].push(item);
  list.splice(idx,1);
  saveState();
  renderDashboard();
}


// ── TASKS ARCHIVE PAGE ──
function renderTasksArchive(){
  var statsEl=document.getElementById('tasks-stats');
  var archEl=document.getElementById('tasks-archive');
  if(!archEl)return;
  if(!STATE.dailyPriorities)STATE.dailyPriorities={};
  var allKeys=Object.keys(STATE.dailyPriorities).filter(function(k){
    return (STATE.dailyPriorities[k]||[]).length>0;
  }).sort().reverse();

  if(allKeys.length===0){
    if(statsEl)statsEl.innerHTML='';
    archEl.innerHTML='<div class="empty"><div class="empty-icon">📝</div>No tasks yet. Add some from the dashboard to start building history.</div>';
    return;
  }

  // Aggregate stats
  var totalTasks=0,totalDone=0;
  var last30=0,last30Done=0;
  var thirtyAgo=new Date();thirtyAgo.setDate(thirtyAgo.getDate()-30);
  var thirtyKey=localDateKey(thirtyAgo);
  allKeys.forEach(function(k){
    var list=STATE.dailyPriorities[k]||[];
    list.forEach(function(t){
      totalTasks++;
      if(t.done)totalDone++;
      if(k>=thirtyKey){
        last30++;
        if(t.done)last30Done++;
      }
    });
  });
  var overallPct=totalTasks>0?Math.round(totalDone/totalTasks*100):0;
  var recentPct=last30>0?Math.round(last30Done/last30*100):0;
  var todayKey=localDateKey(new Date());
  var todayList=STATE.dailyPriorities[todayKey]||[];
  var todayDone=todayList.filter(function(t){return t.done}).length;

  if(statsEl){
    statsEl.innerHTML=
      '<div class="card-sm" style="text-align:center;border-top:3px solid var(--accent)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:var(--accent-dark);line-height:1">'+totalDone+'</div><div style="font-size:11px;color:var(--text2);margin-top:4px">of '+totalTasks+' all-time</div></div>'
      +'<div class="card-sm" style="text-align:center;border-top:3px solid var(--mint)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:#5A8A55;line-height:1">'+overallPct+'%</div><div style="font-size:11px;color:var(--text2);margin-top:4px">completion rate</div></div>'
      +'<div class="card-sm" style="text-align:center;border-top:3px solid var(--purple)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:#7A6A9E;line-height:1">'+recentPct+'%</div><div style="font-size:11px;color:var(--text2);margin-top:4px">last 30 days</div></div>'
      +'<div class="card-sm" style="text-align:center;border-top:3px solid var(--gold)"><div style="font-family:var(--serif);font-size:26px;font-weight:500;color:#B8860B;line-height:1">'+todayDone+'/'+todayList.length+'</div><div style="font-size:11px;color:var(--text2);margin-top:4px">today</div></div>';
  }

  // Group by date and render
  archEl.innerHTML=allKeys.map(function(k){
    var list=STATE.dailyPriorities[k]||[];
    var done=list.filter(function(t){return t.done}).length;
    var total=list.length;
    var pct=Math.round(done/total*100);
    var d=new Date(k);
    var isToday=k===todayKey;
    var dateLabel=isToday?'Today':d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined});
    return '<div class="card" style="margin-bottom:14px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">'
        +'<div>'
          +'<div style="font-family:var(--serif);font-size:18px;font-weight:500;letter-spacing:-0.01em">'+dateLabel+(isToday?' <span class="badge" style="background:var(--accent);color:var(--white);font-size:10px;margin-left:6px;vertical-align:middle">LIVE</span>':'')+'</div>'
          +'<div style="font-size:12px;color:var(--text2);margin-top:2px">'+done+' of '+total+' complete · '+pct+'%</div>'
        +'</div>'
        +'<div style="min-width:160px;flex:1;max-width:260px">'
          +'<div class="pbar-wrap" style="margin:0"><div class="pbar" style="width:'+pct+'%"></div></div>'
        +'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'
        +list.map(function(t,idx){
          return '<div class="tasks-arch-item'+(t.done?' done':'')+'" onclick="toggleArchiveTask(\''+k+'\','+idx+')">'
            +'<div class="tasks-arch-check">'+(t.done?'✓':'')+'</div>'
            +'<span>'+escapeHtml(t.text)+'</span>'
            +'</div>';
        }).join('')
      +'</div>'
      +'</div>';
  }).join('');
}

function toggleArchiveTask(dateKey,idx){
  var list=(STATE.dailyPriorities||{})[dateKey];
  if(!list||!list[idx])return;
  list[idx].done=!list[idx].done;
  saveState();
  renderTasksArchive();
}
