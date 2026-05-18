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
  // Auto night mode (only if user hasn't set a manual preference)
  var themePref=null;try{themePref=localStorage.getItem('lh_theme')}catch(e){}
  if(!themePref){
    if(ctx.slot==='night')document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
  }
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

  // End-of-month review nudge (28th onwards)
  var nudgeEl=document.getElementById('dash-review-nudge');
  if(nudgeEl){
    var dayOfMonth=now.getDate();
    var monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    var monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    var existing=(STATE.reviews&&STATE.reviews.monthly&&STATE.reviews.monthly[monthKey]);

    var nudges=[];
    // Evening gratitude nudge — after 6pm with nothing logged today
    var todayK_n=localDateKey(now);
    var hasGratitudeToday=(STATE.gratitude||[]).some(function(e){return e.date===todayK_n});
    var hr=now.getHours();
    if(hr>=18&&hr<23&&!hasGratitudeToday){
      var dismissedKey='lh_gr_nudge_dismissed:'+todayK_n;
      var dismissed=false;try{dismissed=!!sessionStorage.getItem(dismissedKey)}catch(e){}
      if(!dismissed){
        nudges.push('<div class="review-nudge" onclick="document.getElementById(\'dash-gr-win\')&&document.getElementById(\'dash-gr-win\').focus()" style="background:linear-gradient(135deg,rgba(234,208,170,0.15),rgba(217,123,108,0.08))"><div class="review-nudge-icon" style="background:rgba(234,208,170,0.25)">🙏</div><div class="review-nudge-body"><div class="review-nudge-title">Wind-down moment</div><div class="review-nudge-sub">Nothing logged in your gratitude yet today. One line takes 10 seconds.</div></div><button class="review-nudge-arrow" onclick="event.stopPropagation();dismissGratitudeNudge()" title="Dismiss for today" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;padding:4px 8px">×</button></div>');
      }
    }
    if(dayOfMonth>=monthEnd-2&&!existing){
      var monthName=now.toLocaleDateString('en-GB',{month:'long'});
      nudges.push('<div class="review-nudge" onclick="nav(\'review\')"><div class="review-nudge-icon">🌙</div><div class="review-nudge-body"><div class="review-nudge-title">'+monthName+' is almost wrapped.</div><div class="review-nudge-sub">Time for your monthly review — 10 mins of honest reflection.</div></div><div class="review-nudge-arrow">→</div></div>');
    }
    nudgeEl.innerHTML=nudges.join('');
  }

  var goalsDone=STATE.goals.filter(function(g){return g.done}).length;
  // Only count habits that are expected today (daily + weekly ones that haven't hit their target)
  var expectedHabits=STATE.habits.filter(function(h){
    var status=habitDayStatus(h,todayKey);
    return status==='done'||status==='todo';  // exclude 'rest' (monthly/bi-monthly not today, or weekly already hit)
  });
  var habitsToday=expectedHabits.filter(function(h){return h.logs[todayKey]}).length;
  var habitsTotal=expectedHabits.length;

  var priData=(function(){var wk=weekKey(now);var plan=(STATE.weeklyPlans||{})[wk]||{};var pris=(plan.priorities||[]).filter(function(p){return p&&p.trim()});var done=0;var td=plan.prioritiesDone||{};pris.forEach(function(_,i){if(td[i])done++});return {done:done,total:pris.length}})();
  var priPct=priData.total>0?Math.round(priData.done/priData.total*100):0;
  var habPct=habitsTotal>0?Math.round(habitsToday/habitsTotal*100):0;

  // Smart hero subtext
  if(dEl){
    var dateStr=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    var parts=[];
    if(habitsToday>0)parts.push('<strong>'+habitsToday+'</strong> habit'+(habitsToday===1?'':'s')+' done');
    if(priData.done>0)parts.push('<strong>'+priData.done+'</strong> priorit'+(priData.done===1?'y':'ies')+' ticked');
    var insight=parts.length?parts.join(' · ')+'.':'A clean slate to work with.';
    dEl.innerHTML=dateStr+'. '+insight;
  }

  // Smart focus card — habits + daily tasks (today-scoped, no roadmap)
  var focusStatEl=document.getElementById('focus-stat');
  var focusSubEl=document.getElementById('focus-sub');
  var focusBarsEl=document.getElementById('focus-bars');
  var focusLabelEl=document.getElementById('focus-score-label');
  if(focusStatEl&&focusSubEl&&focusBarsEl){
    if(!STATE.dailyPriorities)STATE.dailyPriorities={};
    var todayPris=STATE.dailyPriorities[todayKey]||[];
    var priDone=todayPris.filter(function(p){return p.done}).length;
    var priTotal=todayPris.length;
    var totalDone=habitsToday+priDone;
    var totalAll=habitsTotal+priTotal;
    var overallPct=totalAll>0?Math.round((totalDone/totalAll)*100):0;

    var msg;
    if(totalAll===0){
      msg='Add a habit or today\'s first task to get going.';
    }else if(overallPct>=100){
      msg='Everything ticked. <em>Beautiful day.</em>';
    }else if(overallPct>=75){
      msg='You\'re <em>flying</em>. One or two to go.';
    }else if(overallPct>=50){
      msg='Good rhythm today — halfway there.';
    }else if(overallPct>=25){
      msg='Small steps compound. Pick one thing.';
    }else if(totalDone>0){
      msg='First one\'s down. Keep the momentum.';
    }else{
      msg='A fresh start. Begin with the smallest win.';
    }

    // Render as "done / total" rather than "/100"
    focusStatEl.innerHTML=totalAll===0
      ? '<span class="focus-stat-num">—</span>'
      : '<span class="focus-stat-num">'+totalDone+'</span><span class="focus-stat-suffix"> / '+totalAll+'</span>';
    if(focusLabelEl){
      focusLabelEl.textContent=totalAll===0?'Nothing tracked today yet' : 'Habits + tasks done today';
    }
    focusSubEl.innerHTML=msg;

    var barsHtml='';
    if(habitsTotal>0){
      barsHtml+=focusBar('✅','Habits',habitsToday+'/'+habitsTotal,habPct,'var(--grad-green)');
    }else{
      barsHtml+='<div class="focus-bar focus-bar-empty"><span class="focus-bar-icon">✅</span><span class="focus-bar-label">No habits due today</span><button class="focus-bar-cta" onclick="nav(\'habits\')">Set one →</button></div>';
    }
    if(priTotal>0){
      var dailyPriPct=Math.round((priDone/priTotal)*100);
      barsHtml+=focusBar('📝','Tasks',priDone+'/'+priTotal,dailyPriPct,'var(--grad-accent)');
    }else{
      barsHtml+='<div class="focus-bar focus-bar-empty"><span class="focus-bar-icon">📝</span><span class="focus-bar-label">No tasks added yet</span><button class="focus-bar-cta" onclick="document.getElementById(\'daily-pri-input\')&&document.getElementById(\'daily-pri-input\').focus()">Add one →</button></div>';
    }
    focusBarsEl.innerHTML=barsHtml;
    setTimeout(function(){
      focusBarsEl.querySelectorAll('.focus-bar-fill').forEach(function(el){
        var w=el.getAttribute('data-w');el.style.width=w+'%';
      });
    },80);
  }

  // Side stat orbs — today-scoped only (habits + daily tasks)
  var todayPrisForStats=(STATE.dailyPriorities||{})[todayKey]||[];
  var priDoneToday=todayPrisForStats.filter(function(p){return p.done}).length;
  var priTotalToday=todayPrisForStats.length;
  var priPctToday=priTotalToday>0?Math.round(priDoneToday/priTotalToday*100):0;
  // Monthly focus carry-over (item 12) — show last month's review focus on day 1-7 of new month
  renderDashMonthlyFocus();
  // Mini mood orb (item 4)
  renderDashMoodMini();

  var ppEl=document.getElementById('dash-priorities-preview');
  if(ppEl){
    if(!STATE.dailyPriorities)STATE.dailyPriorities={};
    var todayPris=STATE.dailyPriorities[todayKey]||[];
    var wkKey=weekKey(now);
    if(!STATE.weeklyPlans)STATE.weeklyPlans={};
    if(!STATE.weeklyPlans[wkKey])STATE.weeklyPlans[wkKey]={priorities:['','',''],prioritiesDone:{}};
    var wPlan=STATE.weeklyPlans[wkKey];
    if(!wPlan.priorities)wPlan.priorities=['','',''];
    if(!wPlan.prioritiesDone)wPlan.prioritiesDone={};
    var wSet=wPlan.priorities.filter(function(p){return p&&p.trim()}).length;
    var wDone=wPlan.priorities.filter(function(p,i){return p&&p.trim()&&wPlan.prioritiesDone[i]}).length;

    var html='';

    // Weekly priorities anchor block (always at top)
    html+='<div class="dash-w-anchors">';
    html+='<div class="dash-w-anchors-head"><span class="dash-w-anchors-label">📌 This week</span>'
      +(wSet>0?'<span class="dash-w-anchors-count">'+wDone+'/'+wSet+'</span>':'')
      +'</div>';
    html+=wPlan.priorities.map(function(val,i){
      var done=!!wPlan.prioritiesDone[i];
      var safe=(val||'').replace(/"/g,'&quot;');
      return '<div class="dash-w-anchor-row'+(done?' done':'')+'">'
        +'<div class="dash-w-anchor-tick" onclick="toggleDashWeeklyTop3('+i+')">'+(done?'✓':(i+1))+'</div>'
        +'<input type="text" class="dash-w-anchor-input" value="'+safe+'" placeholder="Top priority '+(i+1)+'…" onblur="saveDashWeeklyTop3('+i+',this.value)" onkeydown="if(event.key===\'Enter\'){this.blur()}">'
        +'</div>';
    }).join('');
    html+='</div>';

    // Today's tasks
    html+='<div class="dash-today-head"><span class="dash-today-label">✅ Today</span>'
      +(todayPris.length?'<span class="dash-today-count">'+todayPris.filter(function(p){return p.done}).length+'/'+todayPris.length+'</span>':'')
      +'</div>';
    if(todayPris.length){
      html+=todayPris.map(function(p,i){
        var done=p.done;
        return '<div class="daily-pri-row'+(done?' done':'')+'">'
          +'<div class="daily-pri-check" onclick="toggleDailyPri(\''+todayKey+'\','+i+')">'+(done?'<span>\u2713</span>':'')+'</div>'
          +'<span class="daily-pri-text">'+escapeHtml(p.text)+'</span>'
          +'<button class="daily-pri-action" title="Move to tomorrow" onclick="moveDailyPriToTomorrow(\''+todayKey+'\','+i+')">→</button>'
          +'<button class="daily-pri-action daily-pri-delete" title="Remove" onclick="deleteDailyPri(\''+todayKey+'\','+i+')">×</button>'
          +'</div>';
      }).join('');
    }else{
      html+='<div class="empty-prompt-mini">What do you need to get done today?</div>';
    }
    html+='<div class="daily-pri-add-row">'
      +'<input type="text" id="daily-pri-input" placeholder="Add a task for today..." onkeydown="if(event.key===\'Enter\'){addDailyPri()}">'
      +'<button class="daily-pri-add-btn" onclick="addDailyPri()">+</button>'
      +'</div>';
    ppEl.innerHTML=html;
  }
  var days7=weekDays(weekKey(now));var dl=['S','M','T','W','T','F','S'];
  var hpEl=document.getElementById('dash-habits-preview');
  if(hpEl){
    // Sort: today's undone first, then today's done, then habits not due today
    var habitsForDash=(STATE.habits||[]).slice().sort(function(a,b){
      var aStatus=habitDayStatus(a,todayKey);
      var bStatus=habitDayStatus(b,todayKey);
      var rank={'todo':0,'done':1,'rest':2,'pre-start':3};
      return (rank[aStatus]||0)-(rank[bStatus]||0);
    });
    if(!habitsForDash.length){
      hpEl.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:14px 0">No habits yet. <a href="#" onclick="nav(\'habits\');return false" style="color:var(--accent-dark)">Add one →</a></div>';
    }else{
      hpEl.innerHTML=habitsForDash.map(function(h){
        var status=habitDayStatus(h,todayKey);
        var streak=habitStreak(h);
        var meta=HABIT_CAT_META[h.badge]||HABIT_CAT_META.per||{color:'#6B9E7A',emoji:'✅'};
        var icon=h.icon||meta.emoji;
        var streakBadge='';
        if(streak>=7)streakBadge='<span class="dh-row-streak">🔥'+streak+'</span>';
        else if(streak>=3)streakBadge='<span class="dh-row-streak">⚡'+streak+'</span>';
        else if(streak>0)streakBadge='<span class="dh-row-streak quiet">'+streak+'d</span>';
        var checkCls='dh-row-check';
        var checkInner='';
        if(status==='done'){checkCls+=' done';checkInner='✓'}
        else if(status==='rest'){checkCls+=' rest';checkInner='–'}
        else if(status==='pre-start'){checkCls+=' pre';checkInner=''}
        var clickable=status==='todo'||status==='done';
        var click=clickable?'onclick="quickToggleHabit(\''+h.id+'\',\''+todayKey+'\')"':'';
        return '<div class="dh-row'+(status==='done'?' done':'')+'" '+click+'>'
          +'<div class="dh-row-icon" style="background:'+meta.color+'18;color:'+meta.color+'">'+icon+'</div>'
          +'<div class="dh-row-name">'+escapeHtml(h.name)+'</div>'
          +streakBadge
          +'<div class="'+checkCls+'">'+checkInner+'</div>'
          +'</div>';
      }).join('')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'habits\')" style="margin-top:10px;width:100%;justify-content:center">View all →</button>';
    }
  }
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
  renderDashMoodWeek();
  var tExp=(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);var tInc=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0);var tDebt=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance)},0);var tSav=(STATE.accounts||[]).reduce(function(s,a){return s+Number(a.balance)},0);var left=tInc-tExp;
  var fpEl=document.getElementById('dash-finance-preview');
  if(fpEl)fpEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div style="background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.4);border-radius:12px;padding:14px;text-align:center"><div style="font-size:10px;color:var(--neutral);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Savings</div><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--secondary);margin-top:4px">'+fmtMoney(tSav)+'</div></div><div style="background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.4);border-radius:12px;padding:14px;text-align:center"><div style="font-size:10px;color:var(--neutral);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Total debt</div><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--primary);margin-top:4px">'+fmtMoney(tDebt)+'</div></div></div><div style="font-size:11px;color:var(--on-surface-variant)">'+fmtMoney(tInc)+' in \u00b7 '+fmtMoney(tExp)+' out \u00b7 <span style="color:'+(left>=0?'var(--mint)':'var(--red)')+';font-weight:600">'+fmtMoney(Math.abs(left))+' '+(left>=0?'left over':'over')+'</span></div><button class="btn btn-ghost btn-sm" onclick="nav(\'finance\')" style="margin-top:8px;width:100%;justify-content:center">View finance \u2192</button>';
  var rpEl=document.getElementById('dash-roadmap-preview');
  if(rpEl){rpEl.innerHTML=''}  // legacy: roadmap page removed, element may no longer exist

  // Weekly top-3 priorities (moved from old Weekly Plan tab)
  renderDashWeeklyTop3();
  // Inline gratitude prompt (low-friction)
  renderDashGratitudeInline();
}

