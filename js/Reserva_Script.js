/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Reserva_Script.html
ESPEJO GITHUB:   github/js/Reserva_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Orquestador de la reserva: abre el sheet, envía la reserva, pinta cada mensaje DEBAJO de su campo (errorCampo/errorFlujo/limpiarErrores) y maneja el reintento.
VERSIÓN:         1.5.0
CAMBIOS:         R135: los selectores de error siguen la clase renombrada .errorForm (antes .form-error; mismos valores, cero efecto visual). Historial: bitácora/versiones.
DEPENDENCIAS:    Reserva_Sheet_Script.html (window.Sheet),
                 Reserva_Dato_Script.html (window.ReservaDatos),
                 Reserva_Valida_Script.html (window.ReservaValida),
                 Reserva_Exito_Script.html (window.ReservaExito),
                 Global_Script.html (postBackend, getDeviceId,
                 Global.getLegalHTML), Lista_Script.html
                 (window.Lista), Index.html (SISTEMA.origenes),
                 Iconos.html (pintarGlifos), Reserva_CSS.html
════════════════════════════════════════════════════════════════════*/


  window.Reserva = (function () {

    var state = {
      postActivo:          null,
      origenes:            [],
      planes:              [],
      conocioSeleccionado: null,
      conocioConfirmado:   false,
      turnoSeleccionado:   0,
      horarioConfirmado:   false,
      bloqueDatosVisible:  false,
      otpEnviado:          false,
      otpCooldownHasta:    0,
      correoValidado:      false,
      origenTitulo:        '',
      reservaCargando:     false,
      reservaError:        '',
      reservaErrorTexto:   '',
      reservaIdReserva:    '',
      payloadUltimo:       null,
      formSnapshot:        null
    };

    var el = {};

    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function getPostActivo() {
      if (state.postActivo && state.postActivo.id) return state.postActivo;
      if (window.Lista && typeof window.Lista.getPostActivo === 'function') {
        return window.Lista.getPostActivo();
      }
      return null;
    }

    function getOrigenesActivos() {
      return ((window.SISTEMA && window.SISTEMA.origenes) || []).filter(function (o) {
        return o.estado !== false;
      });
    }
    function getOrigenPorId(id) {
      var arr = getOrigenesActivos();
      for (var i = 0; i < arr.length; i++) if (arr[i].idOrigen === id) return arr[i];
      return null;
    }
    /* R95 · PLANJSON NUEVO: el detalle llega como ARRAY directo
       [{dias, horario, cupo}] (ya no {planes:[...]} con idTurno).
       Solo cambia de dónde se lee; la pintada es intacta. */
    function getPlanes() {
      var post = getPostActivo();
      if (!post || !Array.isArray(post.planJson)) return [];
      return post.planJson;
    }
    function getTurnoPorIndice(i) {
      return (getPlanes())[i] || null;
    }

    /* ============================================================
       ERRORES POR CAMPO (R131) · MUERE el banner superior: cada
       mensaje se pinta DEBAJO de su campo (orden del dueño). Sin
       temporizador: el mensaje vive hasta que el campo cambie o
       se reintente. errorFlujo = mensajes sin campo (bajo la
       cabecera del sheet).
       ============================================================ */
    function errorCampo(fieldEl, texto) {
      if (!fieldEl) return;
      var slot = (fieldEl.classList && fieldEl.classList.contains('errorForm'))
        ? fieldEl
        : fieldEl.querySelector('.errorForm');
      if (!slot) return;
      slot.textContent = texto || '';
      slot.hidden = !texto;
    }

    function errorFlujo(texto) {
      var content = Sheet.getContent();
      if (!content) return;
      var f = content.querySelector('#errorFlujo');
      if (!f) return;
      f.textContent = texto || '';
      f.hidden = !texto;
    }

    function limpiarErrores() {
      var content = Sheet.getContent();
      if (!content) return;
      content.querySelectorAll('.errorForm').forEach(function (s) {
        s.hidden = true;
        s.textContent = '';
      });
    }

    function recogerEl() {
      var c = Sheet.getContent();
      if (!c) return;
      el = {
        errorFlujo:           c.querySelector('#errorFlujo'),
        horarioFieldset:      c.querySelector('#horarioFieldset'),
        bloqueDatos:          c.querySelector('#bloqueDatos'),
        inputNombre:          c.querySelector('#inputNombre'),
        fieldNombre:          c.querySelector('#fieldNombre'),
        inputTelefono:        c.querySelector('#inputTelefono'),
        fieldTelefono:        c.querySelector('#fieldTelefono'),
        inputCorreo:          c.querySelector('#inputCorreo'),
        fieldCorreo:          c.querySelector('#fieldCorreo'),
        avisoReservaActiva:   c.querySelector('#avisoReservaActiva'),
        btnEditarCorreo:      c.querySelector('#btnEditarCorreo'),
        inputOtp:             c.querySelector('#inputOtp'),
        fieldOtp:             c.querySelector('#fieldOtp'),
        btnSolicitar:         c.querySelector('#btnSolicitarCodigo'),
        errorSolicitar:       c.querySelector('#errorSolicitar'),
        btnReenviar:          c.querySelector('#btnReenviar'),
        errorReenviar:        c.querySelector('#errorReenviar'),
        zonaOtp:              c.querySelector('#zonaOtp'),
        bloquePost:           c.querySelector('#bloquePostValidacion'),
        chipsConocio:         c.querySelector('#chipsConocio'),
        fieldConocioOtro:     c.querySelector('#fieldConocioOtro'),
        inputConocioOtro:     c.querySelector('#inputConocioOtro'),
        inputPrivacidad:      c.querySelector('#inputPrivacidad'),
        checkPrivacidadWrap:  c.querySelector('#checkPrivacidadWrap'),
        btnConfirmar:         c.querySelector('#btnConfirmarReserva'),
        linkPrivacidad:       c.querySelector('#linkPrivacidad')
      };
    }

    function mostrarDatos() {
      Sheet.setContent(window.ReservaDatos.getHTML(state));
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(Sheet.getContent());
      recogerEl();

      window.ReservaDatos.bind(state, el, {
        haptic:              haptic,
        errorCampo:          errorCampo,
        onEnviar:            onEnviar,
        mostrarPrivacidad:   mostrarPrivacidad,
        getOrigenPorId:      getOrigenPorId
      });

      if (state.formSnapshot) {
        repoblarFormulario(state.formSnapshot);
      }

      Sheet.ocultarVolver();
      Sheet.desactivarGradientePrivacidad();
    }

    function repoblarFormulario(snap) {
      var V = window.ReservaValida;

      if (snap.nombre) {
        el.inputNombre.value = snap.nombre;
        el.fieldNombre.classList.add('activo');
        if (V.nombre(snap.nombre)) el.fieldNombre.classList.add('validado');
      }
      if (snap.telefono) {
        el.inputTelefono.value = snap.telefono;
        el.fieldTelefono.classList.add('activo');
        if (V.telefono(snap.telefono)) el.fieldTelefono.classList.add('validado');
      }
      if (snap.correo) {
        el.inputCorreo.value = snap.correo;
        el.fieldCorreo.classList.add('activo');
        if (state.correoValidado) {
          el.fieldCorreo.classList.add('validado');
          el.inputCorreo.readOnly = true;
        }
      }
      if (state.correoValidado) {
        el.zonaOtp.hidden = true;
        el.bloquePost.hidden = false;
        el.bloquePost.classList.add('revelando');
      }
      if (snap.conocioOtro) {
        el.fieldConocioOtro.hidden = false;
        el.inputConocioOtro.value = snap.conocioOtro;
        el.fieldConocioOtro.classList.add('activo', 'validado');
      }
      if (snap.privacidadChecked) {
        el.inputPrivacidad.checked = true;
      }

      el.inputNombre.dispatchEvent(new Event('input', { bubbles: true }));
      el.inputTelefono.dispatchEvent(new Event('input', { bubbles: true }));
      el.inputCorreo.dispatchEvent(new Event('input', { bubbles: true }));
      el.inputConocioOtro.dispatchEvent(new Event('input', { bubbles: true }));
      el.inputPrivacidad.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function mostrarExito() {
      var origenItem = getOrigenPorId(state.conocioSeleccionado);
      state.origenTitulo = origenItem ? origenItem.titulo : state.conocioSeleccionado;

      Sheet.setContent(window.ReservaExito.getHTML(state, el));
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(Sheet.getContent());

      window.ReservaExito.bind(state, el, {
        haptic:       haptic,
        onReintentar: onEnviar,
        onVolver:     volverAlFormulario
      });

      Sheet.ocultarVolver();
      Sheet.desactivarGradientePrivacidad();
    }

    function volverAlFormulario() {
      state.reservaError = '';
      state.reservaErrorTexto = '';
      state.reservaIdReserva = '';

      mostrarDatos();
    }

    function mostrarPrivacidad() {
      var getLegal = (window.Global && typeof window.Global.getLegalHTML === 'function')
        ? window.Global.getLegalHTML : null;
      if (!getLegal) { errorCampo(el.checkPrivacidadWrap, 'No se pudo cargar la política de privacidad'); return; }

      var content = Sheet.getContent();
      var formWrap = content.querySelector('.sheet-form');
      var existing = content.querySelector('.reserva-legal-wrap');
      if (existing) existing.remove();

      var wrapper = document.createElement('div');
      wrapper.className = 'reserva-legal-wrap';
      wrapper.innerHTML = getLegal('privacidad');

      if (formWrap) formWrap.hidden = true;
      content.appendChild(wrapper);
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(wrapper);
      content.scrollTop = 0;

      Sheet.mostrarVolver();
      Sheet.activarGradientePrivacidad();
    }

    function onVolverClick() {
      var content = Sheet.getContent();
      if (!content) return;
      var legalWrap = content.querySelector('.reserva-legal-wrap');
      if (!legalWrap) return;
      var formWrap = content.querySelector('.sheet-form');
      legalWrap.remove();
      if (formWrap) formWrap.hidden = false;
      content.scrollTop = 0;
      Sheet.ocultarVolver();
      Sheet.desactivarGradientePrivacidad();
    }

    /* ============================================================
       ENVÍO
       ============================================================ */
    function onEnviar() {
      limpiarErrores();

      if (state.reservaError) {
        if (!state.payloadUltimo) {
          errorFlujo('No hay datos para reintentar. Vuelve al formulario.');
          return;
        }
        ejecutarEnvio(state.payloadUltimo);
        return;
      }

      var post = getPostActivo();
      if (!post) { errorFlujo('No hay publicación activa'); return; }

      var plan = getTurnoPorIndice(state.turnoSeleccionado);
      if (!plan || !plan.dias || !plan.horario) { errorCampo(el.horarioFieldset, 'Selecciona un horario válido'); return; }

      state.formSnapshot = {
        nombre:            (el.inputNombre.value || '').trim(),
        telefono:          (el.inputTelefono.value || '').replace(/\D/g, ''),
        correo:            (el.inputCorreo.value || '').trim(),
        conocidoOtro:      (el.inputConocioOtro.value || '').trim(),
        privacidadChecked: !!el.inputPrivacidad.checked
      };

      var contactoParaEnviar = state.conocioSeleccionado;
      if (state.conocioSeleccionado === 'otro') {
        var detalle = state.formSnapshot.conocidoOtro;
        if (detalle) contactoParaEnviar = 'otro: ' + detalle;
      }

      var payload = {
        /* R95 · POST COMPUESTO NUEVO (formato confirmado por el
           dueño): código + _ + dias + _ + horario, todo separado
           con guion bajo. Ej:
           EXCEL-001_Lunes a Jueves_5:30 pm a 6:25 pm */
        post: post.id + '_' + plan.dias + '_' + plan.horario,
        correo: state.formSnapshot.correo,
        contactoIni: contactoParaEnviar,
        alumnoJson: {
          nombre:   state.formSnapshot.nombre,
          telefono: state.formSnapshot.telefono
        }
      };

      try {
        localStorage.setItem('academy_user', JSON.stringify({
          uid: (typeof getDeviceId === 'function') ? getDeviceId() : '',
          nombre: payload.alumnoJson.nombre
        }));
      } catch (_) {}

      state.payloadUltimo = payload;
      ejecutarEnvio(payload);
    }

    function ejecutarEnvio(payload) {
      state.reservaCargando = true;
      state.reservaError = '';
      state.reservaErrorTexto = '';

      mostrarExito();

      postBackend('reserva', payload)
        .then(function (data) {
          haptic([30, 20, 30]);
          state.reservaCargando = false;
          state.reservaIdReserva = (data && data.idReserva) || '';
          mostrarExito();
        })
        .catch(function (err) {
          var msg = err.message || '';
          haptic([30, 20, 30]);
          state.reservaCargando = false;
          state.reservaError = msg;

          if (msg === 'RESERVA_ACTIVA') {
            state.reservaErrorTexto = 'Ese correo ya tiene una reserva activa.';
          } else if (msg === 'SIN_CUPOS') {
            state.reservaErrorTexto = 'Cupos agotados. Elige otro horario.';
          } else if (msg.indexOf('RATE_LIMIT') === 0) {
            state.reservaErrorTexto = 'Demasiadas reservas seguidas. Intenta en unos minutos.';
          } else {
            state.reservaErrorTexto = 'No se pudo procesar tu reserva. Intenta de nuevo.';
          }

          mostrarExito();
          console.error('[Reserva] Error:', msg);
        });
    }

    /* ============================================================
       Abrir
       ============================================================ */
    function abrir() {
      state.postActivo = getPostActivo();
      if (!state.postActivo) return;

      /* GA4 (R12): apertura del flujo de reserva */
      if (window.Analitica) {
        window.Analitica.enviar('reserva_start', {
          post_id: state.postActivo.id || ''
        });
      }

      state.origenes = getOrigenesActivos();
      state.planes   = getPlanes();

      state.conocioSeleccionado = null;
      state.conocioConfirmado   = false;
      state.turnoSeleccionado   = 0;
      state.horarioConfirmado   = false;
      state.bloqueDatosVisible  = false;
      state.otpEnviado          = false;
      state.otpCooldownHasta    = 0;
      state.correoValidado      = false;
      state.origenTitulo        = '';
      state.reservaCargando     = false;
      state.reservaError        = '';
      state.reservaErrorTexto   = '';
      state.reservaIdReserva    = '';
      state.payloadUltimo       = null;
      state.formSnapshot        = null;

      haptic([15, 10, 15]);

      /* R95: color OFICIAL del índice (meta.color[0]). */
      var color = state.postActivo.colorOficial || '#475569';

      Sheet.abrir({
        color:   color,
        content: '',
        onClose: function () {}
      });

      mostrarDatos();
    }

    function cerrar() { Sheet.cerrar(); }

    document.addEventListener('post:change', function (e) {
      var post = e.detail && e.detail.post;
      if (post && post.id) state.postActivo = post;
    });

    function initDelegacionCta() {
      if (document.__reservaCtaDelegado === '1') return;
      document.__reservaCtaDelegado = '1';

      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('.cta-reservar');
        if (!btn) return;
        if (btn.disabled) return;
        e.preventDefault();
        abrir();
      });
    }

    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.sheet-back');
      if (!btn) return;
      e.preventDefault();
      onVolverClick();
    });

    function pintar() {
      state.postActivo = getPostActivo();
      initDelegacionCta();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pintar);
    } else {
      pintar();
    }

    return {
      pintar: pintar,
      abrir:  abrir,
      cerrar: cerrar
    };

  })();
