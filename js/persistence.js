// ============================================================
// REVISIONED DOMAIN PERSISTENCE
// ============================================================
var LIFEHUB_SCHEMA_VERSION=2;
var LIFEHUB_QUEUE_KEY='lifehub_sync_queue_v2';
var LIFEHUB_CONFLICT_KEY='lifehub_sync_conflicts_v2';
var LIFEHUB_META_KEY='lifehub_local_meta_v2';
var LIFEHUB_CLIENT_KEY='lifehub_client_id_v1';
var LIFEHUB_MAX_STATE_BYTES=4*1024*1024;
var LIFEHUB_MAX_DOMAIN_BYTES=700*1024;
var LIFEHUB_MAX_IMPORT_BYTES=5*1024*1024;
var _domainRevisions={};
var _domainExists={};
var _cloudData={};
var _localSnapshots={};
var _pendingDomains={};
var _syncConflicts={};
var _syncReady=false;
var _syncWriting=false;
var _domainSnapshotLoaded=false;
var _bootstrapDirtyDomains={};
var _capturedUndo=null;
var _undoRecord=null;
var _storageIssue=false;
var _storageMessage='';
var _cloudIssue='';
var _clientId=_loadClientId();

function _loadClientId(){
  try{var id=localStorage.getItem(LIFEHUB_CLIENT_KEY);if(id)return id;id='web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);localStorage.setItem(LIFEHUB_CLIENT_KEY,id);return id}catch(e){return 'web-session-'+Math.random().toString(36).slice(2,10)}
}
function _clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function _byteLength(value){var text=typeof value==='string'?value:JSON.stringify(value);try{return new Blob([text]).size}catch(e){return unescape(encodeURIComponent(text)).length}}
function _stable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(_stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+_stable(value[k])}).join(',')+'}'
}
function _same(a,b){return _stable(a)===_stable(b)}
function _validDomainName(name){return /^[A-Za-z_$][A-Za-z0-9_$-]{0,99}$/.test(name)&&name.indexOf('/')===-1&&name!=='__proto__'&&name!=='prototype'&&name!=='constructor'}
function _timestampText(value){try{if(value&&typeof value.toDate==='function')return value.toDate().toISOString();if(value)return new Date(value).toISOString()}catch(e){}return null}
function _domainKeys(state){return state&&typeof state==='object'?Object.keys(state).filter(_validDomainName):[]}

