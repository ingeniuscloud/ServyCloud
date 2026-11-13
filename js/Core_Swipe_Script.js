/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Swipe_Script.html
ESPEJO GITHUB:   github/js/Core_Swipe_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.SwipeChips — el desplazamiento lateral del
                 área de items. EL MODELO: pantallas cargadas,
                 desplazamiento lateral simple, el chip manda y la
                 mano solo hace espectáculo. Nada más.
                 · PANTALLAS CARGADAS: la tira es una página por
                   chip visible (#filtros .chip), todas nacen
                   pintadas; el desplazamiento no carga nada, solo
                   viaja.
                 · EL IMÁN CLAVA AL SOLTAR: el imán vive en el CSS y
                   lo aplica el navegador. Mientras un arrastre
                   camina, el imán duerme (.arrastrando); al soltar,
                   UNA animación lleva el carril a la página más
                   cercana y el imán despierta apuntando a la misma
                   página: nadie tira con nadie.
                 · LA LUZ QUE SE APAGA Y NACE · EL IMÁN PROPONE,
                   EL CHIP DISPONE: en cuanto el swipe COMIENZA
                   (el candado de eje decide 'x'), la luz del
                   chip muere AL INSTANTE — sin transición, sin
                   despedida — y la tira sigue viajando SIN
                   ninguna luz, en silencio total (nadie escribe
                   nada fuera del carril). Cuando el imán
                   estaciona y la tira reposa, el carril lee la
                   página estacionada y la luz NACE en su chip:
                   de transparente a su color, con la transición
                   propia del chip (0.18s) — una sola animación
                   de aparición, con todo quieto. ADOPTAR, nunca
                   imponer: la lista no se mueve ni un píxel. Si
                   estacionó en el valor ya real, la luz nace
                   igual y el silencio se mantiene: cero eventos,
                   cero escritura. Si es un valor nuevo, el chip
                   comete el cambio (memoria + aviso) y su propio
                   eco regresa apagado (el carril no vuelve a
                   viajar: ya está en ella).
                 · LA LUZ ES DEL CHIP: el swipe la APAGA al
                   comenzar (instante, sin despedida) y la NACE
                   al reposar (transparente → color, suave); un
                   pulso (tap) la clava en su chip como siempre.
                 · GEOMETRÍA SIMPLE: todas las páginas miden lo
                   mismo que la vista — la página visible es
                   scrollLeft dividido por ese ancho, redondeado y
                   clavado al rango real de páginas. El viaje a una
                   página es ese mismo número multiplicado de
                   vuelta.
                 · UNA SOLA LEY PARA TODOS LOS PUNTEROS: la pluma es
                   la ÚNICA mano del horizontal — ratón, dedo y pen
                   viajan el MISMO camino (axis lock: decide eje con
                   los primeros píxeles decisivos; si el gesto es
                   vertical suelta el carril para que la lista suba
                   y baje; si es horizontal lo mueve x1.5 y al
                   soltar UNA animación aterriza la página más
                   cercana). Al navegador se le RETIRA el permiso
                   horizontal sobre el carril: touch-action pan-y
                   clavado en Core_CSS — solo le deja el vertical —
                   y, para equipos viejos que lo ignoren, un veto
                   touchmove que solo actúa cuando el eje ya es
                   horizontal. Dos fuerzas escribiendo el mismo
                   carril fue la guerra que enloqueció el teléfono:
                   hoy es imposible por construcción — nadie más
                   tiene la mano.
                 · DIRECCIÓN FÍSICA: empujar el listado a la
                   IZQUIERDA muestra la lista de la DERECHA; a la
                   derecha, la de la IZQUIERDA. Los extremos no
                   ciclan.
                 · UN CHIP POR GESTO: al soltar, el aterrizaje lleva
                   el carril a la página MÁS CERCANA y clava ahí —
                   el gesto termina donde la mano decidió, sin
                   rebotes ni segundas fuerzas.
                 · RESPIRO VERTICAL DEL PULSO: el scroll vertical
                   vuelve arriba cuando el dueño PULSA un chip
                   (antes de viajar), jamás como consecuencia del
                   deslizamiento.
                 · EL CHIP MANDA: el chip es la ÚNICA autoridad
                   del cambio real. Un click en un chip —
                   encendido o no — pide el viaje suave hasta su
                   página; el tap sobre el encendido es la vuelta
                   a la página real. La mano no comete nada por
                   sí misma: al estacionar le cede la palabra al
                   chip (adopción suave) y EL CHIP comete.
                 · FOTOS A DEMANDA: las fotos de las páginas solo
                   bajan cuando la página se acerca a la vista
                   (poblarVisibles, llamada por Lista al pintar y
                   por el propio carril al deslizar). La memoria
                   L2 (SeccionImagen) guarda cada foto: se baja UNA
                   vez y repinta desde disco sin red.
                 · CON BÚSQUEDA ACTIVA el carril se fija (clase
                   .fijo): los resultados viven en la página
                   visible hasta limpiar la búsqueda.
VERSIÓN:         3.6
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
       vista. ESCRIBIR: el viaje a una página es su número
       multiplicado por el ancho de la vista. LEER: la página
       visible es la cuyo centro queda en el medio de la vista,
       medida con los rectángulos reales (los mismos que usa el
       poblado de fotos) — el scrollLeft del teléfono llega tarde
       y devolvía la luz al chip de atrás a mitad de llegada.
       Nada más.
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
      var pgs = paginas();
      var n = pgs.length;
      if (!n) return -1;
      var crect = c.getBoundingClientRect();
      var w = crect.width;
      if (!w) return -1;
      var centro = crect.left + w / 2;
      var mejor = -1;
      var mejorD = Infinity;
      for (var i = 0; i < n; i++) {
        var r = pgs[i].getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - centro);
        if (d < mejorD) { mejorD = d; mejor = i; }
      }
      return mejor;
    }

    function irAPagina(i, suave, conLuz) {
      var c = carril();
      if (!c || i < 0) return;
      var left = i * c.clientWidth;
      if (!suave) { c.scrollLeft = left; return; }
      var pag = paginas()[i];
      if (pag && conLuz !== false) fijarLuz(pag.getAttribute('data-chip'));
      try { c.scrollTo({ left: left, behavior: 'smooth' }); }
      catch (_) { c.scrollLeft = left; }
    }

    /* ============================================================
       LA LUZ DEL CHIP · SOLO la clase .activo en la barra. Guardar
       la elección y avisar al resto es del asentamiento (y del
       pulso del dueño).
       EL APAGÓN · al comenzar el swipe (eje 'x' decidido) la luz
       muere AL INSTANTE: transition none + reflujo, y el chip
       recobra su transición propia — la muerte no negocia, el
       nacimiento será suave. La tira viaja sin ninguna luz.
       LA LUZ FIJA · decidido el destino (soltar el arrastre o
       pulsar un chip), NADA enciende chips hasta el asentamiento:
       ningún cálculo intermedio del viaje devuelve la luz — el
       destello del teléfono muere aquí.
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

    /* EL APAGÓN · la muerte INSTANTÁNEA de la luz: solo llega
       aquí el chip encendido — transition none, la clase fuera,
       reflujo para que la muerte se escriba YA, y el chip
       recobra su transición propia (el nacimiento será suave).
       Un gesto vertical jamás llega aquí: suelta el carril con
       su luz intacta. */
    function _apagonLuzYa() {
      var contenedor = document.getElementById('filtros');
      if (!contenedor) return;
      var encendidos = contenedor.querySelectorAll('.chip.activo');
      for (var i = 0; i < encendidos.length; i++) {
        var chip = encendidos[i];
        chip.style.transition = 'none';
        chip.classList.remove('activo');
        void chip.offsetWidth;
        chip.style.transition = '';
      }
      _chipLuz = null;
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

      /* VETO DE EMERGENCIA · para equipos viejos que ignoran
         touch-action: si la pluma ya reservó el eje horizontal,
         el touchmove se cancela y el navegador no puede panear
         mientras la pluma escribe. Solo actúa con el eje 'x'
         ya decidido: el vertical de las listas jamás se toca. */
      c.addEventListener('touchmove', function (e) {
        if (_drag && _drag.eje === 'x' && e.cancelable) e.preventDefault();
      }, { passive: false });

      _alVolar();

      /* nacimiento: agenda el primer asentamiento — Lista repinta
         TODAS las páginas vencidas (nacen pintadas) en cuanto la
         tira reposa. */
      _agendaAsentar();
    }

    /* ============================================================
       EN VUELO · mientras el carril viaja solo se hacen dos cosas
       ligeras: las fotos de las páginas que se asoman cobran y —
       SOLO cuando no hay mano en el carril ni luz fija — el chip
       de la página visible se ILUMINA (clase, nada más). Durante
       el swipe la tira viaja SIN ninguna luz: el apagón manda y
       nadie la enciende a mitad del vuelo ni del aterrizaje.
       Nada se mueve, nada se pinta, nada se resetea en pleno
       vuelo. Primero se lee, después se escribe.
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
      if (!_drag && !_luzFija) {
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
       Lista repinte lo vencido. LA ADOPCIÓN SUAVE: el aterrizaje
       de una MANO termina aquí también — el chip adopta la página
       estacionada, una sola palabra al reposo.
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

      /* EL NACIMIENTO · aterrizaje de una MANO: el imán ya
         estacionó — ahora, con todo quieto, la luz nace en el
         chip de la página estacionada. Una sola aparición. */
      if (_fueMano) {
        _fueMano = false;
        c.classList.remove('arrastrando');
        _adoptarEstacionado();
        return;
      }

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
       EL NACIMIENTO · el imán estacionó y la tira reposa: aquí
       —y solo aquí— la mano habla. Se lee la página estacionada
       (vecino más cercano, rectángulos reales) y la luz NACE en
       el chip de esa página: de transparente a su color, con la
       transición propia del chip (0.18s) — una sola animación de
       aparición, con todo absolutamente quieto. Si el valor
       estacionado es DISTINTO del real, el CHIP comete el
       cambio: la elección se escribe en memoria y su eco
       'chips:change' regresa APAGADO (_avisandoLlegada): el
       carril no vuelve a viajar — ya está en ella. Si estacionó
       en el valor ya real, la luz nace igual y el silencio se
       mantiene: cero eventos, cero escritura. ADOPTAR, nunca
       imponer: la lista no se mueve ni un píxel y el respiro
       vertical sigue siendo exclusivo del pulso.
       ============================================================ */
    function _adoptarEstacionado() {
      var i = indiceActivo();
      if (i < 0) { _luzFija = null; return; }

      var pag = paginas()[i];
      var idChip = pag ? pag.getAttribute('data-chip') : null;
      if (!idChip) { _luzFija = null; return; }

      _luzFija = null;         /* el congelamiento muere al reposar */
      _encenderLuz(idChip);    /* LA LUZ NACE: transparente → color, una vez, suave */

      /* estacionó en el valor ya real: la luz volvió y NADA más
         se dice — cero eventos, cero escritura. Silencio total. */
      if (_chipAvisado === idChip) return;

      _chipAvisado = idChip;   /* una sola palabra por cambio */

      /* LA PALABRA ÚNICA · el chip comete el cambio real
         (memoria y aviso); su eco regresa apagado — nadie
         re-viaja, nadie re-centra. */
      _avisandoLlegada = true;
      try {
        if (window.Chips && typeof window.Chips.seleccionar === 'function') {
          window.Chips.seleccionar(idChip);
        }
      } finally {
        _avisandoLlegada = false;
      }

      /* aviso de llegada: Lista repinta SOLO lo vencido, sin
         respiro vertical (el deslizamiento jamás toca tu lectura) */
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
       LA PLUMA · TODOS LOS PUNTEROS (ratón, dedo y pen) · AXIS
       LOCK: el arrastre decide eje con los primeros píxeles
       decisivos — si el gesto es vertical, suelta el carril para
       que la lista suba y baje (nativa); si es horizontal, mueve
       el carril (x1.5) y reserva el eje. Al soltar, UNA animación
       lleva el carril a la página más cercana y el imán vuelve a
       mandar. El click que el arrastre deje a medio camino se
       suprime.
       UNA SOLA MANO DEL HORIZONTAL: el permiso nativo está
       retirado (touch-action pan-y en Core_CSS + veto touchmove
       de emergencia) — nadie camina antes del candado de eje, la
       base del arrastre nunca envejece y NADIE más escribe este
       carril mientras la pluma lo mueve.
       ============================================================ */
    var _drag = null;
    var _suprimir = false;
    var _fueMano = false;   /* el aterrizaje viene de una mano, no de un pulso */

    function _alPresionar(e) {
      if (_drag) return;
      var c = carril();
      if (!c || c.hidden || c.classList.contains('fijo')) return;

      /* la luz nace y muere en el chip real; si la tira va a
         oscuras (re-agarre tras un apagón), el silencio visual
         se sostiene con el último chip cometido */
      _luzFija = _chipLuz || _chipAvisado;
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
        _apagonLuzYa();   /* el swipe COMIENZA: la luz muere ya, sin despedida */
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
           animación — sin releer el scrollLeft del navegador.
           viaja SIN ninguna luz (el apagón la mató al partir y
           la luz fija de la presión la sostiene apagada); al
           estacionar, la luz NACE en el chip de la página (el
           nacimiento: una sola aparición al reposo). */
        _fueMano = true;
        irAPagina(indiceDeValor(
          (ultimo === null || ultimo === undefined) ? c.scrollLeft : ultimo
        ), true, false);
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
       CHIPS:CHANGE · el PULSO del dueño. El nacimiento también
       pasa por aquí, pero su eco llega APAGADO (_avisandoLlegada):
       el carril reconoce su propia voz y no vuelve a viajar.
       · Carril sin nacer: nace aquí mismo.
       · Pulso real: el scroll vertical vuelve arriba ANTES de
         viajar (respiro del pulso), la luz se clava en el chip
         pulsado y el carril viaja suave hasta su página.
       ============================================================ */
    document.addEventListener('chips:change', function (e) {
      var idChip = e.detail && e.detail.idChip;
      var c = carril();
      if (!c) return;

      if (_avisandoLlegada) return;   /* consecuencia del asentamiento */

      _fueMano = false;   /* un pulso manda sobre cualquier mano en vuelo */

      if (!c.classList.contains('carril')) {
        _chipLuz = idChip;
        _chipAvisado = idChip;
        construir();
        return;
      }

      _chipAvisado = idChip;   /* el pulso avisa por sí mismo */
      _luzFija = idChip;       /* el pulso clava la luz en su chip */
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
