// NAVIGATION
// ============================================================
var activeWeek=weekKey(new Date());
var goalFilter='all';
var metricCharts={};

function localDateKey(d){var y=d.getFullYear();var m=('0'+(d.getMonth()+1)).slice(-2);var day=('0'+d.getDate()).slice(-2);return y+'-'+m+'-'+day}
function weekKey(d){var s=new Date(d);s.setHours(0,0,0,0);s.setDate(s.getDate()-s.getDay());return localDateKey(s)}
function weekDays(wk){var parts=wk.split('-');var s=new Date(+parts[0],+parts[1]-1,+parts[2]);return Array.from({length:7},function(_,i){var d=new Date(s);d.setDate(d.getDate()+i);return localDateKey(d)})}function fmtDate(d){return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
function fmtMoney(n){return '\u00a3'+Math.abs(Number(n)).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0})}

// Auto-link goal progress to real data sources
function getGoalSource(g){
  if(!g||g.manualOverride)return {source:'manual',progress:g.progress||0};
  var name=(g.name||'').toLowerCase();
  var cat=g.cat;
  var unit=(g.unit||'').toLowerCase();
  var dir=g.direction;

  // Finance — debt (down + £ + debt keywords)
  if(cat==='Finance'&&dir==='down'&&(unit==='£'||unit==='\u00a3')&&/debt|credit|loan|klarna|chase|amex|bnpl/i.test(name)){
    var total=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance||0)},0);
    return {source:'debt',progress:total,label:'🔗 Linked to Debts'};
  }
  // Finance — savings/house deposit (up + £ + save keywords)
  if(cat==='Finance'&&dir==='up'&&(unit==='£'||unit==='\u00a3')&&/save|saving|deposit|fund|house|emergency|thailand/i.test(name)){
    // Try matching name to a specific savings goal or account first
    var nameWords=name.split(/\s+/);
    var matchedGoal=(STATE.savingsGoals||[]).find(function(sg){
      var sgName=(sg.name||'').toLowerCase();
      return nameWords.some(function(w){return w.length>3&&sgName.indexOf(w)!==-1});
    });
    if(matchedGoal)return {source:'savings-goal',progress:Number(matchedGoal.current||0),label:'🔗 Linked to Savings'};
    var matchedAccount=(STATE.accounts||[]).find(function(a){
      var aName=(a.name||'').toLowerCase();
      return nameWords.some(function(w){return w.length>3&&aName.indexOf(w)!==-1});
    });
    if(matchedAccount)return {source:'account',progress:Number(matchedAccount.balance||0),label:'🔗 Linked to Accounts'};
    // Fallback: sum of all money saved entries
    var saved=((STATE.metrics||{}).moneySaved||[]).reduce(function(s,m){return s+Number(m.amount||0)},0);
    return {source:'moneySaved',progress:saved,label:'🔗 Linked to Money saved'};
  }
  // Fitness — weight (kg + down)
  if(cat==='Fitness'&&unit==='kg'&&dir==='down'){
    var weights=((STATE.metrics||{}).weight||[]);
    if(weights.length){
      var latest=weights.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).pop();
      return {source:'weight',progress:Number(latest.value),label:'🔗 Linked to Weight log'};
    }
    return {source:'weight',progress:g.progress||0};
  }
  // Fitness — run time PB (min + down + distance keyword)
  if(cat==='Fitness'&&unit==='min'&&dir==='down'&&/5k|10k|run/i.test(name)){
    var targetDist=/10k/i.test(name)?10:5;
    var tol=targetDist===10?0.5:0.3;
    var runs=((STATE.metrics||{}).run||[]).filter(function(r){return r.time&&r.distance&&Math.abs(Number(r.distance)-targetDist)<=tol});
    if(runs.length){
      var best=runs.reduce(function(b,r){
        var ap=r.time.split(':');var bp=b.time.split(':');
        var am=Number(ap[0]||0)+Number(ap[1]||0)/60;
        var bm=Number(bp[0]||0)+Number(bp[1]||0)/60;
        return am<bm?r:b;
      },runs[0]);
      var parts=best.time.split(':');
      var mins=Number(parts[0]||0)+Number(parts[1]||0)/60;
      return {source:'run',progress:Math.round(mins*10)/10,label:'🔗 Linked to Runs'};
    }
    return {source:'run',progress:g.progress||0};
  }
  // Fitness — half marathon distance (km + up + half marathon)
  if(cat==='Fitness'&&unit==='km'&&dir==='up'&&/half marathon|marathon/i.test(name)){
    var longest=((STATE.metrics||{}).run||[]).reduce(function(b,r){return Number(r.distance||0)>b?Number(r.distance||0):b},0);
    return {source:'run-distance',progress:longest,label:'🔗 Linked to Runs'};
  }
  // Fitness — sessions count (sessions + up)
  if(cat==='Fitness'&&dir==='up'&&/session|hyrox|gym|workout/i.test(name)){
    var count=(STATE.workouts||[]).length;
    return {source:'workouts',progress:count,label:'🔗 Linked to Training'};
  }
  // Fitness — consistent months (months + up)
  if(cat==='Finance'&&dir==='up'&&/month/i.test(name)&&/save|invest/i.test(name)){
    // Count months with at least one moneySaved entry
    var moneySaved=((STATE.metrics||{}).moneySaved||[]);
    var monthsSet={};
    moneySaved.forEach(function(m){if(m.date){monthsSet[m.date.slice(0,7)]=true}});
    return {source:'save-streak',progress:Object.keys(monthsSet).length,label:'🔗 Linked to Money saved'};
  }
  return {source:'manual',progress:g.progress||0};
}

