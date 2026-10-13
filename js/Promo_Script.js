/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Promo_Script.html
ESPEJO GITHUB:   js/Promo_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Carrusel de promoción destacada. Vive fuera
                 del scroll en modo lista. Se oculta en modo
                 detalle y cuando la ciudad no tiene promos
                 vigentes.
                 Lee SISTEMA.promo.porCiudad[ciudadActiva],
                 filtra por fecha (inicia <= hoy <= termina) y por
                 estado del post (solo activo). Monta las que
                 pasan el filtro en un track horizontal con snap.
                 Auto-avance cada autoAvanceSeg. Swipe manual.
                 Pausa al tocar, al arrastrar y cuando el tab no
                 está visible. Respeta prefers-reduced-motion.
VERSIÓN:         1.3
CAMBIOS:         R12: Capa 1 GA4. promo_click en el toque de una
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

    var timer = null;
    var track = null;
    var dots = [];
    var items = [];
    var idxActual = 0;
    var pausadoPorInteraccion = false;
    var reducedMotion = false;
    var visibilityHandler = null;

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
       Control del carrusel
       ============================================================ */
    function irA(indice, suave) {
      if (!track) return;
      var ancho = track.clientWidth;
      if (!ancho) return;
      track.scrollTo({
        left: indice * ancho,
        behavior: suave === false ? 'auto' : 'smooth'
      });
    }

    function actualizarDots() {
      if (!track || !dots.length) return;
      var ancho = track.clientWidth;
      if (!ancho) return;
      var idx = Math.round(track.scrollLeft / ancho);
      if (idx < 0) idx = 0;
      if (idx >= dots.length) idx = dots.length - 1;
      dots.forEach(function (d, i) {
        d.classList.toggle('activo', i === idx);
      });
      idxActual = idx;
    }

    function avanzar() {
      if (pausadoPorInteraccion) return;
      if (document.visibilityState !== 'visible') return;
      if (items.length <= 1) return;

      var siguiente = (idxActual + 1) % items.length;
      irA(siguiente, true);
    }

    function arrancarTimer() {
      detenerTimer();
      if (reducedMotion) return;
      if (items.length <= 1) return;

      var seg = Number((window.SISTEMA.promo && window.SISTEMA.promo.autoAvanceSeg) || 7);
      if (seg < 3) seg = 7;

      timer = setInterval(avanzar, seg * 1000);
    }

    function detenerTimer() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function reiniciarTimer() {
      if (reducedMotion || items.length <= 1) return;
      detenerTimer();
      arrancarTimer();
    }

    /* ============================================================
       Construir el carrusel completo
       ============================================================ */
    function construir() {
      detenerTimer();

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

      /* Construir track */
      var trackEl = document.createElement('div');
      trackEl.className = 'promo-track';

      vigentes.forEach(function (par, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lista-item promo-item';
        btn.setAttribute('data-post', par.post.id);
        btn.setAttribute('aria-label', 'Promoción · ' + (par.post.titulo || par.post.id));
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
        trackEl.appendChild(btn);
      });

      /* Dots · solo si hay más de uno */
      if (vigentes.length > 1) {
        var dotsEl = document.createElement('div');
        dotsEl.className = 'promo-dots';
        for (var i = 0; i < vigentes.length; i++) {
          var dot = document.createElement('span');
          dot.className = 'promo-dot' + (i === 0 ? ' activo' : '');
          dotsEl.appendChild(dot);
        }
        slot.appendChild(trackEl);
        slot.appendChild(dotsEl);
      } else {
        slot.appendChild(trackEl);
      }

      slot.hidden = false;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(slot);
      }

      /* Refs y estado */
      track = trackEl;
      dots = slot.querySelectorAll('.promo-dot');
      items = vigentes;
      idxActual = 0;
      pausadoPorInteraccion = false;
      track.scrollLeft = 0;

      /* Reduced motion */
      try {
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (_) {
        reducedMotion = false;
      }

      /* Scroll listener · actualizar dots al scroll */
      var raf = null;

      /* GA4 (R12): promo_swipe SOLO cuando el usuario arrastra
         (hay pointer activo). El scroll del avance automático no
         viene de un toque y no dispara. Debounce 800ms. */
      var tocaUsuario = false;
      var _swipeTimer = null;

      track.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          actualizarDots();

          if (tocaUsuario && window.Analitica) {
            if (_swipeTimer) clearTimeout(_swipeTimer);
            _swipeTimer = setTimeout(function () {
              var par = items[idxActual];
              if (par && par.post && par.post.id) {
                window.Analitica.enviar('promo_swipe', {
                  post_id: par.post.id,
                  city_id: ciudadActiva()
                });
              }
            }, 800);
          }
        });
      }, { passive: true });

      /* Pausa al tocar / arrastrar */
      track.addEventListener('pointerdown', function () {
        tocaUsuario = true;
        pausadoPorInteraccion = true;
        detenerTimer();
      });
      track.addEventListener('pointerup', function () {
        tocaUsuario = false;
        pausadoPorInteraccion = false;
        reiniciarTimer();
      });
      track.addEventListener('pointercancel', function () {
        tocaUsuario = false;
        pausadoPorInteraccion = false;
        reiniciarTimer();
      });

      /* Pausa cuando el tab no está visible */
      if (!visibilityHandler) {
        visibilityHandler = function () {
          if (document.visibilityState === 'visible') {
            reiniciarTimer();
          } else {
            detenerTimer();
          }
        };
        document.addEventListener('visibilitychange', visibilityHandler);
      }

      /* Arrancar */
      arrancarTimer();
    }

    return { construir: construir };

  })();
