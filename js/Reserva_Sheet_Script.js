/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Reserva_Sheet_Script.html
ESPEJO GITHUB:   github/js/Reserva_Sheet_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Infraestructura del bottom sheet. Apertura,
                 cierre, drag con inercia, backdrop, scroll.
                 NO conoce el flujo de reserva: recibe HTML y
                 callbacks. Reutilizable para cualquier sheet.
VERSIÓN:         1.2
CAMBIOS:         R131: sin cambios de código — solo simplificación del encabezado (el historial de rondas previas vive en la bitácora y en versiones/).
DEPENDENCIAS:    Index.html (.area-contenido), Global_CSS.html y
                 Reserva_CSS.html (clases .sheet-*, .reserva-root)
════════════════════════════════════════════════════════════════════*/


  window.Sheet = (function () {

    var UMBRAL_VELOCIDAD = 0.5;
    var UMBRAL_DRAG      = 6;

    var raiz       = null;
    var backdrop   = null;
    var sheet      = null;
    var handleArea = null;
    var content    = null;
    var btnClose   = null;

    var abierto       = false;
    var onCloseCb     = null;
    var onScrollCb    = null;

    var dragActivo = false;
    var dragMoved = false;
    var dragPointerId = null;
    var dragStartY = 0;
    var dragUltimoY = 0;
    var dragUltimoT = 0;
    var dragVelocidad = 0;
    var dragDesdeHandle = false;

    /* ============================================================
       Construir DOM base (una sola vez por sesión)
       ============================================================ */
    function construir() {
      if (raiz) return;
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      raiz = document.createElement('div');
      raiz.className = 'reserva-root';
      raiz.innerHTML =
        '<div class="sheet-backdrop"></div>' +
        '<div class="sheet">' +
          '<div class="sheet-handle-area"><div class="sheet-handle"></div></div>' +
          '<button class="sheet-close" type="button" aria-label="Cerrar" data-glifo="close"></button>' +
          '<button class="sheet-back" type="button" aria-label="Volver" data-glifo="volver"></button>' +
          '<div class="sheet-content"></div>' +
        '</div>';

      area.appendChild(raiz);

      backdrop   = raiz.querySelector('.sheet-backdrop');
      sheet      = raiz.querySelector('.sheet');
      handleArea = raiz.querySelector('.sheet-handle-area');
      content    = raiz.querySelector('.sheet-content');
      btnClose   = raiz.querySelector('.sheet-close');

      backdrop.addEventListener('click', cerrar);
      btnClose.addEventListener('click', cerrar);
      handleArea.addEventListener('pointerdown', onDragDown);
      content.addEventListener('pointerdown', onContentDown);
      content.addEventListener('scroll', function () {
        if (typeof onScrollCb === 'function') onScrollCb(content.scrollTop);
      });

      /* R128 · el esqueleto lleva glifos del registro (close/
         volver/volver arriba): se pintan aquí. El pintador tiene
         guardia por elemento: el repintado del content no duplica. */
      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(raiz);
      }
    }

    /* ============================================================
       Abrir
       opts: { content, color, onClose, onScroll }
       ============================================================ */
    function abrir(opts) {
      construir();
      if (!raiz) return;

      opts = opts || {};
      onCloseCb  = opts.onClose  || null;
      onScrollCb = opts.onScroll || null;

      if (opts.color) content.style.setProperty('--post-color', opts.color);
      if (typeof opts.content === 'string') content.innerHTML = opts.content;
      content.scrollTop = 0;

      sheet.classList.remove('solo-volver', 'con-privacidad', 'scroll-mas', 'subvista');

      sheet.classList.add('sin-transicion');
      sheet.style.transform = 'translateY(100%)';
      raiz.classList.add('abierto');
      sheet.classList.add('abierto');

      void sheet.offsetHeight;
      sheet.classList.remove('sin-transicion');

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sheet.style.transform = 'translateY(0)';
          backdrop.classList.add('visible');
        });
      });

      abierto = true;
    }

    /* ============================================================
       Cerrar
       ============================================================ */
    function cerrar() {
      if (!abierto) return;
      abierto = false;

      backdrop.classList.remove('visible');
      sheet.style.transform = 'translateY(100%)';

      setTimeout(function () {
        if (!abierto) {
          sheet.classList.remove('abierto', 'solo-volver', 'con-privacidad', 'scroll-mas', 'subvista');
          raiz.classList.remove('abierto');
          if (content) content.innerHTML = '';
        }
        if (typeof onCloseCb === 'function') {
          var cb = onCloseCb;
          onCloseCb = null;
          cb();
        }
      }, 420);
    }

    /* ============================================================
       Helpers públicos
       ============================================================ */
    function setContent(html) {
      if (!content) return;
      content.innerHTML = html || '';
      content.scrollTop = 0;
    }

    function getContent() { return content; }

    function isAbierto() { return abierto; }

    function mostrarBack() { if (sheet) sheet.classList.add('solo-volver'); }
    function ocultarBack() { if (sheet) sheet.classList.remove('solo-volver'); }
    function activarGradientePrivacidad() {
      if (!sheet || !content) return;
      sheet.classList.add('con-privacidad');
      var hayMas = (content.scrollTop + content.clientHeight) < (content.scrollHeight - 8);
      sheet.classList.toggle('scroll-mas', hayMas);
    }
    function desactivarGradientePrivacidad() {
      if (!sheet) return;
      sheet.classList.remove('con-privacidad', 'scroll-mas');
    }

    /* ============================================================
       Drag
       ============================================================ */
    function onDragDown(e) { iniciarDrag(e, true); }
    function onContentDown(e) {
      if (content.scrollTop > 0) return;
      iniciarDrag(e, false);
    }

    function iniciarDrag(e, desdeHandle) {
      if (!abierto) return;
      if (e.button !== undefined && e.button !== 0) return;

      dragActivo = true;
      dragMoved = false;
      dragDesdeHandle = desdeHandle;
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragUltimoY = e.clientY;
      dragUltimoT = performance.now();
      dragVelocidad = 0;

      if (desdeHandle) {
        handleArea.addEventListener('pointermove', onDragMove);
        handleArea.addEventListener('pointerup', onDragEnd);
        handleArea.addEventListener('pointercancel', onDragEnd);
      } else {
        content.addEventListener('pointermove', onDragMove);
        content.addEventListener('pointerup', onDragEnd);
        content.addEventListener('pointercancel', onDragEnd);
      }
    }

    function onDragMove(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;

      var dy = e.clientY - dragStartY;

      if (!dragMoved) {
        if (Math.abs(dy) < UMBRAL_DRAG) return;
        dragMoved = true;
        sheet.classList.add('sin-transicion');
        if (!dragDesdeHandle && dy < 0) { cancelarDrag(); return; }
        try {
          (dragDesdeHandle ? handleArea : content).setPointerCapture(e.pointerId);
        } catch (err) {}
      }

      var altura = sheet.offsetHeight;
      var pct = (dy / altura) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      e.preventDefault();
      sheet.style.transform = 'translateY(' + pct + '%)';

      var ahora = performance.now();
      var dt = ahora - dragUltimoT;
      if (dt > 0) {
        var v = (e.clientY - dragUltimoY) / dt;
        dragVelocidad = dragVelocidad * 0.7 + v * 0.3;
        dragUltimoY = e.clientY;
        dragUltimoT = ahora;
      }
    }

    function onDragEnd(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;
      dragActivo = false;
      dragPointerId = null;

      if (!dragMoved) { limpiarDrag(); return; }
      dragMoved = false;
      sheet.classList.remove('sin-transicion');

      var t = sheet.style.transform || '';
      var m = t.match(/translateY\(([\d.]+)%\)/);
      var pct = m ? parseFloat(m[1]) : 0;

      var cerrarSheet = (dragVelocidad > UMBRAL_VELOCIDAD) || (pct > 30);
      if (cerrarSheet) cerrar();
      else sheet.style.transform = 'translateY(0)';

      limpiarDrag();
    }

    function cancelarDrag() {
      dragActivo = false;
      dragMoved = false;
      dragPointerId = null;
      sheet.classList.remove('sin-transicion');
      sheet.style.transform = 'translateY(0)';
      limpiarDrag();
    }

    function limpiarDrag() {
      handleArea.removeEventListener('pointermove', onDragMove);
      handleArea.removeEventListener('pointerup', onDragEnd);
      handleArea.removeEventListener('pointercancel', onDragEnd);
      content.removeEventListener('pointermove', onDragMove);
      content.removeEventListener('pointerup', onDragEnd);
      content.removeEventListener('pointercancel', onDragEnd);
    }

    return {
      abrir:      abrir,
      cerrar:     cerrar,
      setContent: setContent,
      getContent: getContent,
      isAbierto:  isAbierto,
      mostrarBack: ocultarBack,
      mostrarVolver: mostrarBack,
      ocultarVolver: ocultarBack,
      activarGradientePrivacidad:   activarGradientePrivacidad,
      desactivarGradientePrivacidad: desactivarGradientePrivacidad
    };

  })();
