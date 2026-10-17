/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Lista_Script.html
ESPEJO GITHUB:   js/Lista_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Menú lista. Pinta los posts filtrados por
                 ciudad activa + chip activo, sobre TABLAS.posts
                 cargada una sola vez. Emite 'post:change'.
                 Escucha 'chips:change', 'buscar:change' y
                 'ciudad:change'. R61: pinta el CONTADOR de
                 items del rótulo "Explorar" (#listaContador, la
                 cantidad exacta que trae el filtro) y liga el
                 MODO DE VISTA (lista / miniatura): seleccionable
                 sin acción de render todavía. R60: el estado
                 abierto de la búsqueda se lee en la FILA de
                 chips + buscar (.filtros-fila.buscando, casa de
                 la cápsula split pill).
                 Item de la vidriera (R58 · CAJA): tarjeta blanca
                 con franja del colorOficial a la izquierda
                 (variables --post-color/--post-claro), título y
                 subtítulo en su color normal, divisoria bajo el
                 subtítulo y fila del partner: avatar circular
                 con la INICIAL de la marca (fondo colorClaro del
                 post, letra colorOficial) + nombre + glifo
                 verificado (Iconos); a la derecha "Ver
                 publicación" (glifo flechaVer, gris medio, sin
                 bold). Estrella métrica PASIVA con el contador
                 de likes (oculta en 0; glifo de Iconos); al
                 volver del detalle se re-sincroniza con TABLAS
                 para que el número sea siempre el mismo que dejó
                 el corazón.
                 La lista es PLANA (R58, como la imagen del
                 dueño): el orden es el de la hoja y el rótulo
                 "Explorar" vive en Index.html. El agrupado por
                 grupo vuelve como opción del FILTRO cuando el
                 dueño lo ordene (pendiente anotado).
                 Modo lista ↔ detalle con fade y botón volver.
                 Skeleton del detalle mientras carga la primera
                 vez un post (PostFull).
                 Precarga del primer post de la lista filtrada
                 para que el primer tap sea instantáneo.
                 Los posts que están activos como promo siguen
                 apareciendo en la lista (no se excluyen).
VERSIÓN:         2.0
CAMBIOS:         R61: CONTADOR de items — actualizarContador() escribe
                 #listaContador en cada repintado (la cantidad que
                 trae el filtro, incluido el 0 de la búsqueda
                 vacía); MODO DE VISTA — pintarVista() pinta los
                 glifos (vistaLista/vistaMiniatura) y liga el
                 toggle .activo entre #mvLista y #mvMiniatura,
                 SIN acción de render todavía (decisión del
                 dueño); se llama al inicio de pintarLista, cuando
                 el lienzo ya está inyectado.
                 R60: el selector del estado abierto de la
                 búsqueda pasa de .filtros-wrap.buscando a
                 .filtros-fila.buscando (la cápsula vive en la
                 fila de chips, no en la cabecera).
                 R58: item como CAJA — franja colorOficial
                 (--post-color) y avatar del partner (--post-claro
                 + inicial); título/subtítulo en color normal;
                 divisoria bajo el subtítulo; glifo verificado;
                 "Ver detalles" pasa a "Ver publicación"; la
                 lista se pinta PLANA (fuera la agrupación por
                 grupos de R57 — vuelve como filtro pendiente);
                 montarItem deja de setear el título con el color
                 y pasa a vestir franja+avatar.
                 R55: fuera el cuadrado avatar, el badge y el
                 chevron; estrella métrica pasiva (glifo estrella
                 de Iconos, oculta en 0);
                 sincronizarEstrellas() actualiza los contadores
                 al cerrar el detalle.
DEPENDENCIAS:    Index.html (TABLAS, SISTEMA), Ciudad_Sheet_Script.html
                 (getActual, hayPendiente), Chips_Script.html
                 (getChipActivo, seleccionar), Core_Script.html
                 (window.PostFull.obtener), Iconos.html
                 (window.pintarGlifos), Lista_CSS.html
