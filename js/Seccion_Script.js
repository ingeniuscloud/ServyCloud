/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Seccion_Script.html
ESPEJO GITHUB:   github/js/Seccion_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Secciones. Pinta el lienzo del post:
                 hero con carrusel y etiqueta de ciudad, bloque de
                 bienvenida para posts sin foto, info (título, promo
                 del post y descripción) con su sheet, CTA, fila del
                 partner, ubicación, Q&A, publicaciones relacionadas
                 (sección pintada), In Company y bloque asesor.
                 La sección Q&A la aporta window.Pregunta.
VERSIÓN:         2.3.1
CAMBIOS:         R86: el nombre del partner del post viaja con las
                 preguntas (Pregunta.poner(id, data, nombre)) para
                 la firma "Respuesta de <partner>" del nuevo
                 esquema de fila única (RESPUESTA + TIMESTAMPFIN
                 en la misma fila de la pregunta).
                 R84: (1) Bloque "Este post no trae foto" RETIRADO
                 (código muerto): el backend entrega la imagen por
                 defecto (Setup ROOTJSON.app.imagenDefault) para
                 todo post sin foto. (2) El badge de la promo se
                 busca en el ITEM de PROMOJSON (idBadge) y como
                 respaldo en el post; si hay banner y no llega
                 badge de la BD, se pinta la píldora PROMO para que
                 la etiqueta siempre identifique la promo. (3) El
                 avatar del cross-sell queda blanco con la inicial
                 en el color pastel del post. (4) El Q&A ya no pide
                 las preguntas aparte: llegan con el post
                 (postDetalle.preguntas) y se pintan con
                 Pregunta.poner (cargar queda de respaldo).
                 R83: (1) El badge de la promo (el de la BD, el
                 mismo de la marquesina) se pinta a la DERECHA del
                 banner del post. (2) La sección pintada de
                 relacionados ahora ABRIGA también a In Company y
                 Servy publicidad. (3) Servy publicidad lleva el
                 MISMO botón blanco redondo del In Company. (4) El
                 banner de las tarjetas del cross-sell pasa a
                 clarito con el avatar del color.
                 R82: (1) El CTA sube arriba del partner: es el
                 botón de la publicación, no del partner. Orden del
                 lienzo: info → CTA → divisora → partner →
                 ubicación → divisora → Q&A → relacionados.
                 (2) Divisoras de sección: una debajo del CTA (cierra
                 la info del producto o servicio) y una debajo de la
                 dirección (cierra la sección del partner). Antes de
                 "Publicaciones relacionadas" NO va divisora: esa
                 sección abre con su propio fondo pintado.
                 (3) Tarjeta de promo del post: si el post tiene
                 promo activa (PROMOJSON vigente) se pinta debajo del
                 título con banner del color del post y precios.
                 (4) Publicaciones relacionadas con fondo propio
                 (#FFF7ED) y tarjetas nuevas: banner superior con el
                 color del post, avatar blanco con la inicial y nombre
                 sobre fondo tintado. Sin caja: el fondo es de la
                 sección completa.
                 (5) Tipografías al sistema del Core: In Company y
                 bloque asesor pasan a .textoSecundario/.textoPrimario.
                 R77B: (1) Bloque de bienvenida para posts sin foto
                 (glifo imagen + mensaje de aliento, badge de ciudad
                 y sociales incluidos). (2) Nombre del partner en
                 .textoPrimario.
                 R77: (1) "Ver descripción completa". (2) Fade final
                 del sheet de descripción. (3) El Q&A del lienzo lo
                 construye window.Pregunta.
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

      /* R84: SIN bloque de "post sin foto" — código muerto. El
         backend entrega la imagen por defecto del Setup
         (ROOTJSON.app.imagenDefault) para todo post sin foto;
         si aún así no llegara nada, el hero queda como vidrio
         (glass) con su badge y sus sociales. */
      if (!limpias.length) {
        return '<div class="app-hero">' + cityBadge + socialContainer + '</div>';
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

    /* ============================================================
       PROMO DEL POST (R82) · tarjeta debajo del título
       La promo activa sale del mismo PROMOJSON que alimenta la
       marquesina de la lista (SISTEMA.promo.porCiudad): si el post
       abierto es el de la promo vigente (fechas + ciudad), se pinta
       aquí como incentivo de compra. El banner manda con el texto
       de la promo y los precios aparecen si la hoja los trae.
       ============================================================ */
    function _hoyISO() {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    function _promoDelPost(post) {
      var promo = (window.SISTEMA && window.SISTEMA.promo) || null;
      if (!promo || promo.activo === false || !post) return null;
      var ciudad = null;
      try {
        if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
          var c = window.Ciudad.getActual();
          ciudad = c ? c.idCiudad : null;
        }
      } catch (e) {}
      if (!ciudad) return null;
      var raw  = (promo.porCiudad && promo.porCiudad[ciudad]) || null;
      var pool = [];
      if (Array.isArray(raw)) { pool = raw; }
      else if (raw && (raw.idPost || raw.idPostActual)) { pool = [raw]; }
      var hoy = _hoyISO();
      for (var i = 0; i < pool.length; i++) {
        var item = pool[i]; if (!item) continue;
        var idPost = item.idPost || item.idPostActual;
        if (idPost !== post.id) continue;
        if (item.inicia && item.inicia > hoy) continue;
        if (item.termina && item.termina < hoy) continue;
        return item;
      }
      return null;
    }

    function _primerTexto(fuente, campos) {
      for (var i = 0; i < campos.length; i++) {
        var v = fuente ? fuente[campos[i]] : null;
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number' && !isNaN(v)) return String(v);
      }
      return '';
    }

    /* R83: el badge que identifica a la promo es el MISMO de la
       marquesina. R84: se busca en el ITEM de PROMOJSON (ahí vive
       desde R76) y como respaldo en el post; estado en false no
       se pinta. */
    function _badgeDelPost(obj) {
      if (!obj || !obj.idBadge) return null;
      var badges = (window.SISTEMA && window.SISTEMA.badges) || [];
      for (var i = 0; i < badges.length; i++) {
        if (badges[i] && badges[i].idBadge === obj.idBadge) {
          if (badges[i].estado === false) return null;
          return badges[i];
        }
      }
      return null;
    }

    function buildPromoHTML() {
      var post = postActivo;
      if (!post) return '';
      var item = _promoDelPost(post);
      /* R84: el badge vive en el ITEM de PROMOJSON (con respaldo
         en el post). Si hay banner y la BD no trae badge, la
         píldora PROMO identifica la etiqueta igualmente. */
      var badge = _badgeDelPost(item) || _badgeDelPost(post);
      if (!item && !badge) return '';

      var metaPost = (post.postJson && post.postJson.meta) || {};

      var banner = _primerTexto(item, ['texto', 'promoTexto', 'descripcion', 'mensaje']) ||
                   _primerTexto(post, ['promoTexto']) ||
                   _primerTexto(metaPost, ['promoTexto']);

      var viejo     = _primerTexto(item, ['precioAnterior', 'precioViejo', 'oldPrice', 'precioAntes']);
      var actual    = _primerTexto(item, ['precioActual', 'precio', 'newPrice', 'precioNuevo']);
      var descuento = _primerTexto(item, ['descuento', 'discount', 'off']);

      /* Si no viene el descuento pero hay ambos precios numéricos,
         se calcula (ej. 5% OFF). */
      if (!descuento && viejo && actual) {
        var vV = parseFloat(String(viejo).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        var vA = parseFloat(String(actual).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (!isNaN(vV) && !isNaN(vA) && vV > 0 && vA > 0 && vA < vV) {
          descuento = Math.round((1 - (vA / vV)) * 100) + '% OFF';
        }
      }

      if (!banner && !actual && !badge) return '';

      var colorArr = metaPost.color || [];
      var colorOficial = colorArr[0] || post.colorOficial || '#f97316';
      var colorPastel  = colorArr[1] || post.colorClaro   || '#f1f5f9';

      var html = '<div class="mk-promo-block" style="--post-color:' + escapeHtml(colorOficial) + '; --post-claro:' + escapeHtml(colorPastel) + '">';
      /* R83: fila del banner = TEXTO de la promo + BADGE a la
         derecha (misma anatomía de la marquesina). R84: si el
         item de PROMOJSON no trae idBadge, la píldora PROMO
         identifica la etiqueta (nunca queda ciega). */
      var badgeTitulo = (badge && badge.titulo) ? badge.titulo : ((banner) ? 'PROMO' : '');
      var badgeHtml = badgeTitulo
        ? '<span class="mk-promo-badge">' + escapeHtml(badgeTitulo) + '</span>'
        : '';
      if (banner || badgeHtml) {
        html += '<div class="mk-promo-banner">' +
                  '<span class="mk-promo-banner-texto">' + escapeHtml(banner) + '</span>' +
                  badgeHtml +
                '</div>';
      }
      if (actual) {
        html += '<div class="mk-promo-prices">';
        if (viejo) { html += '<div class="mk-promo-old-price textoSecundario">' + escapeHtml(viejo) + '</div>'; }
        html += '<div class="mk-promo-current-row">' +
                  '<div class="mk-promo-current-price">' + escapeHtml(actual) + '</div>' +
                  (descuento ? '<div class="mk-promo-discount">' + escapeHtml(descuento) + '</div>' : '') +
                '</div>';
        html += '</div>';
      }
      html += '</div>';
      return html;
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
      /* R82: la promo vive debajo del título (jerarquía: qué es →
         incentivo → detalle). */
      html += buildPromoHTML();
      if (markdown) {
        var renderExcerpt = _renderMarkdown(markdown);
        html += '<div class="mk-desc-wrap">' +
                  '<div class="mk-desc-clamp textoPrimario" id="postDescExcerpt">' + renderExcerpt + '</div>' +
                  '<button type="button" class="enlacesOpciones" id="postVerMas" style="margin-top:14px;">Ver descripción completa</button>' +
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

      /* R82: sin hairline propia — la divisora que cierra la info
         del producto queda debajo del CTA, justo antes del partner. */
      var html = '<div class="mk-partner-row" id="lienzoPartnerFila" style="--post-color:' + escapeHtml(colorOficial) + '; --post-pastel:' + escapeHtml(colorPastel) + ';">';
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
      /* R82: divisora debajo del CTA — aquí termina la info del
         producto o servicio y empieza la sección del partner. */
      html += '<div class="mk-hairline"></div>';
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

      var html = '<div class="mk-location-section">' +
                '<div class="mk-location">' +
                  '<span class="mk-location-icon" data-glifo="ubicacion"></span>' +
                  '<div class="mk-location-content">' +
                    '<p class="textoPrimario" style="margin:0 !important;">' + escapeHtml(direccion) + '</p>' +
                    '<a href="' + urlMaps + '" target="_blank" rel="noopener" class="enlacesOpciones" style="text-decoration: none;">Cómo llegar</a>' +
                  '</div>' +
                '</div>' +
              '</div>';
      /* R82: divisora debajo de la dirección — aquí termina la
         sección del partner. */
      html += '<div class="mk-hairline"></div>';
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
      /* R83: devuelve solo la cabeza y las tarjetas — el wrapper
         de la sección pintada lo arma buildCrossSell para abrigar
         también a In Company y Servy publicidad. Banner clarito
         (tinte 15%) y avatar BLANCO con la inicial en el color
         PASTEL del post (R84). */
      var html = '<div class="mk-section mk-rel-cabeza"><h2 class="titulo" style="margin:0;">Publicaciones relacionadas</h2></div>';
      html += '<div class="mk-cross-row">';
      ids.forEach(function (id) {
        var p = buscarPost(id);
        if (!p) return;
        var nombre  = p.boton || p.titulo || p.id;
        var inicial = (nombre.charAt(0) || '?').toUpperCase();
        var color   = p.colorOficial || '#475569';
        var claro   = p.colorClaro   || '#f1f5f9';
        var pastel  = p.colorPastel  || claro;
        html += '<button type="button" class="mk-cross-card" data-post-solicitado="' + escapeHtml(p.id) + '" style="--post-color:' + escapeHtml(color) + '; --post-claro:' + escapeHtml(claro) + '; --post-pastel:' + escapeHtml(pastel) + ';">' +
                  '<div class="mk-cross-top"><div class="mk-cross-avatar">' + escapeHtml(inicial) + '</div></div>' +
                  '<div class="mk-cross-name textoPrimario">' + escapeHtml(nombre) + '</div>' +
                '</button>';
      });
      html += '</div>';
      return html;
    }

    function buildInCompanyButton() {
      return '<div class="mk-section" style="padding-top:10px;">' +
          '<button type="button" class="cross-incompany" data-post-incompany="' + ID_POST_INCOMPANY + '">' +
            '<div class="ci-info"><span class="ci-titulo textoSecundario">¿Buscas capacitar a todo tu equipo?</span><span class="ci-cta textoPrimario">Conoce In Company</span></div>' +
            '<span class="ci-boton"><span data-glifo="flechaVer" style="width:18px; height:18px; display:block;"></span></span>' +
          '</button></div>';
    }

    function buildBloqueAsesor() {
      /* R83: el Servy publicidad lleva el MISMO botón blanco
         redondo del In Company (.ci-boton) en vez de la flecha
         suelta. */
      return '<div class="mk-section" style="padding-top:10px;">' +
          '<button type="button" class="bloque-asesor" id="bloqueAsesor">' +
            '<span class="bloque-asesor-icono" data-glifo="userPlus"></span>' +
            '<span class="bloque-asesor-info"><span class="bloque-asesor-titulo textoPrimario">¿Ofreces algún servicio?</span><span class="bloque-asesor-sub textoSecundario">Publícalo con nosotros y llega a más personas</span></span>' +
            '<span class="ci-boton"><span data-glifo="flechaVer" style="width:18px; height:18px; display:block;"></span></span>' +
          '</button></div>';
    }

    function buildCrossSell() {
      var post = postActivo;
      if (!post) return '';
      var pj = post.postJson || {};
      var ids       = Array.isArray(pj.crosssell) ? pj.crosssell : [];
      var inCompany = pj.inCompany === true;
      var esServicio = (post.idChips || []).indexOf('se') !== -1;
      var tarjetas  = buildCrossSellHTML(ids);
      var inCo      = inCompany ? buildInCompanyButton() : '';
      var asesor    = esServicio ? buildBloqueAsesor() : '';
      if (!tarjetas && !inCo && !asesor) return '';
      /* R83: la sección pintada abriga a las tarjetas relacionadas
         Y también a In Company y Servy publicidad. */
      var html = '<div class="mk-rel-section">';
      if (tarjetas) { html += tarjetas; }
      if (inCo)     { html += inCo; }
      if (asesor)   { html += asesor; }
      html += '</div>';
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

      /* R82: el CTA es de la publicación, no del partner — va
         arriba del partner y cierra la info del producto con su
         divisora. */
      var htmlPresentacion = buildPresentacion(); if (htmlPresentacion) { var sec = document.createElement('div'); sec.innerHTML = htmlPresentacion; fragment.appendChild(sec); }
      var htmlCTA = buildCTA(); if (htmlCTA) { var sec = document.createElement('div'); sec.innerHTML = htmlCTA; fragment.appendChild(sec); }
      var htmlPartner = buildPartner(); if (htmlPartner) { var sec = document.createElement('div'); sec.innerHTML = htmlPartner; fragment.appendChild(sec); }
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
         lectura). R84: las últimas 2 preguntas llegan DENTRO del
         post (igual que la imagen) y se pintan con poner() sin
         pedir nada aparte; cargar() queda de respaldo.
         R86: el nombre del partner viaja con ellas para la firma
         "Respuesta de <partner>" de cada respuesta. */
      if (window.Pregunta && typeof window.Pregunta.enganchar === 'function') {
        window.Pregunta.enganchar(track);
        if (postActivo.preguntas && typeof window.Pregunta.poner === 'function') {
          var partnerQ = buscarPartner(postActivo.idPartner);
          var nombreQ  = partnerQ ? String(partnerQ.nombre || partnerQ.marca || '').trim() : '';
          window.Pregunta.poner(postActivo.id, postActivo.preguntas, nombreQ);
        } else {
          window.Pregunta.cargar(postActivo.id);
        }
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