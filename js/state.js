// ============================================================
// STATE & FIREBASE
// ============================================================
var KEY = 'yp26_v3';
var db = null, auth = null, syncDoc = null, _syncTimeout = null, _firebaseReady = false;
// Auth + conflict-tracking state. Cloud reads/writes are gated on _authUser so
// an unauthenticated client can never touch Firestore. _lastCloudUpdatedAt is
// the updatedAt stamp of the last cloud state this tab wrote or pulled; it lets
// us detect when another device has written a newer version (see _refreshFromCloud).
var _authUser = null, _lastCloudUpdatedAt = null, _bootCb = null, _bootDone = false;

function setSyncStatus(s){var el=document.getElementById('sync-status');if(!el)return;var m={saving:{text:'Syncing...',color:'var(--amber)'},saved:{text:'Synced \u2713',color:'var(--mint)'},error:{text:'Offline \u2014 saved locally',color:'var(--text3)'},idle:{text:'',color:'transparent'}};var x=m[s]||m.idle;el.textContent=x.text;el.style.color=x.color}

try{
  var firebaseConfig={apiKey:"AIzaSyB8SO0TemJ-D-9bktrmRTVjQrY5CIHdlRQ",authDomain:"kai-life-hub.firebaseapp.com",projectId:"kai-life-hub",storageBucket:"kai-life-hub.firebasestorage.app",messagingSenderId:"82635096592",appId:"1:82635096592:web:bccea46147417eb2fe8095"};
  firebase.initializeApp(firebaseConfig);
  db=firebase.firestore();
  auth=firebase.auth();
  try{auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)}catch(e){}
  syncDoc=db.collection('users').doc('kai');
  _firebaseReady=true;
}catch(e){console.warn('Firebase init failed:',e);setSyncStatus('error')}

function loadState(){try{var v=localStorage.getItem(KEY);return v?JSON.parse(v):null}catch(e){return null}}

// localStorage always saves (device-local, not exposed). Cloud sync only runs
// when signed in — an unauthenticated client never writes to Firestore.
function saveState(){try{localStorage.setItem(KEY,JSON.stringify(STATE))}catch(e){}
  if(!_firebaseReady||!syncDoc||!_authUser)return;
  clearTimeout(_syncTimeout);setSyncStatus('saving');
  _syncTimeout=setTimeout(function(){_syncTimeout=null;_cloudWrite()},1500)}

// The actual Firestore write, factored out so a pending debounced save can be
// flushed immediately when the tab is hidden/closed (see visibility handlers).
function _cloudWrite(){
  if(!_firebaseReady||!syncDoc||!_authUser)return;
  var stamp=new Date().toISOString();
  return syncDoc.set({state:JSON.stringify(STATE),updatedAt:stamp}).then(function(){
    _lastCloudUpdatedAt=stamp;setSyncStatus('saved');setTimeout(function(){setSyncStatus('idle')},2000)
  }).catch(function(e){console.warn('Sync error:',e);setSyncStatus('error')});
}
function _flushCloudWrite(){if(_syncTimeout){clearTimeout(_syncTimeout);_syncTimeout=null;_cloudWrite()}}

function loadFromCloud(onDone){if(!_firebaseReady||!syncDoc){onDone();return}
  _ensureSignedIn(function(user){
    if(!user){onDone();return}
    syncDoc.get().then(function(doc){if(doc.exists&&doc.data().state){try{STATE=JSON.parse(doc.data().state);_lastCloudUpdatedAt=doc.data().updatedAt||null;try{localStorage.setItem(KEY,JSON.stringify(STATE))}catch(e){}}catch(e){console.warn('Cloud parse error:',e)}}onDone()}).catch(function(e){console.warn('Cloud load failed:',e);setSyncStatus('error');onDone()})
  });
}

// ============================================================
// AUTH GATE (email/password, single account)
// ============================================================
// Resolves `cb` exactly once, when the first authenticated state is observed.
// If no session exists, the sign-in overlay is shown and boot is deferred until
// sign-in succeeds. Firebase persists the session locally, so returning visits
// (even offline) resolve immediately without showing the overlay.
function _ensureSignedIn(cb){
  if(!auth){cb(null);return}
  _bootCb=cb;
  auth.onAuthStateChanged(function(user){
    _authUser=user||null;
    if(user){
      try{console.log('LifeHub signed in as',user.email,'uid:',user.uid)}catch(e){}
      _hideSignIn();
      if(!_bootDone){_bootDone=true;if(_bootCb)_bootCb(user)}
    }else{
      _showSignIn();
    }
  });
}

