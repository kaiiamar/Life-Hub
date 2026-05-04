// Global search — quick navigation to pages, goals, habits
(function(){
  var SEARCH_ENTRIES=[
    {label:'Dashboard',keywords:'home overview today',action:function(){nav('dashboard')}},
    {label:'Roadmap',keywords:'plan monthly timeline months',action:function(){nav('roadmap')}},
    {label:'Weekly Plan',keywords:'week priorities intention',action:function(){nav('weekly')}},
    {label:'Goals',keywords:'annual targets objectives',action:function(){nav('goals')}},
    {label:'Habits',keywords:'daily tracking streak',action:function(){nav('habits')}},
    {label:'Workouts',keywords:'gym fitness training sessions runs',action:function(){nav('workout')}},
    {label:'Finance',keywords:'money budget debt savings income expenses accounts',action:function(){nav('finance')}},
    {label:'Metrics',keywords:'body weight runs stats charts',action:function(){nav('metrics')}},
    {label:'Reviews',keywords:'monthly quarterly reflection',action:function(){nav('review')}},
    {label:'Gratitude & Wins',keywords:'grateful thankful journal',action:function(){nav('gratitude')}},
    {label:'Insights',keywords:'analytics pulse trends',action:function(){nav('insights')}},
    {label:'Projects',keywords:'tasks todo',action:function(){nav('projects')}},
    {label:'Relationships',keywords:'people contact friends family',action:function(){nav('relationships')}},
    {label:'Skincare',keywords:'routine am pm gua sha',action:function(){nav('skincare')}},
    {label:'Watch List',keywords:'movies series shows tv',action:function(){nav('watchlist')}},
    {label:'Wishlist',keywords:'shopping waitlist buy',action:function(){nav('wishlist')}},
    {label:'Log a workout session',keywords:'add workout gym',action:function(){openModal('quickLog')}},
    {label:'Log a run',keywords:'run cardio',action:function(){openModal('logRun')}},
    {label:'Log weight',keywords:'weight scale body',action:function(){openModal('logMetric','weight')}},
    {label:'Daily check-in',keywords:'mood energy sleep',action:function(){openModal('logMood')}}
  ];

  function buildResults(query){
    var q=query.trim().toLowerCase();
    if(!q)return [];
    return SEARCH_ENTRIES.filter(function(e){
      return e.label.toLowerCase().indexOf(q)!==-1||e.keywords.indexOf(q)!==-1;
    }).slice(0,8);
  }

  function renderResults(results,input){
    var panel=document.getElementById('search-results');
    if(!panel)return;
    if(!results.length){panel.style.display='none';panel.innerHTML='';return}
    panel.style.display='block';
    panel.innerHTML=results.map(function(r,i){
      return '<div class="search-result" data-idx="'+i+'" tabindex="0">'
        +'<span class="search-result-icon">→</span>'
        +'<span>'+r.label+'</span></div>';
    }).join('');
    Array.prototype.forEach.call(panel.querySelectorAll('.search-result'),function(el,i){
      el.addEventListener('click',function(){
        results[i].action();
        input.value='';
        panel.style.display='none';
      });
    });
  }

  function initSearch(){
    var input=document.getElementById('global-search');
    if(!input)return;
    var panel=document.createElement('div');
    panel.id='search-results';
    panel.className='search-results';
    panel.style.display='none';
    input.parentElement.parentElement.style.position='relative';
    input.parentElement.parentElement.appendChild(panel);

    input.addEventListener('input',function(){
      renderResults(buildResults(input.value),input);
    });
    input.addEventListener('focus',function(){
      if(input.value)renderResults(buildResults(input.value),input);
    });
    input.addEventListener('blur',function(){
      setTimeout(function(){panel.style.display='none'},150);
    });
    input.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        var results=buildResults(input.value);
        if(results.length){results[0].action();input.value='';panel.style.display='none'}
      }
      if(e.key==='Escape'){input.value='';panel.style.display='none';input.blur()}
    });

    // ⌘K / Ctrl+K shortcut
    document.addEventListener('keydown',function(e){
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initSearch);
  }else{
    initSearch();
  }
})();
