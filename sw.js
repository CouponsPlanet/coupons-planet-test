// Service Worker pour CouponsPlanet - GitHub Pages Ready
const CACHE_NAME = 'couponsplanet-v1.3';
const STATIC_CACHE = 'couponsplanet-static-v1.3';
const DYNAMIC_CACHE = 'couponsplanet-dynamic-v1.3';

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// URLs à ne pas mettre en cache
const EXCLUDE_PATTERNS = [
    /chrome-extension/,
    /localhost:\d+/,
    /127\.0\.0\.1/,
    /analytics/,
    /gtag/,
    /facebook\.net/,
    /doubleclick\.net/
];

// Installation du Service Worker
self.addEventListener('install', event => {
    console.log('🔧 Service Worker: Installing v1.3...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📦 Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker: Static assets cached');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Service Worker: Installation failed', error);
            })
    );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
    console.log('✅ Service Worker: Activating v1.3...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Supprimer les anciens caches
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('🗑️ Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('🚀 Service Worker: Activated and ready!');
                return self.clients.claim();
            })
    );
});

// Interception des requêtes avec stratégies optimisées
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer certaines URLs (analytics, extensions, etc.)
    if (EXCLUDE_PATTERNS.some(pattern => pattern.test(request.url))) {
        return;
    }
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Stratégie différente selon le type de ressource
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request));
    } else if (isAPIRequest(request)) {
        event.respondWith(networkFirstWithFallback(request));
    } else if (isImageRequest(request)) {
        event.respondWith(cacheFirstImage(request));
    } else if (request.mode === 'navigate') {
        event.respondWith(networkFirstWithHTMLFallback(request));
    } else {
        event.respondWith(networkFirst(request));
    }
});

// Vérifications de type de ressource
function isStaticAsset(request) {
    const url = request.url;
    return url.includes('.css') || 
           url.includes('.js') || 
           url.includes('cdn.jsdelivr.net') ||
           url.includes('fonts.googleapis.com') ||
           url.includes('manifest.json');
}

function isAPIRequest(request) {
    return request.url.includes('supabase.co');
}

function isImageRequest(request) {
    return request.destination === 'image' ||
           request.url.includes('.jpg') ||
           request.url.includes('.jpeg') ||
           request.url.includes('.png') ||
           request.url.includes('.gif') ||
           request.url.includes('.webp') ||
           request.url.includes('.svg') ||
           request.url.includes('.ico');
}

// Stratégie Cache First (pour les assets statiques)
async function cacheFirst(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('📦 Cache hit (static):', request.url.split('/').pop());
            return cachedResponse;
        }
        
        console.log('🌐 Fetching (static):', request.url.split('/').pop());
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok && networkResponse.status < 400) {
            const responseClone = networkResponse.clone();
            cache.put(request, responseClone);
        }
        
        return networkResponse;
    } catch (error) {
        console.error('❌ Cache first failed:', error);
        return new Response('Service Unavailable', { 
            status: 503,
            statusText: 'Service Worker Cache Error'
        });
    }
}

// Stratégie Network First (pour les APIs et données dynamiques)
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok && networkResponse.status < 400) {
            const cache = await caches.open(DYNAMIC_CACHE);
            
            // Mettre en cache seulement les GET requests réussies
            if (request.method === 'GET') {
                const responseClone = networkResponse.clone();
                cache.put(request, responseClone);
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.log('🌐 Network failed, trying cache for:', request.url.split('?')[0].split('/').pop());
        
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('📦 Cache fallback hit');
            return cachedResponse;
        }
        
        console.error('❌ Network first fallback failed');
        return new Response('Offline - No cached version available', { 
            status: 503,
            statusText: 'Service Worker Network Error'
        });
    }
}

// Stratégie Network First avec fallback riche pour APIs
async function networkFirstWithFallback(request) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const networkResponse = await fetch(request, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            const responseClone = networkResponse.clone();
            
            // Cache API responses with TTL info in headers
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cached-at', Date.now().toString());
            
            const responseWithHeaders = new Response(responseClone.body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
            });
            
            cache.put(request, responseWithHeaders);
        }
        
        return networkResponse;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⏱️ Request timeout, trying cache');
        } else {
            console.log('🌐 Network failed, trying cache for API');
        }
        
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            // Check cache age
            const cachedAt = cachedResponse.headers.get('sw-cached-at');
            const cacheAge = cachedAt ? Date.now() - parseInt(cachedAt) : 0;
            const maxAge = 5 * 60 * 1000; // 5 minutes for API cache
            
            if (cacheAge < maxAge) {
                console.log('📦 Fresh cache hit for API');
                return cachedResponse;
            } else {
                console.log('🕐 Cache expired but using anyway (offline)');
                // Add header to indicate stale cache
                const headers = new Headers(cachedResponse.headers);
                headers.set('sw-cache-status', 'stale');
                
                return new Response(cachedResponse.body, {
                    status: cachedResponse.status,
                    statusText: cachedResponse.statusText,
                    headers: headers
                });
            }
        }
        
        // Return structured offline response for API calls
        return new Response(JSON.stringify({
            error: 'Network unavailable',
            message: 'Please check your internet connection',
            offline: true
        }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json',
                'sw-fallback': 'offline-api'
            }
        });
    }
}

