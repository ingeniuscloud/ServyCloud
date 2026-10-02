/*
* ══════════════════════════════════════════════════════════════
* ARCHIVO:         sw.js (service worker del envoltorio GitHub Pages)
* PROYECTO:        ServyCloud | Envoltorio de app única (GitHub Pages)
* RESPONSABILIDAD: Service worker mínimo de PASO PURO: solo registra
*                  los listeners que Chrome exige para considerar la
*                  página INSTALABLE (botón "Instalar app" del
*                  envoltorio). NO guarda nada en caché: todas las
*                  peticiones siguen su curso normal, así la app de
*                  GAS (ServyCloud) y sus actualizaciones nunca
*                  quedan viejas.
* VERSIÓN:         1.1
* CAMBIOS:         R63 (el envoltorio pasa a APP ÚNICA: ServyCloud.
*                  Este worker NO cambia su lógica: sigue siendo paso
*                  puro; solo se actualiza el encabezado a la
*                  identidad ServyCloud).
*                  R59 (nace con el botón "Instalar app" del
*                  envoltorio v1.5).
* DEPENDENCIAS:    Vive en la MISMA carpeta del repositorio que
*                  index.html, manifest.json, icon-192.png e
*                  icon-512.png. Se registra desde el envoltorio con
*                  navigator.serviceWorker.register('./sw.js').
* ══════════════════════════════════════════════════════════════
*/

// Al instalarme, tomo el control de la página enseguida (sin esperar
// a que el usuario cierre y reabra la pestaña).
self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
    evento.waitUntil(self.clients.claim());
});

// Listener de fetch requerido por Chrome para la instalabilidad.
// Deliberadamente NO llama a respondWith ni usa caches: cada petición
// (incluido el iframe de GAS) va a la red tal cual, sin
// interferencias. Sin este listener, Chrome no ofrecería instalar.
self.addEventListener('fetch', function () {
    // Paso puro: sin caché, sin intercepción.
});
