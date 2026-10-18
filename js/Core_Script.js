/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Core_Script.html
ESPEJO GITHUB:   github/js/Core_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
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
VERSIÓN:         1.23
CAMBIOS:         R68: solo encabezado — la mención del menú global
                 pasa a Global_Sheet_Script (renombrado R68). Ni
                 una línea de código tocada; el lienzo y el
                 preloader-evento quedan intactos.
                 R67: EXPERIMENTO LIENZO CASHEA/YUMMY (reversible
                 a petición del dueño): el clarito #fdf3ec
                 COMIENZA en la parte superior de la pantalla
                 principal (0–12% plano) y degrada a BLANCO
                 terminando debajo de las promos (~34%); blanco
                 puro hasta la franja de abajo del navegador. En
                 PWA la misma condición (manifest + theme-color
                 a juego, en Index/manifest). El degradado
                 anterior (R65/R66) queda COMENTADO dentro de
                 pintarAreaConPost para revertirlo en una
                 jugada. Stops calibrados en laboratorio (390px).
                 R66: arrancarComponentes() liga #btnOrdenar —
                 window.Ordenar.engancharBoton() (el sheet de
                 ordenamiento del botón de la fila 1).
                 R65: el DEGRADADO de la pantalla principal se
                 corta donde termina la sección filtro — blanco
                 arriba (0–5%), tinte #fdf3ec en su pico (15%)
                 y desde la zona de filtros vuelve a degradar a
                 BLANCO (~24–36%) que queda para el resto de la
                 pantalla (la subida blanco→tinte queda exacta
                 como estaba). El detalle de un post conserva su
                 degradado propio del colorClaro.
                 R64: el skeleton de lista replica la anatomía
                 LIMPIA del item (título + partner + estrella —
                 sin la fila del subtítulo ni la divisoria
                 interna, muertas con el item viejo).
                 R63: (1) 'ciudad:change' cae al chip de SERVICIOS
                 por defecto (Chips.resetearVista — orden del
                 dueño: Irapa sin cursos no puede dejar la lista
                 vacía, y el retorno a Güiria ya no aterriza en
                 cursos); (2) pintarTituloHeader() acepta el
                 VECTOR aunque la hoja lo guarde como TEXTO con
                 formato JSON (parse defensivo): la frase al azar
                 de cada carga ya no depende de cómo lo guarde el
                 Setup (el dueño lo veía repetido).
                 R61: el PLACEHOLDER del buscador se pinta desde
                 la BD real (SISTEMA.root →
                 app.placeholderBuscar; si la BD no lo trae queda
                 el fijo de la app) — se deja de hardcodear el
                 texto en el markup.
                 R58: pantalla principal refactorizada — el
                 TÍTULO INICIAL grande se pinta desde la BD real
                 (SISTEMA.root → app.tituloHeader). El fondo del
                 lienzo #fdf3ec (R57) queda EXACTO.
