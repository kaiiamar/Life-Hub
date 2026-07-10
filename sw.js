var CACHE='lifehub-v1';
self.addEventListener('install',function(e){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(clients.claim())});
self.addEventListener('fetch',function(e){e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request)}))});

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
