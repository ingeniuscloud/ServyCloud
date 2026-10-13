/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Reserva_Exito_Script.html
ESPEJO GITHUB:   js/Reserva_Exito_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Vista de confirmación. Tres modos: cargando / error / éxito.
                 Éxito: información de la reserva + aviso de que el
                 cupo se activa al pagar en oficina.
                 Título del post leído de seccionPresentacion.titulo
                 (con fallback a post.titulo del índice liviano).
VERSIÓN:         1.0
CAMBIOS:         R6: baseline de producción incorporado al espejo;
                 encabezado normalizado al estándar ═══ (6 campos).
DEPENDENCIAS:    Reserva_Sheet_Script.html (window.Sheet),
                 Global_Script.html (window.limpiarTelefono),
                 Index.html (TABLAS), Reserva_CSS.html (clases
                 reserva-root/sheet base), Reserva_Exito_CSS.html
                 (clases reserva-exito/exito-* · R10),
                 Reserva_Script.html (state + callbacks)
════════════════════════════════════════════════════════════════════
*/

  window.ReservaExito = (function () {

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    /* Título del post · lee del post enriquecido, con fallback */
    function tituloDelPost(post) {
      if (!post) return '';
      var sj = post.seccionJson || {};
      var sp = sj.seccionPresentacion || {};
      var t = String(sp.titulo || '').trim();
      if (t) return t;
      return String(post.titulo || '').trim();
    }

    /* ============================================================
       MODO CARGANDO · skeleton
       ============================================================ */
    function _htmlCargando(state) {
      var html = '<div class="reserva-exito reserva-exito-cargando">';
      html +=   '<div class="reserva-exito-icono"><span class="spinner-exito"></span></div>';
      html +=   '<h3 class="reserva-exito-titulo">Procesando tu reserva</h3>';
      html +=   '<p class="reserva-exito-sub">Estamos confirmando tu cupo. Esto toma unos segundos.</p>';
      html +=   '<ul class="exito-lista">';

      var anchos = ['78%', '62%', '70%', '55%', '66%'];
      for (var i = 0; i < anchos.length; i++) {
        html += '<li>' +
                  '<span class="exito-check skeleton-dot"></span>' +
                  '<span class="skeleton-line" style="width:' + anchos[i] + '"></span>' +
                '</li>';
      }

      html +=   '</ul>';
      html += '</div>';
      return html;
    }

    /* ============================================================
       MODO ERROR
       ============================================================ */
    function _htmlError(state) {
      var mensaje = state.reservaErrorTexto || 'No se pudo procesar tu reserva. Intenta de nuevo.';

      var html = '<div class="reserva-exito reserva-exito-error">';
      html +=   '<div class="reserva-exito-icono">⚠️</div>';
      html +=   '<h3 class="reserva-exito-titulo">No pudimos confirmar tu reserva</h3>';
      html +=   '<p class="reserva-exito-sub">' + escapeHtml(mensaje) + '</p>';
      html +=   '<div class="exito-acciones">';
      html +=     '<button type="button" class="exito-btn-primario" id="btnReintentarReserva">Intentar de nuevo</button>';
      html +=     '<button type="button" class="exito-btn-secundario" id="btnVolverFormulario">Volver al formulario</button>';
      html +=   '</div>';
      html += '</div>';
      return html;
    }

    /* ============================================================
       MODO ÉXITO
       ============================================================ */
    function _htmlExito(state, elDatos) {
      elDatos = elDatos || {};

      var post = state.postActivo || {};
      var nombrePost = tituloDelPost(post);

      var checkSvg = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';

      var plan = (state.planes || [])[state.turnoSeleccionado] || {};
      var dias = (plan.turno && plan.turno.dias && plan.turno.dias.join(' · ')) || '';
      var hora = (plan.turno && plan.turno.textoMostrar) || '';
      var turnoFull = dias + (hora ? ' · ' + hora : '');

      var origenTxt = state.origenTitulo || state.conocioSeleccionado || '';
      if (state.conocioSeleccionado === 'otro' && elDatos.inputConocioOtro && elDatos.inputConocioOtro.value.trim()) {
        origenTxt += ' · ' + elDatos.inputConocioOtro.value.trim();
      }

      var tel = (elDatos.inputTelefono && elDatos.inputTelefono.value || '').replace(/\D/g, '');
      var telFull = tel ? ('+58 ' + tel.replace(/^0/, '')) : '';

      /* WhatsApp del partner del post activo */
      var partner = null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var k = 0; k < partners.length; k++) {
        if (partners[k].id === post.idPartner) { partner = partners[k]; break; }
      }

      var numeroInternacional = '';
      if (partner && partner.partnerJson && partner.partnerJson.whatsapp) {
        numeroInternacional = (typeof window.limpiarTelefono === 'function')
          ? window.limpiarTelefono(partner.partnerJson.whatsapp)
          : '';
      }

      var waMsg = 'Hola, acabo de reservar un cupo para ' + nombrePost +
                  '. ¿Me pueden dar más información?';
      var waHref = numeroInternacional
        ? ('https://wa.me/' + numeroInternacional + '?text=' + encodeURIComponent(waMsg))
        : '';

      function fila(k, v) {
        if (v === null || v === undefined || v === '') return '';
        return '<li>' +
          '<span class="exito-check">' + checkSvg + '</span>' +
          '<span class="exito-txt">' +
            '<span class="exito-k">' + escapeHtml(k) + '</span> ' +
            '<span class="exito-v">' + escapeHtml(v) + '</span>' +
          '</span>' +
        '</li>';
      }

      var html = '<div class="reserva-exito">';
      html += '<div class="reserva-exito-icono">🎉</div>';
      html += '<h3 class="reserva-exito-titulo">¡Felicitaciones!</h3>';
      html += '<p class="reserva-exito-sub">Hemos recibido tus datos correctamente.</p>';

      html += '<ul class="exito-lista">';
      html += fila('Publicación:', nombrePost);
      html += fila('Nombre:', (elDatos.inputNombre && elDatos.inputNombre.value || '').trim());
      html += fila('Teléfono:', telFull);
      html += fila('Correo:', (elDatos.inputCorreo && elDatos.inputCorreo.value || '').trim());
      html += fila('Horario:', turnoFull);
      html += fila('¿Cómo nos conociste?:', origenTxt);
      html += '</ul>';

      html += '<div class="exito-aviso warning">' +
                '<span class="exito-aviso-icono">⚠️</span>' +
                '<span>Tu cupo se activa al completar el pago en nuestras oficinas.</span>' +
              '</div>';

      html += '<div class="exito-nota">' +
                '<span class="exito-nota-icono">📧</span>' +
                '<span>Revisa tu correo (incluida la carpeta de spam): te enviamos las instrucciones de pago y los horarios.</span>' +
              '</div>';

      html += '<p class="exito-contacto">Para dudas o comentarios</p>';

      if (waHref) {
        html += '<a class="exito-whatsapp" href="' + waHref + '" target="_blank" rel="noopener">' +
          '<span class="exito-whatsapp-icono" data-glifo="whatsapp"></span>' +
          '<span class="exito-whatsapp-texto">Chatea con atención al cliente</span>' +
        '</a>';
      }

      html += '</div>';
      return html;
    }

    function getHTML(state, elDatos) {
      if (state.reservaCargando) return _htmlCargando(state);
      if (state.reservaError)    return _htmlError(state);
      return _htmlExito(state, elDatos);
    }

    function bind(state, el, cb) {
      var c = Sheet.getContent();
      if (!c) return;

      var btnReintentar = c.querySelector('#btnReintentarReserva');
      var btnVolver     = c.querySelector('#btnVolverFormulario');

      if (btnReintentar) {
        btnReintentar.addEventListener('click', function (e) {
          e.preventDefault();
          if (typeof cb.haptic === 'function') cb.haptic([15, 10, 15]);
          if (typeof cb.onReintentar === 'function') cb.onReintentar();
        });
      }

      if (btnVolver) {
        btnVolver.addEventListener('click', function (e) {
          e.preventDefault();
          if (typeof cb.haptic === 'function') cb.haptic([15, 10, 15]);
          if (typeof cb.onVolver === 'function') cb.onVolver();
        });
      }
    }

    return {
      getHTML: getHTML,
      bind:    bind
    };

  })();