function validateLifeHubState(state,options){
  options=options||{};
  var errors=[];var nodes=0;var stringBytes=0;var dangerous=Object.create(null);dangerous.__proto__=true;dangerous.prototype=true;dangerous.constructor=true;
  var typeRules={goals:'array',habits:'array',workouts:'array',prs:'object',income:'array',expenses:'array',accounts:'array',debts:'array',savingsGoals:'array',metrics:'object',weeklyPlans:'object',reviews:'object',dailyPriorities:'object',trainingEvents:'array',journal:'object',mood:'object',dailyHighlights:'object',skincare:'object',tasks:'array',relationships:'array',gratitude:'array',wishlist:'array',watchlist:'array',roadmapChecklist:'object',debtPayments:'array',plannedPayments:'array',reminders:'array',water:'object',commitments:'array'};
  function add(path,message){if(errors.length<12)errors.push(path+': '+message)}
  function walk(value,path,depth){
    nodes++;if(nodes>100000){add(path,'too many values');return}if(depth>24){add(path,'nesting is too deep');return}
    if(value===null||typeof value==='boolean')return;
    if(typeof value==='number'){if(!Number.isFinite(value))add(path,'number must be finite');return}
    if(typeof value==='string'){
      stringBytes+=_byteLength(value);if(value.length>250000)add(path,'text value is too long');
      if(/^data:image\//i.test(value))add(path,'embedded images are not supported');
      if(options.importMode&&/(<\s*script\b|<\s*(iframe|object|embed)\b|javascript\s*:|on[a-z]+\s*=)/i.test(value))add(path,'executable markup is not allowed');
      return;
    }
    if(typeof value!=='object'){add(path,'unsupported value type');return}
    if(Array.isArray(value)){if(value.length>25000)add(path,'array is too large');for(var i=0;i<value.length;i++)walk(value[i],path+'['+i+']',depth+1);return}
    var proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null){add(path,'must be a plain object');return}
    var keys=Object.keys(value);if(keys.length>10000)add(path,'object has too many fields');
    keys.forEach(function(key){if(dangerous[key])add(path+'.'+key,'unsafe field name');else walk(value[key],path+'.'+key,depth+1)});
  }
  if(!state||typeof state!=='object'||Array.isArray(state))errors.push('state: must be an object');
  else{
    Object.keys(state).forEach(function(key){if(!_validDomainName(key))add('state.'+key,'invalid domain name')});
    Object.keys(typeRules).forEach(function(key){if(state[key]===undefined){if(options.requireCore)add('state.'+key,'required data area is missing');return}var expected=typeRules[key];var actual=Array.isArray(state[key])?'array':(state[key]===null?'null':typeof state[key]);if(actual!==expected)add('state.'+key,'expected '+expected)});
    if(options.requireCore&&state.trainingPlan===undefined)add('state.trainingPlan','required data area is missing');
    if(options.requireCore&&state.weeklyIntention===undefined)add('state.weeklyIntention','required data area is missing');
    if(state.trainingPlan!==undefined&&state.trainingPlan!==null&&(typeof state.trainingPlan!=='object'||Array.isArray(state.trainingPlan)))add('state.trainingPlan','expected object or null');
    if(state.weeklyIntention!==undefined&&state.weeklyIntention!==null&&(typeof state.weeklyIntention!=='object'||Array.isArray(state.weeklyIntention)))add('state.weeklyIntention','expected object or null');
    walk(state,'state',0);
  }
  if(stringBytes>LIFEHUB_MAX_STATE_BYTES)add('state','contains too much text');
  try{if(_byteLength(state)>LIFEHUB_MAX_STATE_BYTES)add('state','backup exceeds '+Math.round(LIFEHUB_MAX_STATE_BYTES/1048576)+' MB')}catch(e){add('state','could not be serialized')}
  if(state&&typeof state==='object')_domainKeys(state).forEach(function(key){try{if(_byteLength(state[key])>LIFEHUB_MAX_DOMAIN_BYTES)add('state.'+key,'domain exceeds '+Math.round(LIFEHUB_MAX_DOMAIN_BYTES/1024)+' KB')}catch(e){add('state.'+key,'could not be serialized')}});
  return {ok:errors.length===0,errors:errors};
}

