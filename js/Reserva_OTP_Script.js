/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Reserva_OTP_Script.html
ESPEJO GITHUB:   github/js/Reserva_OTP_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Lógica de solicitud, reenvío y verificación del
                 código OTP enviado por el backend (OTP.gs).
                 El aviso de reserva activa muestra nombre y post
                 de la reserva que causó el conflicto.
VERSIÓN:         1.2
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Global_Script.html (postBackend, limpiarTelefono),
                 Reserva_Valida_Script.html (window.ReservaValida),
                 Index.html (TABLAS), Iconos.html (pintarGlifos),
                 Reserva_CSS.html (clases zona-otp/link-reenviar)
════════════════════════════════════════════════════════════════════*/

  window.ReservaOTP = (function () {

    var OTP_COOLDOWN_MS      = 60 * 1000;
    var TEXTO_BTN_SOLICITAR  = '📧 Solicitar código de validación';
    var cooldownTimer        = null;

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function init(state, el, cb) {
      if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }

      var inputCorreo  = el.inputCorreo;
      var fieldCorreo  = el.fieldCorreo;
      var btnSolicitar = el.btnSolicitar;
      var btnReenviar  = el.btnReenviar;
      var zonaOtp      = el.zonaOtp;
      var inputOtp     = el.inputOtp;
      var fieldOtp     = el.fieldOtp;
      var bloquePost   = el.bloquePost;

      if (state.otpEnviado) {
        actualizarTextoReenviar();
        if (state.otpCooldownHasta > Date.now()) {
          cooldownTimer = setInterval(tickCooldown, 250);
        }
      }

      btnSolicitar.addEventListener('click', solicitarCodigo);
      btnReenviar.addEventListener('click', reenviarCodigo);

      inputOtp.addEventListener('input', function () {
        var limpio = window.ReservaValida.limpiarOtp(this.value);
        if (limpio !== this.value) this.value = limpio;
        fieldOtp.classList.remove('invalido');
        fieldOtp.classList.toggle('activo', this.value.length > 0 || document.activeElement === this);
        if (window.ReservaValida.otp(this.value)) verificarOtp();
      });
      inputOtp.addEventListener('focus', function () { fieldOtp.classList.add('activo'); });
      inputOtp.addEventListener('blur', function () { if (!this.value) fieldOtp.classList.remove('activo'); });

      function correoActual() {
        return (inputCorreo.value || '').trim().toLowerCase();
      }

      function datosIntento() {
        return {
          nombre:      (el.inputNombre   && el.inputNombre.value || '').trim(),
          telefono:    (el.inputTelefono && el.inputTelefono.value || '').replace(/\D/g, ''),
          idPostActual: (state.postActivo && state.postActivo.id) ? state.postActivo.id : ''
        };
      }

      function iniciarCooldown() {
        if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
        actualizarTextoReenviar();
        cooldownTimer = setInterval(tickCooldown, 250);
      }

      function tickCooldown() {
        var restante = state.otpCooldownHasta - Date.now();
        if (restante <= 0) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
          btnReenviar.disabled = false;
          btnReenviar.textContent = 'Reenviar código';
          return;
        }
        btnReenviar.textContent = 'Reenviar en ' + Math.ceil(restante / 1000) + 's';
      }

      function actualizarTextoReenviar() {
        var restante = state.otpCooldownHasta - Date.now();
        if (restante > 0) {
          btnReenviar.disabled = true;
          btnReenviar.textContent = 'Reenviar en ' + Math.ceil(restante / 1000) + 's';
        } else {
          btnReenviar.disabled = false;
          btnReenviar.textContent = 'Reenviar código';
        }
      }

      function mostrarBloqueoReservaActiva(idReserva, nombreAlumno, postTitulo) {
        cb.haptic([30, 20, 30]);

        btnSolicitar.hidden = true;
        btnSolicitar.disabled = false;
        btnSolicitar.textContent = TEXTO_BTN_SOLICITAR;

        if (!el.avisoReservaActiva) {
          if (typeof cb.onEstadoCambiado === 'function') cb.onEstadoCambiado();
          return;
        }

        var nombre = String(nombreAlumno || '').trim();
        var post   = String(postTitulo  || '').trim();
        var lineaContexto = (nombre || post)
          ? (escapeHtml(nombre || '—') + ' · ' + escapeHtml(post || '—'))
          : '';

        /* WhatsApp del partner del post activo */
        var partner = null;
        var partners = (window.TABLAS && window.TABLAS.partners) || [];
        var idPartner = state.postActivo ? state.postActivo.idPartner : null;
        for (var i = 0; i < partners.length; i++) {
          if (partners[i].id === idPartner) { partner = partners[i]; break; }
        }

        var numero = '';
        if (partner && partner.partnerJson && partner.partnerJson.whatsapp) {
          numero = (typeof window.limpiarTelefono === 'function')
            ? window.limpiarTelefono(partner.partnerJson.whatsapp)
            : '';
        }

        var waMsg = 'Hola, tengo una reserva activa (' + idReserva + ') y necesito ayuda.';
        var waHref = numero
          ? ('https://wa.me/' + numero + '?text=' + encodeURIComponent(waMsg))
          : '';

        el.avisoReservaActiva.innerHTML =
          '<div style="font-size:0.82rem; font-weight:700; line-height:1.4; color:#334155; margin-bottom:6px;">' +
            'Ese correo ya tiene una reserva activa' +
          '</div>' +
          (lineaContexto
            ? '<div style="font-size:0.75rem; font-weight:600; color:#64748b; letter-spacing:0.01em; margin-bottom:10px;">' +
                lineaContexto +
              '</div>'
            : '') +
          '<div style="font-size:0.78rem; line-height:1.45; color:#64748b; margin-bottom:12px;">' +
            'Cámbialo o contáctanos para ayudarte' +
          '</div>' +
          (waHref
            ? '<a class="exito-whatsapp" href="' + waHref + '" target="_blank" rel="noopener">' +
                '<span class="exito-whatsapp-icono" data-glifo="whatsapp"></span>' +
                '<span class="exito-whatsapp-texto">Chatea con atención al cliente</span>' +
              '</a>'
            : '');

        el.avisoReservaActiva.style.display = 'block';

        if (typeof window.pintarGlifos === 'function') {
          window.pintarGlifos(el.avisoReservaActiva);
        }

        if (typeof el.avisoReservaActiva.scrollIntoView === 'function') {
          el.avisoReservaActiva.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (typeof cb.onEstadoCambiado === 'function') cb.onEstadoCambiado();
      }

      function solicitarCodigo() {
        var correo = correoActual();
        if (!window.ReservaValida.correo(correo)) return;

        btnSolicitar.disabled = true;
        btnSolicitar.textContent = 'Enviando código…';

        var payload = Object.assign({ correo: correo }, datosIntento());

        postBackend('otpSolicitar', payload)
          .then(function (data) {
            if (data && data.bloqueado && data.motivo === 'RESERVA_ACTIVA') {
              mostrarBloqueoReservaActiva(
                data.idReserva || '—',
                data.nombreAlumno || '',
                data.postTitulo || ''
              );
              return;
            }

            cb.haptic([15, 10, 15]);
            state.otpEnviado = true;
            state.otpCooldownHasta = Date.now() + OTP_COOLDOWN_MS;

            /* GA4 (R12): solicitud de código exitosa */
            if (window.Analitica) {
              window.Analitica.enviar('otp_request', {
                post_id: window.Analitica.idPostActivo()
              });
            }

            btnSolicitar.hidden = true;
            btnSolicitar.disabled = false;
            btnSolicitar.textContent = TEXTO_BTN_SOLICITAR;

            zonaOtp.hidden = false;
            zonaOtp.classList.remove('saliendo');
            zonaOtp.classList.add('revelando');

            inputCorreo.readOnly = true;

            setTimeout(function () { inputOtp.focus(); }, 120);
            iniciarCooldown();
            cb.onEstadoCambiado();
          })
          .catch(function (err) {
            btnSolicitar.disabled = false;
            btnSolicitar.textContent = TEXTO_BTN_SOLICITAR;
            var msg = err.message || '';
            if (msg.indexOf('RATE_LIMIT') === 0) {
              cb.banner('Demasiadas solicitudes. Intenta en unos minutos.', 'error');
            } else if (msg === 'CORREO_NO_ENVIADO') {
              cb.banner('No se pudo enviar el correo. Verifica la dirección.', 'error');
            } else {
              cb.banner('No se pudo enviar el código. Intenta de nuevo.', 'error');
            }
            cb.haptic([30, 20, 30]);
          });
      }

      function reenviarCodigo() {
        if (btnReenviar.disabled) return;
        var correo = correoActual();
        if (!window.ReservaValida.correo(correo)) return;

        btnReenviar.disabled = true;
        btnReenviar.textContent = 'Enviando…';

        var payload = Object.assign({ correo: correo }, datosIntento());

        postBackend('otpSolicitar', payload)
          .then(function (data) {
            if (data && data.bloqueado && data.motivo === 'RESERVA_ACTIVA') {
              btnReenviar.disabled = false;
              btnReenviar.textContent = 'Reenviar código';
              mostrarBloqueoReservaActiva(
                data.idReserva || '—',
                data.nombreAlumno || '',
                data.postTitulo || ''
              );
              return;
            }

            cb.haptic([15, 10, 15]);
            state.otpEnviado = true;
            state.otpCooldownHasta = Date.now() + OTP_COOLDOWN_MS;

            /* GA4 (R12): reenvío de código exitoso */
            if (window.Analitica) {
              window.Analitica.enviar('otp_request', {
                post_id: window.Analitica.idPostActivo()
              });
            }

            inputOtp.value = '';
            fieldOtp.classList.remove('activo', 'validado', 'invalido');
            iniciarCooldown();
            inputOtp.focus();
          })
          .catch(function (err) {
            var msg = err.message || '';
            if (msg.indexOf('RATE_LIMIT') === 0) {
              cb.banner('Demasiadas solicitudes. Intenta en unos minutos.', 'error');
            } else {
              cb.banner('No se pudo reenviar el código. Intenta de nuevo.', 'error');
            }
            btnReenviar.disabled = false;
            btnReenviar.textContent = 'Reenviar código';
            cb.haptic([30, 20, 30]);
          });
      }

      function verificarOtp() {
        if (state.correoValidado) return;
        if (!state.otpEnviado) return;
        var correo = correoActual();
        var codigo = inputOtp.value.trim();
        if (!window.ReservaValida.otp(codigo)) return;

        inputOtp.readOnly = true;
        fieldOtp.classList.remove('invalido');

        postBackend('otpVerificar', { correo: correo, codigo: codigo })
          .then(function () {
            state.correoValidado = true;
            fieldOtp.classList.add('validado');
            fieldCorreo.classList.add('validado');
            fieldOtp.classList.remove('invalido');
            inputCorreo.readOnly = true;
            inputOtp.readOnly = true;
            cb.haptic([15, 10, 15]);

            if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }

            zonaOtp.classList.add('saliendo');
            setTimeout(function () {
              zonaOtp.hidden = true;
              bloquePost.hidden = false;
              bloquePost.classList.add('revelando');
              bloquePost.scrollIntoView({ behavior: 'smooth', block: 'start' });
              cb.onEstadoCambiado();
              if (typeof cb.onVerificado === 'function') cb.onVerificado();
            }, 180);
          })
          .catch(function (err) {
            inputOtp.readOnly = false;
            fieldOtp.classList.add('invalido');
            var msg = err.message || '';

            if (msg === 'OTP_EXPIRADO') {
              cb.banner('El código expiró. Solicita uno nuevo.', 'error');
              reset(state, el);
            } else if (msg === 'OTP_INTENTOS_AGOTADOS') {
              cb.banner('Demasiados intentos. Solicita un código nuevo.', 'error');
              reset(state, el);
            } else {
              cb.banner('Código incorrecto', 'error');
              inputOtp.value = '';
              inputOtp.focus();
            }
            cb.haptic([30, 20, 30]);
          });
      }
    }

    function reset(state, el) {
      if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }

      state.otpEnviado       = false;
      state.otpCooldownHasta = 0;

      if (el.zonaOtp) el.zonaOtp.hidden = true;
      if (el.inputOtp) {
        el.inputOtp.value = '';
        el.inputOtp.readOnly = false;
      }
      if (el.fieldOtp) el.fieldOtp.classList.remove('activo', 'validado', 'invalido');
      if (el.inputCorreo) el.inputCorreo.readOnly = false;
      if (el.btnReenviar) {
        el.btnReenviar.disabled = false;
        el.btnReenviar.textContent = 'Reenviar código';
      }
      if (el.btnSolicitar) {
        var okCorreo = window.ReservaValida.correo((el.inputCorreo.value || '').trim());
        el.btnSolicitar.hidden = !okCorreo;
        el.btnSolicitar.disabled = false;
        el.btnSolicitar.textContent = TEXTO_BTN_SOLICITAR;
      }
      if (el.avisoReservaActiva) {
        el.avisoReservaActiva.style.display = 'none';
        el.avisoReservaActiva.innerHTML = '';
      }
    }

    return {
      init:  init,
      reset: reset
    };

  })();