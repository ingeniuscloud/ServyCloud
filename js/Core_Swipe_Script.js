/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Swipe_Script.html
ESPEJO GITHUB:   github/js/Core_Swipe_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.SwipeChips — el desplazamiento lateral del
                 área de items. EL MODELO: pantallas cargadas,
                 desplazamiento lateral simple, chip sincronizado.
                 Nada más.
                 · PANTALLAS CARGADAS: la tira es una página por
                   chip visible (#filtros .chip), todas nacen
                   pintadas; el desplazamiento no carga nada, solo
                   viaja.
                 · EL IMÁN CLAVA AL SOLTAR: mientras el arrastre
                   camina, el imán duerme (.arrastrando); al soltar,
                   UNA animación lleva el carril a la página más
                   cercana y el scroll-snap vuelve a mandar.
                 · EL CHIP SE SINCRONIZA: mientras el carril viaja,
                   el chip de la página visible se ilumina (clase,
                   nada más); al asentarse (160ms sin scroll) la
                   elección se guarda y se avisa UNA vez
                   (chips:change) — el pulso del dueño avisa por sí
                   mismo.
                 · LA LUZ NO REGRESA: en cuanto el destino queda
                   decidido (al soltar el arrastre o al pulsar un
                   chip), la luz se FIJA en ese chip hasta el
                   asentamiento — jamás vuelve al chip anterior ni
                   parpadea a mitad del viaje.
                 · GEOMETRÍA SIMPLE: todas las páginas miden lo
                   mismo que la vista — la página visible es
                   scrollLeft dividido por ese ancho, redondeado y
                   clavado al rango real de páginas. El viaje a una
                   página es ese mismo número multiplicado de
                   vuelta.
                 · AXIS LOCK (dedo, ratón y pen): el arrastre decide
                   eje con los primeros píxeles decisivos; si el
                   gesto es vertical, suelta el carril para que la
                   lista suba y baje; si es horizontal, mueve el
                   carril (x1.5) y reserva el eje. EL DEDO VIAJA POR
                   EL MISMO CAMINO QUE EL RATÓN: una sola ley para
                   todos los punteros — lo que en PC es perfecto, en
                   el teléfono es LO MISMO.
                 · DIRECCIÓN FÍSICA: empujar el listado a la
                   IZQUIERDA muestra la lista de la DERECHA; a la
                   derecha, la de la IZQUIERDA. Los extremos no
                   ciclan.
                 · UN CHIP POR GESTO: cada página frena la inercia
                   (scroll-snap-stop en Core_CSS) — un flick
                   violento avanza UNA página, nunca la tira.
                 · RESPIRO VERTICAL DEL PULSO: el scroll vertical
                   vuelve arriba cuando el dueño PULSA un chip
                   (antes de viajar), jamás como consecuencia del
                   deslizamiento.
                 · EL CHIP ES CONSECUENCIA: un click en un chip
                   pide el viaje suave hasta esa página; el chip
                   jamás mueve contenido a mano.
                 · FOTOS A DEMANDA: las fotos de las páginas solo
                   bajan cuando la página se acerca a la vista
                   (poblarVisibles, llamada por Lista al pintar y
                   por el propio carril al deslizar). La memoria
                   L2 (SeccionImagen) guarda cada foto: se baja UNA
                   vez y repinta desde disco sin red.
                 · CON BÚSQUEDA ACTIVA el carril se fija (clase
                   .fijo): los resultados viven en la página
                   visible hasta limpiar la búsqueda.
VERSIÓN:         3.1
DEPENDENCIAS:    Core_CSS.html (.carril, .carril-pagina, .carril-items),
                 Chips_Script.html (window.Chips),
                 Seccion_Imagen_Script.html (window.SeccionImagen.poblarConL2),
                 Index.html (SISTEMA via #filtros)
════════════════════════════════════════════════════════════════════*/

  window.SwipeChips = (function () {

    /* ============================================================
       EL CARRIL · #listaWrap convertido en tira de páginas.
       Una página por chip PINTADO en pantalla (#filtros .chip):
       lo que se ve manda.
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

    /* ============================================================
       GEOMETRÍA SIMPLE · todas las páginas miden lo mismo que la
       vista: la página visible es el scrollLeft dividido por ese
       ancho, redondeado y clavado al rango real de páginas. El
       viaje a una página es ese mismo número multiplicado de
       vuelta. Nada más.
       ============================================================ */
    function indiceDeValor(v) {
      var c = carril();
      if (!c) return -1;
      var n = paginas().length;
      var w = c.clientWidth;
      if (!n || !w) return -1;
      var i = Math.round(v / w);
      if (i < 0) i = 0;
      if (i > n - 1) i = n - 1;
      return i;
    }

    function indiceActivo() {
      var c = carril();
      if (!c || c.hidden) return -1;
      return indiceDeValor(c.scrollLeft);
    }

    function irAPagina(i, suave) {
      var c = carril();
      if (!c || i < 0) return;
      var left = i * c.clientWidth;
      if (!suave) { c.scrollLeft = left; return; }
      var pag = paginas()[i];
      if (pag) fijarLuz(pag.getAttribute('data-chip'));
      try { c.scrollTo({ left: left, behavior: 'smooth' }); }
      catch (_) { c.scrollLeft = left; }
    }

    /* ============================================================
       LA LUZ DEL CHIP · SOLO la clase .activo en la barra mientras
       el carril viaja. Guardar la elección y avisar al resto es
       del asentamiento (y del pulso del dueño).
       LA LUZ FIJA · decidido el destino (soltar el arrastre o
       pulsar un chip), la luz se congela en ese chip hasta el
       asentamiento: ningún cálculo intermedio del viaje la
       devuelve al chip anterior — el destello del teléfono muere
       aquí.
       ============================================================ */
    var _chipLuz = null;
    var _luzFija = null;

    function fijarLuz(idChip) {
      _luzFija = idChip;
      _encenderLuz(idChip);
    }

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
       Crea las páginas (una por chip visible), posiciona el carril
       al chip activo SIN animación y engancha los oyentes. */
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

      _chipLuz = activo;
      _chipAvisado = activo;
      _luzFija = null;

      var idx = indiceDe(activo);
      if (idx > 0) irAPagina(idx, false);

      c.addEventListener('scroll', _enScroll, { passive: true });
      c.addEventListener('pointerdown', _alPresionar);
      c.addEventListener('pointermove', _alArrastrar);
      c.addEventListener('pointerup', _alSoltar);
      c.addEventListener('pointercancel', _alSoltar);
      c.addEventListener('pointerleave', _alSoltar);
      c.addEventListener('click', _suprimirClickTrasArrastre, true);

      _alVolar();

      /* nacimiento: agenda el primer asentamiento — Lista repinta
         TODAS las páginas vencidas (nacen pintadas) en cuanto la
         tira reposa. */
      _agendaAsentar();
    }

    /* ============================================================
       EN VUELO · mientras el carril viaja solo se hacen dos cosas
       ligeras: el chip de la página visible se ILUMINA (clase,
       nada más) y las fotos de las páginas que se asoman cobran.
       Nada se mueve, nada se pinta, nada se resetea en pleno
       vuelo. Primero se lee, después se escribe. Con la luz FIJA
       (destino decidido) la iluminación espera: nadie devuelve la
       luz a mitad del viaje.
       ============================================================ */
    var _raf = null;

    function _enScroll() {
      _agendaAsentar();
      if (_raf) return;
      _raf = requestAnimationFrame(function () {
        _raf = null;
        _alVolar();
      });
    }

    function _alVolar() {
      if (!_luzFija) {
        var i = indiceActivo();
        if (i >= 0) {
          var pag = paginas()[i];
          if (pag) _encenderLuz(pag.getAttribute('data-chip'));
        }
      }
      poblarVisibles();
    }

    /* ============================================================
       ASENTAMIENTO · 160ms sin scroll = reposo. Al reposo: la
       elección se guarda y se avisa UNA vez (solo si la llegada no
       fue avisada por un pulso), y sale 'carril:asentado' para que
       Lista repinte lo vencido.
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

      c.classList.remove('arrastrando');

      var i = indiceActivo();
      if (i < 0) return;

      /* el destino DECIDIDO manda sobre cualquier lectura tardía
         del teléfono: la luz termina donde se decidió, una vez */
      var idChip = _luzFija || paginas()[i].getAttribute('data-chip');
      _luzFija = null;
      _encenderLuz(idChip);

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
       EL DEDO Y EL RATÓN HACEN LO MISMO (touch/mouse/pen) ·
       AXIS LOCK: el arrastre decide eje con los primeros píxeles
       decisivos — si el gesto es vertical, suelta el carril para
       que la lista suba y baje; si es horizontal, mueve el carril
       (x1.5) y reserva el eje. Al soltar, UNA animación lleva el
       carril a la página más cercana y el imán vuelve a mandar.
       El click que el arrastre deje a medio camino se suprime.
       Un solo camino para todos los punteros: el dedo deja de
       fiarse del imán nativo del teléfono (que revira y rebota)
       y obedece la misma ley que el ratón de la PC.
       ============================================================ */
    var _drag = null;
    var _suprimir = false;

    function _alPresionar(e) {
      if (_drag) return;
      var c = carril();
      if (!c || c.hidden || c.classList.contains('fijo')) return;

      _luzFija = null;   /* gesto nuevo: la luz vuelve a vivir */
      _drag = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        scroll0: c.scrollLeft,
        eje: null,
        movio: false,
        ultimo: null
      };
      c.classList.add('arrastrando');
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function _alArrastrar(e) {
      if (!_drag || e.pointerId !== _drag.id) return;
      var dx = e.clientX - _drag.x0;
      var dy = e.clientY - _drag.y0;

      /* AXIS LOCK: los primeros píxeles DECISIVOS (6) eligen el
         eje; antes de eso solo es ruido de dedo — nada se decide */
      if (!_drag.eje) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) <= Math.abs(dy)) { _soltarEjeY(e); return; }
        _drag.eje = 'x';
      }
      if (_drag.eje !== 'x') return;

      if (Math.abs(dx) > 8) _drag.movio = true;
      if (e.cancelable) e.preventDefault();
      var c = carril();
      if (c) {
        _drag.ultimo = _drag.scroll0 - dx * 1.5;
        c.scrollLeft = _drag.ultimo;
      }
    }

    function _soltarEjeY(e) {
      _drag = null;
      var c = carril();
      if (!c) return;
      c.classList.remove('arrastrando');   /* el imán sigue mandando */
      try { c.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    function _alSoltar(e) {
      if (!_drag || (e.pointerId !== undefined && e.pointerId !== _drag.id)) return;
      var movio = _drag.movio;
      var fueHorizontal = _drag.eje === 'x';
      var ultimo = _drag.ultimo;
      _drag = null;

      var c = carril();
      if (!c) return;

      c.classList.remove('arrastrando');   /* el imán vuelve a mandar */

      if (fueHorizontal) {
        /* la página más cercana AL ÚLTIMO VALOR ESCRITO, UNA
           animación — sin releer scrollLeft (en el teléfono la
           lectura llega tarde y discute con la pluma) */
        irAPagina(indiceDeValor(
          (ultimo === null || ultimo === undefined) ? c.scrollLeft : ultimo
        ), true);
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
         viajar (respiro del pulso) y el carril viaja suave hasta
         la página pedida.
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

      var idx = indiceDe(idChip);
      if (idx < 0) return;

      /* RESPIRO VERTICAL DEL PULSO: arriba antes de viajar */
      var wrap = document.querySelector('.secciones-wrap');
      if (wrap) wrap.scrollTop = 0;

      if (indiceActivo() === idx) return;   /* ya está en ella */
      irAPagina(idx, true);
    });

    return {
      poblarVisibles: poblarVisibles
    };
  })();
