/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Lista_Script.html
ESPEJO GITHUB:   github/js/Lista_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Lista. Menú lista: pinta los posts
                 filtrados por ciudad activa + chip activo sobre
                 TABLAS.posts. Item: avatar circular con la
                 INICIAL DEL TÍTULO (tipografía .tituloPost y
                 color oficial del post; sin imagen) + título
                 (.subtitulo) + estrella métrica pasiva + fila con
                 "Ver publicación". Decide el botón "Compartir lista"
                 con la cantidad de items. Ordenamiento por
                 'orden:change': recomendado, nombre, categoría
                 (con cabecera de grupo), más compartidos y mejor
                 valorados. Modo lista ↔ detalle con fade, botón
                 volver y skeleton. Emite 'post:change'; escucha
                 'chips:change', 'buscar:change', 'ciudad:change'
                 y 'orden:change'.
VERSIÓN:         2.15
CAMBIOS:         R112: el avatar del item es un CÍRCULO
                 PERFECTO (64×64) centrado verticalmente — no
                 se estira con el alto de la fila. La inicial
                 lleva la tipografía .tituloPost con el COLOR
                 OFICIAL del post; fondo suave de siempre.
                 R111: el avatar del item pasa a la COLUMNA
                 IZQUIERDA: SOLO la INICIAL DEL TÍTULO — sin
                 imagen, el avatar nunca lleva foto. El pie
                 pierde el avatar chico; el texto de la marca
                 se queda.
                 R87: NACE EL MODO 'partner' — el perfil del
                 vendedor es un LIENZO propio (#partnerTrack, lo
                 pinta window.Partner), hijo del detalle: el
                 título del header pasa a "Perfil del vendedor",
                 el botón volver REGRESA AL POST (no a la lista)
                 y el historial apila su estado propio. Cambios de
                 chip/ciudad/orden cierran partner + detalle.
                 R86: el SKELETON del detalle se actualiza a la
                 anatomía real del post de hoy: marco 1:1 con
                 vidrio, título, promo, descripción, CTA píldora
                 y fila del partner.
                 R84: el detalle sube con las ÚLTIMAS 2 preguntas
                 del post (post.preguntas, ya vienen dentro de
                 postDetalle): el Q&A del lienzo se pinta con la
                 misma llamada, sin pedido extra.
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Index.html (SISTEMA, TABLAS), Iconos.html
                 (pintarGlifos), Seccion_Script.html (detalle,
                 window.Secciones), Chips_Script.html,
                 Buscar_Script.html,
                 Ciudad_Script (window.Ciudad), Compartir_Script.html
                 (window.Compartir), Orden_Sheet_Script.html,
                 Core_CSS.html, Lista_CSS.html, Promo_CSS.html
