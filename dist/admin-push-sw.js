'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 let url=new URL('/admin.html',self.location.origin);try{const target=new URL(payload.url||url.href);if(target.origin===self.location.origin&&target.pathname==='/admin.html')url=target;}catch{}
 event.waitUntil(self.registration.showNotification(payload.title||'Color Win Admin',{
 body:payload.body||'A new request is ready for review.',icon:'/assets/icons/admin-push-192.png',badge:'/assets/icons/admin-push-badge.png',tag:payload.tag||'cw-admin',renotify:false,requireInteraction:true,vibrate:[180,80,180],data:{url:url.href},actions:[{action:'review',title:'Review request'}]
 }));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL(event.notification.data?.url||'/admin.html',self.location.origin);if(url.origin!==self.location.origin||url.pathname!=='/admin.html')return;const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const tab of tabs){if(new URL(tab.url).pathname==='/admin.html'){await tab.navigate(url.href);return tab.focus();}}return self.clients.openWindow(url.href);})());});