function _ensureTrustBanner(){
  var el=document.getElementById('lifehub-data-notice');if(el)return el;
  el=document.createElement('div');el.id='lifehub-data-notice';el.className='data-trust-banner';el.setAttribute('role','status');el.style.display='none';
  var text=document.createElement('span');text.className='data-trust-message';el.appendChild(text);
  var action=document.createElement('button');action.type='button';action.className='btn btn-sm';action.style.display='none';el.appendChild(action);
  document.body.appendChild(el);return el;
}
function _showTrustNotice(message,actionLabel,actionFn){
  var el=_ensureTrustBanner();el.querySelector('.data-trust-message').textContent=message;
  var button=el.querySelector('button');button.style.display=actionLabel?'inline-flex':'none';button.textContent=actionLabel||'';button.onclick=actionFn||null;el.style.display='flex';
}
function _hideTrustNotice(){var el=document.getElementById('lifehub-data-notice');if(el)el.style.display='none'}
function _localMetadata(){return {schemaVersion:LIFEHUB_SCHEMA_VERSION,savedAt:new Date().toISOString(),clientId:_clientId,domainRevisions:_clone(_domainRevisions),domainExists:_clone(_domainExists)}}
function _persistRevisionMetadata(){try{localStorage.setItem(LIFEHUB_META_KEY,JSON.stringify(_localMetadata()));return true}catch(e){console.warn('Local sync metadata save failed:',e);return false}}
function _persistLocalState(){
  try{
    var raw=JSON.stringify(STATE);localStorage.setItem(KEY,raw);
    localStorage.setItem(LIFEHUB_META_KEY,JSON.stringify(_localMetadata()));
    _storageIssue=false;_storageMessage='';return true;
  }catch(e){console.error('Local state save failed:',e);_storageIssue=true;_storageMessage='This device could not save locally. Keep this tab open while storage is checked.';setSyncStatus('storage');_showTrustNotice(_storageMessage);return false}
}
function _persistQueue(){try{localStorage.setItem(LIFEHUB_QUEUE_KEY,JSON.stringify(_pendingDomains));return true}catch(e){console.warn('Sync queue could not be stored:',e);_storageIssue=true;_storageMessage='Changes are syncing from memory, but this device could not store the offline queue.';setSyncStatus('storage');_showTrustNotice(_storageMessage);return false}}
function _persistConflicts(){try{localStorage.setItem(LIFEHUB_CONFLICT_KEY,JSON.stringify(_syncConflicts))}catch(e){console.warn('Conflict details could not be stored:',e)}}
function _restorePersistenceMetadata(){
  try{var meta=JSON.parse(localStorage.getItem(LIFEHUB_META_KEY)||'{}');if(meta&&typeof meta==='object'){if(meta.domainRevisions&&typeof meta.domainRevisions==='object')_domainRevisions=meta.domainRevisions;if(meta.domainExists&&typeof meta.domainExists==='object')_domainExists=meta.domainExists}}catch(e){_domainRevisions={};_domainExists={}}
  try{var queued=JSON.parse(localStorage.getItem(LIFEHUB_QUEUE_KEY)||'{}');if(queued&&typeof queued==='object'&&!Array.isArray(queued))_pendingDomains=queued}catch(e){_pendingDomains={}}
  try{var conflicts=JSON.parse(localStorage.getItem(LIFEHUB_CONFLICT_KEY)||'{}');if(conflicts&&typeof conflicts==='object'&&!Array.isArray(conflicts))_syncConflicts=conflicts}catch(e){_syncConflicts={}}
}
_restorePersistenceMetadata();

