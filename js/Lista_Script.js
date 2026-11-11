/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Lista_Script.html
ESPEJO GITHUB:   github/js/Lista_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.Lista — la fábrica de la vidriera de items
                 (modos LISTA y GRILLA) y el pintado de las páginas
                 del carril:
                 · Cada página del carril (una por chip, las crea
                 Core_Swipe) tiene su contenedor de items: pintar
                 alimenta LA página de su chip; la FIRMA de la
                 página (chip, orden, ciudad, modo y datos visibles
                 de cada post) evita remontar lo que ya está al día
                 — cero parpadeos al deslizar o al revalidar el
                 catálogo.
                 · lista = avatar circular con la INICIAL DEL TÍTULO
                 + título (.subtitulo) + estrella métrica pasiva +
                 "Ver publicación"; grilla (la define el campo vista
                 del chip en CHIPSJSON) = tarjetas 2 por fila estilo
                 Mercado Libre — imagen 1:1 montada SIN src (data-l2
                 y el carril la cobra al verse: la MEMORIA DE FOTOS
                 de la app baja cada foto UNA vez y repinta desde
                 disco, sin red), badge .badgeNuevo/.badgeUsado,
                 título a 2 líneas y slot precio/fecha ("A
                 consultar" si no hay). Datos horneados en el
                 catálogo. La búsqueda sigue SIEMPRE en lista (y
                 fija el carril en la página visible).
                 · La PRECARGA del primer post (PostFull) solo corre
                 en la página VISIBLE: la cuota no paga por páginas
                 que nadie mira.
                 · Compartir lista con cantidad de items. Orden por
                 'orden:change': recomendado, nombre, categoría (con
                 cabecera de grupo), más compartidos y mejor
                 valorados. Emite nada: solo escucha 'chips:change',
                 'buscar:change', 'ciudad:change' y 'orden:change'.
                 · El detalle vive en window.ListaDetalle; las
                 puertas clásicas (abrirDetalle, cerrarDetalle,
                 partner, seleccionar, getModo, getPostActivo)
                 delegan ahí.
VERSIÓN:         2.20
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Index.html (SISTEMA, TABLAS),
                 Global_Script.html (postBackend),
                 Core_Swipe_Script.html (window.SwipeChips · carril),
                 Core_Memoria_Script.html (window.PostFull),
                 Lista_Detalle_Script.html
                 (window.ListaDetalle · detalle),
                 Seccion_Imagen_Script.html (window.SeccionImagen),
                 Iconos.html (pintarGlifos),
                 Chips_Script.html, Buscar_Script.html,
                 Ciudad_Script (window.Ciudad), Compartir_Script.html
                 (window.Compartir), Orden_Sheet_Script.html,
                 Core_CSS.html, Lista_CSS.html, Promo_CSS.html
════════════════════════════════════════════════════════════════════*/


  window.Lista = (function () {

    var chipActivoActual = null;

    /* ORDEN ACTIVO de la vidriera ('recomendado' = el orden de la
       hoja). Lo fija el sheet de ordenamiento vía 'orden:change'.
       Es de SESIÓN: al recargar vuelve al recomendado. */
    var ordenActual = 'recomendado';

    function delegado(nombre, fallback) {
      return function () {
        var lp = window.ListaDetalle;
        if (lp && typeof lp[nombre] === 'function') return lp[nombre]();
        return fallback;
      };
    }

    /* Puerta del detalle para los items de la fábrica: vive en
       ListaDetalle — los clicks de items y tarjetas la invocan
       por el mismo camino de siempre. */
    function abrirDetalle(idPost) {
      if (window.ListaDetalle) window.ListaDetalle.abrirDetalle(idPost);
    }

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

    /* Título del PRIMER grupo del post ('' si no tiene) — la
       clave del orden por categoría. */
    function tituloGrupoDe(post) {
      var grupos = post && post.idGrupo;
      if (!grupos || !grupos.length) return '';
      return nombreGrupo(grupos[0]);
    }

    /* ============================================================
       GRILLA (vista 'grilla' del chip) · HELPERS
       La vista la define el CHIP en CHIPSJSON (campo vista):
       'grilla' → tarjetas 2 por fila al estilo Mercado Libre;
       todo lo demás → la lista de siempre. La BÚSQUEDA sigue
       SIEMPRE en lista. Los datos del slot (precio/fecha) y la
       imagen viajan HORNEADOS en el catálogo (02 Cache.gs): la
       grilla NUNCA llama postDetalle por post.
       ============================================================ */

    /* Vista del chip: solo 'grilla' cambia la vidriera. Sin
       campo, con otro valor o chip desconocido → 'lista'. */
    function vistaDeChip(idChip) {
      if (!idChip) return 'lista';
      var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
      for (var i = 0; i < chips.length; i++) {
        if (chips[i] && chips[i].idChip === idChip) {
          return String(chips[i].vista || '').trim().toLowerCase() === 'grilla'
            ? 'grilla'
            : 'lista';
        }
      }
      return 'lista';
    }

    var MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    /* PRECIO FORMATO ML: "250,00" → entero "250" + centavos "00"
       (el superíndice lo pinta el CSS). El entero viaja tal cual
       (respeta miles con punto si el dueño los escribe). Sin coma
       → sin centavos. Solo dígitos y separadores: cualquier otra
       cosa → null y la card cae al slot de fecha. */
    function partesPrecio(valor) {
      var s = String(valor == null ? '' : valor).trim();
      if (!s || !/^[0-9][0-9.,]*$/.test(s)) return null;
      var coma = s.lastIndexOf(',');
      if (coma === -1) return { entero: s, centavos: '' };
      var entero = s.slice(0, coma);
      if (!entero) return null;
      var centavos = s.slice(coma + 1);
      if (centavos.length > 2) centavos = centavos.slice(0, 2);
      return { entero: entero, centavos: centavos };
    }

    /* FECHA DEL EVENTO es-VE: "2026-12-25 20:00" →
       "25 Dic · 8:00 pm" (12h, am/pm en minúscula). Sin hora →
       "25 Dic". Ilegible → ''. */
    function textoFechaEvento(valor) {
      var m = String(valor == null ? '' : valor).trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
      if (!m) return '';
      var mes = MESES_CORTOS[parseInt(m[2], 10) - 1];
      if (!mes) return '';
      var txt = parseInt(m[3], 10) + ' ' + mes;
      if (m[4]) {
        var h = parseInt(m[4], 10);
        var h12 = h % 12 || 12;
        txt += ' · ' + h12 + ':' + ('0' + m[5]).slice(-2) + ' ' + (h >= 12 ? 'pm' : 'am');
      }
      return txt;
    }

    /* BADGE OVERLAY: mismo contrato del banner — post.promo.idBadge
       buscado en SISTEMA.badges. Apagado o sin título → sin
       overlay. La píldora viste .badgeUsado si el titulo de la BD
       es «Usado»; cualquier otro título viste .badgeNuevo. */
    function badgeDePost(post) {
      var id = post && post.promo ? String(post.promo.idBadge || '').trim() : '';
      if (!id) return null;
      var badges = (window.SISTEMA && window.SISTEMA.badges) || [];
      for (var i = 0; i < badges.length; i++) {
        if (badges[i] && badges[i].idBadge === id) {
          if (badges[i].estado === false) return null;
          return badges[i];
        }
      }
      return null;
    }

    /* SLOT FIJO de la card: precio → fecha → "A consultar".
       Nunca queda muda. El precio manda (Ventas); la fecha es el
       respaldo natural de Eventos. Tipografía del dueño: UNA
       SOLA letra para el slot entero — la maestra .subtitulo —
       para que el precio, la fecha y el "A consultar" no
       distorsionen entre cards (el color lo pinta el CSS). */
    function slotPrecioFecha(post) {
      var precio = partesPrecio(post.precioVenta);
      if (precio) {
        var html = '<span class="grilla-precio subtitulo">' +
          '<span class="precio-moneda">' + escapeHtml(post.monedaVenta || '$') + '</span>' +
          '<span class="precio-entero">' + escapeHtml(precio.entero) + '</span>';
        if (precio.centavos) {
          html += '<span class="precio-centavos">' + escapeHtml(precio.centavos) + '</span>';
        }
        return html + '</span>';
      }

      var fecha = textoFechaEvento(post.fechaEvento);
      if (fecha) {
        return '<span class="grilla-fecha subtitulo">' +
               '<span class="grilla-fecha-glifo" data-glifo="calendario" aria-hidden="true"></span>' +
               escapeHtml(fecha) +
               '</span>';
      }

      return '<span class="grilla-consulta subtitulo">A consultar</span>';
    }

    /* CARD DE LA GRILLA (patrón Mercado Libre): la CARD ENTERA
       es el botón. La imagen 1:1 se monta SIN src cuando la
       memoria de fotos está disponible (data-l2 guarda la URL y
       el carril la cobra cuando la página se ve): cero red en
       páginas que nadie mira y cero recarga al volver. Con la
       foto en pantalla el skeleton individual se retira; si
       falla, cae a la inicial del título. Sin memoria
       disponible: URL directa de siempre. Badge y título a 2
       líneas con altura fija (los slots quedan alineados entre
       cards). Sin likes, sin marca y sin "Ver publicación": la
       grilla invita con el precio. */
    function montarTarjetaGrilla(post) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'grilla-item';
      btn.setAttribute('data-post', post.id);

      var conMemoria = !!(window.SeccionImagen &&
        typeof window.SeccionImagen.poblarConL2 === 'function');

      var badge   = badgeDePost(post);
      var titulo  = post.titulo || post.boton || post.id;
      var inicial = String(titulo).charAt(0).toUpperCase() || 'S';

      var html = '<span class="grilla-foto" aria-hidden="true">';
      html +=   '<span class="grilla-foto-skeleton"></span>';
      if (post.imagen) {
        html += conMemoria
          ? '<img class="grilla-img" data-l2="' + escapeHtml(post.imagen) + '" alt="" decoding="async">'
          : '<img class="grilla-img" src="' + escapeHtml(post.imagen) + '" alt="" loading="lazy" decoding="async">';
      } else {
        html += '<span class="grilla-inicial">' + escapeHtml(inicial) + '</span>';
      }
      if (badge && badge.titulo) {
        /* la clase la elige el titulo de la BD (BADGEJSON):
           «Usado» viste la píldora blanca .badgeUsado; cualquier
           otro título (Nuevo, Popular, Promoción, Último,
           Próximamente…) viste la verde .badgeNuevo de la grilla.
           El texto SIEMPRE es el que llega de la BD. */
        var claseBadge = String(badge.titulo).trim().toLowerCase() === 'usado'
          ? 'badgeUsado'
          : 'badgeNuevo';
        html += '<span class="grilla-badge ' + claseBadge + '">' + escapeHtml(badge.titulo) + '</span>';
      }
      html += '</span>';
      html += '<span class="grilla-titulo textoPrimario">' + escapeHtml(titulo) + '</span>';
      html += slotPrecioFecha(post);

      btn.innerHTML = html;

      /* El skeleton individual se retira cuando LA IMAGEN de esa
         card llega (o falla: cae a la inicial). */
      var img = btn.querySelector('.grilla-img');
      if (img) {
        var retirarSkeleton = function () {
          var sk = btn.querySelector('.grilla-foto-skeleton');
          if (sk && sk.parentNode) sk.parentNode.removeChild(sk);
        };
        if (img.complete) {
          retirarSkeleton();
        } else {
          img.addEventListener('load', retirarSkeleton);
          img.addEventListener('error', function () {
            retirarSkeleton();
            if (img.parentNode) {
              var inicialFalla = document.createElement('span');
              inicialFalla.className = 'grilla-inicial';
              inicialFalla.textContent = inicial;
              img.parentNode.insertBefore(inicialFalla, img);
              img.parentNode.removeChild(img);
            }
          });
        }
      }

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(btn);
      }

      btn.addEventListener('click', function () {
        abrirDetalle(post.id);
      });

      return btn;
    }

    function tituloDe(post) {
      return String((post && (post.titulo || post.boton || post.id)) || '');
    }

    function compararTexto(a, b) {
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    }

    /* ============================================================
       ORDENAMIENTO · aplica el orden activo a lo que llegue del
       filtro (chip o búsqueda). El array original NUNCA se muta
       (se ordena una copia) y 'recomendado' devuelve el orden tal
       cual (el de la hoja).
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
       PÁGINAS DEL CARRIL · el contenedor de items de un chip
       (el carril vive en #listaWrap, lo construye Core_Swipe).
       Sin carril aún: el contenedor directo (mismo de siempre).
       ============================================================ */
    function contenedorDe(idChip) {
      var c = document.getElementById('listaWrap');
      if (c && c.classList.contains('carril')) {
        var pag = c.querySelector('.carril-pagina[data-chip="' + idChip + '"]');
        if (pag) return pag.querySelector('.carril-items');
      }
      return c;
    }

    function chipVisible() {
      return (window.Chips && typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo()
        : chipActivoActual;
    }

    /* FIRMA de una página: chip + modo + orden + ciudad + los
       datos VISIBLES de cada post. Si la firma coincide, la
       página ya está al día y NO se remonta (cero parpadeo de
       fotos al deslizar o al revalidar el catálogo). */
    function firmaDe(idChip, lista, modoBusqueda, enLimite) {
      var f = idChip + '|' + (modoBusqueda ? 'b' + (enLimite ? '1' : '0') : 'l') +
        '|' + ordenActual + '|' + String(ciudadActiva() || '') +
        '|' + (lista ? lista.length : 0);
      if (lista) {
        for (var i = 0; i < lista.length; i++) {
          var p = lista[i];
          f += '|' + p.id +
            ':' + String(p.titulo || '') +
            ':' + String(p.boton || '') +
            ':' + (Number(p.like) || 0) +
            ':' + (Number(p.comparte) || 0) +
            ':' + String(p.precioVenta || '') +
            ':' + String(p.monedaVenta || '') +
            ':' + String(p.fechaEvento || '') +
            ':' + String(p.imagen || '') +
            ':' + String(p.colorOficial || '') +
            ':' + String(p.colorClaro || '') +
            ':' + (p.idGrupo || []).join(',') +
            ':' + (p.idChips || []).join(',') +
            ':' + ((p.promo && p.promo.idBadge) || '');
        }
      }
      return f;
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
       COMPARTIR LISTA · BLOQUE DE ITEMS
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

    /* ============================================================
       RESPIRO DE SCROLL · tras un repintado (cambio de ciudad o
       de chip) el contenedor de la lista vuelve arriba y
       re-evalúa su scroll.
       ============================================================ */
    function respirarScroll() {
      var wrap = document.querySelector('.secciones-wrap');
      if (wrap) wrap.scrollTop = 0;
    }

    /* ============================================================
       PINTAR LISTA · alimenta la página de un chip del carril.
       La FIRMA decide: página al día → solo aviso/compartir/fotos
       pendientes; página distinta → remonta (el orden activo se
       aplica SIEMPRE: recomendado deja el array tal cual).
       La PRECARGA del primer post solo corre si la página es la
       VISIBLE (la cuota no paga por páginas ocultas).
       ============================================================ */
    function pintarLista(listaParam, modoBusqueda, enLimite, idChipPagina) {
      var cont = contenedorDe(idChipPagina);
      if (!cont) return;

      var lista = aplicarOrden(listaParam);
      var firma = firmaDe(idChipPagina, lista, modoBusqueda, enLimite);
      var pag = cont.closest('.carril-pagina');

      if (pag && pag.dataset.firma === firma) {
        /* la página ya está al día: nada que remontar */
        actualizarCompartir(lista ? lista.length : 0);
        actualizarAvisoBusqueda(!!modoBusqueda && !(lista && lista.length), enLimite);
        if (window.SwipeChips && typeof window.SwipeChips.poblarVisibles === 'function') {
          window.SwipeChips.poblarVisibles();
        }
        return;
      }

      /* R64 · compartir vive con items: visible solo si la
         lista trae algo (chip o búsqueda, da igual el modo). */
      actualizarCompartir(lista ? lista.length : 0);

      cont.innerHTML = '';

      if (!lista || lista.length === 0) {
        actualizarAvisoBusqueda(modoBusqueda, enLimite);
        if (pag) pag.dataset.firma = firma;
        respirarScroll();
        return;
      }

      actualizarAvisoBusqueda(false, enLimite);

      /* la vista la define el CHIP (CHIPSJSON.vista): 'grilla'
         pinta tarjetas 2 por fila (Ventas/Eventos); todo lo demás
         pinta la lista de siempre. La BÚSQUEDA SIEMPRE lista. */
      var esGrilla = !modoBusqueda && vistaDeChip(idChipPagina) === 'grilla';
      cont.classList.toggle('en-grilla', esGrilla);

      var frag = document.createDocumentFragment();

      /* Construye el botón de UN post (anatomía LIMPIA: fila del
         título + fila del partner — sin subtítulo ni divisoria ni
         check verde; la división la pinta el CSS con la línea
         tenue entre items). */
      function montarItem(post) {
        var partner = buscarPartner(post.idPartner);

        var titulo  = post.titulo || post.boton || post.id;
        var color   = post.colorOficial || '#475569';
        var claro   = post.colorClaro || '#f1f5f9';
        var like    = Number(post.like) || 0;
        var marca   = marcaDePartner(partner);

        /* AVATAR DEL ITEM: CÍRCULO PERFECTO (el CSS lo centra y
           le da 52×52), SOLO la INICIAL DEL TÍTULO — sin imagen
           (el avatar nunca lleva foto). La letra lleva la
           tipografía .tituloPost y el colorOficial del post;
           fondo colorClaro de siempre. */
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

      /* se renderiza TODO lo que llega del filtro, con el ORDEN
         activo aplicado. Con "Por categoría" el agrupado ES el
         orden: se intercala una cabecera .lista-grupo-header al
         abrir cada bloque de grupo. */
      var renderizados = [];
      var bloqueActual = null;
      var agrupando = (ordenActual === 'categoria') && !esGrilla;

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

        frag.appendChild(esGrilla ? montarTarjetaGrilla(post) : montarItem(post));
        renderizados.push(post);
      });

      cont.appendChild(frag);

      if (pag) pag.dataset.firma = firma;

      /* el contenedor re-evalúa su scroll con contenido nuevo
         (cura el scroll pegado tras cambiar de ciudad). */
      respirarScroll();

      /* fotos pendientes de las páginas ya asomadas */
      if (window.SwipeChips && typeof window.SwipeChips.poblarVisibles === 'function') {
        window.SwipeChips.poblarVisibles();
      }

      /* Precarga del PRIMER post renderizado · SOLO si la página
         es la visible (el usuario que toca ese item ya lo tiene
         en caché y el detalle sale sin skeleton). Páginas
         ocultas: la cuota no paga por ellas. */
      if (window.PostFull && renderizados.length > 0 &&
          idChipPagina === chipVisible()) {
        window.PostFull.obtener(renderizados[0].id).catch(function () {});
      }
    }

    function pintar(idChip) {
      chipActivoActual = idChip;
      pintarLista(postsDeChip(idChip), false, false, idChip);
    }

    function pintarBusqueda(termino, enLimite) {
      pintarLista(postsDeBusqueda(termino), true, enLimite, chipVisible());
    }

    /* ============================================================
       Eventos
       ============================================================ */
    document.addEventListener('chips:change', function (e) {
      var idChip = e.detail && e.detail.idChip;
      respirarScroll();
      pintar(idChip);
    });

    document.addEventListener('buscar:change', function (e) {
      var termino  = e.detail && e.detail.termino;
      var enLimite = e.detail && e.detail.enLimite;

      /* con búsqueda el carril se FIJA en la página visible */
      var c = document.getElementById('listaWrap');
      if (c) c.classList.toggle('fijo', !!(termino && termino.trim()));

      if (termino && termino.trim()) {
        pintarBusqueda(termino, enLimite);
      } else {
        pintar(chipActivoActual || chipVisible(), null);
      }
    });

    document.addEventListener('ciudad:change', function () {
      var input = document.getElementById('buscarInput');
      if (input && input.value.trim()) {
        pintarBusqueda(input.value.trim(), false);
      } else {
        pintar(chipActivoActual || chipVisible(), null);
      }
    });

    /* ORDEN:change · el sheet de ordenamiento fijó otro orden:
       se recuerda y se repinta la vista VIVA. */
    document.addEventListener('orden:change', function (e) {
      ordenActual = (e.detail && e.detail.orden) || 'recomendado';

      var input = document.getElementById('buscarInput');
      if (input && input.value.trim()) {
        pintarBusqueda(input.value.trim(), false);
      } else {
        pintar(chipActivoActual || chipVisible(), null);
      }
    });

    return {
      pintar:         pintar,
      pintarBusqueda: pintarBusqueda,

      /* Puertas clásicas del detalle — viven en window.ListaDetalle */
      abrirDetalle:  abrirDetalle,
      cerrarDetalle: function (desdePopstate) {
        if (window.ListaDetalle) window.ListaDetalle.cerrarDetalle(desdePopstate);
      },
      abrirPartner:  function () {
        if (window.ListaDetalle) window.ListaDetalle.abrirPartner();
      },
      cerrarPartner: function (desdePopstate) {
        if (window.ListaDetalle) window.ListaDetalle.cerrarPartner(desdePopstate);
      },
      seleccionar:   function (idPost) {
        if (window.ListaDetalle) return window.ListaDetalle.seleccionar(idPost);
        return false;
      },
      getModo:       delegado('getModo', 'lista'),
      getPostActivo: delegado('getPostActivo', null),
      getOrden:      function () { return ordenActual; }
    };

  })();