function goalPct(g){
  var src=getGoalSource(g);
  var progress=src.progress;
  if(progress===undefined||progress===null)return 0;
  if(g.direction==='up'){
    if(!g.target)return 0;
    return Math.min(100,Math.round((progress/g.target)*100));
  }
  if(g.direction==='down'){
    // Target is the "finish line" you want progress to reach (e.g. 0 for debt free, 80 for weight)
    // startProgress is where you began
    var start=g.startProgress||g.initialProgress||progress;
    var target=Number(g.target)||0;
    // If already at or below target, 100%
    if(progress<=target)return 100;
    // If start is below or equal to target, can't compute meaningful %
    if(start<=target)return 0;
    return Math.min(100,Math.max(0,Math.round(((start-progress)/(start-target))*100)));
  }
  return 0;
}
function pbarColor(p){return p>=80?'#6b9e7a':p>=50?'#c9973a':'#c0392b'}
function daysLeft(dl){return Math.ceil((new Date(dl)-new Date())/86400000)}
function statusBadge(g){var p=goalPct(g);var dl=daysLeft(g.deadline);if(p>=100)return '<span class="badge badge-done">Done</span>';if(dl<0)return '<span class="badge badge-risk">Overdue</span>';if(dl<30&&p<70)return '<span class="badge badge-risk">At risk</span>';if(p>0)return '<span class="badge badge-track">On track</span>';return '<span class="badge badge-pend">Not started</span>'}
// Frequency-aware habit helpers
// freq: 'daily' | '3x/week' | 'weekly' | 'bi-monthly' | 'monthly'
function habitTargetPerWeek(h){
  var f=(h.freq||'daily').toLowerCase();
  if(f==='daily')return 7;
  if(/^\d+x\/week$/.test(f))return Number(f.split('x')[0]);
  if(f==='weekly')return 1;
  if(f==='bi-monthly')return 0.5;  // every 2 weeks
  if(f==='monthly')return 7/30;    // approx
  return 7;
}

// Count logs within a date range
function habitCountInRange(h,startDate,endDate){
  var n=0;
  var d=new Date(startDate);
  while(d<=endDate){
    if(h.logs&&h.logs[localDateKey(d)])n++;
    d.setDate(d.getDate()+1);
  }
  return n;
}

// Streak: consecutive periods the habit hit its target
// daily → consecutive days
// 3x/week, weekly → consecutive weeks
// bi-monthly → consecutive 2-week windows
// monthly → consecutive months
function habitStreak(h){
  var f=(h.freq||'daily').toLowerCase();
  var today=new Date();today.setHours(0,0,0,0);

  if(f==='daily'){
    var streak=0;
    for(var i=0;i<365;i++){
      var d=new Date(today);d.setDate(d.getDate()-i);
      if(h.logs&&h.logs[localDateKey(d)])streak++;
      else if(i>0)break;
    }
    return streak;
  }

  if(f==='weekly'||/^\d+x\/week$/.test(f)){
    var target=f==='weekly'?1:Number(f.split('x')[0]);
    var streak=0;
    for(var w=0;w<52;w++){
      var ws=new Date(today);ws.setDate(ws.getDate()-ws.getDay()-w*7);
      var we=new Date(ws);we.setDate(we.getDate()+6);
      var count=habitCountInRange(h,ws,we);
      if(count>=target)streak++;
      else if(w>0)break;  // current week can still be incomplete
    }
    return streak;
  }

  if(f==='bi-monthly'){
    var streak=0;
    for(var b=0;b<26;b++){
      var ps=new Date(today);ps.setDate(ps.getDate()-ps.getDay()-b*14);
      var pe=new Date(ps);pe.setDate(pe.getDate()+13);
      var count=habitCountInRange(h,ps,pe);
      if(count>=1)streak++;
      else if(b>0)break;
    }
    return streak;
  }

  if(f==='monthly'){
    var streak=0;
    var y=today.getFullYear(),m=today.getMonth();
    for(var j=0;j<24;j++){
      var mDate=new Date(y,m-j,1);
      var me=new Date(y,m-j+1,0);
      var count=habitCountInRange(h,mDate,me);
      if(count>=1)streak++;
      else if(j>0)break;
    }
    return streak;
  }
  return 0;
}

