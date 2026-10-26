/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Orden_Sheet_Script.html
ESPEJO GITHUB:   github/js/Orden_Sheet_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo Ordenar (R66): el bottom sheet que abre el
                 botón ordenar (#btnOrdenar, fila 1 de la sección
                 filtros). Ofrece el ORDEN de la vidriera en 6
                 opciones y emite 'orden:change' (lo consume
                 Lista_Script, que repinta con el orden aplicado):

                 · recomendado  — el orden original de la hoja
                 · nombre-asc   — título A → Z
                 · nombre-desc  — título Z → A
                 · categoria    — agrupados por su grupo (A → Z)
                 · compartido   — mayor nº de compartidos, ceros al final
                 · valoracion   — mayor nº de likes, ceros al final

                 Al elegir: haptic + la tarjeta marca .activa al
                 instante (check naranja) y el sheet baja a los
                 ~220 ms — la elección se VE antes de cerrar.
                 El botón queda con el PUNTO naranja (.con-orden)
                 mientras el orden activo NO sea el recomendado.
                 La mecánica del sheet (backdrop, drag con
                 velocidad, cierre, haptic) replica a
                 Ciudad_Sheet_Script — módulos hermanos. El orden
                 es de SESIÓN: al recargar vuelve a recomendado.
VERSIÓN:         1.2
CAMBIOS:         R128: la X del sheet sale del registro (data-glifo close) y el esqueleto se pinta en construirDOM. El CSS .ordenar-close svg sigue mandando.
CAMBIOS:         R67: RENOMBRADO por orden del dueño: Filtros_Sheet_*
                 pasa a Orden_Sheet_* (el sheet es de ordenamiento,
                 no de filtro — corrección de nombre del dueño).
                 Ni una línea de lógica tocada.
                 R66: NACE el módulo — fuera la inercia de "sin
                 acción todavía": el botón ordena de verdad. 6
                 opciones como tarjetas del lenguaje de la ciudad
                 (R65), entrada escalonada (--i), cierre con
                 rebote, punto indicador en el botón. Sin
                 persistencia (sesión) y sin modo bloqueado
                 (nunca es obligatorio).
