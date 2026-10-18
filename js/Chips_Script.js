/*
════════════════════════════════════════════════════════════════════
ARCHIVO:         Chips_Script.html
ESPEJO GITHUB:   js/Chips_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Lógica del menú de chips. Genera los chips desde
                 window.SISTEMA.chips ({ idChip, titulo, estado })
                 como BOTONES INDEPENDIENTES (R62: sin cápsula
                 contenedora), cada uno con su icono (glifos
                 servicio/cursos de Iconos, resueltos por el
                 titulo/idChip) y su CONTADOR de items activos en
                 la ciudad actual (lo recalcula cuando cambia la
                 ciudad). Filtra los que tengan estado === false.
                 Al arrancar restaura el chip guardado en
                 localStorage (app_vista) o cae a default (chip 1).
                 Al cambiar de chip emite 'chips:change' con
                 { idChip } para que Lista reaccione. La ciudad
                 vive fuera de los chips, en Ciudad_Sheet_Script.
                 R63: resetearVista() — cada cambio de ciudad cae
                 al chip de SERVICIOS por defecto (orden del
                 dueño: Irapa sin cursos no puede dejar la lista
                 vacía).
VERSIÓN:         1.3
CAMBIOS:         R63: entra resetearVista() (y chipServicio(),
                 que resuelve el id del chip servicio por su
                 texto/idChip, sin hardcodear ids): escribe la
                 vista guardada con el chip servicio para que la
                 restauración no reviva el chip anterior; si los
                 botones ya están pintados, activa y emite
                 chips:change. Core_Script lo llama en
                 'ciudad:change'.
                 R62: cada chip lleva ICONO + CONTADOR —
                 glifoDeChip() resuelve el glifo (servicio /
                 cursos) por el titulo y el idChip (sin svg
                 hardcodeado: los glifos viven en Iconos);
                 contarItems(idChip) cuenta los posts ACTIVOS del
                 chip en la ciudad activa (mismas reglas del
                 filtro de Lista); actualizarContadores() repinta
                 las cifras sin desmontar los botones y se liga
                 a 'ciudad:change'.
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (inyección window.SISTEMA vía DoGet.gs)
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
       servicio. Los glifos viven en Iconos.html (regla del
       dueño: cero svg hardcodeado). Sin coincidencia → null
       (el chip sale solo con su texto).
       ============================================================ */
    function glifoDeChip(chip) {
      var texto = ((chip && (chip.idChip || '')) + ' ' +
                   (chip && (chip.titulo || ''))).toLowerCase();
      if (texto.indexOf('curso') !== -1) return 'cursos';
      if (texto.indexOf('servic') !== -1) return 'servicio';
      return null;
    }

    /* ============================================================
       CONTADOR de items del chip (R62) · posts ACTIVOS del chip
       en la ciudad activa — las MISMAS reglas del filtro de la
       lista (estado, membresía del chip y ciudad).
       ============================================================ */
    function contarItems(idChip) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      if (!posts.length) return null;

      var ciudad = null;
      if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
        var c = window.Ciudad.getActual();
        ciudad = c ? c.idCiudad : null;
      }

      var total = 0;
      posts.forEach(function (p) {
        if (!p || !p.id) return;
        if (p.estado === 'inactivo' || p.estado === 'pausado') return;

        var chips = p.idChips || [];
        if (chips.indexOf(idChip) === -1) return;

        if (ciudad) {
          var ciudades = p.idCiudad || [];
          if (ciudades.indexOf(ciudad) === -1) return;
        }

        total++;
      });
      return total;
    }

    /* Repinta SOLO las cifras (no desmonta botones ni toca el
       chip activo). Se liga a 'ciudad:change': al cambiar de
       ciudad, los contadores siguen siendo reales. */
    function actualizarContadores() {
      var contenedor = document.getElementById('filtros');
      if (!contenedor) return;

      var chips = contenedor.querySelectorAll('.chip');
      for (var i = 0; i < chips.length; i++) {
        var idChip = chips[i].getAttribute(ATTR_CLAVE);
        var cifra  = chips[i].querySelector('.chip-contador');
        if (!cifra) continue;

        var n = contarItems(idChip);
        if (n === null) { cifra.textContent = ''; continue; }
        cifra.textContent = String(n);
      }
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

        /* R62 · icono + texto + contador */
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

        var cifra = document.createElement('span');
        cifra.className = 'chip-contador';
        chip.appendChild(cifra);

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

      actualizarContadores();

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

    /* R62 · la ciudad mandó: las cifras de los chips se
       recalculan (mismas reglas del filtro de la lista). */
    document.addEventListener('ciudad:change', actualizarContadores);

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
