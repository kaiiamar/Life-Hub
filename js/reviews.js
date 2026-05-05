// REVIEWS — monthly ritual
// ============================================================
var RATING_CATS=[
  {id:'overall',label:'Overall',emoji:'⭐'},
  {id:'health',label:'Health',emoji:'💪'},
  {id:'finance',label:'Finances',emoji:'💸'},
  {id:'career',label:'Career',emoji:'📈'},
  {id:'mindset',label:'Mindset',emoji:'🧠'},
  {id:'social',label:'Social',emoji:'🫶'}
];

var REVIEW_PROMPTS=[
  'How did {month} feel, really?',
  'Did {month} move the needle?',
  'What version of you showed up in {month}?',
  'If {month} were a word, what would it be?',
  'Did {month} match your intentions?',
  'What did {month} teach you?'
];

function getMonthLabel(key){
  var parts=key.split('-');
  return new Date(Number(parts[0]),Number(parts[1])-1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
}

function getMonthShort(key){
  var parts=key.split('-');
  return new Date(Number(parts[0]),Number(parts[1])-1).toLocaleDateString('en-GB',{month:'short'});
}

function renderRatingSliders(containerId,savedRatings){
  var el=document.getElementById(containerId);
  if(!el)return;
  el.innerHTML='<div class="review-ratings-grid">'+RATING_CATS.map(function(cat){
    var val=(savedRatings&&savedRatings[cat.id])||5;
    return '<div class="review-rating-item">'
      +'<div class="review-rating-head">'
        +'<span class="review-rating-label">'+cat.emoji+' '+cat.label+'</span>'
        +'<span class="review-rating-val" id="rv-'+containerId+'-'+cat.id+'">'+val+'</span>'
      +'</div>'
      +'<input type="range" min="1" max="10" value="'+val+'" step="1" class="review-slider" '
      +'oninput="var v=this.value;document.getElementById(\'rv-'+containerId+'-'+cat.id+'\').textContent=v;this.style.setProperty(\'--pct\',((v-1)/9)*100+\'%\')" '
      +'style="--pct:'+(((val-1)/9)*100)+'%" id="rating-'+containerId+'-'+cat.id+'">'
    +'</div>';
  }).join('')+'</div>';
}

function getRatingValues(containerId){
  var out={};
  RATING_CATS.forEach(function(cat){
    var el=document.getElementById('rating-'+containerId+'-'+cat.id);
    if(el)out[cat.id]=Number(el.value);
  });
  return out;
}

function renderReview(){
  var mSel=document.getElementById('monthly-month-select');
  if(mSel&&!mSel.options.length){
    var now=new Date();
    for(var i=0;i<12;i++){
      var d=new Date(now.getFullYear(),now.getMonth()-i,1);
      var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      var label=d.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
      var opt=document.createElement('option');
      opt.value=key;opt.textContent=label;
      mSel.appendChild(opt);
    }
  }
  renderMonthlyReview();
  renderReviewTimeline();
  renderReviewTrends();
}

function renderMonthlyReview(){
  var key=(document.getElementById('monthly-month-select')||{}).value;
  if(!key)return;
  var saved=(STATE.reviews&&STATE.reviews.monthly&&STATE.reviews.monthly[key])||{};

  // Hero
  var monthLabel=getMonthLabel(key);
  var heroTitle=document.getElementById('review-hero-month');
  if(heroTitle)heroTitle.innerHTML=monthLabel.split(' ')[0]+' <em>'+monthLabel.split(' ')[1]+'</em>';
  var heroPrompt=document.getElementById('review-hero-prompt');
  if(heroPrompt){
    var seed=Number(key.split('-')[1]);
    var prompt=REVIEW_PROMPTS[seed%REVIEW_PROMPTS.length];
    heroPrompt.textContent=prompt.replace('{month}',monthLabel.split(' ')[0]);
  }

  // Sliders
  renderRatingSliders('monthly-ratings',saved.ratings);

  // Textareas
  var fields={wins:'monthly-wins',lessons:'monthly-lessons',focus:'monthly-focus',bestHabit:'monthly-best-habit',advice:'monthly-advice',ssc:'monthly-ssc',feeling:'monthly-feeling',need:'monthly-need'};
  Object.keys(fields).forEach(function(k){
    var el=document.getElementById(fields[k]);
    if(el)el.value=saved[k]||'';
  });

  // Auto stats (Step 1)
  renderAutoStats(key);

  // Smart prompts based on data comparison
  renderSmartPrompts(key,saved);

  // Past reviews
  renderPastMonthlyReviews();

  // Timeline update
  renderReviewTimeline();
  renderReviewTrends();
}

function renderAutoStats(key){
  var el=document.getElementById('monthly-auto-stats');
  if(!el)return;
  var parts=key.split('-');
  var year=Number(parts[0]),month=Number(parts[1]);
  // Workouts — all non-run sessions
  var workouts=(STATE.workouts||[]).filter(function(w){return w.date&&w.date.startsWith(key)&&(w.type||'').toLowerCase()!=='run'});
  var gym=workouts.length;
  // Runs
  var runs=((STATE.metrics||{}).run||[]).filter(function(r){return r.date&&r.date.startsWith(key)});
  var runKm=runs.reduce(function(s,r){return s+Number(r.distance||0)},0);
  // Habits
  var daysInMonth=new Date(year,month,0).getDate();
  var monthDayKeys=[];
  for(var i=1;i<=daysInMonth;i++){monthDayKeys.push(year+'-'+String(month).padStart(2,'0')+'-'+String(i).padStart(2,'0'))}
  var habTotal=0,habDone=0;
  (STATE.habits||[]).forEach(function(h){monthDayKeys.forEach(function(dk){habTotal++;if(h.logs&&h.logs[dk])habDone++})});
  var habPct=habTotal>0?Math.round(habDone/habTotal*100):0;
  // Tasks
  var taskTotal=0,taskDone=0;
  monthDayKeys.forEach(function(dk){
    var list=((STATE.dailyPriorities||{})[dk])||[];
    list.forEach(function(t){taskTotal++;if(t.done)taskDone++});
  });
  var taskPct=taskTotal>0?Math.round(taskDone/taskTotal*100):0;
  // Money saved this month
  var saved=((STATE.metrics||{}).moneySaved||[]).filter(function(m){return m.date&&m.date.startsWith(key)});
  var savedTotal=saved.reduce(function(s,m){return s+Number(m.amount||0)},0);
  // Debt reduced this month (from payments log)
  var debtPayments=(STATE.debtPayments||[]).filter(function(p){return p.date&&p.date.startsWith(key)});
  var debtReduced=debtPayments.reduce(function(s,p){return s+Number(p.amount||0)},0);
  // Roadmap items ticked for this month
  var rmItems=0,rmDone=0;
  if(typeof RM_MONTHS!=='undefined'){
    // Find the roadmap month that matches this calendar month
    var monthShort=new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short'}).toLowerCase().slice(0,3);
    var yearShort=String(year).slice(-2);
    var rmMonth=RM_MONTHS.find(function(m){return m.id===monthShort+yearShort});
    if(rmMonth&&typeof rmGetProgress==='function'){
      var prog=rmGetProgress(rmMonth);
      rmItems=prog.total;rmDone=prog.done;
    }
  }
  var rmPct=rmItems>0?Math.round(rmDone/rmItems*100):0;
  // Goals progress (avg across all goals)
  var goalAvg=STATE.goals&&STATE.goals.length?Math.round(STATE.goals.reduce(function(s,g){return s+goalPct(g)},0)/STATE.goals.length):0;

  el.innerHTML=
    statBlock('💪','Workouts',gym,'gym sessions','var(--accent)')
    +statBlock('🏃','Runs',runKm.toFixed(1),'km · '+runs.length+' runs','var(--blue)')
    +statBlock('✅','Habits',habPct+'%','of '+habTotal+' tracked','var(--green)')
    +statBlock('📝','Tasks',taskDone+'/'+taskTotal,taskPct+'% done','var(--gold)')
    +statBlock('🗓️','Roadmap',rmDone+'/'+rmItems,rmItems>0?rmPct+'% ticked':'no items this month','var(--purple)')
    +statBlock('💸','Saved','£'+savedTotal.toLocaleString(),saved.length+' deposits','var(--mint)')
    +statBlock('💳','Debt paid','£'+debtReduced.toLocaleString(),debtPayments.length+' payments','#D97B6C')
    +statBlock('🎯','Goals',goalAvg+'%','avg progress','#B85A4B');
}

function statBlock(icon,label,big,sub,color){
  return '<div class="review-auto-stat" style="--stat-color:'+color+'">'
    +'<div class="review-auto-icon">'+icon+'</div>'
    +'<div class="review-auto-body">'
      +'<div class="review-auto-label">'+label+'</div>'
      +'<div class="review-auto-big">'+big+'</div>'
      +'<div class="review-auto-sub">'+sub+'</div>'
    +'</div></div>';
}

function renderSmartPrompts(key,saved){
  var el=document.getElementById('smart-prompts');
  if(!el)return;
  var prompts=[];

  // Find previous month review
  var parts=key.split('-');
  var prevDate=new Date(Number(parts[0]),Number(parts[1])-2,1);
  var prevKey=prevDate.getFullYear()+'-'+String(prevDate.getMonth()+1).padStart(2,'0');
  var prev=(STATE.reviews&&STATE.reviews.monthly&&STATE.reviews.monthly[prevKey]);

  if(prev&&prev.ratings&&saved.ratings){
    RATING_CATS.forEach(function(cat){
      var now=saved.ratings[cat.id]||0;
      var old=prev.ratings[cat.id]||0;
      if(old>=6&&now<=old-3){
        prompts.push({color:'var(--red)',icon:'⚠️',text:cat.label+' dropped from '+old+' to '+now+' — what happened?'});
      }else if(now>=8&&old<=5){
        prompts.push({color:'var(--mint)',icon:'🎉',text:cat.label+' jumped from '+old+' to '+now+' — what shifted?'});
      }
    });
  }

  // Habit-based prompt
  var monthDays=[];
  var year=Number(parts[0]),month=Number(parts[1]);
  var diM=new Date(year,month,0).getDate();
  for(var i=1;i<=diM;i++)monthDays.push(year+'-'+String(month).padStart(2,'0')+'-'+String(i).padStart(2,'0'));
  var habTotal=0,habDone=0;
  (STATE.habits||[]).forEach(function(h){monthDays.forEach(function(dk){habTotal++;if(h.logs&&h.logs[dk])habDone++})});
  var habPct=habTotal>0?Math.round(habDone/habTotal*100):0;
  if(habPct>=80){
    prompts.push({color:'var(--green)',icon:'✨',text:'You hit '+habPct+'% of habits this month — what made it easier?'});
  }else if(habPct<=40&&habTotal>0){
    prompts.push({color:'var(--gold)',icon:'💭',text:'Habit completion was '+habPct+'% — what got in the way?'});
  }

  if(!prompts.length){
    el.innerHTML='';
    return;
  }
  el.innerHTML=prompts.map(function(p){
    return '<div class="smart-prompt" style="border-left-color:'+p.color+'">'
      +'<span class="smart-prompt-icon">'+p.icon+'</span>'
      +'<span class="smart-prompt-text">'+p.text+'</span>'
      +'</div>';
  }).join('');
}

function renderReviewTimeline(){
  var el=document.getElementById('review-timeline');
  if(!el)return;
  var reviews=(STATE.reviews&&STATE.reviews.monthly)||{};
  var now=new Date();
  // Build last 12 months
  var months=[];
  for(var i=11;i>=0;i--){
    var d=new Date(now.getFullYear(),now.getMonth()-i,1);
    var k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    months.push({key:k,date:d,review:reviews[k]});
  }
  var selectedKey=(document.getElementById('monthly-month-select')||{}).value;
  el.innerHTML='<div class="review-timeline-inner">'+months.map(function(m){
    var r=m.review;
    var avg=0;
    if(r&&r.ratings){
      var vals=Object.values(r.ratings);
      avg=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0;
    }
    var color=r?(avg>=7?'var(--green)':avg>=5?'var(--gold)':'var(--accent)'):'rgba(26,26,31,0.12)';
    var isSelected=m.key===selectedKey;
    var shortMonth=m.date.toLocaleDateString('en-GB',{month:'short'});
    return '<div class="review-timeline-item'+(isSelected?' active':'')+(r?' has-review':'')+'" onclick="selectReviewMonth(\''+m.key+'\')">'
      +'<div class="review-timeline-score" style="background:'+color+'">'+(r?avg:'—')+'</div>'
      +'<div class="review-timeline-label">'+shortMonth+'</div>'
      +'</div>';
  }).join('')+'</div>';
}

function selectReviewMonth(key){
  var sel=document.getElementById('monthly-month-select');
  if(sel){
    sel.value=key;
    renderMonthlyReview();
  }
}

function renderReviewTrends(){
  var el=document.getElementById('review-trends');
  if(!el)return;
  var reviews=(STATE.reviews&&STATE.reviews.monthly)||{};
  var now=new Date();
  // Last 6 months
  var months=[];
  for(var i=5;i>=0;i--){
    var d=new Date(now.getFullYear(),now.getMonth()-i,1);
    var k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    months.push({key:k,date:d,review:reviews[k]});
  }
  var hasAny=months.some(function(m){return m.review&&m.review.ratings});
  if(!hasAny){
    el.innerHTML='<div class="empty" style="padding:16px">Save a review to start seeing trends.</div>';
    return;
  }
  el.innerHTML='<div class="review-trends-grid">'+RATING_CATS.map(function(cat){
    var values=months.map(function(m){return m.review&&m.review.ratings?m.review.ratings[cat.id]||null:null});
    var hasData=values.some(function(v){return v!==null});
    var w=200,h=40,step=w/(values.length-1||1);
    var pts=values.map(function(v,i){
      if(v===null)return null;
      var x=i*step;
      var y=h-((v-1)/9)*h;
      return x+','+y;
    }).filter(Boolean).join(' ');
    var last=null;
    for(var j=values.length-1;j>=0;j--){if(values[j]!==null){last=values[j];break}}
    var first=null;
    for(var k=0;k<values.length;k++){if(values[k]!==null){first=values[k];break}}
    var trend=(first!==null&&last!==null)?last-first:0;
    var trendColor=trend>0?'var(--green)':trend<0?'var(--accent)':'var(--text2)';
    var trendArrow=trend>0?'↑':trend<0?'↓':'→';
    return '<div class="review-trend-item">'
      +'<div class="review-trend-head"><span class="review-trend-label">'+cat.emoji+' '+cat.label+'</span><span class="review-trend-delta" style="color:'+trendColor+'">'+trendArrow+' '+(last||'—')+'</span></div>'
      +(hasData?'<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="40" preserveAspectRatio="none">'
        +'<polyline points="'+pts+'" fill="none" stroke="'+trendColor+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      +'</svg>':'<div class="empty" style="padding:8px;font-size:11px">No data</div>')
      +'</div>';
  }).join('')+'</div>';
}

function saveMonthlyReview(){
  var key=(document.getElementById('monthly-month-select')||{}).value;
  if(!key)return;
  if(!STATE.reviews)STATE.reviews={monthly:{},quarterly:{}};
  if(!STATE.reviews.monthly)STATE.reviews.monthly={};
  var isFirstSave=!STATE.reviews.monthly[key];
  STATE.reviews.monthly[key]={
    ratings:getRatingValues('monthly-ratings'),
    wins:(document.getElementById('monthly-wins')||{}).value||'',
    lessons:(document.getElementById('monthly-lessons')||{}).value||'',
    focus:(document.getElementById('monthly-focus')||{}).value||'',
    bestHabit:(document.getElementById('monthly-best-habit')||{}).value||'',
    advice:(document.getElementById('monthly-advice')||{}).value||'',
    ssc:(document.getElementById('monthly-ssc')||{}).value||'',
    feeling:(document.getElementById('monthly-feeling')||{}).value||'',
    need:(document.getElementById('monthly-need')||{}).value||'',
    savedAt:new Date().toISOString()
  };
  saveState();
  renderMonthlyReview();
  var btn=event.target;
  var orig=btn.textContent;
  btn.textContent='Saved ✓';
  setTimeout(function(){btn.textContent=orig},2000);
  if(isFirstSave){
    fireConfetti({count:140,duration:3000});
    showCelebrationToast(getMonthLabel(key)+' review saved. Well reflected.','🌙');
  }
}

function renderPastMonthlyReviews(){
  var el=document.getElementById('past-monthly-reviews');
  if(!el)return;
  var reviews=(STATE.reviews&&STATE.reviews.monthly)||{};
  var keys=Object.keys(reviews).sort().reverse();
  if(!keys.length){el.innerHTML='';return}
  el.innerHTML='<div class="review-step"><div class="review-step-head"><span class="review-step-num">◆</span><div><div class="review-step-title">Past reviews</div><div class="review-step-sub">Expand any month to revisit your reflections</div></div></div>'
    +keys.map(function(k){
      var r=reviews[k];
      var avg=0;
      if(r.ratings){
        var vals=Object.values(r.ratings);
        avg=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0;
      }
      var color=avg>=7?'var(--green)':avg>=5?'var(--gold)':'var(--accent)';
      return '<div class="card review-past-card" onclick="this.classList.toggle(\'expanded\')">'
        +'<div class="review-past-head">'
          +'<div><div class="review-past-title">'+getMonthLabel(k)+'</div>'
          +'<div class="review-past-date">Saved '+new Date(r.savedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})+'</div></div>'
          +'<div class="review-past-score" style="background:'+color+'">'+avg+'</div>'
        +'</div>'
        +'<div class="review-past-body">'
          +'<div class="review-past-ratings">'+RATING_CATS.map(function(cat){
            var v=r.ratings?r.ratings[cat.id]:0;
            var c=v>=7?'var(--green)':v>=5?'var(--gold)':'var(--accent)';
            return '<div class="review-past-rating"><div class="review-past-rating-label">'+cat.emoji+' '+cat.label+'</div><div class="review-past-rating-val" style="color:'+c+'">'+v+'</div></div>';
          }).join('')+'</div>'
          +(r.wins?'<div class="review-past-section"><span class="review-past-section-title" style="color:var(--accent-dark)">🏆 Wins</span><div class="review-past-section-body">'+escapeHtml(r.wins)+'</div></div>':'')
          +(r.lessons?'<div class="review-past-section"><span class="review-past-section-title" style="color:var(--gold)">📚 Lessons</span><div class="review-past-section-body">'+escapeHtml(r.lessons)+'</div></div>':'')
          +(r.focus?'<div class="review-past-section"><span class="review-past-section-title" style="color:var(--purple)">🎯 Focus</span><div class="review-past-section-body">'+escapeHtml(r.focus)+'</div></div>':'')
          +(r.ssc?'<div class="review-past-section"><span class="review-past-section-title" style="color:var(--blue)">Start / Stop / Continue</span><div class="review-past-section-body">'+escapeHtml(r.ssc)+'</div></div>':'')
          +(r.feeling?'<div class="review-past-section"><span class="review-past-section-title" style="color:var(--mint)">💭 Check-in</span><div class="review-past-section-body">'+escapeHtml(r.feeling)+'</div></div>':'')
        +'</div>'
      +'</div>';
    }).join('')+'</div>';
}
