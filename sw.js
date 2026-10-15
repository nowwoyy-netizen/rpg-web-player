// Serves imported game files from IndexedDB under <scope>/game/<id>/...
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open('rpgweb', 1);
  r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('files', { keyPath: 'key' }); d.createObjectStore('games', { keyPath: 'id' }); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const get = async k => { const d = await open(); return new Promise(res => { const q = d.transaction('files').objectStore('files').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
const MIME = { html: 'text/html', js: 'text/javascript', json: 'application/json', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain' };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const base = new URL(self.registration.scope).pathname + 'game/';
  if (u.origin !== location.origin || !u.pathname.startsWith(base)) return;
  e.respondWith((async () => {
    const rest = decodeURIComponent(u.pathname.slice(base.length));
    const rec = await get(rest);
    if (!rec) return new Response('Not found: ' + rest, { status: 404 });
    const ext = rest.split('.').pop().toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    if (ext === 'html') {
      // Prefix localStorage keys per game so saves from different games don't collide
      const id = rest.split('/')[0];
      const inj = `<script>(()=>{const p=${JSON.stringify(id + ':')},S=Storage.prototype,g=S.getItem,s=S.setItem,r=S.removeItem;S.getItem=function(k){return this===localStorage?g.call(this,p+k):g.call(this,k)};S.setItem=function(k,v){return this===localStorage?s.call(this,p+k,v):s.call(this,k,v)};S.removeItem=function(k){return this===localStorage?r.call(this,p+k):r.call(this,k)}})()<\/script>`;
      const t = (await rec.blob.text()).replace(/<head[^>]*>/i, m => m + inj);
      return new Response(t, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const rg = e.request.headers.get('Range');
    if (rg) {
      const m = /bytes=(\d*)-(\d*)/.exec(rg), b = rec.blob;
      const s = +m[1] || 0, en = m[2] ? +m[2] + 1 : b.size;
      return new Response(b.slice(s, en), { status: 206, headers: { 'Content-Type': type, 'Content-Range': `bytes ${s}-${en - 1}/${b.size}`, 'Accept-Ranges': 'bytes' } });
    }
    return new Response(rec.blob, { headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes' } });
  })());
});
