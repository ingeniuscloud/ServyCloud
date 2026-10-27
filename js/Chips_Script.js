/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Chips_Script.html
ESPEJO GITHUB:   github/js/Chips_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Lógica del menú de chips. Genera los chips desde
                 window.SISTEMA.chips ({ idChip, titulo, estado })
                 como BOTONES INDEPENDIENTES, cada uno con su
                 icono (glifos servicio/cursos/eventos/ventas de
                 Iconos, resueltos por el titulo/idChip). Filtra
                 los que tengan estado === false. Al arrancar
                 restaura el chip guardado en localStorage
                 (app_vista) o cae a default (chip 1). Al cambiar
                 de chip emite 'chips:change' con { idChip } para
                 que Lista reaccione. La ciudad vive fuera de los
                 chips, en Ciudad_Sheet_Script. R63:
                 resetearVista() — cada cambio de ciudad cae al
                 chip de SERVICIOS por defecto (orden del dueño:
                 Irapa sin cursos no puede dejar la lista vacía).
VERSIÓN:         1.6
CAMBIOS:         R129: muere chip.title (tooltip de escritorio — el código solo
                 vive en teléfonos, orden del dueño): el texto
                 completo ya viaja dentro del chip (.chip-texto).
                 R127: glifoDeChip() resuelve también EVENTOS y
                 VENTAS ('evento' → glifo eventos, 'venta' →
                 glifo ventas): la BD trae 4 chips (Servicios,
                 Cursos, Eventos, Ventas) y todos llevan su icono
                 desde Iconos (regla del dueño: cero svg
                 hardcodeado). Sin coincidencia → el chip sale
                 solo con su texto (igual que antes).
                 R64: FUERA los números de items (orden del
                 dueño): mueren contarItems(),
                 actualizarContadores() y su listener de
                 'ciudad:change' — los chips quedan solo con su
                 icono y su texto.
                 R63: entra resetearVista() (y chipServicio(),
                 que resuelve el id del chip servicio por su
                 texto/idChip, sin hardcodear ids): escribe la
                 vista guardada con el chip servicio para que la
                 restauración no reviva el chip anterior; si los
                 botones ya están pintados, activa y emite
                 chips:change. Core_Script lo llama en
                 'ciudad:change'.
                 R62: cada chip lleva ICONO — glifoDeChip()
                 resuelve el glifo (servicio / cursos) por el
                 titulo y el idChip (sin svg hardcodeado: los
                 glifos viven en Iconos).
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (inyección window.SISTEMA vía 00 DoGet.gs)
════════════════════════════════════════════════════════════════════*/





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
       Glifo del chip (R62) · resuelve el icono por el titulo y
       el idChip (minúsculas): 'curso' → cursos, 'servic' →
       servicio, 'evento' → eventos, 'venta' → ventas (R127:
       los 4 chips de la BD llevan icono). Los glifos viven en
       Iconos.html (regla del dueño: cero svg hardcodeado). Sin
       coincidencia → null (el chip sale solo con su texto).
       ============================================================ */
    function glifoDeChip(chip) {
      var texto = ((chip && (chip.idChip || '')) + ' ' +
                   (chip && (chip.titulo || ''))).toLowerCase();
      if (texto.indexOf('curso') !== -1) return 'cursos';
      if (texto.indexOf('servic') !== -1) return 'servicio';
      if (texto.indexOf('evento') !== -1) return 'eventos';
      if (texto.indexOf('venta') !== -1) return 'ventas';
      return null;
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
        chip.setAttribute(ATTR_CLAVE, op.idChip);
        /* R129: sin chip.title (tooltip de escritorio; el código
           solo vive en teléfonos — orden del dueño). El texto
           completo ya viaja dentro del chip (.chip-texto). */

        /* R62 · icono + texto (R64: sin números de items) */
        var glifo = glifoDeChip(op);
        if (glifo) {
          var icono = document.createElement('span');
          icono.className = 'chip-icono';
          icono.setAttribute('data-glifo', glifo);
          icono.setAttribute('aria-hidden', 'true');
          chip.appendChild(icono);
        }

        var texto = document.createElement('span');
        texto.className = 'chip-texto';
        texto.textContent = op.titulo;
        chip.appendChild(texto);

        if (op.idChip === idChipActivo) chip.classList.add('activo');

        chip.addEventListener('click', function () {
          if (chip.classList.contains('activo')) return;
          activarChip(op.idChip);
        });

        contenedor.appendChild(chip);
      });

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(contenedor);
      }

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
       RESET A SERVICIO (R63) · el dueño: cada cambio de ciudad
       muestra por defecto el chip de SERVICIOS — evita aterrizar
       en un chip vacío (Irapa no tiene cursos y la lista salía
       en blanco). chipServicio() resuelve el id por el texto/
       idChip (mismo idioma de glifoDeChip; sin hardcodear ids:
       si la hoja renombra, sigue funcionando y cae al primero).
       resetearVista() escribe la vista guardada para que la
       restauración no reviva el chip anterior; si los botones
       ya están pintados, activa el chip y emite chips:change.
       Core_Script lo llama en 'ciudad:change'.
       ============================================================ */
    function chipServicio() {
      var chips = chipsDisponibles();
      for (var i = 0; i < chips.length; i++) {
        if (glifoDeChip(chips[i]) === 'servicio') return chips[i].idChip;
      }
      return chips.length ? chips[0].idChip : null;
    }

    function resetearVista() {
      var idServicio = chipServicio();
      if (!idServicio) return;

      escribirVista(idServicio);

      var contenedor = document.getElementById('filtros');
      if (!contenedor || !contenedor.querySelector('.chip')) return;

      activarChip(idServicio);
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
      getChipActivo: getChipActivo,
      resetearVista: resetearVista
    };

  })();
