/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Script.html
ESPEJO GITHUB:   github/js/Core_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Núcleo de la página. Carga TABLAS por POST y
                 arranca los componentes con datos; inyecta el
                 lienzo; decide el CTA (WhatsApp o sheet de
                 reserva); CacheL2 persiste catálogo y detalles
                 en localStorage (stale-while-revalidate al
                 reabrir); refresca catálogo y preguntas abiertas
                 al volver la app a primer plano; guardia del
                 token y detección de entorno; módulo
                 AvisoRespuesta (R151): el aviso flotante
                 «te respondió» — tarjeta FIJA, una a la
                 vez, VISTO al actuar y texto dinámico.
VERSIÓN:         1.41.0
CAMBIOS:         R157: EL SWIPE RENACE SIMPLE — SOLUCIÓN ALTERNA (orden del dueño tras probar la R155 y la R156 en su iPhone 11: «el deslizamiento está al revés», «no se asoma nada de la siguiente pantalla, está muerto ese proceso», «dame una solución alterna, pero hay que darle la sensación al usuario de que sí está pasando a la siguiente pantalla»): MUERE la máquina de congelar/clonar de la R155/R156 — cero clones, cero capas fantasma, cero flag _congelado — y nacen tres piezas a prueba de todo. (1) DIRECCIÓN ANCLADA A LA PANTALLA: los vecinos se MIDEN con getBoundingClientRect de los chips visibles comparando CENTROS con el chip activo — el que queda a la DERECHA del activo ES el SIGUIENTE y entra al ARRASTRAR A LA IZQUIERDA; ni el orden del arreglo ni el del DOM pueden invertir lo que los ojos ven. (2) FRANJA DE ASOMA INFALIBLE: un div fijo (.swipe-franja, Core_CSS) con el NOMBRE REAL del chip vecino y un chevron asoma por el borde por donde entra la otra pantalla (derecha al tirar a la izquierda · izquierda al tirar a la derecha) y CRECE con el dedo desde el primer píxel — un solo elemento, nada que pueda morir en silencio. (3) PANTALLA VIVA + SALIDA/ENTRADA: la lista viaja AMORTIGUADA con el dedo (0.22, tope 34px; muro de 8px en los extremos, sin ciclo), al confirmar (25% del ancho o flick 0.45 px/ms) la lista SALE hacia el lado del gesto (0.16s, espejo de la llegada) y el cambio viaja por el MISMO camino del click (window.Chips.seleccionar → chips:change) donde la lista nueva LLEGA con .llega-derecha/.llega-izquierda. El chip destino se PRENDE al cruzar el umbral (R155 intacto). Filtros de nacimiento y lock de eje 10px intactos (bordes 24px, modo lista, sin búsqueda). VISTO al abrir el post (R155) intacto. R151 (tarjeta fija, una a la vez, VISTO al actuar) intacto. Historial: bitácora/versiones.
DEPENDENCIAS:    Global_Script.html (postBackend, helpers),
                 Index.html (SISTEMA, TOKEN, URL_EXEC),
                 Lista_Script.html, Seccion_Script.html,
                 Pregunta_Script.html (window.Pregunta),
                 Reserva_Script.html y hojas de reserva,
                 Iconos.html, Core_CSS.html