function _queueDomain(domain,value,deleted,force){
  if(!_validDomainName(domain))return;
  var existing=_pendingDomains[domain];
  var item={domain:domain,data:deleted?null:_clone(value),deleted:!!deleted,baseRevision:existing?Number(existing.baseRevision||0):Number(_domainRevisions[domain]||0),queuedAt:new Date().toISOString(),clientId:_clientId};
  if(!force&&existing&&existing.deleted===item.deleted&&_same(existing.data,item.data))return;
  _pendingDomains[domain]=item;
}
function _changedDomains(previous,current,forceAll){
  var seen={};var changed=[];
  _domainKeys(previous).concat(_domainKeys(current)).forEach(function(key){if(seen[key])return;seen[key]=true;if(forceAll||!Object.prototype.hasOwnProperty.call(previous,key)||!Object.prototype.hasOwnProperty.call(current,key)||!_same(previous[key],current[key]))changed.push(key)});
  return changed;
}
function saveState(options){
  options=options||{};
  var validation=validateLifeHubState(STATE,{importMode:false});
  if(!validation.ok){console.error('State was not saved:',validation.errors);setSyncStatus('storage');_showTrustNotice('A data check stopped this save: '+validation.errors[0]);return false}
  var previous=_clone(_localSnapshots||{});
  var changed=_changedDomains(previous,STATE,!!options.forceAll);
  if(!_syncReady)changed.forEach(function(domain){_bootstrapDirtyDomains[domain]=true});
  _persistLocalState();
  if(_capturedUndo&&!options.suppressUndo&&changed.length){_undoRecord={label:_capturedUndo.label||options.undoLabel||'Change',state:_capturedUndo.state,createdAt:Date.now()};_capturedUndo=null;showUndoToast(_undoRecord.label)}else if(options.suppressUndo){_capturedUndo=null}
  _localSnapshots=_clone(STATE);
  if(!_syncReady||!_firebaseReady||!syncDoc||!_authUser)return true;
  changed.forEach(function(domain){var has=Object.prototype.hasOwnProperty.call(STATE,domain);_queueDomain(domain,STATE[domain],!has,!!options.forceAll)});
  _persistQueue();_updateSyncPresentation();_scheduleCloudFlush();return true;
}
function captureUndoSnapshot(label){_capturedUndo={label:label||'Deleted item',state:_clone(STATE)}}
function showUndoToast(label){
  var old=document.getElementById('lifehub-undo-toast');if(old)old.remove();
  var el=document.createElement('div');el.id='lifehub-undo-toast';el.className='undo-toast';el.setAttribute('role','status');
  var text=document.createElement('span');text.textContent=label+' saved';el.appendChild(text);
  var button=document.createElement('button');button.type='button';button.textContent='Undo';button.onclick=undoLastChange;el.appendChild(button);document.body.appendChild(el);
  setTimeout(function(){if(el.parentNode)el.remove()},7000);
}
function undoLastChange(){
  if(!_undoRecord)return;var record=_undoRecord;_undoRecord=null;var toast=document.getElementById('lifehub-undo-toast');if(toast)toast.remove();
  STATE=_clone(record.state);saveState({forceAll:true,suppressUndo:true});_rerenderCurrentPage();
  if(typeof showCelebrationToast==='function')showCelebrationToast('Restored previous data','↩️');
}
function _updateSyncPresentation(){
  var conflicts=Object.keys(_syncConflicts).length;var pending=Object.keys(_pendingDomains).length;
  var status=document.getElementById('sync-status');if(status){status.onclick=conflicts?openSyncReview:null;status.style.cursor=conflicts?'pointer':''}
  if(conflicts){setSyncStatus('conflict');_showTrustNotice(conflicts+' area'+(conflicts===1?'':'s')+' need'+(conflicts===1?'s':'')+' a sync choice.','Review sync',openSyncReview)}
  else if(_storageIssue){setSyncStatus('storage');_showTrustNotice(_storageMessage||'This device needs a storage check.')}
  else if(_cloudIssue){setSyncStatus('error');_showTrustNotice(_cloudIssue)}
  else if(pending){setSyncStatus(navigator.onLine?'saving':'queued');_hideTrustNotice()}
  else{setSyncStatus('saved');_hideTrustNotice();setTimeout(function(){if(!Object.keys(_pendingDomains).length&&!Object.keys(_syncConflicts).length)setSyncStatus('idle')},1800)}
}
function _scheduleCloudFlush(){if(!_syncReady)return;clearTimeout(_syncTimeout);_syncTimeout=setTimeout(function(){_syncTimeout=null;_flushPendingWrites()},700)}

