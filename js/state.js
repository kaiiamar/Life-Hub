// ============================================================
// STATE & FIREBASE
// ============================================================
var KEY = 'yp26_v3';
var db = null, syncDoc = null, _syncTimeout = null, _firebaseReady = false;

function setSyncStatus(s){var el=document.getElementById('sync-status');if(!el)return;var m={saving:{text:'Syncing...',color:'var(--amber)'},saved:{text:'Synced \u2713',color:'var(--mint)'},error:{text:'Offline \u2014 saved locally',color:'var(--text3)'},idle:{text:'',color:'transparent'}};var x=m[s]||m.idle;el.textContent=x.text;el.style.color=x.color}

try{
  var firebaseConfig={apiKey:"AIzaSyB8SO0TemJ-D-9bktrmRTVjQrY5CIHdlRQ",authDomain:"kai-life-hub.firebaseapp.com",projectId:"kai-life-hub",storageBucket:"kai-life-hub.firebasestorage.app",messagingSenderId:"82635096592",appId:"1:82635096592:web:bccea46147417eb2fe8095"};
  firebase.initializeApp(firebaseConfig);
  db=firebase.firestore();
  syncDoc=db.collection('users').doc('kai');
  _firebaseReady=true;
}catch(e){console.warn('Firebase init failed:',e);setSyncStatus('error')}

function loadState(){try{var v=localStorage.getItem(KEY);return v?JSON.parse(v):null}catch(e){return null}}
function saveState(){try{localStorage.setItem(KEY,JSON.stringify(STATE))}catch(e){}
  if(!_firebaseReady||!syncDoc)return;
  clearTimeout(_syncTimeout);setSyncStatus('saving');
  _syncTimeout=setTimeout(function(){syncDoc.set({state:JSON.stringify(STATE),updatedAt:new Date().toISOString()}).then(function(){setSyncStatus('saved');setTimeout(function(){setSyncStatus('idle')},2000)}).catch(function(e){console.warn('Sync error:',e);setSyncStatus('error')})},1500)}

function loadFromCloud(onDone){if(!_firebaseReady||!syncDoc){onDone();return}
  syncDoc.get().then(function(doc){if(doc.exists&&doc.data().state){try{STATE=JSON.parse(doc.data().state);try{localStorage.setItem(KEY,JSON.stringify(STATE))}catch(e){}}catch(e){console.warn('Cloud parse error:',e)}}onDone()}).catch(function(e){console.warn('Cloud load failed:',e);setSyncStatus('error');onDone()})}

function g(){return Math.random().toString(36).slice(2,9)}