// ── CELEBRATIONS ──
// Fires a big celebration when both habits and today's tasks are fully done.
// Only counts if there's something being tracked (>=1 of each, or >=2 total).
function checkAllDoneToday(){
  var todayKey=localDateKey(new Date());
  var expectedHabits=STATE.habits.filter(function(h){
    var status=habitDayStatus(h,todayKey);
    return status==='done'||status==='todo';
  });
  var habitsDone=expectedHabits.filter(function(h){return h.logs[todayKey]}).length;
  var habitsTotal=expectedHabits.length;
  var pris=(STATE.dailyPriorities||{})[todayKey]||[];
  var prisDone=pris.filter(function(p){return p.done}).length;
  var prisTotal=pris.length;

  // Need at least 2 items tracked in total, and both categories (if present) fully done
  var totalTracked=habitsTotal+prisTotal;
  if(totalTracked<2)return;
  var habitsComplete=habitsTotal===0||habitsDone===habitsTotal;
  var prisComplete=prisTotal===0||prisDone===prisTotal;
  if(!habitsComplete||!prisComplete)return;

  celebrateOnce('all-done-today',function(){
    setTimeout(function(){
      fireConfetti({count:160,duration:3200,colors:['#a0522d','#c9973a','#d4845a','#6b9e7a','#c97b6e','#f59e0b','#E8A87C']});
      showCelebrationToast('Day complete. Everything ticked.','🌟');
    },350);
  });
}

