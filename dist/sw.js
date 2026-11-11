const CACHE_NAME = 'workout-pwa-cloud-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/models.js',
  '/js/components/icons.js',
  '/js/services/supabaseClient.js',
  '/js/services/audioService.js',
  '/js/services/benchmarkService.js',
  '/js/services/storageService.js',
  '/js/services/timerService.js',
  '/js/screens/dashboard.js',
  '/js/screens/routineManager.js',
  '/js/screens/liveWorkout.js',
  '/js/screens/history.js'
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
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Requisições de API para o Supabase passam direto pela rede (o fallback é gerenciado pelo IndexedDB)
  if (url.hostname.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  // Estratégia Stale-While-Revalidate para o App Shell e SDK CDN
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
