/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Seccion_Script.html
ESPEJO GITHUB:   github/js/Seccion_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Secciones. Pinta el lienzo del post:
                 hero con carrusel y etiqueta de ciudad, bloque de
                 bienvenida para posts sin foto, info y descripción
                 con su sheet, fila del partner, CTA, ubicación,
                 cross-sell, In Company y bloque asesor.
                 La sección Q&A la aporta window.Pregunta.
VERSIÓN:         2.1.1
CAMBIOS:         R77B: (1) Los posts sin foto ya no quedan sin
                 hero: se pinta un bloque de bienvenida (glifo
                 imagen de Iconos + mensaje de aliento) que conserva
                 el badge de ciudad y los botones sociales, para que
                 el post se sienta completo y con la misma estructura.
                 (2) El nombre del partner pasa a .textoPrimario.
                 R77: (1) El enlace de la descripción pasa a decir
                 "Ver descripción completa".
                 (2) El sheet de descripción gana el fade final que
                 se retira al llegar al final del scroll.
                 (3) El Q&A del lienzo lo construye y lo maneja
                 window.Pregunta (campo, envío y sheet de lectura);
                 aquí solo se monta en su orden.
DEPENDENCIAS:    Global_Script.html (postBackend), Core_Script.html
                 (SISTEMA, TABLAS), Iconos.html (pintarGlifos),
                 Seccion_Imagen_Script.html, Pregunta_Script.html
                 (window.Pregunta), Social_Script.html (window.Social),
                 Partner_Sheet_Script.html, Ciudad_Script (window.Ciudad),
                 Chips_Script (window.Chips), Seccion_CSS.html,
                 Pregunta_CSS.html, Core_CSS.html