════════════════════════════════════════════════════════════════════*/


  /* ============================================================
     HORA VENEZUELA REAL · R149 · fechaVenezuela()
     Único generador de horas del CLIENTE. Devuelve SIEMPRE la
     hora real de Venezuela (America/Caracas, sin horario de
     verano): yyyy-mm-ddThh:mm:ss — militar 24 h, T fija, SIN
     offset, SIN Z y SIN milisegundos: el MISMO formato literal
     que escribe el backend (_fechaVenezuela_, 02 Tablas.gs) y
     el dueño a mano en la BD. Zona FIJA por nombre vía Intl:
     no depende del reloj ni de la zona del dispositivo.
     La usa window.Pregunta (publicar) y anotarPregunta aquí.
     ============================================================ */
  function fechaVenezuela() {
    var partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      hour12:   false,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit'
    }).formatToParts(new Date());
    var v = {};
    for (var i = 0; i < partes.length; i++) {
      v[partes[i].type] = partes[i].value;
    }
    /* Motor viejo: medianoche puede salir "24" → normaliza a 00. */
    if (v.hour === '24') v.hour = '00';
    return v.year + '-' + v.month + '-' + v.day + 'T' +
           v.hour + ':' + v.minute + ':' + v.second;
  }

  /* ============================================================
     CACHEL2 · capa del dispositivo
     R76: persiste/lee `postJson`.
     La clave de localStorage se mantiene (sv_l2_post_<id>):
     el dueño ejecuta invalidarTodo() antes de cargar la app,
     y el cliente purga el shape viejo porque _valido() exige
     `postJson` en el envuelto.
     ============================================================ */
  window.CacheL2 = (function () {
    var K_CAT       = 'sv_l2_catalogo';
    var K_IDX       = 'sv_l2_posts_idx';
    var K_POST      = 'sv_l2_post_';
    var MAX_POSTS   = 30;
    var TTL_MS      = 7 * 24 * 60 * 60 * 1000;
    var ENV_VERSION = 3;   /* R111: el catálogo vuelve a su shape sin imagen */

    function _valido(env, requiereSecciones) {
      if (!env || env.v !== ENV_VERSION) return false;
      if (!env.data || typeof env.data !== 'object') return false;
      if (typeof env.ts !== 'number') return false;
      if (Date.now() - env.ts > TTL_MS) return false;
      if (requiereSecciones && !env.data.postJson) return false;
      return true;
    }

    function _envuelto(data) {
      return { v: ENV_VERSION, ts: Date.now(), data: data };
    }

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
      if (!idPost || !det || !det.postJson) return;
      try {
        localStorage.setItem(K_POST + String(idPost),
                             JSON.stringify(_envuelto(det)));
      } catch (_) { return; }

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
     (clave `postJson`).
     ============================================================ */
  window.PostFull = (function () {
    var _cache = {};

    function _recordar(idPost, det) {
      _cache[idPost] = det;
      window.CacheL2.guardarPost(idPost, det);
    }

    function _revalidar(idPost) {
      postBackend('postDetalle', { idPost: idPost }, { mudo: true })
        .then(function (det) {
          if (det && det.postJson) {
            _recordar(idPost, det);
            /* R84: la revalidación muda AVISA — el Q&A del post
               activo repinta sus últimas preguntas con lo fresco
               (el post abierto con L2 vieja se cura al llegar). */
            try {
              document.dispatchEvent(new CustomEvent('post:actualizado', {
                detail: { idPost: idPost, det: det }
              }));
            } catch (_) {}
          }
        })
        .catch(function () {});
    }

    function obtener(idPost) {
      if (_cache[idPost]) return Promise.resolve(_cache[idPost]);

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

    /* R84: una pregunta recién publicada también vive en la caché
       del cliente — cerrar y reabrir el post la sigue mostrando
       hasta que el detalle real (ya invalidado en GAS) la traiga. */
    function anotarPregunta(idPost, pregunta) {
      var det = _cache[idPost];
      if (!det || !pregunta) return;
      var pq = (det.preguntas && typeof det.preguntas === 'object')
        ? det.preguntas : { total: 0, lista: [] };
      pq.lista = (Array.isArray(pq.lista) ? pq.lista : []).slice();
      pq.lista.unshift({
        texto:     String(pregunta.texto || ''),
        fecha:     pregunta.fecha || fechaVenezuela(),   /* R149: hora Venezuela real. */
        respuesta: null
      });
      pq.lista = pq.lista.slice(0, 2);
      pq.total = (typeof pq.total === 'number' && isFinite(pq.total))
        ? pq.total + 1 : pq.lista.length;
      det.preguntas = pq;
      window.CacheL2.guardarPost(idPost, det);
    }

    function limpiar() { _cache = {}; }

    return {
      obtener:        obtener,
      anotarPregunta: anotarPregunta,
      limpiar:        limpiar
    };
  })();

  /* ============================================================
     PUENTE · persistencia de preferencias vía envoltorio
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
        setTimeout(function () { cerrar(null); }, 1500);
      });
    }

    function aplicarEstado(est) {
      if (!est) return;

      if (est.ciudad) {
        var ciudades = (window.SISTEMA && window.SISTEMA.ciudades) || [];
        for (var i = 0; i < ciudades.length; i++) {
          var c = ciudades[i];
          if (c && c.idCiudad === est.ciudad && c.estado !== false) {
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
      hayPuente: function () { return !!(hayPadre() && ORIGEN_PADRE); },
      getDispositivo: function () { return DISPOSITIVO_PADRE || null; },
      retransmitir: enviar
    };
  })();

  /* ============================================================
     ANALITICA · Capa 1 GA4
     ============================================================ */
  window.Analitica = (function () {
    var EVENTOS_OK = {
      app_ready: 1, city_change: 1, chip_change: 1,
      post_open: 1, post_close: 1, search: 1,
      like: 1, whatsapp_click: 1,
      promo_click: 1, promo_swipe: 1,
      intersticial_view: 1, intersticial_click: 1,
      reserva_start: 1, otp_request: 1
    };

    function enviar(evento, params) {
      try {
        if (!EVENTOS_OK[evento]) return;

        var p = {};
        if (params && typeof params === 'object') {
          for (var k in params) {
            if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
            var v = params[k];
            if (typeof v === 'string')      p[k] = v.slice(0, 64);
            else if (typeof v === 'number' && isFinite(v)) p[k] = v;
          }
        }

        /* R110 · los eventos NO mueren si no hay puente: en la app
           única (R105 retiró el envoltorio/iframe) window.Puente ya
           no existe y el return viejo mataba TODA la Capa 1 GA4.
           Ahora: con puente se retransmite (legado); sin puente el
           evento va DIRECTO a gtag de la página (index.html lo
           carga); si gtag no está (DNT o bloqueo), queda en nada. */
        if (window.Puente && window.Puente.hayPuente()) {
          window.Puente.retransmitir({
            tipo: 'ga-event',
            evento: String(evento),
            params: p
          });
          return;
        }

        if (typeof window.gtag === 'function') {
          window.gtag('event', String(evento), p);
        }
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

    /* R119 · VIDA DEL POST en el teléfono: filtra los posts cuya
       ventana meta.expira ya pasó (reloj local, la misma
       gramática de _parseVentana R108). Cubre el hueco TTL:
       catálogo cargado a las 22:00, post muerto a las 23:00 →
       el teléfono lo excluye en vivo sin esperar la próxima
       descarga. Sin expira, fecha ilegible o entrada rara =
       pasa intacta (NUNCA tumba el catálogo por datos malos). */
    function _postExpiraVivo_(posts) {
      if (!Array.isArray(posts)) return posts;

      function _dos_(n) { return (n < 10 ? '0' : '') + n; }

      var ahora = new Date();
      var ahoraTxt = ahora.getFullYear() + '-'
        + _dos_(ahora.getMonth() + 1) + '-' + _dos_(ahora.getDate())
        + ' ' + _dos_(ahora.getHours()) + ':' + _dos_(ahora.getMinutes());

      return posts.filter(function (p) {
        if (!p || typeof p !== 'object') return true;
        var m = String(p.expira || '').trim()
          .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (!m) return true;   /* sin expira o ilegible: viaja */

        var limite = m[1] + '-' + m[2] + '-' + m[3] + ' '
          + (m[4] ? (_dos_(Number(m[4])) + ':' + m[5]) : '23:59');
        return ahoraTxt <= limite;
      });
    }

    /* R76: el modo whatsapp ahora se decide por meta.mensajeCta
       (antes meta.mensajeWhatsapp). */
    function esModoWhatsapp(post) {
      if (!post) return false;
      var pj = post.postJson || {};
      var meta = pj.meta || {};
      return String(meta.mensajeCta || '').trim().length > 0;
    }

    /* R139 · Título del post para los placeholders · la MISMA
       fuente que la duda ya usaba (R76): descripcion.tituloPost
       del postJson, con post.titulo de miga. */
    function tituloDelPost(post) {
      var pj = (post && post.postJson) || {};
      var desc = pj.descripcion || {};
      return String(desc.tituloPost || (post && post.titulo) || '').trim();
    }

    function intentarWhatsapp() {
      if (!postActivoGlobal) return false;
      if (!esModoWhatsapp(postActivoGlobal)) return false;

      var pj = postActivoGlobal.postJson || {};
      var meta = pj.meta || {};
      var mensaje = String(meta.mensajeCta || '').trim();

      /* R139: {tituloPost} → el título del post. Sin título,
         el mensaje viaja tal cual (nunca tumba el envío). */
      var titulo = tituloDelPost(postActivoGlobal);
      if (titulo) mensaje = mensaje.split('{tituloPost}').join(titulo);

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
       R76: meta.color[2] = claro · meta.color[0] = oficial.
       ============================================================ */
    function pintarAreaConPost(post) {
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      if (!post) {
        area.style.background =
          'linear-gradient(180deg, ' +
            '#ffffff 0%, ' +
            '#ffffff 5%, ' +
            '#fdf3ec 15%, ' +
            '#fdf3ec 24%, ' +
            '#ffffff 36%, ' +
            '#ffffff 100%)';
        area.style.removeProperty('--post-color');
        return;
      }

      var pj = post.postJson || {};
      var meta = pj.meta || {};
      var colores = Array.isArray(meta.color) ? meta.color : [];
      var colorClaro   = colores[2] || '#f4f6fc';
      var colorOficial = colores[0] || '';

      /* R83: mismo formato del lienzo principal — blanco al
         inicio, color del post clarito en el mismo tramo
         (15%-24%) y de vuelta al blanco. */
      area.style.background =
        'linear-gradient(180deg, ' +
          '#ffffff 0%, ' +
          '#ffffff 5%, ' +
          colorClaro + ' 15%, ' +
          colorClaro + ' 24%, ' +
          '#ffffff 36%, ' +
          '#ffffff 100%)';

      if (colorOficial) {
        area.style.setProperty('--post-color', colorOficial);
      } else {
        area.style.removeProperty('--post-color');
      }
    }

    /* R95 · PLANJSON NUEVO: array directo [{dias, horario, cupo}].
       Suma los cupos disponibles del post (null si no hay plan:
       posts sin horarios no se bloquean por esta vía). */
    function calcularTotalCupos(post) {
      if (!post || !Array.isArray(post.planJson)) return null;
      if (post.planJson.length === 0) return null;
      var total = 0;
      post.planJson.forEach(function (p) {
        total += Number(p.cupo || 0);
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
          /* R146 · DOS TEXTOS y un solo pintado inactivo. Vivo
             habla con meta.cta; pronto o cupos en cero hablan con
             meta.ctaInactivo (si el post no lo trae, cae al texto
             normal). El tenue lo pinta UNA regla general de
             Core_CSS sobre :disabled — nada de looks por caso. */
          var pj = postActivoGlobal.postJson || {};
          var meta = pj.meta || {};
          var estado = postActivoGlobal.estado || 'activo';

          if (estado === 'pronto') {
            /* PRONTO: sin acción y con su texto de inactivo. */
            btn.disabled = true;
            span.textContent = meta.ctaInactivo || meta.cta || 'Quiero reservar mi cupo';
          } else if (esModoWhatsapp(postActivoGlobal)) {
            btn.disabled = false;
            span.textContent = meta.cta || 'Quiero reservar mi cupo';
          } else {
            var totalCupos = calcularTotalCupos(postActivoGlobal);
            var inactivo = (totalCupos === 0);
            btn.disabled = inactivo;
            span.textContent = inactivo
              ? (meta.ctaInactivo || meta.cta || 'Quiero reservar mi cupo')
              : (meta.cta || 'Quiero reservar mi cupo');
          }
        }
      }

      actualizarDuda();
    }

    /* ============================================================
       R46 · DUDA DEL POST
       R76: meta.duda (antes meta.botonDuda). El resto igual.
       ============================================================ */
    function actualizarDuda() {
      var btn = document.querySelector('.cta-duda');
      if (!btn) return;

      var texto = '';
      if (postActivoGlobal) {
        var pj = postActivoGlobal.postJson || {};
        var meta = pj.meta || {};
        texto = String(meta.duda || '').trim();
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

    /* Click de la duda · R76: meta.duda + meta.mensajeDuda. */
    document.addEventListener('click', function (e) {
      var objetivo = e.target;
      if (!objetivo || !objetivo.closest) return;

      var btn = objetivo.closest('.cta-duda');
      if (!btn || btn.hidden) return;

      var post = postActivoGlobal;
      if (!post) return;

      var pj = post.postJson || {};
      var meta = pj.meta || {};

      var mensaje = String(meta.mensajeDuda || '').trim();
      if (!mensaje) return;

      var titulo = tituloDelPost(post);
      if (titulo) {
        /* R139: placeholder explícito {tituloPost}; el viejo
           {titulo} sigue funcionando para posts que aún lo
           traigan en la BD. */
        mensaje = mensaje.split('{tituloPost}').join(titulo);
        mensaje = mensaje.split('{titulo}').join(titulo);
      }

      var partner = buscarPartner(post.idPartner);
      var numero = partner && partner.partnerJson
        ? partner.partnerJson.whatsapp
        : '';
      if (!numero) return;

      if (typeof window.abrirWhatsapp === 'function') {
        window.abrirWhatsapp(numero, mensaje);

        if (window.Analitica) {
          window.Analitica.enviar('whatsapp_click', {
            post_id:    post.id || '',
            partner_id: post.idPartner || '',
            tipo:       'duda'
          });
        }
      }
    }, true);

    /* ============================================================
       R136 · AVISO TELEGRAM · CTA DEL POST
       Igual que el aviso del Open Ad (Opend_Ad_Script): cada click
       VÁLIDO del botón CTA dispara postBackend('avisoCTA') —
       FIRE-AND-FORGET: si algo falla, la acción del usuario ya
       corrió y nada se rompe; sin postBackend disponible se omite
       en silencio. El backend valida el idPost, deduplica por
       dispositivo+post (60s) y encola el aviso al bot del admin.
       Vive AQUÍ —antes del corte de WhatsApp por captura— para
       cubrir el CTA en AMBOS modos (reserva y whatsapp).
       ============================================================ */
    function avisarCTATelegram() {
      try {
        if (!postActivoGlobal || !postActivoGlobal.id) return;
        if (typeof window.postBackend !== 'function') return;
        var r = window.postBackend('avisoCTA', { idPost: postActivoGlobal.id });
        if (r && typeof r.catch === 'function') r.catch(function () {});
      } catch (_) {}
    }

    document.addEventListener('click', function (e) {
      var objetivo = e.target;
      if (!objetivo || !objetivo.closest) return;

      var btn = objetivo.closest('.cta-reservar');
      if (!btn) return;
      if (btn.disabled) return;

      /* R136 · el aviso viaja SIEMPRE que el click es válido
         (botón habilitado y post activo), sin importar el modo. */
      avisarCTATelegram();

      if (intentarWhatsapp()) {
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

      if (window.Analitica && e.detail && e.detail.idChip) {
        window.Analitica.enviar('chip_change', {
          chip_id: e.detail.idChip,
          city_id: window.Analitica.idCiudadActual()
        });
      }
    });

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
      try { document.dispatchEvent(new Event('app-lista')); } catch (_) {}
    }

    function cargarTablas() {
      var l2 = window.CacheL2.leerCatalogo();
      if (l2) {
        window.TABLAS.posts    = _postExpiraVivo_(l2.data.posts);   /* R119: expira en vivo también sobre el L2 */
        window.TABLAS.partners = l2.data.partners;
        datosListos = true;
        _revalidarCatalogo(l2.raw);
        return Promise.resolve();
      }

      return postBackend('catalogo')
        .then(function (data) {
          window.TABLAS.posts    = _postExpiraVivo_((data && Array.isArray(data.posts)) ? data.posts : []);   /* R119 */
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

    function _revalidarCatalogo(rawAnterior) {
      postBackend('catalogo', null, { mudo: true })
        .then(function (data) {
          if (!data || !Array.isArray(data.posts) ||
              !Array.isArray(data.partners)) return;

          window.TABLAS.posts    = _postExpiraVivo_(data.posts);   /* R119 */
          window.TABLAS.partners = data.partners;
          var rawNuevo = window.CacheL2.guardarCatalogo(data);

          if (rawAnterior && rawNuevo === rawAnterior) return;

          if (window.Lista && typeof window.Lista.getModo === 'function' &&
              window.Lista.getModo() === 'lista') {
            if (window.Promo && typeof window.Promo.construir === 'function') {
              window.Promo.construir();
            }
            if (typeof window.Lista.pintar === 'function') {
              /* R126 · mismo carril que Lista en ciudad:change /
                 orden:change: el campo buscar manda. Sin esto, un
                 repintado de fondo (catálogo L2 distinto) borraba
                 el filtro de la palabra — el receptor de un enlace
                 de lista compartida veía el campo con la palabra y
                 la lista COMPLETA. */
              var inputBuscar = document.getElementById('buscarInput');
              var terminoVivo = inputBuscar
                ? String(inputBuscar.value || '').trim()
                : '';

              if (terminoVivo &&
                  typeof window.Lista.pintarBusqueda === 'function') {
                window.Lista.pintarBusqueda(terminoVivo, false);
              } else {
                var chip = (window.Chips &&
                            typeof window.Chips.getChipActivo === 'function')
                  ? window.Chips.getChipActivo() : null;
                window.Lista.pintar(chip, null);
              }
            }
          }
        })
        .catch(function () {});
    }

    /* ============================================================
       TÍTULO INICIAL · vector aleatorio desde ROOTJSON
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

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(lienzo);
      }

      arrancarComponentes();

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          avisarAlPadre();

          if (window.Analitica) {
            window.Analitica.enviar('app_ready', {
              ciudad: window.Analitica.idCiudadActual()
            });
          }
        });
      });
    }

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
              '<div class="lista-skeleton-pie">' +
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

      mostrarSkeletonLista();

      if (promesaCarga) {
        promesaCarga.then(repintar);
      } else {
        repintar();
      }
    }

    function arrancarComponentes() {
      if (window.Ciudad && typeof window.Ciudad.engancharBoton === 'function') {
        window.Ciudad.engancharBoton();
      }

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
      if (window.Compartir && typeof window.Compartir.pintar === 'function') {
        window.Compartir.pintar();
      }

      pintarTituloHeader();
      pintarPlaceholderBuscar();
      pintarAreaConPost(null);
      actualizarTextoCTA();
    }

    document.addEventListener('ciudad:change', function (e) {
      if (window.Lista && typeof window.Lista.getModo === 'function' &&
          window.Lista.getModo() === 'detalle') {
        window.Lista.cerrarDetalle(true);
      }

      if (window.Chips &&
          typeof window.Chips.resetearVista === 'function') {
        window.Chips.resetearVista();
      } else {
        try { localStorage.removeItem('app_vista'); } catch (_) {}
      }

      repintarCuandoHayaDatos();

      if (window.Puente) window.Puente.guardar();

      if (window.Analitica && e.detail && e.detail.idCiudad) {
        window.Analitica.enviar('city_change', {
          city_id:   e.detail.idCiudad,
          city_name: (e.detail.titulo ? String(e.detail.titulo) : '')
        });
      }
    });

    function arranque() {
      var pre = (typeof window.asegurarSesion === 'function')
        ? window.asegurarSesion()
        : Promise.resolve();

      promesaCarga = pre.then(function () {
        return cargarTablas();
      });

      pre.then(function () {
        window.Puente.pedirEstado().then(function (estado) {
          window.Puente.aplicarEstado(estado);

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

    var ULTIMO_REFRESH_MS   = 0;
    var THROTTLE_REFRESH_MS = 60 * 1000;

    function refrescarCatalogo() {
      return postBackend('catalogo', null, { mudo: true })
        .then(function (data) {
          if (data && Array.isArray(data.posts))     window.TABLAS.posts    = _postExpiraVivo_(data.posts);   /* R119 */
          if (data && Array.isArray(data.partners))  window.TABLAS.partners = data.partners;
          window.CacheL2.guardarCatalogo(data);
        })
        .catch(function (err) {
          console.warn('[Core] No se pudo refrescar catálogo:', err.message);
        });
    }

    function refrescarPreguntasSiAplican() {
      if (window.Pregunta &&
          typeof window.Pregunta.estaAbierto === 'function' &&
          window.Pregunta.estaAbierto() &&
          typeof window.Pregunta.refrescar === 'function') {
        window.Pregunta.refrescar();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      var ahora = Date.now();
      if (ahora - ULTIMO_REFRESH_MS < THROTTLE_REFRESH_MS) return;
      ULTIMO_REFRESH_MS = ahora;

      refrescarCatalogo();
      refrescarPreguntasSiAplican();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

  })();

  /* ============================================================
     AVISO «TE RESPONDIÓ» · R151 · window.AvisoRespuesta
     Despierta la clase centralizada .notificacionFlotante
     (Core_CSS R151, GAS + Github). Va dormida hasta que ESTE
     módulo la enciende con .visible.
     · CUÁNDO SE REVISA: al abrir la app (5 s después de cargar,
       con la sesión y el catálogo ya en vuelo), en cada entrada
       a un post (evento post:change de Lista) y cada 60 s
       mientras la app esté abierta. Throttle propio de 15 s:
       abrir la app y entrar a un post casi juntos no duplican
       la llamada.
     · QUÉ DISPARA EL AVISO: SOLO la respuesta del partner —
       preguntas de ESTE dispositivo con RESPUESTA en la BD y
       sin marcar VISTO (respuestasPendientes, 02 Acciones.gs).
       Nada de tiempo transcurrido, nada de preguntas nuevas.
     · LA TARJETA ES FIJA (orden del dueño): sin temporizador.
       Se queda hasta que el dueño de la pregunta actúe:
       · X → marca VISTO y punto (ya perdió su oportunidad);
       · tap en la tarjeta → abre EL post de esa respuesta y
         marca VISTO.
       Tras actuar, sale con la animación y recién entonces
       sube la siguiente pendiente, si la hay — una a la vez,
       nunca un bloque. Mientras hay tarjeta fija, las
       revisiones SOLO observan: no apilan nada encima.
     · VISTO SE MARCA AL ACTUAR (no al mostrar): cerrar la app
       con la tarjeta fija sin actuar no pierde nada — lo
       pendiente reavisa en el próximo arranque.
     · R155 · VISTO AL ABRIR EL POST: entrar a un post con
       pendientes PROPIOS los resuelve en el acto (la respuesta
       se está leyendo ahora mismo): accionMarcarVisto con la
       LISTA de filas, fuera de la cola (_tratadas) y, si la
       tarjeta fija era de ese post, se resuelve y sube la
       siguiente. Abrir OTRO post no toca nada (el filtro es
       por idPost).
     · EL TEXTO: nombre del partner (BD, cacheado) + espacio +
       ROOTJSON.app.avisoRespuesta. CERO constantes de texto
       aquí: lo que se dice SIEMPRE lo manda el Setup (el dueño
       lo cambia sin tocar código). Sin nada que decir, no
       nace tarjeta.
     · ANTI-CARRERA: lo resuelto en esta sesión (_tratadas) no
       vuelve, aunque la lectura de la BD corra junto a la
       marca VISTO de la acción.
     · TODO SILENCIOSO: si algo falla, la app ni se entera.
     ============================================================ */
  window.AvisoRespuesta = (function () {
    var ARRANQUE_MS    = 5000;        /* primera revisión tras abrir */
    var CADA_MS        = 60 * 1000;   /* revisión de rutina */
    var GAP_MINIMO_MS  = 15 * 1000;   /* anti-ráfaga entre revisiones */
    var PAUSA_ENTRE_MS = 450;         /* salida (.visible 0.28s) + aire */
    var TOPE           = 20;          /* el backend ya topa en 20 */

    var _restantes      = [];         /* pendientes sin tratar (última revisión) */
    var _tratadas       = {};         /* filas resueltas EN ESTA sesión */
    var _enPantalla     = false;      /* hay tarjeta fija esperando acción */
    var _elemento       = null;
    var _lineaTexto     = null;
    var _temporizador   = null;
    var _ultimaRevision = 0;

    /* El texto lo manda el Setup — CERO constantes aquí. */
    function textoBD() {
      try {
        var app = (window.SISTEMA && window.SISTEMA.root &&
                   window.SISTEMA.root.app) || null;
        return app ? String(app.avisoRespuesta || '').trim() : '';
      } catch (_) {
        return '';
      }
    }

    /* La línea del aviso: nombre del partner + texto de la BD.
       Sin nombre queda el texto solo; sin NADA que decir, la
       tarjeta no nace (no inventa texto). */
    function textoDe(item) {
      var nombre = (item && item.partner) ? String(item.partner).trim() : '';
      return (nombre ? nombre + ' ' : '') + textoBD();
    }

    function asegurarElemento() {
      if (_elemento) return _elemento;
      _elemento = document.createElement('div');
      _elemento.className = 'notificacionFlotante';
      _elemento.setAttribute('role', 'status');
      _elemento.setAttribute('aria-live', 'polite');
      _lineaTexto = document.createElement('div');
      _lineaTexto.className = 'textoPrimario';
      _elemento.appendChild(_lineaTexto);
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'avisoCerrar';
      x.setAttribute('aria-label', 'Cerrar aviso');
      x.setAttribute('data-glifo', 'close');
      x.addEventListener('click', function (evento) {
        evento.stopPropagation();   /* la X NO abre el post: solo cierra */
        actuar();
      });
      _elemento.appendChild(x);
      _elemento.addEventListener('click', function () {
        var item = _restantes[0];
        if (item && item.idPost && window.Lista &&
            typeof window.Lista.abrirDetalle === 'function') {
          window.Lista.abrirDetalle(item.idPost);
        }
        actuar();
      });
      document.body.appendChild(_elemento);
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(_elemento);
      return _elemento;
    }

    function mostrarSiguiente() {
      if (_enPantalla || document.hidden) return;
      var linea = '';
      while (_restantes.length && !linea) {
        linea = textoDe(_restantes[0]);
        if (!linea) _restantes.shift();   /* sin nada que decir: se salta */
      }
      if (!linea) return;
      asegurarElemento();
      _lineaTexto.textContent = linea;
      _enPantalla = true;
      _elemento.classList.add('visible');
    }

    /* ÚNICA salida de la tarjeta: la X o el tap en ella. AMBAS
       marcan VISTO en la BD — la X y punto («ya perdió su
       oportunidad»), el tap porque la respuesta ya se leyó en
       el post. Después sube la siguiente, si la hay. */
    function actuar() {
      if (_temporizador) { clearTimeout(_temporizador); _temporizador = null; }
      var item = _restantes.shift();
      if (item) {
        _tratadas[item.fila] = true;
        if (typeof window.postBackend === 'function') {
          window.postBackend('marcarVisto', { marcas: [{ fila: item.fila }] })
            .catch(function () { /* silencioso: nada depende del eco */ });
        }
      }
      _enPantalla = false;
      if (_elemento) _elemento.classList.remove('visible');
      _temporizador = setTimeout(function () {
        if (!_enPantalla && _restantes.length) mostrarSiguiente();
      }, PAUSA_ENTRE_MS);
    }

    /* R155 · VISTO AL ABRIR EL POST · resolverPorPost(idPost):
       los pendientes DEL post que el usuario está abriendo se
       resuelven aquí y ahora (los está leyendo). La marca
       viaja IGUAL que la X: accionMarcarVisto con la lista de
       filas — CERO .gs nuevos. Abrir OTRO post no toca nada:
       el filtro es por idPost. Anti-carrera: _tratadas evita
       el doble marcaje si el tap de la tarjeta ya resolvió el
       ítem antes de que post:change llegue. */
    function resolverPorPost(idPost) {
      if (!idPost) return;
      var mias = [];
      var i;
      for (i = 0; i < _restantes.length; i++) {
        var p = _restantes[i];
        if (p && !_tratadas[p.fila] &&
            String(p.idPost || '') === String(idPost)) {
          mias.push(p);
        }
      }
      if (!mias.length) return;

      for (i = 0; i < mias.length; i++) _tratadas[mias[i].fila] = true;
      _restantes = _restantes.filter(function (p) {
        return !(p && String(p.idPost || '') === String(idPost));
      });

      if (typeof window.postBackend === 'function') {
        var marcas = [];
        for (i = 0; i < mias.length; i++) marcas.push({ fila: mias[i].fila });
        window.postBackend('marcarVisto', { marcas: marcas })
          .catch(function () { /* silencioso: nada depende del eco */ });
      }

      /* ¿la tarjeta fija en pantalla era de ESTE post? Se
         resuelve: sale con la animación y recién entonces
         sube la siguiente, si la hay. */
      if (_enPantalla) {
        if (_temporizador) { clearTimeout(_temporizador); _temporizador = null; }
        _enPantalla = false;
        if (_elemento) _elemento.classList.remove('visible');
        _temporizador = setTimeout(function () {
          if (!_enPantalla && _restantes.length) mostrarSiguiente();
        }, PAUSA_ENTRE_MS);
      }
    }

    function revisar() {
      if (_enPantalla || document.hidden) return;   /* tarjeta fija: solo observa */
      if (typeof window.postBackend !== 'function') return;
      var ahora = Date.now();
      if (ahora - _ultimaRevision < GAP_MINIMO_MS) return;
      _ultimaRevision = ahora;

      window.postBackend('respuestasPendientes', {})
        .then(function (data) {
          if (_enPantalla || document.hidden) return;
          var lista = ((data && data.pendientes) || []).slice(0, TOPE);
          _restantes = lista.filter(function (p) { return p && !_tratadas[p.fila]; });
          if (_restantes.length) mostrarSiguiente();
        })
        .catch(function () { /* silencioso: el aviso no molesta */ });
    }

    setTimeout(revisar, ARRANQUE_MS);
    setInterval(revisar, CADA_MS);
    document.addEventListener('post:change', revisar);
    /* R155 · post:change también resuelve: los pendientes del
       post que se abre marcan VISTO al instante (ver
       resolverPorPost). Abrir OTRO post no toca nada. */
    document.addEventListener('post:change', function (e) {
      resolverPorPost(e.detail && e.detail.idPost);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) revisar();
    });

    return { revisar: revisar };
  })();

  /* ============================================================
     R157 · SWIPE DE CHIPS · window.SwipeChips
     El arrastre horizontal sobre la lista cambia de chip con el
     MISMO camino del click: window.Chips.seleccionar(idDestino)
     → activarChip → chips:change. Una sola fuente de verdad.
     SOLUCIÓN ALTERNA pedida por el dueño tras la R155+R156:
     «dame una solución alterna, pero hay que darle la
     sensación al usuario de que sí está pasando a la
     siguiente pantalla».
     · DIRECCIÓN ANCLADA A LA PANTALLA (corazón del arreglo):
       los vecinos se MIDEN con getBoundingClientRect de los
       chips visibles comparando CENTROS con el chip activo.
       El que queda a la DERECHA del activo ES el SIGUIENTE y
       entra al ARRASTRAR A LA IZQUIERDA; el de la izquierda,
       al arrastrar a la derecha. Lo que se ve manda: ni el
       orden del arreglo ni el del DOM pueden invertirlo.
     · FRANJA DE ASOMA (infalible): un div fijo con el NOMBRE
       REAL del vecino (.swipe-franja, Core_CSS) asoma por el
       borde por donde entra la otra pantalla — derecha al
       tirar a la izquierda, izquierda al tirar a la derecha —
       y CRECE con el dedo desde el primer píxel. Un solo
       elemento: cero clones, cero capas fantasma, nada que
       pueda morir en silencio (la lección R155/R156).
     · PANTALLA VIVA: la lista viaja AMORTIGUADA con el dedo
       (0.22 del recorrido, tope 34px; en los extremos, muro
       de 8px — sin ciclo jamás). Al soltar dentro del umbral,
       todo regresa.
     · CONFIRMACIÓN: 25% del ancho o flick (0.45 px/ms hacia
       el mismo lado). Al cruzar, el chip destino se PRENDE
       (.chip.prendido). Al soltar FUERA: la lista SALE hacia
       el lado del gesto (0.16s, espejo de la llegada) y el
       cambio viaja por el MISMO camino del click; chips:change
       repinta y la lista LLEGA (.llega-derecha /
       .llega-izquierda, Core_CSS).
     · SOLO procede: gesto táctil, dentro de la lista, en modo
       lista, SIN búsqueda activa, sin empezar en los 24px de
       los bordes de pantalla (ahí viven los gestos de
       atrás/adelante del navegador) y con vecino en esa
       dirección (los extremos NO ciclan).
     · LOCK DE EJE 10px: hasta que el horizontal domina, el
       scroll vertical sigue siendo del sistema (preventDefault
       solo después del lock). Vertical al inicio = el gesto
       se retira sin tocar nada.
     · Cifras del gesto (todas locales, nada mágico):
       bordes 24px · eje 10px · umbral 25% · flick 0.45 px/ms ·
       viaje 0.22 (tope 34px) · muro 8px · franja 10→56px ·
       salida 0.16s / 72px.
     ============================================================ */
  window.SwipeChips = (function () {

    var BORDE_EXCLUIDO = 24;   /* bordes de pantalla excluidos */
    var LOCK_EJE_PX    = 10;   /* px para decidir el eje */
    var UMBRAL_FRACC   = 0.25; /* 25% del ancho de la lista */
    var FLICK_PX_MS    = 0.45; /* velocidad del flick */
    var FLICK_MIN_PX   = 30;   /* flick con andar mínimo */
    var VIAJE_K        = 0.22; /* amortiguación del viaje 1:dedo */
    var VIAJE_TOPE     = 34;   /* tope del viaje (px) */
    var MURO_TOPE      = 8;    /* resistencia en extremos (px) */
    var FRANJA_BASE    = 10;   /* asomo mínimo de la franja (px) */
    var FRANJA_TOPE    = 56;   /* asomo al cruzar el umbral (px) */
    var SALIDA_MS      = 160;  /* salida de la lista al confirmar */
    var SALIDA_PX      = 72;   /* distancia de salida (espejo 64) */

    var _tocoId = null;        /* touch identifier del gesto */
    var _x0 = 0, _y0 = 0;
    var _xViejo = 0, _tViejo = 0, _vel = 0;
    var _ancho     = 0;        /* ancho de la lista (umbral) */
    var _bloqueado = false;    /* eje horizontal decidido */
    var _vecinos   = null;     /* { idIzq, idDer } medidos en pantalla */
    var _lado      = 0;        /* -1 siguiente · +1 anterior */
    var _destino   = null;     /* idChip destino (null = extremo) */
    var _franja    = null;     /* el div del asoma (singleton) */
    var _franjaTxt = null;     /* su texto (nombre del vecino) */
    var _franjaLado = 0;       /* último lado pintado */
    var _enSalida  = false;    /* confirmación aterrizando */
    var _llegada   = null;     /* clase de llegada pendiente */

    function lista() { return document.getElementById('listaWrap'); }
    function scrollWrap() { return document.querySelector('.secciones-wrap'); }

    function signo(n) { return n > 0 ? 1 : (n < 0 ? -1 : 0); }

    /* VECINOS REALES DE PANTALLA (R157 · corazón del arreglo):
       se miden los rectángulos de los chips visibles y se
       comparan CENTROS con el activo. Derecha del centro
       activo = siguiente; izquierda = anterior. Lo que decide
       el gesto es lo MISMO que el dueño ve — el debate de
       órdenes (arreglo, DOM, pintura) queda muerto para
       siempre. */
    function medirVecinos() {
      var vacio = { idIzq: null, idDer: null };
      var cont = document.getElementById('filtros');
      if (!cont) return vacio;
      var activo = cont.querySelector('.chip.activo');
      if (!activo) return vacio;
      var ra = activo.getBoundingClientRect();
      var centroActivo = ra.left + ra.width / 2;
      var chips = cont.querySelectorAll('.chip');
      var idIzq = null, idDer = null;
      var mejorIzq = -Infinity, mejorDer = Infinity;
      for (var i = 0; i < chips.length; i++) {
        var c = chips[i];
        if (c === activo) continue;
        var r = c.getBoundingClientRect();
        if (!r.width && !r.height) continue;   /* oculto */
        var centro = r.left + r.width / 2;
        if (centro < centroActivo && centro > mejorIzq) {
          mejorIzq = centro;
          idIzq = c.getAttribute('data-chip');
        }
        if (centro > centroActivo && centro < mejorDer) {
          mejorDer = centro;
          idDer = c.getAttribute('data-chip');
        }
      }
      return { idIzq: idIzq, idDer: idDer };
    }

    /* El NOMBRE REAL del vecino, leído del chip pintado (el
       mismo texto que el dueño ve en la fila — cero strings
       hardcodeadas). */
    function tituloDeChip(idChip) {
      var cont = document.getElementById('filtros');
      if (!cont || !idChip) return '';
      var c = cont.querySelector('.chip[data-chip="' + idChip + '"]');
      var t = c ? c.querySelector('.chip-texto') : null;
      return t ? (t.textContent || '') : '';
    }

    function busquedaActiva() {
      var input = document.getElementById('buscarInput');
      return !!(input && String(input.value || '').trim());
    }

    function enModoLista() {
      return !!(window.Lista && typeof window.Lista.getModo === 'function' &&
                window.Lista.getModo() === 'lista');
    }

    /* El prendido del chip destino (.chip.prendido, Core_CSS).
       Con prende=false se apaga en TODOS (limpieza garante). */
    function prender(idChip, prende) {
      var cont = document.getElementById('filtros');
      if (!cont) return;
      var todos = cont.querySelectorAll('.chip');
      for (var i = 0; i < todos.length; i++) {
        var es = !!(prende && idChip &&
                    todos[i].getAttribute('data-chip') === idChip);
        todos[i].classList.toggle('prendido', es);
      }
    }

    /* LA FRANJA · nace UNA vez, vive en el body, no captura
       toques (pointer-events none) y su texto es el nombre
       REAL del vecino. aria-hidden: es la decoración del
       gesto; el cambio de pantalla lo anuncia chips:change. */
    function franja() {
      if (_franja) return _franja;
      var f = document.createElement('div');
      f.className = 'swipe-franja swipe-franja-der';
      f.setAttribute('aria-hidden', 'true');
      var chev = document.createElement('span');
      chev.className = 'swipe-franja-chev';
      f.appendChild(chev);
      _franjaTxt = document.createElement('span');
      _franjaTxt.className = 'swipe-franja-txt chipsFiltros';
      f.appendChild(_franjaTxt);
      document.body.appendChild(f);
      _franja = f;
      return f;
    }

    /* La franja ENTRA según el avance del dedo: 10px apenas
       arranca, 56px al cruzar el umbral. El % de translateX
       es su PROPIO ancho: cero mediciones de layout por
       frame. translateY(-50%) del CSS viaja en CADA
       transform (el inline lo pisa). */
    function pintarFranja(lado, dx, umbral) {
      var idVecino = (lado === -1) ? _vecinos.idDer : _vecinos.idIzq;
      if (!idVecino) { ocultarFranja(); return; }
      var f = franja();
      var titulo = tituloDeChip(idVecino);
      if (lado !== _franjaLado || titulo !== _franjaTxt.textContent) {
        _franjaLado = lado;
        _franjaTxt.textContent = titulo;
        if (lado === -1) {
          f.classList.add('swipe-franja-der');
          f.classList.remove('swipe-franja-izq');
        } else {
          f.classList.add('swipe-franja-izq');
          f.classList.remove('swipe-franja-der');
        }
      }
      var prog = Math.max(0, Math.min(1, Math.abs(dx) / umbral));
      var revela = FRANJA_BASE + prog * (FRANJA_TOPE - FRANJA_BASE);
      f.style.opacity = String(Math.min(1, 0.35 + prog * 0.9));
      f.style.transform = (lado === -1)
        ? 'translateY(-50%) translateX(calc(100% - ' + revela + 'px))'
        : 'translateY(-50%) translateX(calc(-100% + ' + revela + 'px))';
    }

    function ocultarFranja() {
      if (!_franja) return;
      _franja.style.opacity = '0';
      _franja.style.transform = (_franjaLado === 1)
        ? 'translateY(-50%) translateX(-110%)'
        : 'translateY(-50%) translateX(110%)';
      _franjaLado = 0;
    }

    /* INICIO del toque: solo se postula (nada se bloquea aún).
       Filtros de nacimiento: táctil, un dedo, dentro de la
       lista, modo lista, sin búsqueda y sin bordes de
       pantalla. */
    function alEmpezar(e) {
      if (_tocoId !== null || e.touches.length !== 1) return;
      if (_enSalida) return;   /* la confirmación está aterrizando */
      if (!enModoLista() || busquedaActiva()) return;

      var t = e.touches[0];
      var w = window.innerWidth || document.documentElement.clientWidth;
      if (t.clientX < BORDE_EXCLUIDO || t.clientX > w - BORDE_EXCLUIDO) return;

      var cont = lista();
      if (!cont || cont.hidden || !cont.firstChild) return;
      if (!(t.target && cont.contains(t.target))) return;

      _tocoId = t.identifier;
      _x0 = t.clientX; _y0 = t.clientY;
      _xViejo = _x0; _tViejo = e.timeStamp; _vel = 0;
      _bloqueado = false;
      _lado = 0; _destino = null; _llegada = null;
    }

    /* MOVIMIENTO: primero decide el eje (10px); después manda
       el horizontal: la lista viaja amortiguada con el dedo y
       la FRANJA del vecino asoma por SU borde, creciendo con
       el recorrido. */
    function alMover(e) {
      if (_tocoId === null) return;
      var t = null;
      for (var i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === _tocoId) { t = e.touches[i]; break; }
      }
      if (!t) return;

      var dx = t.clientX - _x0;
      var dy = t.clientY - _y0;

      if (!_bloqueado) {
        if (Math.abs(dx) < LOCK_EJE_PX && Math.abs(dy) < LOCK_EJE_PX) return;
        if (Math.abs(dy) >= Math.abs(dx)) { soltarNada(); return; }
        var cont0 = lista();
        if (!cont0) { soltarNada(); return; }
        _bloqueado = true;
        _ancho = cont0.getBoundingClientRect().width || 1;
        _vecinos = medirVecinos();   /* la PANTALLA manda (R157) */
      }

      e.preventDefault();   /* el horizontal es nuestro */

      _lado = signo(dx);
      /* tirar a la IZQUIERDA = vecino DERECHO · a la derecha =
         vecino IZQUIERDO. Medido en pantalla, no en arreglos. */
      _destino = (_lado === -1) ? _vecinos.idDer : _vecinos.idIzq;

      var dt = e.timeStamp - _tViejo;
      if (dt > 0) {
        _vel = _vel * 0.7 + ((t.clientX - _xViejo) / dt) * 0.3;
      }
      _xViejo = t.clientX; _tViejo = e.timeStamp;

      var cruzo = !!_destino && (
        Math.abs(dx) >= _ancho * UMBRAL_FRACC ||
        (Math.abs(_vel) >= FLICK_PX_MS &&
         signo(_vel) === _lado && Math.abs(dx) > FLICK_MIN_PX));

      /* la lista se siente viva: viaje amortiguado (o muro en
         el extremo, donde NO hay vecino) */
      var cont = lista();
      if (cont) {
        var viaje = _destino
          ? dx * VIAJE_K
          : _lado * Math.min(Math.abs(dx) * VIAJE_K, MURO_TOPE);
        if (viaje > VIAJE_TOPE) viaje = VIAJE_TOPE;
        if (viaje < -VIAJE_TOPE) viaje = -VIAJE_TOPE;
        cont.style.transition = 'none';
        cont.style.transform = 'translateX(' + viaje + 'px)';
      }

      /* el asoma: franja del vecino por SU borde, creciendo */
      if (_destino) pintarFranja(_lado, dx, _ancho * UMBRAL_FRACC);
      else ocultarFranja();

      prender(_destino, cruzo);
    }

    /* SUELTA · dentro del umbral: TODO vuelve (rebote). Fuera
       (o flick): CONFIRMA por el mismo camino del click. */
    function alSoltar(e) {
      if (_tocoId === null) return;
      for (var i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === _tocoId) return;   /* otro dedo vive */
      }
      var t = null;
      var toques = e.changedTouches || [];
      for (var j = 0; j < toques.length; j++) {
        if (toques[j].identifier === _tocoId) t = toques[j];
      }
      _tocoId = null;
      if (!_bloqueado) return;   /* nunca se trabó: fue scroll */

      var dx = t ? (t.clientX - _x0) : (_xViejo - _x0);
      var destino = _destino;
      var cruzando = !!destino && (
        Math.abs(dx) >= _ancho * UMBRAL_FRACC ||
        (Math.abs(_vel) >= FLICK_PX_MS &&
         signo(_vel) === signo(dx) && Math.abs(dx) > FLICK_MIN_PX));

      if (cruzando) confirmar(destino);
      else rebotar();
    }

    function alCancelar() {
      if (_tocoId === null) return;
      _tocoId = null;
      if (_bloqueado) rebotar();
      else soltarNada();
    }

    /* CONFIRMA · la lista SALE hacia el lado del gesto (espejo
       de la llegada), la franja se retira, el prendido se
       limpia y el cambio viaja por el MISMO camino del click
       (Chips.seleccionar → chips:change). El receptor de
       chips:change levanta la llegada desde el lado del gesto
       (.llega-derecha / .llega-izquierda). Con
       prefers-reduced-motion: cambio seco, sin salida. */
    function confirmar(idDestino) {
      var reduce = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var lado = _lado;
      _llegada = (lado === -1) ? 'llega-derecha' : 'llega-izquierda';

      ocultarFranja();
      prender(null, false);
      _lado = 0; _destino = null;

      if (!reduce) {
        var cont = lista();
        if (cont) {
          var salirX = (lado === -1) ? -SALIDA_PX : SALIDA_PX;
          cont.style.transition =
            'transform ' + (SALIDA_MS / 1000) + 's ease, opacity ' +
            (SALIDA_MS / 1000) + 's ease';
          cont.style.transform = 'translateX(' + salirX + 'px)';
          cont.style.opacity = '0.4';
        }
      }
      _enSalida = true;

      setTimeout(function () {
        if (window.Chips && typeof window.Chips.seleccionar === 'function') {
          window.Chips.seleccionar(idDestino);
        }
        var c = lista();
        if (c) {
          c.style.transition = '';
          c.style.transform = '';
          c.style.opacity = '';
        }
        _enSalida = false;
      }, reduce ? 0 : SALIDA_MS + 10);
    }

    /* REBOTA · sin cruzar el umbral (o extremo): la lista
       regresa a su sitio con una molla suave y la franja se
       retira. Cero clones que limpiar: la lista NUNCA dejó
       de ser la lista. */
    function rebotar() {
      ocultarFranja();
      prender(null, false);

      var cont = lista();
      if (cont) {
        cont.style.transition =
          'transform 0.24s cubic-bezier(0.2, 0.8, 0.3, 1)';
        cont.style.transform = 'translateX(0)';
        setTimeout(function () {
          if (_tocoId !== null) return;   /* nuevo gesto vivo: no tocar */
          cont.style.transition = '';
          cont.style.transform = '';
        }, 260);
      }
      _lado = 0; _destino = null;
    }

    /* El gesto se retira sin haberse trabado (vertical ganó o
       sin condiciones): cero efectos, cero rastros. */
    function soltarNada() {
      _tocoId = null; _bloqueado = false;
      _lado = 0; _destino = null;
      ocultarFranja();
    }

    /* LLEGADA · tras confirmar, chips:change repinta la lista
       (mismo camino del click) y aquí la anima desde el lado
       del gesto. Sin _llegada (click normal) no hace NADA. */
    document.addEventListener('chips:change', function () {
      if (!_llegada) return;
      var cont = lista();
      var clase = _llegada;
      _llegada = null;
      if (!cont) return;
      cont.classList.add(clase);
      cont.addEventListener('animationend', function alLlegar(ev) {
        if (ev.target !== cont) return;
        cont.classList.remove('llega-derecha', 'llega-izquierda');
        cont.style.transition = '';
        cont.style.transform = '';
        cont.style.opacity = '';
        cont.removeEventListener('animationend', alLlegar);
      });
    });

    /* Solo teléfonos/tabletas: en escritorio el módulo no
       existe (cero listeners, cero impacto). */
    var wrap = scrollWrap();
    if (wrap && 'ontouchstart' in window) {
      wrap.addEventListener('touchstart', alEmpezar, { passive: true });
      wrap.addEventListener('touchmove', alMover, { passive: false });
      wrap.addEventListener('touchend', alSoltar, { passive: true });
      wrap.addEventListener('touchcancel', alCancelar, { passive: true });
    }

    return { nada: null };   /* todo vive en sus listeners */
  })();
