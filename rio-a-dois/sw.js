// Service worker do Rio a dois: app inteiro offline + cache dos mapas e do clima.
const VERSION = '760bbeaddd';
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./app.js", "./css/app.css", "./vendor/leaflet.js", "./vendor/leaflet.css", "./fonts/cormorant-garamond-latin-500-italic.woff2", "./fonts/cormorant-garamond-latin-500-normal.woff2", "./fonts/cormorant-garamond-latin-600-normal.woff2", "./fonts/jost-latin-400-normal.woff2", "./fonts/jost-latin-500-normal.woff2", "./fonts/jost-latin-600-normal.woff2", "./icons/apple-touch-icon.png", "./icons/favicon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];
const IMAGES = ["./img/ai_aconchego.webp", "./img/ai_cervantes.webp", "./img/ai_emporio_jardim.webp", "./img/ai_leblon_dias_ferreira.webp", "./img/ai_parque_lage_cafe.webp", "./img/ai_r_academia.webp", "./img/ai_r_armazemsenado.webp", "./img/ai_r_artigiano.webp", "./img/ai_r_bipbip.webp", "./img/ai_r_braseiro.webp", "./img/ai_r_brava.webp", "./img/ai_r_brota.webp", "./img/ai_r_casa201.webp", "./img/ai_r_colombo_forte.webp", "./img/ai_r_cosmopolita.webp", "./img/ai_r_dheaven.webp", "./img/ai_r_didier.webp", "./img/ai_r_garotaurca.webp", "./img/ai_r_jojo.webp", "./img/ai_r_koral.webp", "./img/ai_r_labuta.webp", "./img/ai_r_lasai.webp", "./img/ai_r_lilia.webp", "./img/ai_r_mariaboi.webp", "./img/ai_r_miam.webp", "./img/ai_r_mineiro.webp", "./img/ai_r_novacapela.webp", "./img/ai_r_olympe.webp", "./img/ai_r_oro.webp", "./img/ai_r_oseille.webp", "./img/ai_r_oteque.webp", "./img/ai_r_pachecoleao.webp", "./img/ai_r_perola.webp", "./img/ai_r_pici.webp", "./img/ai_r_riominho.webp", "./img/ai_r_sanomakase.webp", "./img/ai_r_saothiago.webp", "./img/ai_r_sats.webp", "./img/ai_r_sult.webp", "./img/ai_r_talho.webp", "./img/albamar.webp", "./img/amanha.webp", "./img/aprazivel.webp", "./img/arpoador.webp", "./img/beco.webp", "./img/bondinho.webp", "./img/capa.webp", "./img/catedral.webp", "./img/ccbb.webp", "./img/colombo.webp", "./img/cristo.webp", "./img/d1.webp", "./img/d2.webp", "./img/d3.webp", "./img/d4.webp", "./img/d5.webp", "./img/donamarta.webp", "./img/gabinete.webp", "./img/hotel.webp", "./img/ilhafiscal.webp", "./img/ipanema.webp", "./img/jardim.webp", "./img/lapa.webp", "./img/leme.webp", "./img/mar.webp", "./img/mureta.webp", "./img/p_casa_cave.webp", "./img/p_espaco_marinha.webp", "./img/p_etnias.webp", "./img/p_galeao.webp", "./img/p_jardim_botanico.webp", "./img/p_maracana.webp", "./img/p_mureta_urca.webp", "./img/p_museu_imagens.webp", "./img/p_r_acai.webp", "./img/p_r_amarelinho.webp", "./img/p_r_cobal.webp", "./img/p_r_lamas.webp", "./img/p_r_mee.webp", "./img/p_selaron.webp", "./img/p_trem_corcovado.webp", "./img/pedradosal.webp", "./img/pista.webp", "./img/x_bonde.webp", "./img/x_forte.webp", "./img/x_ims.webp", "./img/x_lagoa.webp", "./img/x_niteroi.webp", "./img/x_paqueta.webp", "./img/x_pequenaafrica.webp", "./img/x_pracaxv.webp", "./img/x_prainha.webp", "./img/x_saobento.webp", "./img/x_theatro.webp", "./img/x_vistachinesa.webp"];
const CORE_CACHE = 'rio-core-' + VERSION;
const IMG_CACHE = 'rio-img-v1';
const TILE_CACHE = 'rio-tiles-v1';
const API_CACHE = 'rio-api-v1';
const MAX_TILES = 5000;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE_CACHE);
    await c.addAll(CORE);
    // imagens do guia: em segundo plano, sem travar a instalação
    const ic = await caches.open(IMG_CACHE);
    await Promise.all(IMAGES.map(async u => { if (!(await ic.match(u))) { try { await ic.add(u); } catch {} } }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('rio-core-') && k !== CORE_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await c.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mapas do OpenStreetMap: cache primeiro, guarda tudo o que já foi visto
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      const hit = await c.match(req.url);
      if (hit) return hit;
      try {
        const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
        if (res.ok) { c.put(req.url, res.clone()); if (Math.random() < 0.05) trimTiles(); }
        return res;
      } catch { return new Response('', { status: 504 }); }
    })());
    return;
  }

  // Clima: rede primeiro, cópia guardada para usar offline
  if (url.hostname === 'api.open-meteo.com') {
    e.respondWith((async () => {
      const c = await caches.open(API_CACHE);
      try { const res = await fetch(req); if (res.ok) c.put(req.url.split('&_=')[0], res.clone()); return res; }
      catch { return (await c.match(req.url.split('&_=')[0])) || new Response('{}', { headers: { 'content-type': 'application/json' } }); }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // sincronização sempre pela rede

  // Navegação: devolve o app guardado, atualiza em segundo plano
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CORE_CACHE);
      const cached = await c.match('./index.html') || await c.match('./');
      const net = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      return cached || (await net) || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // Demais arquivos do app: cache primeiro
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname.includes('/img/')) (await caches.open(IMG_CACHE)).put(req, res.clone());
      return res;
    } catch { return new Response('', { status: 504 }); }
  })());
});

// Notificações (extra): tocar abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list[0] ? list[0].focus() : self.clients.openWindow('./index.html#hoje')));
});
