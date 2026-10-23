/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Promo_Script.html
ESPEJO GITHUB:   github/js/Promo_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Marquesina de promoción destacada. Vive fuera
                 del scroll en modo lista. Se oculta en modo
                 detalle y cuando la ciudad no tiene promos
                 vigentes.
                 Lee SISTEMA.promo.porCiudad[ciudadActiva]: PROMOJSON
                 SOLO registra idPost + ventanas (inicia/termina);
                 el CONTENIDO de cada tarjeta vive en el POSTJSON
                 del post (meta.promo: titulo, descripcion,
                 idBadge) y llega por el catálogo (02 Cache.gs lo
                 extrae al índice, 0 lecturas nuevas). Filtra por
                 ventana (reloj del teléfono, fecha o fecha+hora
                 via ventanaVigente de Global_Script) y por estado
                 del post (solo activo).
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
                 Tarjeta: TRES LÍNEAS de texto en blanco —
                 1ª = promo.titulo del POSTJSON (tipografía
                 .subtitulo), 2ª = promo.descripcion
                 (.textoPrimario) y 3ª = tituloPost del post
                 (.cita) — con el BADGE (promo.idBadge buscado en
                 BADGEJSON) a la derecha de la primera fila y la
                 flecha circular a la esquina inferior derecha. La
                 pintura (degradado del colorOficial, sombra,
                 badge, flecha) y el proceso (riel, bucle, pausa
                 con el dedo) quedan igual. Cada tarjeta lleva el
                 DEGRADADO de su colorOficial (estilo inline 2026
                 — diagonal 135°, claro → base → oscuro — y su
                 sombra; los clones llevan el MISMO estilo que su
                 original para que la vuelta no cambie de color).
                 El encabezado "Promos cerca de ti" + "Toca para
                 conocer más" se muestra/oculta junto con el slot.
VERSIÓN:         2.1.0
CAMBIOS:         R98: FUENTE ÚNICA = POSTJSON. Los textos y el
                 badge de la tarjeta se leen de post.promo
                 (meta.promo del POSTJSON, viajando en el
                 catálogo) y NO del item de PROMOJSON, que ahora
                 solo trae idPost + inicia + termina. Sin
                 meta.promo la tarjeta cae al tituloPost del post
                 (nunca queda muda). La vigencia pasa por
                 ventanaVigente (Global_Script): inicia con hora
                 = ventana horaria; sin hora = todo el día.
                 Fuera la lectura de textos del item (titulo,
                 texto, promoTexto, mensaje, descripcion) y del
                 idPostActual (shape viejo).
