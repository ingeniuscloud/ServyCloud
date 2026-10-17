/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Lista_Script.html
ESPEJO GITHUB:   js/Lista_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Menú lista. Pinta los posts filtrados por
                 ciudad activa + chip activo, sobre TABLAS.posts
                 cargada una sola vez. Emite 'post:change'.
                 Escucha 'chips:change', 'buscar:change' y
                 'ciudad:change'.
                 Item de la vidriera: fondo blanco con divisoria,
                 título del colorOficial (variable --post-color),
                 texto protagonista y pie con la marca + "Ver
                 detalles". Estrella métrica PASIVA con el
                 contador de likes (oculta en 0; glifo de
                 Iconos); al volver del detalle se
                 re-sincroniza con TABLAS para que el número
                 sea siempre el mismo que dejó el corazón.
                 Los items se AGRUPAN POR TÍTULO DE GRUPO
                 (R57): cada post cuelga de su primer grupo
                 (idGrupo[0], misma convención del header del
                 detalle); los grupos se ordenan como vienen en
                 SISTEMA.grupoJson y posts sin grupo van al
                 final sin cabecera — nadie desaparece.
                 Modo lista ↔ detalle con fade y botón volver.
                 Skeleton del detalle mientras carga la primera
                 vez un post (PostFull).
                 Precarga del primer post de la lista filtrada
                 para que el primer tap sea instantáneo.
                 Los posts que están activos como promo siguen
                 apareciendo en la lista (no se excluyen).
VERSIÓN:         1.7
CAMBIOS:         R57: la lista se AGRUPA por título de grupo
                 (secciones .lista-grupo pintadas por
                 pintarLista; orden del grupoJson; posts sin
                 grupo al final sin cabecera); la cinta lateral
                 sale y su variable --cinta-color se convierte
                 en --post-color, que ahora pinta el TÍTULO del
                 item (el CSS lo consume). Fuera de eso, el item
                 queda EXACTO (estrella, pie, sincronizar
                 Estrellas intactos).
                 R55: item de la vidriera — fuera el cuadrado
                 avatar, el badge y el chevron; estrella
                 métrica pasiva (glifo estrella de Iconos,
                 oculta en 0) y pie con marca + "Ver detalles"
                 (glifo flechaVer); sincronizarEstrellas()
                 actualiza los contadores al cerrar el detalle;
                 buscarBadge sale (el badge vive en la promo y
                 el post).
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

      cont.innerHTML = '';

      if (!lista || lista.length === 0) {
        postActivoId = null;
        actualizarAvisoBusqueda(modoBusqueda, enLimite);
        return;
      }

      actualizarAvisoBusqueda(false, enLimite);

      var frag = document.createDocumentFragment();

      /* Construye el botón de UN post (anatomía R55/R56/R57:
         fondo blanco, título colorOficial, estrella pasiva y
         pie con marca + "Ver detalles"). */
      function montarItem(post) {
        var partner = buscarPartner(post.idPartner);

        var titulo  = post.titulo || post.boton || post.id;
        var tagline = post.tagline || '';
        var color   = post.colorOficial || '#475569';
        var like    = Number(post.like) || 0;
        var marca   = marcaDePartner(partner);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lista-item';
        btn.setAttribute('data-post', post.id);

        /* R57 · el colorOficial viaja como variable CSS: el
           título del item lo consume Lista_CSS
           (var --post-color). Antes era la cinta
           (--cinta-color); la cinta murió y el color se
           mudó al título. */
        btn.style.setProperty('--post-color', color);

        var html = '';
        html += '<span class="body">';
        html +=   '<span class="fila-titulo">';
        html +=     '<span class="titulo">' + escapeHtml(titulo) + '</span>';
        html +=   '</span>';
        if (tagline) {
          html += '<span class="tagline">' + escapeHtml(tagline) + '</span>';
        }
        html +=   '<span class="pie">';
        if (marca) {
          html +=   '<span class="marca"><span class="check">✓</span>' +
                    '<span class="marca-texto">' + escapeHtml(marca) + '</span></span>';
        }
        html +=     '<span class="ver-detalles">Ver detalles' +
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

      /* R57 · AGRUPAR POR TÍTULO DE GRUPO. Cada post cuelga de
         su PRIMER grupo (idGrupo[0], la misma convención que
         usa el header del detalle). Los grupos se ordenan como
         vienen en SISTEMA.grupoJson (el orden de la hoja) y los
         que no estén ahí (id colgante) se rescatan al final en
         orden de aparición — NINGÚN post desaparece. Los posts
         sin grupo cierran la lista sin cabecera: si nadie
         tiene grupos, la lista se ve plana como siempre. */
      var porGrupo = {};
      var ordenIds = [];
      var sinGrupo = [];

      lista.forEach(function (post) {
        var idG = (post.idGrupo && post.idGrupo.length)
          ? String(post.idGrupo[0]).trim() : '';
        if (!idG) { sinGrupo.push(post); return; }
        if (!porGrupo[idG]) { porGrupo[idG] = []; ordenIds.push(idG); }
        porGrupo[idG].push(post);
      });

      var idsOrdenados = [];
      var gruposSistema = (window.SISTEMA && window.SISTEMA.grupoJson) || [];
      gruposSistema.forEach(function (g) {
        var id = (g && g.idGrupo != null) ? String(g.idGrupo).trim() : '';
        if (id && porGrupo[id] && porGrupo[id].length) {
          idsOrdenados.push(id);
        }
      });
      ordenIds.forEach(function (id) {
        if (idsOrdenados.indexOf(id) === -1) idsOrdenados.push(id);
      });

      var renderizados = [];

      idsOrdenados.forEach(function (idG) {
        var sec = document.createElement('div');
        sec.className = 'lista-grupo';

        var titulo = nombreGrupo(idG) || idG;
        var cab = document.createElement('div');
        cab.className = 'lista-grupo-titulo';
        cab.textContent = titulo;
        sec.appendChild(cab);

        var bloque = document.createElement('div');
        bloque.className = 'lista-grupo-items';
        porGrupo[idG].forEach(function (post) {
          bloque.appendChild(montarItem(post));
          renderizados.push(post);
        });
        sec.appendChild(bloque);

        frag.appendChild(sec);
      });

      if (sinGrupo.length) {
        var bloque = document.createElement('div');
        bloque.className = 'lista-grupo-items';
        sinGrupo.forEach(function (post) {
          bloque.appendChild(montarItem(post));
          renderizados.push(post);
        });
        frag.appendChild(bloque);
      }

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
      var wrapBuscar = document.querySelector('.filtros-wrap.buscando');
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

