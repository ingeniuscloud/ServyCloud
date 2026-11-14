/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Script.html
ESPEJO GITHUB:   github/js/Core_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: El NÚCLEO de la página: coordinador y ciclo de
                 vida. Los empleados viven en sus propios módulos
                 (Core_Memoria la memoria, Core_Aviso el aviso,
                 Core_Post el post abierto, Core_Swipe el
                 desplazamiento).
                 · window.Puente — persistencia de preferencias vía
                 envoltorio: pedirEstado/aplicarEstado/guardar con
                 la ventana contenedora (postMessage), ciudad y
                 vista.
                 · window.Analitica — Capa 1 GA4: eventos blancos,
                 con puente se retransmite y sin él van directos a
                 gtag de la página.
                 · DATOS: cargarTablas (L2 primero, backend
                 después, stale-while-revalidate), la VIDA del post
                 en el teléfono (_postExpiraVivo_: la ventana
                 meta.expira se filtra en vivo con el reloj local),
                 refrescar catálogo al volver la app a primer plano
                 (throttle 60 s) y revalidación muda del catálogo.
                 · LIENZO: inyección del template, esqueleto de
                 lista (en la página activa del carril), título del
                 encabezado y placeholder del buscador desde
                 ROOTJSON, arranque de componentes y detección de
                 móvil (is-mobile).
                 · ARRANQUE: sesión → estado del puente → entradas
                 compartidas / ciudad pendiente / lienzo.
VERSIÓN:         1.45.1
CAMBIOS:         R175: el catálogo que llega TARDE vuelve a pintar
                 la tira. Dos huecos cerrados: (1) un catálogo ok
                 pero VACÍO al primer arranque montaba la
                 recepción de un enlace compartido con páginas
                 de FIRMA vacía y NADA las repintaba jamás (el
                 receptor veía ciudad y chip correctos y la lista
                 en blanco hasta mover chips) → un revalidado mudo
                 de rescate trae el catálogo real y repinta; (2)
                 el relleno tardío del visibilitychange
                 (refrescarCatalogo) llenaba TABLAS sin tocar la
                 vista → mismo carril que _revalidarCatalogo:
                 repinta respetando el modo y el término vivo.
                 R173: el repintado de fondo del catálogo ya no
                 consulta el campo buscar — el término es ESTADO
                 de Lista y pintarTodo lo respeta en cada chip.
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Global_Script.html (postBackend, asegurarSesion,
                 _mostrarErrorRed),
                 Core_Memoria_Script.html (window.CacheL2,
                 window.PostFull),
                 Index.html (SISTEMA, TOKEN, URL_EXEC),
                 Lista_Script.html (window.Lista),
                 Lista_Detalle_Script.html (window.ListaDetalle),
                 Seccion_Script.html
                 (window.Secciones), Chips_Script.html,
                 Pregunta_Script.html (window.Pregunta),
                 Reserva_Script.html y hojas de reserva, Iconos.html
