// todo: better to use with svelteKit

/// <reference lib="WebWorker" />
import {version, name} from '../package.json'

const cacheName = `${version}::${name}`;

// Files to cache
const appShellFiles = [
  '/',
  '/public/index.html',
  '/public/global.css',
  '/public/build/bundle.js',
  '/public/build/bundle.css',
  '/public/icons/logo_128.png',
];

// Installing Service Worker
self.addEventListener('install', (e: ExtendableEvent) => {
  console.info('[Service Worker] Install');
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    console.info('[Service Worker] Caching all: app shell and content');
    await cache.addAll(appShellFiles);
  })());
});

self.addEventListener('activate', (e: ExtendableEvent) => {
  e.waitUntil(caches.keys().then((keyList) => {
    return Promise.all(keyList.map((key) => {
      if (key === cacheName) { return; }
      return caches.delete(key);
    }))
  }));
});

// Fetching content using Service Worker
self.addEventListener('fetch', (e: FetchEvent) => {
  e.respondWith((async () => {
    const r = await caches.match(e.request);
    console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
    if (r) return r;
    const response = await fetch(e.request);
    const cache = await caches.open(cacheName);
    console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
    cache.put(e.request, response.clone());
    return response;
  })());
});