function signOutLifeHub(){if(auth)auth.signOut()}

function _signInOverlayEl(){return document.getElementById('lh-signin-overlay')}
function _hideSignIn(){var e=_signInOverlayEl();if(e)e.style.display='none'}
function _showSignIn(){
  var e=_signInOverlayEl();
  if(e){e.style.display='flex';return}
  var o=document.createElement('div');
  o.id='lh-signin-overlay';
  o.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(28,18,10,0.82);backdrop-filter:blur(6px);font-family:var(--sans,system-ui,sans-serif)';
  o.innerHTML=''
    +'<div style="background:var(--card,#fffdf9);color:var(--text,#2a2018);width:min(360px,90vw);border-radius:18px;padding:28px 24px;box-shadow:0 20px 60px rgba(40,20,10,0.35)">'
    +'<div style="font-size:22px;font-weight:700;margin-bottom:4px">Life Hub</div>'
    +'<div style="font-size:13px;color:var(--text2,#7a6a58);margin-bottom:18px">Sign in to load and sync your data.</div>'
    +'<input id="lh-signin-email" type="email" autocomplete="username" placeholder="Email" style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:10px;border:1.5px solid var(--border,#e5ddd0);border-radius:10px;font-size:14px;background:var(--bg,#fff);color:inherit">'
    +'<input id="lh-signin-pw" type="password" autocomplete="current-password" placeholder="Password" onkeydown="if(event.key===\'Enter\')lhSignIn()" style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:12px;border:1.5px solid var(--border,#e5ddd0);border-radius:10px;font-size:14px;background:var(--bg,#fff);color:inherit">'
    +'<div id="lh-signin-err" style="color:#e05252;font-size:12px;min-height:16px;margin-bottom:8px"></div>'
    +'<button id="lh-signin-btn" onclick="lhSignIn()" style="width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#a0522d,#6b3a1f);color:#fffdf9;font-size:14px;font-weight:600;cursor:pointer">Sign in</button>'
    +'</div>';
  document.body.appendChild(o);
}
function lhSignIn(){
  if(!auth)return;
  var em=(document.getElementById('lh-signin-email')||{}).value;
  var pw=(document.getElementById('lh-signin-pw')||{}).value;
  em=(em||'').trim();pw=pw||'';
  var err=document.getElementById('lh-signin-err');
  if(!em||!pw){if(err)err.textContent='Enter your email and password.';return}
  if(err)err.textContent='';
  var btn=document.getElementById('lh-signin-btn');if(btn){btn.disabled=true;btn.textContent='Signing in\u2026'}
  auth.signInWithEmailAndPassword(em,pw).catch(function(e){
    if(err)err.textContent=(e&&e.message)?e.message:'Sign-in failed.';
  }).finally(function(){if(btn){btn.disabled=false;btn.textContent='Sign in'}});
}

// ============================================================
// CROSS-DEVICE CONFLICT MITIGATION
// ============================================================
// State is one last-write-wins JSON blob. To reduce the "stale tab clobbers a
// newer device" data-loss window: flush any pending write when the tab is
// hidden, and re-pull from the cloud when the tab regains focus. If the remote
// copy is newer than what this tab last synced, adopt it and re-render before
// the user can overwrite it with stale data.
function _rerenderCurrentPage(){
  try{
    var active=document.querySelector('.page.active');
    if(!active){if(typeof renderPlanner==='function')renderPlanner();return}
    var page=active.id.replace(/^page-/,'');
    if(typeof renderPage==='function')renderPage(page);
    else if(typeof renderPlanner==='function')renderPlanner();
  }catch(e){console.warn('Re-render after refresh failed:',e)}
}
function _refreshFromCloud(){
  if(!_firebaseReady||!syncDoc||!_authUser)return;
  syncDoc.get().then(function(doc){
    if(!doc.exists||!doc.data().state)return;
    var remoteStamp=doc.data().updatedAt||null;
    if(remoteStamp&&remoteStamp!==_lastCloudUpdatedAt){
      try{
        STATE=JSON.parse(doc.data().state);
        _lastCloudUpdatedAt=remoteStamp;
        try{localStorage.setItem(KEY,JSON.stringify(STATE))}catch(e){}
        _rerenderCurrentPage();
        setSyncStatus('saved');setTimeout(function(){setSyncStatus('idle')},1500);
      }catch(e){console.warn('Refresh parse error:',e)}
    }
  }).catch(function(e){console.warn('Focus refresh failed:',e)});
}
document.addEventListener('visibilitychange',function(){
  if(document.hidden)_flushCloudWrite();
  else _refreshFromCloud();
});
window.addEventListener('focus',_refreshFromCloud);
window.addEventListener('pagehide',_flushCloudWrite);

