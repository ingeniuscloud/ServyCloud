/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Buscar_Script.html
ESPEJO GITHUB:   js/Buscar_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Buscador permanente en la fila de cabecera (R58):
                 el campo vive SIEMPRE visible; el FOCO activa el
                 estado .buscando (Compartir aparece inactivo, X y
                 vecinos de fila según CSS) y marca body.en-busqueda
                 (chips y rótulo "Explorar" fuera). Al escribir,
                 emite 'buscar:change' con el término y el flag de
                 límite alcanzado. La X limpia y sale. Límite: 40
                 chars.
VERSIÓN:         1.3
CAMBIOS:         R58: el campo es permanente — la lupa ya no
                 existe (su botón es opcional por compatibilidad),
                 abrir() corre con el FOCO del input (sin limpiar
                 lo escrito y sin forzar foco), cerrar() añade la
                 salida de body.en-busqueda.
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (estructura .filtros-wrap),
                 Chips_Script.html (window.Chips), Lista_Script.html
                 (window.Lista.getPostActivo)
════════════════════════════════════════════════════════════════════
*/
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
      document.body.classList.add('en-busqueda');

      emitirEstado(true);

      /* El foco ya viene puesto (abrir corre con el foco del
         input): solo se asegura el estado visual. No se limpia
         lo escrito ni se fuerza foco de nuevo. */
      void input.offsetHeight;
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;

      emitirEstado(false);

      if (document.activeElement === input) input.blur();

      wrap.classList.remove('buscando');
      document.body.classList.remove('en-busqueda');
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
      btnLupa   = document.getElementById('btnBuscar');   /* R58: puede no existir */
      btnCerrar = document.getElementById('btnBuscarCerrar');
      input     = document.getElementById('buscarInput');

      if (!wrap || !btnCerrar || !input) {
        return;
      }

      window.__buscarBound = '1';

      if (btnLupa) btnLupa.addEventListener('click', abrir);
      btnCerrar.addEventListener('click', cerrar);
      input.addEventListener('input', onInput);
      input.addEventListener('focus', abrir);   /* R58: el campo vive siempre visible */
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

