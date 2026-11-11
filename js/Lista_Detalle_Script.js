/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Lista_Detalle_Script.html
ESPEJO GITHUB:   github/js/Lista_Detalle_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.ListaDetalle — la vida del DETALLE abierto
                 desde la lista: abrir y cerrar el post, el perfil
                 del vendedor y los modos de pantalla.
                 · Modo pantalla único (lista ↔ detalle ↔ partner):
                 las clases del body y el volver del encabezado. El
                 modo es de ListaDetalle; window.Lista lo consulta
                 por la puerta getModo.
                 · abrirDetalle: guarda el scroll de la lista, esqueleto
                 con la anatomía real del post, fade de entrada,
                 historial (pushState/popstate) y el post:change que
                 despierta al post con su detalle (PostFull: memoria
                 en vivo → L2 → backend).
                 · cerrarDetalle: fade de salida, estrellas
                 re-leídas de TABLAS (el corazón y la fila quedan
                 IGUALES), scroll de la lista restaurado y el post
                 emitido como cerrado.
                 · abrirPartner / cerrarPartner: el perfil del
                 vendedor como lienzo propio, hijo del detalle (el
                 contenido lo pinta window.Partner en #partnerTrack);
                 el volver del partner REGRESA AL POST.
                 · seleccionar: abre el detalle de un post aunque
                 esté en otro chip (viaja al primer chip del post y
                 lo abre).
                 · Los cierres corren por sus propios receptores de
                 chips:change, ciudad:change, orden:change,
                 post:solicitar, #btnVolver y popstate.
VERSIÓN:         1.0
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Index.html (SISTEMA, TABLAS),
                 Global_Script.html (postBackend via PostFull),
                 Lista_Script.html (window.Lista · fábrica de items),
                 Core_Memoria_Script.html (window.PostFull),
                 Chips_Script.html (window.Chips.getChipActivo),
                 Seccion_Script.html (window.Secciones, detalle),
                 Partner_Script.html (window.Partner)
════════════════════════════════════════════════════════════════════*/

  window.ListaDetalle = (function () {

    var _popstateEsperado = false;   /* popstate propio de history.back() */

    var postActivoId = null;
    var modo = 'lista';

    var scrollListaPrevio = 0;

    var DURACION_FADE_MS = 200;

    function buscarPost(id) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === id) return posts[i];
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

    /* Título del PRIMER grupo del post ('' si no tiene). */
    function tituloGrupoDe(post) {
      var grupos = post && post.idGrupo;
      if (!grupos || !grupos.length) return '';
      return nombreGrupo(grupos[0]);
    }

    /* ============================================================
       Modo pantalla (lista ↔ detalle ↔ partner)
       ============================================================ */
    function setModo(nuevoModo) {
      if (modo === nuevoModo) return;
      modo = nuevoModo;
      var body = document.body;
      if (modo === 'lista') {
        body.classList.remove('modo-detalle');
        body.classList.remove('modo-partner');
        body.classList.add('modo-lista');
      } else {
        /* el modo partner conserva las reglas del detalle (filtros
           ocultos, volver visible) y añade la suya. */
        body.classList.remove('modo-lista');
        body.classList.add('modo-detalle');
        body.classList.toggle('modo-partner', modo === 'partner');
      }
    }

    function emitirCambio(post) {
      document.dispatchEvent(new CustomEvent('post:change', {
        detail: { idPost: post ? post.id : null, post: post }
      }));
    }

    /* ============================================================
       Skeleton del detalle — la ANATOMÍA REAL del post de hoy:
       marco 1:1 con vidrio (hero), título, promo, descripción,
       CTA píldora y fila del partner.
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
       Título del header en modo detalle — el chip visible en
       pantalla manda (Chips.getChipActivo).
       ============================================================ */
    function tituloHeaderDetalle(post) {
      if (!post) return '';

      var chipActivo = (window.Chips &&
                        typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo() : null;

      var chipsPost = post.idChips || [];
      var chipParaMostrar = (chipActivo && chipsPost.indexOf(chipActivo) !== -1)
        ? chipActivo
        : (chipsPost[0] || null);

      var chipStr  = nombreChip(chipParaMostrar);
      var grupos   = post.idGrupo || [];
      var grupoStr = grupos.length ? nombreGrupo(grupos[0]) : '';

      if (chipStr && grupoStr) return chipStr + ' : ' + grupoStr;
      return chipStr || grupoStr || '';
    }

    /* ============================================================
       Al cerrar el detalle, las estrellas se re-leen de TABLAS:
       si el usuario dio (o quitó) like con el corazón flotante,
       el número de la fila queda IGUAL al que dejó el corazón.
       Mismo dato, cero descuadre.
       ============================================================ */
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
          /* las últimas 2 preguntas (con respuesta) viajan dentro
             del detalle y suben con el post. */
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
        /* si entre el cierre y este borrado (200 ms) se abrió
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
       MODO PARTNER · el perfil del vendedor como lienzo propio,
       hijo del detalle. El contenido lo pinta window.Partner en
       #partnerTrack; aquí solo modo, título del header e
       historial. El volver REGRESA AL POST.
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

    /* ============================================================
       Seleccionar un post aunque esté en otro chip: viaja al
       primer chip del post y abre su detalle.
       ============================================================ */
    function seleccionar(idPost) {
      var post = buscarPost(idPost);
      if (!post) return false;

      var chips = post.idChips || [];
      var chipActivo = (window.Chips &&
                        typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo() : null;

      if (chipActivo && chips.indexOf(chipActivo) === -1 && chips.length) {
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
       Receptores de cierre
       ============================================================ */
    document.addEventListener('chips:change', function () {
      if (modo === 'partner') cerrarPartner(false);
      if (modo === 'detalle') cerrarDetalle(false);
    });

    document.addEventListener('ciudad:change', function () {
      if (modo === 'partner') cerrarPartner(false);
      if (modo === 'detalle') cerrarDetalle(false);
    });

    document.addEventListener('orden:change', function () {
      if (modo === 'partner') cerrarPartner(false);
      if (modo === 'detalle') cerrarDetalle(false);
    });

    document.addEventListener('post:solicitar', function (e) {
      var idPost = e.detail && e.detail.idPost;
      if (idPost) seleccionar(idPost);
    });

    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('#btnVolver');
      if (!btn) return;
      e.preventDefault();
      /* en el lienzo del partner el volver regresa al POST. */
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
      abrirDetalle:  abrirDetalle,
      cerrarDetalle: cerrarDetalle,
      abrirPartner:  abrirPartner,
      cerrarPartner: cerrarPartner,
      seleccionar:   seleccionar,
      getPostActivo: getPostActivo,
      getModo:       getModo
    };

  })();