function _recordConflict(domain,pending,remote){
  _syncConflicts[domain]={domain:domain,localData:_clone(pending.data),localDeleted:!!pending.deleted,localQueuedAt:pending.queuedAt||null,baseRevision:Number(pending.baseRevision||0),cloudData:remote.deleted?null:_clone(remote.data),cloudDeleted:!!remote.deleted,cloudRevision:Number(remote.revision||0),cloudUpdatedAt:remote.updatedAt||null};
  delete _pendingDomains[domain];_persistQueue();_persistConflicts();_updateSyncPresentation();
}
function _writeOneDomain(domain){
  var pending=_pendingDomains[domain];if(!pending||_syncConflicts[domain])return Promise.resolve();
  var ref=syncDoc.collection('domains').doc(domain);
  return db.runTransaction(function(tx){
    return tx.get(ref).then(function(snap){
      var remote=snap.exists?snap.data():{};var revision=Number(remote.revision||0);
      if(revision!==Number(pending.baseRevision||0))return {conflict:true,remote:{data:remote.data,deleted:!!remote.deleted,revision:revision,updatedAt:_timestampText(remote.updatedAt)}};
      tx.set(ref,{data:pending.deleted?null:pending.data,deleted:!!pending.deleted,revision:revision+1,schemaVersion:LIFEHUB_SCHEMA_VERSION,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:_clientId});
      return {conflict:false,revision:revision+1};
    });
  }).then(function(result){
    if(result&&result.conflict){_recordConflict(domain,_pendingDomains[domain]||pending,result.remote);return}
    _domainRevisions[domain]=result.revision;_domainExists[domain]=true;_persistRevisionMetadata();
    if(pending.deleted)delete _cloudData[domain];else _cloudData[domain]=_clone(pending.data);
    if(_pendingDomains[domain]!==pending){_pendingDomains[domain].baseRevision=result.revision;_persistQueue();return}
    delete _pendingDomains[domain];_persistQueue();
  });
}
function _flushPendingWrites(){
  if(_syncWriting||!_syncReady||!_firebaseReady||!db||!syncDoc||!_authUser)return Promise.resolve();
  var domains=Object.keys(_pendingDomains).filter(function(domain){return !_syncConflicts[domain]});if(!domains.length){_updateSyncPresentation();return Promise.resolve()}
  _syncWriting=true;setSyncStatus('saving');
  var chain=Promise.resolve();domains.forEach(function(domain){chain=chain.then(function(){return _writeOneDomain(domain)})});
  return chain.then(function(){
    return syncDoc.set({schemaVersion:LIFEHUB_SCHEMA_VERSION,domainStorage:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:_clientId},{merge:true}).catch(function(e){console.warn('Root sync metadata update failed:',e)});
  }).then(function(){_cloudIssue=''}).catch(function(e){console.warn('Domain sync paused:',e);_cloudIssue='Cloud sync is paused. Your changes remain queued on this device.';setSyncStatus(navigator.onLine?'error':'queued')}).then(function(){_syncWriting=false;_updateSyncPresentation();if(Object.keys(_pendingDomains).length&&navigator.onLine)setTimeout(_flushPendingWrites,4000)});
}
function _parseLegacyState(root){
  if(!root||!root.state)return null;
  try{var parsed=typeof root.state==='string'?JSON.parse(root.state):root.state;var result=validateLifeHubState(parsed,{importMode:false});return result.ok?parsed:null}catch(e){console.warn('Legacy cloud state could not be parsed:',e);return null}
}
function _applyDomain(target,domain,record){if(record.deleted)delete target[domain];else target[domain]=_clone(record.data)}
function loadFromCloud(onDone){
  var called=false;function done(){if(called)return;called=true;if(onDone)onDone()}
  var localCandidate=_clone(STATE);var localCheck=validateLifeHubState(localCandidate,{importMode:false});if(!localCheck.ok){console.warn('Local state failed validation:',localCheck.errors);localCandidate=_clone(DEFAULT_STATE);_showTrustNotice('Local data failed a safety check. A safe copy was loaded instead while cloud recovery is attempted.')}
  if(!_firebaseReady||!syncDoc){_cloudIssue='Cloud sync is unavailable. Changes will stay on this device.';STATE=localCandidate;_localSnapshots=_clone(STATE);setSyncStatus('error');done();return}
  _ensureSignedIn(function(user){
    if(!user){_cloudIssue='Sign in is required before cloud sync can resume.';STATE=localCandidate;_localSnapshots=_clone(STATE);done();return}
    var rootPromise=syncDoc.get().catch(function(e){console.warn('Legacy state load failed:',e);_cloudIssue='Cloud data could not be loaded. Changes remain local until sync recovers.';return null});
    var domainsPromise=syncDoc.collection('domains').get().catch(function(e){console.warn('Domain state load failed:',e);_cloudIssue='Cloud data could not be loaded. Changes remain local until sync recovers.';return null});
    Promise.all([rootPromise,domainsPromise]).then(function(results){
      var rootSnap=results[0];var query=results[1];_domainSnapshotLoaded=!!query;if(!query)throw new Error('Domain snapshot unavailable');var root=rootSnap&&rootSnap.exists?rootSnap.data():null;var legacy=_parseLegacyState(root);
      _lastCloudUpdatedAt=root?_timestampText(root.updatedAt):null;
      var cloudBase=_clone(legacy||localCandidate||DEFAULT_STATE);_domainRevisions={};_domainExists={};
      if(query)query.forEach(function(doc){var record=doc.data()||{};if(!_validDomainName(doc.id))return;_domainExists[doc.id]=true;_domainRevisions[doc.id]=Number(record.revision||0);_applyDomain(cloudBase,doc.id,record)});
      var effective=_clone(cloudBase);
      Object.keys(_pendingDomains).forEach(function(domain){var item=_pendingDomains[domain];_applyDomain(effective,domain,item)});
      Object.keys(_syncConflicts).forEach(function(domain){var conflict=_syncConflicts[domain];_applyDomain(effective,domain,{data:conflict.localData,deleted:conflict.localDeleted})});
      var check=validateLifeHubState(effective,{importMode:false});if(!check.ok)throw new Error('Combined cloud data failed validation: '+check.errors[0]);
      STATE=effective;_cloudData=_clone(cloudBase);_localSnapshots=_clone(effective);_persistLocalState();_updateSyncPresentation();done();
    }).catch(function(e){console.warn('Cloud bootstrap failed:',e);_cloudIssue='Cloud data could not be loaded. Changes remain local until sync recovers.';STATE=localCandidate;_localSnapshots=_clone(STATE);setSyncStatus('error');done()});
  });
}
function finishDataBootstrap(){
  Object.keys(DEFAULT_STATE||{}).forEach(function(domain){if(STATE[domain]===undefined)STATE[domain]=_clone(DEFAULT_STATE[domain])});
  _changedDomains(_localSnapshots,STATE,false).forEach(function(domain){_bootstrapDirtyDomains[domain]=true});
  var check=validateLifeHubState(STATE,{importMode:false,requireCore:true});if(!check.ok){setSyncStatus('storage');_showTrustNotice('Startup data check failed: '+check.errors[0]);return false}
  _persistLocalState();_syncReady=true;
  if(_firebaseReady&&syncDoc&&_authUser&&_domainSnapshotLoaded){
    var seen={};_domainKeys(_cloudData).concat(_domainKeys(STATE)).forEach(function(domain){if(seen[domain]||_syncConflicts[domain])return;seen[domain]=true;var has=Object.prototype.hasOwnProperty.call(STATE,domain);if(!_domainExists[domain]||!has||!_same(_cloudData[domain],STATE[domain]))_queueDomain(domain,STATE[domain],!has,false)});
    _persistQueue();
  }else if(_firebaseReady&&syncDoc&&_authUser){
    Object.keys(_bootstrapDirtyDomains).forEach(function(domain){var has=Object.prototype.hasOwnProperty.call(STATE,domain);_queueDomain(domain,STATE[domain],!has,false)});_persistQueue();
  }
  _bootstrapDirtyDomains={};
  _localSnapshots=_clone(STATE);_updateSyncPresentation();_scheduleCloudFlush();document.dispatchEvent(new CustomEvent('lifehub:ready'));return true;
}

