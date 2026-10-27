/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Reserva_Exito_Script.html
ESPEJO GITHUB:   github/js/Reserva_Exito_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Vista de confirmación. Tres modos: cargando / error / éxito.
                 Éxito: información de la reserva + aviso de que el
                 cupo se activa al pagar en oficina.
                 Título del post leído de seccionPresentacion.titulo
                 (con fallback a post.titulo del índice liviano).
VERSIÓN:         1.7.0
CAMBIOS:         R130: la línea bajo «¡Felicitaciones!» (y las de los
                 otros estados) viste .textoPrimario del Core (antes
                 .subtitulo — orden del dueño). Su centrado propio se
                 queda (Reserva_Exito_CSS).
CAMBIOS:         R129: clases maestras del Core en el DOM del éxito: títulos →
                 .titulo y subtítulos → .subtitulo (3 estados).
                 R128: el check del éxito sale del registro (data-glifo de check); muere el svg armado a mano. El CSS .exito-check svg sigue vistiendo (grosor 3).
CAMBIOS:         R114: el Plan de Estudios se simplifica — del
                 markdown solo se muestran los datos clave:
                 Inicio, Duración, Inscripción y Pago único /
                 cada Cuota (arriba la pantalla ya informa el
                 horario elegido y los datos de la reserva).
                 Sin sección: la pantalla queda como siempre.
                 Mismo bloque que viaja al correo del alumno.
                 R96: la pantalla de éxito muestra el PLAN DE
                 ESTUDIOS extraído del markdown del post activo
                 (sección "### Plan de Estudios" hasta el final).
                 R95: la pantalla de éxito lee el horario del item
                 del PLANJSON ({dias, horario, cupo}) y el título
                 directo del índice.

DEPENDENCIAS:    Reserva_Sheet_Script.html (window.Sheet),
                 Global_Script.html (window.limpiarTelefono),
                 Index.html (TABLAS), Reserva_CSS.html (clases
                 reserva-root/sheet base), Reserva_Exito_CSS.html
                 (clases reserva-exito/exito-*),
                 Reserva_Script.html (state + callbacks)
════════════════════════════════════════════════════════════════════*/








  window.ReservaExito = (function () {

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    /* Título del post · del índice liviano. */
    function tituloDelPost(post) {
      if (!post) return '';
      return String(post.titulo || '').trim();
    }

    /* ============================================================
       R114 · PLAN DE ESTUDIOS — misma extracción que hace
       03 Correo.gs para el correo: sección "### Plan de
       Estudios" hasta el final y LISTA BLANCA de datos clave
       (esDatoPlan): Inicio, Duración, Inscripción y Pago
       único / cada Cuota. El resto de líneas del markdown
       (horarios, notas) no se muestra: arriba la pantalla ya
       informa el horario elegido y los datos de la reserva.
       ============================================================ */
    function esDatoPlan(linea) {
      var t = String(linea || '').trim()
        .replace(/^[-*]\s+/, '')
        .replace(/^\*+\s*/, '');
      return /^(inicio|d[uú]raci[oó]n|inscripci[oó]n|pago|cuota)\b/i.test(t);
    }

    function extraerPlanEstudios(markdown) {
      var lineas = String(markdown == null ? '' : markdown).split(/\r?\n/);
      var inicio = -1;
      for (var i = 0; i < lineas.length; i++) {
        if (/^#{1,6}\s*plan\s*de\s*estudios/i.test(lineas[i].trim())) { inicio = i; break; }
      }
      if (inicio === -1) return [];

      var salida = [];
      for (var j = inicio + 1; j < lineas.length; j++) {
        var l = lineas[j].trim();
        if (!l) { if (salida.length) salida.push(''); continue; }
        if (/^#{1,6}\s/.test(l)) continue;
        if (!esDatoPlan(l)) continue;
        salida.push(l);
      }
      while (salida.length && !salida[salida.length - 1]) salida.pop();
      return salida;
    }

    function htmlPlanEstudios(post) {
      var pj = (post && post.postJson && post.postJson.descripcion) || {};
      var lineas = extraerPlanEstudios(pj.markdown);
      if (!lineas.length) return '';

      var items = '';
      for (var i = 0; i < lineas.length; i++) {
        var l = String(lineas[i] || '').trim().replace(/^[-*]\s+/, '');
        if (!l) continue;
        /* **negrita** del markdown → <b> (texto ya escapado por
           partes para no abrir la puerta al contenido de la hoja) */
        var partes = l.split('**');
        var pedazos = '';
        for (var k = 0; k < partes.length; k++) {
          pedazos += (k % 2 === 1) ? '<b>' + escapeHtml(partes[k]) + '</b>' : escapeHtml(partes[k]);
        }
        items += '<li>' + pedazos + '</li>';
      }
      if (!items) return '';

      return '<div class="exito-plan">' +
               '<div class="exito-plan-titulo">Plan de Estudios</div>' +
               '<ul class="exito-plan-lista">' + items + '</ul>' +
             '</div>';
    }

    /* ============================================================
       MODO CARGANDO · skeleton
       ============================================================ */
    function _htmlCargando(state) {
      var html = '<div class="reserva-exito reserva-exito-cargando">';
      html +=   '<div class="reserva-exito-icono"><span class="spinner-exito"></span></div>';
      html +=   '<h3 class="reserva-exito-titulo titulo">Procesando tu reserva</h3>';
      html +=   '<p class="reserva-exito-sub textoPrimario">Estamos confirmando tu cupo. Esto toma unos segundos.</p>';
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
      html +=   '<h3 class="reserva-exito-titulo titulo">No pudimos confirmar tu reserva</h3>';
      html +=   '<p class="reserva-exito-sub textoPrimario">' + escapeHtml(mensaje) + '</p>';
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

      /* R95 · PLANJSON: item {dias, horario, cupo} */
      var plan = (state.planes || [])[state.turnoSeleccionado] || {};
      var dias = String(plan.dias || '');
      var hora = String(plan.horario || '');
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
          '<span class="exito-check" data-glifo="check"></span>' +
          '<span class="exito-txt">' +
            '<span class="exito-k">' + escapeHtml(k) + '</span> ' +
            '<span class="exito-v">' + escapeHtml(v) + '</span>' +
          '</span>' +
        '</li>';
      }

      var html = '<div class="reserva-exito">';
      html += '<div class="reserva-exito-icono">🎉</div>';
      html += '<h3 class="reserva-exito-titulo titulo">¡Felicitaciones!</h3>';
      html += '<p class="reserva-exito-sub textoPrimario">Hemos recibido tus datos correctamente.</p>';

      html += '<ul class="exito-lista">';
      html += fila('Publicación:', nombrePost);
      html += fila('Nombre:', (elDatos.inputNombre && elDatos.inputNombre.value || '').trim());
      html += fila('Teléfono:', telFull);
      html += fila('Correo:', (elDatos.inputCorreo && elDatos.inputCorreo.value || '').trim());
      html += fila('Horario:', turnoFull);
      html += fila('¿Cómo nos conociste?:', origenTxt);
      html += '</ul>';

      /* R114 · Plan de Estudios del markdown del post (si lo
         trae): solo Inicio, Duración, Inscripción y Pagos. */
      html += htmlPlanEstudios(post);

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
