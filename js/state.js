// ============================================================
// STATE & FIREBASE
// ============================================================
var KEY = 'yp26_v3';
var db = null, auth = null, syncDoc = null, _syncTimeout = null, _firebaseReady = false;
// Authentication is shared by Firestore sync and the protected notification API.
// Revisioned domain sync, offline queuing and conflicts live in persistence.js.
var _authUser = null, _lastCloudUpdatedAt = null, _bootCb = null, _bootDone = false;
var _authPersistenceReady=Promise.resolve(false),_authPersistenceError=null;

function setSyncStatus(s){var el=document.getElementById('sync-status');if(!el)return;var m={saving:{text:'Syncing...',color:'var(--amber)'},retrying:{text:'Waiting to retry',color:'var(--amber)'},queued:{text:'Queued offline',color:'var(--amber)'},saved:{text:'Synced \u2713',color:'var(--mint)'},conflict:{text:'Review sync',color:'var(--accent)'},storage:{text:'Storage needs attention',color:'var(--amber)'},auth:{text:'Sign in required',color:'var(--amber)'},authPersistence:{text:'Session storage limited',color:'var(--amber)'},rules:{text:'Sync permission blocked',color:'var(--clay)'},data:{text:'Sync data needs attention',color:'var(--clay)'},error:{text:'Sync needs attention',color:'var(--text3)'},idle:{text:'',color:'transparent'}};var x=m[s]||m.idle;el.textContent=x.text;el.style.color=x.color;el.setAttribute('aria-live','polite')}

function configureLifeHubAuthPersistence(){
  if(!auth||typeof firebase==='undefined'||!firebase.auth){_authPersistenceReady=Promise.resolve(false);return _authPersistenceReady}
  var request;try{request=auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)}catch(error){request=Promise.reject(error)}
  _authPersistenceReady=Promise.resolve(request).then(function(){
    _authPersistenceError=null;
    if(typeof handleLifeHubAuthPersistenceResult==='function')handleLifeHubAuthPersistenceResult(null);
    return true;
  }).catch(function(error){
    _authPersistenceError=error||new Error('Auth persistence unavailable');
    console.warn('Firebase auth persistence is unavailable:',error);
    setSyncStatus('authPersistence');
    if(typeof handleLifeHubAuthPersistenceResult==='function')handleLifeHubAuthPersistenceResult(_authPersistenceError);
    return false;
  });
  return _authPersistenceReady;
}

try{
  var firebaseConfig={apiKey:"AIzaSyB8SO0TemJ-D-9bktrmRTVjQrY5CIHdlRQ",authDomain:"kai-life-hub.firebaseapp.com",projectId:"kai-life-hub",storageBucket:"kai-life-hub.firebasestorage.app",messagingSenderId:"82635096592",appId:"1:82635096592:web:bccea46147417eb2fe8095"};
  firebase.initializeApp(firebaseConfig);
  db=firebase.firestore();
  auth=firebase.auth();
  syncDoc=db.collection('users').doc('kai');
  _firebaseReady=true;
  configureLifeHubAuthPersistence();
}catch(e){console.warn('Firebase init failed:',e);setSyncStatus('error')}

function loadState(){try{var v=localStorage.getItem(KEY);return v?JSON.parse(v):null}catch(e){return null}}

// Attach the signed-in Firebase identity to calls made to the private backend.
// The backend verifies this token and binds it to LIFEHUB_FIREBASE_UID; caller-
// supplied user IDs are never trusted.
function getLifeHubIdToken(){
  if(!_firebaseReady||!auth)return Promise.reject(new Error('Sign in required'));
  var current=auth.currentUser||_authUser;
  if(current)return current.getIdToken();
  return new Promise(function(resolve,reject){
    var settled=false;var off=function(){};
    var timer=setTimeout(function(){if(settled)return;settled=true;off();reject(new Error('Sign in timed out'))},10000);
    off=auth.onAuthStateChanged(function(user){
      if(settled)return;settled=true;clearTimeout(timer);off();
      if(!user){reject(new Error('Sign in required'));return}
      _authUser=user;user.getIdToken().then(resolve,reject);
    },function(error){if(settled)return;settled=true;clearTimeout(timer);off();reject(error)});
  });
}
function lifeHubApiFetch(url,options){
  options=options||{};
  return getLifeHubIdToken().then(function(token){
    var requestOptions=Object.assign({},options);
    requestOptions.headers=Object.assign({},options.headers||{},{Authorization:'Bearer '+token});
    return fetch(url,requestOptions);
  });
}