function _rerenderCurrentPage(){
  try{var active=document.querySelector('.page.active');var page=active?active.id.replace(/^page-/,''):'planner';if(typeof renderPage==='function')renderPage(page);else if(typeof renderPlanner==='function')renderPlanner();if(typeof updateAppBadge==='function')updateAppBadge()}catch(e){console.warn('Re-render failed:',e)}
}
function _refreshFromCloud(){
  if(!_syncReady||!_firebaseReady||!syncDoc||!_authUser||_syncWriting)return;
  syncDoc.collection('domains').get().then(function(query){_cloudIssue='';var changed=false;query.forEach(function(doc){
    var domain=doc.id;if(!_validDomainName(domain))return;var record=doc.data()||{};var revision=Number(record.revision||0);if(revision<=Number(_domainRevisions[domain]||0))return;
    var pending=_pendingDomains[domain];if(pending){_domainRevisions[domain]=revision;_domainExists[domain]=true;_applyDomain(_cloudData,domain,record);if(Number(pending.baseRevision||0)!==revision)_recordConflict(domain,pending,{data:record.data,deleted:!!record.deleted,revision:revision,updatedAt:_timestampText(record.updatedAt)});return}
    if(_syncConflicts[domain])return;_domainRevisions[domain]=revision;_domainExists[domain]=true;_applyDomain(STATE,domain,record);_applyDomain(_cloudData,domain,record);changed=true;
  });_domainSnapshotLoaded=true;_domainKeys(STATE).forEach(function(domain){if(!_domainExists[domain]&&!_pendingDomains[domain]&&!_syncConflicts[domain])_queueDomain(domain,STATE[domain],false,false)});_persistQueue();if(changed){_localSnapshots=_clone(STATE);_persistLocalState();_rerenderCurrentPage()}_updateSyncPresentation();_scheduleCloudFlush()}).catch(function(e){console.warn('Cloud refresh failed:',e);_cloudIssue='Cloud refresh is paused. Local changes remain safe on this device.';_updateSyncPresentation()});
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)_refreshFromCloud()});
window.addEventListener('focus',_refreshFromCloud);
window.addEventListener('online',function(){_updateSyncPresentation();_flushPendingWrites();_refreshFromCloud()});
window.addEventListener('offline',_updateSyncPresentation);

