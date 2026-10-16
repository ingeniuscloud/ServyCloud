/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Core_Script.html
ESPEJO GITHUB:   js/Core_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Núcleo de la página. El CTA decide entre abrir
                 WhatsApp o el sheet de reserva.
                 CacheL2: persistencia del catálogo y de los
                 detalles en localStorage del dispositivo. La
                 reapertura de la app pinta AL INSTANTE desde disco
                 y la red valida por detrás (stale-while-revalidate:
                 las mismas peticiones que antes, 0 cuotas nuevas).
                 Arranque en orden original:
                   1. cargarTablas() (POST · todos los posts)
                   2. Cuando llega → inyectarLienzo() →
                      arrancarComponentes() con datos ya cargados
                 Primer arranque sin ciudad:
                   · POST arranca en paralelo con el sheet.
                   · Cuando el usuario elige, repintar SINCRÓNICO
                     si los datos ya llegaron. Si NO llegaron,
                     mostrar skeleton de lista y esperar.
                 Cambio de ciudad posterior:
                   · Repintar sincrónico. Instantáneo.
VERSIÓN:         1.10
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Global_Script.html (postBackend), Index.html
                 (#canvas-content, SISTEMA, TABLAS, TOKEN, URL_EXEC),
                 Telefono.html (#lienzo), Ciudad_Sheet_Script.html,
                 Chips_Script.html, Buscar_Script.html,
                 Promo_Script.html, Social_Script.html,
                 Global_Menu_Script.html (window.Global), Lista_Script.html,
                 Seccion_Script.html, Comenta_Script.html,
                 Compartir_Script.html (recibir/pintar)
════════════════════════════════════════════════════════════════════*/

  /* ============================================================
     CACHEL2 · capa del dispositivo (R21 · Propuesta 1 del dueño)
     La sesión ya tenía L1 en memoria (PostFull._cache). L2
     persiste en localStorage del contexto de la app: al reabrir
     la app el contenido sale del DISCO al instante y la red
     valida por detrás. Costo en cuotas: CERO (las peticiones
     son las mismas que hoy, ni una más). Si el storage del
     iframe no persiste o está lleno, todo degrada en silencio
     al comportamiento de v1.6.
     ============================================================ */
  window.CacheL2 = (function () {
    var K_CAT       = 'sv_l2_catalogo';
    var K_IDX       = 'sv_l2_posts_idx';
    var K_POST      = 'sv_l2_post_';
    var MAX_POSTS   = 30;                          /* tope LRU de posts persistidos */
    var TTL_MS      = 7 * 24 * 60 * 60 * 1000;     /* vencimiento duro: 7 días */
    var ENV_VERSION = 1;

    function _valido(env, requiereSecciones) {
      if (!env || env.v !== ENV_VERSION) return false;
      if (!env.data || typeof env.data !== 'object') return false;
      if (typeof env.ts !== 'number') return false;
      if (Date.now() - env.ts > TTL_MS) return false;
      if (requiereSecciones && !env.data.seccionJson) return false;
      return true;
    }

    function _envuelto(data) {
      return { v: ENV_VERSION, ts: Date.now(), data: data };
    }

    /* Devuelve { data, raw } o null. raw = serialización canónica
       del catálogo para comparar barato tras la revalidación. */
    function leerCatalogo() {
      try {
        var raw = localStorage.getItem(K_CAT);
        if (!raw) return null;
        var env = JSON.parse(raw);
        if (!_valido(env, false)) return null;
        if (!Array.isArray(env.data.posts) ||
            !Array.isArray(env.data.partners)) return null;
        return { data: env.data, raw: JSON.stringify(env.data) };
      } catch (_) { return null; }
    }

    /* Guarda el catálogo y devuelve su serialización canónica
       (para la comparación de la revalidación). */
    function guardarCatalogo(data) {
      if (!data || !Array.isArray(data.posts) ||
          !Array.isArray(data.partners)) return null;
      var raw = JSON.stringify(data);
      try {
        localStorage.setItem(K_CAT, JSON.stringify(_envuelto(data)));
      } catch (_) {}
      return raw;
    }

    function leerPost(idPost) {
      try {
        var clave = K_POST + String(idPost);
        var raw = localStorage.getItem(clave);
        if (!raw) return null;
        var env = JSON.parse(raw);
        if (!_valido(env, true)) {
          try { localStorage.removeItem(clave); } catch (_) {}
          return null;
        }
        return env.data;
      } catch (_) { return null; }
    }

    function guardarPost(idPost, det) {
      if (!idPost || !det || !det.seccionJson) return;
      try {
        localStorage.setItem(K_POST + String(idPost),
                             JSON.stringify(_envuelto(det)));
      } catch (_) { return; }

      /* LRU: el id recién usado va al final; se recortan los
         más viejos respetando el tope MAX_POSTS. */
      try {
        var idx = JSON.parse(localStorage.getItem(K_IDX) || '[]');
        if (!Array.isArray(idx)) idx = [];
        var pos = idx.indexOf(idPost);
        if (pos !== -1) idx.splice(pos, 1);
        idx.push(idPost);
        while (idx.length > MAX_POSTS) {
          var viejo = idx.shift();
          if (viejo) {
            try { localStorage.removeItem(K_POST + String(viejo)); } catch (_) {}
          }
        }
        localStorage.setItem(K_IDX, JSON.stringify(idx));
      } catch (_) {}
    }

    return {
      leerCatalogo:    leerCatalogo,
      guardarCatalogo: guardarCatalogo,
      leerPost:        leerPost,
      guardarPost:     guardarPost
    };
  })();

  /* ============================================================
     POSTFULL · caché cliente de detalles bajo demanda
     ============================================================ */
  window.PostFull = (function () {
    var _cache = {};

    function _recordar(idPost, det) {
      _cache[idPost] = det;
      window.CacheL2.guardarPost(idPost, det);
    }

    /* R21: refresco silencioso de un detalle que ya vive en L2.
       Mismo número de peticiones que antes (1 por apertura fría
       de sesión). Si falla, no pasa nada: el usuario ya está
       leyendo la versión cacheada. */
    function _revalidar(idPost) {
      postBackend('postDetalle', { idPost: idPost }, { mudo: true })
        .then(function (det) {
          if (det && det.seccionJson) _recordar(idPost, det);
        })
        .catch(function () { /* silencioso: hay contenido en pantalla */ });
    }

    function obtener(idPost) {
      if (_cache[idPost]) return Promise.resolve(_cache[idPost]);

      /* R21 · L2: detalle persistido de una visita anterior →
         resolver YA (la apertura ni ve el skeleton) y refrescar
         por detrás. Propuesta 1 del dueño: 0 cuotas nuevas. */
      var l2 = window.CacheL2.leerPost(idPost);
      if (l2) {
        _cache[idPost] = l2;
        _revalidar(idPost);
        return Promise.resolve(l2);
      }

      return postBackend('postDetalle', { idPost: idPost })
        .then(function (det) {
          _recordar(idPost, det);
          return det;
        })
        .catch(function (err) {
          console.warn('[PostFull] Error al pedir detalle de ' + idPost + ':', err.message);
          throw err;
        });
    }

    /* Limpia SOLO la memoria de sesión (L1). La L2 se autorregula
       por revalidación (cada apertura fría) y TTL de 7 días:
       nunca sirve contenido viejo más de una apertura. */
    function limpiar() { _cache = {}; }

    return {
      obtener: obtener,
      limpiar: limpiar
    };
  })();

  /* ============================================================
     PUENTE · persistencia de preferencias vía envoltorio (R10)
     El localStorage del iframe de GAS es efímero (sandbox de
     googleusercontent + ITP de Safari). El envoltorio de
     github.io guarda ciudad/vista en un origen estable y las
     devuelve por postMessage. El origen del padre llega firmado
     en el hash del iframe (#puente=<origen>) para no enviar
     nada a terceros. Sin envoltorio (exec directo) el módulo
     resuelve inmediato y no emite nada.
     ============================================================ */
  window.Puente = (function () {
    var ORIGEN_PADRE  = null;
    var SINCRONIZADO  = false;
    var DISPOSITIVO_PADRE = null;

    try {
      var m = (location.hash || '').match(/puente=([^&]+)/);
      if (m) ORIGEN_PADRE = decodeURIComponent(m[1]);
    } catch (_) {}

    if (ORIGEN_PADRE && !/^https:\/\//.test(ORIGEN_PADRE)) {
      ORIGEN_PADRE = null;
    }

    function hayPadre() {
      try { return window.parent && window.parent !== window; } catch (_) { return false; }
    }

    function enviar(msg) {
      if (!hayPadre()) return;
      try { window.parent.postMessage(msg, ORIGEN_PADRE || '*'); } catch (_) {}
    }

    /* Pide el estado guardado. Resuelve {ciudad, vista} o null
       (sin envoltorio, sin estado o respuesta tardía >1500ms;
       R14: antes 600ms y en móviles lentos se perdía). */
    function pedirEstado() {
      return new Promise(function (resolve) {
        if (!hayPadre()) { SINCRONIZADO = true; resolve(null); return; }

        var resuelto = false;

        function cerrar(valor) {
          if (resuelto) return;
          resuelto = true;
          SINCRONIZADO = true;
          window.removeEventListener('message', onMensaje);
          resolve(valor);
        }

        function onMensaje(e) {
          if (e.source !== window.parent) return;
          if (!e.data || e.data.tipo !== 'estado-aplicar') return;

          /* GA4 (R12): el contenedor presta su deviceid estable
             (github.io no purga storage) para unificar identidad. */
          if (e.data.deviceid && typeof e.data.deviceid === 'string' &&
              e.data.deviceid.length <= 64) {
            DISPOSITIVO_PADRE = e.data.deviceid.replace(/[^A-Za-z0-9_.\-]/g, '');
          }

          var est = e.data.estado;
          if (est && typeof est === 'object') {
            cerrar({ ciudad: est.ciudad || null, vista: est.vista || null });
          } else {
            cerrar(null);
          }
        }

        window.addEventListener('message', onMensaje);
        enviar({ tipo: 'estado-pedir' });
        setTimeout(function () { cerrar(null); }, 1500);   /* R14: antes 600 */
      });
    }

    /* Aplica el estado devuelto. La ciudad se valida contra
       SISTEMA.ciudades (por si quedó desactivada en la hoja) y
       se aplica con Ciudad.aplicarGuardada (emite ciudad:change).
       La vista se valida contra SISTEMA.chips y se deja escrita
       en app_vista ANTES del primer Chips.pintar(), que la lee. */
    function aplicarEstado(est) {
      if (!est) return;

      if (est.ciudad) {
        var ciudades = (window.SISTEMA && window.SISTEMA.ciudades) || [];
        for (var i = 0; i < ciudades.length; i++) {
          var c = ciudades[i];
          if (c && c.idCiudad === est.ciudad && c.estado !== false) {
            /* R13: camino normal + fallback. Si el módulo Ciudad
               de producción todavía no trae aplicarGuardada
               (archivo viejo), la ciudad se deja escrita en
               app_ciudad para que la restaure cualquier versión. */
            if (window.Ciudad &&
                typeof window.Ciudad.aplicarGuardada === 'function') {
              window.Ciudad.aplicarGuardada(c);
            } else {
              try {
                localStorage.setItem('app_ciudad', JSON.stringify({
                  idCiudad: c.idCiudad,
                  titulo:   c.titulo
                }));
              } catch (_) {}
            }
            break;
          }
        }
      }

      if (est.vista) {
        var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
        for (var j = 0; j < chips.length; j++) {
          if (chips[j] && chips[j].idChip === est.vista && chips[j].estado !== false) {
            try {
              localStorage.setItem('app_vista', JSON.stringify({ idChip: est.vista }));
            } catch (_) {}
            break;
          }
        }
      }
    }

    /* Reporta el estado actual al envoltorio. Solo después de la
       sincronización inicial, para no pisar lo guardado con
       valores vacíos de arranque. */
    function guardar() {
      if (!SINCRONIZADO) return;

      var actualCiudad = null;
      if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
        var ca = window.Ciudad.getActual();
        if (ca && ca.idCiudad) actualCiudad = ca.idCiudad;
      }

      var vista = null;
      if (window.Chips && typeof window.Chips.getChipActivo === 'function') {
        vista = window.Chips.getChipActivo();
      }

      /* R13: si los chips aún no se pintaron (cambio de ciudad
         durante la restauración), se reporta la vista conocida
         del storage en lugar de null. */
      if (!vista) {
        try {
          var v = JSON.parse(localStorage.getItem('app_vista') || 'null');
          if (v && v.idChip) vista = v.idChip;
        } catch (_) {}
      }

      enviar({ tipo: 'estado-guardar', estado: { ciudad: actualCiudad, vista: vista } });
    }

    return {
      pedirEstado:   pedirEstado,
      aplicarEstado: aplicarEstado,
      guardar:       guardar,
      /* GA4 (R12): exponer el camino del puente a Analitica */
      hayPuente: function () { return !!(hayPadre() && ORIGEN_PADRE); },
      getDispositivo: function () { return DISPOSITIVO_PADRE || null; },
      retransmitir: enviar
    };
  })();

  /* ============================================================
     ANALITICA · Capa 1 GA4 (R12)
     Único punto de envío de eventos de comportamiento. Reenvía
     por el puente al envoltorio, que los manda a GA4 (lista
     blanca + saneo allí). Sin envoltorio (exec directo) o con
     evento fuera de lista: no-op total, cero impacto.
     ============================================================ */
  window.Analitica = (function () {
    var EVENTOS_OK = {
      app_ready: 1, city_change: 1, chip_change: 1,
      post_open: 1, post_close: 1, search: 1,
      like: 1, whatsapp_click: 1,
      promo_click: 1, promo_swipe: 1,
      reserva_start: 1, otp_request: 1
    };

    function enviar(evento, params) {
      try {
        if (!EVENTOS_OK[evento]) return;
        if (!window.Puente || !window.Puente.hayPuente()) return;

        var p = {};
        if (params && typeof params === 'object') {
          for (var k in params) {
            if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
            var v = params[k];
            if (typeof v === 'string')      p[k] = v.slice(0, 64);
            else if (typeof v === 'number' && isFinite(v)) p[k] = v;
          }
        }

        window.Puente.retransmitir({
          tipo: 'ga-event',
          evento: String(evento),
          params: p
        });
      } catch (_) {}
    }

    function idCiudadActual() {
      try {
        var c = (window.Ciudad && typeof window.Ciudad.getActual === 'function')
          ? window.Ciudad.getActual() : null;
        return (c && c.idCiudad) ? String(c.idCiudad) : '';
      } catch (_) { return ''; }
    }

    function idPostActivo() {
      try {
        var p = (window.Lista && typeof window.Lista.getPostActivo === 'function')
          ? window.Lista.getPostActivo() : null;
        return (p && p.id) ? String(p.id) : '';
      } catch (_) { return ''; }
    }

    return {
      enviar: enviar,
      idCiudadActual: idCiudadActual,
      idPostActivo: idPostActivo
    };
  })();

  /* ============================================================
     CORE
     ============================================================ */
  (function () {
    var postActivoGlobal = null;
    var promesaCarga = null;
    var datosListos = false;

    function esModoWhatsapp(post) {
      if (!post) return false;
      var sj = post.seccionJson || {};
      var meta = sj.meta || {};
      return String(meta.mensajeWhatsapp || '').trim().length > 0;
    }

    function intentarWhatsapp() {
      if (!postActivoGlobal) return false;
      if (!esModoWhatsapp(postActivoGlobal)) return false;

      var sj = postActivoGlobal.seccionJson || {};
      var meta = sj.meta || {};
      var mensaje = String(meta.mensajeWhatsapp || '').trim();

      var partner = buscarPartner(postActivoGlobal.idPartner);
      var numero = partner && partner.partnerJson
        ? partner.partnerJson.whatsapp
        : '';

      return abrirWhatsapp(numero, mensaje);
    }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === idPartner) return partners[i];
      }
      return null;
    }

    /* ============================================================
       Fondo del área · colores del post
       ============================================================ */
    function pintarAreaConPost(post) {
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      if (!post) {
        area.style.background =
          'linear-gradient(180deg, ' +
            '#ffffff 0%, ' +
            '#ffffff 5%, ' +
            '#ecf3fd 15%, ' +
            '#ecf3fd 100%)';
        area.style.removeProperty('--post-color');
        return;
      }

      var meta = post.seccionJson ? (post.seccionJson.meta || {}) : {};
      var colorClaro = meta.colorClaro || post.colorClaro || '#f4f6fc';
      var colorOficial = meta.colorOficial || post.colorOficial || '';

      area.style.background =
        'linear-gradient(180deg, ' +
          '#ffffff 0%, ' +
          '#ffffff 5%, ' +
          colorClaro + ' 15%, ' +
          colorClaro + ' 100%)';

      if (colorOficial) {
        area.style.setProperty('--post-color', colorOficial);
      } else {
        area.style.removeProperty('--post-color');
      }
    }

    function calcularTotalCupos(post) {
      if (!post || !post.planJson || !post.planJson.planes) return null;
      if (!Array.isArray(post.planJson.planes) || post.planJson.planes.length === 0) {
        return null;
      }
      var total = 0;
      post.planJson.planes.forEach(function (p) {
        total += Number(p.cupoLibre || 0);
      });
      return total;
    }

    function actualizarTextoCTA() {
      var btn  = document.querySelector('.cta-reservar');
      var span = document.querySelector('.cta-reservar .cta-reservar-texto');
      if (!btn || !span) return;

      if (!postActivoGlobal) {
        btn.disabled = true;
        span.textContent = 'Quiero reservar mi cupo';
        return;
      }

      var sj = postActivoGlobal.seccionJson || {};
      var meta = sj.meta || {};
      span.textContent = meta.cta || 'Quiero reservar mi cupo';

      var estado = postActivoGlobal.estado || 'activo';

      if (estado === 'pronto') {
        btn.disabled = true;
        return;
      }

      if (esModoWhatsapp(postActivoGlobal)) {
        btn.disabled = false;
        return;
      }

      var totalCupos = calcularTotalCupos(postActivoGlobal);
      btn.disabled = (totalCupos === 0);
    }

    document.addEventListener('click', function (e) {
      var objetivo = e.target;
      if (!objetivo || !objetivo.closest) return;

      var btn = objetivo.closest('.cta-reservar');
      if (!btn) return;
      if (btn.disabled) return;

      if (intentarWhatsapp()) {
        /* GA4 (R12): CTA de WhatsApp del post activo */
        if (window.Analitica && postActivoGlobal) {
          window.Analitica.enviar('whatsapp_click', {
            post_id:    postActivoGlobal.id || '',
            partner_id: postActivoGlobal.idPartner || ''
          });
        }
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('post:change', function (e) {
      var post = e.detail ? e.detail.post : null;

      /* GA4 (R12): post_open al abrir detalle · post_close al
         volver a la lista (post:change con null) */
      if (window.Analitica) {
        if (post && post.id) {
          window.Analitica.enviar('post_open', {
            post_id: post.id,
            city_id: window.Analitica.idCiudadActual()
          });
        } else if (!post && postActivoGlobal && postActivoGlobal.id) {
          window.Analitica.enviar('post_close', {
            post_id: postActivoGlobal.id
          });
        }
      }

      postActivoGlobal = post;

      pintarAreaConPost(post);
      actualizarTextoCTA();

      if (window.Secciones && typeof window.Secciones.irAInicio === 'function') {
        window.Secciones.irAInicio();
      }
    });

    document.addEventListener('chips:change', function (e) {
      actualizarTextoCTA();
      if (window.Puente) window.Puente.guardar();

      /* GA4 (R12) */
      if (window.Analitica && e.detail && e.detail.idChip) {
        window.Analitica.enviar('chip_change', {
          chip_id: e.detail.idChip,
          city_id: window.Analitica.idCiudadActual()
        });
      }
    });

    /* GA4 (R12): búsqueda con debounce para no disparar por
       tecla (el evento DOM buscar:change es por pulsación). */
    var _busquedaTimer = null;
    document.addEventListener('buscar:change', function (e) {
      if (!window.Analitica) return;
      var termino = e.detail && e.detail.termino ? String(e.detail.termino) : '';
      if (_busquedaTimer) clearTimeout(_busquedaTimer);
      _busquedaTimer = setTimeout(function () {
        if (termino) window.Analitica.enviar('search', { termino: termino });
      }, 1500);
    });

    document.addEventListener('post:solicitar', function (e) {
      var idPost = e.detail && e.detail.idPost;
      if (!idPost) return;
      if (window.Lista && typeof window.Lista.seleccionar === 'function') {
        window.Lista.seleccionar(idPost);
      }
    });

    document.addEventListener('chips:solicitar', function (e) {
      var idChip = e.detail && e.detail.idChip;
      if (!idChip) return;
      if (window.Chips && typeof window.Chips.seleccionar === 'function') {
        window.Chips.seleccionar(idChip);
      }
    });

    var ua = navigator.userAgent || '';
    var esMovilUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    var esPantallaPequena = window.matchMedia('(max-width: 768px)').matches;

    if (esMovilUA || esPantallaPequena) {
      document.body.classList.add('is-mobile');
    }

    function avisarAlPadre() {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ tipo: 'app-lista' }, '*');
        }
      } catch (_) {}
      /* R26: la página estática de GitHub Pages no tiene padre;
         el preloader vive en ESTA página y escucha el evento DOM. */
      try { document.dispatchEvent(new Event('app-lista')); } catch (_) {}
    }

    /* ============================================================
       Carga de TABLAS · todos los posts en un solo POST
       ============================================================ */
    function cargarTablas() {
      /* R21 · L2: catálogo persistido → arranque instantáneo.
         TABLAS se llena YA (la lista pinta al toque, incluso
         con GAS en frío) y la red valida por detrás. */
      var l2 = window.CacheL2.leerCatalogo();
      if (l2) {
        window.TABLAS.posts    = l2.data.posts;
        window.TABLAS.partners = l2.data.partners;
        datosListos = true;
        _revalidarCatalogo(l2.raw);
        return Promise.resolve();
      }

      return postBackend('catalogo')
        .then(function (data) {
          window.TABLAS.posts    = (data && Array.isArray(data.posts))    ? data.posts    : [];
          window.TABLAS.partners = (data && Array.isArray(data.partners)) ? data.partners : [];
          datosListos = true;
          window.CacheL2.guardarCatalogo(data);
        })
        .catch(function (err) {
          console.warn('[Core] No se pudo cargar catálogo:', err.message);
          window.TABLAS.posts    = [];
          window.TABLAS.partners = [];
          datosListos = true;
        });
    }

    /* R21: el POST de catálogo en segundo plano cuando hay L2.
       Si trajo algo distinto a lo cacheado y el usuario sigue
       viendo la lista, se repinta lista + promo (SIN evento de
       chip: no contamina GA4 ni el puente). Si está leyendo un
       post, no se toca la pantalla. Si falla, la lista cacheada
       sigue en pie. */
    function _revalidarCatalogo(rawAnterior) {
      postBackend('catalogo', null, { mudo: true })
        .then(function (data) {
          if (!data || !Array.isArray(data.posts) ||
              !Array.isArray(data.partners)) return;

          window.TABLAS.posts    = data.posts;
          window.TABLAS.partners = data.partners;
          var rawNuevo = window.CacheL2.guardarCatalogo(data);

          if (rawAnterior && rawNuevo === rawAnterior) return;

          if (window.Lista && typeof window.Lista.getModo === 'function' &&
              window.Lista.getModo() === 'lista') {
            if (window.Promo && typeof window.Promo.construir === 'function') {
              window.Promo.construir();
            }
            if (typeof window.Lista.pintar === 'function') {
              var chip = (window.Chips &&
                          typeof window.Chips.getChipActivo === 'function')
                ? window.Chips.getChipActivo() : null;
              window.Lista.pintar(chip, null);
            }
          }
        })
        .catch(function () { /* silencioso: la lista cacheada sigue en pantalla */ });
    }

    function inyectarLienzo() {
      var lienzo = document.getElementById('lienzo');
      var plantilla = document.getElementById('canvas-content');
      if (!lienzo || !plantilla) return;

      if (lienzo.dataset.pintado === '1') return;

      var fragmento = plantilla.content.cloneNode(true);
      lienzo.appendChild(fragmento);
      lienzo.dataset.pintado = '1';

      arrancarComponentes();

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          avisarAlPadre();

          /* GA4 (R12): la app terminó de pintar */
          if (window.Analitica) {
            window.Analitica.enviar('app_ready', {
              ciudad: window.Analitica.idCiudadActual()
            });
          }
        });
      });
    }

    /* ============================================================
       Skeleton de lista
       Solo se muestra si el usuario elige ciudad y el POST inicial
       aún no llegó. Teléfonos lentos o elección muy rápida.
       ============================================================ */
    function mostrarSkeletonLista() {
      var wrap = document.getElementById('listaWrap');
      if (!wrap) return;

      var html = '<div class="lista-skeleton">';
      for (var i = 0; i < 5; i++) {
        html +=
          '<div class="lista-skeleton-item">' +
            '<div class="lista-skeleton-avatar"></div>' +
            '<div class="lista-skeleton-body">' +
              '<div class="lista-skeleton-line short"></div>' +
              '<div class="lista-skeleton-line long"></div>' +
              '<div class="lista-skeleton-line medium"></div>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';

      wrap.innerHTML = html;
    }

    /* ============================================================
       Repintar chrome
       ============================================================ */
    function repintar() {
      if (window.Chips && typeof window.Chips.pintar === 'function') {
        window.Chips.pintar();
      }
      if (window.Promo && typeof window.Promo.construir === 'function') {
        window.Promo.construir();
      }
    }

    function repintarCuandoHayaDatos() {
      if (datosListos) {
        repintar();
        return;
      }

      /* Los datos aún no llegaron → mostrar skeleton y esperar */
      mostrarSkeletonLista();

      if (promesaCarga) {
        promesaCarga.then(repintar);
      } else {
        repintar();
      }
    }

    /* ============================================================
       Arrancar componentes · DOM ya montado
       ============================================================ */
    function arrancarComponentes() {
      if (window.Ciudad && typeof window.Ciudad.engancharBoton === 'function') {
        window.Ciudad.engancharBoton();
      }

      if (window.Chips && typeof window.Chips.pintar === 'function') {
        window.Chips.pintar();
      }
      if (window.Buscar && typeof window.Buscar.pintar === 'function') {
        window.Buscar.pintar();
      }
      if (window.Promo && typeof window.Promo.construir === 'function') {
        window.Promo.construir();
      }
      if (window.Social && typeof window.Social.pintar === 'function') {
        window.Social.pintar();
      }
      if (window.Global && typeof window.Global.pintar === 'function') {
        window.Global.pintar();
      }
      /* R36: liga #btnCompartir y #btnLimpiarBusqueda */
      if (window.Compartir && typeof window.Compartir.pintar === 'function') {
        window.Compartir.pintar();
      }

      pintarAreaConPost(null);
      actualizarTextoCTA();
    }

    /* ============================================================
       Cambio de ciudad
       ============================================================ */
    document.addEventListener('ciudad:change', function (e) {
      if (window.Lista && typeof window.Lista.getModo === 'function' &&
          window.Lista.getModo() === 'detalle') {
        window.Lista.cerrarDetalle(true);
      }

      repintarCuandoHayaDatos();

      if (window.Puente) window.Puente.guardar();

      /* GA4 (R12) */
      if (window.Analitica && e.detail && e.detail.idCiudad) {
        window.Analitica.enviar('city_change', {
          city_id:   e.detail.idCiudad,
          city_name: (e.detail.titulo ? String(e.detail.titulo) : '')
        });
      }
    });

    /* ============================================================
       Arranque · POST en paralelo con el sheet
       El estado guardado (puente R10) se aplica ANTES de decidir
       si se abre la selección obligatoria de ciudad: si el
       envoltorio devuelve ciudad válida, el usuario entra directo
       a su lista sin re-seleccionar nada.
       ============================================================ */
    function arranque() {
      /* R26: en la página estática la sesión llega POR DATOS
         (abrirSesion → token + SISTEMA). En la página de GAS el
         token ya viene inyectado y asegurarSesion resuelve al
         instante: mismo orden de siempre (v1.7). */
      var pre = (typeof window.asegurarSesion === 'function')
        ? window.asegurarSesion()
        : Promise.resolve();

      promesaCarga = pre.then(function () {
        return cargarTablas();
      });

      pre.then(function () {
        window.Puente.pedirEstado().then(function (estado) {
          window.Puente.aplicarEstado(estado);

          /* R36 · ENLACE COMPARTIDO ENTRANTE: la recepción manda.
             El enlace trae su contenido cifrado (post o lista con
             ciudad): se omite la selección obligatoria de ciudad,
             se espera la carga de TABLAS, se inyecta el lienzo y
             Compartir.recibir() aplica todo y activa el modo
             compartido (campo bloqueado + "Limpiar búsqueda"). */
          if (window.Compartir &&
              typeof window.Compartir.hayEntrante === 'function' &&
              window.Compartir.hayEntrante()) {
            promesaCarga.then(function () {
              inyectarLienzo();
              try {
                window.Compartir.recibir();
              } catch (e2) {
                console.warn('[Core] Compartir.recibir:', e2 && e2.message);
              }
            });
            return;
          }

          var hayPendiente = window.Ciudad &&
                             typeof window.Ciudad.hayPendiente === 'function' &&
                             window.Ciudad.hayPendiente();

          if (hayPendiente) {
            inyectarLienzo();
            setTimeout(function () {
              window.Ciudad.abrirObligatorio();
            }, 80);
            return;
          }

          promesaCarga.then(function () {
            inyectarLienzo();
          });
        });
      });

      /* R26: sin sesión no hay arranque posible (pantalla de
         red con Reintentar). En la página de GAS nunca corre. */
      pre.catch(function (err) {
        console.warn('[Core] Sesión inicial falló:', err && err.message);
        if (typeof _mostrarErrorRed === 'function') _mostrarErrorRed();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arranque);
    } else {
      arranque();
    }

    window.addEventListener('resize', function () {
      var peque = window.matchMedia('(max-width: 768px)').matches;
      if (esMovilUA || peque) {
        document.body.classList.add('is-mobile');
      } else if (!esMovilUA) {
        document.body.classList.remove('is-mobile');
      }
    });

    /* ============================================================
       REFRESH AL VOLVER FOCO · 60s throttle
       ============================================================ */
    var ULTIMO_REFRESH_MS   = 0;
    var THROTTLE_REFRESH_MS = 60 * 1000;

    function refrescarCatalogo() {
      /* R21: mudo — este refresco corre con la app YA pintada;
         si la red falla, el contenido vivo no se tapa con la
         pantalla "Sin conexión". Éxito → se actualiza L2. */
      return postBackend('catalogo', null, { mudo: true })
        .then(function (data) {
          if (data && Array.isArray(data.posts))     window.TABLAS.posts    = data.posts;
          if (data && Array.isArray(data.partners))  window.TABLAS.partners = data.partners;
          window.CacheL2.guardarCatalogo(data);
        })
        .catch(function (err) {
          console.warn('[Core] No se pudo refrescar catálogo:', err.message);
        });
    }

    function refrescarComentariosSiAplican() {
      if (window.Comentarios &&
          typeof window.Comentarios.estaAbierto === 'function' &&
          window.Comentarios.estaAbierto() &&
          typeof window.Comentarios.refrescar === 'function') {
        window.Comentarios.refrescar();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      var ahora = Date.now();
      if (ahora - ULTIMO_REFRESH_MS < THROTTLE_REFRESH_MS) return;
      ULTIMO_REFRESH_MS = ahora;

      refrescarCatalogo();
      refrescarComentariosSiAplican();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

  })();
