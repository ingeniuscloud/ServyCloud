/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Promo_Script.html
ESPEJO GITHUB:   github/js/Promo_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
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
                 Tarjeta (R62): FILA DEL TÍTULO con el BADGE a la
                 derecha (el texto de la promo manda, el badge lo
                 acompaña), TÍTULO = TEXTO DE LA PROMO (la
                 esencia del mensaje: item.texto de PROMOJSON,
                 con respaldo en el promoTexto del post — grande
                 y sin bold), SUBTÍTULO = título del post, y
                 TERCERA FILA = partner con el CHECK DE
                 CERTIFICADO en blanco a la derecha (glifo
                 badgeCheck). Flecha circular a la esquina
                 inferior derecha. Cada tarjeta lleva el
                 DEGRADADO de su colorOficial (R62: estilo
                 inline 2026 — diagonal 135°, claro → base →
                 oscuro — y su sombra; los clones llevan el MISMO
                 estilo que su original para que la vuelta no
                 cambie de color). El encabezado "Promos cerca de
                 ti" + "Toca para conocer más" se muestra/oculta
                 junto con el slot.
VERSIÓN:         2.5
CAMBIOS:         R84: el badge se busca en el ITEM de PROMOJSON
                 (item.idBadge, como quedó definido en R76) con
                 respaldo en el post — la marquesina vuelve a
                 identificar la promo con su badge de la BD.
CAMBIOS:         R67: FIX del pool de promos — el PROMOJSON real
                 trae porCiudad como OBJETO (idPostActual, la
                 rotación la lleva el backend) y construir()
                 esperaba un ARRAY: la marquesina se apagaba en
                 silencio con la hoja actual. Ahora se normaliza
                 el formato antes de filtrar.
                 R62: el DEGRADADO sale del colorOficial del
                 post — estiloDegradado() deriva claro/oscuro
                 desde el hex de la BD (mix con blanco/negro) y
                 pinta background + boxShadow en línea; FUERA la
                 paleta promo-c0…c5 (PALETA_LARGO y la clase
                 promo-c{n} murieron). El badge sube a la FILA
                 DEL TÍTULO (.promo-fila-titulo: título flex:1 +
                 badge a la derecha). La base CSS queda como
                 respaldo si la BD no trae color válido.
                 R58: contenido nuevo de la tarjeta — fuera la
                 campana, el tagline y el pie "Ver detalles";
                 entra badge blanco + promo-titulo +
                 promo-partner + promo-flecha (glifo flechaVer);
                 el color del badge lo manda Promo_CSS (blanco);
                 #promoEncabezado se enciende/apaga con el slot.
                 R56: "Ver detalles" del colorOficial del post y
                 en peso normal (esa pieza desaparece en R58).
DEPENDENCIAS:    Index.html (SISTEMA.promo, SISTEMA.badges, #promoSlot,
                 #promoEncabezado),
                 Ciudad_Sheet_Script.html (getActual),
                 Chips_Script.html (getChipActivo, seleccionar),
                 Iconos.html (pintarGlifos), Promo_CSS.html,
                 Lista_CSS.html (clase .lista-item compartida)
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

    /* TEXTO DE LA PROMO (R60) · la esencia del mensaje. Se lee
       del item de PROMOJSON (texto, con variantes por si la hoja
       usa otro nombre) y como respaldo del promoTexto que el
       índice del catálogo trae desde PostDetalle (02 Cache.gs).
       R61: este texto ES el título de la tarjeta. */
    function textoDePromo(item, post) {
      var campos = ['texto', 'promoTexto', 'descripcion', 'mensaje'];
      for (var i = 0; i < campos.length; i++) {
        var v = item ? item[campos[i]] : null;
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      var t = post ? post.promoTexto : null;
      if (typeof t === 'string' && t.trim()) return t.trim();
      var meta = (post && post.seccionJson && post.seccionJson.meta) || null;
      t = meta ? meta.promoTexto : null;
      return (typeof t === 'string' && t.trim()) ? t.trim() : '';
    }

    function buildItemHTML(item, post) {
      /* R84: el badge vive en el ITEM de PROMOJSON (así quedó
         definido en R76) con respaldo en el post — la marquesina
         vuelve a identificar la promo con su badge. */
      var badge  = buscarBadge((item && (item.idBadge || item.idBadgeActual)) || post.idBadge);
      var partner = buscarPartner(post.idPartner) || {};
      var marca = escapeHtml(String(partner.marca || partner.nombre || '').trim());
      var textoPromo = textoDePromo(item, post);
      var tituloPost = String(post.titulo || post.boton || '').trim();

      /* R62 · Anatomía pedida por el dueño:
         1) FILA DEL TÍTULO = TEXTO de la promo (PROMOJSON),
            grande y sin bold (el estilo lo pinta Promo_CSS),
            con el badge a la derecha de la MISMA fila.
         2) SUBTÍTULO = título del post.
         3) TERCERA FILA = nombre del partner + check de
            certificado a la derecha, en BLANCO (badgeCheck).
         Si la promo no trae texto, el título del post sube y NO
         se duplica en el subtítulo. La flecha circular cierra
         abajo a la derecha. */
      var badgeHtml = (badge && badge.titulo)
        ? '<span class="badge">' + escapeHtml(badge.titulo) + '</span>'
        : '';

      var tituloHtml = textoPromo
        ? '<span class="promo-titulo">' + escapeHtml(textoPromo) + '</span>'
        : '<span class="promo-titulo">' +
          escapeHtml(tituloPost || post.id) + '</span>';

      var html = '<span class="promo-fila-titulo">' +
                   tituloHtml + badgeHtml +
                 '</span>';

      if (textoPromo && tituloPost) {
        html += '<span class="promo-sub">' + escapeHtml(tituloPost) + '</span>';
      }

      if (marca) {
        html += '<span class="promo-partner">' + marca +
                '<span class="promo-check" data-glifo="badgeCheck" aria-hidden="true"></span>' +
                '</span>';
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
      /* R67 · FIX: el PROMOJSON real de la hoja trae porCiudad
         como OBJETO (idPostActual + proximaRotación — la rotación
         la lleva el backend), no como array. Antes el pool
         quedaba en el objeto y la marquesina se APAGABA en
         silencio (if (!pool.length) return). Se normalizan los
         DOS formatos antes de filtrar vigentes. */
      var pool = [];
      if (Array.isArray(raw)) {
        pool = raw;
      } else if (raw && (raw.idPost || raw.idPostActual)) {
        pool = [raw];
      }
      if (!pool.length) return;

      /* Filtrar por fecha + estado del post */
      var vigentes = [];
      pool.forEach(function (item) {
        if (!item) return;
        var idPost = item.idPost || item.idPostActual;
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