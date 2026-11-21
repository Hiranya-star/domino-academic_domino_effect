const CACHE_NAME = 'domino-v3-cache';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Menangani Fetch Offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Menerima sinyal Push / Background Message saat aplikasi ditutup
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'DOMINO Teror Guru', body: 'Ada tugas penting!' };
  
  const options = {
    body: data.body,
    icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Crect width=\'512\' height=\'512\' rx=\'112\' fill=\'%230f172a\'/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Crect width=\'512\' height=\'512\' rx=\'112\' fill=\'%230f172a\'/%3E%3C/svg%3E',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'domino-teacher-terror',
    renotify: true,
    requireInteraction: true // Membuat notifikasi pop-up tetap melayang di layar sampai di-klik user
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Aksi ketika notifikasi di-klik oleh pengguna
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
