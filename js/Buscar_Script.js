/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Buscar_Script.html
ESPEJO GITHUB:   js/Buscar_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Buscador CÁPSULA (R62): la LUPA circular vive en
                 la fila de filtros junto a la ciudad y el botón
                 filtro. Al tocarla la fila añade .buscando, la
                 CÁPSULA se expande tapando el resto de la fila y
                 aparece CANCELAR fuera del campo, a la derecha
                 (patrón Cashea/ML del dueño: al tocar, el campo
                 se cierra solo). El placeholder lo pinta
                 Core_Script desde la BD real
                 (app.placeholderBuscar). El foco pasa al campo.
                 Al escribir, emite 'buscar:change' con el término
                 y el flag de límite alcanzado. CANCELAR limpia y
                 cierra (en modo compartido delega en
                 Compartir.limpiar(), su trabajo de siempre — era
                 el trabajo de "Limpiar filtro", retirado en R62).
                 Límite: 40 chars.
VERSIÓN:         1.6
CAMBIOS:         R62: CANCELAR (#btnCancelarBusqueda) sustituye a
                 "Limpiar filtro" (#btnLimpiarBusqueda, fuera con
                 su split pill): mismo trabajo, nueva pieza fuera
                 del campo; fuera el marcaje body.en-busqueda
                 (nadie lo consume desde que la fila "Explorar"
                 se retiró en esta misma ronda).
                 R61: el placeholder lo pinta Core_Script desde
                 app.placeholderBuscar.
                 R60: vuelve la LUPA (#btnBuscar) y abrir() por
                 click (foco al campo tras expandir la cápsula);
                 la X desaparece — el segmento "Limpiar filtro"
                 de la split pill limpia y cierra (o delega en
                 Compartir si el modo compartido está activo);
                 abrir() se ignora en modo compartido (la cápsula
                 ya está desplegada y bloqueada).
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (estructura .filtros-fila),
                 Chips_Script.html (window.Chips), Lista_Script.html
                 (window.Lista.getPostActivo),
                 Compartir_Script.html (estaCompartido/limpiar)
════════════════════════════════════════════════════════════════════
*/
  window.Buscar = (function () {

    var fila       = null;
    var input      = null;
    var btnLupa    = null;
    var btnCancelar = null;

    var abierto = false;

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

    /* Estado de la búsqueda (abierta/cerrada) para Compartir ·
       el botón compartir aparece INACTIVO al abrir y se oculta
       al cerrar. */
    function emitirEstado(abierta) {
      document.dispatchEvent(new CustomEvent('buscar:estado', {
        detail: { abierta: abierta === true }
      }));
    }

    function enModoCompartido() {
      return document.body.classList.contains('modo-compartido');
    }

    function abrir() {
      if (abierto) return;
      if (!fila) return;
      if (enModoCompartido()) return;   /* cápsula ya desplegada y bloqueada */

      abierto = true;
      fila.classList.add('buscando');

      emitirEstado(true);

      /* El foco pasa al campo DESPUÉS de que la cápsula se
         desplegó (display:none → flex): el rAF del navegador
         garantiza que el input ya es enfocable. */
      requestAnimationFrame(function () {
        if (abierto && input) {
          try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
        }
      });
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;

      emitirEstado(false);

      if (document.activeElement === input) input.blur();

      if (fila) fila.classList.remove('buscando');
      input.value = '';

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
          return;
        }
      }

      emitir('', false);
    }

    function onCancelar() {
      /* Trabajo de siempre (antes "Limpiar filtro"): en modo
         compartido CANCELAR libera la vista (Compartir.limpiar
         devuelve ciudades, chips y listas); en búsqueda normal
         limpia y cierra. */
      if (window.Compartir &&
          typeof window.Compartir.estaCompartido === 'function' &&
          window.Compartir.estaCompartido()) {
        window.Compartir.limpiar();
        return;
      }
      cerrar();
    }

    function onInput() {
      var t = input.value.trim();
      var enLimite = input.value.length >= LIMITE_INPUT;
      emitir(t, enLimite);
    }

    function pintar() {
      if (window.__buscarBound === '1') return;

      fila        = document.querySelector('.filtros-fila');
      btnLupa     = document.getElementById('btnBuscar');
      input       = document.getElementById('buscarInput');
      btnCancelar = document.getElementById('btnCancelarBusqueda');

      if (!fila || !btnLupa || !input || !btnCancelar) {
        return;
      }

      window.__buscarBound = '1';

      btnLupa.addEventListener('click', abrir);
      btnCancelar.addEventListener('click', onCancelar);
      input.addEventListener('input', onInput);
      input.addEventListener('focus', abrir);   /* inofensivo: si ya está abierta no repite */
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pintar);
    } else {
      pintar();
    }

    return {
      pintar:     pintar,
      abrir:      abrir,
      cerrar:     cerrar,
      normalizar: normalizar
    };

  })();
