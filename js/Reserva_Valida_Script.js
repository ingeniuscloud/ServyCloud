/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Reserva_Valida_Script.html
ESPEJO GITHUB:   github/js/Reserva_Valida_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Validadores y limpiadores puros del módulo
                 Reserva. Sin DOM, sin state, sin dependencias.
                 Espejo conceptual de Seguridad.gs en el frontend.
VERSIÓN:         1.1
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Ninguna (módulo puro; espejo conceptual de
                 Seguridad.gs)
════════════════════════════════════════════════════════════════════*/

  window.ReservaValida = (function () {

    /* ---------- Constantes ---------- */
    var REGEX = {
      NOMBRE:     /^[A-Za-zÀ-ÿ\s'\-]+$/,
      NO_NOMBRE:  /[^A-Za-zÀ-ÿ\s'\-]/g,
      NO_DIGITO:  /\D/g,
      CORREO:     /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      OTP:        /^\d{6}$/
    };

    var MIN = {
      NOMBRE:   3,
      TELEFONO: 10
    };

    var MAX = {
      TELEFONO: 11
    };

    /* ---------- Limpiadores ---------- */
    function limpiarNombre(v) {
      return String(v == null ? '' : v).replace(REGEX.NO_NOMBRE, '');
    }

    function limpiarTelefono(v) {
      return String(v == null ? '' : v)
        .replace(REGEX.NO_DIGITO, '')
        .slice(0, MAX.TELEFONO);
    }

    function limpiarOtp(v) {
      return String(v == null ? '' : v)
        .replace(REGEX.NO_DIGITO, '')
        .slice(0, 6);
    }

    /* ---------- Validadores ---------- */
    function nombre(v) {
      var s = String(v == null ? '' : v).trim();
      if (s.length < MIN.NOMBRE) return false;
      return REGEX.NOMBRE.test(s);
    }

    function telefono(v) {
      return limpiarTelefono(v).length >= MIN.TELEFONO;
    }

    function correo(v) {
      return REGEX.CORREO.test(String(v == null ? '' : v));
    }

    function otp(v) {
      return REGEX.OTP.test(String(v == null ? '' : v));
    }

    return {
      nombre:   nombre,
      telefono: telefono,
      correo:   correo,
      otp:      otp,

      limpiarNombre:   limpiarNombre,
      limpiarTelefono: limpiarTelefono,
      limpiarOtp:      limpiarOtp,

      REGEX: REGEX,
      MIN:   MIN,
      MAX:   MAX
    };

  })();