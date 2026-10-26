/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Seccion_Imagen_Script.html
ESPEJO GITHUB:   github/js/Seccion_Imagen_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Todo lo relacionado con imágenes:
                 · Helpers de URL (Drive → lh3, normalización).
                 · Normalización del array de capturas.
                 · Carrusel compacto centrado con dots (patrón
                   Instagram).
                 · Lightbox fullscreen sobre <dialog> nativo:
                   pinch zoom anclado al midpoint, doble tap,
                   pan de un dedo, swipe-down para cerrar y
                   cierre al tocar el fondo.
                 Los estilos viven en Seccion_CSS.
                 Expone window.SeccionImagen.
VERSIÓN:         1.4.0
CAMBIOS:         R128: la X del lightbox sale del registro (data-glifo close) y se pinta al construir el diálogo. El CSS .lightbox-close svg sigue mandando.
CAMBIOS:         R94: L2 PROPIA DE LAS IMÁGENES — el cache HTTP del
                 navegador no siempre conserva las fotos (en el
                 teléfono cada visita al mismo post volvía a
                 bajarlas: parecía que no se guardaba nada).
                 poblarConL2 alimenta cada imagen del hero:
                 la 1ª vez la descarga y la guarda en Cache API
                 (servy-img-v1, tope 40, recorte de la más vieja);
                 a partir de ahí pinta desde DISCO sin tocar la
                 red (blob), aunque el navegador tire su cache
                 HTTP. La clave usa el ID de la foto de Drive (no
                 la URL completa) para sobrevivir a URLs que
                 cambian. Sin Cache API o ante cualquier fallo
                 (CORS, cuota): la imagen carga por su URL de
                 siempre. El lightbox pasa por la misma L2.
                 R92: PESO DE LA IMAGEN — urlImagenDirecta pide
                 ahora las fotos de Drive a lh3 con =w1600 (las
                 /d/ crudas sirven el archivo a tamaño completo,
                 fotos de varios MB: por eso la imagen tardaba en
                 aparecer la primera vez). 1600px cubre el hero
                 del teléfono con 2-4x de densidad y el lightbox;
                 la descarga baja de megas a cientos de KB. Si la
                 URL ya trae su propio =tamaño se respeta; las
                 que no son de Drive pasan intactas.
                 R77.1: El método enganchar() ahora también
                 detecta la clase .post-hero-img para que el
                 Lightbox funcione en el nuevo lienzo del post.
DEPENDENCIAS:    Seccion_CSS.html (clases carrusel-*),
                 Seccion_Imagen_CSS.html (clases lightbox-*)
