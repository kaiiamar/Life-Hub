// NAVIGATION
// ============================================================
var activeWeek=weekKey(new Date());
var goalFilter='all';
var metricCharts={};

function weekKey(d){var s=new Date(d);s.setHours(0,0,0,0);s.setDate(s.getDate()-s.getDay());return s.toISOString().slice(0,10)}
function weekDays(wk){var s=new Date(wk);return Array.from({length:7},function(_,i){var d=new Date(s);d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)})}
function fmtDate(d){return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
function fmtMoney(n){return '\u00a3'+Math.abs(Number(n)).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0})}
function goalPct(g){if(!g.progress&&g.progress!==0)return 0;if(g.direction==='up')return Math.min(100,Math.round((g.progress/g.target)*100));if(g.direction==='down'){if(!g.progress)return 0;var base=g.target*2;return Math.min(100,Math.max(0,Math.round(((base-g.progress)/g.target)*100)))}return 0}
function pbarColor(p){return p>=80?'#6b9e7a':p>=50?'#c9973a':'#c0392b'}
function daysLeft(dl){return Math.ceil((new Date(dl)-new Date())/86400000)}
function statusBadge(g){var p=goalPct(g);var dl=daysLeft(g.deadline);if(p>=100)return '<span class="badge badge-done">Done</span>';if(dl<0)return '<span class="badge badge-risk">Overdue</span>';if(dl<30&&p<70)return '<span class="badge badge-risk">At risk</span>';if(p>0)return '<span class="badge badge-track">On track</span>';return '<span class="badge badge-pend">Not started</span>'}
function habitStreak(h){var today=new Date();var streak=0;for(var i=0;i<90;i++){var d=new Date(today);d.setDate(d.getDate()-i);var k=d.toISOString().slice(0,10);if(h.logs[k])streak++;else if(i>0)break}return streak}
function habitWeekPct(h,wk){var days=weekDays(wk);return Math.round((days.filter(function(d){return h.logs[d]}).length/7)*100)}

function nav(page){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active')});var pageEl=document.getElementById('page-'+page);if(pageEl)pageEl.classList.add('active');document.querySelectorAll('.nav-item').forEach(function(b){if(b.getAttribute('onclick')==="nav('"+page+"')")b.classList.add('active')});var titles={dashboard:'Dashboard',roadmap:'Roadmap',goals:'Goals',habits:'Habits',workout:'Gym',finance:'Finance',metrics:'Metrics',review:'Reviews',weekly:'Weekly Plan',insights:'Insights',projects:'Projects',relationships:'Relationships',gratitude:'Gratitude',watchlist:'Watch List',wishlist:'Wishlist'};var mTitle=document.getElementById('mobile-title');if(mTitle)mTitle.textContent=titles[page]||'';closeSidebar();renderPage(page);if(page==='roadmap')refreshRoadmapLiveCards()}

function subNav(section,tab){var btns=document.querySelectorAll('#page-'+section+' .page-tab');var pages=document.querySelectorAll('#page-'+section+' .sub-page');btns.forEach(function(b){b.classList.remove('active')});pages.forEach(function(p){p.classList.remove('active')});event.target.classList.add('active');var spEl=document.getElementById(section+'-'+tab);if(spEl)spEl.classList.add('active');if(section==='finance'){renderFinance(tab);if(tab!=='overview')refreshRoadmapLiveCards()}if(section==='workout'){if(tab==='progress')renderWorkoutProgressCharts();if(tab==='prs')renderPRs();if(tab==='history')renderAllWorkouts();if(tab==='runs')renderRunsTab()}if(section==='metrics'){if(tab==='body')renderBodyMetrics();else if(tab==='fitness')renderFitnessMetrics();else if(tab==='finance')renderFinanceMetrics()}if(section==='review'){if(tab==='monthly')renderMonthlyReview();else if(tab==='quarterly')renderQuarterlyReview()}}

function renderPage(page){if(page==='dashboard')renderDashboard();if(page==='roadmap')renderRoadmap();if(page==='goals')renderGoals();if(page==='habits')renderHabits();if(page==='workout')renderWorkout();if(page==='finance')renderFinance('overview');if(page==='metrics')renderMetrics();if(page==='review')renderReview();if(page==='weekly')renderWeeklyPlan();if(page==='insights')renderInsights();if(page==='projects')renderProjects();if(page==='relationships')renderRelationships();if(page==='gratitude')renderGratitude();if(page==='watchlist')renderWatchlist();if(page==='wishlist')renderWishlist()}

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobile-overlay').classList.toggle('open')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobile-overlay').classList.remove('open')}