════════════════════════════════════════════════════════════════════*/

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

        /* los eventos NO mueren si no hay puente: en la app única
           window.Puente puede no existir y el return viejo mataba
           TODA la Capa 1 GA4. Ahora: con puente se retransmite
           (legado); sin puente el evento va DIRECTO a gtag de la
           página (index.html lo carga); si gtag no está (DNT o
           bloqueo), queda en nada. */
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
     NÚCLEO · datos, lienzo y ciclo de vida
     ============================================================ */
  (function () {
    var promesaCarga = null;
    var datosListos = false;
    var _ultimoPost = null;   /* el post del último post:change (post_close con el ANTERIOR, como siempre) */

    /* VIDA DEL POST en el teléfono: filtra los posts cuya ventana
       meta.expira ya pasó (reloj local, la misma gramática del
       backend). Cubre el hueco TTL: catálogo cargado a las 22:00,
       post muerto a las 23:00 → el teléfono lo excluye en vivo
       sin esperar la próxima descarga. Sin expira, fecha ilegible
       o entrada rara = pasa intacta (NUNCA tumba el catálogo por
       datos malos). */
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

    /* ============================================================
       DATOS · L2 primero, backend después (stale-while-revalidate)
       ============================================================ */
    function cargarTablas() {
      var l2 = window.CacheL2.leerCatalogo();
      if (l2) {
        window.TABLAS.posts    = _postExpiraVivo_(l2.data.posts);
        window.TABLAS.partners = l2.data.partners;
        datosListos = true;
        _revalidarCatalogo(l2.raw);
        return Promise.resolve();
      }

      return postBackend('catalogo')
        .then(function (data) {
          window.TABLAS.posts    = _postExpiraVivo_((data && Array.isArray(data.posts)) ? data.posts : []);
          window.TABLAS.partners = (data && Array.isArray(data.partners)) ? data.partners : [];
          datosListos = true;
          window.CacheL2.guardarCatalogo(data);

          /* R175 · SEGUNDA OPORTUNIDAD DEL CATÁLOGO VACÍO: una
             respuesta ok pero SIN posts (pico del backend, red
             caprichosa) dejaba la app pintada vacía para
             SIEMPRE: la recepción de un enlace compartido monta
             sus páginas con FIRMA vacía y ningún evento vuelve a
             repintarlas — el receptor veía ciudad y chip
             correctos y la lista en blanco hasta mover chips.
             Un solo revalidado mudo de rescate: trae el catálogo
             real (rawAnterior null → aunque el raw coincida, se
             repinta) y pintarTodo respeta el modo y el término
             vivo. Un catálogo LEGÍTIMAMENTE vacío solo paga una
             llamada más. */
          if (!window.TABLAS.posts.length) {
            _revalidarCatalogo(null);
          }
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

          window.TABLAS.posts    = _postExpiraVivo_(data.posts);
          window.TABLAS.partners = data.partners;
          var rawNuevo = window.CacheL2.guardarCatalogo(data);

          if (rawAnterior && rawNuevo === rawAnterior) return;

          if (window.Lista && typeof window.Lista.getModo === 'function' &&
              window.Lista.getModo() === 'lista') {
            if (window.Promo && typeof window.Promo.construir === 'function') {
              window.Promo.construir();
            }
            if (typeof window.Lista.pintarTodo === 'function') {
              /* R173 · el término de búsqueda es ESTADO de Lista:
                 pintarTodo repinta la TIRA COMPLETA y postsDeChip
                 aplica el filtro en cada chip. Un repintado de
                 fondo (catálogo L2 distinto) jamás devuelve la
                 lista general mientras la palabra está — ni el
                 receptor de una lista compartida la pierde. */
              window.Lista.pintarTodo(null);
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

    /* SKELETON DE LISTA · en la página ACTIVA del carril (el
       carril vive en #listaWrap; sin carril aún, el contenedor
       directo). */
    function mostrarSkeletonLista() {
      var wrap = document.getElementById('listaWrap');
      if (!wrap) return;

      var activo = (window.Chips && typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo() : null;
      var pag = (wrap.classList.contains('carril') && activo)
        ? wrap.querySelector('.carril-pagina[data-chip="' + activo + '"] .carril-items')
        : null;
      var destino = pag || wrap;
      if (!destino) return;

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

      destino.innerHTML = html;
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

      /* el área y el CTA del post los pinta Core_Post con el
         evento app-lista; aquí solo el encabezado y el buscador. */
      pintarTituloHeader();
      pintarPlaceholderBuscar();
    }

    /* ============================================================
       Receptores del núcleo
       ============================================================ */
    document.addEventListener('post:change', function (e) {
      var post = e.detail ? e.detail.post : null;

      if (window.Analitica) {
        if (post && post.id) {
          window.Analitica.enviar('post_open', {
            post_id: post.id,
            city_id: window.Analitica.idCiudadActual()
          });
        } else if (!post && _ultimoPost && _ultimoPost.id) {
          window.Analitica.enviar('post_close', {
            post_id: _ultimoPost.id
          });
        }
      }

      _ultimoPost = post;

      if (window.Secciones && typeof window.Secciones.irAInicio === 'function') {
        window.Secciones.irAInicio();
      }
    });

    document.addEventListener('chips:change', function (e) {
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

    /* ============================================================
       MÓVIL · detección temprana + resize
       ============================================================ */
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

    /* ============================================================
       ARRANQUE
       ============================================================ */
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
          if (data && Array.isArray(data.posts))     window.TABLAS.posts    = _postExpiraVivo_(data.posts);
          if (data && Array.isArray(data.partners))  window.TABLAS.partners = data.partners;
          window.CacheL2.guardarCatalogo(data);

          /* R175 · EL RELLENO TARDÍO REPARTE: el receptor que
             aterrizó con catálogo vacío y recuperó el real al
             volver de segundo plano tenía TABLAS llenas y la
             lista en blanco — los items solo aparecían al mover
             chips (asentado). Mismo carril que
             _revalidarCatalogo: el modo de Lista manda y
             pintarTodo respeta el término vivo (la FIRMA barre lo
             al día: sin cambio de datos esto no remonta nada). */
          if (window.Lista && typeof window.Lista.getModo === 'function' &&
              window.Lista.getModo() === 'lista') {
            if (window.Promo && typeof window.Promo.construir === 'function') {
              window.Promo.construir();
            }
            if (typeof window.Lista.pintarTodo === 'function') {
              window.Lista.pintarTodo(null);
            }
          }
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
