/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Swipe_Script.html
ESPEJO GITHUB:   github/js/Core_Swipe_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.SwipeChips — el desplazamiento del área de
                 items. La lista deja de ser una pila que se
                 reemplaza: es una TIRA de páginas una al lado de la
                 otra, una por chip visible, dentro de un carril
                 horizontal (#listaWrap convertido en carril con
                 scroll nativo + imán, Core_CSS .carril).
                 · EL DEDO MANDA: arrastrar desplaza el carril 1:1 y
                 al soltar la página más cercana se imanta al centro
                 (scroll-snap). El navegador hace el trabajo: sin
                 clones, sin muros, sin nada congelado.
                 · DIRECCIÓN FÍSICA: empujar el listado a la
                 IZQUIERDA muestra la lista de la DERECHA; empujar a
                 la derecha, la de la IZQUIERDA. Los extremos no
                 ciclan.
                 · EL IMÁN APUNTA A DIANAS QUIETAS (R161): la página
                 es lo que el navegador MIDE para imantar, así que
                 nadie la mueve. La profundidad (parallax 15%,
                 achique hasta 10%) vive en la CAPA INTERIOR
                 (.carril-items, que el navegador no mide) y el
                 desvanecido (hasta 60%) en la página — la opacidad
                 no mueve cajas. Con dianas fijas el imán obligatorio
                 del navegador trabaja solo y certero: fin de las
                 pantallas cortadas, de los saltos de dos chips y del
                 regreso contra el empuje. La página en reposo queda
                 EXACTA al centro, sin escala residual. Con
                 prefers-reduced-motion el efecto se apaga.
                 · LA LLEGADA SE LEE COMO EL OJO (R161): la página
                 llegada es la que tiene su centro más cerca del
                 centro de la vista (rectángulos reales, scroll ya
                 dentro), no la que sale de dividir la posición por
                 el ancho — con anchos con decimales (zoom de
                 Windows, DPR del teléfono) la división elegía al
                 vecino.
                 · EL CHIP EN VUELO SOLO SE ILUMINA (R161): los
                 cruces de centro encienden la lucecita del chip
                 (clase, nada más). Guardar la elección en el
                 teléfono y avisar al resto (chips:change) pasa UNA
                 vez, al asentarse; el pulso del dueño ya avisa por
                 sí mismo.
                 · ASENTAMIENTO (R161): 160ms sin scroll = reposo. Al
                 reposo el carril despierta el imán dormido por el
                 arrastre del ratón (ya en posición, sin pelear con
                 ninguna animación) y avisa 'carril:asentado' — Lista
                 repinta lo que esté VENCIDO (las páginas nacen
                 pintadas: en reposo no hay nada que hacer).
                 · RESPIRO VERTICAL DEL PULSO (R161): el scroll
                 vertical vuelve arriba cuando el dueño PULSA un chip
                 (antes de viajar), jamás como consecuencia del
                 deslizamiento.
                 · EL CHIP ES CONSECUENCIA: un click en un chip pide
                 al carril que se deslice suave hasta esa página. El
                 chip jamás mueve contenido a mano.
                 · UN SOLO ANIMADOR (R161): el ratón hace de dedo en
                 PC (GAS y GitHub) con el imán DORMIDO mientras
                 arrastra (.arrastrando); al soltar, UNA animación
                 lleva el carril a su página y el imán despierta ya
                 en reposo — nunca dos que tiren de la soga a la vez.
                 Solo despierta con puntero fino (mouse/pen): el
                 dedo táctil sigue siendo nativo y no lo siente.
                 · IMÁGENES DE GRILLA A DEMANDA: las fotos de las
                 páginas solo bajan cuando la página se acerca a la
                 vista (poblarVisibles, llamada por Lista al pintar
                 y por el propio carril al deslizar) — agilidad sin
                 gastar datos en páginas que nadie mira. La memoria
                 L2 (SeccionImagen) guarda cada foto: se baja UNA
                 vez y repinta desde disco sin red.
                 · CON BÚSQUEDA ACTIVA el carril se fija (clase
                 .fijo): los resultados viven en la página visible y
                 no se sale de ella hasta limpiar la búsqueda.