function quickToggleHabit(hid,day){var h=STATE.habits.find(function(x){return x.id===hid});if(!h)return;var wasDone=h.logs[day];h.logs[day]=!h.logs[day];saveState();renderDashboard();if(/skincare/i.test(h.name)&&typeof renderSkincareToday==='function')renderSkincareToday();if(!wasDone&&h.logs[day]){var s=habitStreak(h);if(s===7||s===14||s===21||s===30){fireConfetti();showCelebrationToast(h.name+' — '+s+' day streak!','🔥')}if(day===localDateKey(new Date()))checkAllDoneToday()}}
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
/* Live progress + linked badge */
var srcInfo=getGoalSource(go);
var livePct=goalPct(go);
var progressDisplay=srcInfo.source!=='manual'?srcInfo.progress:go.progress;
h+='<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:11px;color:var(--text2);font-weight:500">'+progressDisplay+(go.unit||'')+' / '+go.target+(go.unit||'')+'</span><span style="font-size:11px;font-weight:600;color:'+pbarColor(livePct)+'">'+livePct+'%</span></div><div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+livePct+'%;background:'+pbarColor(livePct)+';border-radius:3px;transition:width .4s"></div></div>';
if(srcInfo.label)h+='<div style="font-size:10px;color:var(--mint);margin-top:4px;font-weight:500">'+srcInfo.label+'</div>';
h+='</div>';
/* Sub-steps (item 10) */
var subs=go.subGoals||[];
var subsDone=subs.filter(function(s){return s.done}).length;
h+='<div class="goal-substeps"><div class="goal-substeps-head"><span>Steps</span>'+(subs.length?'<span class="goal-substeps-count">'+subsDone+'/'+subs.length+'</span>':'')+'</div>';
if(subs.length){
  h+=subs.map(function(s,si){
    return '<div class="goal-substep'+(s.done?' done':'')+'">'
      +'<div class="goal-substep-tick" onclick="toggleGoalSubStep(\''+go.id+'\','+si+')">'+(s.done?'✓':'')+'</div>'
      +'<span class="goal-substep-text">'+escapeHtml(s.text)+'</span>'
      +'<button class="goal-substep-del" onclick="deleteGoalSubStep(\''+go.id+'\','+si+')" title="Remove">×</button>'
      +'</div>';
  }).join('');
}
h+='<div class="goal-substep-add-row">'
  +'<input type="text" class="goal-substep-add-input" id="goal-substep-input-'+go.id+'" placeholder="Add a step…" onkeydown="if(event.key===\'Enter\')addGoalSubStep(\''+go.id+'\')">'
  +'<button class="goal-substep-add-btn" onclick="addGoalSubStep(\''+go.id+'\')">+</button>'
  +'</div>';
