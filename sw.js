// Service worker de la invitación: la guarda para que abra rápido y también sin internet.
// Si cambias algo en index.html, sube la versión (v1 -> v2) para que los celulares se actualicen.
const CACHE = "xv-rafaella-v1";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "cenicienta.mp3",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Safari pide el audio por partes (Range); hay que responder con 206 o la música no suena.
async function rangeResponse(req) {
  const hit = await caches.match(req.url);
  if (!hit) return fetch(req);
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  const start = m && m[1] ? parseInt(m[1], 10) : 0;
  const end = Math.min(m && m[2] ? parseInt(m[2], 10) : buf.byteLength - 1, buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206, statusText: "Partial Content",
    headers: {
      "Content-Type": hit.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": "bytes " + start + "-" + end + "/" + buf.byteLength,
      "Content-Length": String(end - start + 1),
    },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Letras de Google Fonts: red primero, y copia guardada si no hay internet.
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(req, c)); return r; })
        .catch(() => caches.match(req))
    );
    return;
  }
  if (req.headers.has("range")) { e.respondWith(rangeResponse(req)); return; }

  // La página: red primero (recibe los cambios) y copia guardada si no hay internet.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put("index.html", c)); return r; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