DEPENDENCIAS:    Index.html (#btnOrdenar, .area-contenido),
                 Iconos.html (window.pintarGlifos), Lista_CSS.html
                 (consumidor del evento: Lista_Script),
                 Chips_CSS.html (.btn-ordenar .con-orden)
════════════════════════════════════════════════════════════════════*/


  window.Ordenar = (function () {

    /* ============================================================
       OPCIONES DEL SHEET (orden del dueño, R66)
       glifo → Iconos 2.0 (lista/grupos/alfabeto) y reutilizados
       (share/estrella); el check activo reutiliza verificado.
       ============================================================ */
    var OPCIONES = [
      { id: 'recomendado',  glifo: 'lista',    titulo: 'Recomendado',
        desc: 'El orden original de la vidriera' },
      { id: 'nombre-asc',   glifo: 'alfabeto', titulo: 'Nombre · A → Z',
        desc: 'Alfabético ascendente' },
      { id: 'nombre-desc',  glifo: 'alfabeto', titulo: 'Nombre · Z → A',
        desc: 'Alfabético descendente' },
      { id: 'categoria',    glifo: 'grupos',   titulo: 'Por categoría',
        desc: 'Agrupados por su grupo, A → Z' },
      { id: 'compartido',   glifo: 'share',    titulo: 'Más compartidos',
        desc: 'Mayor número de compartidos · ceros al final' },
      { id: 'valoracion',   glifo: 'estrella', titulo: 'Mejor valorados',
        desc: 'Con más likes primero · ceros al final' }
    ];

    var ORDEN_DEFAULT = 'recomendado';

    /* Estado */
    var ordenActual = ORDEN_DEFAULT;

    /* Sheet */
    var raiz       = null;
    var backdrop   = null;
    var sheet      = null;
    var handleArea = null;
    var content    = null;
    var abierto    = false;

    /* Botón */
    var btnOrdenar = null;

    /* Drag */
    var UMBRAL_DRAG      = 6;
    var UMBRAL_VELOCIDAD = 0.5;

    var dragActivo    = false;
    var dragMoved     = false;
    var dragPointerId = null;
    var dragStartY    = 0;
    var dragUltimoY   = 0;
    var dragUltimoT   = 0;
    var dragVelocidad = 0;

    /* ============================================================
       Helpers
       ============================================================ */
    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    /* El sheet nunca entra en detalle ni en compartido (su botón
       se retira, pero la guardia evita estados raros). */
    function puedeAbrir() {
      return !document.body.classList.contains('modo-detalle') &&
             !document.body.classList.contains('modo-compartido');
    }

    /* ============================================================
       Punto indicador del botón · hay orden distinto del original
       ============================================================ */
    function actualizarBoton() {
      if (!btnOrdenar) return;
      btnOrdenar.classList.toggle('con-orden', ordenActual !== ORDEN_DEFAULT);
      btnOrdenar.setAttribute(
        'aria-label',
        ordenActual !== ORDEN_DEFAULT ? 'Ordenar. Orden activo: ' + etiquetaDe(ordenActual)
                                      : 'Ordenar'
      );
    }

    function etiquetaDe(id) {
      for (var i = 0; i < OPCIONES.length; i++) {
        if (OPCIONES[i].id === id) return OPCIONES[i].titulo;
      }
      return '';
    }

    /* ============================================================
       Enganchar botón · llamado por Core tras inyectar lienzo
       ============================================================ */
    function engancharBoton() {
      btnOrdenar = document.getElementById('btnOrdenar');
      if (!btnOrdenar) return;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(btnOrdenar);
      }

      initDelegacionBoton();
      actualizarBoton();
    }

    function initDelegacionBoton() {
      if (document.__ordenarDelegado === '1') return;
      document.__ordenarDelegado = '1';

      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('#btnOrdenar');
        if (!btn) return;
        e.preventDefault();
        if (abierto) cerrar();
        else abrir();
      });
    }

    /* ============================================================
       Sheet · construir DOM (estructura hermana de Ciudad)
       ============================================================ */
    function construirDOM() {
      if (raiz) return;
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      raiz = document.createElement('div');
      raiz.className = 'ordenar-root';
      raiz.innerHTML =
        '<div class="ordenar-backdrop"></div>' +
        '<div class="ordenar-sheet">' +
          '<div class="ordenar-handle-area"><div class="ordenar-handle"></div></div>' +
          '<button class="ordenar-close" type="button" aria-label="Cerrar" data-glifo="close"></button>' +
          '<div class="ordenar-content"></div>' +
        '</div>';

      area.appendChild(raiz);

      backdrop   = raiz.querySelector('.ordenar-backdrop');
      sheet      = raiz.querySelector('.ordenar-sheet');
      handleArea = raiz.querySelector('.ordenar-handle-area');
      content    = raiz.querySelector('.ordenar-content');

      backdrop.addEventListener('click', cerrar);
      raiz.querySelector('.ordenar-close').addEventListener('click', cerrar);
      handleArea.addEventListener('pointerdown', onDragDown);

      /* R128 · el esqueleto lleva glifos del registro (close/
         volver/volver arriba): se pintan aquí. El pintador tiene
         guardia por elemento: el repintado del content no duplica. */
      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(raiz);
      }
    }

    /* ============================================================
       TARJETAS DE OPCIONES · stack nativo (hermana de las
       tarjetas de ciudad, R65): icono en pastilla + título +
       descripción + check SOLO en la activa. La tarjeta activa
       entra MARCADA de una vez (sin repintado feo).
       ============================================================ */
    function pintarContenido() {
      if (!content) return;

      var html = '<h2 class="ordenar-titulo">Ordenar por</h2>';
      html += '<div class="ordenar-opciones">';

      OPCIONES.forEach(function (op, i) {
        var esActual = ordenActual === op.id;

        html +=
          '<button type="button" class="ordenar-card' +
            (esActual ? ' activa' : '') +
            '" data-orden="' + op.id + '" style="--i:' + i + '"' +
            ' aria-pressed="' + (esActual ? 'true' : 'false') + '">' +
            '<span class="ordenar-icono" data-glifo="' + op.glifo + '" aria-hidden="true"></span>' +
            '<span class="ordenar-texto">' +
              '<span class="ordenar-opt-titulo">' + op.titulo + '</span>' +
              '<span class="ordenar-opt-desc">' + op.desc + '</span>' +
            '</span>' +
            '<span class="ordenar-check" data-glifo="verificado" aria-hidden="true"></span>' +
          '</button>';
      });

      html += '</div>';
      content.innerHTML = html;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(content);
      }

      content.querySelectorAll('.ordenar-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var id = this.getAttribute('data-orden');
          if (!id) return;

          haptic(10);

          /* Marcar al instante: la elección se VE antes de que
             el sheet baje (feedback vivo, como las apps
             populares). */
          content.querySelectorAll('.ordenar-card').forEach(function (c) {
            c.classList.toggle('activa', c === card);
            c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
          });

          if (id !== ordenActual) {
            ordenActual = id;
            actualizarBoton();

            document.dispatchEvent(new CustomEvent('orden:change', {
              detail: { orden: ordenActual }
            }));
          }

          setTimeout(cerrar, 220);
        });
      });
    }

    /* ============================================================
       Sheet · abrir/cerrar
       ============================================================ */
    function abrir() {
      if (abierto) return;
      if (!puedeAbrir()) return;

      construirDOM();
      if (!raiz) return;

      pintarContenido();
      haptic(10);

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
          abierto = true;
        });
      });
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;

      backdrop.classList.remove('visible');
      sheet.style.transform = 'translateY(100%)';

      setTimeout(function () {
        if (!abierto) {
          sheet.classList.remove('abierto');
          raiz.classList.remove('abierto');
        }
      }, 420);
    }

    /* ============================================================
       Drag del handle · misma física que Ciudad (velocidad)
       ============================================================ */
    function onDragDown(e) {
      if (!abierto) return;
      if (e.button !== undefined && e.button !== 0) return;

      dragActivo = true;
      dragMoved = false;
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragUltimoY = e.clientY;
      dragUltimoT = performance.now();
      dragVelocidad = 0;

      handleArea.addEventListener('pointermove', onDragMove);
      handleArea.addEventListener('pointerup', onDragEnd);
      handleArea.addEventListener('pointercancel', onDragEnd);
    }

    function onDragMove(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;

      var dy = e.clientY - dragStartY;

      if (!dragMoved) {
        if (Math.abs(dy) < UMBRAL_DRAG) return;
        dragMoved = true;
        sheet.classList.add('sin-transicion');
        try { handleArea.setPointerCapture(e.pointerId); } catch (err) {}
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

      if ((dragVelocidad > UMBRAL_VELOCIDAD) || (pct > 30)) cerrar();
      else sheet.style.transform = 'translateY(0)';

      limpiarDrag();
    }

    function limpiarDrag() {
      handleArea.removeEventListener('pointermove', onDragMove);
      handleArea.removeEventListener('pointerup', onDragEnd);
      handleArea.removeEventListener('pointercancel', onDragEnd);
    }

    /* ============================================================
       API pública
       ============================================================ */
    return {
      engancharBoton: engancharBoton,
      abrir:          abrir,
      cerrar:         cerrar,
      getOrden:       function () { return ordenActual; }
    };

  })();
