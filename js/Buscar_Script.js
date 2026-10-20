/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Buscar_Script.html
ESPEJO GITHUB:   js/Buscar_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Campo de búsqueda (R64): vive EXPANDIDO de una
                 vez en la FILA 1 de la sección de filtros (sin
                 estados de apertura — la lupa-botón, la cápsula
                 que se desplegaba y el texto CANCELAR murieron).
                 Al escribir emite 'buscar:change' con el término
                 y el flag de límite alcanzado, y enciende la X
                 circular naranja (.con-texto en la cápsula) que
                 limpia el campo: en búsqueda normal borra y
                 re-pinta la lista del chip (si hay un post activo
                 de cross-sell, restaura SU chip como siempre);
                 en modo compartido delega en Compartir.limpiar()
                 (el trabajo que hacía CANCELAR — libera la
                 vista). Límite: 40 chars.
VERSIÓN:         2.2
CAMBIOS:         R70-B: EL FRAGMENTO VUELVE A LLEVAR SU ENVOLTORIO. La entrega
                 R70 pegaba este JS sin las etiquetas <script> propias
                 que TODO fragmento GAS trae desde siempre: el
                 include() lo vertía como TEXTO en la página. El cuerpo
                 NO cambia una línea: sigue el fix R70 completo (la X
                 limpia y suelta el foco para cerrar el teclado). En
                 GAS: pega el archivo COMPLETO en el archivo
                 Buscar_Script (lleva sus <script>...</script>).
                 R70: la X QUITA EL FOCO del campo (input.blur())
                 al limpiar — orden del dueño: el teclado virtual
                 del teléfono se CIERRA al tocar la X (antes el
                 blur lo re-enfocaba con input.focus() y el
                 teclado seguía abierto). El blur corre SIEMPRE,
                 también en modo compartido. Resto intacto.
                 R64: el campo NO se abre ni se cierra (siempre
                 visible) — fuera abrir()/cerrar()/abrir capsula,
                 la lupa-botón (#btnBuscar) y el texto CANCELAR
                 (#btnCancelarBusqueda) con el evento
                 'buscar:estado' (nadie lo consume ya); entra la
                 X (#btnLimpiarCampo): aparece al escribir y
                 limpia el campo — en modo compartido libera la
                 vista (mismo trabajo de siempre).
                 R61: el placeholder lo pinta Core_Script desde
                 app.placeholderBuscar.
DEPENDENCIAS:    Index.html (estructura .filtros-fila),
                 Chips_Script.html (window.Chips), Lista_Script.html
                 (window.Lista.getPostActivo),
                 Compartir_Script.html (estaCompartido/limpiar)
════════════════════════════════════════════════════════════════════*/

  window.Buscar = (function () {

    var capsula  = null;
    var input    = null;
    var btnLimpiar = null;

    var LIMITE_INPUT = 40;

    function normalizar(s) {
      return String(s == null ? '' : s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function emitir(termino, enLimite) {
      document.dispatchEvent(new CustomEvent('buscar:change', {
        detail: {
          termino:  termino  || '',
          enLimite: enLimite === true
        }
      }));
    }

    function enModoCompartido() {
      return document.body.classList.contains('modo-compartido');
    }

    /* ============================================================
       X DE LIMPIAR (R64) · dentro del campo, a la derecha
       Búsqueda normal: borra el texto y repinta la lista del
       chip (con cross-sell activo restaura el chip del post,
       como hacía CANCELAR). Modo compartido: libera la vista
       vía Compartir.limpiar (mismo trabajo de siempre).
       R70 · SIEMPRE suelta el foco del campo al entrar: al
       tocar la X el teclado virtual del teléfono se cierra
       (orden del dueño) — ya no se re-enfoca el input al
       final.
       ============================================================ */
    function limpiarCampo() {
      haptic(8);

      /* R70 · FUERA EL FOCO (teclado cerrado) en cuanto se
         toca la X — en el camino compartido y en el normal. */
      if (input) { try { input.blur(); } catch (_) {} }

      if (window.Compartir &&
          typeof window.Compartir.estaCompartido === 'function' &&
          window.Compartir.estaCompartido()) {
        window.Compartir.limpiar();
        return;
      }

      input.value = '';
      capsula.classList.remove('con-texto');

      var postActivo = (window.Lista && typeof window.Lista.getPostActivo === 'function')
        ? window.Lista.getPostActivo()
        : null;

      var chipActual = (window.Chips && typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo()
        : null;

      if (postActivo && postActivo.idChips && postActivo.idChips.length) {
        var chipDelPost = postActivo.idChips[0];

        if (chipDelPost !== chipActual) {
          if (window.Chips && typeof window.Chips.seleccionar === 'function') {
            window.Chips.seleccionar(chipDelPost);
          }
          emitir('', false);
          return;
        }
      }

      emitir('', false);

      /* R70: el input.focus() que seguía aquí RE-ENFOCABA el
         campo tras limpiar y el teclado no se cerraba nunca —
         el blur del encabezado de la función manda ahora. */
    }

    function onInput() {
      var t = input.value.trim();
      var enLimite = input.value.length >= LIMITE_INPUT;
      capsula.classList.toggle('con-texto', input.value.length > 0);
      emitir(t, enLimite);
    }

    function haptic(ms) {
      if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (_) {}
      }
    }

    function pintar() {
      if (window.__buscarBound === '1') return;

      capsula    = document.getElementById('buscarFila');
      input      = document.getElementById('buscarInput');
      btnLimpiar = document.getElementById('btnLimpiarCampo');

      if (!capsula || !input || !btnLimpiar) {
        return;
      }

      window.__buscarBound = '1';

      btnLimpiar.addEventListener('click', limpiarCampo);
      input.addEventListener('input', onInput);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pintar);
    } else {
      pintar();
    }

    return {
      pintar:     pintar,
      normalizar: normalizar
    };

  })();