function openSyncReview(){
  var modal=document.getElementById('modal');var content=document.getElementById('modal-content');if(!modal||!content)return;content.textContent='';
  var title=document.createElement('h2');title.textContent='Review sync choices';content.appendChild(title);
  var sub=document.createElement('div');sub.className='modal-sub';sub.textContent='Another device changed the same area. Choose which version to keep for each area.';content.appendChild(sub);
  var list=document.createElement('div');list.className='sync-conflict-list';content.appendChild(list);
  var domains=Object.keys(_syncConflicts);domains.forEach(function(domain){var item=_syncConflicts[domain];var row=document.createElement('section');row.className='sync-conflict-item';
    var name=document.createElement('strong');name.textContent=domain.replace(/^__/,'').replace(/([A-Z])/g,' $1');row.appendChild(name);
    var detail=document.createElement('div');detail.className='sync-conflict-meta';detail.textContent='This device started at revision '+item.baseRevision+'; synced version is revision '+item.cloudRevision+'.';row.appendChild(detail);
    var actions=document.createElement('div');actions.className='sync-conflict-actions';
    var keep=document.createElement('button');keep.type='button';keep.className='btn btn-sm btn-accent';keep.textContent='Keep this device';keep.onclick=function(){resolveSyncConflict(domain,'local')};actions.appendChild(keep);
    var cloud=document.createElement('button');cloud.type='button';cloud.className='btn btn-sm';cloud.textContent='Use synced version';cloud.onclick=function(){resolveSyncConflict(domain,'cloud')};actions.appendChild(cloud);row.appendChild(actions);list.appendChild(row);
  });
  if(!domains.length){var empty=document.createElement('p');empty.textContent='No sync choices are waiting.';list.appendChild(empty)}
  var footer=document.createElement('div');footer.className='modal-btns';var close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Close';close.onclick=function(){if(typeof closeModal==='function')closeModal();else modal.style.display='none'};footer.appendChild(close);content.appendChild(footer);modal.style.display='flex';
}
function resolveSyncConflict(domain,choice){
  var item=_syncConflicts[domain];if(!item)return;
  if(choice==='cloud'){
    _applyDomain(STATE,domain,{data:item.cloudData,deleted:item.cloudDeleted});_applyDomain(_cloudData,domain,{data:item.cloudData,deleted:item.cloudDeleted});_domainRevisions[domain]=item.cloudRevision;_domainExists[domain]=true;delete _syncConflicts[domain];_localSnapshots=_clone(STATE);_persistLocalState();_persistConflicts();_rerenderCurrentPage();_updateSyncPresentation();openSyncReview();return;
  }
  _domainRevisions[domain]=item.cloudRevision;_domainExists[domain]=true;_applyDomain(_cloudData,domain,{data:item.cloudData,deleted:item.cloudDeleted});
  _pendingDomains[domain]={domain:domain,data:_clone(item.localData),deleted:!!item.localDeleted,baseRevision:item.cloudRevision,queuedAt:new Date().toISOString(),clientId:_clientId};delete _syncConflicts[domain];_persistConflicts();_persistQueue();_updateSyncPresentation();openSyncReview();_flushPendingWrites();
}

