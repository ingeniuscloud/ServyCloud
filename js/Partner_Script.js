/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Partner_Script.html
ESPEJO GITHUB:   github/js/Partner_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Partner. LIENZO propio del partner
                 (R87: dejó de ser bottom sheet). Pinta
                 #partnerTrack dentro de .secciones-wrap: identidad
                 (avatar con check + nombre + eslogan del post),
                 stats del sheet, dirección, botón WhatsApp,
                 tabs Servicios/Cursos con tarjetas .mk-cross-* del
                 post y "Ver todas las publicaciones".
                 El modo (título "Perfil del vendedor", botón
                 volver e historial) lo lleva window.Lista vía
                 abrirPartner/cerrarPartner; este módulo solo pinta,
                 hace los fades y navega a posts.
VERSIÓN:         1.0
CAMBIOS:         R87: NACE — reemplaza al bottom sheet del
                 partner (Partner_Sheet_Script retirado).
DEPENDENCIAS:    Index.html (SISTEMA, TABLAS, .secciones-wrap),
                 Lista_Script.html (abrirPartner/cerrarPartner/
                 getModo), Iconos.html (pintarGlifos),
                 Global_Script.html (abrirWhatsapp),
                 Chips_Script.html (window.Chips),
                 Partner_CSS.html, Seccion_CSS.html (clases
                 .mk-partner-*, .mk-location-*, .mk-cross-*)
