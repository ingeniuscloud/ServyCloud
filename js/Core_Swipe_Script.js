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
                 · EL CHIP ES CONSECUENCIA: mientras el carril viaja,
                 se mira qué página quedó centrada y ese chip se
                 enciende SOLO, por el mismo camino del click
                 (Chips.seleccionar → chips:change). Al revés: un
                 click en un chip pide al carril que se deslice
                 suave hasta esa página. El chip jamás mueve
                 contenido a mano.
                 · PROFUNDIDAD: cada página, según qué tan lejos
                 está del centro, se corre hacia atrás (parallax
                 15%), se achica hasta 10% y se desvanece hasta
                 60% — el carrusel respira con el movimiento real.
                 Con prefers-reduced-motion el efecto se apaga.
                 · EL RATÓN HACE DE DEDO en PC (GAS y GitHub):
                 presionar y arrastrar con el puntero mueve el
                 carril pixel a pixel (mismo imán al soltar). Solo
                 despierta con puntero fino (mouse/pen): el dedo
                 táctil sigue siendo nativo y no lo siente.
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
VERSIÓN:         1.0
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

    function anchoPagina() {
      var c = carril();
      if (!c) return 1;
      return c.getBoundingClientRect().width || 1;
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
        c.appendChild(pag);
        if (chips[i].classList.contains('activo')) activo = idChip;
      }

      var idx = indiceDe(activo);
      if (idx > 0) c.scrollLeft = idx * anchoPagina();

      c.addEventListener('scroll', _enScroll, { passive: true });
      c.addEventListener('pointerdown', _alPresionar);
      c.addEventListener('pointermove', _alArrastrar);
      c.addEventListener('pointerup', _alSoltar);
      c.addEventListener('pointercancel', _alSoltar);
      c.addEventListener('click', _suprimirClickTrasArrastre, true);

      _efecto();
    }

    /* ============================================================
       PROFUNDIDAD + CHIP CONSECUENCIA (el rAF del scroll)
       Cada página, según su distancia al centro: parallax 15%,
       escala hasta -10%, opacidad hasta -60%. La página centrada
       enciende SU chip solo (por el camino del click). Las
       páginas cerca de la vista cobran sus fotos pendientes.
       ============================================================ */
    var _raf = null;

    function _enScroll() {
      if (_raf) return;
      _raf = requestAnimationFrame(function () {
        _raf = null;
        _efecto();
      });
    }

    function _efecto() {
      var c = carril();
      if (!c || c.hidden) return;

      var w = anchoPagina();
      var centroVista = c.scrollLeft + w / 2;
      var pgs = paginas();
      var reduce = reduceMovimiento();

      for (var i = 0; i < pgs.length; i++) {
        var pag = pgs[i];
        var centroPag = pag.offsetLeft + w / 2;
        var ratio = Math.min(Math.abs(centroVista - centroPag) / w, 1);

        if (reduce) {
          pag.style.transform = '';
          pag.style.opacity = '';
        } else {
          var escala = 1 - ratio * 0.10;
          var opa = 1 - ratio * 0.6;
          var dx = (centroPag - centroVista) * 0.15;
          pag.style.transform =
            'translateX(' + dx.toFixed(1) + 'px) scale(' + escala.toFixed(4) + ')';
          pag.style.opacity = opa.toFixed(3);
        }

        /* fotos pendientes de las páginas que ya se asoman */
        if (ratio < 1.05) _poblarPagina(pag);
      }

      /* EL CHIP ES CONSECUENCIA: la página centrada enciende su
         chip por el MISMO camino del click. */
      var idx = Math.round(c.scrollLeft / w);
      if (idx >= 0 && idx < pgs.length &&
          window.Chips && typeof window.Chips.seleccionar === 'function' &&
          typeof window.Chips.getChipActivo === 'function') {
        var idChip = pgs[idx].getAttribute('data-chip');
        if (window.Chips.getChipActivo() !== idChip) {
          window.Chips.seleccionar(idChip);
        }
      }
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
      var w = anchoPagina();
      var centroVista = c.scrollLeft + w / 2;
      var pgs = paginas();
      for (var i = 0; i < pgs.length; i++) {
        var centroPag = pgs[i].offsetLeft + w / 2;
        if (Math.abs(centroVista - centroPag) < w * 1.05) {
          _poblarPagina(pgs[i]);
        }
      }
    }

    /* ============================================================
       EL RATÓN HACE DE DEDO · puntero fino (mouse/pen) en PC.
       Arrastre 1:1 con la sensación del modelo validado (x1.5),
       imán apagado mientras arrastra (clase .arrastrando) y al
       soltar la página más cercana se engancha al centro. El
       click que el arrastre deje a medio camino se suprime.
       El dedo táctil no pasa por aquí: su scroll ya es nativo.
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
      c.classList.remove('arrastrando');

      /* imán: la página más cercana al centro */
      var destino = Math.round(c.scrollLeft / anchoPagina()) * anchoPagina();
      if (reduceMovimiento()) {
        c.scrollLeft = destino;
      } else {
        try { c.scrollTo({ left: destino, behavior: 'smooth' }); }
        catch (_) { c.scrollLeft = destino; }
      }

      _suprimir = movio;
    }

    function _suprimirClickTrasArrastre(e) {
      if (!_suprimir) return;
      _suprimir = false;
      e.preventDefault();
      e.stopPropagation();
    }

    /* ============================================================
       CHIPS:CHANGE · el chip pide el viaje.
       Click en un chip → el carril se desliza suave hasta esa
       página. Si el cambio llegó como consecuencia del propio
       scroll, el carril ya está ahí (sin nada que hacer). La
       PRIMERA vez que un chip se enciende con lienzo vivo, el
       carril nace.
       ============================================================ */
    document.addEventListener('chips:change', function (e) {
      var idChip = e.detail && e.detail.idChip;
      var c = carril();
      if (!c) return;

      if (!c.classList.contains('carril')) {
        construir();
        return;
      }

      var idx = indiceDe(idChip);
      if (idx < 0) return;

      var w = anchoPagina();
      var actual = Math.round(c.scrollLeft / w);
      if (actual === idx) return;   /* consecuencia del scroll: ya llegó */

      if (reduceMovimiento()) {
        c.scrollLeft = idx * w;
      } else {
        try { c.scrollTo({ left: idx * w, behavior: 'smooth' }); }
        catch (_) { c.scrollLeft = idx * w; }
      }
    });

    return {
      poblarVisibles: poblarVisibles,
      construido: function () {
        var c = carril();
        return !!(c && c.classList.contains('carril'));
      }
    };
  })();