════════════════════════════════════════════════════════════════════*/

  window.Secciones = (function () {

    var postActivo = null;
    var ID_POST_INCOMPANY = 'EMPR-001';

    function haptic(v) { if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} } }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) { if (partners[i].id === idPartner) return partners[i]; }
      return null;
    }

    function buscarPost(idPost) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) { if (posts[i].id === idPost) return posts[i]; }
      return null;
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function _urlImagen(u) {
      if (window.SeccionImagen && typeof window.SeccionImagen.urlImagenDirecta === 'function') return window.SeccionImagen.urlImagenDirecta(u);
      return String(u || '').trim();
    }

    function _buildHero(imagenes) {
      var limpias = (imagenes || []).map(function (u) { return String(u || '').trim(); }).filter(Boolean);

      var city = '';
      try {
        if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
          var c = window.Ciudad.getActual();
          if (c && c.titulo) city = c.titulo;
        }
      } catch(e) {}

      var cityBadge = city ? 
        '<div class="mk-hero-location textoPrimario" style="font-size:12px !important; font-weight:600 !important;">' +
          '<span class="mk-hero-location-icon" data-glifo="ubicacion"></span>' +
          '<span>' + escapeHtml(city) + '</span>' +
        '</div>' : '';

      var socialContainer = '<div class="app-hero-social" id="heroSocialButtons"></div>';

      /* Post sin foto: bloque de bienvenida con la misma estructura
         del hero (badge de ciudad y sociales incluidos), para que
         no se sienta roto ni incompleto y el usuario siga leyendo. */
      if (!limpias.length) {
        return '<div class="app-hero post-hero-vacio">' + cityBadge + socialContainer +
                 '<div class="post-hero-vacio-centro">' +
                   '<span class="post-hero-vacio-icono" data-glifo="imagen" aria-hidden="true"></span>' +
                   '<p class="post-hero-vacio-titulo textoPrimario">Este post no trae foto</p>' +
                   '<p class="textoSecundario post-hero-vacio-texto">Viene completo por escrito: sigue leyendo que aquí abajo hay bueno.</p>' +
                 '</div>' +
               '</div>';
      }

      if (limpias.length === 1) {
        var src = escapeHtml(_urlImagen(limpias[0]));
        return '<div class="app-hero">' + cityBadge + socialContainer + '<img class="post-hero-img" src="' + src + '" alt="" loading="lazy" data-full="' + src + '"></div>';
      }

      var html = '<div class="app-hero post-hero-carrusel">' + cityBadge + socialContainer;
      html +=   '<div class="post-hero-track" id="postHeroTrack">';
      limpias.forEach(function (u) {
        var src = escapeHtml(_urlImagen(u));
        html += '<div class="post-hero-slide"><img class="post-hero-img" src="' + src + '" alt="" loading="lazy" data-full="' + src + '"></div>';
      });
      html +=   '</div>';
      html +=   '<div class="app-hero-dots" id="postHeroDots">';
      limpias.forEach(function (_, i) { html += '<span class="app-hero-dot' + (i === 0 ? ' activo' : '') + '"></span>'; });
      html +=   '</div>';
      html += '</div>';
      return html;
    }

    function _renderMarkdown(md) {
      var texto = String(md || '').trim();
      if (!texto) return '';
      try { if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') { return window.marked.parse(texto); } } catch (e) {}
      return '<p>' + escapeHtml(texto) + '</p>';
    }

    function buildPresentacion() {
      var post = postActivo;
      if (!post) return '';
      var pj   = post.postJson || {};
      var meta = pj.meta || {};
      var desc = pj.descripcion || {};
      var imagenes = Array.isArray(meta.imagenes) ? meta.imagenes : [];
      var titulo   = String(desc.tituloPost || '').trim();
      var markdown = String(desc.markdown  || '').trim();
      var html = '';
      
      var hero = _buildHero(imagenes);
      if (hero) { html += '<div class="app-hero-wrap">' + hero + '</div>'; }
      html += '<div class="mk-info">';
      if (titulo) { html += '<h1 class="tituloPost" style="margin:0 0 8px 0;">' + escapeHtml(titulo) + '</h1>'; }
      if (markdown) {
        var renderExcerpt = _renderMarkdown(markdown);
        html += '<div class="mk-desc-wrap">' +
                  '<div class="mk-desc-clamp textoPrimario" id="postDescExcerpt">' + renderExcerpt + '</div>' +
                  '<button type="button" class="enlacesOpciones" id="postVerMas" style="margin-top:6px;">Ver descripción completa</button>' +
                '</div>';
      }
      html += '</div>';
      return html;
    }

    function buildPartner() {
      var post = postActivo;
      if (!post) return '';
      var partner = buscarPartner(post.idPartner);
      if (!partner) return '';
      var pj = partner.partnerJson || {};
      var nombre = String(partner.nombre || partner.marca || '').trim();
      var eslogan = String(pj.esloganPartner || '').trim();
      var inicial = nombre ? nombre.charAt(0).toUpperCase() : 'P';

      var meta = (post.postJson || {}).meta || {};
      var colorArr = meta.color || [];
      var colorOficial = colorArr[0] || '#475569';
      var colorPastel = colorArr[1] || '#f1f5f9';

      var html = '<div class="mk-hairline"></div>';
      html += '<div class="mk-partner-row" id="lienzoPartnerFila" style="--post-color:' + escapeHtml(colorOficial) + '; --post-pastel:' + escapeHtml(colorPastel) + ';">';
      html +=   '<div class="mk-partner-avatar">';
      html +=     '<span class="mk-partner-initial">' + escapeHtml(inicial) + '</span>';
      html +=     '<span class="mk-partner-verified-badge" data-glifo="badgeCheck" aria-label="Verificado"></span>';
      html +=   '</div>';
      html +=   '<div class="mk-partner-info">';
      html +=     '<div class="textoPrimario" style="color: var(--post-color) !important;">' + escapeHtml(nombre) + '</div>';
      if (eslogan) { html +=   '<div class="textoSecundario" style="font-size:12px !important;">' + escapeHtml(eslogan) + '</div>'; }
      html +=   '</div>';
      html +=   '<span class="mk-partner-chevron">›</span>';
      html += '</div>';
      return html;
    }

    function buildCTA() {
      var post = postActivo;
      if (!post) return '';
      var pj = post.postJson || {};
      var meta = pj.meta || {};
      
      var ctaTexto = String(meta.cta || 'Quiero reservar mi cupo').trim();
      var dudaTexto = String(meta.duda || '').trim();
      var hayDuda = dudaTexto.length > 0;

      var html = '<div class="mk-cta-section">';
      
      if (hayDuda) {
        html += '<button type="button" class="cta-duda enlacesOpciones">' + escapeHtml(dudaTexto) + '</button>';
      }
      
      html += '<button type="button" class="cta-reservar mk-cta-button" aria-label="Reservar cupo">';
      html +=   '<span class="cta-reservar-texto botonPrimario">' + escapeHtml(ctaTexto) + '</span>';
      html +=   '<span class="mk-cta-arrow-icon" data-glifo="flecha"></span>';
      html += '</button>';
      
      html += '</div>';
      return html;
    }

    function buildUbicacion() {
      var post = postActivo;
      if (!post) return '';
      var partner = buscarPartner(post.idPartner);
      var pj = (partner && partner.partnerJson) ? partner.partnerJson : {};
      var direccion = String(pj.direccion || '').trim();
      if (!direccion) return '';
      var ciudad = String(pj.ciudad || '').trim();
      var municipio = String(pj.municipio || '').trim();
      var estado = String(pj.estado || '').trim();
      var dirCompleta = [direccion, ciudad, municipio, estado].filter(Boolean).join(', ');
      var urlMaps = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dirCompleta);

      var html = '<div class="mk-hairline"></div>';
      html += '<div class="mk-location-section">' +
                '<div class="mk-location">' +
                  '<span class="mk-location-icon" data-glifo="ubicacion"></span>' +
                  '<div class="mk-location-content">' +
                    '<p class="textoPrimario" style="margin:0 !important;">' + escapeHtml(direccion) + '</p>' +
                    '<a href="' + urlMaps + '" target="_blank" rel="noopener" class="enlacesOpciones" style="text-decoration: none;">Cómo llegar</a>' +
                  '</div>' +
                '</div>' +
              '</div>';
      return html;
    }

    function buildQandA() {
      /* R77: la sección Q&A completa la construye window.Pregunta
         (campo en el lienzo + sheet de lectura). */
      if (window.Pregunta && typeof window.Pregunta.buildHTML === 'function') {
        return window.Pregunta.buildHTML();
      }
      return '';
    }

    function buildCrossSellHTML(ids) {
      if (!ids || !ids.length) return '';
      var html = '<div class="mk-hairline"></div>';
      html += '<div class="mk-section"><h2 class="titulo" style="margin:0 0 12px 0;">Publicaciones relacionadas</h2></div>';
      html += '<div class="mk-cross-row">';
      ids.forEach(function (id) {
        var p = buscarPost(id);
        if (!p) return;
        var nombre  = p.boton || p.titulo || p.id;
        var inicial = (nombre.charAt(0) || '?').toUpperCase();
        var color   = p.colorOficial || '#475569';
        var claro   = p.colorClaro   || '#f1f5f9';
        html += '<button type="button" class="mk-cross-card" data-post-solicitado="' + escapeHtml(p.id) + '" style="--post-color:' + escapeHtml(color) + '; --post-claro:' + escapeHtml(claro) + ';">' +
                  '<div class="mk-cross-avatar">' + escapeHtml(inicial) + '</div>' +
                  '<div class="mk-cross-name textoPrimario">' + escapeHtml(nombre) + '</div>' +
                '</button>';
      });
      html += '</div>';
      return html;
    }

    function buildInCompanyButton() {
      return '<div class="mk-section" style="padding-top:10px;">' +
          '<button type="button" class="cross-incompany" data-post-incompany="' + ID_POST_INCOMPANY + '">' +
            '<div class="ci-info"><span class="ci-titulo">¿Buscas capacitar a todo tu equipo?</span><span class="ci-cta">Conoce In Company</span></div>' +
            '<span class="ci-boton"><span data-glifo="flechaVer" style="width:18px; height:18px; display:block;"></span></span>' +
          '</button></div>';
    }

    function buildBloqueAsesor() {
      return '<div class="mk-section" style="padding-top:10px;">' +
          '<button type="button" class="bloque-asesor" id="bloqueAsesor">' +
            '<span class="bloque-asesor-icono" data-glifo="userPlus"></span>' +
            '<span class="bloque-asesor-info"><span class="bloque-asesor-titulo">¿Ofreces algún servicio?</span><span class="bloque-asesor-sub">Publícalo con nosotros y llega a más personas</span></span>' +
            '<span class="bloque-asesor-flecha" data-glifo="flechaVer"></span>' +
          '</button></div>';
    }

    function buildCrossSell() {
      var post = postActivo;
      if (!post) return '';
      var pj = post.postJson || {};
      var ids       = Array.isArray(pj.crosssell) ? pj.crosssell : [];
      var inCompany = pj.inCompany === true;
      var html = buildCrossSellHTML(ids);
      if (inCompany) { html += buildInCompanyButton(); }
      var esServicio = (post.idChips || []).indexOf('se') !== -1;
      if (esServicio) { html += buildBloqueAsesor(); }
      return html;
    }

    var descSheetRoot = null;
    var descFadeEnganchado = false;
    function _construirDescSheet() {
      if (descSheetRoot) return descSheetRoot;
      var area = document.querySelector('.area-contenido') || document.body;
      descSheetRoot = document.createElement('div');
      descSheetRoot.className = 'mk-sheet-root';
      descSheetRoot.id = 'postDescSheetRoot';
      descSheetRoot.innerHTML = '<div class="mk-sheet-backdrop" id="postDescSheetBackdrop"></div>' +
        '<div class="mk-sheet" id="postDescSheet"><div class="mk-sheet-handle-area"><div class="mk-sheet-handle"></div></div>' +
          '<button type="button" class="mk-sheet-close" id="postDescSheetClose" data-glifo="close"></button>' +
          '<div class="mk-sheet-content" id="postDescSheetContent"></div></div>';
      area.appendChild(descSheetRoot);
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(descSheetRoot);
      descSheetRoot.querySelector('#postDescSheetBackdrop').addEventListener('click', cerrarSheetDesc);
      descSheetRoot.querySelector('#postDescSheetClose').addEventListener('click', cerrarSheetDesc);
      return descSheetRoot;
    }

    function abrirSheetDesc() {
      if (!postActivo) return;
      var root = _construirDescSheet(); if (!root) return;
      var pj = postActivo.postJson || {}; var desc = pj.descripcion || {};
      var titulo = String(desc.tituloPost || '').trim(); var markdown = String(desc.markdown || '').trim();
      if (!markdown) return;
      var content = root.querySelector('#postDescSheetContent');
      var html = ''; if (titulo) html += '<h2 class="tituloPost" style="margin-bottom:16px;">' + escapeHtml(titulo) + '</h2>';
      html += '<div class="textoPrimario">' + _renderMarkdown(markdown) + '</div>';
      html += '<div class="mk-sheet-fade" id="postDescSheetFade"></div>';
      content.innerHTML = html;

      /* R77: el fade avisa que hay más texto y se retira al llegar
         al final del scroll para leer completo. Si el texto no
         desborda, el fade se retira de una vez. */
      function revisarFadeDesc() {
        var fade = document.getElementById('postDescSheetFade');
        if (!fade) return;
        var alFinal = (content.scrollTop + content.clientHeight) >= (content.scrollHeight - 4);
        fade.classList.toggle('fin', alFinal);
      }
      if (!descFadeEnganchado) {
        descFadeEnganchado = true;
        content.addEventListener('scroll', revisarFadeDesc, { passive: true });
      }

      content.scrollTop = 0;
      revisarFadeDesc();
      root.classList.add('abierto');
    }

    function cerrarSheetDesc() { if (descSheetRoot) descSheetRoot.classList.remove('abierto'); }

    function pintarVistas() {
      var track = document.getElementById('seccionesTrack');
      if (!track) return;
      if (!postActivo) { track.innerHTML = ''; return; }

      track.innerHTML = '';
      var fragment = document.createDocumentFragment();

      var htmlPresentacion = buildPresentacion(); if (htmlPresentacion) { var sec = document.createElement('div'); sec.innerHTML = htmlPresentacion; fragment.appendChild(sec); }
      var htmlPartner = buildPartner(); if (htmlPartner) { var sec = document.createElement('div'); sec.innerHTML = htmlPartner; fragment.appendChild(sec); }
      var htmlCTA = buildCTA(); if (htmlCTA) { var sec = document.createElement('div'); sec.innerHTML = htmlCTA; fragment.appendChild(sec); }
      var htmlUbi = buildUbicacion(); if (htmlUbi) { var sec = document.createElement('div'); sec.innerHTML = htmlUbi; fragment.appendChild(sec); }
      
      var htmlQandA = buildQandA(); if (htmlQandA) { var sec = document.createElement('div'); sec.innerHTML = htmlQandA; fragment.appendChild(sec); }

      var htmlCross = buildCrossSell(); if (htmlCross) { var sec = document.createElement('div'); sec.innerHTML = htmlCross; fragment.appendChild(sec); }

      track.appendChild(fragment);

      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(track);
      if (window.SeccionImagen && typeof window.SeccionImagen.enganchar === 'function') window.SeccionImagen.enganchar(track);
      
      if (window.Social && typeof window.Social.pintar === 'function') {
        window.Social.pintar();
      }

      engacharPresentacion(track);
      engacharPartner(track);
      engacharCrossSell(track);
      engacharInCompany(track);
      engacharBloqueAsesor(track);

      /* R77: el Q&A vive en window.Pregunta (campo + sheet de
         lectura); aquí se engancha y se carga con el post vivo. */
      if (window.Pregunta && typeof window.Pregunta.enganchar === 'function') {
        window.Pregunta.enganchar(track);
        window.Pregunta.cargar(postActivo.id);
      }
    }

    function engacharPresentacion(track) {
      var heroTrack = track.querySelector('#postHeroTrack');
      var dots      = track.querySelectorAll('#postHeroDots .app-hero-dot');
      if (heroTrack && dots.length) {
        var scrollTimeout = null;
        heroTrack.addEventListener('scroll', function () {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(function () {
            var w = heroTrack.clientWidth; if (!w) return;
            var idx = Math.round(heroTrack.scrollLeft / w);
            if (idx < 0) idx = 0; if (idx >= dots.length) idx = dots.length - 1;
            dots.forEach(function (d, i) { d.classList.toggle('activo', i === idx); });
          }, 100);
        }, { passive: true });
      }
      var btnVerMas = track.querySelector('#postVerMas');
      if (btnVerMas) { btnVerMas.addEventListener('click', function (e) { e.preventDefault(); haptic(10); abrirSheetDesc(); }); }
    }

    function engacharPartner(track) {
      var fila = track.querySelector('#lienzoPartnerFila');
      if (!fila) return;
      fila.addEventListener('click', function() {
        haptic(10);
        if (window.PartnerSheet && typeof window.PartnerSheet.abrir === 'function') { window.PartnerSheet.abrir(postActivo); }
      });
    }

    function irAPost(idPost) {
      var post = buscarPost(idPost);
      if (!post) return;
      var chips = post.idChips || [];
      if (chips.length === 0) return;

      var cambioCiudad = false;
      try {
        if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
          var ciudadActual = window.Ciudad.getActual();
          var idCiudadActual = ciudadActual ? ciudadActual.idCiudad : null;
          var ciudadesPost = post.idCiudad || [];
          var yaPertenece = !!idCiudadActual && ciudadesPost.indexOf(idCiudadActual) !== -1;
          if (!yaPertenece) {
            var disponibles = window.Ciudad.getLista();
            for (var ci = 0; ci < ciudadesPost.length && !cambioCiudad; ci++) {
              for (var cd = 0; cd < disponibles.length; cd++) {
                if (disponibles[cd].idCiudad === ciudadesPost[ci]) { window.Ciudad.aplicarGuardada(disponibles[cd]); cambioCiudad = true; break; }
              }
            }
          }
        }
      } catch (e) {}

      var chipActivo = (window.Chips && typeof window.Chips.getChipActivo === 'function') ? window.Chips.getChipActivo() : null;
      var enMismoChip = (chipActivo && chips.indexOf(chipActivo) !== -1);

      if (enMismoChip && !cambioCiudad) { document.dispatchEvent(new CustomEvent('post:solicitar', { detail: { idPost: idPost } })); return; }
      if (!enMismoChip && window.Chips && typeof window.Chips.seleccionar === 'function') { window.Chips.seleccionar(chips[0]); }
      setTimeout(function () { document.dispatchEvent(new CustomEvent('post:solicitar', { detail: { idPost: idPost } })); }, 80);
    }

    function engacharCrossSell(root) { root.querySelectorAll('.mk-cross-card[data-post-solicitado]').forEach(function (btn) { btn.addEventListener('click', function () { var id = this.getAttribute('data-post-solicitado'); if (id) irAPost(id); }); }); }
    function engacharInCompany(root) { root.querySelectorAll('.cross-incompany[data-post-incompany]').forEach(function (btn) { btn.addEventListener('click', function () { var id = this.getAttribute('data-post-incompany'); if (id) irAPost(id); }); }); }
    function engacharBloqueAsesor(root) {
      var btn = root.querySelector('#bloqueAsesor'); if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault(); haptic(10);
        var root_  = (window.SISTEMA && window.SISTEMA.root) || {}; var admin_ = root_.admin || {};
        if (typeof window.abrirWhatsapp === 'function') { window.abrirWhatsapp(admin_.whatsapp, admin_.mensajeWhatsapp); }
      });
    }

    function irAInicio() { var wrap = document.querySelector('.secciones-wrap'); if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' }); }
    function pintar() { pintarVistas(); }

    document.addEventListener('post:change', function (e) {
      postActivo = e.detail ? e.detail.post : null;
      pintarVistas();
      irAInicio();
    });

    return { pintar: pintar, irAInicio: irAInicio, irAPost: irAPost };
  })();