// Stratégie pour les pages HTML avec fallback
async function networkFirstWithHTMLFallback(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('🌐 Page request failed, trying cache');
        
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback to index.html for SPA navigation
        const indexFallback = await cache.match('./index.html');
        if (indexFallback) {
            return indexFallback;
        }
        
        // Last resort: basic offline page
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Offline - CouponsPlanet</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                    }
                    .offline-container {
                        background: rgba(255,255,255,0.1);
                        padding: 40px;
                        border-radius: 20px;
                        backdrop-filter: blur(10px);
                    }
                    h1 { font-size: 3rem; margin-bottom: 20px; }
                    p { font-size: 1.2rem; margin-bottom: 30px; }
                    button {
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 25px;
                        font-size: 1rem;
                        font-weight: bold;
                        cursor: pointer;
                        transition: transform 0.3s ease;
                    }
                    button:hover { transform: translateY(-2px); }
                </style>
            </head>
            <body>
                <div class="offline-container">
                    <h1>🌐 Hors ligne</h1>
                    <p>Impossible de se connecter à Internet.<br>Veuillez vérifier votre connexion.</p>
                    <button onclick="location.reload()">🔄 Réessayer</button>
                </div>
            </body>
            </html>
        `, {
            status: 503,
            headers: {
                'Content-Type': 'text/html',
                'sw-fallback': 'offline-page'
            }
        });
    }
}

// Stratégie optimisée pour les images avec compression
async function cacheFirstImage(request) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Mettre en cache seulement les images < 2MB
            const contentLength = networkResponse.headers.get('content-length');
            const maxSize = 2 * 1024 * 1024; // 2MB
            
            if (!contentLength || parseInt(contentLength) < maxSize) {
                cache.put(request, networkResponse.clone());
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.error('❌ Image loading failed:', error);
        
        // Retourner une image placeholder SVG en cas d'échec
        const placeholderSVG = `
            <svg width="55" height="55" xmlns="http://www.w3.org/2000/svg">
                <rect width="55" height="55" fill="#f0f0f0" stroke="#ddd" stroke-width="1"/>
                <text x="27.5" y="32" text-anchor="middle" fill="#999" font-size="12" font-family="Arial">
                    IMG
                </text>
            </svg>
        `;
        
        return new Response(placeholderSVG, {
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'no-cache',
                'sw-fallback': 'placeholder-image'
            }
        });
    }
}

// Gestion des messages du client
self.addEventListener('message', event => {
    const { type, action } = event.data || {};
    
    switch (type) {
        case 'CLEAR_CACHE':
            event.waitUntil(clearAllCaches());
            break;
            
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_STATUS':
            event.waitUntil(getCacheStatus().then(status => {
                event.ports[0].postMessage(status);
            }));
            break;
            
        case 'PREFETCH_IMAGES':
            if (event.data.urls) {
                event.waitUntil(prefetchImages(event.data.urls));
            }
            break;
    }
});

// Fonctions utilitaires
async function clearAllCaches() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('🗑️ All caches cleared');
    } catch (error) {
        console.error('❌ Error clearing caches:', error);
    }
}

async function getCacheStatus() {
    try {
        const cacheNames = await caches.keys();
        const status = {
            caches: cacheNames.length,
            version: CACHE_NAME
        };
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            status[cacheName] = keys.length;
        }
        
        return status;
    } catch (error) {
        return { error: error.message };
    }
}

async function prefetchImages(urls) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const promises = urls.slice(0, 10).map(async url => { // Limite à 10 images
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            } catch (error) {
                console.warn('Failed to prefetch image:', url);
            }
        });
        
        await Promise.all(promises);
        console.log(`📷 Prefetched ${urls.length} images`);
    } catch (error) {
        console.error('❌ Image prefetch failed:', error);
    }
}

// Background Sync pour les actions en mode offline
self.addEventListener('sync', event => {
    console.log('🔄 Background sync triggered:', event.tag);
    
    switch (event.tag) {
        case 'background-sync':
            event.waitUntil(doBackgroundSync());
            break;
        case 'cache-cleanup':
            event.waitUntil(cleanupOldCaches());
            break;
    }
});

async function doBackgroundSync() {
    try {
        console.log('📡 Performing background sync...');
        // Ici on peut ajouter la logique pour synchroniser
        // les données mises en queue quand l'utilisateur était offline
        
        // Exemple: nettoyer les vieux caches
        await cleanupOldCaches();
        
        // Notifier les clients que la sync est terminée
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC_COMPLETE',
                timestamp: Date.now()
            });
        });
        
    } catch (error) {
        console.error('❌ Background sync failed:', error);
    }
}

async function cleanupOldCaches() {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 heures
        
        const deletePromises = requests.map(async request => {
            const response = await cache.match(request);
            const cachedAt = response?.headers.get('sw-cached-at');
            
            if (cachedAt && (now - parseInt(cachedAt)) > maxAge) {
                console.log('🗑️ Deleting old cache entry:', request.url.split('/').pop());
                return cache.delete(request);
            }
        });
        
        await Promise.all(deletePromises);
        console.log('✅ Cache cleanup completed');
    } catch (error) {
        console.error('❌ Cache cleanup failed:', error);
    }
}

// Notification de mise à jour disponible
self.addEventListener('install', () => {
    // Notifier les clients qu'une mise à jour est disponible
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'UPDATE_AVAILABLE',
                message: 'Une nouvelle version est disponible',
                version: CACHE_NAME
            });
        });
    });
});

// Gestion des erreurs globales
self.addEventListener('error', event => {
    console.error('❌ Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('❌ Service Worker unhandled rejection:', event.reason);
});

console.log('🚀 Service Worker v1.3 loaded and ready for GitHub Pages!');