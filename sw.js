// ============================================================
// Life Hub service worker — offline-first app shell (3.6)
// ============================================================
// Bump VERSION whenever the shell asset list changes. The versioned cache
// supersedes the ?v= query strings on the script/style tags in index.html
// (those are left in place — harmless). On activate, only stale Life Hub
// shell/runtime caches are deleted; unrelated origin caches are preserved.
var VERSION='v34';
var SHELL_PREFIX='lifehub-shell-';
var RUNTIME_PREFIX='lifehub-runtime-';
var CACHE=SHELL_PREFIX+VERSION;
var RUNTIME_CACHE=RUNTIME_PREFIX+VERSION;

// App shell — precached at install time. Paths are relative to the SW scope
// (/Life-Hub/), so they resolve to the deployed URLs. The ?v= query strings on
// the live tags are stripped by matching with {ignoreSearch:true} on fetch.
var SHELL=[
  './',
  'index.html',
  'manifest.json',
  'style-new.css',
  'icon-192.jpg',
  'icon-512.jpeg',
  'js/state.js',
  'js/persistence.js',
  'js/navigation.js',
  'js/dashboard.js',
  'js/habits.js',
  'js/workouts.js',
  'js/finance.js',
  'js/reviews.js',
  'js/relationships.js',
  'js/gratitude.js',
  'js/insights.js',
  'js/skincare.js',
  'js/modals.js',
  'js/planner.js',
  'js/init.js'
];

// Resolve shell entries to absolute pathnames for fast fetch-time matching.
var SHELL_PATHS=SHELL.map(function(p){return new URL(p,self.location).pathname});

// Precache entries independently so one temporary asset failure does not
// discard an otherwise usable offline shell.
self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return Promise.all(SHELL.map(function(asset){
        return cache.add(asset).catch(function(err){
          console.warn('Shell asset was not cached:',asset,err);
        });
      }));
    }).then(function(){return self.skipWaiting()})
  );
});

// Drop only stale Life Hub caches, leaving unrelated origin caches alone.
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        var owned=k.indexOf(SHELL_PREFIX)===0||k.indexOf(RUNTIME_PREFIX)===0;
        if(owned&&k!==CACHE&&k!==RUNTIME_CACHE)return caches.delete(k);
      }));
    }).then(function(){return self.clients.claim()})
  );
});

function isShellAsset(url){
  return SHELL_PATHS.indexOf(url.pathname)!==-1;
}

// Fetch strategy:
//   • Non-GET (POST etc.) → passthrough, never cached.
//   • Cross-origin (Firebase, Vercel, fonts, CDN) → passthrough, never cached.
//   • Same-origin shell assets → cache-first (ignoreSearch handles ?v=).
//   • Other same-origin GETs → network-first, cache as fallback.
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url;
  try{url=new URL(req.url)}catch(err){return}
  if(url.origin!==self.location.origin)return; // never touch cross-origin (Firebase/Vercel/etc.)

  if(isShellAsset(url)){
    e.respondWith(
      caches.open(CACHE).then(function(cache){
        return cache.match(req,{ignoreSearch:true}).then(function(cached){
          if(cached)return cached;
          return fetch(req).then(function(res){
            if(!res||!res.ok)return res;
            return cache.put(req,res.clone()).then(function(){return res},function(){return res});
          }).catch(function(){
            // Last resort for navigations — fall back to the cached shell.
            return cache.match('index.html',{ignoreSearch:true});
          });
        });
      })
    );
    return;
  }

  // Network-first for everything else same-origin, storing successful
  // responses in a dedicated runtime cache for reliable offline fallback.
  e.respondWith(
    fetch(req).then(function(res){
      if(!res||!res.ok)return res;
      var copy=res.clone();
      return caches.open(RUNTIME_CACHE).then(function(cache){
        return cache.put(req,copy);
      }).then(function(){return res},function(){return res});
    }).catch(function(){
      return caches.open(RUNTIME_CACHE).then(function(cache){
        return cache.match(req,{ignoreSearch:true});
      }).then(function(cached){
        if(cached)return cached;
        if(req.mode==='navigate'){
          return caches.open(CACHE).then(function(cache){return cache.match('index.html',{ignoreSearch:true})});
        }
        return Response.error();
      });
    })
  );
});

// Handle push notifications from the backend
self.addEventListener('push',function(e){
  var data={title:'Life Hub',body:'Reminder',icon:'/Life-Hub/icon-192.jpg'};
  try{data=e.data.json()}catch(err){}
  e.waitUntil(
    self.registration.showNotification(data.title,{
      body:data.body,
      icon:data.icon||'/Life-Hub/icon-192.jpg',
      badge:'/Life-Hub/icon-192.jpg',
      vibrate:[200,100,200]
    })
  );
});

// Open app when notification is tapped
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(function(list){
      for(var i=0;i<list.length;i++){
        if(list[i].url.indexOf('/')!==-1&&'focus' in list[i])return list[i].focus();
      }
      if(clients.openWindow)return clients.openWindow('/Life-Hub/');
    })
  );
});
