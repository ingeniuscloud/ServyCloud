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
VERSIÓN:         2.9.0
CAMBIOS:         R115: el titulo y la descripcion de la promo
                 del post aceptan el formato estilo WhatsApp
                 escrito en la BD (via Global.waFormato):
                 *negrita*, _cursiva_, ~tachado~, `codigo` y
                 > cita — los símbolos se convierten en el efecto
                 y desaparecen; sin pareja se pintan tal cual. El
                 badge y los precios quedan igual.
                 R109: GEMELO SINCRONIZADO byte-idéntico al GAS.
                 Entra la lectura del bloque
                 promocion del POSTJSON (titulo/descripcion/
                 idBadge, hermano de meta; respaldo meta.promo), la
                 regla del dueño de MOSTRARLA aunque el post no
                 esté agendado en PROMOJSON (fuera el cortón
                 if(!item)) y el badge desde BADGEJSON via idBadge
                 (apagado → sin píldora, el texto queda).
                 R100: FIX de la promo muda (lee del POSTJSON, no
                 del item de PROMOJSON).
DEPENDENCIAS:    Global_Script.js (postBackend), Index (SISTEMA,
                 TABLAS), Iconos.js (pintarGlifos), Lista_Script.js
                 (window.Lista: getPostActivo),
                 Seccion_Imagen_Script.js, Seccion_CSS.css,
                 Promo_CSS.css, Core_CSS.css
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

      /* R90: URL de la imagen por defecto del Setup. Si una foto
         del post ES esa (post sin foto propia), el CSS la pinta
         casi transparente para que no compita con el CTA. */
      var imgDef = '';
      try {
        imgDef = String((window.SISTEMA && window.SISTEMA.root && window.SISTEMA.root.app && window.SISTEMA.root.app.imagenDefault) || '').trim();
      } catch (e) {}
      function claseDefault(u) { return (imgDef && u === imgDef) ? ' post-hero-img-default' : ''; }

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
        return '<div class="app-hero">' + cityBadge + socialContainer + '<img class="post-hero-img' + claseDefault(limpias[0]) + '" alt="" loading="lazy" data-full="' + src + '"></div>';
      }

      var html = '<div class="app-hero post-hero-carrusel">' + cityBadge + socialContainer;
      html +=   '<div class="post-hero-track" id="postHeroTrack">';
      limpias.forEach(function (u) {
        var src = escapeHtml(_urlImagen(u));
        html += '<div class="post-hero-slide"><img class="post-hero-img' + claseDefault(u) + '" alt="" loading="lazy" data-full="' + src + '"></div>';
      });
      html +=   '</div>';
      html +=   '<div class="app-hero-dots" id="postHeroDots">';
      limpias.forEach(function (_, i) { html += '<span class="app-hero-dot' + (i === 0 ? ' activo' : '') + '"></span>'; });
      html +=   '</div>';
      html += '</div>';
      return html;
    }

    /* ============================================================
       R94 · PINTADO DE LAS IMÁGENES DEL HERO — cada
       .post-hero-img nace SIN src: pintarImagenesHero la
       alimenta vía window.SeccionImagen.poblarConL2 (L2 propia:
       cache hit → pinta al instante sin red; miss → descarga y
       guarda; sin Cache API → src directo). Respaldo: si algo
       falla, src con la URL de siempre. El skeleton individual
       de imagen (R91) se retira — código muerto en la pantalla
       real; el esqueleto GENERAL del detalle sigue cubriendo la
       espera del post.
       ============================================================ */
    function pintarImagenesHero(raiz) {
      var imgs = (raiz || document).querySelectorAll('img.post-hero-img');
      Array.prototype.forEach.call(imgs, function (img) {
        var u = img.getAttribute('data-full') || '';
        if (!u) return;
        if (window.SeccionImagen && typeof window.SeccionImagen.poblarConL2 === 'function') {
          try { window.SeccionImagen.poblarConL2(img, u); return; } catch (e) {}
        }
        img.src = u; /* respaldo: comportamiento de siempre */
      });
    }

    function _renderMarkdown(md) {
      var texto = String(md || '').trim();
      if (!texto) return '';
      /* R93 · CITA CON LLAMADO (^) — configuración tipográfica del
         dueño dentro del markdown (no es markdown estándar): las
         filas que empiezan con "^" son citas de llamado, en .cita
         pero SIN línea a la izquierda. Se convierten ANTES del
         parseo en blockquotes marcados con un separador invisible
         (ZWSP) para que el decorador las reconozca después y les
         quite la línea. Las filas con ">" normales pasan intactas. */
      try {
        var filas = texto.split('\n');
        for (var i = 0; i < filas.length; i++) {
          if (/^\s*\^\s?/.test(filas[i])) {
            filas[i] = '>' + '\u200B' + filas[i].replace(/^\s*\^\s?/, '');
          }
        }
        texto = filas.join('\n');
      } catch (e) {}
      var html = '';
      try { if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') { html = window.marked.parse(texto); } } catch (e) {}
      if (!html) html = '<p>' + escapeHtml(texto) + '</p>';
      /* R92: el placeholder [valor bcv] del markdown se sustituye
         por la fila de la tasa (la misma que mostraba el plan
         viejo). Si no hay tasa servida, desaparece — nunca se
         pinta el texto crudo. */
      try { if (/\[valor bcv\]/i.test(html)) html = html.replace(/\[valor bcv\]/gi, _htmlTasaBCV()); } catch (e) {}
      return html;
    }

    /* ============================================================
       R92/R93 · TASA BCV EN EL MARKDOWN — helpers del texto antiguo
       (formatearBs: 1234.5 → 1.234,50). La fila usa SISTEMA.root.
       tasas (dolar + fechavalor), que el backend ya sirve en el
       ROOTJSON (03 BCV.gs la actualiza a diario).
       R93: limpiarFechaTasa deja la fecha COMPLETA con el año, como
       la pide el dueño ("lunes 21 de octubre 2026"): quita las
       comas, el "de" que queda colgando antes del año y baja el
       inicial ("Viernes, 17 de octubre de 2025" → "viernes 17 de
       octubre 2025").
       ============================================================ */
    function formatearBs_(n) {
      var v = Number(n);
      if (!isFinite(v)) return '';
      var s = v.toFixed(2).replace('.', ',');
      var partes = s.split(',');
      partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return partes.join(',');
    }

    function limpiarFechaTasa_(s) {
      var t = String(s || '')
        .replace(/,/g, '')
        .replace(/\s+d[ei]\s+(\d{4})\s*$/i, ' $1')
        .replace(/\s+/g, ' ')
        .trim();
      if (t) t = t.charAt(0).toLowerCase() + t.slice(1);
      return t;
    }

    function _htmlTasaBCV() {
      var tasas = {};
      try { tasas = (window.SISTEMA && window.SISTEMA.root && window.SISTEMA.root.tasas) || {}; } catch (e) {}
      var dolar = Number(tasas.dolar);
      if (!isFinite(dolar) || dolar <= 0) return '';
      var fecha = limpiarFechaTasa_(tasas.fechavalor);
      /* R93: la fila es una CITA completa — tipografía .cita en todo
         el texto, en UNA sola fila (nowrap + separador fijo de 7
         espacios duros) y en el color del post, que es la única
         diferencia con una cita normal:
         "Tasa BCV {fecha}       Bs. {valor}". El color viaja inline
         con !important para vencer al !important de .cita del Core. */
      return '<span class="mk-bcv cita" style="color:#f97316 !important;">' +
               'Tasa BCV' + (fecha ? ' ' + escapeHtml(fecha) : '') +
               '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' +
               'Bs. ' + formatearBs_(dolar) +
             '</span>';
    }

    /* ============================================================
       R92 · DECORADOR DE TABLAS MARKDOWN — marked produce
       <table> sin clases y el navegador las pinta "de fábrica"
       (encabezado centrado, sin bordes). Aquí se visten con las
       tipografías del Core: th → .textoPrimario, td →
       .textoSecundario. Si la tabla tiene 3 columnas (el plan de
       inversión del curso), la última (precios) lleva .subtitulo
       y la tabla .mk-plan-tabla para que el CSS alinee los
       valores a la derecha.
       ============================================================ */
    function _decorarTablasMarkdown(raiz) {
      if (!raiz || !raiz.querySelectorAll) return;
      var tablas = raiz.querySelectorAll('table');
      Array.prototype.forEach.call(tablas, function (tabla) {
        var primera = tabla.rows && tabla.rows[0];
        var esPlan = primera ? (primera.cells.length === 3) : false;
        if (esPlan) tabla.classList.add('mk-plan-tabla');
        Array.prototype.forEach.call(tabla.querySelectorAll('th'), function (th) {
          th.classList.add('textoPrimario');
        });
        Array.prototype.forEach.call(tabla.querySelectorAll('td'), function (td) {
          var esPrecio = esPlan && td.parentNode && td === td.parentNode.cells[td.parentNode.cells.length - 1];
          /* R92: en el plan, la celda de precios SOLO lleva
             .subtitulo — si llevara también .textoSecundario, la
             de Core (más tarde en la hoja) pisaría el 18px. */
          td.classList.add(esPrecio ? 'subtitulo' : 'textoSecundario');
        });
      });
    }

    /* ============================================================
       R93 · DECORADOR DE CITAS MARKDOWN — el dueño pidió que las
       citas (">") lleven su línea a la izquierda y la tipografía
       .cita del Core. Los blockquotes marcados con el separador
       invisible (ZWSP) son las citas de llamado "^": misma
       tipografía, pero SIN línea. El separador se limpia del texto
       para que nunca se pinte. La línea la dibuja Seccion_CSS
       (blockquote con clase .cita); quitarla también es CSS
       (.mk-cita-llamado).
       ============================================================ */
    function _limpiarInvisibles(el) {
      var nodos = el.childNodes;
      for (var i = nodos.length - 1; i >= 0; i--) {
        var nodo = nodos[i];
        if (nodo.nodeType === 3) {
          if (nodo.nodeValue && nodo.nodeValue.indexOf('\u200B') !== -1) {
            var limpio = nodo.nodeValue.split('\u200B').join('');
            if (limpio) { nodo.nodeValue = limpio; } else { el.removeChild(nodo); }
          }
        } else if (nodo.nodeType === 1) { _limpiarInvisibles(nodo); }
      }
    }

    function _decorarCitasMarkdown(raiz) {
      if (!raiz || !raiz.querySelectorAll) return;
      var citas = raiz.querySelectorAll('blockquote');
      Array.prototype.forEach.call(citas, function (cita) {
        cita.classList.add('cita');
        var llamado = false;
        try { llamado = (cita.textContent || '').indexOf('\u200B') !== -1; } catch (e) {}
        if (llamado) {
          _limpiarInvisibles(cita);
          cita.classList.add('mk-cita-llamado');
        }
      });
    }

    /* ============================================================
       PROMO DEL POST (R82) · tarjeta debajo del título
       La promo activa sale del mismo PROMOJSON que alimenta la
       marquesina de la lista (SISTEMA.promo.porCiudad): si el post
       abierto es el de la promo vigente (fechas + ciudad), se pinta
       aquí como incentivo de compra.
       R96 · el PROMOJSON nuevo trae titulo + descripcion por item:
       el bloque los muestra en DOS filas con entrada suave —
       titulo en tipografía .subtitulo (color del post) y abajo
       la descripcion en .textoPrimario. Los precios siguen
       apareciendo si la hoja los trae.
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
      /* R108 · FUENTE: la promo INDIVIDUAL del post vive en el
         bloque promocion del POSTJSON (hermano de meta) — con
         meta.promo como respaldo por si una fila vieja lo trae.
         El catálogo lo trae en post.promo (02 Cache.gs lo extrae
         al índice desde la misma fuente) y el detalle en
         postJson.promocion.
         REGLA DEL DUEÑO (R108): la agenda de PROMOJSON (item)
         gobierna SOLO los titulares del lienzo principal; la
         promo del post SE MUESTRE siempre que el post la traiga,
         aunque no esté agendada en la ciudad. Por eso ya no
         existe el cortón "if (!item) return ''" de R96/R100. */
      var promoIdx = (post.promo && typeof post.promo === 'object') ? post.promo : null;
      var postJson = post.postJson || {};
      var metaPost = postJson.meta || {};
      var promoDet = (postJson.promocion && typeof postJson.promocion === 'object')
        ? postJson.promocion
        : ((metaPost.promo && typeof metaPost.promo === 'object') ? metaPost.promo : null);

      /* Sin promo propia y sin item agendado no hay nada que pintar. */
      if (!promoDet && !item) return '';

      var badge = _badgeDelPost(promoDet) ||
                  _badgeDelPost(promoIdx) ||
                  _badgeDelPost(item) || _badgeDelPost(post);

      var tituloPromo = _primerTexto(promoDet, ['titulo']) ||
                        _primerTexto(promoIdx, ['titulo']) ||
                        _primerTexto(item, ['titulo', 'texto', 'promoTexto', 'mensaje']) ||
                        _primerTexto(post, ['promoTexto']) ||
                        _primerTexto(metaPost, ['promoTexto']);
      var descripcionPromo = _primerTexto(promoDet, ['descripcion']) ||
                             _primerTexto(promoIdx, ['descripcion']) ||
                             _primerTexto(item, ['descripcion']);

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

      if (!tituloPromo && !descripcionPromo && !actual && !badge) return '';

      var colorArr = metaPost.color || [];
      var colorOficial = colorArr[0] || post.colorOficial || '#f97316';
      var colorPastel  = colorArr[1] || post.colorClaro   || '#f1f5f9';

      var html = '<div class="mk-promo-block" style="--post-color:' + escapeHtml(colorOficial) + '; --post-claro:' + escapeHtml(colorPastel) + '">';
      /* R96 · fila del texto = titulo en .subtitulo + descripcion
         en .textoPrimario (el CSS les da la entrada suave) —
         AMBAS con formato estilo WhatsApp (R115, via
         Global.waFormato) —, con
         el BADGE a la derecha (misma anatomía de la marquesina).
         R84/R108: si el post trae idBadge y el badge está
         ENCENDIDO en BADGEJSON va su píldora; si está apagado
         (estado false) no se pinta píldora — el texto queda
         solo. Sin idBadge y con texto, la píldora PROMO
         identifica la etiqueta (nunca queda ciega). */
      var badgeTitulo = '';
      if (badge && badge.titulo) {
        badgeTitulo = badge.titulo;
      } else if (!(promoDet && String(promoDet.idBadge || '').trim()) &&
                 (tituloPromo || descripcionPromo)) {
        badgeTitulo = 'PROMO';
      }
      var badgeHtml = badgeTitulo
        ? '<span class="mk-promo-badge">' + escapeHtml(badgeTitulo) + '</span>'
        : '';
      if (tituloPromo || descripcionPromo || badgeHtml) {
        html += '<div class="mk-promo-banner">' +
                  '<div class="mk-promo-banner-textos">';
        if (tituloPromo) {
          html += '<span class="mk-promo-titulo subtitulo">' + Global.waFormato(tituloPromo) + '</span>';
        }
        if (descripcionPromo) {
          html += '<span class="mk-promo-descripcion textoPrimario">' + Global.waFormato(descripcionPromo) + '</span>';
        }
        html +=   '</div>' + badgeHtml +
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
        /* R92: los colores del post viajan en el wrap para que la
           tabla markdown y la fila BCV usen el pastel/color. */
        var colorArr = meta.color || [];
        var oficial  = colorArr[0] || post.colorOficial || '#475569';
        var pastel   = colorArr[1] || post.colorPastel || '#f1f5f9';
        var claro    = colorArr[2] || post.colorClaro   || '#f1f5f9';
        html += '<div class="mk-desc-wrap" style="--post-color:' + escapeHtml(oficial) + '; --post-pastel:' + escapeHtml(pastel) + '; --post-claro:' + escapeHtml(claro) + ';">' +
                  '<div class="mk-desc-clamp textoPrimario" id="postDescExcerpt">' + renderExcerpt + '</div>' +
                  '<button type="button" class="enlacesOpciones" id="postVerMas" style="margin-top:10px !important; margin-bottom:12px !important;">Ver descripción completa</button>' +
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
      /* R88: .subtitulo (18px/300) con el color del post. */
      html +=     '<div class="subtitulo" style="color: var(--post-color) !important;">' + escapeHtml(nombre) + '</div>';
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
      /* R95: fade y volver-arriba son OVERLAYS del .mk-sheet
         (hermanos del content que scrollea): el degradado vive
         pegado al borde inferior visible y el botón circular
         (abajo a la derecha desde la R96). El scroll del content
         maneja a ambos. */
      descSheetRoot.innerHTML = '<div class="mk-sheet-backdrop" id="postDescSheetBackdrop"></div>' +
        '<div class="mk-sheet" id="postDescSheet"><div class="mk-sheet-handle-area"><div class="mk-sheet-handle"></div></div>' +
          '<button type="button" class="mk-sheet-close" id="postDescSheetClose" data-glifo="close"></button>' +
          '<button type="button" class="mk-sheet-top" id="postDescSheetTop" data-glifo="flechaArriba" aria-label="Volver arriba"></button>' +
          '<div class="mk-sheet-content" id="postDescSheetContent"></div>' +
          '<div class="mk-sheet-fade" id="postDescSheetFade"></div></div>';
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
      content.innerHTML = html;

      /* R92: colores del post + tablas vestidas también en el
         sheet de la descripción completa. R93: citas del markdown
         (> con línea, ^ sin línea) vestidas con .cita. */
      try {
        var colorArrC = (pj.meta && pj.meta.color) || [];
        content.style.setProperty('--post-color',  String(colorArrC[0] || postActivo.colorOficial || '#475569'));
        content.style.setProperty('--post-pastel', String(colorArrC[1] || postActivo.colorPastel || '#f1f5f9'));
        content.style.setProperty('--post-claro',  String(colorArrC[2] || postActivo.colorClaro   || '#f1f5f9'));
      } catch (e) {}
      _decorarTablasMarkdown(content);
      _decorarCitasMarkdown(content);

      /* R77: el fade avisa que hay más texto y se retira al llegar
         al final del scroll para leer completo. Si el texto no
         desborda, el fade se retira de una vez.
         R95: el MISMO scroll del content maneja el volver-arriba
         (aparece pasados ~120px, desaparece al llegar arriba).
         Ambos son overlays locales: 0 llamadas a la BD. */
      function revisarOverlaysDesc() {
        var fade = document.getElementById('postDescSheetFade');
        var top  = document.getElementById('postDescSheetTop');
        var alFinal = (content.scrollTop + content.clientHeight) >= (content.scrollHeight - 4);
        if (fade) fade.classList.toggle('fin', alFinal);
        if (top)  top.classList.toggle('visible', content.scrollTop > 120);
      }
      if (!descFadeEnganchado) {
        descFadeEnganchado = true;
        root.querySelector('#postDescSheetTop').addEventListener('click', function () {
          content.scrollTo({ top: 0, behavior: 'smooth' });
        });
        content.addEventListener('scroll', revisarOverlaysDesc, { passive: true });
      }

      content.scrollTop = 0;
      revisarOverlaysDesc();
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

      /* R94: las imágenes del hero se pintan vía la L2 propia
         (poblarConL2); sin esqueleto individual. */
      pintarImagenesHero(track);

      /* R92: vestir las tablas del markdown con las tipografías
         del Core (th textoPrimario, td textoSecundario, precios
         del plan con subtitulo). R93: citas del markdown (> con
         línea y .cita, ^ llamado sin línea). */
      _decorarTablasMarkdown(track);
      _decorarCitasMarkdown(track);

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
        /* R96 · DOTS AL INSTANTE — el retardo de 100ms (setTimeout
           tras el scroll) hacía que el punto cambiara tarde y se
           "pegara" al cambio de imagen. rAF pinta el punto activo
           en el MISMO frame del desplazamiento: sin retardo, sin
           temporizadores. iOS: scrollLeft del track puede llegar
           con un frame de retraso, pero nunca se acumula. */
        var rafDots = null;
        heroTrack.addEventListener('scroll', function () {
          if (rafDots) return;
          rafDots = requestAnimationFrame(function () {
            rafDots = null;
            var w = heroTrack.clientWidth; if (!w) return;
            var idx = Math.round(heroTrack.scrollLeft / w);
            if (idx < 0) idx = 0; if (idx >= dots.length) idx = dots.length - 1;
            dots.forEach(function (d, i) { d.classList.toggle('activo', i === idx); });
          });
        }, { passive: true });
      }
      var btnVerMas = track.querySelector('#postVerMas');
      if (btnVerMas) { btnVerMas.addEventListener('click', function (e) { e.preventDefault(); haptic(10); abrirSheetDesc(); }); }
    }

    /* R87: el partner abre su LIENZO propio (#partnerTrack);
       el bottom sheet quedó retirado. */
    function engacharPartner(track) {
      var fila = track.querySelector('#lienzoPartnerFila');
      if (!fila) return;
      fila.addEventListener('click', function() {
        haptic(10);
        if (window.Partner && typeof window.Partner.abrir === 'function') { window.Partner.abrir(postActivo); }
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
