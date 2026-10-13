/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Seccion_Script.html
ESPEJO GITHUB:   js/Seccion_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Genera las 5 secciones del panorama desde la
                 BD real, en orden fijo:
                   1. seccionPresentacion
                   2. seccionContenido
                   3. seccionValor
                   4. seccionPlanes
                   5. seccionCrossSell
                 El post que llega por 'post:change' viene
                 enriquecido (seccionJson + planJson) gracias a
                 Lista_Script + PostFull.
                 Presentación: si hay imagen se muestra (foto
                 sola o carrusel). Si no hay imagen, no se
                 reserva espacio.
                 Identidad (marca + título + tagline) centrada.
                 Descripción alineada a la izquierda.
                 Bloque de cuentas del partner eliminado.
                 Cross-sell lee del índice liviano (TABLAS.posts):
                 campos planos titulo, boton, colorOficial.
                 Contenido y Valor: siempre visibles.
VERSIÓN:         1.2
CAMBIOS:         R19: navegación cross-post ahora cambia TAMBIÉN la
                 ciudad. irAPost() compara post.idCiudad con la
                 ciudad activa (Ciudad.getActual) y, si el post no
                 pertenece a ella, aplica la primera ciudad válida
                 del post con Ciudad.aplicarGuardada (API existente
                 R10, emite ciudad:change → píldora "Estás viendo…"
                 y lista se refrescan solas). Después hace el mismo
                 cambio de chip de siempre. Sin cambios de flujo ni
                 de red.
                 R10: blindaje B6 (defensa en profundidad). Todo el
                 contenido que viene de la hoja (títulos, taglines,
                 descripciones, temario, beneficios, planes,
                 cross-sell, marca del partner, tasas, atributos y
                 colores) se interpola escapado con escapeHtml().
                 Cotejado con la BD (R10): hoy es texto plano, así
                 que el renderizado queda IDÉNTICO; el escapado
                 bloquea el día en que algo del Sheet lleve < > " '
                 sin querer. Los íconos de beneficios siguen siendo
                 claves del catálogo IMAGENES (Iconos.html).
                 R6: baseline de producción incorporado al espejo;
                 encabezado normalizado al estándar ═══ (6 campos).
DEPENDENCIAS:    Seccion_Imagen_Script.html (window.SeccionImagen),
                 Index.html (SISTEMA, TABLAS), Iconos.html
                 (pintarGlifos), Chips_Script.html (window.Chips),
                 Global_Script.html (abrirWhatsapp),
                 Seccion_CSS.html
