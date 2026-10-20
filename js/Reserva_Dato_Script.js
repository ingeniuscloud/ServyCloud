/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Reserva_Dato_Script.html
ESPEJO GITHUB:   github/js/Reserva_Dato_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Vista del formulario. Bloque 1 = horario.
                 Bloque 2 = nombre, teléfono, correo, OTP y
                 post-validación (conocio + privacidad).
                 OTP delegado a window.ReservaOTP.
                 Validaciones delegadas a window.ReservaValida.
                 Título del post leído de seccionPresentacion.titulo
                 (con fallback a post.titulo del índice liviano).
VERSIÓN:         1.1
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Reserva_Valida_Script.html (hard: window.ReservaValida),
                 Reserva_OTP_Script.html (hard: window.ReservaOTP),
                 Reserva_Sheet_Script.html (window.Sheet),
                 Reserva_CSS.html (clases form-*), Reserva_Script.html
                 (state + callbacks), Index.html (SISTEMA.origenes
                 vía state)
════════════════════════════════════════════════════════════════════*/

  window.ReservaDatos = (function () {

    var CHECK_SVG = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    var V = window.ReservaValida;
    if (!V) throw new Error('[ReservaDatos] window.ReservaValida no está cargado');
    if (!window.ReservaOTP) throw new Error('[ReservaDatos] window.ReservaOTP no está cargado');

    var validarNombre   = V.nombre;
    var validarTelefono = V.telefono;
    var validarCorreo   = V.correo;

    function textoCupos(cupoLibre) {
      var n = Number(cupoLibre || 0);
      if (n === 0) return 'Sin cupos';
      if (n === 1) return '1 cupo';
      return n + ' cupos';
    }

    /* Título del post · lee del post enriquecido, con fallback */
    function tituloDelPost(post) {
      if (!post) return 'esta publicación';
      var sj = post.seccionJson || {};
      var sp = sj.seccionPresentacion || {};
      var t = String(sp.titulo || '').trim();
      if (t) return t;
      t = String(post.titulo || '').trim();
      if (t) return t;
      return 'esta publicación';
    }

    function getHeaderHTML(nombrePost) {
      return '' +
        '<div class="reserva-banner" id="reservaBanner" hidden></div>' +
        '<h3 class="form-titulo">Reservar cupo</h3>' +
        '<p class="form-sub">Estás reservando <strong>' + escapeHtml(nombrePost) +
        '</strong>. Completa tus datos y un asesor te contactará.</p>';
    }

    var PENCIL_BTN =
      '<span aria-hidden="true" style="flex-shrink:0; display:flex; align-items:center; justify-content:center; ' +
        'width:34px; height:34px; border-radius:50%; ' +
        'background-color: color-mix(in srgb, var(--post-color, #1d4ed8) 12%, transparent); ' +
        'color: var(--post-color, #1d4ed8); margin-left:8px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;">' +
          '<path d="M12 20h9"/>' +
          '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
        '</svg>' +
      '</span>';

    function datosPlan(p) {
      return {
        dias:  (p.turno && p.turno.dias && p.turno.dias.join(' · ')) || '',
        hora:  (p.turno && p.turno.textoMostrar) || '',
        cupos: textoCupos(p.cupoLibre)
      };
    }

    /* ============================================================
       BLOQUE 1 · Horario
       ============================================================ */
    function getHorarioHTML(state) {
      var planes = state.planes || [];
      if (!planes.length) return '';

      var auto = (planes.length === 1);
      if (auto) state.horarioConfirmado = true;

      var confirmado = auto || !!state.horarioConfirmado;
      var idx = auto ? 0 : (state.turnoSeleccionado || 0);

      var opciones = '';
      if (!auto) {
        opciones =
          '<div id="horarioOpciones" style="display:' + (confirmado ? 'none' : 'flex') + '; ' +
               'flex-direction:column; gap:8px;">';
        planes.forEach(function (p, i) {
          var d = datosPlan(p);
          opciones +=
            '<button type="button" class="form-turno" data-turno="' + i + '"' +
              ' data-dias="' + escapeHtml(d.dias) + '"' +
              ' data-hora="' + escapeHtml(d.hora) + '"' +
              ' data-cupos="' + escapeHtml(d.cupos) + '"' +
              ' style="display:flex; flex-direction:column; gap:2px; width:100%; ' +
                     'padding:10px 12px; margin:0; ' +
                     'background:#ffffff; border:1.5px solid #e2e8f0; border-radius:10px; ' +
                     'font-family:inherit; text-align:left; cursor:pointer; ' +
                     '-webkit-tap-highlight-color:transparent;">' +
              '<span style="font-size:0.82rem; font-weight:700; line-height:1.2; color:#334155;">' +
                escapeHtml(d.dias) +
              '</span>' +
              '<span style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; ' +
                           'font-size:0.78rem; line-height:1.2; color:#64748b;">' +
                '<span>' + escapeHtml(d.hora)  + '</span>' +
                '<span>' + escapeHtml(d.cupos) + '</span>' +
              '</span>' +
            '</button>';
        });
        opciones += '</div>';
      }

      var d0 = datosPlan(planes[idx] || {});
      var resumen =
        '<button type="button" id="btnResumenHorario" ' +
          'style="width:100%; display:' + (confirmado ? 'flex' : 'none') + '; align-items:center; ' +
                 'justify-content:space-between; padding:0; background:transparent; border:none; ' +
                 'font-family:inherit; cursor:' + (auto ? 'default' : 'pointer') + '; text-align:left; ' +
                 '-webkit-tap-highlight-color:transparent;">' +
          '<div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; color:#16a34a;">' +
            '<span id="resumenHorarioDia" style="font-size:0.82rem; font-weight:700; line-height:1.2;">' +
              escapeHtml(d0.dias) +
            '</span>' +
            '<span style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; ' +
                         'font-size:0.78rem; line-height:1.2;">' +
              '<span id="resumenHorarioHora">'  + escapeHtml(d0.hora)  + '</span>' +
              '<span id="resumenHorarioCupos">' + escapeHtml(d0.cupos) + '</span>' +
            '</span>' +
          '</div>' +
          (auto ? '' : PENCIL_BTN) +
        '</button>';

      var verde  = confirmado ? 'border-color:#16a34a; background-color:#f0fdf4;' : '';
      var legend = confirmado ? ' style="color:#16a34a; background-color:#f0fdf4;"' : '';

      return '<fieldset class="form-fieldset" id="horarioFieldset" ' +
                'data-auto="' + (auto ? '1' : '0') + '" ' +
                'data-confirmado="' + (confirmado ? '1' : '0') + '" style="' + verde + '">' +
                '<legend id="horarioLegend"' + legend + '>Horario disponible</legend>' +
                opciones + resumen +
              '</fieldset>';
    }

    /* ============================================================
       HTML completo
       ============================================================ */
    function getHTML(state) {
      var post = state.postActivo || {};
      var nombrePost = tituloDelPost(post);

      var origenes = state.origenes || [];

      var html = '<div class="sheet-form">';
      html += getHeaderHTML(nombrePost);

      html += '<div id="bloqueDatos">';
      html += getHorarioHTML(state);
      html += '</div>';

      var claseRevelable = state.bloqueDatosVisible
        ? 'bloque-colapsable abierto'
        : 'bloque-colapsable';

      html += '<div class="' + claseRevelable + '" id="bloqueRevelable">';
      html +=   '<div class="bloque-inner">';

      html +=     '<div class="form-field" id="fieldNombre">' +
                    '<input type="text" id="inputNombre" placeholder=" " class="form-input" autocomplete="name">' +
                    '<label for="inputNombre" class="form-label">Nombre completo</label>' +
                    '<span class="field-check">' + CHECK_SVG + '</span>' +
                  '</div>';

      html +=     '<div class="form-field" id="fieldTelefono">' +
                    '<div class="form-input-tel">' +
                      '<span class="form-prefijo">+58</span>' +
                      '<input type="tel" id="inputTelefono" placeholder=" " autocomplete="tel" inputmode="numeric">' +
                    '</div>' +
                    '<label for="inputTelefono" class="form-label">Teléfono</label>' +
                    '<span class="field-check">' + CHECK_SVG + '</span>' +
                  '</div>';

      html +=     '<div class="form-field" id="fieldCorreo">' +
                    '<input type="email" id="inputCorreo" placeholder=" " class="form-input" ' +
                           'autocomplete="email" inputmode="email" ' +
                           'autocapitalize="off" autocorrect="off" spellcheck="false">' +
                    '<label for="inputCorreo" class="form-label">Correo electrónico</label>' +
                    '<span class="field-check">' + CHECK_SVG + '</span>' +
                    '<button type="button" id="btnEditarCorreo" aria-label="Editar correo" ' +
                      'style="display:none; position:absolute; right:12px; top:50%; transform:translateY(-50%); ' +
                             'align-items:center; justify-content:center; ' +
                             'width:34px; height:34px; border-radius:50%; border:none; padding:0; ' +
                             'background-color: color-mix(in srgb, var(--post-color, #1d4ed8) 12%, transparent); ' +
                             'color: var(--post-color, #1d4ed8); cursor:pointer; z-index:2; ' +
                             '-webkit-tap-highlight-color:transparent;">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                           'stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;">' +
                        '<path d="M12 20h9"/>' +
                        '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
                      '</svg>' +
                    '</button>' +
                  '</div>';

      html +=     '<div class="aviso-reserva-activa" id="avisoReservaActiva" ' +
                    'style="display:none; padding:14px 16px; margin-top:10px; ' +
                           'background:transparent; border:1.5px dashed #cbd5e1; border-radius:12px;"></div>';

      html +=     '<button type="button" class="btn-solicitar-codigo" id="btnSolicitarCodigo" hidden>' +
                    '📧 Solicitar código de validación' +
                  '</button>';

      html +=     '<div class="zona-otp" id="zonaOtp" hidden>' +
                    '<div class="form-field" id="fieldOtp">' +
                      '<input type="text" id="inputOtp" placeholder=" " class="form-input form-input-otp" ' +
                             'inputmode="numeric" maxlength="6" autocomplete="one-time-code">' +
                      '<label for="inputOtp" class="form-label">Código de validación</label>' +
                    '</div>' +
                    '<button type="button" class="link-reenviar" id="btnReenviar">Reenviar código</button>' +
                  '</div>';

      html +=     '<div class="bloque-post-validacion" id="bloquePostValidacion" hidden>';

      var conocioConfirmado = !!state.conocioConfirmado && !!state.conocioSeleccionado;
      var conocioSeleccionadoTitulo = '';
      if (conocioConfirmado) {
        var itemSel = null;
        for (var k = 0; k < origenes.length; k++) {
          if (origenes[k].idOrigen === state.conocioSeleccionado) { itemSel = origenes[k]; break; }
        }
        conocioSeleccionadoTitulo = itemSel ? itemSel.titulo : state.conocioSeleccionado;
      }

      var verdeC  = conocioConfirmado ? 'border-color:#16a34a; background-color:#f0fdf4;' : '';
      var legendC = conocioConfirmado ? ' style="color:#16a34a; background-color:#f0fdf4;"' : '';

      html +=       '<fieldset class="form-fieldset revelar-item" id="conocioFieldset" ' +
                      'data-confirmado="' + (conocioConfirmado ? '1' : '0') + '" ' +
                      'style="animation-delay:0ms; ' + verdeC + '">' +
                      '<legend id="conocioLegend"' + legendC + '>¿Cómo te enteraste?</legend>' +

                      '<div id="conocioOpciones" style="display:' + (conocioConfirmado ? 'none' : '') + ';">' +
                        '<div class="form-chips" id="chipsConocio">';
      origenes.forEach(function (o) {
        html += '<button type="button" class="chip-form' + (conocioConfirmado && o.idOrigen === state.conocioSeleccionado ? ' activo' : '') + '" ' +
                      'data-valor="' + escapeHtml(o.idOrigen) + '" ' +
                      'data-titulo="' + escapeHtml(o.titulo) + '">' +
                  escapeHtml(o.titulo) +
                '</button>';
      });
      html +=           '</div>' +
                      '</div>' +

                      '<button type="button" id="btnResumenConocio" ' +
                        'style="width:100%; display:' + (conocioConfirmado ? 'flex' : 'none') + '; ' +
                               'align-items:center; justify-content:space-between; ' +
                               'padding:0; background:transparent; border:none; font-family:inherit; ' +
                               'cursor:pointer; text-align:left; -webkit-tap-highlight-color:transparent;">' +
                        '<span id="resumenConocioTexto" style="flex:1; font-weight:700; line-height:1.4; ' +
                          'font-size:0.82rem; color:#16a34a;">' +
                          (conocioConfirmado ? '✓ ' + escapeHtml(conocioSeleccionadoTitulo) : '—') +
                        '</span>' +
                        PENCIL_BTN +
                      '</button>' +

                      '<div class="form-field" id="fieldConocioOtro" ' +
                        ((conocioConfirmado && state.conocioSeleccionado === 'otro') ? '' : 'hidden ') +
                        'style="margin-top:10px">' +
                        '<input type="text" id="inputConocioOtro" placeholder=" " class="form-input">' +
                        '<label for="inputConocioOtro" class="form-label">¿Cuál medio?</label>' +
                        '<span class="field-check">' + CHECK_SVG + '</span>' +
                      '</div>' +
                    '</fieldset>';

      html +=       '<div class="revelar-item" style="animation-delay:80ms">' +
                      '<div class="form-check-wrap" id="checkPrivacidadWrap">' +
                        '<label class="form-check-inner">' +
                          '<input type="checkbox" id="inputPrivacidad">' +
                          '<span class="form-check-box">' + CHECK_SVG + '</span>' +
                        '</label>' +
                        '<span class="form-check-texto">' +
                          'Acepto la ' +
                          '<button type="button" class="link-privacidad" id="linkPrivacidad">política de privacidad</button>' +
                          ' de Centro Ceicca.' +
                        '</span>' +
                      '</div>' +
                    '</div>';

      html +=       '<div class="revelar-item" style="animation-delay:160ms">' +
                      '<button type="button" class="form-submit" id="btnConfirmarReserva" disabled>' +
                        '<span class="form-submit-texto">Enviar mi registro</span>' +
                        '<span class="form-submit-flecha" data-glifo="flecha"></span>' +
                      '</button>' +
                    '</div>';

      html +=     '</div>';
      html +=   '</div>';
      html += '</div>';
      html += '</div>';

      return html;
    }

    /* ============================================================
       Bind
       ============================================================ */
    function bind(state, el, cb) {

      function revelarBloque2() {
        if (state.bloqueDatosVisible) return;
        state.bloqueDatosVisible = true;

        var wrap = Sheet.getContent().querySelector('#bloqueRevelable');
        if (!wrap) return;
        if (wrap.classList.contains('abierto')) return;

        setTimeout(function () {
          wrap.classList.add('abierto');
          setTimeout(function () {
            if (el.inputNombre && typeof el.inputNombre.scrollIntoView === 'function') {
              el.inputNombre.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 200);
        }, 150);
      }

      /* ---------- HORARIO ---------- */
      (function bindHorario() {
        var fsH = el.bloqueDatos.querySelector('#horarioFieldset');
        if (!fsH) return;

        if (fsH.getAttribute('data-auto') === '1') {
          revelarBloque2();
          return;
        }

        var optH    = fsH.querySelector('#horarioOpciones');
        var btnResH = fsH.querySelector('#btnResumenHorario');
        var legendH = fsH.querySelector('#horarioLegend');
        var rDia    = fsH.querySelector('#resumenHorarioDia');
        var rHora   = fsH.querySelector('#resumenHorarioHora');
        var rCupos  = fsH.querySelector('#resumenHorarioCupos');

        function setVerde(si) {
          fsH.setAttribute('data-confirmado', si ? '1' : '0');
          fsH.style.borderColor     = si ? '#16a34a' : '';
          fsH.style.backgroundColor = si ? '#f0fdf4' : '';
          legendH.style.color           = si ? '#16a34a' : '';
          legendH.style.backgroundColor = si ? '#f0fdf4' : '';
        }

        fsH.querySelectorAll('.form-turno').forEach(function (btn) {
          btn.addEventListener('click', function () {
            cb.haptic(8);
            state.turnoSeleccionado = parseInt(this.getAttribute('data-turno'), 10) || 0;
            state.horarioConfirmado = true;
            rDia.textContent   = this.getAttribute('data-dias');
            rHora.textContent  = this.getAttribute('data-hora');
            rCupos.textContent = this.getAttribute('data-cupos');
            optH.style.display    = 'none';
            btnResH.style.display = 'flex';
            setVerde(true);
            actualizarEstadoFormulario();
            revelarBloque2();
          });
        });

        if (btnResH) {
          btnResH.addEventListener('click', function () {
            cb.haptic(8);
            state.horarioConfirmado = false;
            optH.style.display    = 'flex';
            btnResH.style.display = 'none';
            setVerde(false);
            actualizarEstadoFormulario();
          });
        }
      })();

      /* ---------- CAMPOS DEL BLOQUE 2 ---------- */

      el.inputNombre.addEventListener('input', function () {
        var limpio = V.limpiarNombre(this.value);
        if (limpio !== this.value) this.value = limpio;
        var v = this.value;
        el.fieldNombre.classList.toggle('activo', v.length > 0 || document.activeElement === this);
        var ok = validarNombre(v);
        el.fieldNombre.classList.toggle('validado', ok);
        el.fieldNombre.classList.remove('invalido');
        actualizarEstadoFormulario();
      });
      el.inputNombre.addEventListener('focus', function () { el.fieldNombre.classList.add('activo'); });
      el.inputNombre.addEventListener('blur', function () { if (!this.value) el.fieldNombre.classList.remove('activo'); });

      el.inputTelefono.addEventListener('input', function () {
        var limpio = V.limpiarTelefono(this.value);
        if (limpio !== this.value) this.value = limpio;
        var v = this.value;
        el.fieldTelefono.classList.toggle('activo', v.length > 0 || document.activeElement === this);
        var ok = validarTelefono(v);
        el.fieldTelefono.classList.toggle('validado', ok);
        el.fieldTelefono.classList.remove('invalido');
        actualizarEstadoFormulario();
      });
      el.inputTelefono.addEventListener('focus', function () { el.fieldTelefono.classList.add('activo'); });
      el.inputTelefono.addEventListener('blur', function () { if (!this.value) el.fieldTelefono.classList.remove('activo'); });

      /* Correo */
      el.inputCorreo.addEventListener('input', function () {
        if (state.correoValidado) return;
        var v = this.value;

        if (el.avisoReservaActiva) {
          el.avisoReservaActiva.style.display = 'none';
          el.avisoReservaActiva.innerHTML = '';
        }

        if (state.otpEnviado) {
          window.ReservaOTP.reset(state, el);
        }

        el.fieldCorreo.classList.toggle('activo', v.length > 0 || document.activeElement === this);
        var ok = validarCorreo(v);
        el.fieldCorreo.classList.remove('validado', 'invalido');
        el.btnSolicitar.hidden = !ok;
        if (v.length > 0) el.fieldCorreo.classList.add('activo');

        actualizarEstadoFormulario();
      });
      el.inputCorreo.addEventListener('focus', function () { el.fieldCorreo.classList.add('activo'); });
      el.inputCorreo.addEventListener('blur', function () { if (!this.value) el.fieldCorreo.classList.remove('activo'); });

      /* Botón lápiz del correo */
      if (el.btnEditarCorreo) {
        el.btnEditarCorreo.addEventListener('click', function (e) {
          e.preventDefault();
          if (state.correoValidado) return;
          cb.haptic(10);

          window.ReservaOTP.reset(state, el);

          if (el.avisoReservaActiva) {
            el.avisoReservaActiva.style.display = 'none';
            el.avisoReservaActiva.innerHTML = '';
          }

          el.inputCorreo.readOnly = false;
          var okCorreo = validarCorreo((el.inputCorreo.value || '').trim());
          el.btnSolicitar.hidden = !okCorreo;

          actualizarEstadoFormulario();

          setTimeout(function () {
            if (typeof el.inputCorreo.focus === 'function') el.inputCorreo.focus();
          }, 80);
        });
      }

      window.ReservaOTP.init(state, el, {
        haptic:           cb.haptic,
        banner:           cb.banner,
        onEstadoCambiado: actualizarEstadoFormulario
      });

      /* ---------- ¿Cómo te enteraste? ---------- */
      (function bindConocio() {
        var fsC       = Sheet.getContent().querySelector('#conocioFieldset');
        if (!fsC) return;

        var optC      = fsC.querySelector('#conocioOpciones');
        var btnResC   = fsC.querySelector('#btnResumenConocio');
        var legendC   = fsC.querySelector('#conocioLegend');
        var resumenC  = fsC.querySelector('#resumenConocioTexto');
        var chips     = fsC.querySelectorAll('.chip-form');

        function setVerde(si) {
          fsC.setAttribute('data-confirmado', si ? '1' : '0');
          fsC.style.borderColor     = si ? '#16a34a' : '';
          fsC.style.backgroundColor = si ? '#f0fdf4' : '';
          legendC.style.color           = si ? '#16a34a' : '';
          legendC.style.backgroundColor = si ? '#f0fdf4' : '';
        }

        function confirmar(valor, titulo) {
          state.conocioSeleccionado = valor;
          state.conocioConfirmado   = true;
          resumenC.textContent = '✓ ' + titulo;
          optC.style.display = 'none';
          btnResC.style.display = 'flex';
          setVerde(true);

          var item = cb.getOrigenPorId(valor);
          if (item && item.requiereTexto) {
            el.fieldConocioOtro.hidden = false;
            setTimeout(function () {
              if (el.inputConocioOtro) el.inputConocioOtro.focus();
            }, 80);
          } else {
            el.fieldConocioOtro.hidden = true;
            el.inputConocioOtro.value = '';
            el.fieldConocioOtro.classList.remove('activo', 'validado');
          }
          actualizarEstadoFormulario();
        }

        function reabrir() {
          state.conocioConfirmado = false;
          optC.style.display = '';
          btnResC.style.display = 'none';
          setVerde(false);

          var item = cb.getOrigenPorId(state.conocioSeleccionado);
          if (item && item.requiereTexto) {
            el.fieldConocioOtro.hidden = false;
          } else {
            el.fieldConocioOtro.hidden = true;
          }
          actualizarEstadoFormulario();
        }

        chips.forEach(function (chip) {
          chip.addEventListener('click', function () {
            cb.haptic(8);
            chips.forEach(function (c) { c.classList.remove('activo'); });
            this.classList.add('activo');
            var valor  = this.getAttribute('data-valor');
            var titulo = this.getAttribute('data-titulo') || this.textContent.trim();
            confirmar(valor, titulo);
          });
        });

        btnResC.addEventListener('click', function () {
          cb.haptic(8);
          reabrir();
        });

        if (state.conocioConfirmado && state.conocioSeleccionado) {
          var itemPrev = cb.getOrigenPorId(state.conocioSeleccionado);
          chips.forEach(function (c) {
            if (c.getAttribute('data-valor') === state.conocioSeleccionado) {
              c.classList.add('activo');
            }
          });
          confirmar(state.conocioSeleccionado, itemPrev ? itemPrev.titulo : state.conocioSeleccionado);
        }
      })();

      el.inputConocioOtro.addEventListener('input', function () {
        var v = this.value;
        el.fieldConocioOtro.classList.toggle('activo', v.length > 0 || document.activeElement === this);
        el.fieldConocioOtro.classList.toggle('validado', v.trim().length > 0);
        actualizarEstadoFormulario();
      });
      el.inputConocioOtro.addEventListener('focus', function () { el.fieldConocioOtro.classList.add('activo'); });
      el.inputConocioOtro.addEventListener('blur', function () { if (!this.value) el.fieldConocioOtro.classList.remove('activo'); });

      el.inputPrivacidad.addEventListener('change', function () {
        cb.haptic(6);
        if (this.checked) el.checkPrivacidadWrap.classList.remove('error');
        actualizarEstadoFormulario();
      });

      el.linkPrivacidad.addEventListener('click', function (e) {
        e.preventDefault();
        cb.mostrarPrivacidad();
      });

      el.btnConfirmar.addEventListener('click', cb.onEnviar);

      /* ---------- Validación del formulario ---------- */
      function actualizarEstadoFormulario() {
        if (!el.btnConfirmar) return;

        var ok = validarNombre(el.inputNombre.value)
              && validarTelefono(el.inputTelefono.value)
              && state.correoValidado
              && !!state.horarioConfirmado
              && !!state.conocioSeleccionado
              && el.inputPrivacidad.checked;

        if (state.conocioSeleccionado === 'otro') {
          if (!el.inputConocioOtro.value.trim()) ok = false;
        }

        el.btnConfirmar.disabled = !ok;

        if (el.btnEditarCorreo) {
          var correoOk = validarCorreo((el.inputCorreo.value || '').trim());
          var debeVerLapiz = !state.correoValidado && correoOk && state.otpEnviado;
          el.btnEditarCorreo.style.display = debeVerLapiz ? 'flex' : 'none';
        }

        if (el.btnSolicitar) {
          var cOk = validarCorreo((el.inputCorreo.value || '').trim());
          var hayAvisoC = el.avisoReservaActiva && el.avisoReservaActiva.style.display !== 'none';
          var ocultar   = state.otpEnviado || state.correoValidado || hayAvisoC;
          el.btnSolicitar.hidden = !cOk || ocultar;
        }
      }
    }

    return {
      getHTML: getHTML,
      bind:    bind
    };

  })();