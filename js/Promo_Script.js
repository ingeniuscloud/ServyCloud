/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Promo_Script.html
ESPEJO GITHUB:   js/Promo_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Marquesina de promoción destacada. Vive fuera
                 del scroll en modo lista. Se oculta en modo
                 detalle y cuando la ciudad no tiene promos
                 vigentes.
                 Lee SISTEMA.promo.porCiudad[ciudadActiva],
                 filtra por fecha (inicia <= hoy <= termina) y por
                 estado del post (solo activo).
                 El riel avanza SOLO y sin parar: un bucle de
                 requestAnimationFrame suma a scrollLeft. Se usa
                 scrollLeft y no transform para que el dedo pueda
                 arrastrar el MISMO contenedor sin pelearse con la
                 animación.
                 La posición se lleva en posMarquesina (memoria) y
                 NUNCA se relee del DOM: en iOS scrollLeft es
                 asíncrono y leerlo tras escribirlo devuelve el
                 valor viejo, lo que dejaba el riel clavado. Se
                 resincroniza con el DOM solo al construir y al
                 soltar el dedo.
                 Bucle sin costura: los items se duplican y el
                 scroll se envuelve en anchoVuelta (scrollLeft y
                 scrollLeft + anchoVuelta se ven idénticos).
                 La pausa con el dedo es lo que permite tocar con
                 puntería algo que se mueve: al apoyar se detiene,
                 al soltar reanuda tras REANUDAR_MS (para no pelear
                 con la inercia del arrastre).
                 Se detiene además si el slot está oculto y si el
                 sistema pide menos movimiento.
VERSIÓN:         1.5
CAMBIOS:         R33: arreglo del riel clavado en iPhone. (a) El
                 avance ya no parte de track.scrollLeft sino de
                 posMarquesina, una variable en memoria: en iOS el
                 scroll es asíncrono y "leer + sumar + escribir"
                 releía siempre el valor viejo, así que el riel se
                 quedaba quieto (en PC, con scrollLeft síncrono, se
                 veía perfecto). (b) Nueva sincronizarPosicion():
                 adopta el scrollLeft real al construir y al soltar
                 el dedo, y normaliza a [0, anchoVuelta). (c) Fuera
                 -webkit-overflow-scrolling del CSS: manda el scroll
                 a un hilo aparte en iOS y agrava el desfase; desde
                 iOS 13 la inercia ya es por defecto.
                 R32: el carrusel pasa a marquesina continua. (a) Se
                 retira setInterval + scrollTo smooth (7 s quieto y
                 un salto de 400 ms: eso era el "se paraliza") y
                 entra un bucle rAF que suma a scrollLeft. (b) Items
                 duplicados + envolvimiento en anchoVuelta para que
                 el bucle no tenga costura; los clones van con
                 aria-hidden y tabindex -1. (c) Fuera los dots: con
                 avance continuo no hay "diapositiva actual".
                 (d) Fuera el listener de visibilitychange: rAF ya no
                 corre en tab oculto y dt va acotado a 100 ms.
                 (e) Con UNA sola promo no hay bucle ni asomo: ocupa
                 el 100% y no se duplica. (f) promo_swipe ya no manda
                 post_id: sin diapositiva actual, apuntar a un post
                 sería mentir. Sigue mandando city_id.
                 R12: Capa 1 GA4. promo_click en el toque de una
                 promo (antes de irAPost) y promo_swipe cuando el
                 usuario arrastra el track (solo con el dedo
                 puesto: el avance automático no cuenta, ni
                 tampoco el cambio de dot programático), con
                 debounce de 800ms. Sin envoltorio: no-op.
                 R10: blindaje B6. El contenido de la hoja que pinta
                 cada item de promo (titulo, badge, texto, marca,
                 color del badge e inicial) se interpola escapado
                 con escapeHtml(). Hoy es texto plano (cotejado
                 R10): render idéntico.
                 R9: versión de producción del dueño. La promo deja de
                 depender del backend: el índice ya no trae
                 promoTexto/promoPrioridad ni hay rotación
                 calculada en el servidor. Ahora lee el PROMOJSON
                 crudo (SISTEMA.promo), filtra vigencia por fechas
                 (inicia/termina) y estado activo del post EN EL
                 CLIENTE, y monta un carrusel (track + snap + dots,
                 auto-avance con pausa por interacción y
                 visibilidad).
                 R6: baseline de producción incorporado al espejo;
                 encabezado normalizado al estándar ═══ (6 campos).