// Progress this week — accounts for weekly targets
function habitWeekPct(h,wk){
  var days=weekDays(wk);
  var f=(h.freq||'daily').toLowerCase();
  var target=f==='daily'?7:f==='weekly'?1:/^\d+x\/week$/.test(f)?Number(f.split('x')[0]):1;
  var count=days.filter(function(d){return h.logs&&h.logs[d]}).length;
  return Math.min(100,Math.round((count/target)*100));
}

// Is the habit "on track" for today?
// Returns: 'done', 'todo', 'rest' (not expected today), 'missed'
function habitDayStatus(h,dateKey){
  var f=(h.freq||'daily').toLowerCase();
  if(h.logs&&h.logs[dateKey])return 'done';
  if(f==='daily')return 'todo';
  // For weekly frequencies, check if they've already hit their target this week
  if(/^\d+x\/week$/.test(f)||f==='weekly'){
    var target=f==='weekly'?1:Number(f.split('x')[0]);
    var parts=dateKey.split('-');
    var d=new Date(+parts[0],+parts[1]-1,+parts[2]);
    var ws=new Date(d);ws.setDate(ws.getDate()-ws.getDay());
    var we=new Date(ws);we.setDate(we.getDate()+6);
    var count=habitCountInRange(h,ws,we);
    if(count>=target)return 'rest';
    return 'todo';
  }
  return 'todo';
}

function nav(page){
  // Transition out current page
  var current=document.querySelector('.page.active');
  var pageEl=document.getElementById('page-'+page);
  if(!pageEl)return;

  function applyNav(){
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
    document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active')});
    document.querySelectorAll('.topnav-link').forEach(function(b){b.classList.remove('active')});
    pageEl.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(b){if(b.getAttribute('onclick')==="nav('"+page+"')")b.classList.add('active')});
    var mainPages=['dashboard','weekly','habits','workout','skincare','gratitude'];
    var matched=false;
    document.querySelectorAll('.topnav-link').forEach(function(b){if(b.getAttribute('data-page')===page){b.classList.add('active');matched=true}});
    // If not a main tab, highlight the More button instead
    if(!matched&&mainPages.indexOf(page)===-1){
      var moreBtn=document.getElementById('topnav-more-btn');
      if(moreBtn)moreBtn.classList.add('active');
    }
    var titles={dashboard:'Dashboard',roadmap:'Roadmap',goals:'Goals',habits:'Habits',workout:'Gym',finance:'Finance',metrics:'Metrics',review:'Reviews',weekly:'Weekly Plan',insights:'Insights',projects:'Projects',relationships:'Relationships',gratitude:'Gratitude',watchlist:'Watch List',wishlist:'Wishlist',skincare:'Skincare',tasks:'Tasks'};
    var mTitle=document.getElementById('mobile-title');if(mTitle)mTitle.textContent=titles[page]||'';
    closeSidebar();
    renderPage(page);
    if(page==='roadmap')refreshRoadmapLiveCards();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  if(current&&current!==pageEl){
    current.classList.add('page-leaving');
    setTimeout(function(){
      current.classList.remove('page-leaving');
      applyNav();
    },180);
  }else{
    applyNav();
  }
}

function subNav(section,tab){var btns=document.querySelectorAll('#page-'+section+' .page-tab');var pages=document.querySelectorAll('#page-'+section+' .sub-page');btns.forEach(function(b){b.classList.remove('active')});pages.forEach(function(p){p.classList.remove('active')});event.target.classList.add('active');var spEl=document.getElementById(section+'-'+tab);if(spEl)spEl.classList.add('active');if(section==='finance'){renderFinance(tab);if(tab!=='overview')refreshRoadmapLiveCards()}if(section==='workout'){if(tab==='history')renderAllWorkouts();if(tab==='body')renderTrainingBody();if(tab==='myplan')renderMyPlanSchedule();if(tab==='overview')renderTrainingOverview()}if(section==='metrics'){if(tab==='water')renderMetricsWater();else if(tab==='finance')renderFinanceMetrics()}if(section==='review'){if(tab==='monthly')renderMonthlyReview()}}

function renderPage(page){if(page==='dashboard')renderDashboard();if(page==='roadmap')renderRoadmap();if(page==='goals')renderGoals();if(page==='habits')renderHabits();if(page==='workout')renderWorkout();if(page==='finance')renderFinance('plan');if(page==='metrics')renderMetrics();if(page==='review')renderReview();if(page==='weekly')renderWeeklyPlan();if(page==='insights')renderInsights();if(page==='projects')renderProjects();if(page==='relationships')renderRelationships();if(page==='gratitude')renderGratitude();if(page==='watchlist')renderWatchlist();if(page==='wishlist')renderWishlist();if(page==='skincare')renderSkincare();if(page==='tasks')renderTasksArchive()}

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobile-overlay').classList.toggle('open')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobile-overlay').classList.remove('open')}