════════════════════════════════════════════════════════════════════
*/
  window.Lista = (function () {

    var _popstateEsperado = false;   /* R19: popstate propio de history.back() */

    var postActivoId = null;
    var chipActivoActual = null;
    var modo = 'lista';

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

    function marcaDePartner(partner) {
      if (!partner) return '';
      var marca = String(partner.marca || '').trim();
      if (marca) return marca;
      return String(partner.nombre || '').trim();
    }

    /* B6 · R10: escapado HTML para el contenido que viene de la
       hoja. Mismo patrón que Comenta/Ciudad/Partner/Reserva. */
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
       ============================================================ */
    function htmlSkeletonDetalle() {
      return '' +
        '<div class="skeleton-detalle" aria-hidden="true">' +
          '<div class="skeleton-foto"></div>' +
          '<div class="skeleton-identidad">' +
            '<span class="skeleton-linea skeleton-marca"></span>' +
            '<span class="skeleton-linea skeleton-titulo"></span>' +
            '<span class="skeleton-linea skeleton-tagline"></span>' +
          '</div>' +
          '<div class="skeleton-desc">' +
            '<span class="skeleton-linea"></span>' +
            '<span class="skeleton-linea"></span>' +
            '<span class="skeleton-linea"></span>' +
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
          (p.tagline  || '') + ' ' +
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
       CONTADOR DE EXPLORAR (R61) · la cantidad de items que
       contiene la vidriera, junto al rótulo. Se pinta en cada
       repintado: la cifra SIEMPRE es la de la lista en pantalla
       (ciudad + chip o filtro de búsqueda, incluido el 0).
       ============================================================ */
    function actualizarContador(cantidad) {
      var el = document.getElementById('listaContador');
      if (el) el.textContent = String(cantidad);
    }

    /* ============================================================
       MODO DE VISTA (R61) · cápsula lista / miniatura
       Pinta los glifos (Iconos.html) y liga la SELECCIÓN: un
       solo botón activo a la vez. SIN acción de render todavía
       (el dueño la pidió seleccionable, no funcional — la
       vidriera en miniatura llegará cuando la ordene).
       Se llama desde pintarLista: el lienzo ya está inyectado
       y los botones existen.
       ============================================================ */
    var vistaLigada = false;

    function pintarVista() {
      var mvLista = document.getElementById('mvLista');
      var mvMini  = document.getElementById('mvMiniatura');
      if (!mvLista || !mvMini) return;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(mvLista);
        window.pintarGlifos(mvMini);
      }

      if (vistaLigada) return;
      vistaLigada = true;

      mvLista.addEventListener('click', function () {
        if (mvLista.classList.contains('activo')) return;
        mvLista.classList.add('activo');
        mvMini.classList.remove('activo');
      });

      mvMini.addEventListener('click', function () {
        if (mvMini.classList.contains('activo')) return;
        mvMini.classList.add('activo');
        mvLista.classList.remove('activo');
      });
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
      if (modo === 'detalle') {
        body.classList.remove('modo-lista');
        body.classList.add('modo-detalle');
      } else {
        body.classList.remove('modo-detalle');
        body.classList.add('modo-lista');
      }
    }

    function pintarLista(lista, modoBusqueda, enLimite) {
      var cont = document.getElementById('listaWrap');
      if (!cont) return;

      /* R61 · contador + ligadura del modo de vista (primera
         pasada con el lienzo vivo). */
      pintarVista();
      actualizarContador(lista ? lista.length : 0);

      cont.innerHTML = '';

      if (!lista || lista.length === 0) {
        postActivoId = null;
        actualizarAvisoBusqueda(modoBusqueda, enLimite);
        return;
      }

      actualizarAvisoBusqueda(false, enLimite);

      var frag = document.createDocumentFragment();

      /* Construye el botón de UN post (anatomía R58 · CAJA:
         franja colorOficial, título/subtítulo en color normal,
         divisoria y partner con inicial + verificado + "Ver
         publicación"). */
      function montarItem(post) {
        var partner = buscarPartner(post.idPartner);

        var titulo  = post.titulo || post.boton || post.id;
        var tagline = post.tagline || '';
        var color   = post.colorOficial || '#475569';
        var claro   = post.colorClaro || '#f1f5f9';
        var like    = Number(post.like) || 0;
        var marca   = marcaDePartner(partner);
        var inicial = marca ? marca.charAt(0).toUpperCase() : 'S';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lista-item';
        btn.setAttribute('data-post', post.id);

        /* R58 · el colorOficial viste la FRANJA y la letra del
           avatar; el colorClaro el fondo del avatar (el título
           volvió a su color normal). El CSS de Lista_CSS
           consume ambas variables. */
        btn.style.setProperty('--post-color', color);
        btn.style.setProperty('--post-claro', claro);

        var html = '';
        html += '<span class="body">';
        html +=   '<span class="fila-titulo">';
        html +=     '<span class="titulo">' + escapeHtml(titulo) + '</span>';
        html +=   '</span>';
        if (tagline) {
          html += '<span class="tagline">' + escapeHtml(tagline) + '</span>';
        }
        html +=   '<span class="item-divisoria" aria-hidden="true"></span>';
        html +=   '<span class="pie">';
        html +=     '<span class="partner-avatar" aria-hidden="true">' +
                    escapeHtml(inicial) + '</span>';
        if (marca) {
          html +=   '<span class="marca">' +
                    '<span class="marca-texto">' + escapeHtml(marca) + '</span>' +
                    '<span class="check" data-glifo="verificado" aria-hidden="true"></span>' +
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

      /* R58 · LISTA PLANA: el orden es el de la hoja (TABLAS),
         sin cabeceras de grupo — el rótulo "Explorar" (Index)
         encabeza la vidriera y el agrupado por grupo volverá
         como opción del FILTRO (pendiente del dueño). Nadie
         desaparece: se renderiza TODO lo que llega del filtro. */
      var renderizados = [];

      lista.forEach(function (post) {
        frag.appendChild(montarItem(post));
        renderizados.push(post);
      });

      cont.appendChild(frag);

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
      var resultados = postsDeBusqueda(termino);
      pintarLista(resultados, true, enLimite);

      /* R36: cuántos posts trajo el filtro — Compartir activa el
         botón compartir solo si hubo resultados. */
      document.dispatchEvent(new CustomEvent('buscar:resultados', {
        detail: { cantidad: resultados.length, termino: termino || '' }
      }));
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
          post.seccionJson = det.seccionJson || {};
          post.planJson    = det.planJson || null;

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
           OTRO detalle (cross-sell cambia chip/ciudad y reabre a los
           ~80 ms), el modo ya es 'detalle' de nuevo: abortar el
           borrado para no vaciar el post nuevo. */
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
        /* R19: marcar el popstate PROPIO de este cierre. El back()
         es asíncrono: si el usuario (o un cross-sell) reabre un
         detalle antes de que el popstate llegue, el listener de
         popstate lo confundiría con un gesto de ATRÁS y cerraría
         el post recién abierto. Con la marca se consume aquí. */
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

    /* ============================================================
       Eventos
       ============================================================ */
    document.addEventListener('chips:change', function (e) {
      var idChip = e.detail && e.detail.idChip;
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
      if (modo === 'detalle') cerrarDetalle(false);

      var input = document.getElementById('buscarInput');
      var wrapBuscar = document.querySelector('.filtros-fila.buscando');
      if (wrapBuscar && input && input.value.trim()) {
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
      cerrarDetalle(false);
    });

    window.addEventListener('popstate', function () {
      /* R19: si este popstate es el que nosotros mismos provocamos
         con history.back() al cerrar, consumirlo SIN cerrar nada
         (el detalle activo, si lo hay, es uno NUEVO legítimo). */
      if (_popstateEsperado) {
        _popstateEsperado = false;
        return;
      }
      if (modo === 'detalle') cerrarDetalle(true);
    });

    document.body.classList.add('modo-lista');

    return {
      pintar:         pintar,
      pintarBusqueda: pintarBusqueda,
      seleccionar:    seleccionar,
      getPostActivo:  getPostActivo,
      getModo:        getModo,
      abrirDetalle:   abrirDetalle,
      cerrarDetalle:  cerrarDetalle
    };

  })();