DEPENDENCIAS:    Global_Script.html (postBackend), Index.html
                 (#canvas-content, #tituloHeader, SISTEMA, TABLAS,
                 TOKEN, URL_EXEC),
                 Telefono.html (#lienzo), Ciudad_Sheet_Script.html,
                 Chips_Script.html, Buscar_Script.html,
                 Promo_Script.html, Social_Script.html,
                 Global_Sheet_Script.html (window.Global), Lista_Script.html,
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
        /* R67 · EXPERIMENTO LIENZO CASHEA/YUMMY (reversible):
           el clarito #fdf3ec COMIENZA en la parte superior
           (0–12% plano, como el clarito de Cashea/Yummy detrás
           de su cabecera) y DEGRADA a BLANCO terminando debajo
           de las promos (34%); de ahí en adelante blanco puro
           hasta la franja de abajo del navegador (el body
           is-mobile ya es blanco y viewport-fit=cover lo
           estira bajo la home bar). En PWA la misma condición:
           manifest theme_color #fdf3ec + splash blanco.
           REVERSIÓN (si el dueño lo pide): devolver el
           degradado de R65/R66 que está COMENTADO abajo —
           una línea, sin tocar nada más. Stops calibrados
           en el laboratorio (390×844): promos 5–21%,
           filtros 22–27%, items 34% → el clarito acompaña
           cabecera + promos + filtros y alcanza el BLANCO
           justo antes de la lista. El detalle sigue con su
           colorClaro (intacto). */
        area.style.background =
          'linear-gradient(180deg, ' +
            '#fdf3ec 0%, ' +
            '#fdf3ec 10%, ' +
            '#ffffff 28%, ' +
            '#ffffff 100%)';
        /* REVERSIÓN R65/R66 (blanco arriba → tinte en filtros):
        area.style.background =
          'linear-gradient(180deg, ' +
            '#ffffff 0%, ' +
            '#ffffff 5%, ' +
            '#fdf3ec 15%, ' +
            '#fdf3ec 24%, ' +
            '#ffffff 36%, ' +
            '#ffffff 100%)';
        */
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

      if (btn && span) {
        if (!postActivoGlobal) {
          btn.disabled = true;
          span.textContent = 'Quiero reservar mi cupo';
        } else {
          var sj = postActivoGlobal.seccionJson || {};
          var meta = sj.meta || {};
          span.textContent = meta.cta || 'Quiero reservar mi cupo';

          var estado = postActivoGlobal.estado || 'activo';

          if (estado === 'pronto') {
            btn.disabled = true;
          } else if (esModoWhatsapp(postActivoGlobal)) {
            btn.disabled = false;
          } else {
            var totalCupos = calcularTotalCupos(postActivoGlobal);
            btn.disabled = (totalCupos === 0);
          }
        }
      }

      /* R46: la duda del post se sincroniza con cada cambio
         (mismos disparadores que el CTA). */
      actualizarDuda();
    }

    /* ============================================================
       R46 · DUDA DEL POST (botón "Consultar")
       Visibilidad: solo si el post declara meta.botonDuda con
       texto Y el CTA NO es modo WhatsApp (dos botones que abren
       WhatsApp no suman). Nunca se deshabilita: aunque el CTA
       esté off (pronto o cupos agotados), preguntar sigue siendo
       válido. El texto viaja en meta.mensajeDuda con el
       placeholder {titulo}, que se sustituye por el título del
       post al armar el mensaje.
       R50 · con duda visible, la fila se marca .segmentada:
       duda + CTA se pintan como UNA sola píldora dividida.
       ============================================================ */
    function actualizarDuda() {
      var btn = document.querySelector('.cta-duda');
      if (!btn) return;

      var texto = '';
      if (postActivoGlobal) {
        var sj = postActivoGlobal.seccionJson || {};
        var meta = sj.meta || {};
        texto = String(meta.botonDuda || '').trim();
        if (esModoWhatsapp(postActivoGlobal)) texto = '';
      }

      if (texto) {
        btn.textContent = texto;
        btn.hidden = false;
      } else {
        btn.hidden = true;
      }

      var fila = btn.closest('.cta-fila');
      if (fila) fila.classList.toggle('segmentada', !!texto);
    }

    /* Click de la duda · delegado en document (capture, mismo
       carril que el CTA). Arma el mensaje con {titulo} y abre
       el WhatsApp del partner. */
    document.addEventListener('click', function (e) {
      var objetivo = e.target;
      if (!objetivo || !objetivo.closest) return;

      var btn = objetivo.closest('.cta-duda');
      if (!btn || btn.hidden) return;

      var post = postActivoGlobal;
      if (!post) return;

      var sj = post.seccionJson || {};
      var meta = sj.meta || {};
      var sp = sj.seccionPresentacion || {};

      var mensaje = String(meta.mensajeDuda || '').trim();
      if (!mensaje) return;

      var titulo = String(sp.titulo || post.titulo || '').trim();
      if (titulo) mensaje = mensaje.split('{titulo}').join(titulo);

      var partner = buscarPartner(post.idPartner);
      var numero = partner && partner.partnerJson
        ? partner.partnerJson.whatsapp
        : '';
      if (!numero) return;

      if (typeof window.abrirWhatsapp === 'function') {
        window.abrirWhatsapp(numero, mensaje);

        /* GA4 (R12): mismo evento del CTA, con el tipo para
           separar duda de reserva en los informes. */
        if (window.Analitica) {
          window.Analitica.enviar('whatsapp_click', {
            post_id:    post.id || '',
            partner_id: post.idPartner || '',
            tipo:       'duda'
          });
        }
      }
    }, true);

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

    /* ============================================================
       TÍTULO INICIAL (R62 · VECTOR ALEATORIO) · la frase grande
       del header vive en la BD real: ROOTJSON → app.tituloHeader
       (SISTEMA.root). Desde R62 es un VECTOR de frases: cada
       carga/actualización de la app elige UNA AL AZAR — si el
       usuario abre la app 10 veces, 10 frases distintas puede
       ver (la app se siente viva). Si la BD lo trae como texto
       único se usa tal cual (compatibilidad); si no trae nada,
       el elemento queda oculto y el header respira sin él. Se
       pinta una vez al montar el lienzo (cada carga de página
       es un montaje nuevo: cada carga, frase nueva).
       ============================================================ */
    function fraseAleatoria(vector) {
      var limpias = [];
      for (var i = 0; i < vector.length; i++) {
        var v = String(vector[i] || '').trim();
        if (v) limpias.push(v);
      }
      if (!limpias.length) return '';
      return limpias[Math.floor(Math.random() * limpias.length)];
    }

    function pintarTituloHeader() {
      var el = document.getElementById('tituloHeader');
      if (!el) return;

      var root = (window.SISTEMA && window.SISTEMA.root) || {};
      var app  = root.app || {};
      var t    = app.tituloHeader;

      if (Object.prototype.toString.call(t) === '[object Array]') {
        t = fraseAleatoria(t);
      } else {
        t = String(t || '').trim();

        /* R63 · si el Setup guardó el vector como TEXTO (string
           con formato JSON), se parsea aquí: la frase al azar
           de cada carga ya no depende de cómo lo guarde la
           hoja (el dueño veía siempre la misma). */
        if (t.charAt(0) === '[' && t.charAt(t.length - 1) === ']') {
          try {
            var v = JSON.parse(t);
            if (Object.prototype.toString.call(v) === '[object Array]') {
              t = fraseAleatoria(v);
            }
          } catch (_) {}
        }
      }

      if (t) {
        el.textContent = t;
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    }

    /* ============================================================
       PLACEHOLDER DEL BUSCADOR (R61) · el texto guía vive en
       la BD real: ROOTJSON → app.placeholderBuscar
       (SISTEMA.root). Si la BD no lo trae queda el fijo de la
       app. Así el dueño cambia el texto desde la hoja sin
       tocar código.
       ============================================================ */
    function pintarPlaceholderBuscar() {
      var input = document.getElementById('buscarInput');
      if (!input) return;

      var root = (window.SISTEMA && window.SISTEMA.root) || {};
      var app  = root.app || {};
      var t = String(app.placeholderBuscar || '').trim();

      input.setAttribute('placeholder',
        t || 'Buscar servicio, curso o palabra clave');
    }

    function inyectarLienzo() {
      var lienzo = document.getElementById('lienzo');
      var plantilla = document.getElementById('canvas-content');
      if (!lienzo || !plantilla) return;

      if (lienzo.dataset.pintado === '1') return;

      var fragmento = plantilla.content.cloneNode(true);
      lienzo.appendChild(fragmento);
      lienzo.dataset.pintado = '1';

      /* R62 · los glifos del template (ubicación del botón
         ciudad, filtro del botón filtros…) se pintan aquí:
         el pintado automático de Iconos corrió ANTES de que
         el lienzo existiera. pintarUno es idempotente, así
         que nadie se pinta doble. */
      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(lienzo);
      }

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
            '<div class="lista-skeleton-body">' +
              '<div class="lista-skeleton-line short"></div>' +
              '<div class="lista-skeleton-line long"></div>' +
              '<div class="lista-skeleton-pie">' +
                '<div class="lista-skeleton-avatar"></div>' +
                '<div class="lista-skeleton-line nombre"></div>' +
                '<div class="lista-skeleton-line ver"></div>' +
              '</div>' +
            '</div>' +
            '<div class="lista-skeleton-estrella" aria-hidden="true">' +
              '<div class="punto"></div>' +
              '<div class="barra"></div>' +
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

      /* R66: liga #btnOrdenar (abre el sheet de ordenamiento) */
      if (window.Ordenar && typeof window.Ordenar.engancharBoton === 'function') {
        window.Ordenar.engancharBoton();
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
      /* R64: liga #btnCompartir (la visibilidad la decide Lista) */
      if (window.Compartir && typeof window.Compartir.pintar === 'function') {
        window.Compartir.pintar();
      }

      pintarTituloHeader();
      pintarPlaceholderBuscar();
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

      /* R63 · el dueño: cada cambio de ciudad cae al chip de
         SERVICIOS por defecto (Irapa sin cursos no puede dejar
         la lista vacía, y el retorno a Güiria ya no aterriza en
         cursos). Chips.resetearVista escribe la vista guardada
         para que la restauración no reviva el chip anterior;
         sin el módulo nuevo (archivo viejo), borrar la vista
         logra el mismo efecto con el chip 1. */
      if (window.Chips &&
          typeof window.Chips.resetearVista === 'function') {
        window.Chips.resetearVista();
      } else {
        try { localStorage.removeItem('app_vista'); } catch (_) {}
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