h+='</div>';
/* Actions */
h+='<div class="goal-actions"><button class="btn btn-sm btn-ghost" onclick="openModal(\'editGoal\',\''+go.id+'\')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteGoal(\''+go.id+'\')">×</button></div>';
h+='</div></div>';return h}).join('')}
function filterGoals(cat,btn){goalFilter=cat;document.querySelectorAll('#goal-filters .filter-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');renderGoals()}
function toggleGoalDone(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;var wasDone=goal.done;goal.done=!goal.done;if(goal.done)goal.progress=goal.target;saveState();renderGoals();if(!wasDone&&goal.done){fireConfetti({count:150,duration:3000});showCelebrationToast('Goal complete: '+goal.name,'🎯')}}
function saveGoal(){var name=((document.getElementById('m-gname')||{}).value||'').trim();if(!name)return;var cat=(document.getElementById('m-gcat')||{}).value||'Personal';var badges={Finance:'fin',Fitness:'fit',Career:'car',Personal:'per'};var target=Number((document.getElementById('m-gtarget')||{}).value)||100;var unit=(document.getElementById('m-gunit')||{}).value||'%';var direction=(document.getElementById('m-gdir')||{}).value||'up';STATE.goals.push({id:g(),name:name,cat:cat,badge:badges[cat]||'per',desc:(document.getElementById('m-gdesc')||{}).value||'',target:target,unit:unit,direction:direction,deadline:(document.getElementById('m-gdeadline')||{}).value||'2026-12-31',progress:direction==='up'?0:target*2,done:false,subGoals:[]});saveState();closeModal();renderGoals()}
function updateGoalProgress(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;var wasDone=goalPct(goal)>=100;goal.progress=Number((document.getElementById('m-gprogress')||{}).value)||0;saveState();closeModal();renderGoals();if(!wasDone&&goalPct(goal)>=100){fireConfetti({count:150,duration:3000});showCelebrationToast('Goal complete: '+goal.name,'🎯')}}
function editGoalSave(id){var goal=STATE.goals.find(function(x){return x.id===id});if(!goal)return;goal.name=(document.getElementById('m-gname')||{}).value||goal.name;goal.deadline=(document.getElementById('m-gdeadline')||{}).value||goal.deadline;goal.desc=(document.getElementById('m-gdesc')||{}).value||'';var cat=(document.getElementById('m-gcat')||{}).value;if(cat){goal.cat=cat;var badges={Finance:'fin',Fitness:'fit',Career:'car',Personal:'per'};goal.badge=badges[cat]||goal.badge}var manualEl=document.getElementById('m-gmanual');if(manualEl){goal.manualOverride=manualEl.value==='1';if(goal.manualOverride){var p=document.getElementById('m-gprogress');if(p&&p.value!=='')goal.progress=Number(p.value)}}saveState();closeModal();renderGoals()}
function deleteGoal(id){confirmDelete('Delete this goal?',function(){STATE.goals=STATE.goals.filter(function(g){return g.id!==id});saveState();renderGoals()})}
function saveMetric(type){if(!STATE.metrics)STATE.metrics={};var date=(document.getElementById('m-mdate')||{}).value||localDateKey(new Date());var note=(document.getElementById('m-mnote')||{}).value||'';var entry={id:g(),date:date};if(type==='project'){var name=((document.getElementById('m-mname')||{}).value||'').trim();if(!name)return;entry.name=name}else if(type==='run'){var val=(document.getElementById('m-mval')||{}).value;if(!val)return;entry.distance=Number(val);entry.time=(document.getElementById('m-mtime')||{}).value||'';entry.note=note}else if(type==='moneySaved'){var val=(document.getElementById('m-mval')||{}).value;if(!val)return;entry.amount=Number(val);entry.note=note}else{var val=(document.getElementById('m-mval')||{}).value;if(!val)return;entry.value=Number(val);entry.note=note}if(!STATE.metrics[type])STATE.metrics[type]=[];STATE.metrics[type].push(entry);saveState();closeModal();if(type==='weight'&&typeof renderTrainingBody==='function'){var bodyEl=document.getElementById('workout-body');if(bodyEl&&bodyEl.classList.contains('active'))renderTrainingBody()}if(type==='run'){var rrEl=document.getElementById('recent-runs-workout');if(rrEl)renderWorkout()}}




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
  var wasDone=list[idx].done;
  list[idx].done=!list[idx].done;
  saveState();
  renderDashboard();
  // Only celebrate on the today list, and only when ticking ON
  var todayKey=localDateKey(new Date());
  if(dateKey===todayKey&&!wasDone&&list[idx].done){
    var doneCount=list.filter(function(p){return p.done}).length;
    // First task of the day — subtle toast
    if(doneCount===1){
      celebrateOnce('first-task',function(){
        showCelebrationToast('First one done. Momentum starts here.','✨');
      });
    }
    // All tasks done (and there were at least 2)
    if(doneCount===list.length&&list.length>=2){
      celebrateOnce('all-tasks',function(){
        fireConfetti({count:80,duration:2000});
        showCelebrationToast('All tasks ticked — nice work.','📝');
      });
    }
    checkAllDoneToday();
  }
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


