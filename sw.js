// Service Worker Ultra-Optimisé pour Performance
const CACHE_NAME = 'couponsplanet-perf-v2.0';
const STATIC_CACHE = 'couponsplanet-static-v2.0';
const DYNAMIC_CACHE = 'couponsplanet-dynamic-v2.0';

// Assets critiques à cacher immédiatement
const CRITICAL_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// Assets secondaires (chargés en arrière-plan)
const SECONDARY_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Installation ultra-rapide
self.addEventListener('install', event => {
    console.log('🚀 SW Ultra-Perf: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📦 Caching critical assets');
                return cache.addAll(CRITICAL_ASSETS);
            })
            .then(() => {
                console.log('✅ Critical assets cached');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ SW installation failed:', error);
            })
    );
});

// Activation rapide
self.addEventListener('activate', event => {
    console.log('⚡ SW Ultra-Perf: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Nettoyer les anciens caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Prendre le contrôle immédiatement
            self.clients.claim(),
            // Précharger les assets secondaires en arrière-plan
            preloadSecondaryAssets()
        ])
    );
});

// Préchargement en arrière-plan
async function preloadSecondaryAssets() {
    try {
        const cache = await caches.open(STATIC_CACHE);
        
        // Charger les assets secondaires sans bloquer
        SECONDARY_ASSETS.forEach(url => {
            fetch(url).then(response => {
                if (response.ok) {
                    cache.put(url, response);
                }
            }).catch(() => {
                // Ignore errors for secondary assets
            });
        });
        
        console.log('📦 Secondary assets preloading started');
    } catch (error) {
        console.warn('Secondary assets preload failed:', error);
    }
}

// Stratégies de cache ultra-optimisées
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') return;
    
    // Ignorer certaines URLs
    if (url.pathname.includes('analytics') || 
        url.pathname.includes('tracking') ||
        url.hostname.includes('google-analytics')) {
        return;
    }
    
    // Stratégie selon le type de ressource
    if (isMainDocument(request)) {
        event.respondWith(fastDocumentStrategy(request));
    } else if (isStaticAsset(request)) {
        event.respondWith(ultraCacheFirstStrategy(request));
    } else if (isAPIRequest(request)) {
        event.respondWith(networkFirstStrategy(request));
    } else {
        event.respondWith(standardFetch(request));
    }
});

// Détection du type de ressource
function isMainDocument(request) {
    return request.mode === 'navigate' || 
           request.destination === 'document' ||
           request.url.endsWith('.html') ||
           request.url.endsWith('/');
}

function isStaticAsset(request) {
    const url = request.url;
    return url.includes('.js') || 
           url.includes('.css') || 
           url.includes('cdn.jsdelivr.net') ||
           url.includes('manifest.json');
}

function isAPIRequest(request) {
    return request.url.includes('supabase.co');
}

// Stratégie ultra-rapide pour les documents
async function fastDocumentStrategy(request) {
    try {
        // Essayer le cache d'abord pour vitesse maximale
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('⚡ Instant cache hit for document');
            
            // Mettre à jour en arrière-plan
            fetch(request).then(response => {
                if (response.ok) {
                    cache.put(request, response.clone());
                }
            }).catch(() => {});
            
            return cachedResponse;
        }
        
        // Sinon fetch avec timeout rapide
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const networkResponse = await fetch(request, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('🌐 Document strategy fallback');
        
        // Fallback vers cache existant ou page offline
        const cache = await caches.open(STATIC_CACHE);
        const fallback = await cache.match('./index.html');
        
        if (fallback) {
            return fallback;
        }
        
        // Page offline minimale
        return new Response(getOfflinePage(), {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Stratégie cache-first ultra-optimisée
async function ultraCacheFirstStrategy(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('📦 Ultra cache hit');
            return cachedResponse;
        }
        
        console.log('🌐 Fetching static asset');
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok && networkResponse.status < 400) {
            // Clone pour éviter les problèmes de stream
            const responseToCache = networkResponse.clone();
            
            // Cache asynchrone pour ne pas bloquer
            cache.put(request, responseToCache).catch(() => {});
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Static asset failed:', error);
        
        // Pour JS/CSS critiques, retourner une version vide pour éviter les erreurs
        if (request.url.includes('.js')) {
            return new Response('console.log("Fallback JS");', {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        if (request.url.includes('.css')) {
            return new Response('/* Fallback CSS */', {
                headers: { 'Content-Type': 'text/css' }
            });
        }
        
        return new Response('Offline', { status: 503 });
    }
}

// Stratégie network-first pour APIs
async function networkFirstStrategy(request) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const networkResponse = await fetch(request, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (networkResponse.ok) {
            // Cache les réponses API réussies
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone()).catch(() => {});
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('API fallback to cache');
        
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            // Ajouter header pour indiquer que c'est du cache
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Cache-Status', 'stale');
            
            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: headers
            });
        }
        
        // Fallback API response
        return new Response(JSON.stringify({
            error: 'Network unavailable',
            offline: true,
            cached: false
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Fetch standard pour autres ressources
async function standardFetch(request) {
    try {
        return await fetch(request);
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

// Page offline minimale
function getOfflinePage() {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - CouponsPlanet</title>
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
        .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            max-width: 400px;
        }
        h1 { font-size: 2.5rem; margin-bottom: 20px; }
        p { font-size: 1.1rem; margin-bottom: 30px; line-height: 1.6; }
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
    <div class="container">
        <h1>🌐 Mode Hors Ligne</h1>
        <p>Vous êtes actuellement hors ligne. L'application utilisera les données en cache disponibles.</p>
        <button onclick="location.reload()">🔄 Réessayer</button>
    </div>
</body>
</html>`;
}

// Nettoyage automatique du cache
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_CLEANUP') {
        cleanupCache();
    }
});

async function cleanupCache() {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 heures
        
        const cleanupPromises = requests.map(async request => {
            const response = await cache.match(request);
            const dateHeader = response?.headers.get('date');
            
            if (dateHeader) {
                const responseDate = new Date(dateHeader).getTime();
                if (now - responseDate > maxAge) {
                    await cache.delete(request);
                    console.log('🗑️ Cleaned old cache entry');
                }
            }
        });
        
        await Promise.all(cleanupPromises);
        console.log('✅ Cache cleanup completed');
        
    } catch (error) {
        console.error('Cache cleanup failed:', error);
    }
}

// Auto-cleanup périodique
setInterval(() => {
    cleanupCache();
}, 60 * 60 * 1000); // Chaque heure

console.log('🚀 SW Ultra-Performance v2.0 loaded and ready!');