DEPENDENCIAS:    Index.html (SISTEMA.promo, SISTEMA.badges, #promoSlot),
                 Ciudad_Sheet_Script.html (getActual),
                 Chips_Script.html (getChipActivo, seleccionar),
                 Iconos.html (pintarGlifos), Promo_CSS.html,
                 Lista_CSS.html (clases .lista-item compartidas)
════════════════════════════════════════════════════════════════════
*/

  window.Promo = (function () {

    var track = null;
    var items = [];
    var pausadoPorInteraccion = false;
    var reducedMotion = false;

    /* Marquesina · R32 */
    var VELOCIDAD_FALLBACK = 22;   /* px/s si no se puede derivar */
    var REANUDAR_MS        = 2200; /* espera tras soltar el dedo */
    var raf = null;                /* id del requestAnimationFrame */
    var ultimoT = 0;               /* timestamp del frame anterior */
    var anchoVuelta = 0;           /* ancho de UNA vuelta (N items) */
    var velocidad = VELOCIDAD_FALLBACK;
    var posMarquesina = 0;         /* posición propia, NUNCA del DOM */
    var reanudarTimer = null;

    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function buscarPost(idPost) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === idPost) return posts[i];
      }
      return null;
    }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === idPartner) return partners[i];
      }
      return null;
    }

    function buscarBadge(idBadge) {
      if (!idBadge) return null;
      var badges = (window.SISTEMA && window.SISTEMA.badges) || [];
      for (var i = 0; i < badges.length; i++) {
        if (badges[i].idBadge === idBadge) {
          if (badges[i].estado === false) return null;
          return badges[i];
        }
      }
      return null;
    }

    function hoyISO() {
      var d = new Date();
      var y = d.getFullYear();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var dd = ('0' + d.getDate()).slice(-2);
      return y + '-' + m + '-' + dd;
    }

    function estaVigente(item) {
      var hoy = hoyISO();
      if (item.inicia && item.inicia > hoy) return false;
      if (item.termina && item.termina < hoy) return false;
      return true;
    }

    function ciudadActiva() {
      if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
        var c = window.Ciudad.getActual();
        return c ? c.idCiudad : null;
      }
      return null;
    }

    function irAPost(idPost) {
      var post = buscarPost(idPost);
      if (!post) return;

      var chipActivo = (window.Chips && typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo()
        : null;

      var chips = post.idChips || [];
      var enMismoChip = (chipActivo && chips.indexOf(chipActivo) !== -1);

      if (enMismoChip || chips.length === 0) {
        if (chips.length === 0) return;
        document.dispatchEvent(new CustomEvent('post:solicitar', {
          detail: { idPost: idPost }
        }));
        return;
      }

      if (window.Chips && typeof window.Chips.seleccionar === 'function') {
        window.Chips.seleccionar(chips[0]);
        setTimeout(function () {
          document.dispatchEvent(new CustomEvent('post:solicitar', {
            detail: { idPost: idPost }
          }));
        }, 80);
      } else {
        document.dispatchEvent(new CustomEvent('post:solicitar', {
          detail: { idPost: idPost }
        }));
      }
    }

    /* ============================================================
       Construcción del item
       ============================================================ */
    /* B6 · R10: escapado HTML para todo el contenido que viene
       de la hoja. Mismo patrón que Comenta/Ciudad/Partner/Reserva. */
    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function buildItemHTML(item, post) {
      var titulo = escapeHtml(post.titulo || post.boton || post.id);
      var badge  = buscarBadge(post.idBadge);
      var partner = buscarPartner(post.idPartner) || {};
      var marca = escapeHtml(String(partner.marca || partner.nombre || '').trim());

      var html = '';
      html += '<span class="promo-campana" data-glifo="campana" aria-hidden="true"></span>';
      html += '<span class="body">';
      html +=   '<span class="fila-titulo">';
      html +=     '<span class="titulo">' + titulo + '</span>';
      if (badge && badge.titulo) {
        var bColor = badge.colorTextoBorde || '#475569';
        html += '<span class="badge" style="color:' + escapeHtml(bColor) + ';">' + escapeHtml(badge.titulo) + '</span>';
      }
      html +=   '</span>';
      html +=   '<span class="tagline">' + escapeHtml(item.texto) + '</span>';
      if (marca) {
        html += '<span class="marca">' +
                  '<span class="check">✓</span>' +
                  '<span class="marca-texto">' + marca + '</span>' +
                '</span>';
      }
      html += '</span>';
      html += '<span class="flecha">›</span>';

      return html;
    }

    /* ============================================================
       MARQUESINA · el riel avanza solo, sin parar
       Se escribe sobre scrollLeft del contenedor nativo (no con
       transform) para que el dedo pueda arrastrar el MISMO
       contenedor sin pelearse con la animación.
       El bucle se salta el trabajo —sin cortarse— cuando el dedo
       está puesto, cuando el slot está oculto (modo detalle) y si
       el sistema pide menos movimiento.
       ============================================================ */
    function calcularVelocidad() {
      /* Se conserva el significado de autoAvanceSeg: segundos por
         tarjeta. La marquesina avanza a esa misma cadencia, así que
         el ritmo configurado en PROMOJSON sigue mandando. */
      var seg = Number((window.SISTEMA && window.SISTEMA.promo &&
                        window.SISTEMA.promo.autoAvanceSeg) || 7);
      if (!(seg >= 3)) seg = 7;

      var porItem = items.length ? (anchoVuelta / items.length) : 0;
      velocidad = porItem ? (porItem / seg) : VELOCIDAD_FALLBACK;
    }

    function medirVuelta() {
      if (!track) return 0;
      if (track.children.length <= items.length) return 0;
      return track.children[items.length].offsetLeft -
             track.children[0].offsetLeft;
    }

    /* La posición vive en memoria y NO se relee del DOM.
       En iOS el scroll es asíncrono: leer track.scrollLeft justo
       después de escribirlo devuelve el valor viejo, así que el
       patrón "leer + sumar + escribir" dejaba el riel clavado.
       En PC scrollLeft es síncrono, y por eso ahí sí funcionaba. */
    function sincronizarPosicion() {
      if (!track) return;
      var v = Number(track.scrollLeft) || 0;
      if (anchoVuelta) {
        while (v >= anchoVuelta) v -= anchoVuelta;
        while (v < 0) v += anchoVuelta;
      }
      posMarquesina = v;
    }

    function pasoMarquesina(t) {
      raf = requestAnimationFrame(pasoMarquesina);

      if (!track) return;

      /* dt acotado: si el tab estuvo en segundo plano, rAF no corrió
         y el salto sería enorme. 100 ms es imperceptible. */
      var dt = ultimoT ? Math.min(t - ultimoT, 100) : 0;
      ultimoT = t;

      if (pausadoPorInteraccion) return;
      if (reducedMotion) return;
      if (!track.offsetParent) return;   /* slot oculto: modo detalle */

      /* Si se construyó con el slot oculto, la medida quedó en 0:
         se reintenta en el primer frame visible. */
      if (!anchoVuelta) {
        anchoVuelta = medirVuelta();
        if (!anchoVuelta) return;
        calcularVelocidad();
        sincronizarPosicion();
      }

      if (dt <= 0) return;

      /* Avance sobre la posición en memoria, nunca sobre una lectura
         del DOM (ver la nota de sincronizarPosicion). */
      posMarquesina += velocidad * dt / 1000;

      /* Bucle sin costura: los items están duplicados, así que
         scrollLeft y scrollLeft + anchoVuelta se ven idénticos. */
      while (posMarquesina >= anchoVuelta) posMarquesina -= anchoVuelta;
      while (posMarquesina < 0) posMarquesina += anchoVuelta;

      track.scrollLeft = posMarquesina;
    }

    function arrancarMarquesina() {
      detenerMarquesina();
      if (reducedMotion) return;
      if (items.length <= 1) return;
      ultimoT = 0;
      raf = requestAnimationFrame(pasoMarquesina);
    }

    function detenerMarquesina() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    /* Pausa con el dedo: es lo que permite tocar con puntería algo
       que se mueve. Al apoyar se congela; al soltar se espera
       REANUDAR_MS para no pelear con la inercia del arrastre. */
    function pausarPorDedo() {
      if (reanudarTimer) { clearTimeout(reanudarTimer); reanudarTimer = null; }
      pausadoPorInteraccion = true;
    }

    function reanudarTrasDedo() {
      if (reanudarTimer) clearTimeout(reanudarTimer);
      reanudarTimer = setTimeout(function () {
        reanudarTimer = null;
        /* El dedo pudo mover el riel: se adopta dónde quedó antes de
           devolverle el control a la marquesina. */
        sincronizarPosicion();
        pausadoPorInteraccion = false;
        ultimoT = 0;
      }, REANUDAR_MS);
    }

    /* ============================================================
       Construir el carrusel completo
       ============================================================ */
    function construir() {
      detenerMarquesina();
      if (reanudarTimer) { clearTimeout(reanudarTimer); reanudarTimer = null; }

      var slot = document.getElementById('promoSlot');
      if (!slot) return;

      slot.innerHTML = '';
      slot.hidden = true;

      var promo = window.SISTEMA && window.SISTEMA.promo;
      if (!promo || promo.activo === false) return;

      var ciudad = ciudadActiva();
      if (!ciudad) return;

      var pool = (promo.porCiudad && promo.porCiudad[ciudad]) || [];
      if (!pool.length) return;

      /* Filtrar por fecha + estado del post */
      var vigentes = [];
      pool.forEach(function (item) {
        if (!item || !item.idPost) return;
        if (!estaVigente(item)) return;
        var post = buscarPost(item.idPost);
        if (!post) return;
        if (post.estado !== 'activo') return;
        vigentes.push({ item: item, post: post });
      });

      if (!vigentes.length) return;

      /* Reduced motion · antes de decidir si se duplica */
      try {
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (_) {
        reducedMotion = false;
      }

      var trackEl = document.createElement('div');
      trackEl.className = 'promo-track';

      /* Con UNA sola promo no hay asomo ni bucle: ocupa todo el ancho
         y no se duplica (una tarjeta al 82% se vería coja). */
      var unaSola = (vigentes.length === 1);
      var hayBucle = !unaSola && !reducedMotion;

      function montarBoton(par, esClon) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lista-item promo-item';
        btn.setAttribute('data-post', par.post.id);

        if (unaSola) {
          btn.style.flexBasis = '100%';
          btn.style.marginRight = '0';
        }
        if (esClon) {
          /* Copia para el bucle sin costura: invisible para lectores
             de pantalla y fuera del orden de tabulación, para no
             duplicar el contenido accesible. */
          btn.setAttribute('aria-hidden', 'true');
          btn.setAttribute('tabindex', '-1');
        } else {
          btn.setAttribute('aria-label',
            'Promoción · ' + (par.post.titulo || par.post.id));
        }

        btn.innerHTML = buildItemHTML(par.item, par.post);

        btn.addEventListener('click', function () {
          haptic(10);
          /* GA4 (R12): toque del usuario en una promo */
          if (window.Analitica) {
            window.Analitica.enviar('promo_click', {
              post_id: par.post.id,
              city_id: ciudadActiva()
            });
          }
          irAPost(par.post.id);
        });

        return btn;
      }

      vigentes.forEach(function (par) {
        trackEl.appendChild(montarBoton(par, false));
      });

      /* Segunda vuelta exacta: es lo que hace que el envolvimiento
         en anchoVuelta no tenga costura visible. */
      if (hayBucle) {
        vigentes.forEach(function (par) {
          trackEl.appendChild(montarBoton(par, true));
        });
      }

      slot.appendChild(trackEl);
      slot.hidden = false;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(slot);
      }

      /* Refs y estado */
      track = trackEl;
      items = vigentes;
      pausadoPorInteraccion = false;
      track.scrollLeft = 0;

      /* Ancho de UNA vuelta: medido del DOM y no calculado, así los
         márgenes y el redondeo del navegador no descuadran la costura.
         Si el slot se construyó oculto dará 0 y el bucle lo reintenta
         en el primer frame visible (pasoMarquesina). */
      anchoVuelta = medirVuelta();
      calcularVelocidad();
      sincronizarPosicion();

      /* Scroll listener · SOLO para GA4 promo_swipe.
         (El nombre rafScroll evita ensombrecer el raf del bucle.) */
      var rafScroll = null;
      var tocaUsuario = false;
      var _swipeTimer = null;

      track.addEventListener('scroll', function () {
        if (rafScroll) return;
        rafScroll = requestAnimationFrame(function () {
          rafScroll = null;

          /* El avance de la marquesina también dispara scroll: solo
             cuenta si el dedo está puesto. */
          if (!tocaUsuario || !window.Analitica) return;
          if (_swipeTimer) clearTimeout(_swipeTimer);
          _swipeTimer = setTimeout(function () {
            /* Sin diapositiva actual no hay post que reportar: se
               manda solo la ciudad. */
            window.Analitica.enviar('promo_swipe', {
              city_id: ciudadActiva()
            });
          }, 800);
        });
      }, { passive: true });

      /* Pausa con el dedo */
      track.addEventListener('pointerdown', function () {
        tocaUsuario = true;
        pausarPorDedo();
      });
      track.addEventListener('pointerup', function () {
        tocaUsuario = false;
        reanudarTrasDedo();
      });
      track.addEventListener('pointercancel', function () {
        tocaUsuario = false;
        reanudarTrasDedo();
      });

      /* Arrancar */
      arrancarMarquesina();
    }

    return { construir: construir };

  })();
