/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Partner_Sheet_Script.html
ESPEJO GITHUB:   github/js/Partner_Sheet_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Bottom sheet dedicado al partner del post activo.
                 Header sticky, fila de stats, dirección (si
                 existe), chips de filtro, colmena de posts del
                 partner y botón WhatsApp.
                 Las celdas de la colmena leen del índice liviano
                 (TABLAS.posts): campos planos titulo, boton,
                 colorOficial. NO leen seccionJson.
                 Dirección opcional: si el partner no tiene
                 dirección, el bloque completo se omite sin
                 reservar espacio.
VERSIÓN:         1.1
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (SISTEMA, TABLAS, .area-contenido),
                 Chips_Script.html (window.Chips), Iconos.html
                 (pintarGlifos), Global_Script.html (abrirWhatsapp),
                 Partner_Sheet_CSS.html
════════════════════════════════════════════════════════════════════*/

  window.PartnerSheet = (function () {

    var UMBRAL_VELOCIDAD = 0.5;
    var UMBRAL_DRAG      = 6;
    var LIMITE_COLMENA   = 6;

    var raiz       = null;
    var backdrop   = null;
    var sheet      = null;
    var handleArea = null;
    var content    = null;
    var btnClose   = null;

    var abierto       = false;
    var postOrigen    = null;
    var partnerActivo = null;
    var verTodos      = false;
    var chipActivo    = null;

    var dragActivo = false;
    var dragMoved = false;
    var dragPointerId = null;
    var dragStartY = 0;
    var dragUltimoY = 0;
    var dragUltimoT = 0;
    var dragVelocidad = 0;
    var dragDesdeHandle = false;

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === idPartner) return partners[i];
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
      return 'el partner';
    }

    function inicialPartner() {
      var n = nombrePartner();
      return (n.charAt(0) || 'P').toUpperCase();
    }

    function colorDelPostActual() {
      if (postOrigen && postOrigen.colorOficial) return postOrigen.colorOficial;
      if (postOrigen && postOrigen.seccionJson && postOrigen.seccionJson.meta) {
        return postOrigen.seccionJson.meta.colorOficial || '#475569';
      }
      return '#475569';
    }

    function tituloPostActual() {
      if (postOrigen && postOrigen.seccionJson && postOrigen.seccionJson.seccionPresentacion) {
        var t = String(postOrigen.seccionJson.seccionPresentacion.titulo || '').trim();
        if (t) return t;
      }
      if (postOrigen && postOrigen.titulo) return String(postOrigen.titulo).trim();
      return '';
    }

    function esPostServicio(p) {
      if (!p || !p.idChips) return false;
      return p.idChips.indexOf('se') !== -1;
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

    function construir() {
      if (raiz) return;
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      raiz = document.createElement('div');
      raiz.className = 'partner-root';
      raiz.innerHTML =
        '<div class="partner-backdrop"></div>' +
        '<div class="partner-sheet">' +
          '<div class="partner-handle-area"><div class="partner-handle"></div></div>' +
          '<button class="partner-close" type="button" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
          '<div class="partner-content"></div>' +
        '</div>';

      area.appendChild(raiz);

      backdrop   = raiz.querySelector('.partner-backdrop');
      sheet      = raiz.querySelector('.partner-sheet');
      handleArea = raiz.querySelector('.partner-handle-area');
      content    = raiz.querySelector('.partner-content');
      btnClose   = raiz.querySelector('.partner-close');

      backdrop.addEventListener('click', cerrar);
      btnClose.addEventListener('click', cerrar);
      handleArea.addEventListener('pointerdown', onDragDown);
      content.addEventListener('pointerdown', onContentDown);
    }

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

    function buildHeader() {
      var color = colorDelPostActual();
      var nombre = nombrePartner();
      var pj = partnerActivo && partnerActivo.partnerJson ? partnerActivo.partnerJson : {};
      var eslogan = String(pj.esloganPartner || '').trim();
      var inicial = inicialPartner();

      var html = '<div class="partner-header-sticky">';
      html +=   '<div class="partner-header-row">';
      html +=     '<div class="partner-avatar" style="color:' + color + '; border-color:' + color + ';">' +
                    escapeHtml(inicial) +
                  '</div>';
      html +=     '<div class="partner-header-text">';
      html +=       '<h2 class="partner-nombre">' + escapeHtml(nombre) + '</h2>';
      if (eslogan) {
        html += '<p class="partner-eslogan">' + escapeHtml(eslogan) + '</p>';
      }
      html +=     '</div>';
      html +=   '</div>';
      html += '</div>';
      return html;
    }

    function buildStats() {
      var s = sumarStatsGlobales();
      return '<div class="partner-stats">' +
        '<div class="partner-stat">' +
          '<div class="partner-stat-top">' +
            '<span class="partner-stat-icon rojo" data-glifo="like"></span>' +
            '<span class="partner-stat-numero">' + formatearNumero(s.likes) + '</span>' +
          '</div>' +
          '<span class="partner-stat-label">Me gusta</span>' +
        '</div>' +
        '<div class="partner-stat">' +
          '<div class="partner-stat-top">' +
            '<span class="partner-stat-icon azul" data-glifo="comment"></span>' +
            '<span class="partner-stat-numero">' + formatearNumero(s.comentarios) + '</span>' +
          '</div>' +
          '<span class="partner-stat-label">Comentarios</span>' +
        '</div>' +
        '<div class="partner-stat">' +
          '<div class="partner-stat-top">' +
            '<span class="partner-stat-icon verde" data-glifo="share"></span>' +
            '<span class="partner-stat-numero">' + formatearNumero(s.compartidos) + '</span>' +
          '</div>' +
          '<span class="partner-stat-label">Compartidos</span>' +
        '</div>' +
      '</div>';
    }

    function filaDatoDireccion(direccion, colorAcento) {
      var urlMaps = 'https://www.google.com/maps/dir/?api=1&destination=' +
                    encodeURIComponent(direccion);
      return '<li class="partner-dato-item">' +
        '<a class="partner-dato-maps" href="' + urlMaps + '" target="_blank" rel="noopener">' +
          '<span class="partner-dato-icon" data-glifo="ubicacion" ' +
                'style="color:' + colorAcento + ';"></span>' +
          '<div class="partner-dato-texto">' +
            '<span class="partner-dato-valor">' + escapeHtml(direccion) + '</span>' +
            '<span class="partner-maps-cta" style="color:' + colorAcento + ';">Cómo llegar →</span>' +
          '</div>' +
        '</a>' +
      '</li>';
    }

    function buildFilasDatos() {
      var pj = partnerActivo && partnerActivo.partnerJson ? partnerActivo.partnerJson : {};
      var colorAcento = colorDelPostActual();
      var direccion = String(pj.direccion || '').trim();

      if (!direccion) return '';

      return '<ul class="partner-datos">' +
               filaDatoDireccion(direccion, colorAcento) +
             '</ul>';
    }

    /* ============================================================
       Celda de post · lee del índice liviano
       ============================================================ */
    function celdaPost(p) {
      var nombre  = p.boton || p.titulo || p.id;
      var inicial = (nombre.charAt(0) || '?').toUpperCase();
      var color   = p.colorOficial || '#475569';
      var esPronto   = p.estado === 'pronto';
      var esServicio = esPostServicio(p);

      var borderStyle = esServicio ? 'border-radius:50%;' : '';

      var html = '<button type="button" class="partner-celda" data-post-id="' + escapeHtml(p.id) + '">';
      html +=   '<span class="partner-celda-icono" style="color:' + color + '; border-color:' + color + '; ' + borderStyle + '">' +
                  escapeHtml(inicial) +
                '</span>';
      html +=   '<span class="partner-celda-nombre">' + escapeHtml(nombre) + '</span>';
      if (esPronto) {
        html += '<span class="partner-celda-badge">Pronto</span>';
      }
      html += '</button>';
      return html;
    }

    function buildBloquePublicaciones() {
      var chips = chipsDisponibles();
      var html = '';

      if (chips.length) {
        html += '<div class="partner-chips">';
        chips.forEach(function (c) {
          var activo = (c.id === chipActivo) ? ' activo' : '';
          var solo   = (chips.length === 1) ? ' data-solo="1"' : '';
          html += '<button type="button" class="chip' + activo + '"' +
                  ' data-chip="' + c.id + '"' + solo + '>' +
                    escapeHtml(c.titulo) +
                  '</button>';
        });
        html += '</div>';
      }

      var filtrados = postsFiltrados();

      if (!filtrados.length) {
        html += '<div class="partner-vacia">Próximamente más contenido</div>';
        return html;
      }

      var hayMas = filtrados.length > LIMITE_COLMENA;
      var visibles = verTodos ? filtrados : filtrados.slice(0, LIMITE_COLMENA);

      html += '<div class="partner-colmena">';
      visibles.forEach(function (p) { html += celdaPost(p); });
      html += '</div>';

      if (hayMas) {
        var texto = verTodos ? 'Ver menos' : 'Ver todas las publicaciones';
        html += '<button type="button" class="partner-ver-todos" id="btnVerTodos">' + texto + '</button>';
      }

      return html;
    }

    function buildBotonWhatsapp() {
      var pj = partnerActivo && partnerActivo.partnerJson ? partnerActivo.partnerJson : {};
      var numero = String(pj.whatsapp || '').trim();
      if (!numero) return '';

      var textoBoton = String(pj.textoBotonWhatsapp || 'Enviar mensaje').trim();
      var tituloPost = tituloPostActual();

      var mensaje = tituloPost
        ? ('Hola, estoy viendo "' + tituloPost + '" en la app. ¿Me pueden dar más información?')
        : 'Hola, estoy viendo las publicaciones en la app. ¿Me pueden dar más información?';

      return '<a class="partner-whatsapp" href="#" id="btnPartnerWhatsapp" ' +
                'data-numero="' + escapeHtml(numero) + '" ' +
                'data-mensaje="' + escapeHtml(mensaje) + '">' +
        '<span class="partner-whatsapp-icono" data-glifo="whatsapp"></span>' +
        '<span class="partner-whatsapp-texto">' + escapeHtml(textoBoton) + '</span>' +
      '</a>';
    }

    function buildContenido() {
      return '' +
        buildHeader() +
        buildStats() +
        buildFilasDatos() +
        '<div id="partnerPublicaciones">' + buildBloquePublicaciones() + '</div>' +
        buildBotonWhatsapp();
    }

    function engancharChips() {
      var chips = chipsDisponibles();
      if (chips.length <= 1) return;

      content.querySelectorAll('.partner-chips .chip[data-chip]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('activo')) return;
          haptic(8);
          chipActivo = btn.getAttribute('data-chip');
          verTodos = false;
          repintarPublicaciones();
        });
      });
    }

    function engancharCeldas() {
      content.querySelectorAll('.partner-celda').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idPost = this.getAttribute('data-post-id');
          if (idPost) irAPost(idPost);
        });
      });
    }

    function engancharVerTodos() {
      var btn = content.querySelector('#btnVerTodos');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        haptic(8);
        verTodos = !verTodos;
        repintarPublicaciones();
      });
    }

    function engancharBotonWa() {
      var btnWa = content.querySelector('#btnPartnerWhatsapp');
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
      var cont = content.querySelector('#partnerPublicaciones');
      if (!cont) return;
      cont.innerHTML = buildBloquePublicaciones();

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(cont);
      }

      engancharChips();
      engancharCeldas();
      engancharVerTodos();
    }

    function pintar() {
      content.innerHTML = buildContenido();

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(content);
      }

      engancharChips();
      engancharCeldas();
      engancharVerTodos();
      engancharBotonWa();
    }

    function irAPost(idPost) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      var post = null;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === idPost) { post = posts[i]; break; }
      }
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

    function abrir(postDesdeElQueSeAbre) {
      postOrigen = postDesdeElQueSeAbre || null;
      partnerActivo = postOrigen ? buscarPartner(postOrigen.idPartner) : null;

      if (!partnerActivo) return;

      construir();
      if (!raiz) return;

      verTodos   = false;
      chipActivo = chipInicialDesdeOrigen();

      haptic(10);
      pintar();

      sheet.classList.add('sin-transicion');
      sheet.style.transform = 'translateY(100%)';
      raiz.classList.add('abierto');
      sheet.classList.add('abierto');

      void sheet.offsetHeight;
      sheet.classList.remove('sin-transicion');

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sheet.style.transform = 'translateY(0)';
          backdrop.classList.add('visible');
          abierto = true;
        });
      });
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;

      backdrop.classList.remove('visible');
      sheet.style.transform = 'translateY(100%)';

      setTimeout(function () {
        if (!abierto) {
          sheet.classList.remove('abierto');
          raiz.classList.remove('abierto');
          if (content) content.innerHTML = '';
        }
      }, 420);
    }

    function onDragDown(e) { iniciarDrag(e, true); }
    function onContentDown(e) {
      if (content.scrollTop > 0) return;
      iniciarDrag(e, false);
    }

    function iniciarDrag(e, desdeHandle) {
      if (!abierto) return;
      if (e.button !== undefined && e.button !== 0) return;

      dragActivo = true;
      dragMoved = false;
      dragDesdeHandle = desdeHandle;
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragUltimoY = e.clientY;
      dragUltimoT = performance.now();
      dragVelocidad = 0;

      if (desdeHandle) {
        handleArea.addEventListener('pointermove', onDragMove);
        handleArea.addEventListener('pointerup', onDragEnd);
        handleArea.addEventListener('pointercancel', onDragEnd);
      } else {
        content.addEventListener('pointermove', onDragMove);
        content.addEventListener('pointerup', onDragEnd);
        content.addEventListener('pointercancel', onDragEnd);
      }
    }

    function onDragMove(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;

      var dy = e.clientY - dragStartY;

      if (!dragMoved) {
        if (Math.abs(dy) < UMBRAL_DRAG) return;
        dragMoved = true;
        sheet.classList.add('sin-transicion');
        if (!dragDesdeHandle && dy < 0) { cancelarDrag(); return; }
        try {
          (dragDesdeHandle ? handleArea : content).setPointerCapture(e.pointerId);
        } catch (err) {}
      }

      var altura = sheet.offsetHeight;
      var pct = (dy / altura) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      e.preventDefault();
      sheet.style.transform = 'translateY(' + pct + '%)';

      var ahora = performance.now();
      var dt = ahora - dragUltimoT;
      if (dt > 0) {
        var v = (e.clientY - dragUltimoY) / dt;
        dragVelocidad = dragVelocidad * 0.7 + v * 0.3;
        dragUltimoY = e.clientY;
        dragUltimoT = ahora;
      }
    }

    function onDragEnd(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;
      dragActivo = false;
      dragPointerId = null;

      if (!dragMoved) { limpiarDrag(); return; }
      dragMoved = false;
      sheet.classList.remove('sin-transicion');

      var t = sheet.style.transform || '';
      var m = t.match(/translateY\(([\d.]+)%\)/);
      var pct = m ? parseFloat(m[1]) : 0;

      if ((dragVelocidad > UMBRAL_VELOCIDAD) || (pct > 30)) cerrar();
      else sheet.style.transform = 'translateY(0)';

      limpiarDrag();
    }

    function cancelarDrag() {
      dragActivo = false;
      dragMoved = false;
      dragPointerId = null;
      sheet.classList.remove('sin-transicion');
      sheet.style.transform = 'translateY(0)';
      limpiarDrag();
    }

    function limpiarDrag() {
      handleArea.removeEventListener('pointermove', onDragMove);
      handleArea.removeEventListener('pointerup', onDragEnd);
      handleArea.removeEventListener('pointercancel', onDragEnd);
      content.removeEventListener('pointermove', onDragMove);
      content.removeEventListener('pointerup', onDragEnd);
      content.removeEventListener('pointercancel', onDragEnd);
    }

    return { abrir: abrir, cerrar: cerrar };

  })();