DEPENDENCIAS:    Index.html (SISTEMA.promo, SISTEMA.badges, #promoSlot,
                 #promoEncabezado), Global_Script.html
                 (ventanaVigente), Ciudad_Sheet_Script.html
                 (getActual), Chips_Script.html (getChipActivo,
                 seleccionar), Iconos.html (pintarGlifos),
                 Promo_CSS.html, Lista_CSS.html (clase .lista-item
                 compartida)
════════════════════════════════════════════════════════════════════*/

  window.Promo = (function () {

    var track = null;
    var items = [];
    var pausadoPorInteraccion = false;
    var reducedMotion = false;

    /* ============================================================
       DEGRADADO DEL COLOROFICIAL (R62) · versión 2026
       Deriva claro/oscuro desde el hex de la BD (mezcla con
       blanco/negro) y devuelve el estilo inline de la tarjeta:
       diagonal 135° (claro → base → oscuro) + sombra del
       propio color. Sin hex válido → null (el respaldo CSS
       naranja queda debajo).
       ============================================================ */
    function hexARgb(hex) {
      var h = String(hex || '').trim().replace('#', '');
      if (/^[0-9a-fA-F]{3}$/.test(h)) {
        h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) +
            h.charAt(2) + h.charAt(2);
      }
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;

      return {
        r: parseInt(h.charAt(0) + h.charAt(1), 16),
        g: parseInt(h.charAt(2) + h.charAt(3), 16),
        b: parseInt(h.charAt(4) + h.charAt(5), 16)
      };
    }

    /* mezcla hacia blanco (t < 0) o negro (t > 0) — t en [-1,1] */
    function mezclar(c, t) {
      var destino = t < 0 ? 255 : 0;
      var k = Math.min(Math.abs(t), 1);
      return {
        r: Math.round(c.r + (destino - c.r) * k),
        g: Math.round(c.g + (destino - c.g) * k),
        b: Math.round(c.b + (destino - c.b) * k)
      };
    }

    function rgbStr(c) {
      return c.r + ', ' + c.g + ', ' + c.b;
    }

    function estiloDegradado(colorHex) {
      var base = hexARgb(colorHex);
      if (!base) return null;

      var claro = mezclar(base, -0.16);
      var oscuro = mezclar(base, 0.18);

      return {
        background: 'linear-gradient(135deg, rgb(' + rgbStr(claro) + ') 0%, ' +
                    'rgb(' + rgbStr(base) + ') 52%, ' +
                    'rgb(' + rgbStr(oscuro) + ') 100%)',
        boxShadow: '0 6px 16px rgba(' + rgbStr(base) + ', 0.28)'
      };
    }

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

    /* R98 · VIGENCIA TOLERANTE (reloj del teléfono): la ventana
       vive en ventanaVigente (Global_Script) — inicia con hora
       = ventana horaria; sin hora = todo el día. */
    function estaVigente(item) {
      if (typeof window.ventanaVigente === 'function') {
        return window.ventanaVigente(item.inicia, item.termina);
      }
      /* Respaldo sin Global (no debería pasar): fecha plana. */
      var hoy = hoyISO();
      var inicia = String(item.inicia || '').slice(0, 10);
      var termina = String(item.termina || '').slice(0, 10);
      if (inicia && inicia > hoy) return false;
      if (termina && termina < hoy) return false;
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

    /* R98 · TEXTOS DE LA TARJETA — el CONTENIDO vive en el
       POSTJSON del post (post.promo viaja en el catálogo desde
       02 Cache.gs) y NO en el item de PROMOJSON:
       · TITULO   (1ª línea, .subtitulo): post.promo.titulo.
       · DESCRIPCION (2ª línea, .textoPrimario):
         post.promo.descripcion.
       · BADGE: post.promo.idBadge (buscado en BADGEJSON).
       · TITULOpOST (3ª línea, .cita): el tituloPost del post —
         el índice del catálogo ya lo trae en post.titulo;
         si el post trae el detalle montado, manda el postJson.
       Sin meta.promo el post cae al tituloPost (nunca muda). */
    function tituloDePromo(post) {
      var t = post && post.promo ? post.promo.titulo : null;
      return (typeof t === 'string' && t.trim()) ? t.trim() : '';
    }

    function descripcionDePromo(post) {
      var v = post && post.promo ? post.promo.descripcion : null;
      return (typeof v === 'string' && v.trim()) ? v.trim() : '';
    }

    function idBadgeDePromo(post) {
      var v = post && post.promo ? post.promo.idBadge : null;
      return (typeof v === 'string' && v.trim()) ? v.trim() : '';
    }

    function tituloPostDe(post) {
      var pj = (post && post.postJson && post.postJson.descripcion) || {};
      var t = String(pj.tituloPost || '').trim();
      if (!t) t = String((post && post.titulo) || '').trim();
      if (!t) t = String((post && post.boton) || '').trim();
      return t;
    }

    function buildItemHTML(item, post) {
      /* R98 · badge y textos salen del POSTJSON (post.promo);
         el item de PROMOJSON solo decidió QUE post sale y
         CUÁNDO. El badge sigue a la derecha de la 1ª fila. Las
         3 líneas las pinta Promo_CSS: titulo en .subtitulo,
         descripcion en .textoPrimario y tituloPost en .cita —
         todas en blanco sobre el degradado. */
      var badge = buscarBadge(idBadgeDePromo(post));
      var tituloPromo = tituloDePromo(post);
      var descripcion = descripcionDePromo(post);
      var tituloPost  = tituloPostDe(post);

      var badgeHtml = (badge && badge.titulo)
        ? '<span class="badge">' + escapeHtml(badge.titulo) + '</span>'
        : '';

      var html = '<span class="promo-fila-titulo">' +
                   '<span class="promo-titulo">' +
                     escapeHtml(tituloPromo || tituloPost || post.id) +
                   '</span>' + badgeHtml +
                 '</span>';

      if (descripcion) {
        html += '<span class="promo-sub">' + escapeHtml(descripcion) + '</span>';
      }

      if (tituloPost) {
        html += '<span class="promo-cita">' + escapeHtml(tituloPost) + '</span>';
      }

      html += '<span class="promo-flecha" aria-hidden="true">' +
              '<span class="promo-flecha-glifo" data-glifo="flechaVer"></span>' +
              '</span>';

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
      var encabezado = document.getElementById('promoEncabezado');
      if (!slot) return;

      slot.innerHTML = '';
      slot.hidden = true;
      if (encabezado) encabezado.hidden = true;

      var promo = window.SISTEMA && window.SISTEMA.promo;
      if (!promo || promo.activo === false) return;

      var ciudad = ciudadActiva();
      if (!ciudad) return;

      var raw  = (promo.porCiudad && promo.porCiudad[ciudad]) || null;
      /* R98 · el PROMOJSON del dueño trae porCiudad como ARRAY
         de items { idPost, inicia, termina }. Se acepta también
         un item suelto por ciudad. */
      var pool = [];
      if (Array.isArray(raw)) {
        pool = raw;
      } else if (raw && raw.idPost) {
        pool = [raw];
      }
      if (!pool.length) return;

      /* Filtrar por ventana + estado del post */
      var vigentes = [];
      pool.forEach(function (item) {
        if (!item) return;
        var idPost = item.idPost;
        if (!idPost) return;
        if (!estaVigente(item)) return;
        var post = buscarPost(idPost);
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

        /* R62 · degradado del colorOficial del post (inline);
           sin color válido queda el respaldo naranja del CSS. */
        var degradado = estiloDegradado(par.post.colorOficial);
        if (degradado) {
          btn.style.background = degradado.background;
          btn.style.boxShadow = degradado.boxShadow;
        }

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

      vigentes.forEach(function (par, indice) {
        trackEl.appendChild(montarBoton(par, false));
      });

      /* Segunda vuelta exacta: es lo que hace que el envolvimiento
         en anchoVuelta no tenga costura visible. El clon lleva el
         MISMO degradado que su original (mismo par, mismo color). */
      if (hayBucle) {
        vigentes.forEach(function (par, indice) {
          trackEl.appendChild(montarBoton(par, true));
        });
      }

      slot.appendChild(trackEl);
      slot.hidden = false;
      if (encabezado) encabezado.hidden = false;

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