// Top nav dropdown toggle
document.addEventListener('DOMContentLoaded',function(){
  var moreBtn=document.getElementById('topnav-more-btn');
  var dropdown=document.getElementById('topnav-dropdown');
  if(moreBtn&&dropdown){
    moreBtn.addEventListener('click',function(e){
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click',function(e){
      if(!dropdown.contains(e.target)&&e.target!==moreBtn){
        dropdown.classList.remove('open');
      }
    });
    // Close on nav click
    dropdown.querySelectorAll('.topnav-drop-item').forEach(function(item){
      item.addEventListener('click',function(){dropdown.classList.remove('open')});
    });
  }
});


// ── TOPNAV SLIDING PILL + SCROLL BLUR ──
function updateTopnavPill(){
  var pill=document.getElementById('topnav-pill');
  var active=document.querySelector('.topnav-link.active');
  if(!pill||!active)return;
  var rect=active.getBoundingClientRect();
  var parentRect=active.parentElement.getBoundingClientRect();
  pill.style.left=(rect.left-parentRect.left)+'px';
  pill.style.width=rect.width+'px';
  pill.classList.add('visible');
}
window.addEventListener('load',function(){setTimeout(updateTopnavPill,100)});
window.addEventListener('resize',updateTopnavPill);
// Re-run after every nav
var _origNav=window.nav;
window.nav=function(page){
  _origNav(page);
  setTimeout(updateTopnavPill,50);
};

// Scroll blur on topnav
window.addEventListener('scroll',function(){
  var topnav=document.getElementById('topnav');
  if(!topnav)return;
  if(window.scrollY>8)topnav.classList.add('scrolled');
  else topnav.classList.remove('scrolled');
},{passive:true});

// ── HERO PARALLAX ──
document.addEventListener('mousemove',function(e){
  var inner=document.getElementById('hero-inner');
  var hero=document.getElementById('hero');
  if(!inner||!hero)return;
  var rect=hero.getBoundingClientRect();
  if(rect.bottom<0||rect.top>window.innerHeight)return;
  var x=(e.clientX/window.innerWidth-0.5)*8;
  var y=(e.clientY/window.innerHeight-0.5)*5;
  inner.style.transform='translate('+x+'px,'+y+'px)';
  // Move blobs too
  var blobs=hero.querySelectorAll('.blob');
  blobs.forEach(function(b,i){
    var mult=(i+1)*0.6;
    b.style.transform='translate('+(-x*mult)+'px,'+(-y*mult)+'px)';
  });
});


// ── THEME TOGGLE ──
function applyTheme(){
  var pref=localStorage.getItem('lh_theme');  // 'light' | 'dark' | null (auto)
  if(pref==='dark')document.body.classList.add('night-mode');
  else if(pref==='light')document.body.classList.remove('night-mode');
  else{
    // Auto — based on time of day
    var h=new Date().getHours();
    if(h>=21||h<5)document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
  }
  var icon=document.getElementById('theme-toggle-icon');
  if(icon)icon.textContent=document.body.classList.contains('night-mode')?'☀️':'🌙';
}

function toggleTheme(){
  var isDark=document.body.classList.contains('night-mode');
  localStorage.setItem('lh_theme',isDark?'light':'dark');
  applyTheme();
}

// Apply on load
document.addEventListener('DOMContentLoaded',applyTheme);
applyTheme();


// ── EXPORT / IMPORT ──
function exportLifeHubData(){
  try{
    var payload={
      version:1,
      exportedAt:new Date().toISOString(),
      state:STATE
    };
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    a.download='life-hub-backup-'+localDateKey(new Date())+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if(typeof showCelebrationToast==='function')showCelebrationToast('Backup saved','📥');
  }catch(e){
    alert('Export failed: '+e.message);
  }
}

function importLifeHubData(){
  var fileInput=document.getElementById('import-file');
  if(!fileInput||!fileInput.files||!fileInput.files[0])return;
  var file=fileInput.files[0];
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var parsed=JSON.parse(e.target.result);
      if(!parsed.state||typeof parsed.state!=='object')throw new Error('Invalid backup file');
      if(!confirm('This will overwrite all current data with the backup. Continue?'))return;
      STATE=parsed.state;
      saveState();
      closeModal();
      if(typeof showCelebrationToast==='function')showCelebrationToast('Data imported — refreshing','📤');
      setTimeout(function(){location.reload()},1000);
    }catch(err){
      alert('Import failed: '+err.message);
    }
  };
  reader.readAsText(file);
}
