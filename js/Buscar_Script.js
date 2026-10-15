/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Buscar_Script.html
ESPEJO GITHUB:   js/Buscar_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Buscador in-place en la fila de chips. Al tocar
                 la lupa, la fila se transforma en input y el
                 foco va directo al campo (teclado se abre de
                 inmediato). Al escribir, emite 'buscar:change'
                 con el término y el flag de límite alcanzado.
                 Límite: 40 chars.
VERSIÓN:         1.2
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (estructura .filtros-wrap),
                 Chips_Script.html (window.Chips), Lista_Script.html
                 (window.Lista.getPostActivo)
════════════════════════════════════════════════════════════════════*/

  window.Buscar = (function () {

    var wrap      = null;
    var input     = null;
    var btnLupa   = null;
    var btnCerrar = null;

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

    /* R36: estado de la fila de búsqueda (abierta/cerrada) para
       Compartir · el botón compartir aparece INACTIVO al abrir y
       se oculta al cerrar. */
    function emitirEstado(abierta) {
      document.dispatchEvent(new CustomEvent('buscar:estado', {
        detail: { abierta: abierta === true }
      }));
    }

    function abrir() {
      if (abierto) return;
      if (!wrap) return;

      abierto = true;
      wrap.classList.add('buscando');
      input.value = '';

      emitirEstado(true);

      void input.offsetHeight;
      input.focus();

      if (document.activeElement !== input) {
        requestAnimationFrame(function () {
          if (document.activeElement !== input) input.focus();
        });
      }
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;

      emitirEstado(false);

      if (document.activeElement === input) input.blur();

      wrap.classList.remove('buscando');
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

    function onInput() {
      var t = input.value.trim();
      var enLimite = input.value.length >= LIMITE_INPUT;
      emitir(t, enLimite);
    }

    function pintar() {
      if (window.__buscarBound === '1') return;

      wrap      = document.querySelector('.filtros-wrap');
      btnLupa   = document.getElementById('btnBuscar');
      btnCerrar = document.getElementById('btnBuscarCerrar');
      input     = document.getElementById('buscarInput');

      if (!wrap || !btnLupa || !btnCerrar || !input) {
        return;
      }

      window.__buscarBound = '1';

      btnLupa.addEventListener('click', abrir);
      btnCerrar.addEventListener('click', cerrar);
      input.addEventListener('input', onInput);
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