VERSIÓN:         2.1
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Core_CSS.html (.carril, .carril-pagina, .carril-items),
                 Chips_Script.html (window.Chips),
                 Seccion_Imagen_Script.html (window.SeccionImagen.poblarConL2),
                 Index.html (SISTEMA via #filtros)
════════════════════════════════════════════════════════════════════*/

  window.SwipeChips = (function () {

    /* ============================================================
       EL CARRIL · #listaWrap convertido en tira de páginas.
       Una página por chip PINTADO en pantalla (#filtros .chip):
       lo que se ve manda — ni el orden del arreglo ni el del
       DOM pueden inventar vecino.
       ============================================================ */
    function carril() { return document.getElementById('listaWrap'); }

    function paginas() {
      var c = carril();
      return c ? c.querySelectorAll('.carril-pagina') : [];
    }

    function indiceDe(idChip) {
      var pgs = paginas();
      for (var i = 0; i < pgs.length; i++) {
        if (pgs[i].getAttribute('data-chip') === idChip) return i;
      }
      return -1;
    }

    function reduceMovimiento() {
      return !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* ============================================================
       GEOMETRÍA DEL OJO (R161) · todo se mide con rectángulos
       reales: el scroll ya está dentro de ellos, no hay divisiones
       ni redondeos que elijan al vecino.
       · paginaCentrada: la página cuyo centro está más cerca del
         centro de la vista.
       · scrollParaCentrar: el scrollLeft exacto para que una
         página quede centrada (centro de página = centro de vista).
       ============================================================ */
    function paginaCentrada() {
      var c = carril();
      if (!c || c.hidden) return null;
      var pgs = paginas();
      if (!pgs.length) return null;

      var crect = c.getBoundingClientRect();
      var centroVista = crect.left + crect.width / 2;

      var mejor = null;
      var mejorD = Infinity;
      for (var i = 0; i < pgs.length; i++) {
        var r = pgs[i].getBoundingClientRect();
        var d = Math.abs((r.left + r.width / 2) - centroVista);
        if (d < mejorD) { mejorD = d; mejor = pgs[i]; }
      }
      return mejor;
    }

    function scrollParaCentrar(pag) {
      var c = carril();
      if (!c || !pag) return c ? c.scrollLeft : 0;
      var r = pag.getBoundingClientRect();
      var crect = c.getBoundingClientRect();
      return c.scrollLeft + (r.left + r.width / 2) - (crect.left + crect.width / 2);
    }

    /* ============================================================
       LA LUZ DEL CHIP (R161) · SOLO la clase .activo en la barra:
       sin memoria, sin aviso, sin listeners. La memoria y el
       aviso son del asentamiento (llegada) y del pulso del dueño.
       ============================================================ */
    var _chipLuz = null;

    function _encenderLuz(idChip) {
      if (!idChip || _chipLuz === idChip) return;
      _chipLuz = idChip;

      var contenedor = document.getElementById('filtros');
      if (!contenedor) return;
      var chips = contenedor.querySelectorAll('.chip');
      for (var i = 0; i < chips.length; i++) {
        var chip = chips[i];
        if (chip.getAttribute('data-chip') === idChip) chip.classList.add('activo');
        else chip.classList.remove('activo');
      }
    }

    /* CONSTRUIR: nace en el primer chips:change con lienzo vivo.
       Crea las páginas (una por chip visible), posiciona el
       carril al chip activo SIN animación y engancha el scroll. */
    function construir() {
      var c = carril();
      if (!c || c.classList.contains('carril')) return;

      var chips = document.querySelectorAll('#filtros .chip');
      if (!chips.length) return;

      var activo = null;
      c.classList.add('carril');
      c.innerHTML = '';

      for (var i = 0; i < chips.length; i++) {
        var idChip = chips[i].getAttribute('data-chip');
        var pag = document.createElement('div');
        pag.className = 'carril-pagina';
        pag.setAttribute('data-chip', idChip);
        var items = document.createElement('div');
        items.className = 'carril-items';
        pag.appendChild(items);
        pag._items = items;   /* la capa interior de la profundidad */
        c.appendChild(pag);
        if (chips[i].classList.contains('activo')) activo = idChip;
      }

      _chipLuz = activo;
      _chipAvisado = activo;

      var pgs = paginas();
      var idx = indiceDe(activo);
      if (idx > 0) c.scrollLeft = scrollParaCentrar(pgs[idx]);

      c.addEventListener('scroll', _enScroll, { passive: true });
      c.addEventListener('pointerdown', _alPresionar);
      c.addEventListener('pointermove', _alArrastrar);
      c.addEventListener('pointerup', _alSoltar);
      c.addEventListener('pointercancel', _alSoltar);
      c.addEventListener('click', _suprimirClickTrasArrastre, true);

      _efecto();

      /* nacimiento: agenda el primer asentamiento — Lista repinta
         TODAS las páginas vencidas (nacen pintadas) en cuanto la
         tira reposa. */
      _agendaAsentar();
    }

    /* ============================================================
       PROFUNDIDAD + CHIP CONSECUENCIA (el rAF del scroll)
       La profundidad vive en la CAPA INTERIOR (.carril-items):
       parallax 15% y achique hasta 10% — el navegador no mide esa
       capa para imantar, la diana queda quieta. El desvanecido
       (hasta 60%) va en la página: opacidad no mueve cajas. La
       página centrada en reposo queda EXACTA (cero transform) y
       su chip solo se ILUMINA. Primero se lee (rects), después se
       escribe: nada de reflow ida y vuelta dentro del bucle.
       ============================================================ */
    var _raf = null;

    function _enScroll() {
      _agendaAsentar();
      if (_raf) return;
      _raf = requestAnimationFrame(function () {
        _raf = null;
        _efecto();
      });
    }

    function _efecto() {
      var c = carril();
      if (!c || c.hidden) return;

      var pgs = paginas();
      if (!pgs.length) return;

      var crect = c.getBoundingClientRect();
      var w = crect.width || 1;
      var centroVista = crect.left + w / 2;
      var reduce = reduceMovimiento();

      var rects = [];
      for (var i = 0; i < pgs.length; i++) {
        rects.push(pgs[i].getBoundingClientRect());
      }

      var centrada = null;
      var mejorD = Infinity;

      for (i = 0; i < pgs.length; i++) {
        var pag = pgs[i];
        var r = rects[i];
        var centroPag = r.left + r.width / 2;
        var d = Math.abs(centroVista - centroPag);
        if (d < mejorD) { mejorD = d; centrada = pag; }

        /* POSE EXACTA EN REPOSO: desviación menor a 1.5px es
           redondeo del layout, no movimiento — ratio 0 y cero
           transform en la capa interior (adiós al temblor). */
        var ratio = d < 1.5 ? 0 : Math.min(d / w, 1);
        var items = pag._items || pag.querySelector('.carril-items');

        if (reduce) {
          if (items && items._tf !== '') { items.style.transform = ''; items._tf = ''; }
          if (pag._op !== '') { pag.style.opacity = ''; pag._op = ''; }
        } else {
          if (items) {
            var escala = 1 - ratio * 0.10;
            var dx = (centroPag - centroVista) * 0.15;
            var tf = ratio === 0 ? '' :
              'translateX(' + dx.toFixed(1) + 'px) scale(' + escala.toFixed(4) + ')';
            /* solo se escribe si cambió: ni re-declaraciones */
            if (items._tf !== tf) { items.style.transform = tf; items._tf = tf; }
          }
          var op = (1 - ratio * 0.6).toFixed(3);
          if (pag._op !== op) { pag.style.opacity = op; pag._op = op; }
        }

        /* fotos pendientes de las páginas que ya se asoman */
        if (ratio < 1.05) _poblarPagina(pag);
      }

      /* EL CHIP EN VUELO SOLO SE ILUMINA: clase, nada más. */
      if (centrada) _encenderLuz(centrada.getAttribute('data-chip'));
    }

    /* ============================================================
       ASENTAMIENTO (R161) · 160ms sin scroll = reposo. Al reposo:
       el imán dormido por el arrastre del ratón despierta YA EN
       POSICIÓN (re-engancha donde está parado, sin pelear con
       ninguna animación), la elección se guarda y se avisa UNA vez
       (solo si la llegada no fue avisada por un pulso), y sale
       'carril:asentado' para que Lista repinte lo vencido.
       ============================================================ */
    var _timerAsentar = null;
    var _chipAvisado = null;
    var _avisandoLlegada = false;

    function _agendaAsentar() {
      if (_timerAsentar) clearTimeout(_timerAsentar);
      _timerAsentar = setTimeout(_alAsentar, 160);
    }

    function _alAsentar() {
      _timerAsentar = null;

      /* el dueño sigue sosteniendo el carril: nada está en reposo */
      if (_drag) return;

      var c = carril();
      if (!c || c.hidden || !c.classList.contains('carril')) return;

      /* el imán despierta ya en reposo: re-snap donde está parado */
      c.classList.remove('arrastrando');

      var centrada = paginaCentrada();
      var idChip = centrada ? centrada.getAttribute('data-chip') : null;
      if (!idChip) return;

      if (_chipAvisado !== idChip) {
        _chipAvisado = idChip;
        /* aviso de llegada: el pulso del dueño no viaja por aquí */
        _avisandoLlegada = true;
        try {
          if (window.Chips && typeof window.Chips.seleccionar === 'function') {
            window.Chips.seleccionar(idChip);
          }
        } finally {
          _avisandoLlegada = false;
        }
      }

      document.dispatchEvent(new CustomEvent('carril:asentado', {
        detail: { idChip: idChip }
      }));
    }

    /* ============================================================
       FOTOS A DEMANDA · las imágenes de grilla montan SIN src
       (data-l2 con la URL) y solo cobran cuando su página se
       acerca a la vista. Sin red en páginas que nadie mira.
       ============================================================ */
    function _poblarPagina(pag) {
      var imgs = pag.querySelectorAll('img[data-l2]');
      if (!imgs.length) return;
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var url = img.getAttribute('data-l2');
        img.removeAttribute('data-l2');
        if (window.SeccionImagen &&
            typeof window.SeccionImagen.poblarConL2 === 'function') {
          window.SeccionImagen.poblarConL2(img, url);
        } else {
          img.src = url;
        }
      }
    }

    function poblarVisibles() {
      var c = carril();
      if (!c || c.hidden) return;
      var pgs = paginas();
      if (!pgs.length) return;

      var crect = c.getBoundingClientRect();
      var w = crect.width || 1;
      var centroVista = crect.left + w / 2;

      for (var i = 0; i < pgs.length; i++) {
        var r = pgs[i].getBoundingClientRect();
        if (Math.abs(r.left + r.width / 2 - centroVista) < w * 1.05) {
          _poblarPagina(pgs[i]);
        }
      }
    }

    /* ============================================================
       EL RATÓN HACE DE DEDO · puntero fino (mouse/pen) en PC.
       Arrastre 1:1 con la sensación del modelo validado (x1.5) y
       el imán DORMIDO (.arrastrando, sin scroll-snap) mientras
       arrastra: al soltar, UNA animación lleva el carril a su
       página y el imán despierta al asentarse, ya en reposo. El
       click que el arrastre deje a medio camino se suprime. El
       dedo táctil no pasa por aquí: su scroll ya es nativo.
       ============================================================ */
    var _drag = null;
    var _suprimir = false;

    function _alPresionar(e) {
      if (e.pointerType === 'touch') return;   /* el dedo: nativo */
      if (_drag) return;
      var c = carril();
      if (!c || c.hidden || c.classList.contains('fijo')) return;

      _drag = { id: e.pointerId, x0: e.clientX, scroll0: c.scrollLeft, movio: false };
      c.classList.add('arrastrando');
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function _alArrastrar(e) {
      if (!_drag || e.pointerId !== _drag.id) return;
      var dx = e.clientX - _drag.x0;
      if (Math.abs(dx) > 8) _drag.movio = true;
      var c = carril();
      if (c) c.scrollLeft = _drag.scroll0 - dx * 1.5;
    }

    function _alSoltar(e) {
      if (!_drag || (e.pointerId !== undefined && e.pointerId !== _drag.id)) return;
      var movio = _drag.movio;
      _drag = null;

      var c = carril();
      if (!c) return;

      /* UN SOLO ANIMADOR: el imán sigue dormido mientras la
         animación lleva el carril a la página más cercana. */
      var centrada = paginaCentrada();
      var destino = centrada ? scrollParaCentrar(centrada) : c.scrollLeft;

      if (reduceMovimiento()) {
        c.scrollLeft = destino;
        c.classList.remove('arrastrando');   /* sin animación: despierta ya */
      } else {
        try { c.scrollTo({ left: destino, behavior: 'smooth' }); }
        catch (_) {
          c.scrollLeft = destino;
          c.classList.remove('arrastrando');
        }
      }

      _suprimir = movio;
      _agendaAsentar();   /* asentamiento garantizado aunque no se mueva */
    }

    function _suprimirClickTrasArrastre(e) {
      if (!_suprimir) return;
      _suprimir = false;
      e.preventDefault();
      e.stopPropagation();
    }

    /* ============================================================
       CHIPS:CHANGE · el PULSO del dueño (o el aviso de llegada).
       · Aviso de llegada (_avisandoLlegada): el asentamiento ya
         hizo su trabajo — nada que hacer.
       · Carril sin nacer: nace aquí mismo.
       · Pulso real: el scroll vertical vuelve arriba ANTES de
         viajar (respiro del pulso) y el carril se desliza suave
         hasta la página pedida.
       ============================================================ */
    document.addEventListener('chips:change', function (e) {
      var idChip = e.detail && e.detail.idChip;
      var c = carril();
      if (!c) return;

      if (_avisandoLlegada) return;   /* consecuencia del asentamiento */

      if (!c.classList.contains('carril')) {
        _chipLuz = idChip;
        _chipAvisado = idChip;
        construir();
        return;
      }

      _chipAvisado = idChip;   /* el pulso avisa por sí mismo */
      _encenderLuz(idChip);    /* la clase ya la puso Chips: no-op */

      var pgs = paginas();
      var idx = indiceDe(idChip);
      if (idx < 0) return;

      /* RESPIRO VERTICAL DEL PULSO: arriba antes de viajar */
      var wrap = document.querySelector('.secciones-wrap');
      if (wrap) wrap.scrollTop = 0;

      var destino = pgs[idx];
      if (paginaCentrada() === destino) return;   /* ya está en ella */

      if (reduceMovimiento()) {
        c.scrollLeft = scrollParaCentrar(destino);
      } else {
        try { c.scrollTo({ left: scrollParaCentrar(destino), behavior: 'smooth' }); }
        catch (_) { c.scrollLeft = scrollParaCentrar(destino); }
      }
    });

    return {
      poblarVisibles: poblarVisibles
    };
  })();