// Persistence is implemented in js/persistence.js, loaded immediately after
// this file. Keeping authentication and data sync separate makes migrations,
// conflict handling and offline recovery independently testable.

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
  Promise.resolve(_authPersistenceReady).then(function(){
    auth.onAuthStateChanged(function(user){
      _authUser=user||null;
      if(typeof handleLifeHubSyncAuthState==='function')handleLifeHubSyncAuthState(_authUser);
      if(user){
        try{console.log('LifeHub signed in as',user.email,'uid:',user.uid)}catch(e){}
        _hideSignIn();
        if(!_bootDone){_bootDone=true;if(_bootCb)_bootCb(user)}
      }else{
        _showSignIn();
      }
    },function(error){
      console.warn('Firebase auth state could not be read:',error);
      if(typeof handleLifeHubSyncAuthState==='function')handleLifeHubSyncAuthState(null,error);
      _showSignIn();
    });
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
    +'<button id="lh-signin-btn" onclick="lhSignIn()" style="width:100%;padding:12px;border:none;border-radius:10px;background:var(--moss,#3F5A44);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Sign in</button>'
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
  Promise.resolve(_authPersistenceReady).then(function(){return auth.signInWithEmailAndPassword(em,pw)}).catch(function(e){
    if(err)err.textContent=(e&&e.message)?e.message:'Sign-in failed.';
  }).then(function(){if(btn){btn.disabled=false;btn.textContent='Sign in'}});
}

function g(){return Math.random().toString(36).slice(2,9)}
var DEFAULT_HABIT_START=(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})();

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
    {id:g(),name:'Daily steps',freq:'daily',badge:'fit',icon:'👟',note:'',anchor:'anytime',startDate:DEFAULT_HABIT_START,lifecycle:{version:1,inactivePeriods:[]},integrationKeys:[],provenanceVersion:1,logProvenance:{},logs:{}},
    {id:g(),name:'Skincare AM',freq:'daily',badge:'per',icon:'☀️',note:'',anchor:'morning',startDate:DEFAULT_HABIT_START,lifecycle:{version:1,inactivePeriods:[]},integrationKeys:['lifehub.skincare.am'],provenanceVersion:1,logProvenance:{},logs:{}},
    {id:g(),name:'Skincare PM',freq:'daily',badge:'per',icon:'🌙',note:'',anchor:'evening',startDate:DEFAULT_HABIT_START,lifecycle:{version:1,inactivePeriods:[]},integrationKeys:['lifehub.skincare.pm'],provenanceVersion:1,logProvenance:{},logs:{}},
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
  metrics:{weight:[],bodyFat:[],steps:[],run:[],moneySaved:[],projectsDone:[]},
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
  // Dated net-worth snapshots, one per day: {date:'YYYY-MM-DD', value:Number}.
  netWorthSnapshots:[],
  reminders:[],
  water:{},
  // Hydration preferences: {target:glasses, glassMl:size}.
  waterSettings:{},
  commitments:[],
  weeklyIntentions:{},
  weeklyIntention:null,
  // Per-day evening sweep progress, keyed by YYYY-MM-DD.
  sweep:{},
  // Single record of daily-loop bookkeeping: acknowledgements shown, the last
  // badge value written, push registration status and the net-worth prompt month.
  companion:{
    acks:{dayComplete:null,focusSlate:null},
    badge:{value:0,writtenAt:null},
    push:{registeredAt:null,endpointHash:null,lastAttemptAt:null,lastError:null},
    netWorthPromptMonth:null
  }
};

var STATE = loadState() || JSON.parse(JSON.stringify(DEFAULT_STATE));


