// ============================================================
// Life Hub service worker — offline-first app shell (3.6)
// ============================================================
// Bump VERSION whenever the shell asset list changes. The versioned cache
// supersedes the ?v= query strings on the script/style tags in index.html
// (those are left in place — harmless). On activate, any cache whose name
// doesn't match the current version is deleted.
var VERSION='v19';
var CACHE='lifehub-shell-'+VERSION;

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

// Precache the app shell. cache.addAll fetches each entry fresh.
self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){return cache.addAll(SHELL)})
      .then(function(){return self.skipWaiting()})
  );
});

// Drop stale caches from previous versions, then take control.
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k!==CACHE)return caches.delete(k);
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
      caches.match(req,{ignoreSearch:true}).then(function(cached){
        return cached||fetch(req).then(function(res){
          if(res&&res.ok){
            var copy=res.clone();
            caches.open(CACHE).then(function(cache){cache.put(req,copy)});
          }
          return res;
        }).catch(function(){
          // Last resort for navigations — fall back to the cached shell.
          return caches.match('index.html',{ignoreSearch:true});
        });
      })
    );
    return;
  }

  // Network-first for everything else same-origin.
  e.respondWith(
    fetch(req).catch(function(){return caches.match(req,{ignoreSearch:true})})
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
