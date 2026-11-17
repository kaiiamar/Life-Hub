// ============================================================
// STATE & FIREBASE
// ============================================================
var KEY = 'yp26_v3';
var db = null, auth = null, syncDoc = null, _syncTimeout = null, _firebaseReady = false;
// Authentication is shared by Firestore sync and the protected notification API.
// Revisioned domain sync, offline queuing and conflicts live in persistence.js.
var _authUser = null, _lastCloudUpdatedAt = null, _bootCb = null, _bootDone = false;
var _authPersistenceReady=Promise.resolve(false),_authPersistenceError=null;

function setSyncStatus(s){var el=document.getElementById('sync-status');if(!el)return;var m={saving:{text:'',color:'transparent'},retrying:{text:'Waiting to retry',color:'var(--amber)'},queued:{text:'Queued offline',color:'var(--amber)'},saved:{text:'',color:'transparent'},conflict:{text:'Review sync',color:'var(--accent)'},storage:{text:'Storage needs attention',color:'var(--amber)'},auth:{text:'Sign in required',color:'var(--amber)'},authPersistence:{text:'Session storage limited',color:'var(--amber)'},rules:{text:'Sync permission blocked',color:'var(--clay)'},data:{text:'Sync data needs attention',color:'var(--clay)'},error:{text:'Sync needs attention',color:'var(--text3)'},idle:{text:'',color:'transparent'}};var x=m[s]||m.idle;el.textContent=x.text;el.style.color=x.color;el.setAttribute('aria-live','polite')}

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
  if(!auth){setSyncStatus('auth');_showSignIn('Secure sign-in is unavailable. Life Hub has not loaded your data.');return}
  _bootCb=cb;
  Promise.resolve(_authPersistenceReady).then(function(){
    auth.onAuthStateChanged(function(user){
      _authUser=user||null;
      if(typeof handleLifeHubSyncAuthState==='function')handleLifeHubSyncAuthState(_authUser);
      if(user){
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
function _showSignIn(message){
  var e=_signInOverlayEl();
  if(e){e.style.display='flex';var existingMessage=e.querySelector('[data-signin-message]');if(existingMessage&&message)existingMessage.textContent=message;return}
  var o=document.createElement('div');o.id='lh-signin-overlay';o.className='lh-signin-overlay';
  var card=document.createElement('section');card.className='lh-signin-card';card.setAttribute('aria-labelledby','lh-signin-title');
  var title=document.createElement('h1');title.id='lh-signin-title';title.textContent='Life Hub';card.appendChild(title);
  var copy=document.createElement('p');copy.setAttribute('data-signin-message','');copy.textContent=message||'Sign in to load and sync your data.';card.appendChild(copy);
  var emailLabel=document.createElement('label');emailLabel.htmlFor='lh-signin-email';emailLabel.textContent='Email';card.appendChild(emailLabel);
  var email=document.createElement('input');email.id='lh-signin-email';email.type='email';email.autocomplete='username';card.appendChild(email);
  var passwordLabel=document.createElement('label');passwordLabel.htmlFor='lh-signin-pw';passwordLabel.textContent='Password';card.appendChild(passwordLabel);
  var password=document.createElement('input');password.id='lh-signin-pw';password.type='password';password.autocomplete='current-password';card.appendChild(password);
  var err=document.createElement('p');err.id='lh-signin-err';err.className='lh-signin-error';err.setAttribute('role','alert');card.appendChild(err);
  var button=document.createElement('button');button.id='lh-signin-btn';button.type='button';button.className='btn btn-accent';button.textContent='Sign in';button.addEventListener('click',lhSignIn);card.appendChild(button);
  password.addEventListener('keydown',function(event){if(event.key==='Enter')lhSignIn()});
  o.appendChild(card);document.body.appendChild(o);email.focus();
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
  goals:[],
  habits:[
    {id:'steps-towards-10k-v1',name:'8,000 steps',freq:'daily',badge:'fit',icon:'👟',note:'Build up gradually and follow your physiotherapist or GP advice if symptoms increase.',anchor:'anytime',detailsTitle:'A gentle daily minimum',details:[{name:'Daily target',spec:'8,000 steps'}],startDate:DEFAULT_HABIT_START,lifecycle:{version:1,inactivePeriods:[]},integrationKeys:['lifehub.steps.8000'],managedBy:'lifehub',managedHabitKey:'daily-basics.steps',managedHabitVersion:1,provenanceVersion:1,logProvenance:{},logs:{}}
  ],
  workouts:[],
  prs:{},
  income:[],
  expenses:[],
  accounts:[],
  debts:[],
  savingsGoals:[],
  metrics:{weight:[],bodyFat:[],steps:[],run:[],moneySaved:[],projectsDone:[]},
  weeklyPlans:{},reviews:{monthly:{},quarterly:{}},
  dailyPriorities:{},
  trainingEvents:[],
  trainingPlan:null,
  // Winter Arc execution is keyed by deterministic occurrence ID. Historical
  // generic workouts remain in `workouts` and are never rewritten into this map.
  trainingSessions:{},
  dailyCheckIns:{},
  // Routine R2: house per stay (Sunday-keyed overrides) and Sunday plan ticks.
  routine:{version:1,stays:{},sundayPlans:{}},
  // Temporary AWS study commitment. Older course/practice fields are preserved on import.
  study:{version:2,commitment:{label:'AWS study',startDate:'2026-11-16',endDate:'2026-12-31',targetPerWeek:3,minimumMinutes:30,dueDays:[1,4,5],time:'14:00'},sessions:{},course:{label:'',sectionsTotal:0,sectionsDone:0},practiceScores:[]},
  reading:{sessions:{},activeSessionId:null},
  cycle:{settings:{defaultLengthDays:30},observedStarts:[],estimates:['2026-10-16','2026-11-15','2026-12-15']},
  weeklyCheckIns:{},
  // Personal challenge definitions are seeded after cloud data loads.
  challenges:{},
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
  debtCharges:[],
  plannedPayments:[],
  savingsDeposits:[],
  savingsWithdrawals:[],
  paydayCheckIns:{},
  // Preserved for old imports and historical compatibility; no active UI reads it.
  netWorthSnapshots:[],
  // Stable v75 schedules. Skincare reminders create no completion records.
  reminders:[
    {id:'aws-study',label:'AWS study',emoji:'📘',message:'AWS study is ready when you are. Log your actual minutes in Life Hub.',enabled:true,schedule:{type:'weekly',days:[1,4,5],time:'14:00'},startDate:'2026-11-16',endDate:'2026-12-31'},
    {id:'skincare-am',label:'Morning skincare',emoji:'☀️',message:'Morning skincare.',enabled:true,schedule:{type:'daily',time:'07:00'}},
    {id:'skincare-pm',label:'Evening skincare',emoji:'🌙',message:'Evening skincare.',enabled:true,schedule:{type:'daily',time:'22:00'}},
    {id:'monthly-reset',label:'Monthly Reset',emoji:'🌿',message:'Your Monthly Reset is ready.',enabled:true,schedule:{type:'monthly-last-weekday',weekday:0,time:'11:00'}}
  ],
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
  // Fresh v75 profiles do not run retired product-seeding migrations.
  __bodyCompositionPlanV4:true,
  __rehabHabitV1:true,
  __injuryReentryV1:true,
  __challenge75V1:true,
  __runHabitRetiredV1:true,
  __tasksMigrated:true,
  __plannerMigrated:true,
  __lifeHubV75:true,
  __lifeHubV76:true,
  companion:{
    acks:{dayComplete:null,focusSlate:null},
    badge:{value:0,writtenAt:null},
    push:{registeredAt:null,endpointHash:null,lastAttemptAt:null,lastError:null},
    netWorthPromptMonth:null
  }
};

var STATE = loadState() || JSON.parse(JSON.stringify(DEFAULT_STATE));