function _downloadJson(payload,name){var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},0)}
function downloadLifeHubBackup(prefix){
  var check=validateLifeHubState(STATE,{importMode:false});if(!check.ok)throw new Error(check.errors[0]);
  var payload={version:2,schemaVersion:LIFEHUB_SCHEMA_VERSION,exportedAt:new Date().toISOString(),state:_clone(STATE),domainRevisions:_clone(_domainRevisions)};
  var date=typeof localDateKey==='function'?localDateKey(new Date()):new Date().toISOString().slice(0,10);_downloadJson(payload,(prefix||'life-hub-backup')+'-'+date+'.json');if(!prefix&&typeof showCelebrationToast==='function')showCelebrationToast('Backup saved','📥');return payload;
}
function importLifeHubBackup(){
  var input=document.getElementById('import-file');if(!input||!input.files||!input.files[0])return;var file=input.files[0];if(file.size>LIFEHUB_MAX_IMPORT_BYTES){alert('Import failed: backup is larger than 5 MB.');return}
  var reader=new FileReader();reader.onload=function(event){try{
    var parsed=JSON.parse(event.target.result);var version=Number(parsed.version||1);if(!Number.isInteger(version)||version<1)throw new Error('Invalid backup version.');if(version>2)throw new Error('This backup was created by a newer Life Hub version.');if(!parsed.state)throw new Error('Invalid Life Hub backup.');
    var imported=_clone(parsed.state);Object.keys(DEFAULT_STATE||{}).forEach(function(domain){if(imported[domain]===undefined)imported[domain]=_clone(DEFAULT_STATE[domain])});
    var check=validateLifeHubState(imported,{importMode:true,requireCore:true});if(!check.ok)throw new Error(check.errors[0]);
    var changed=_changedDomains(STATE,imported,false);var summary='This backup will replace '+changed.length+' data area'+(changed.length===1?'':'s')+'. A copy of your current data will download first. Continue?';if(!confirm(summary))return;
    downloadLifeHubBackup('life-hub-pre-import');captureUndoSnapshot('Imported backup');STATE=imported;if(!saveState({forceAll:true,undoLabel:'Imported backup'}))throw new Error('The imported data could not be saved.');
    if(typeof closeModal==='function')closeModal();_rerenderCurrentPage();if(typeof showCelebrationToast==='function')showCelebrationToast('Backup imported and queued for sync','📤');
  }catch(e){alert('Import failed: '+e.message)}};reader.onerror=function(){alert('Import failed: the file could not be read.')};reader.readAsText(file);
}
