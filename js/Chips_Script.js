/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Chips_Script.html
ESPEJO GITHUB:   js/Chips_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Lógica del menú de chips. Genera los chips desde
                 window.SISTEMA.chips ({ idChip, titulo, estado }).
                 Filtra los que tengan estado === false. Al arrancar
                 restaura el chip guardado en localStorage (app_vista)
                 o cae a default (chip 1). Al cambiar de chip emite
                 'chips:change' con { idChip } para que Lista
                 reaccione. La ciudad vive fuera de los chips, en
                 Ciudad_Sheet_Script.
VERSIÓN:         1.0
CAMBIOS:         R5: baseline de producción incorporado al espejo;
                 encabezado normalizado al estándar ═══ (6 campos).
DEPENDENCIAS:    Index.html (inyección window.SISTEMA vía DoGet.gs)
════════════════════════════════════════════════════════════════════
*/

  window.Chips = (function () {

    var KEY_VISTA  = 'app_vista';
    var ATTR_CLAVE = 'data-chip';

    /* ============================================================
       localStorage · lectura/escritura segura
       ============================================================ */
    function leerVista() {
      try {
        var raw = localStorage.getItem(KEY_VISTA);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        return { idChip: obj.idChip || null };
      } catch (_) {
        return null;
      }
    }

    function escribirVista(idChip) {
      try {
        localStorage.setItem(KEY_VISTA, JSON.stringify({
          idChip: idChip || null
        }));
      } catch (_) {}
    }

    /* ============================================================
       Chips disponibles · filtra los desactivados
       ============================================================ */
    function chipsDisponibles() {
      var todos = (window.SISTEMA && window.SISTEMA.chips) || [];
      return todos.filter(function (c) {
        return c && c.idChip && c.estado !== false;
      });
    }

    /* ============================================================
       Resolución de la vista a restaurar
       ============================================================ */
    function resolverVistaInicial(chips) {
      var vista = leerVista();
      if (!vista || !vista.idChip) return { idChip: null };

      var idChip = vista.idChip;
      var chipOk = false;
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].idChip === idChip) { chipOk = true; break; }
      }
      if (!chipOk) return { idChip: null };
      return { idChip: idChip };
    }

    /* ============================================================
       Pintar
       ============================================================ */
    function pintar() {
      var contenedor = document.getElementById('filtros');
      if (!contenedor) {
        console.warn('[Chips] No existe #filtros');
        return;
      }

      var chips = chipsDisponibles();
      if (!chips.length) {
        console.warn('[Chips] SISTEMA.chips sin entradas visibles');
        return;
      }

      var vista = resolverVistaInicial(chips);
      var idChipActivo = vista.idChip || chips[0].idChip;

      contenedor.innerHTML = '';

      chips.forEach(function (op) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = op.titulo;
        chip.setAttribute(ATTR_CLAVE, op.idChip);

        if (op.idChip === idChipActivo) chip.classList.add('activo');

        chip.addEventListener('click', function () {
          if (chip.classList.contains('activo')) return;
          activarChip(op.idChip);
        });

        contenedor.appendChild(chip);
      });

      emitirCambio(idChipActivo);
    }

    /* ============================================================
       Activar chip · fuente única del estado
       ============================================================ */
    function activarChip(idChip) {
      var contenedor = document.getElementById('filtros');
      if (!contenedor) return;

      var chips = contenedor.querySelectorAll('.chip');
      for (var i = 0; i < chips.length; i++) {
        var c = chips[i];
        if (c.getAttribute(ATTR_CLAVE) === idChip) c.classList.add('activo');
        else c.classList.remove('activo');
      }

      escribirVista(idChip);
      emitirCambio(idChip);
    }

    function emitirCambio(idChip) {
      document.dispatchEvent(new CustomEvent('chips:change', {
        detail: { idChip: idChip }
      }));
    }

    /* ============================================================
       API pública
       ============================================================ */
    function seleccionar(catId) {
      var contenedor = document.getElementById('filtros');
      if (!contenedor) return false;
      var chip = contenedor.querySelector('.chip[' + ATTR_CLAVE + '="' + catId + '"]');
      if (!chip) return false;
      activarChip(catId);
      return true;
    }

    function getChipActivo() {
      var contenedor = document.getElementById('filtros');
      if (!contenedor) return null;
      var chip = contenedor.querySelector('.chip.activo');
      return chip ? chip.getAttribute(ATTR_CLAVE) : null;
    }

    return {
      pintar:        pintar,
      seleccionar:   seleccionar,
      getChipActivo: getChipActivo
    };

  })();