// ── DASHBOARD TABS ──
function switchDashTab(tab,btn){
  document.querySelectorAll('#page-dashboard .page-tab').forEach(function(b){b.classList.remove('active')});
  document.querySelectorAll('.dash-tab').forEach(function(p){p.classList.remove('active')});
  if(btn)btn.classList.add('active');
  var el=document.getElementById('dash-tab-'+tab);
  if(el)el.classList.add('active');
  if(tab==='life')renderLifeTab();
}

// ── LIFE TAB ──
function renderLifeTab(){
  // Goals snapshot — top 3 in-progress with progress bars
  var gSnapEl=document.getElementById('dash-goals-snapshot');
  if(gSnapEl){
    var active=(STATE.goals||[]).filter(function(g){return !g.done});
    var top3=active.slice(0,3);
    if(!top3.length){
      gSnapEl.innerHTML='<div class="empty" style="padding:20px 0">No active goals. <a href="#" onclick="nav(\'goals\');return false" style="color:var(--accent-dark)">Set one →</a></div>';
    }else{
      gSnapEl.innerHTML=top3.map(function(go){
        var pct=goalPct(go);
        var src=getGoalSource(go);
        var progressDisplay=src.source!=='manual'?src.progress:go.progress;
        return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
            +'<div style="font-size:13px;font-weight:500">'+go.name+'</div>'
            +'<span style="font-size:11px;font-weight:600;color:'+pbarColor(pct)+'">'+pct+'%</span>'
          +'</div>'
          +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">'
            +'<div class="pbar-wrap" style="flex:1;margin:0"><div class="pbar" style="width:'+pct+'%;background:'+pbarColor(pct)+'"></div></div>'
            +'<span style="font-size:11px;color:var(--text2);white-space:nowrap">'+progressDisplay+(go.unit||'')+' / '+go.target+(go.unit||'')+'</span>'
          +'</div>'
          +'</div>';
      }).join('')+'<button class="btn btn-ghost btn-sm" onclick="nav(\'goals\')" style="margin-top:10px;width:100%;justify-content:center">View all goals →</button>';
    }
  }

  // Reviews snapshot — last monthly review
  var rSnapEl=document.getElementById('dash-reviews-snapshot');
  if(rSnapEl){
    var reviews=(STATE.reviews&&STATE.reviews.monthly)||{};
    var keys=Object.keys(reviews).sort().reverse();
    if(!keys.length){
      rSnapEl.innerHTML='<div class="empty" style="padding:20px 0">No reviews yet. <a href="#" onclick="nav(\'review\');return false" style="color:var(--accent-dark)">Start reflecting →</a></div>';
    }else{
      var lastKey=keys[0];
      var r=reviews[lastKey];
      var parts=lastKey.split('-');
      var monthLabel=new Date(Number(parts[0]),Number(parts[1])-1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
      var avg=0;
      if(r.ratings){
        var vals=Object.values(r.ratings);
        avg=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0;
      }
      var color=avg>=7?'var(--mint)':avg>=5?'var(--gold)':'var(--accent-dark)';
      rSnapEl.innerHTML='<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)">'
        +'<div style="width:52px;height:52px;border-radius:50%;background:'+color+';color:var(--white);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:20px;font-weight:500;flex-shrink:0">'+avg+'</div>'
        +'<div style="flex:1"><div style="font-size:14px;font-weight:600">'+monthLabel+'</div>'+(r.focus?'<div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4">🎯 '+r.focus.split('\n')[0].slice(0,80)+(r.focus.length>80?'…':'')+'</div>':'<div style="font-size:11px;color:var(--text3);margin-top:2px">No focus set</div>')+'</div>'
        +'</div>'
        +'<button class="btn btn-ghost btn-sm" onclick="nav(\'review\')" style="margin-top:10px;width:100%;justify-content:center">Open Reviews →</button>';
    }
  }
}


// ── DASHBOARD: WEEKLY TOP-3 ──
// Now merged into dash-priorities-preview. This stub keeps existing onclick handlers safe.
function renderDashWeeklyTop3(){
  // The standalone card was removed — weekly priorities now render alongside today's tasks.
  // Re-render the priorities card to reflect changes.
  if(typeof renderDashboard==='function'){
    var ppEl=document.getElementById('dash-priorities-preview');
    if(ppEl)renderDashboard();
  }
}

function saveDashWeeklyTop3(idx,val){
  var wk=weekKey(new Date());
  if(!STATE.weeklyPlans)STATE.weeklyPlans={};
  if(!STATE.weeklyPlans[wk])STATE.weeklyPlans[wk]={priorities:['','',''],prioritiesDone:{}};
  if(!STATE.weeklyPlans[wk].priorities)STATE.weeklyPlans[wk].priorities=['','',''];
  STATE.weeklyPlans[wk].priorities[idx]=val;
  saveState();
  renderDashWeeklyTop3();
}

function toggleDashWeeklyTop3(idx){
  var wk=weekKey(new Date());
  if(!STATE.weeklyPlans)STATE.weeklyPlans={};
  if(!STATE.weeklyPlans[wk])STATE.weeklyPlans[wk]={priorities:['','',''],prioritiesDone:{}};
  var p=STATE.weeklyPlans[wk];
  if(!p.prioritiesDone)p.prioritiesDone={};
  var wasDone=!!p.prioritiesDone[idx];
  p.prioritiesDone[idx]=!wasDone;
  saveState();
  renderDashWeeklyTop3();
  // Celebration
  if(!wasDone){
    var set=p.priorities.filter(function(x){return x&&x.trim()});
    var done=p.priorities.filter(function(x,i){return x&&x.trim()&&p.prioritiesDone[i]}).length;
    if(set.length>=2&&done===set.length){
      if(typeof celebrateOnce==='function'){
        celebrateOnce('weekly-top3-done',function(){
          fireConfetti({count:110,duration:2400});
          showCelebrationToast('All weekly priorities ticked — strong week.','🎯');
        });
      }
    }
  }
}

// ── DASHBOARD: INLINE GRATITUDE PROMPT ──
function renderDashGratitudeInline(){
  var el=document.getElementById('dash-gratitude-inline');
  if(!el)return;
  var todayKey=localDateKey(new Date());
  var entries=(STATE.gratitude||[]).filter(function(e){return e.date===todayKey});
  if(entries.length){
    el.innerHTML='<div class="dash-gr-done">'
      +entries.map(function(e){
        return (e.wins?'<div class="dash-gr-line"><span class="dash-gr-emoji">🏆</span>'+escapeHtml(e.wins)+'</div>':'')
             +(e.gratitude?'<div class="dash-gr-line"><span class="dash-gr-emoji">🙏</span>'+escapeHtml(e.gratitude.split('\n')[0])+'</div>':'');
      }).join('')
      +'<button class="btn btn-ghost btn-sm dash-gr-more" onclick="openModal(\'addGratitude\')">+ Add another</button>'
      +'</div>';
  }else{
    var hr=new Date().getHours();
    var prompt;
    if(hr<12)prompt='What\'s one thing you\'re looking forward to today?';
    else if(hr<17)prompt='What went well so far?';
    else if(hr<21)prompt='Wind down. What\'s one win from today?';
    else prompt='Before bed — what\'s one thing you\'re grateful for?';
    el.innerHTML=''
      +'<div class="dash-gr-prompt">'+prompt+'</div>'
      +'<div class="dash-gr-fields">'
        +'<input type="text" id="dash-gr-win" placeholder="One line — a win or moment of gratitude…" onkeydown="if(event.key===\'Enter\')dashSaveGratitudeInline()">'
        +'<button class="btn btn-accent btn-sm" onclick="dashSaveGratitudeInline()">Save</button>'
      +'</div>'
      +'<button class="dash-gr-expand" onclick="document.getElementById(\'dash-gr-thankful-wrap\').style.display=\'flex\';this.style.display=\'none\'">+ Add a separate gratitude line</button>'
      +'<div id="dash-gr-thankful-wrap" class="dash-gr-fields" style="display:none;margin-top:8px">'
        +'<input type="text" id="dash-gr-thankful" placeholder="🙏 One thing you\'re thankful for…" onkeydown="if(event.key===\'Enter\')dashSaveGratitudeInline()">'
      +'</div>';
  }
}

function dashSaveGratitudeInline(){
  var win=((document.getElementById('dash-gr-win')||{}).value||'').trim();
  var thankful=((document.getElementById('dash-gr-thankful')||{}).value||'').trim();
  if(!win&&!thankful)return;
  if(!STATE.gratitude)STATE.gratitude=[];
  var today=localDateKey(new Date());
  var isFirstEver=STATE.gratitude.length===0;
  STATE.gratitude.push({id:g(),date:today,wins:win,gratitude:thankful});
  saveState();
  renderDashGratitudeInline();
  if(typeof celebrateGratitudeMilestone==='function'){
    celebrateGratitudeMilestone(today,isFirstEver);
  }
}


// Dismiss the evening gratitude nudge for the day
function dismissGratitudeNudge(){
  var todayK=localDateKey(new Date());
  try{sessionStorage.setItem('lh_gr_nudge_dismissed:'+todayK,'1')}catch(e){}
  var nudgeEl=document.getElementById('dash-review-nudge');
  if(nudgeEl){
    // Remove just the gratitude nudge
    var children=nudgeEl.querySelectorAll('.review-nudge');
    children.forEach(function(c){
      if(c.textContent.indexOf('Wind-down')>-1)c.remove();
    });
  }
}


// ── DASHBOARD: MONTHLY FOCUS CARRY-OVER (item 12) ──
// Surface last month's review focus for the first 7 days of the current month.
function renderDashMonthlyFocus(){
  var card=document.getElementById('dash-monthly-focus-card');
  var el=document.getElementById('dash-monthly-focus');
  if(!card||!el)return;
  var now=new Date();
  var dayOfMonth=now.getDate();
  if(dayOfMonth>7){card.style.display='none';return}
  var prevMonth=new Date(now.getFullYear(),now.getMonth()-1,1);
  var prevKey=prevMonth.getFullYear()+'-'+String(prevMonth.getMonth()+1).padStart(2,'0');
  var review=STATE.reviews&&STATE.reviews.monthly&&STATE.reviews.monthly[prevKey];
  if(!review||!review.focus){card.style.display='none';return}
  card.style.display='';
  var focusText=review.focus.split('\n')[0].trim();
  if(focusText.length>80)focusText=focusText.slice(0,80)+'…';
  el.textContent=focusText;
  // Make whole card clickable to reviews
  card.style.cursor='pointer';
  card.onclick=function(){nav('review')};
}

// ── DASHBOARD: MINI MOOD ORB (item 4) ──
function renderDashMoodMini(){
  var el=document.getElementById('dash-mood-checkin-mini');
  if(!el)return;
  var today=localDateKey(new Date());
  var m=(STATE.mood||{})[today]||{};
  var moodEm=['','😞','😐','🙂','😊','🤩'];
  if(m.mood){
    el.innerHTML='<div class="dash-mood-mini-done"><span class="dash-mood-mini-emoji">'+moodEm[m.mood]+'</span><button class="dash-mood-mini-edit" onclick="openModal(\'logMood\',\''+today+'\')">Edit</button></div>';
  }else{
    el.innerHTML='<div class="dash-mood-mini-row">'
      +['😞','😐','🙂','😊','🤩'].map(function(e,i){
        return '<button class="dash-mood-mini-btn" onclick="quickLogMood('+(i+1)+',\''+today+'\')">'+e+'</button>';
      }).join('')
      +'</div>';
  }
}

// ── DASHBOARD: MOOD THIS WEEK (item 8) ──
function renderDashMoodWeek(){
  var el=document.getElementById('dash-mood-week');
  if(!el)return;
  var todayK=localDateKey(new Date());
  var days=[];
  for(var i=6;i>=0;i--){
    var d=new Date();d.setDate(d.getDate()-i);
    var k=localDateKey(d);
    var m=(STATE.mood||{})[k]||{};
    days.push({key:k,date:d,mood:m.mood||0,energy:m.energy||0,sleep:m.sleep||0,isToday:k===todayK});
  }
  var moodEm=['—','😞','😐','🙂','😊','🤩'];
  var loggedDays=days.filter(function(d){return d.mood>0});
  var avgMood=loggedDays.length?(loggedDays.reduce(function(s,d){return s+d.mood},0)/loggedDays.length):0;
  var avgSleep=days.filter(function(d){return d.sleep>0}).length>0?
    (days.filter(function(d){return d.sleep>0}).reduce(function(s,d){return s+d.sleep},0)/days.filter(function(d){return d.sleep>0}).length):0;

  var html='';
  if(loggedDays.length===0){
    html='<div class="empty" style="padding:14px 0;font-size:12px;color:var(--text3);text-align:center">No mood logged this week. Tap any face to start.</div>';
    html+='<div class="dmw-grid">'+days.map(function(d){
      var lbl=d.date.toLocaleDateString('en-GB',{weekday:'narrow'});
      var dnum=d.date.getDate();
      return '<div class="dmw-cell empty'+(d.isToday?' today':'')+'" onclick="openModal(\'logMood\',\''+d.key+'\')">'
        +'<div class="dmw-cell-day">'+lbl+'</div>'
        +'<div class="dmw-cell-num">'+dnum+'</div>'
        +'<div class="dmw-cell-emoji">·</div>'
        +'</div>';
    }).join('')+'</div>';
  }else{
    html='<div class="dmw-summary">'
      +'<div class="dmw-stat"><span class="dmw-stat-num">'+(avgMood?avgMood.toFixed(1):'—')+'</span><span class="dmw-stat-lbl">avg mood</span></div>'
      +'<div class="dmw-stat"><span class="dmw-stat-num">'+(avgSleep?avgSleep.toFixed(1)+'h':'—')+'</span><span class="dmw-stat-lbl">avg sleep</span></div>'
      +'<div class="dmw-stat"><span class="dmw-stat-num">'+loggedDays.length+'/7</span><span class="dmw-stat-lbl">logged</span></div>'
      +'</div>';
    html+='<div class="dmw-grid">'+days.map(function(d){
      var lbl=d.date.toLocaleDateString('en-GB',{weekday:'narrow'});
      var dnum=d.date.getDate();
      return '<div class="dmw-cell'+(d.mood>0?' filled':' empty')+(d.isToday?' today':'')+'" onclick="openModal(\'logMood\',\''+d.key+'\')">'
        +'<div class="dmw-cell-day">'+lbl+'</div>'
        +'<div class="dmw-cell-num">'+dnum+'</div>'
        +'<div class="dmw-cell-emoji">'+(d.mood>0?moodEm[d.mood]:'·')+'</div>'
        +(d.sleep>0?'<div class="dmw-cell-sleep">💤'+d.sleep+'h</div>':'')
        +'</div>';
    }).join('')+'</div>';
  }
  el.innerHTML=html;
}


// ── GOALS — sub-steps (item 10) ──
function addGoalSubStep(goalId){
  var inp=document.getElementById('goal-substep-input-'+goalId);
  if(!inp)return;
  var text=inp.value.trim();
  if(!text)return;
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal)return;
  if(!goal.subGoals)goal.subGoals=[];
  goal.subGoals.push({text:text,done:false});
  inp.value='';
  saveState();
  renderGoals();
}
function toggleGoalSubStep(goalId,idx){
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal||!goal.subGoals||!goal.subGoals[idx])return;
  goal.subGoals[idx].done=!goal.subGoals[idx].done;
  saveState();
  renderGoals();
  if(goal.subGoals[idx].done){
    var allDone=goal.subGoals.every(function(s){return s.done});
    if(allDone&&goal.subGoals.length>=2&&typeof celebrateOnce==='function'){
      celebrateOnce('goal-substeps-done:'+goalId,function(){
        showCelebrationToast('All steps for '+goal.name+' done!','✨');
      });
    }
  }
}
function deleteGoalSubStep(goalId,idx){
  var goal=STATE.goals.find(function(x){return x.id===goalId});
  if(!goal||!goal.subGoals)return;
  goal.subGoals.splice(idx,1);
  saveState();
  renderGoals();
}