════════════════════════════════════════════════════════════════════*/

  window.Partner = (function () {

    var LIMITE_VER = 6;

    var abierto      = false;
    var postOrigen   = null;
    var partnerActivo = null;
    var verTodos     = false;
    var chipActivo   = null;
    var track        = null;
    var scrollPostPrevio = 0;

    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === idPartner) return partners[i];
      }
      return null;
    }

    function buscarPost(idPost) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === idPost) return posts[i];
      }
      return null;
    }

    function postsDelPartner(idPartner) {
      if (!idPartner) return [];
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      return posts.filter(function (p) {
        return p.estado !== 'inactivo'
            && p.estado !== 'pausado'
            && p.idPartner === idPartner;
      });
    }

    function nombrePartner() {
      if (partnerActivo && partnerActivo.nombre) return String(partnerActivo.nombre).trim();
      if (partnerActivo && partnerActivo.marca) return String(partnerActivo.marca).trim();
      return 'el partner';
    }

    /* Colores del POST DE ORIGEN (R76: meta.color[0] = oficial,
       [1] = pastel, [2] = claro) — el mismo lenguaje que la fila
       del partner del post. */
    function coloresDelPostOrigen() {
      var meta = (postOrigen && postOrigen.postJson && postOrigen.postJson.meta) || {};
      var arr = Array.isArray(meta.color) ? meta.color : [];
      return {
        oficial: arr[0] || (postOrigen && postOrigen.colorOficial) || '#475569',
        pastel:  arr[1] || (postOrigen && postOrigen.colorClaro)  || '#f1f5f9'
      };
    }

    function tituloPostOrigen() {
      if (postOrigen && postOrigen.postJson && postOrigen.postJson.descripcion) {
        var t = String(postOrigen.postJson.descripcion.tituloPost || '').trim();
        if (t) return t;
      }
      if (postOrigen && postOrigen.titulo) return String(postOrigen.titulo).trim();
      return '';
    }

    function sumarStatsGlobales() {
      var posts = postsDelPartner(partnerActivo ? partnerActivo.id : null);
      var likes = 0, comentarios = 0, compartidos = 0;
      for (var i = 0; i < posts.length; i++) {
        likes        += Number(posts[i].like      || 0);
        comentarios  += Number(posts[i].comenta   || 0);
        compartidos  += Number(posts[i].comparte  || 0);
      }
      return { likes: likes, comentarios: comentarios, compartidos: compartidos };
    }

    function formatearNumero(n) {
      var v = Math.max(0, Math.floor(Number(n || 0)));
      if (v >= 1000000) {
        var m = v / 1000000;
        return ((m % 1 === 0) ? m.toFixed(0) : m.toFixed(1).replace('.', ',')) + 'M';
      }
      if (v >= 100000) return Math.floor(v / 1000) + 'K';
      return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /* ============================================================
       FILTROS Servicios / Cursos (idChips 'se' / 'cu')
       ============================================================ */
    function chipsDisponibles() {
      var posts = postsDelPartner(partnerActivo ? partnerActivo.id : null);
      var tieneCursos = false, tieneServ = false;
      for (var i = 0; i < posts.length; i++) {
        var chips = posts[i].idChips || [];
        if (chips.indexOf('cu') !== -1) tieneCursos = true;
        if (chips.indexOf('se') !== -1) tieneServ   = true;
      }
      var lista = [];
      if (tieneCursos) lista.push({ id: 'cu', titulo: 'Cursos' });
      if (tieneServ)   lista.push({ id: 'se', titulo: 'Servicios' });
      return lista;
    }

    function chipInicialDesdeOrigen() {
      var chips = chipsDisponibles();
      if (!chips.length) return null;
      if (postOrigen && postOrigen.idChips && postOrigen.idChips.length) {
        var chipDelPost = postOrigen.idChips[0];
        for (var i = 0; i < chips.length; i++) {
          if (chips[i].id === chipDelPost) return chipDelPost;
        }
      }
      return chips[0].id;
    }

    function postsFiltrados() {
      var posts = postsDelPartner(partnerActivo ? partnerActivo.id : null);
      if (!chipActivo) return posts;
      return posts.filter(function (p) {
        return (p.idChips || []).indexOf(chipActivo) !== -1;
      });
    }

    /* ============================================================
       CONSTRUCCIÓN
       ============================================================ */
    function construir() {
      var wrap = document.querySelector('.secciones-wrap');
      if (!wrap) return false;

      track = document.getElementById('partnerTrack');
      if (track) return true;

      track = document.createElement('div');
      track.id = 'partnerTrack';
      track.className = 'partner-track secciones-track';
      track.hidden = true;
      wrap.appendChild(track);
      return true;
    }

    function buildIdentidad() {
      var nombre = nombrePartner();
      var inicial = (nombre.charAt(0) || 'P').toUpperCase();
      var pj = partnerActivo && partnerActivo.partnerJson ? partnerActivo.partnerJson : {};
      var eslogan = String(pj.esloganPartner || '').trim();

      var html = '<div class="pf-identidad">';
      html +=   '<div class="mk-partner-avatar">' +
                  '<span class="mk-partner-initial">' + escapeHtml(inicial) + '</span>' +
                  '<span class="mk-partner-verified-badge" data-glifo="badgeCheck" aria-label="Verificado"></span>' +
                '</div>';
      html +=   '<div class="mk-partner-info">';
      html +=     '<div class="textoPrimario" style="color: var(--post-color) !important;">' + escapeHtml(nombre) + '</div>';
      if (eslogan) {
        html +=   '<div class="textoSecundario" style="font-size:12px !important;">' + escapeHtml(eslogan) + '</div>';
      }
      html +=   '</div>';
      html += '</div>';
      return html;
    }

    function buildStats() {
      var s = sumarStatsGlobales();
      return '<div class="pf-stats">' +
        '<div class="pf-stat">' +
          '<div class="pf-stat-top">' +
            '<span class="pf-stat-icon rojo" data-glifo="like"></span>' +
            '<span class="pf-stat-numero">' + formatearNumero(s.likes) + '</span>' +
          '</div>' +
          '<span class="pf-stat-label">Me gusta</span>' +
        '</div>' +
        '<div class="pf-stat">' +
          '<div class="pf-stat-top">' +
            '<span class="pf-stat-icon azul" data-glifo="comment"></span>' +
            '<span class="pf-stat-numero">' + formatearNumero(s.comentarios) + '</span>' +
          '</div>' +
          '<span class="pf-stat-label">Comentarios</span>' +
        '</div>' +
        '<div class="pf-stat">' +
          '<div class="pf-stat-top">' +
            '<span class="pf-stat-icon verde" data-glifo="share"></span>' +
            '<span class="pf-stat-numero">' + formatearNumero(s.compartidos) + '</span>' +
          '</div>' +
          '<span class="pf-stat-label">Compartidos</span>' +
        '</div>' +
      '</div>';
    }

    /* Dirección · la misma anatomía del lienzo del post
       (.mk-location-*): icono + dirección .textoPrimario +
       "Cómo llegar" .enlacesOpciones. Sin dirección el bloque
       completo se omite sin reservar espacio. */
    function buildUbicacion() {
      var pj = partnerActivo && partnerActivo.partnerJson ? partnerActivo.partnerJson : {};
      var direccion = String(pj.direccion || '').trim();
      if (!direccion) return '';

      var ciudad    = String(pj.ciudad || '').trim();
      var municipio = String(pj.municipio || '').trim();
      var estado    = String(pj.estado || '').trim();
      var dirCompleta = [direccion, ciudad, municipio, estado].filter(Boolean).join(', ');
      var urlMaps = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dirCompleta);

      return '<div class="mk-location-section">' +
                '<div class="mk-location">' +
                  '<span class="mk-location-icon" data-glifo="ubicacion"></span>' +
                  '<div class="mk-location-content">' +
                    '<p class="textoPrimario" style="margin:0 !important;">' + escapeHtml(direccion) + '</p>' +
                    '<a href="' + urlMaps + '" target="_blank" rel="noopener" class="enlacesOpciones" style="text-decoration: none;">Cómo llegar</a>' +
                  '</div>' +
                '</div>' +
              '</div>';
    }

    function buildWhatsapp() {
      var pj = partnerActivo && partnerActivo.partnerJson ? partnerActivo.partnerJson : {};
      var numero = String(pj.whatsapp || '').trim();
      if (!numero) return '';

      var textoBoton = String(pj.textoBotonWhatsapp || 'Enviar mensaje').trim();
      var tituloPost = tituloPostOrigen();

      var mensaje = tituloPost
        ? ('Hola, estoy viendo "' + tituloPost + '" en la app. ¿Me pueden dar más información?')
        : 'Hola, estoy viendo las publicaciones en la app. ¿Me pueden dar más información?';

      return '<div class="pf-wa-wrap">' +
        '<a class="pf-wa" href="#" id="pfBotonWhatsapp" ' +
            'data-numero="' + escapeHtml(numero) + '" ' +
            'data-mensaje="' + escapeHtml(mensaje) + '" ' +
            'aria-label="Enviar mensaje por WhatsApp">' +
          '<span class="botonSecundario pf-wa-texto">' + escapeHtml(textoBoton) + '</span>' +
          '<span class="pf-wa-icono" data-glifo="whatsapp"></span>' +
        '</a>' +
      '</div>';
    }

    /* Tarjeta del partner · EXACTAMENTE la misma del cross-sell
       del post (.mk-cross-card con banner tintado + avatar blanco
       e inicial pastel + nombre .textoPrimario). */
    function celdaCard(p) {
      var nombre  = p.boton || p.titulo || p.id;
      var inicial = (nombre.charAt(0) || '?').toUpperCase();
      var color   = p.colorOficial || '#475569';
      var claro   = p.colorClaro   || '#f1f5f9';
      var pastel  = p.colorPastel  || claro;

      return '<button type="button" class="mk-cross-card" data-pf-post="' + escapeHtml(p.id) + '" ' +
                'style="--post-color:' + escapeHtml(color) + '; --post-claro:' + escapeHtml(claro) + '; --post-pastel:' + escapeHtml(pastel) + ';">' +
                '<div class="mk-cross-top"><div class="mk-cross-avatar">' + escapeHtml(inicial) + '</div></div>' +
                '<div class="mk-cross-name textoPrimario">' + escapeHtml(nombre) + '</div>' +
              '</button>';
    }

    function buildPublicaciones() {
      var posts = postsDelPartner(partnerActivo ? partnerActivo.id : null);
      if (!posts.length) return '';

      var chips = chipsDisponibles();
      var colorOrigen = coloresDelPostOrigen();

      var html = '<div class="mk-rel-section pf-publicaciones" ' +
                  'style="--post-color:' + escapeHtml(colorOrigen.oficial) + ';">';

      if (chips.length) {
        html += '<div class="pf-tabs">';
        chips.forEach(function (c) {
          var activo = (c.id === chipActivo) ? ' activo' : '';
          var solo   = (chips.length === 1) ? ' data-solo="1"' : '';
          html += '<button type="button" class="pf-tab' + activo + '"' +
                  ' data-pf-tab="' + c.id + '"' + solo + '>' +
                    escapeHtml(c.titulo) +
                  '</button>';
        });
        html += '</div>';
      }

      var filtrados = postsFiltrados();

      if (!filtrados.length) {
        html += '<div class="pf-vacia">Próximamente más contenido</div>';
        html += '</div>';
        return html;
      }

      var hayMas = filtrados.length > LIMITE_VER;
      var visibles = verTodos ? filtrados : filtrados.slice(0, LIMITE_VER);

      html += '<div class="mk-cross-row">';
      visibles.forEach(function (p) { html += celdaCard(p); });
      html += '</div>';

      if (hayMas) {
        var texto = verTodos ? 'Ver menos' : 'Ver todas las publicaciones';
        html += '<div class="pf-ver-todas-wrap">' +
                  '<button type="button" class="enlacesOpciones pf-ver-todas" id="pfVerTodas">' + texto + '</button>' +
                '</div>';
      }

      html += '</div>';
      return html;
    }

    /* ============================================================
       EVENTOS
       ============================================================ */
    function engancharTabs() {
      var chips = chipsDisponibles();
      if (chips.length <= 1) return;

      track.querySelectorAll('.pf-tab[data-pf-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('activo')) return;
          haptic(8);
          chipActivo = btn.getAttribute('data-pf-tab');
          verTodos = false;
          repintarPublicaciones();
        });
      });
    }

    function engancharCeldas() {
      track.querySelectorAll('.mk-cross-card[data-pf-post]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idPost = this.getAttribute('data-pf-post');
          if (idPost) irAPost(idPost);
        });
      });
    }

    function engancharVerTodas() {
      var btn = track.querySelector('#pfVerTodas');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        haptic(8);
        verTodos = !verTodos;
        repintarPublicaciones();
      });
    }

    function engancharWhatsapp() {
      var btnWa = track.querySelector('#pfBotonWhatsapp');
      if (!btnWa) return;
      btnWa.addEventListener('click', function (e) {
        e.preventDefault();
        haptic(10);
        var num = this.getAttribute('data-numero');
        var msg = this.getAttribute('data-mensaje');
        if (typeof window.abrirWhatsapp === 'function') {
          window.abrirWhatsapp(num, msg);
        }
      });
    }

    function repintarPublicaciones() {
      if (!track) return;
      var cont = track.querySelector('.pf-publicaciones');
      if (!cont) return;

      var fresco = document.createElement('div');
      fresco.innerHTML = buildPublicaciones();
      var nueva = fresco.firstChild;
      if (nueva) cont.parentNode.replaceChild(nueva, cont);

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(track);
      }

      engancharTabs();
      engancharCeldas();
      engancharVerTodas();
    }

    /* ============================================================
       NAVEGACIÓN A UN POST (misma acción que en el sheet)
       ============================================================ */
    function irAPost(idPost) {
      var post = buscarPost(idPost);
      if (!post) return;

      cerrar();

      setTimeout(function () {
        var chipActivoGlobal = (window.Chips && typeof window.Chips.getChipActivo === 'function')
          ? window.Chips.getChipActivo()
          : null;

        var chips = post.idChips || [];
        var enMismoChip = (chipActivoGlobal && chips.indexOf(chipActivoGlobal) !== -1);

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
      }, 200);
    }

    /* ============================================================
       PINTAR
       ============================================================ */
    function pintar() {
      if (!track) return;
      var c = coloresDelPostOrigen();
      track.style.setProperty('--post-color', c.oficial);
      track.style.setProperty('--post-pastel', c.pastel);

      track.innerHTML =
        buildIdentidad() +
        buildStats() +
        buildUbicacion() +
        buildWhatsapp() +
        buildPublicaciones();

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(track);
      }

      engancharTabs();
      engancharCeldas();
      engancharVerTodas();
      engancharWhatsapp();
    }

    /* ============================================================
       ABRIR / CERRAR (fades entre #seccionesTrack y #partnerTrack)
       ============================================================ */
    function abrir(postDesdeElQueSeAbre) {
      postOrigen    = postDesdeElQueSeAbre || null;
      partnerActivo = postOrigen ? buscarPartner(postOrigen.idPartner) : null;

      if (!partnerActivo) return;

      if (!construir() || !track) return;

      verTodos   = false;
      chipActivo = chipInicialDesdeOrigen();

      haptic(10);
      pintar();
      abierto = true;

      var wrap = document.querySelector('.secciones-wrap');
      if (wrap) {
        scrollPostPrevio = wrap.scrollTop;
        wrap.scrollTop = 0;
      }

      /* El modo, el título y el historial los lleva Lista. */
      if (window.Lista && typeof window.Lista.abrirPartner === 'function') {
        window.Lista.abrirPartner();
      }

      var detalle = document.getElementById('seccionesTrack');
      if (!detalle) return;

      detalle.classList.add('fade-out');

      setTimeout(function () {
        detalle.hidden = true;
        detalle.classList.remove('fade-out');

        track.hidden = false;
        track.classList.add('fade-in');
        setTimeout(function () { track.classList.remove('fade-in'); }, 220);
      }, 200);
    }

    function cerrar() {
      if (!abierto) return;

      if (window.Lista && typeof window.Lista.cerrarPartner === 'function') {
        window.Lista.cerrarPartner(false);
      } else {
        ocultar();
      }
    }

    /* Lista dispara 'partner:ocultar' (volver del header,
       popstate, cambio de chip/ciudad/orden). */
    function ocultar() {
      if (!abierto) return;
      abierto = false;

      if (!track) return;
      track.classList.add('fade-out');

      setTimeout(function () {
        track.hidden = true;
        track.classList.remove('fade-out');

        /* Volver al POST solo si seguimos en modo detalle (si el
           cierre vino de un cambio de chip/ciudad ya se fue a la
           lista y no hay que resucitar el detalle). */
        var enDetalle = window.Lista && typeof window.Lista.getModo === 'function'
          ? window.Lista.getModo() === 'detalle'
          : false;

        if (enDetalle) {
          var detalle = document.getElementById('seccionesTrack');
          if (detalle) {
            detalle.hidden = false;
            detalle.classList.add('fade-in');
            setTimeout(function () { detalle.classList.remove('fade-in'); }, 220);
          }
          var wrap = document.querySelector('.secciones-wrap');
          if (wrap) wrap.scrollTop = scrollPostPrevio;
        }
      }, 200);
    }

    document.addEventListener('partner:ocultar', ocultar);

    /* Red de seguridad: si el post se cierra (post:change sin
       post) el lienzo del partner muere con él, sin fade. */
    document.addEventListener('post:change', function (e) {
      var post = e.detail ? e.detail.post : null;
      if (!post && abierto) {
        abierto = false;
        if (track) track.hidden = true;
      }
    });

    return {
      abrir:       abrir,
      cerrar:      cerrar,
      estaAbierto: function () { return abierto; }
    };

  })();