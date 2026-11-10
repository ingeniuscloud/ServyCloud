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
                 chips, en Ciudad_Sheet_Script.
                 R153: GESTO DE CAMBIO DE CHIP — deslizar el dedo
                 sobre el lienzo de la lista cambia al chip
                 vecino (derecha = siguiente, izquierda =
                 anterior, literal del dueño), SOLO sin búsqueda
                 y en modo normal; la lista sigue al dedo y el
                 chip de arriba se prende al cruzar el umbral
                 (Opción B) antes de soltar.
VERSIÓN:         1.7
CAMBIOS:         R153: nace el GESTO DE CAMBIO DE CHIP (aprobado por el dueño con valores y Opción B): deslizar horizontalmente sobre el lienzo de la lista cambia al chip vecino — dedo a la DERECHA = chip SIGUIENTE, dedo a la IZQUIERDA = ANTERIOR (literal del dueño), sin ciclo en los extremos (elástico + rebote). Zona: modo normal SIN búsqueda (con búsqueda el gesto NO existe). Validaciones: bordes 24px excluidos (Safari iOS «atrás»), eje decidido a los 10px (vertical = scroll de siempre), distancia 25% del ancho o flick (≥0.4 px/ms con ≥30px) al soltar, animación en vivo (la lista sigue el dedo) y chip de arriba PRENDIDO al cruzar el umbral (haptic de confirmación); los clicks de los items quedan intactos. El cambio usa el MISMO camino del click del chip (activarChip → chips:change). La animación vive en Chips_CSS (.swipe-enVuelo/.swipe-acomodando). R131: simplificación del encabezado. Historial: bitácora/versiones.
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
        /* R130 · letra maestra propia: .chipsFiltros (Core 2.13).
           El color lo viste el chip (gris / blanco-naranja activo). */
        chip.className = 'chip chipsFiltros';
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
       GESTO DE CAMBIO DE CHIP · R153 · deslizar entre chips
       Aprobado por el dueño con valores y Opción B:
       · ZONA: el lienzo de la lista (.secciones-wrap) en modo
         normal — SIN búsqueda (campo vacío), sin detalle, sin
         partner, sin modo compartido. Con búsqueda el gesto
         NO existe (definición literal del dueño).
       · BORDES: 24px excluidos de cada lado — Safari iOS usa
         el borde de la pantalla para su «atrás».
       · EJE: a los 10px de movimiento se decide la intención —
         más vertical = scroll normal (el gesto se abandona y
         la lista sigue como siempre), más horizontal = cambio
         de chip.
       · DIRECCIÓN (literal del dueño): dedo a la DERECHA →
         chip SIGUIENTE; dedo a la IZQUIERDA → chip ANTERIOR.
         Extremos SIN ciclo: en el último no hay siguiente y en
         el primero no hay anterior — el arrastre resiste
         (elástico) y al soltar rebota.
       · ANIMACIÓN: la lista sigue al dedo en vivo; al cruzar
         el umbral el chip de ARRIBA se prende ANTES de soltar
         (Opción B) con haptic de confirmación; al soltar, la
         lista se acomoda y el cambio usa el MISMO camino del
         click del chip (activarChip → chips:change → Lista
         repinta). Cero lógica nueva de datos.
       · UMBRAL al soltar: cuenta la DISTANCIA (25% del ancho
         de la pantalla) o el FLICK (golpe rápido ≥ 0.4 px/ms
         con ≥ 30px recorridos). Debajo: rebote suave y nada
         cambia.
       · LOS CLICKS QUEDAN SANOS: un toque sin carrera
         horizontal es tap de siempre (el navegador dispara
         el click del item); tras un gesto horizontal el click
         que suelte el dedo se descarta una vez.
       La animación vive en Chips_CSS (.swipe-enVuelo y
       .swipe-acomodando sobre .lista-wrap).
       ============================================================ */
    var BORDE_EXCLUIDO  = 24;      /* px de pantalla para el gesto del navegador */
    var EJE_EN          = 10;      /* px para decidir si es horizontal o vertical */
    var DIST_PCT        = 0.25;    /* 25% del ancho cuenta como cambio */
    var FLICK_PXMS      = 0.4;     /* velocidad del golpe rápido (px/ms) */
    var FLICK_MIN       = 30;      /* px mínimos del flick */
    var ELASTICO_TOPE   = 90;      /* px máximos del elástico en extremos */
    var GUARDA_CLICK_MS = 400;     /* ventana que descarta el click post-gesto */

    var _gesto             = null;
    var _bloqueoClickHasta = 0;

    function ahoraMs() { return Date.now(); }

    function hapticGesto(ms) {
      if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) {} }
    }

    function reduceMovimiento() {
      return !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* El gesto solo existe en el lienzo normal, sin búsqueda */
    function lienzoPermitido() {
      var body = document.body;
      if (!body || body.classList.contains('modo-detalle') ||
          body.classList.contains('modo-partner') ||
          body.classList.contains('modo-compartido')) return false;

      var input = document.getElementById('buscarInput');
      if (input && String(input.value || '').trim() !== '') return false;   /* con búsqueda: NADA */

      return true;
    }

    function botonesChips() {
      var cont = document.getElementById('filtros');
      if (!cont) return [];
      return [].slice.call(cont.querySelectorAll('.chip'));
    }

    /* Prende el chip de arriba SOLO EN PANTALLA (Opción B):
       clase .activo del botón y nada más — no escribe vista ni
       emite chips:change. activarChip normaliza al confirmar y
       prenderVisual(activoId) restaura al cancelar. */
    function prenderVisual(idChip) {
      var b = _gesto ? _gesto.botones : botonesChips();
      for (var i = 0; i < b.length; i++) {
        if (b[i].getAttribute(ATTR_CLAVE) === idChip) b[i].classList.add('activo');
        else b[i].classList.remove('activo');
      }
    }

    /* Chip vecino en el orden de los botones pintados (el mismo
       orden de chipsDisponibles). dir +1 = siguiente, -1 =
       anterior. Sin vecino (extremo) devuelve null. */
    function vecinoDe(dir) {
      var b = _gesto.botones;
      var idx = -1;
      for (var i = 0; i < b.length; i++) {
        if (b[i] === _gesto.activoBtn) { idx = i; break; }
      }
      if (idx === -1) return null;
      var j = idx + dir;
      return (j >= 0 && j < b.length) ? b[j] : null;
    }

    /* Elástico de extremo (rubber-band): crece cada vez menos */
    function elastico(dx) {
      var s = dx < 0 ? -1 : 1;
      var x = Math.abs(dx);
      return s * ELASTICO_TOPE * (1 - 1 / (x / ELASTICO_TOPE + 1));
    }

    function umbralDeCambio() {
      return Math.max(window.innerWidth * DIST_PCT, 60);
    }

    function cruzoUmbral(g) {
      if (Math.abs(g.dx) >= umbralDeCambio()) return true;
      /* FLICK: golpe rápido cuenta aunque llegó poco */
      return Math.abs(g.dx) >= FLICK_MIN &&
             Math.abs(g.vel) >= FLICK_PXMS &&
             (g.vel > 0) === (g.dx > 0);
    }

    function arrancarArrastre() {
      if (!_gesto.lista) return;
      _gesto.lista.classList.add('swipe-enVuelo');
      _gesto.lista.style.transform = 'translateX(0px)';
    }

    function onTouchStart(e) {
      _gesto = null;
      if (e.touches.length !== 1) return;

      var objetivo = e.target;
      if (!objetivo || typeof objetivo.closest !== 'function') return;
      if (!objetivo.closest('.secciones-wrap')) return;         /* la zona es el lienzo de la lista */
      if (objetivo.closest('#seccionesTrack')) return;          /* el detalle nunca arrastra la lista */
      if (!lienzoPermitido()) return;                           /* búsqueda, detalle, partner, compartido */

      var botones = botonesChips();
      if (botones.length < 2) return;                           /* un solo chip: nada que deslizar */

      var t = e.touches[0];
      if (t.clientX < BORDE_EXCLUIDO ||
          t.clientX > window.innerWidth - BORDE_EXCLUIDO) return;  /* borde del navegador */

      var activoBtn = null;
      for (var i = 0; i < botones.length; i++) {
        if (botones[i].classList.contains('activo')) { activoBtn = botones[i]; break; }
      }
      if (!activoBtn) return;

      _gesto = {
        id: t.identifier,
        x0: t.clientX,
        y0: t.clientY,
        xPrev: t.clientX,
        tPrev: ahoraMs(),
        vel: 0,
        dx: 0,
        lockH: false,
        descartado: false,
        activoBtn: activoBtn,
        activoId: activoBtn.getAttribute(ATTR_CLAVE),
        botones: botones,
        lista: document.getElementById('listaWrap'),
        destino: null,
        prendidoId: null
      };
    }

    function onTouchMove(e) {
      if (!_gesto || _gesto.descartado) return;

      var t = null;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === _gesto.id) { t = e.changedTouches[i]; break; }
      }
      if (!t) return;

      var dx = t.clientX - _gesto.x0;
      var dy = t.clientY - _gesto.y0;

      if (!_gesto.lockH) {
        if (Math.abs(dx) < EJE_EN && Math.abs(dy) < EJE_EN) return;   /* aún indeciso */
        if (Math.abs(dy) >= Math.abs(dx)) {                           /* vertical: scroll de siempre */
          _gesto.descartado = true;
          return;
        }
        _gesto.lockH = true;
        arrancarArrastre();
      }

      /* Lock horizontal: el scroll vertical se frena mientras el
         dedo arrastra la lista de lado. */
      e.preventDefault();

      /* Velocidad suavizada de los últimos movimientos (flick) */
      var ahora = ahoraMs();
      var dt = ahora - _gesto.tPrev;
      if (dt > 0) {
        var v = (t.clientX - _gesto.xPrev) / dt;
        _gesto.vel = _gesto.vel * 0.6 + v * 0.4;
        _gesto.tPrev = ahora;
        _gesto.xPrev = t.clientX;
      }

      /* La lista sigue al dedo: 1:1 con chip destino, elástico
         en el extremo sin vecino (literal del dueño: derecha =
         SIGUIENTE, izquierda = ANTERIOR). */
      _gesto.dx = dx;
      var destino = vecinoDe(dx > 0 ? 1 : -1);
      _gesto.destino = destino;
      var off = destino ? dx : elastico(dx);
      if (_gesto.lista) {
        _gesto.lista.style.transform = 'translateX(' + off.toFixed(1) + 'px)';
      }

      /* Opción B anticipada: cruzar el umbral PRENDE el chip de
         arriba antes de soltar (y devolverse lo apaga). */
      var prendido = (cruzoUmbral(_gesto) && destino)
        ? destino.getAttribute(ATTR_CLAVE)
        : _gesto.activoId;
      if (_gesto.prendidoId !== prendido) {
        _gesto.prendidoId = prendido;
        prenderVisual(prendido);
        if (prendido !== _gesto.activoId) hapticGesto(8);
      }
    }

    function onTouchFin(e) {
      if (!_gesto) return;
      var g = _gesto;
      _gesto = null;

      /* Tap de siempre o carrera vertical: no se tocó nada */
      if (!g.lockH || g.descartado) return;

      var l = g.lista;
      if (cruzoUmbral(g) && g.destino) {
        /* CONFIRMADO: la lista se acomoda a su sitio y el cambio
           usa el MISMO camino del click del chip — activarChip
           normaliza el .activo, escribe la vista y emite
           chips:change para que Lista repinte. */
        _bloqueoClickHasta = ahoraMs() + GUARDA_CLICK_MS;   /* el click suelto no abre item */
        if (l) {
          l.classList.remove('swipe-enVuelo');
          l.style.transform = 'translateX(0px)';
          if (!reduceMovimiento()) l.classList.add('swipe-acomodando');
          setTimeout(function () {
            l.classList.remove('swipe-acomodando');
            l.style.transform = '';
          }, 260);
        }
        activarChip(g.destino.getAttribute(ATTR_CLAVE));
      } else {
        /* Debajo del umbral: rebote suave y el chip activo
           vuelve a su color de siempre. */
        prenderVisual(g.activoId);
        if (l) soltarVistaDesde(g);
      }
    }

    function soltarVistaDesde(g) {
      var l = g.lista;
      l.classList.remove('swipe-enVuelo');
      l.style.transform = 'translateX(0px)';
      if (!reduceMovimiento()) l.classList.add('swipe-acomodando');
      setTimeout(function () {
        l.classList.remove('swipe-acomodando');
        l.style.transform = '';
      }, 260);
    }

    /* El click que suelta un gesto horizontal NO debe abrir un
       item: se descarta una sola vez dentro de la ventana. */
    function onClickCaptura(e) {
      if (ahoraMs() >= _bloqueoClickHasta) return;
      var objetivo = e.target;
      if (objetivo && typeof objetivo.closest === 'function' &&
          objetivo.closest('.secciones-wrap')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchFin);
    document.addEventListener('touchcancel', onTouchFin);
    document.addEventListener('click', onClickCaptura, true);

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