════════════════════════════════════════════════════════════════════*/


  window.SeccionImagen = (function () {

    var MAX_CAPTURAS = 3;

    /* ============================================================
       HELPERS · URLs de imágenes
       ============================================================ */

    /* R92 · PESO DE LA IMAGEN: lh3 sirve las /d/ a tamaño
       completo (fotos de varios MB — la causa de la carga lenta
       la primera vez). Con =w1600 Google la reescala al vuelo:
       el hero mide ≤430px y el lightbox cae bien a 1600. Si la
       URL ya trae su propio =tamaño, se respeta. */
    function _conTamanoLh3(url) {
      if (url.indexOf('lh3.googleusercontent.com/d/') === -1) return url;
      if (/=[wsh]\d+/.test(url)) return url;
      return url + '=w1600';
    }

    function urlImagenDirecta(url) {
      var u = String(url || '').trim();
      if (!u) return '';

      var m = u.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
      if (m && m[1]) return _conTamanoLh3('https://lh3.googleusercontent.com/d/' + m[1]);

      m = u.match(/drive\.google\.com\/open\?id=([^&]+)/);
      if (m && m[1]) return _conTamanoLh3('https://lh3.googleusercontent.com/d/' + m[1]);

      m = u.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
      if (m && m[1]) return _conTamanoLh3('https://lh3.googleusercontent.com/d/' + m[1]);

      return u;
    }

    /* ============================================================
       R94 · L2 PROPIA DE IMÁGENES — el cache HTTP del navegador
       no siempre conserva las fotos (el teléfono volvía a bajar
       la misma imagen en cada visita al post). La app guarda SU
       copia en Cache API: la 1ª vez baja la foto y la guarda;
       después la pinta desde disco SIN red. Clave = ID de la
       foto de Drive (no la URL completa); cualquier otra URL
       se guarda ENTERA (sin el #), nunca recortada por query:
       fotos distintas, entradas distintas. Tope 40 entradas
       (se recorta la más vieja). Sin Cache API o ante cualquier
       fallo: la imagen carga por su URL de siempre, como hasta
       hoy.
       ============================================================ */
    var NOMBRE_L2 = 'servy-img-v1';
    var MAX_L2    = 40;
    var _blobURLs = (typeof WeakMap === 'function') ? new WeakMap() : null;

    function _claveL2(url) {
      var u = String(url || '').trim();
      var m = u.match(/googleusercontent\.com\/d\/([^\/\?#=]+)/);
      if (m && m[1]) return 'https://servy-img.local/' + m[1];
      m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*?id=)([^&\/?]+)/);
      if (m && m[1]) return 'https://servy-img.local/' + m[1];
      /* Resto: la URL COMPLETA (sin el #). NO se corta el query:
         dos URLs que solo difieren en query son fotos distintas
         (p.ej. carrusel con urls por imagen) y jamás deben
         compartir entrada. */
      return 'https://servy-img.local/u/' + u.split('#')[0];
    }

    function _recortarL2(cache) {
      cache.keys().then(function (claves) {
        if (claves.length <= MAX_L2) return;
        Promise.all(claves.map(function (c) {
          return cache.match(c).then(function (r) {
            return { clave: c, t: (r ? (Number(r.headers.get('x-guardado')) || 0) : 0) };
          });
        })).then(function (lista) {
          lista.sort(function (a, b) { return a.t - b.t; });
          var sobran = lista.length - MAX_L2;
          for (var i = 0; i < sobran; i++) cache.delete(lista[i].clave);
        }).catch(function () {});
      }).catch(function () {});
    }

    function _asignarBlob(img, blob) {
      var u = URL.createObjectURL(blob);
      if (_blobURLs) {
        var previo = _blobURLs.get(img);
        if (previo) { try { URL.revokeObjectURL(previo); } catch (e) {} }
        _blobURLs.set(img, u);
      }
      img.src = u;
    }

    function poblarConL2(img, url) {
      url = String(url || '').trim();
      if (!img || !url) return;

      /* Sin Cache API (o contexto sin storage): la <img> carga
         por su URL de siempre — el comportamiento de siempre. */
      if (!(window.caches && typeof window.caches.open === 'function')) {
        img.src = url;
        return;
      }

      window.caches.open(NOMBRE_L2).then(function (cache) {
        /* Que el sistema no despache fácil este storage. */
        if (navigator.storage && navigator.storage.persist) {
          try { navigator.storage.persist(); } catch (e) {}
        }
        var clave = _claveL2(url);
        return cache.match(clave).then(function (hit) {
          if (hit) return hit.blob().then(function (b) { _asignarBlob(img, b); });
          return fetch(url, { credentials: 'omit' }).then(function (resp) {
            if (!resp || !resp.ok || !resp.blob) { img.src = url; return null; }
            return resp.blob().then(function (b) {
              _asignarBlob(img, b);
              try {
                var copia = new Response(b, {
                  headers: {
                    'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
                    'x-guardado': String(Date.now())
                  }
                });
                cache.put(new Request(clave), copia).then(function () { _recortarL2(cache); }).catch(function () {});
              } catch (e) {}
            });
          });
        });
      }).catch(function () {
        /* CORS, cuota o lo que sea: la URL de siempre. */
        try { img.src = url; } catch (e2) {}
      });
    }

    function capturasDePresentacion(sp) {
      var lista = [];

      if (sp && Array.isArray(sp.capturas) && sp.capturas.length) {
        lista = sp.capturas;
      } else if (sp && sp.urlCaptura) {
        lista = [sp.urlCaptura];
      }

      return lista
        .map(function (u) { return String(u || '').trim(); })
        .filter(function (u) { return !!u; })
        .slice(0, MAX_CAPTURAS);
    }

    /* ============================================================
       LIGHTBOX · visor fullscreen sobre <dialog> nativo.
       ============================================================ */
    var Lightbox = (function () {

      var ESCALA_MIN          = 1;
      var ESCALA_MAX          = 4;
      var UMBRAL_DOBLE_TAP_MS = 280;
      var UMBRAL_DOBLE_TAP_PX = 30;
      var UMBRAL_MOVIMIENTO   = 6;
      var UMBRAL_SWIPE_CERRAR = 80;
      var DURACION_CIERRE_MS  = 220;

      var dlg = null;
      var backdrop = null;
      var img = null;
      var abierto = false;

      var pointers = {};
      var pointerCount = 0;

      var escala = 1;
      var tx = 0;
      var ty = 0;

      var pinchDistIni   = 0;
      var pinchEscalaIni = 1;
      var pinchMidIniX   = 0;
      var pinchMidIniY   = 0;
      var pinchTxIni     = 0;
      var pinchTyIni     = 0;

      var panInicioX = 0;
      var panInicioY = 0;
      var panTxInicio = 0;
      var panTyInicio = 0;

      var swipeInicioY = 0;
      var swipeEnProgreso = false;

      var movimientoTotal = 0;

      var ultimoTapTiempo = 0;
      var ultimoTapX = 0;
      var ultimoTapY = 0;

      function centro() {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }

      function construir() {
        if (dlg) return;

        dlg = document.createElement('dialog');
        dlg.className = 'lightbox';
        dlg.innerHTML =
          '<div class="lightbox-backdrop"></div>' +
          '<button type="button" class="lightbox-close" aria-label="Cerrar" data-glifo="close"></button>' +
          '<img class="lightbox-img" alt="">';

        document.body.appendChild(dlg);

        /* R128 · la X del lightbox sale del registro (close). */
        if (typeof window.pintarGlifos === 'function') {
          window.pintarGlifos(dlg);
        }

        backdrop = dlg.querySelector('.lightbox-backdrop');
        img      = dlg.querySelector('.lightbox-img');

        dlg.querySelector('.lightbox-close').addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          cerrar();
        });

        dlg.addEventListener('pointerdown',   onPointerDown);
        dlg.addEventListener('pointermove',   onPointerMove);
        dlg.addEventListener('pointerup',     onPointerUp);
        dlg.addEventListener('pointercancel', onPointerCancel);

        dlg.addEventListener('cancel', function (e) {
          e.preventDefault();
          cerrar();
        });

        window.addEventListener('resize', function () {
          if (!abierto) return;
          resetTransform();
        });
      }

      function aplicarTransform() {
        img.style.transform =
          'translate(' + tx + 'px, ' + ty + 'px) scale(' + escala + ')';
      }

      function resetTransform() {
        escala = 1;
        tx = 0;
        ty = 0;
        img.style.transform = '';
      }

      function limitarPan() {
        if (escala <= 1) {
          tx = 0;
          ty = 0;
          return;
        }
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var wEscalada = img.clientWidth  * escala;
        var hEscalada = img.clientHeight * escala;

        var maxTx = Math.max(0, (wEscalada - vw) / 2);
        var maxTy = Math.max(0, (hEscalada - vh) / 2);

        tx = Math.max(-maxTx, Math.min(maxTx, tx));
        ty = Math.max(-maxTy, Math.min(maxTy, ty));
      }

      function onPointerDown(e) {
        if (!abierto) return;

        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        pointerCount = Object.keys(pointers).length;

        if (pointerCount === 1) {
          panInicioX = e.clientX;
          panInicioY = e.clientY;
          panTxInicio = tx;
          panTyInicio = ty;

          swipeInicioY = e.clientY;
          swipeEnProgreso = false;
          movimientoTotal = 0;

        } else if (pointerCount === 2) {
          swipeEnProgreso = false;
          var ids = Object.keys(pointers);
          var p1 = pointers[ids[0]];
          var p2 = pointers[ids[1]];
          pinchDistIni   = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          pinchEscalaIni = escala;
          pinchMidIniX   = (p1.x + p2.x) / 2;
          pinchMidIniY   = (p1.y + p2.y) / 2;
          pinchTxIni     = tx;
          pinchTyIni     = ty;
        }
      }

      function onPointerMove(e) {
        if (!pointers[e.pointerId]) return;
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

        if (pointerCount === 2) {
          var ids = Object.keys(pointers);
          var p1 = pointers[ids[0]];
          var p2 = pointers[ids[1]];
          var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          var midX = (p1.x + p2.x) / 2;
          var midY = (p1.y + p2.y) / 2;

          if (pinchDistIni > 0) {
            var factor = dist / pinchDistIni;
            var nueva  = pinchEscalaIni * factor;
            nueva = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, nueva));

            var C = centro();
            var ratio = nueva / pinchEscalaIni;

            tx = midX - C.x - (pinchMidIniX - C.x - pinchTxIni) * ratio;
            ty = midY - C.y - (pinchMidIniY - C.y - pinchTyIni) * ratio;

            escala = nueva;
            limitarPan();
            aplicarTransform();
          }
          movimientoTotal += 20;
          return;
        }

        if (pointerCount === 1) {
          var dx = e.clientX - panInicioX;
          var dy = e.clientY - panInicioY;
          movimientoTotal = Math.max(movimientoTotal, Math.hypot(dx, dy));

          if (escala > 1) {
            tx = panTxInicio + dx;
            ty = panTyInicio + dy;
            limitarPan();
            aplicarTransform();
            return;
          }

          if (dy > 0) {
            swipeEnProgreso = true;
            var offset = Math.min(dy * 0.5, 60);
            img.style.transform = 'translate(0, ' + offset + 'px) scale(1)';
          }
        }
      }

      function onPointerUp(e) {
        if (!pointers[e.pointerId]) return;

        delete pointers[e.pointerId];
        var countAntes = pointerCount;
        pointerCount = Object.keys(pointers).length;

        if (countAntes === 2 && pointerCount === 1) {
          var ids = Object.keys(pointers);
          var resto = pointers[ids[0]];
          panInicioX = resto.x;
          panInicioY = resto.y;
          panTxInicio = tx;
          panTyInicio = ty;
          swipeEnProgreso = false;
          return;
        }

        if (pointerCount > 0) return;

        if (swipeEnProgreso && escala === 1) {
          var dy = e.clientY - swipeInicioY;
          if (dy > UMBRAL_SWIPE_CERRAR) {
            cerrar();
            return;
          }
        }

        if (swipeEnProgreso) {
          aplicarTransform();
          swipeEnProgreso = false;
        }

        if (movimientoTotal < UMBRAL_MOVIMIENTO) {
          procesarTap(e);
        }
        movimientoTotal = 0;
      }

      function onPointerCancel(e) {
        if (!pointers[e.pointerId]) return;
        delete pointers[e.pointerId];
        pointerCount = Object.keys(pointers).length;

        if (pointerCount === 1) {
          var ids = Object.keys(pointers);
          var resto = pointers[ids[0]];
          panInicioX = resto.x;
          panInicioY = resto.y;
          panTxInicio = tx;
          panTyInicio = ty;
        }
        if (pointerCount === 0) {
          if (swipeEnProgreso) {
            aplicarTransform();
            swipeEnProgreso = false;
          }
          movimientoTotal = 0;
        }
      }

      function procesarTap(e) {
        var ahora = Date.now();
        var dt = ahora - ultimoTapTiempo;
        var dx = Math.abs(e.clientX - ultimoTapX);
        var dy = Math.abs(e.clientY - ultimoTapY);

        var esDobleTap = (dt < UMBRAL_DOBLE_TAP_MS) &&
                         (dx < UMBRAL_DOBLE_TAP_PX) &&
                         (dy < UMBRAL_DOBLE_TAP_PX);

        ultimoTapTiempo = ahora;
        ultimoTapX = e.clientX;
        ultimoTapY = e.clientY;

        var esSobreImagen = (e.target === img);

        if (esDobleTap && esSobreImagen) {
          if (escala > 1) {
            resetTransform();
          } else {
            var C = centro();
            escala = 2;
            tx = C.x - e.clientX;
            ty = C.y - e.clientY;
            limitarPan();
            aplicarTransform();
          }
          ultimoTapTiempo = 0;
          return;
        }

        if (e.target === backdrop && escala === 1) {
          cerrar();
        }
      }

      function abrir(url) {
        construir();
        if (!dlg || !url) return;

        resetTransform();
        pointers = {};
        pointerCount = 0;
        swipeEnProgreso = false;
        movimientoTotal = 0;
        ultimoTapTiempo = 0;

        /* R94: la L2 propia también alimenta el lightbox. */
        poblarConL2(img, url);

        if (typeof dlg.showModal === 'function' && !dlg.open) {
          try { dlg.showModal(); } catch (err) { dlg.setAttribute('open', ''); }
        } else {
          dlg.setAttribute('open', '');
        }
        document.body.classList.add('lightbox-abierto');
        abierto = true;

        requestAnimationFrame(function () {
          dlg.classList.add('visible');
        });
      }

      function cerrar() {
        if (!abierto) return;
        abierto = false;

        dlg.classList.remove('visible');
        document.body.classList.remove('lightbox-abierto');

        setTimeout(function () {
          try {
            if (dlg.open) dlg.close();
            else dlg.removeAttribute('open');
          } catch (err) { dlg.removeAttribute('open'); }
          img.src = '';
          resetTransform();
        }, DURACION_CIERRE_MS);
      }

      return { abrir: abrir, cerrar: cerrar };
    })();

    /* ============================================================
       ENGANCHE · carrusel (dots) + click en imágenes
       ============================================================ */
    function enganchar(root) {
      if (!root) return;

      root.querySelectorAll('.carrusel-presentacion').forEach(function (carrusel) {
        var track = carrusel.querySelector('.carrusel-track');
        var dots  = carrusel.querySelectorAll('.carrusel-dot');
        if (!track || !dots.length) return;

        var raf = null;
        track.addEventListener('scroll', function () {
          if (raf) return;
          raf = requestAnimationFrame(function () {
            raf = null;
            var w = track.clientWidth;
            if (!w) return;
            var idx = Math.round(track.scrollLeft / w);
            dots.forEach(function (d, i) {
              d.classList.toggle('activo', i === idx);
            });
          });
        }, { passive: true });
      });

      // R77.1: Se incluye .post-hero-img para el nuevo hero 1:1
      root.querySelectorAll('.foto-sola img, .carrusel-slide img, .post-hero-img').forEach(function (img) {
        if (img.dataset.lightboxEnganchado === '1') return;
        img.dataset.lightboxEnganchado = '1';

        img.addEventListener('click', function () {
          var full = this.getAttribute('data-full') || this.src;
          if (full) Lightbox.abrir(full);
        });
      });
    }

    /* ============================================================
       API PÚBLICA
       ============================================================ */
    return {
      urlImagenDirecta:       urlImagenDirecta,
      capturasDePresentacion: capturasDePresentacion,
      poblarConL2:            poblarConL2,
      enganchar:              enganchar
    };

  })();