════════════════════════════════════════════════════════════════════*/

  window.Lista = (function () {

    var _popstateEsperado = false;   /* R19: popstate propio de history.back() */

    var postActivoId = null;
    var chipActivoActual = null;
    var modo = 'lista';

    /* R66 · ORDEN ACTIVO de la vidriera ('recomendado' = el
       orden de la hoja). Lo fija el sheet de ordenamiento vía
       'orden:change'. Es de SESIÓN: al recargar vuelve al
       recomendado. */
    var ordenActual = 'recomendado';

    var scrollListaPrevio = 0;

    var DURACION_FADE_MS = 200;

    function normalizar(s) {
      return String(s == null ? '' : s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function buscarPost(id) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === id) return posts[i];
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

    function nombreChip(idChip) {
      if (!idChip) return '';
      var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].idChip === idChip) return chips[i].titulo || '';
      }
      return '';
    }

    function nombreGrupo(idGrupo) {
      if (!idGrupo) return '';
      var grupos = (window.SISTEMA && window.SISTEMA.grupoJson) || [];
      for (var i = 0; i < grupos.length; i++) {
        if (grupos[i].idGrupo === idGrupo) return grupos[i].titulo || '';
      }
      return '';
    }

    /* R66 · Título del PRIMER grupo del post ('' si no
       tiene) — la clave del orden por categoría. */
    function tituloGrupoDe(post) {
      var grupos = post && post.idGrupo;
      if (!grupos || !grupos.length) return '';
      return nombreGrupo(grupos[0]);
    }

    function tituloDe(post) {
      return String((post && (post.titulo || post.boton || post.id)) || '');
    }

    function compararTexto(a, b) {
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    }

    /* ============================================================
       ORDENAMIENTO (R66) · aplica el orden activo a lo que
       llegue del filtro (chip o búsqueda). El array original
       NUNCA se muta (se ordena una copia) y 'recomendado'
       devuelve el orden tal cual (el de la hoja).
       ============================================================ */
    function aplicarOrden(arr) {
      if (!arr || arr.length < 2) return arr;

      if (ordenActual === 'nombre-asc' || ordenActual === 'nombre-desc') {
        var dir = (ordenActual === 'nombre-asc') ? 1 : -1;
        return arr.slice().sort(function (a, b) {
          return dir * compararTexto(tituloDe(a), tituloDe(b));
        });
      }

      if (ordenActual === 'categoria') {
        return arr.slice().sort(function (a, b) {
          var ga = tituloGrupoDe(a);
          var gb = tituloGrupoDe(b);
          if (ga && !gb) return -1;
          if (!ga && gb) return 1;
          var g = compararTexto(ga, gb);
          if (g !== 0) return g;
          return compararTexto(tituloDe(a), tituloDe(b));
        });
      }

      if (ordenActual === 'compartido') {
        return arr.slice().sort(function (a, b) {
          return (Number(b.comparte) || 0) - (Number(a.comparte) || 0);
        });
      }

      if (ordenActual === 'valoracion') {
        return arr.slice().sort(function (a, b) {
          return (Number(b.like) || 0) - (Number(a.like) || 0);
        });
      }

      return arr;   /* recomendado · el orden de la hoja */
    }

    function marcaDePartner(partner) {
      if (!partner) return '';
      var marca = String(partner.marca || '').trim();
      if (marca) return marca;
      return String(partner.nombre || '').trim();
    }

    /* B6 · R10: escapado HTML para el contenido que viene de la
       hoja. Mismo patrón que Ciudad/Partner/Reserva. */
    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    /* ============================================================
       Ciudad activa
       ============================================================ */
    function ciudadActiva() {
      if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
        var c = window.Ciudad.getActual();
        return c ? c.idCiudad : null;
      }
      return null;
    }

    function ciudadPendiente() {
      return window.Ciudad &&
             typeof window.Ciudad.hayPendiente === 'function' &&
             window.Ciudad.hayPendiente();
    }

    /* ============================================================
       Skeleton del detalle
       R86: actualizado a la ANATOMÍA REAL del post de hoy — marco
       1:1 con vidrio (hero), título, promo, descripción, CTA
       píldora y fila del partner.
       ============================================================ */
    function htmlSkeletonDetalle() {
      return '' +
        '<div class="skeleton-detalle" aria-hidden="true">' +
          '<div class="skeleton-foto"></div>' +
          '<div class="skeleton-cuerpo">' +
            '<span class="skeleton-linea skeleton-titulo"></span>' +
            '<span class="skeleton-linea skeleton-promo"></span>' +
            '<div class="skeleton-desc">' +
              '<span class="skeleton-linea"></span>' +
              '<span class="skeleton-linea"></span>' +
              '<span class="skeleton-linea"></span>' +
            '</div>' +
          '</div>' +
          '<div class="skeleton-cta"></div>' +
          '<div class="skeleton-partner">' +
            '<div class="skeleton-avatar"></div>' +
            '<div class="skeleton-partner-info">' +
              '<span class="skeleton-linea skeleton-partner-nombre"></span>' +
              '<span class="skeleton-linea skeleton-partner-sub"></span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    function mostrarSkeletonDetalle() {
      var track = document.getElementById('seccionesTrack');
      if (!track) return;
      track.innerHTML = htmlSkeletonDetalle();
    }

    /* ============================================================
       Título del header en modo detalle
       ============================================================ */
    function tituloHeaderDetalle(post) {
      if (!post) return '';

      var chipsPost = post.idChips || [];
      var chipParaMostrar = (chipActivoActual && chipsPost.indexOf(chipActivoActual) !== -1)
        ? chipActivoActual
        : (chipsPost[0] || null);

      var chipStr  = nombreChip(chipParaMostrar);
      var grupos   = post.idGrupo || [];
      var grupoStr = grupos.length ? nombreGrupo(grupos[0]) : '';

      if (chipStr && grupoStr) return chipStr + ' : ' + grupoStr;
      return chipStr || grupoStr || '';
    }

    /* ============================================================
       Filtro · ciudad + chip
       ============================================================ */
    function postsDeChip(idChip) {
      if (!idChip) return [];

      if (ciudadPendiente()) return [];

      var ciudad = ciudadActiva();
      var posts  = (window.TABLAS && window.TABLAS.posts) || [];

      return posts.filter(function (p) {
        if (!p || !p.id) return false;
        if (p.estado === 'inactivo' || p.estado === 'pausado') return false;

        var chips = p.idChips || [];
        if (chips.indexOf(idChip) === -1) return false;

        if (ciudad) {
          var ciudades = p.idCiudad || [];
          if (ciudades.indexOf(ciudad) === -1) return false;
        }

        return true;
      });
    }

    /* ============================================================
       Filtro · ciudad + búsqueda cross-chip
       ============================================================ */
    function postsDeBusqueda(termino) {
      var t = normalizar(termino);
      if (!t) return [];

      if (ciudadPendiente()) return [];

      var ciudad = ciudadActiva();
      var posts  = (window.TABLAS && window.TABLAS.posts) || [];
      var grupos = (window.SISTEMA && window.SISTEMA.grupoJson) || [];

      return posts.filter(function (p) {
        if (!p || !p.id) return false;
        if (p.estado === 'inactivo' || p.estado === 'pausado') return false;

        if (ciudad) {
          var ciudades = p.idCiudad || [];
          if (ciudades.indexOf(ciudad) === -1) return false;
        }

        var gruposTexto = '';
        (p.idGrupo || []).forEach(function (idG) {
          for (var i = 0; i < grupos.length; i++) {
            if (grupos[i].idGrupo === idG) {
              gruposTexto += ' ' + (grupos[i].titulo || '');
              break;
            }
          }
        });

        var partner = buscarPartner(p.idPartner) || {};
        var pj = partner.partnerJson || {};

        var campos = normalizar(
          (p.boton    || '') + ' ' +
          (p.titulo   || '') + ' ' +
          (p.id       || '') + ' ' +
          gruposTexto + ' ' +
          (partner.nombre || '') + ' ' +
          (partner.marca  || '') + ' ' +
          (pj.esloganPartner || '')
        );

        return campos.indexOf(t) !== -1;
      });
    }

    function emitirCambio(post) {
      document.dispatchEvent(new CustomEvent('post:change', {
        detail: { idPost: post ? post.id : null, post: post }
      }));
    }

    function actualizarAvisoBusqueda(mostrar, enLimite) {
      var aviso = document.getElementById('buscarVacio');
      if (!aviso) return;

      if (mostrar) {
        aviso.textContent = 'No se encontraron resultados.';
        aviso.hidden = false;
        return;
      }
      if (enLimite) {
        aviso.textContent = 'Probá con menos palabras';
        aviso.hidden = false;
        return;
      }
      aviso.hidden = true;
      aviso.textContent = '';
    }

    /* ============================================================
       COMPARTIR LISTA (R65) · BLOQUE DE ITEMS
       El botón vive encima de la lista (dentro de
       .secciones-wrap): visible SIEMPRE que la lista traiga
       items (chip o búsqueda, da igual el modo) y con la
       CANTIDAD al lado (pedido del dueño: "agréle la cantidad
       de items, ahora sí"). Con la lista vacía se apaga. El
       número es interno (Math), no entra escapado. El envío
       sigue en Compartir_Script.
       ============================================================ */
    function actualizarCompartir(cantidad) {
      var btn = document.getElementById('btnCompartir');
      if (!btn) return;

      var hay = Number(cantidad) > 0;
      btn.hidden = !hay;
      btn.disabled = !hay;

      if (hay) {
        btn.innerHTML = 'Compartir lista ' +
          '<span class="btn-compartir-num">(' + Number(cantidad) + ')</span>';
      }
    }

    /* R55 · Al cerrar el detalle, las estrellas se re-leen de
       TABLAS: si el usuario dio (o quitó) like con el corazón
       flotante, el número de la fila queda IGUAL al que dejó
       el corazón. Mismo dato, cero descuadre. */
    function sincronizarEstrellas() {
      var items = document.querySelectorAll('#listaWrap .lista-item');
      for (var i = 0; i < items.length; i++) {
        var post = buscarPost(items[i].getAttribute('data-post'));
        if (!post) continue;

        var col = items[i].querySelector('.estrella-col');
        if (!col) continue;

        var like = Number(post.like) || 0;
        var num  = col.querySelector('.estrella-num');
        if (num) num.textContent = String(like);
        col.hidden = like <= 0;
      }
    }

    function setModo(nuevoModo) {
      if (modo === nuevoModo) return;
      modo = nuevoModo;
      var body = document.body;
      if (modo === 'lista') {
        body.classList.remove('modo-detalle');
        body.classList.remove('modo-partner');
        body.classList.add('modo-lista');
      } else {
        /* R87: el modo partner conserva las reglas del detalle
           (filtros ocultos, volver visible) y añade la suya. */
        body.classList.remove('modo-lista');
        body.classList.add('modo-detalle');
        body.classList.toggle('modo-partner', modo === 'partner');
      }
    }

    /* ============================================================
       RESPIRO DE SCROLL (R63) · tras un repintado (cambio de
       ciudad o de chip) el contenedor de la lista vuelve arriba
       y re-evalúa su scroll.
       ============================================================ */
    function respirarScroll() {
      var wrap = document.querySelector('.secciones-wrap');
      if (wrap) wrap.scrollTop = 0;
    }

    function pintarLista(listaParam, modoBusqueda, enLimite) {
      var cont = document.getElementById('listaWrap');
      if (!cont) return;

      /* R66 · el orden activo se aplica SIEMPRE (recomendado
         deja el array tal cual): chip y búsqueda pasan por aquí. */
      var lista = aplicarOrden(listaParam);

      /* R64 · compartir vive con items: visible solo si la
         lista trae algo (chip o búsqueda, da igual el modo). */
      actualizarCompartir(lista ? lista.length : 0);

      cont.innerHTML = '';

      if (!lista || lista.length === 0) {
        postActivoId = null;
        actualizarAvisoBusqueda(modoBusqueda, enLimite);
        respirarScroll();
        return;
      }

      actualizarAvisoBusqueda(false, enLimite);

      var frag = document.createDocumentFragment();

      /* Construye el botón de UN post (anatomía R64 · LIMPIO:
         fila del título + fila del partner — sin subtítulo ni
         divisoria ni check verde; la división la pinta el CSS
         con la línea tenue entre items). */
      function montarItem(post) {
        var partner = buscarPartner(post.idPartner);

        var titulo  = post.titulo || post.boton || post.id;
        var color   = post.colorOficial || '#475569';
        var claro   = post.colorClaro || '#f1f5f9';
        var like    = Number(post.like) || 0;
        var marca   = marcaDePartner(partner);

        /* R112 · AVATAR DEL ITEM: CÍRCULO PERFECTO (el CSS lo
           centra y le da 64×64), SOLO la INICIAL DEL TÍTULO —
           sin imagen (el avatar nunca lleva foto). La letra
           lleva la tipografía .tituloPost y el colorOficial
           del post; fondo colorClaro de siempre. */
        var inicial = String(titulo).charAt(0).toUpperCase() || 'S';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lista-item';
        btn.setAttribute('data-post', post.id);

        btn.style.setProperty('--post-color', color);
        btn.style.setProperty('--post-claro', claro);

        var html = '';
        html += '<span class="item-avatar" aria-hidden="true">' +
                escapeHtml(inicial) +
                '</span>';
        html += '<span class="body">';
        html +=   '<span class="fila-titulo">';
        html +=     '<span class="subtitulo">' + escapeHtml(titulo) + '</span>';
        html +=   '</span>';
        html +=   '<span class="pie">';
        if (marca) {
          html +=   '<span class="marca">' +
                    '<span class="marca-texto">' + escapeHtml(marca) + '</span>' +
                    '</span>';
        }
        html +=     '<span class="ver-detalles">Ver publicación' +
                    '<span class="ver-glifo" data-glifo="flechaVer" aria-hidden="true"></span></span>';
        html +=   '</span>';
        html += '</span>';
        html += '<span class="estrella-col"' + (like > 0 ? '' : ' hidden') + '>';
        html +=   '<span class="estrella-glifo" data-glifo="estrella" aria-hidden="true"></span>';
        html +=   '<span class="estrella-num">' + like + '</span>';
        html += '</span>';

        btn.innerHTML = html;

        if (typeof window.pintarGlifos === 'function') {
          window.pintarGlifos(btn);
        }

        btn.addEventListener('click', function () {
          abrirDetalle(post.id);
        });

        return btn;
      }

      /* R66 · se renderiza TODO lo que llega del filtro, con el
         ORDEN activo aplicado. Con "Por categoría" el agrupado
         ES el orden: se intercala una cabecera
         .lista-grupo-header al abrir cada bloque de grupo. */
      var renderizados = [];
      var bloqueActual = null;
      var agrupando = (ordenActual === 'categoria');

      lista.forEach(function (post) {
        if (agrupando) {
          var grupo = tituloGrupoDe(post) || 'Otros';
          if (grupo !== bloqueActual) {
            bloqueActual = grupo;

            var h = document.createElement('div');
            h.className = 'lista-grupo-header';
            h.textContent = grupo;
            frag.appendChild(h);
          }
        }

        frag.appendChild(montarItem(post));
        renderizados.push(post);
      });

      cont.appendChild(frag);

      /* R63 · el contenedor re-evalúa su scroll con contenido
         nuevo (cura el scroll pegado tras cambiar de ciudad). */
      respirarScroll();

      /* Precarga del PRIMER post renderizado · si el usuario
         toca ese item (el más probable), ya está en caché y el
         detalle sale sin skeleton. */
      if (window.PostFull && renderizados.length > 0) {
        window.PostFull.obtener(renderizados[0].id).catch(function () {});
      }
    }

    function pintar(idChip, idRestaurar) {
      chipActivoActual = idChip;
      pintarLista(postsDeChip(idChip), false, false);
    }

    function pintarBusqueda(termino, enLimite) {
      pintarLista(postsDeBusqueda(termino), true, enLimite);
    }

    /* ============================================================
       Abrir / cerrar detalle
       ============================================================ */
    function abrirDetalle(idPost) {
      var post = buscarPost(idPost);
      if (!post) return;

      var wrap = document.querySelector('.secciones-wrap');
      scrollListaPrevio = wrap ? wrap.scrollTop : 0;

      var lista = document.getElementById('listaWrap');
      var detalle = document.getElementById('seccionesTrack');
      if (!lista || !detalle) return;

      var tituloCat = document.getElementById('tituloCategoria');
      if (tituloCat) {
        tituloCat.textContent = tituloHeaderDetalle(post);
        tituloCat.hidden = false;
      }

      var btnVolver = document.getElementById('btnVolver');
      if (btnVolver) btnVolver.hidden = false;

      setModo('detalle');

      /* Skeleton del detalle antes del fade. Si PostFull ya tiene
         el detalle (por la precarga), se reemplaza casi al toque. */
      mostrarSkeletonDetalle();

      lista.classList.add('fade-out');

      setTimeout(function () {
        lista.hidden = true;
        lista.classList.remove('fade-out');

        detalle.hidden = false;
        detalle.classList.add('fade-in');

        setTimeout(function () {
          detalle.classList.remove('fade-in');
        }, DURACION_FADE_MS);
      }, DURACION_FADE_MS);

      if (wrap) wrap.scrollTop = 0;

      try { history.pushState({ sv: 'detalle' }, ''); } catch (e) {}

      window.PostFull.obtener(idPost)
        .then(function (det) {
          /* R84: las últimas 2 preguntas (con respuesta) viajan
             dentro del detalle y suben con el post. */
          post.postJson = det.postJson || {};
          post.planJson = det.planJson || null;
          post.preguntas = det.preguntas || null;

          postActivoId = idPost;
          emitirCambio(post);
        })
        .catch(function (err) {
          console.warn('[Lista] No se pudo cargar el detalle:', err.message);
          postActivoId = idPost;
          emitirCambio(post);
        });
    }

    function cerrarDetalle(desdePopstate) {
      if (modo !== 'detalle') return;

      var lista = document.getElementById('listaWrap');
      var detalle = document.getElementById('seccionesTrack');
      if (!lista || !detalle) return;

      var btnVolver = document.getElementById('btnVolver');
      if (btnVolver) btnVolver.hidden = true;

      var tituloCat = document.getElementById('tituloCategoria');
      if (tituloCat) {
        tituloCat.textContent = '';
        tituloCat.hidden = true;
      }

      postActivoId = null;
      setModo('lista');
      sincronizarEstrellas();

      var wrap = document.querySelector('.secciones-wrap');
      if (wrap) wrap.scrollTop = scrollListaPrevio;

      emitirCambio(null);

      detalle.classList.add('fade-out');

      setTimeout(function () {
        /* R19: si entre el cierre y este borrado (200 ms) se abrió
           OTRO detalle, el modo ya es 'detalle' de nuevo: abortar
           el borrado para no vaciar el post nuevo. */
        if (modo !== 'lista') return;

        detalle.hidden = true;
        detalle.classList.remove('fade-out');
        detalle.innerHTML = '';

        lista.hidden = false;
        lista.classList.add('fade-in');

        setTimeout(function () {
          lista.classList.remove('fade-in');
        }, DURACION_FADE_MS);
      }, DURACION_FADE_MS);

      if (!desdePopstate) {
        _popstateEsperado = true;
        try { history.back(); } catch (e) {}
      }
    }

    /* ============================================================
       R87 · MODO PARTNER · el perfil del vendedor como lienzo
       propio, hijo del detalle. El contenido lo pinta
       window.Partner en #partnerTrack; aquí solo modo, título
       del header e historial. El volver REGRESA AL POST.
       ============================================================ */
    function abrirPartner() {
      if (!postActivoId) return;

      var tituloCat = document.getElementById('tituloCategoria');
      if (tituloCat) {
        tituloCat.textContent = 'Perfil del vendedor';
        tituloCat.hidden = false;
      }

      var btnVolver = document.getElementById('btnVolver');
      if (btnVolver) btnVolver.hidden = false;

      setModo('partner');

      try { history.pushState({ sv: 'partner' }, ''); } catch (e) {}
    }

    function cerrarPartner(desdePopstate) {
      if (modo !== 'partner') return;

      var post = postActivoId ? buscarPost(postActivoId) : null;

      var tituloCat = document.getElementById('tituloCategoria');
      if (tituloCat) {
        var t = tituloHeaderDetalle(post);
        tituloCat.textContent = t;
        tituloCat.hidden = !t;
      }

      setModo('detalle');

      /* El fade de vuelta al post lo hace window.Partner. */
      document.dispatchEvent(new CustomEvent('partner:ocultar'));

      if (!desdePopstate) {
        _popstateEsperado = true;
        try { history.back(); } catch (e) {}
      }
    }

    function seleccionar(idPost) {
      var post = buscarPost(idPost);
      if (!post) return false;

      var chips = post.idChips || [];
      if (chipActivoActual && chips.indexOf(chipActivoActual) === -1 && chips.length) {
        if (window.Chips && typeof window.Chips.seleccionar === 'function') {
          window.Chips.seleccionar(chips[0]);
        }
        setTimeout(function () { abrirDetalle(idPost); }, 80);
        return true;
      }

      abrirDetalle(idPost);
      return true;
    }

    function getPostActivo() {
      if (!postActivoId) return null;
      return buscarPost(postActivoId);
    }

    function getModo() { return modo; }

    function getOrden() { return ordenActual; }

    /* ============================================================
       Eventos
       ============================================================ */
    document.addEventListener('chips:change', function (e) {
      var idChip = e.detail && e.detail.idChip;
      if (modo === 'partner') cerrarPartner(false);
      if (modo === 'detalle') cerrarDetalle(false);
      pintar(idChip, null);
    });

    document.addEventListener('buscar:change', function (e) {
      var termino  = e.detail && e.detail.termino;
      var enLimite = e.detail && e.detail.enLimite;
      if (termino && termino.trim()) {
        pintarBusqueda(termino, enLimite);
      } else {
        pintar(chipActivoActual, null);
      }
    });

    document.addEventListener('ciudad:change', function () {
      if (modo === 'partner') cerrarPartner(false);
      if (modo === 'detalle') cerrarDetalle(false);

      var input = document.getElementById('buscarInput');
      if (input && input.value.trim()) {
        pintarBusqueda(input.value.trim(), false);
      } else {
        pintar(chipActivoActual, null);
      }
    });

    /* ============================================================
       R66 · ORDEN:change · el sheet de ordenamiento fijó otro
       orden: se recuerda y se repinta la vista VIVA.
       ============================================================ */
    document.addEventListener('orden:change', function (e) {
      ordenActual = (e.detail && e.detail.orden) || 'recomendado';

      if (modo === 'partner') cerrarPartner(false);
      if (modo === 'detalle') cerrarDetalle(false);

      var input = document.getElementById('buscarInput');
      if (input && input.value.trim()) {
        pintarBusqueda(input.value.trim(), false);
      } else {
        pintar(chipActivoActual, null);
      }
    });

    document.addEventListener('post:solicitar', function (e) {
      var idPost = e.detail && e.detail.idPost;
      if (idPost) seleccionar(idPost);
    });

    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('#btnVolver');
      if (!btn) return;
      e.preventDefault();
      /* R87: en el lienzo del partner el volver regresa al POST. */
      if (modo === 'partner') { cerrarPartner(false); return; }
      cerrarDetalle(false);
    });

    window.addEventListener('popstate', function () {
      if (_popstateEsperado) {
        _popstateEsperado = false;
        return;
      }
      if (modo === 'partner') { cerrarPartner(true); return; }
      if (modo === 'detalle') cerrarDetalle(true);
    });

    document.body.classList.add('modo-lista');

    return {
      pintar:         pintar,
      pintarBusqueda: pintarBusqueda,
      seleccionar:    seleccionar,
      getPostActivo:  getPostActivo,
      getModo:        getModo,
      getOrden:       getOrden,
      abrirDetalle:   abrirDetalle,
      cerrarDetalle:  cerrarDetalle,
      abrirPartner:   abrirPartner,
      cerrarPartner:  cerrarPartner
    };

  })();