var DEFAULT_STATE = {
  goals:[
    {id:g(),name:'Debt free by end of 2026',cat:'Finance',badge:'fin',desc:'Clear all credit card and BNPL debt using avalanche method',target:6492,unit:'\u00a3',direction:'down',deadline:'2026-11-30',progress:6492,subGoals:[]},
    {id:g(),name:'Complete a HYROX',cat:'Fitness',badge:'fit',desc:'Register and complete a full HYROX event in Q4 2026',target:100,unit:'%',direction:'up',deadline:'2026-11-30',progress:15,subGoals:[]},
    {id:g(),name:'Hit 80kg',cat:'Fitness',badge:'fit',desc:'Lose 8kg through consistent training and nutrition',target:80,unit:'kg',direction:'down',deadline:'2026-11-30',progress:88,subGoals:[]},
    {id:g(),name:'Sub 30 min 5k',cat:'Fitness',badge:'fit',desc:'Track and improve 5k time throughout the year',target:30,unit:'min',direction:'down',deadline:'2026-12-31',progress:35,subGoals:[]},
    {id:g(),name:'Run a half marathon',cat:'Fitness',badge:'fit',desc:'21.1km \u2014 find a race and register',target:21.1,unit:'km',direction:'up',deadline:'2026-12-31',progress:0,subGoals:[]},
    {id:g(),name:'Finish apprenticeship with 2:1',cat:'Career',badge:'car',desc:'Consistent minimum 2:1 across all remaining submissions',target:100,unit:'%',direction:'up',deadline:'2027-03-31',progress:40,subGoals:[]},
    {id:g(),name:'Land \u00a350k+ data role',cat:'Career',badge:'car',desc:'Secure new role as Data Analyst, BI Analyst or Data Consultant in London hybrid',target:50000,unit:'\u00a3',direction:'up',deadline:'2027-03-31',progress:0,subGoals:[]},
    {id:g(),name:'Save house deposit by Q4 2027',cat:'Finance',badge:'fin',desc:'Build 5-10% deposit on a \u00a3300k property. Target: \u00a315-20k',target:15000,unit:'\u00a3',direction:'up',deadline:'2027-12-31',progress:250,subGoals:[]},
    {id:g(),name:'Consistently save/invest every month',cat:'Finance',badge:'fin',desc:'12 months \u2014 do not miss a single month',target:12,unit:'months',direction:'up',deadline:'2026-12-31',progress:2,subGoals:[]},
    {id:g(),name:'Thailand anniversary trip',cat:'Personal',badge:'per',desc:'29 November 2026 \u2014 2-year anniversary trip with boyfriend',target:100,unit:'%',direction:'up',deadline:'2026-11-29',progress:5,subGoals:[]},
  ],
  habits:[
    {id:g(),name:'Min 8k steps',freq:'daily',badge:'fit',logs:{}},
    {id:g(),name:'Run once a week',freq:'weekly',badge:'fit',logs:{}},
    {id:g(),name:'Gym session',freq:'3x/week',badge:'fit',logs:{}},
    {id:g(),name:'Visit Dad',freq:'bi-monthly',badge:'per',logs:{}},
    {id:g(),name:'Hike',freq:'monthly',badge:'per',logs:{}},
    {id:g(),name:'Eat better (no junk)',freq:'daily',badge:'per',logs:{}},
    {id:g(),name:'Reduce alcohol',freq:'daily',badge:'per',logs:{}},
    {id:g(),name:'Skincare AM',freq:'daily',badge:'per',logs:{}},
    {id:g(),name:'Skincare PM',freq:'daily',badge:'per',logs:{}},
  ],
  workouts:[],gymTemplates:[
    {id:'tue-upper',name:'Tuesday — Full Upper Body',muscleGroups:['Chest','Back','Shoulders','Biceps','Triceps'],exercises:[{name:'Barbell Bench Press',sets:4,targetReps:'8-10',unit:'kg'},{name:'Seated Cable Row',sets:4,targetReps:'10-12',unit:'kg'},{name:'Incline Dumbbell Press',sets:3,targetReps:'10-12',unit:'kg'},{name:'Lat Pulldown',sets:3,targetReps:'10-12',unit:'kg'},{name:'Dumbbell Overhead Press',sets:3,targetReps:'10-12',unit:'kg'},{name:'Cable Tricep Pushdown',sets:3,targetReps:'12',unit:'kg'},{name:'Dumbbell Curl',sets:3,targetReps:'12',unit:'kg'}]},
    {id:'thu-lower',name:'Thursday — Lower Body',muscleGroups:['Quads','Hamstrings','Glutes','Core'],exercises:[{name:'Barbell Back Squat',sets:4,targetReps:'6-8',unit:'kg'},{name:'Romanian Deadlift',sets:4,targetReps:'8-10',unit:'kg'},{name:'Smith Machine Hip Thrust',sets:4,targetReps:'10-12',unit:'kg'},{name:'Leg Press',sets:3,targetReps:'12-15',unit:'kg'},{name:'Walking Dumbbell Lunge',sets:3,targetReps:'20 steps',unit:'kg'},{name:'Lying Leg Curl',sets:3,targetReps:'12',unit:'kg'},{name:'Plank',sets:3,targetReps:'40 sec',unit:'bw'}]},
  ],
  prs:{},
  income:[{id:'inc1',name:'Amazon - Salary',amount:2400,icon:'\ud83d\udcbc',note:'After tax'}],
  expenses:[
    {id:'exp1',name:'Rent Contribution',amount:300,icon:'\ud83c\udfe0',note:'',color:'#f9a8d4'},
    {id:'exp2',name:'Mum',amount:30,icon:'\ud83d\udc95',note:'',color:'#c084fc'},
    {id:'exp3',name:'Subscriptions',amount:40,icon:'\ud83d\udcfa',note:'Netflix, Disney+, ChatGPT',color:'#fb923c'},
    {id:'exp4',name:'Phone Finance',amount:59,icon:'\ud83d\udcf1',note:'Until December',color:'#818cf8'},
    {id:'exp5',name:'Car Insurance',amount:49,icon:'\ud83d\ude97',note:'',color:'#34d399'},
    {id:'exp6',name:'Travel to Work',amount:128,icon:'\ud83d\ude87',note:'',color:'#f59e0b'},
    {id:'exp7',name:'Gym',amount:35.99,icon:'\ud83c\udfcb\ufe0f',note:'',color:'#a0522d'},
    {id:'exp8',name:'Phone SIM',amount:11.80,icon:'\ud83d\udcde',note:'',color:'#2dd4bf'},
  ],
  accounts:[
    {id:'acc1',name:'Stocks and Shares ISA',type:'savings',balance:2400,color:'#a0522d',icon:'\ud83d\udcc8',institution:'Monzo'},
    {id:'acc2',name:'Lifetime ISA',type:'savings',balance:250,color:'#c9973a',icon:'\ud83c\udfe0',institution:'MoneyBox',target:4000,note:'House deposit'},
  ],
  debts:[
    {id:'dbt1',name:'Amex',balance:1200,priority:'High',color:'#f43f5e',note:''},
    {id:'dbt2',name:'PayPal',balance:257,priority:'Medium',color:'#fb7185',note:''},
    {id:'dbt3',name:'Capital One',balance:0,priority:'Low',color:'#fda4af',note:''},
    {id:'dbt4',name:'Capital One - Very',balance:35,priority:'Low',color:'#fda4af',note:''},
    {id:'dbt5',name:'118 118',balance:100,priority:'High',color:'#f43f5e',note:''},
    {id:'dbt6',name:'Very',balance:100,priority:'High',color:'#f43f5e',due:'2026-06-28',note:''},
    {id:'dbt7',name:'Monzo',balance:800,priority:'Low',color:'#fda4af',note:'Pay in 3'},
    {id:'dbt8',name:'Klarna',balance:100,priority:'Low',color:'#fda4af',note:'Auto Payments'},
    {id:'dbt9',name:'Chase',balance:3900,priority:'Medium',color:'#fb7185',note:''},
  ],
  savingsGoals:[
    {id:'sg1',name:'Emergency Fund',target:6000,current:0,priority:'Medium',icon:'\ud83d\udea8',color:'#f59e0b',deadline:'2027-06-01',note:'3 months expenses'},
    {id:'sg2',name:'House Deposit',target:15000,current:250,priority:'High',icon:'\ud83c\udfe0',color:'#34d399',deadline:'2027-12-31',note:'5% on \u00a3300k property'},
    {id:'sg3',name:'Thailand Trip',target:2000,current:0,priority:'High',icon:'\ud83c\udf34',color:'#5f9ea0',deadline:'2026-10-01',note:'Nov 29 anniversary'},
  ],
  metrics:{weight:[],bodyFat:[],steps:[],runs:[],moneySaved:[],projectsDone:[]},
  weeklyPlans:{},reviews:{monthly:{},quarterly:{}},
  journal:{},mood:{},dailyHighlights:{},
  projects:[
    {id:'prj1',name:'Thailand Trip Planning',status:'active',cat:'Personal',desc:'Anniversary trip \u2014 29 November 2026',deadline:'2026-11-01',tasks:[{id:'t4',text:'Set budget',done:false},{id:'t5',text:'Book flights',done:false},{id:'t6',text:'Book accommodation',done:false},{id:'t7',text:'Sort travel insurance',done:false}],color:'#6b9e7a'},
    {id:'prj2',name:'GitHub Portfolio',status:'active',cat:'Career',desc:'Build 2-3 public data projects before Oct 2026',deadline:'2026-10-01',tasks:[{id:'t8',text:'Create GitHub account',done:false},{id:'t9',text:'Publish first EDA project',done:false},{id:'t10',text:'Publish second project',done:false}],color:'#d4845a'},
  ],
  relationships:[
    {id:'rel1',name:'Dad',cat:'Family',freq:14,lastContact:'2026-03-01',note:'Visit bi-monthly',color:'#c9973a',icon:'\ud83d\udc68'},
    {id:'rel2',name:'Mum',cat:'Family',freq:7,lastContact:'2026-03-10',note:'Weekly call',color:'#d4845a',icon:'\ud83d\udc69'},
  ],
  gratitude:[],wishlist:[],
  watchlist:[
    {id:'w1',name:'Interstellar',type:'Movie',status:'want',note:'',rating:0,added:'2026-01-01'},
    {id:'w2',name:'The Bear',type:'Series',status:'watching',note:'Season 3',rating:0,added:'2026-01-01'},
  ],
  roadmapChecklist:{},
  debtPayments:[],
  plannedPayments:[],
};

var STATE = loadState() || JSON.parse(JSON.stringify(DEFAULT_STATE));