function g(){return Math.random().toString(36).slice(2,9)}

// NOTE: This is generic placeholder/seed data only. It is what a brand-new
// user sees before any real data exists. Real personal data is never stored
// here — it lives in localStorage and Firebase and is loaded over this default
// (see `STATE = loadState() || DEFAULT_STATE` below). Do not commit real
// financial, health, or relationship data into this file.
var DEFAULT_STATE = {
  goals:[
    {id:g(),name:'Sample fitness goal',cat:'Fitness',badge:'fit',desc:'Edit or replace this example goal',target:100,unit:'%',direction:'up',deadline:'2026-12-31',progress:0,subGoals:[]},
    {id:g(),name:'Sample finance goal',cat:'Finance',badge:'fin',desc:'Edit or replace this example goal',target:1000,unit:'\u00a3',direction:'up',deadline:'2026-12-31',progress:0,subGoals:[]},
  ],
  habits:[
    {id:g(),name:'Daily steps',freq:'daily',badge:'fit',logs:{}},
    {id:g(),name:'Skincare AM',freq:'daily',badge:'per',logs:{}},
    {id:g(),name:'Skincare PM',freq:'daily',badge:'per',logs:{}},
  ],
  workouts:[],
  prs:{},
  income:[{id:'inc1',name:'Salary',amount:0,icon:'\ud83d\udcbc',note:''}],
  expenses:[
    {id:'exp1',name:'Rent',amount:0,icon:'\ud83c\udfe0',note:'',color:'#f9a8d4'},
    {id:'exp2',name:'Groceries',amount:0,icon:'\ud83d\uded2',note:'',color:'#c084fc'},
    {id:'exp3',name:'Subscriptions',amount:0,icon:'\ud83d\udcfa',note:'',color:'#fb923c'},
    {id:'exp4',name:'Transport',amount:0,icon:'\ud83d\ude87',note:'',color:'#f59e0b'},
    {id:'exp5',name:'Gym',amount:0,icon:'\ud83c\udfcb\ufe0f',note:'',color:'#a0522d'},
    {id:'exp6',name:'Phone',amount:0,icon:'\ud83d\udcf1',note:'',color:'#818cf8'},
  ],
  accounts:[
    {id:'acc1',name:'Savings',type:'savings',balance:0,color:'#a0522d',icon:'\ud83d\udcc8',institution:''},
  ],
  debts:[
    {id:'dbt1',name:'Sample debt',balance:0,priority:'Medium',color:'#fb7185',note:''},
  ],
  savingsGoals:[
    {id:'sg1',name:'Emergency Fund',target:0,current:0,priority:'Medium',icon:'\ud83d\udea8',color:'#f59e0b',deadline:'2026-12-31',note:''},
  ],
  metrics:{weight:[],bodyFat:[],steps:[],runs:[],moneySaved:[],projectsDone:[]},
  weeklyPlans:{},reviews:{monthly:{},quarterly:{}},
  dailyPriorities:{},
  trainingEvents:[],
  trainingPlan:null,
  journal:{},mood:{},dailyHighlights:{},
  skincare:{startedOn:null,products:{am:[],pm:[]},actives:[],nightSchedule:{},guaShaLog:{},activeLog:{},photos:[]},
  tasks:[],
  relationships:[
    {id:'rel1',name:'Family member',cat:'Family',freq:7,lastContact:'',note:'',color:'#c9973a',icon:'\ud83d\udc64'},
  ],
  gratitude:[],wishlist:[],
  watchlist:[],
  roadmapChecklist:{},
  debtPayments:[],
  plannedPayments:[],
  reminders:[],
  water:{},
  commitments:[],
  weeklyIntention:null
};

var STATE = loadState() || JSON.parse(JSON.stringify(DEFAULT_STATE));