════════════════════════════════════════════════════════════════════
*/

  window.Secciones = (function () {

    var postActivo = null;

    var ICONOS_BENEFICIOS = ['code', 'user', 'monitor', 'badgeCheck', 'book'];
    var ID_POST_INCOMPANY = 'EMPR-001';

    var MESES = [
      'enero','febrero','marzo','abril','mayo','junio',
      'julio','agosto','septiembre','octubre','noviembre','diciembre'
    ];

    /* ============================================================
       Helpers generales
       ============================================================ */
    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function sumarCupos(post) {
      if (!post || !post.planJson || !post.planJson.planes) return null;
      var total = 0;
      post.planJson.planes.forEach(function (p) {
        total += Number(p.cupoLibre || 0);
      });
      return total;
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

    function marcaDePartner(partner) {
      if (!partner) return '';
      var marca = String(partner.marca || '').trim();
      if (marca) return marca;
      return String(partner.nombre || '').trim();
    }

    /* B6 · R10: escapado HTML para todo el contenido que viene
       de la hoja. Mismo patrón que Comenta/Ciudad/Partner/Reserva. */
    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function formatearDias(dias) {
      if (!dias || !dias.length) return '';
      return dias.join(' · ');
    }

    function formatearFecha(iso) {
      if (!iso || typeof iso !== 'string') return iso || '';
      var partes = iso.split('-');
      if (partes.length !== 3) return iso;
      var dia = parseInt(partes[2], 10);
      var mes = parseInt(partes[1], 10) - 1;
      if (isNaN(dia) || isNaN(mes) || !MESES[mes]) return iso;
      return dia + ' de ' + MESES[mes];
    }

    function formatearBs(n) {
      var v = Number(n);
      if (!isFinite(v)) return '';
      var s = v.toFixed(2).replace('.', ',');
      var partes = s.split(',');
      partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return partes.join(',');
    }

    function limpiarFechaTasa(s) {
      return String(s || '')
        .replace(/,/g, '')
        .replace(/\s+\d{4}\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /* ============================================================
       1 · PRESENTACIÓN
       ============================================================ */
    function _buildCarruselPresentacion(capturas) {
      var html = '<div class="carrusel-presentacion">';

      html +=   '<div class="carrusel-track">';
      capturas.forEach(function (u) {
        var src = escapeHtml(window.SeccionImagen.urlImagenDirecta(u));
        html += '<div class="carrusel-slide">';
        html +=   '<img src="' + src + '" alt="" ' +
                       'loading="lazy" decoding="async" ' +
                       'data-full="' + src + '">';
        html += '</div>';
      });
      html +=   '</div>';

      html +=   '<div class="carrusel-dots">';
      capturas.forEach(function (_, i) {
        html += '<span class="carrusel-dot' +
                (i === 0 ? ' activo' : '') +
                '"></span>';
      });
      html +=   '</div>';

      html += '</div>';
      return html;
    }

    function _buildFotoSolaPresentacion(capturas) {
      var src = escapeHtml(window.SeccionImagen.urlImagenDirecta(capturas[0]));
      return '<div class="foto-sola">' +
               '<img src="' + src + '" alt="" ' +
                    'loading="lazy" decoding="async" ' +
                    'data-full="' + src + '">' +
             '</div>';
    }

    function buildPresentacion() {
      var post = postActivo;
      if (!post) return '';

      var sj = post.seccionJson || {};
      var sp = sj.seccionPresentacion || {};
      var meta = sj.meta || {};

      var partner = buscarPartner(post.idPartner);
      var marcaPartner = marcaDePartner(partner);

      /* Imagen · solo si existe */
      var capturas = window.SeccionImagen.capturasDePresentacion(sp);
      var bloqueImagen = '';
      if (capturas.length === 1) {
        bloqueImagen = _buildFotoSolaPresentacion(capturas);
      } else if (capturas.length > 1) {
        bloqueImagen = _buildCarruselPresentacion(capturas);
      }

      /* Cupos */
      var cuposHTML = '';
      var cuposMinimo = Number(meta.cuposMinimo || 0);
      var total = sumarCupos(post);
      if (cuposMinimo > 0 && total !== null) {
        if (total === 0) {
          cuposHTML = '<div class="cupos-hint agotado">Cupos agotados</div>';
        } else if (total <= cuposMinimo) {
          cuposHTML = '<div class="cupos-hint alerta">¡Últimos ' + total + ' cupos disponibles!</div>';
        }
      }

      var html = '';

      if (bloqueImagen) {
        html += '<div class="bloque-imagenes">' + bloqueImagen + '</div>';
      }

      html += '<div class="bloque-texto">';
      if (marcaPartner) {
        html += '<div class="post-marca">' +
                  '<span class="check">✓</span>' +
                  escapeHtml(marcaPartner) +
                '</div>';
      }
      html +=   '<h2 class="post-nombre">' + escapeHtml(sp.titulo || '') + '</h2>';
      if (sp.tagline) {
        html += '<div class="post-tagline">' + escapeHtml(sp.tagline) + '</div>';
      }
      html +=   cuposHTML;
      html += '</div>';

      if (sp.descripcion) {
        html += '<div class="bloque-descripcion">' +
                  '<p class="t-body post-descripcion">' + escapeHtml(sp.descripcion) + '</p>' +
                '</div>';
      }

      return html;
    }

    /* ============================================================
       2 · CONTENIDO (temario)
       ============================================================ */
    function buildContenido() {
      var post = postActivo;
      if (!post) return '';

      var s = (post.seccionJson || {}).seccionContenido || {};
      var items = s.items || [];
      if (!s.titulo && items.length === 0) return '';

      var html = '';
      if (s.titulo) {
        html += '<h2 class="t-seccion">' + escapeHtml(s.titulo) + '</h2>';
      }

      items.forEach(function (it) {
        html += '<div class="fase">';
        html +=   '<span class="fase-num">' + escapeHtml(it.num || '') + '</span>';
        html +=   '<div class="fase-text">';
        if (it.titulo) {
          html += '<span class="t-sub">' + escapeHtml(it.titulo) + '</span>';
        }
        html +=   '<span class="t-body">' + escapeHtml(it.descripcion || '') + '</span>';
        html +=   '</div>';
        html += '</div>';
      });

      return html;
    }

    /* ============================================================
       3 · VALOR (beneficios)
       ============================================================ */
    function buildValor() {
      var post = postActivo;
      if (!post) return '';

      var s = (post.seccionJson || {}).seccionValor || {};
      var items = s.beneficios || [];
      if (!s.titulo && items.length === 0) return '';

      var html = '';
      if (s.titulo) {
        html += '<h2 class="t-seccion">' + escapeHtml(s.titulo) + '</h2>';
      }
      html += '<ul class="icon-list">';
      items.forEach(function (item, i) {
        var icono = item.icono || ICONOS_BENEFICIOS[i % ICONOS_BENEFICIOS.length];
        html += '<li class="icon-list-item">';
        html +=   '<span class="icon-list-icon" data-glifo="' + escapeHtml(icono) + '"></span>';
        html +=   '<div class="icon-list-text">';
        html +=     '<span class="t-sub">' + escapeHtml(item.titulo || '') + '</span>';
        html +=     '<span class="t-body">' + escapeHtml(item.desc || item.descripcion || '') + '</span>';
        html +=   '</div>';
        html += '</li>';
      });
      html += '</ul>';
      return html;
    }

    /* ============================================================
       4 · PLANES
       ============================================================ */
    function buildTurnoCard(plan, moneda, cuposMinimo) {
      var cupo = Number(plan.cupoLibre || 0);
      var claseBadge = (cuposMinimo > 0 && cupo <= cuposMinimo) ? 'alerta' : 'normal';

      var dias = formatearDias(plan.turno && plan.turno.dias);
      var horario = (plan.turno && plan.turno.textoMostrar) || '';

      var html = '<div class="turno-card">';

      html += '<div class="turno-card-head">';
      html +=   '<span class="turno-card-icon" data-glifo="calendario"></span>';
      html +=   '<span class="turno-card-title">' + escapeHtml(dias) + '</span>';
      if (cupo > 0) {
        html += '<span class="turno-card-badge ' + claseBadge + '">' + cupo + ' cupos</span>';
      }
      html += '</div>';

      if (horario) {
        html += '<p class="turno-card-sub">' + escapeHtml(horario) + '</p>';
      }

      var pagos = plan.fechasPago || [];
      pagos.forEach(function (fp, i) {
        var destacado = (i === 0) ? ' destacado' : '';
        var label = fp.concepto || '';
        if (fp.fechaPago) label += ' (' + formatearFecha(fp.fechaPago) + ')';
        var monto = fp.monto ? (fp.monto + ' ' + (moneda || '')) : '';
        html += '<div class="turno-inv-row' + destacado + '">';
        html +=   '<span class="turno-inv-concepto">' + escapeHtml(label) + '</span>';
        if (monto) {
          html += '<span class="turno-inv-monto">' + escapeHtml(monto) + '</span>';
        }
        html += '</div>';
      });

      html += '</div>';
      return html;
    }

    function buildAvisoPronto() {
      return '' +
        '<div class="aviso-pronto">' +
          '<span class="aviso-pronto-icono" data-glifo="reloj"></span>' +
          '<div class="aviso-pronto-texto">' +
            '<span class="aviso-pronto-titulo">Este contenido estará disponible próximamente</span>' +
            '<span class="aviso-pronto-sub">Estamos afinando los últimos detalles. Puedes seguir explorando el temario mientras tanto.</span>' +
          '</div>' +
        '</div>';
    }

    function buildPlanes() {
      var post = postActivo;
      if (!post) return '';

      var sj = post.seccionJson || {};
      var s = sj.seccionPlanes || {};
      var meta = sj.meta || {};

      if (!s.titulo) return '';

      var plan = post.planJson || {};
      var estado = post.estado || 'activo';
      var esPronto = (estado === 'pronto');

      var html = '';
      html += '<h2 class="t-seccion">' + escapeHtml(s.titulo) + '</h2>';

      if (esPronto) {
        html += buildAvisoPronto();
      } else {
        if (s.mensaje) {
          html += '<p class="t-body" style="margin:0 0 20px;">' + escapeHtml(s.mensaje) + '</p>';
        }

        var root  = (window.SISTEMA && window.SISTEMA.root) || {};
        var tasas = root.tasas || {};
        if (tasas.dolar) {
          html += '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin:0 0 14px; color:var(--post-color, #475569);">' +
                    '<span class="t-body" style="color:inherit;">Tasa BCV ' +
                      escapeHtml(limpiarFechaTasa(tasas.fechavalor)) +
                    '</span>' +
                    '<span class="t-body" style="color:inherit;">Bs. ' +
                      formatearBs(tasas.dolar) +
                    '</span>' +
                  '</div>';
        }

        var cuposMinimo = Number(meta.cuposMinimo || 0);
        if (plan.planes && plan.planes.length > 0) {
          plan.planes.forEach(function (p) {
            html += buildTurnoCard(p, plan.moneda, cuposMinimo);
          });
        }
      }

      return html;
    }

    /* ============================================================
       5 · CROSS-SELL
       AHORA lee del índice liviano (TABLAS.posts).
       Campos planos: titulo, boton, colorOficial.
       ============================================================ */
    function buildCrossSellHTML(ids, titulo) {
      if (!ids || !ids.length) return '';

      var html = '<div class="cross-sell">';
      if (titulo) {
        html += '<h2 class="t-seccion cross-sell-titulo">' + escapeHtml(titulo) + '</h2>';
      }
      html +=   '<div class="cross-sell-lista">';

      ids.forEach(function (id) {
        var p = buscarPost(id);
        if (!p) return;

        var nombre  = p.boton || p.titulo || p.id;
        var inicial = (nombre.charAt(0) || '?').toUpperCase();
        var color   = p.colorOficial || '#475569';

        html += '<button type="button" class="cross-mini" data-post-solicitado="' + escapeHtml(p.id) + '">';
        html +=   '<span class="cm-icon" style="color:' + escapeHtml(color) + '; border-color:' + escapeHtml(color) + ';">' + escapeHtml(inicial) + '</span>';
        html +=   '<span class="cm-nombre">' + escapeHtml(nombre) + '</span>';
        html += '</button>';
      });

      html +=   '</div>';
      html += '</div>';
      return html;
    }

    function buildInCompanyButton() {
      return '' +
        '<button type="button" class="cross-incompany" data-post-incompany="' + ID_POST_INCOMPANY + '">' +
          '<div class="ci-info">' +
            '<span class="ci-titulo">¿Buscas capacitar a todo tu equipo?</span>' +
            '<span class="ci-cta">Conoce In Company</span>' +
          '</div>' +
          '<span class="ci-boton" aria-hidden="true">' +
            '<span data-glifo="flecha"></span>' +
          '</span>' +
        '</button>';
    }

    function buildBloqueAsesor() {
      return '' +
        '<button type="button" class="bloque-asesor" id="bloqueAsesor">' +
          '<span class="bloque-asesor-icono" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
              '<circle cx="9" cy="7" r="4"/>' +
              '<line x1="20" y1="8" x2="20" y2="14"/>' +
              '<line x1="23" y1="11" x2="17" y2="11"/>' +
            '</svg>' +
          '</span>' +
          '<span class="bloque-asesor-info">' +
            '<span class="bloque-asesor-titulo">¿Ofreces algún servicio?</span>' +
            '<span class="bloque-asesor-sub">Publícalo con nosotros y llega a más personas</span>' +
          '</span>' +
          '<span class="bloque-asesor-flecha" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M5 12h14"/>' +
              '<path d="m12 5 7 7-7 7"/>' +
            '</svg>' +
          '</span>' +
        '</button>';
    }

    function buildCrossSell() {
      var post = postActivo;
      if (!post) return '';

      var s = (post.seccionJson || {}).seccionCrossSell || {};
      var html = '';

      html += buildCrossSellHTML(s.crossSellJson, s.titulo);

      if (s.inCompany === true) {
        html += buildInCompanyButton();
      }

      var esServicio = (post.idChips || []).indexOf('se') !== -1;
      if (esServicio) {
        html += buildBloqueAsesor();
      }

      return html;
    }

    /* ============================================================
       Render · arma las 5 secciones en orden fijo
       ============================================================ */
    function pintarVistas() {
      var track = document.getElementById('seccionesTrack');
      if (!track) return;

      if (!postActivo) {
        track.innerHTML = '';
        return;
      }

      track.innerHTML = '';

      var secciones = [
        { clave: 'presentacion', clase: 'vista-presentacion', builder: buildPresentacion },
        { clave: 'contenido',    clase: 'vista-temario',      builder: buildContenido },
        { clave: 'valor',        clase: 'vista-beneficios',   builder: buildValor },
        { clave: 'planes',       clase: 'vista-cierre',       builder: buildPlanes },
        { clave: 'crossSell',    clase: 'vista-cierre',       builder: buildCrossSell }
      ];

      secciones.forEach(function (def) {
        var contenido = def.builder();
        if (!contenido) return;

        var seccion = document.createElement('section');
        seccion.className = 'seccion ' + def.clase;
        seccion.dataset.seccion = def.clave;

        var vista = document.createElement('div');
        vista.className = 'vista-contenido';
        vista.innerHTML = contenido;
        seccion.appendChild(vista);

        track.appendChild(seccion);
      });

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(track);
      }

      window.SeccionImagen.enganchar(track);
      engacharCrossSell(track);
      engacharInCompany(track);
      engacharBloqueAsesor(track);
    }

    /* ============================================================
       Navegación cross-post
       ============================================================ */
    function irAPost(idPost) {
      var post = buscarPost(idPost);
      if (!post) return;

      var chips = post.idChips || [];
      if (chips.length === 0) {
        console.warn('[Secciones] Post sin idChips:', idPost);
        return;
      }

      /* ==========================================================
         R19 · CIUDAD: si el post NO pertenece a la ciudad activa,
         se cambia también la ciudad (antes solo cambiaba el chip).
         Se usa la API pública existente (R10): Ciudad.getActual /
         getLista / aplicarGuardada — que emite 'ciudad:change' y
         refresca la píldora y la lista sin recargar nada.
         ========================================================== */
      var cambioCiudad = false;
      try {
        if (window.Ciudad && typeof window.Ciudad.getActual === 'function' &&
            typeof window.Ciudad.getLista === 'function' &&
            typeof window.Ciudad.aplicarGuardada === 'function') {
          var ciudadActual = window.Ciudad.getActual();
          var idCiudadActual = ciudadActual ? ciudadActual.idCiudad : null;
          var ciudadesPost = post.idCiudad || [];
          var yaPertenece = !!idCiudadActual &&
                            ciudadesPost.indexOf(idCiudadActual) !== -1;
          if (!yaPertenece) {
            var disponibles = window.Ciudad.getLista();
            for (var ci = 0; ci < ciudadesPost.length && !cambioCiudad; ci++) {
              for (var cd = 0; cd < disponibles.length; cd++) {
                if (disponibles[cd].idCiudad === ciudadesPost[ci]) {
                  window.Ciudad.aplicarGuardada(disponibles[cd]);
                  cambioCiudad = true;
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Secciones] Cambio de ciudad cross-post falló:', e && e.message);
      }

      var chipActivo = (window.Chips && typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo()
        : null;

      var enMismoChip = (chipActivo && chips.indexOf(chipActivo) !== -1);

      /* R19: si cambió la ciudad, diferir SIEMPRE la apertura (80 ms,
         mismo carril del cambio de chip): el cierre del detalle
         anterior (eventos de 'ciudad:change') corre primero y el
         post nuevo abre sobre la lista ya re-filtrada. */
      if (enMismoChip && !cambioCiudad) {
        document.dispatchEvent(new CustomEvent('post:solicitar', {
          detail: { idPost: idPost }
        }));
        return;
      }

      if (!enMismoChip && window.Chips &&
          typeof window.Chips.seleccionar === 'function') {
        window.Chips.seleccionar(chips[0]);
      }

      setTimeout(function () {
        document.dispatchEvent(new CustomEvent('post:solicitar', {
          detail: { idPost: idPost }
        }));
      }, 80);
    }

    function engacharCrossSell(root) {
      var botones = root.querySelectorAll('.cross-mini[data-post-solicitado]');
      for (var i = 0; i < botones.length; i++) {
        botones[i].addEventListener('click', function () {
          var idPost = this.getAttribute('data-post-solicitado');
          if (idPost) irAPost(idPost);
        });
      }
    }

    function engacharInCompany(root) {
      var botones = root.querySelectorAll('.cross-incompany[data-post-incompany]');
      for (var i = 0; i < botones.length; i++) {
        botones[i].addEventListener('click', function () {
          var idPost = this.getAttribute('data-post-incompany');
          if (idPost) irAPost(idPost);
        });
      }
    }

    function engacharBloqueAsesor(root) {
      var btn = root.querySelector('#bloqueAsesor');
      if (!btn) return;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        haptic(10);

        var root_  = (window.SISTEMA && window.SISTEMA.root) || {};
        var admin_ = root_.admin || {};
        var numero  = String(admin_.whatsapp || '').trim();
        var mensaje = String(admin_.mensajeWhatsapp || '').trim();

        if (!numero) return;

        if (typeof window.abrirWhatsapp === 'function') {
          window.abrirWhatsapp(numero, mensaje);
        }
      });
    }

    function irAInicio() {
      var wrap = document.querySelector('.secciones-wrap');
      if (!wrap) return;
      wrap.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function pintar() { pintarVistas(); }

    document.addEventListener('post:change', function (e) {
      postActivo = e.detail ? e.detail.post : null;
      pintarVistas();
      irAInicio();
    });

    return {
      pintar:    pintar,
      irAInicio: irAInicio
    };

  })();
