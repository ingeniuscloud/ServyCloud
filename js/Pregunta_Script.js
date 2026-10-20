/*══════════════════════════════════════════════════════════════════
ARCHIVO:         Pregunta_Script.html
ESPEJO GITHUB:   github/js/Pregunta_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Pregunta. Q&A del post completo en el
                 lienzo: campo de pregunta (X de limpiar como el
                 Buscar, contador restante con avisos, aviso corto),
                 publicación sin recargar (recientes primero) y sheet
                 al 90% para ver todas las preguntas con fade final.
                 Sin borrado y sin nombre de quien pregunta.
VERSIÓN:         1.0.0
CAMBIOS:         R77: Nace el archivo. Reemplaza al módulo de
                 comentarios del post: mismo camino de backend
                 (acciones comentario/comentarios y notificación
                 Telegram al partner, intactas) contra la tabla
                 "Pregunta" (IDPOST, IDDISPOSITIVO, TEXTO, FECHA,
                 ESTADO). No se puede borrar una pregunta publicada.
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Iconos.html (pintarGlifos), Seccion_Script.html
                 (monta buildHTML/enganchar/cargar), Seccion_CSS.html
                 (infra .mk-sheet-*), Pregunta_CSS.html,
                 Core_CSS.html (clases maestras)
══════════════════════════════════════════════════════════════════*/

  window.Pregunta = (function () {

    var MAX_CHARS = 250;
    var AVISO = 'Evita compartir datos personales.';

    var idPostActual = null;
    var preguntas    = [];
    var total        = 0;
    var hayMas       = false;
    var pagina       = 1;
    var cargando     = false;
    var enviando     = false;

    var el = {};          /* nodos del lienzo */
    var sheetRoot = null; /* root del sheet ver todas (lazy) */
    var sheetAbierto = false;

    function haptic(v) { if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} } }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    /* ============================================================
       HTML DE LA SECCIÓN (la monta Seccion_Script en su orden)
       ============================================================ */
    function buildHTML() {
      var html = '<div class="mk-hairline"></div>';
      html += '<div class="mk-qa-section">';
      html +=   '<h2 class="titulo mk-qa-titulo">Preguntas y respuestas</h2>';
      html +=   '<div class="preg-form">' +
                  '<div class="preg-input-wrap" id="pregWrap">' +
                    '<input type="text" class="preg-input" id="pregInput" ' +
                           'placeholder="Escribe tu pregunta..." maxlength="' + MAX_CHARS + '" ' +
                           'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
                           'aria-label="Escribe tu pregunta">' +
                    '<button type="button" class="preg-clear" id="pregClear" aria-label="Limpiar pregunta"><span data-glifo="close"></span></button>' +
                  '</div>' +
                  '<button type="button" class="preg-send" id="pregSend" disabled aria-label="Enviar pregunta"><span data-glifo="enviar"></span></button>' +
                '</div>';
      html +=   '<div class="preg-meta">' +
                  '<span class="preg-aviso cita">' + AVISO + '</span>' +
                  '<span class="preg-counter cita" id="pregCounter" hidden>' + MAX_CHARS + '</span>' +
                '</div>';
      html +=   '<div class="mk-qa-preview" id="pregPreview"></div>';
      html += '</div>';
      return html;
    }

    /* ============================================================
       EVENTOS DEL LIENZO
       ============================================================ */
    function enganchar(track) {
      el = {
        wrap:     track.querySelector('#pregWrap'),
        input:    track.querySelector('#pregInput'),
        clear:    track.querySelector('#pregClear'),
        send:     track.querySelector('#pregSend'),
        counter:  track.querySelector('#pregCounter'),
        preview:  track.querySelector('#pregPreview')
      };
      if (!el.input) return;

      el.input.addEventListener('input', function () {
        actualizarField();
      });
      el.input.addEventListener('focus', function () {
        if (el.wrap) el.wrap.classList.add('foco');
      });
      el.input.addEventListener('blur', function () {
        if (el.wrap) el.wrap.classList.remove('foco');
      });
      el.input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); publicar(); }
      });

      el.clear.addEventListener('click', function () {
        /* Como el Buscar: limpia y quita el foco siempre */
        el.input.value = '';
        actualizarField();
        try { el.input.blur(); } catch (err) {}
      });

      el.send.addEventListener('click', publicar);

      actualizarField();
    }

    function actualizarField() {
      var len = el.input.value.length;
      var tieneTexto = len > 0;

      if (el.wrap) el.wrap.classList.toggle('con-texto', tieneTexto);

      el.send.disabled = !tieneTexto || enviando;

      if (el.counter) {
        if (!tieneTexto) { el.counter.hidden = true; }
        else {
          el.counter.hidden = false;
          var restantes = MAX_CHARS - len;
          el.counter.textContent = String(restantes);
          el.counter.classList.remove('warn', 'danger');
          if (restantes <= 10) el.counter.classList.add('danger');
          else if (restantes <= 20) el.counter.classList.add('warn');
        }
      }
    }

    /* ============================================================
       CARGA Y VISTA PREVIA (recientes primero)
       ============================================================ */
    function cargar(idPost) {
      if (!idPost) return;
      idPostActual = idPost;
      cargando = true;
      postBackend('comentarios', { idPost: idPost, pagina: 1 })
        .then(function (data) {
          cargando = false;
          if (idPostActual !== idPost) return;
          preguntas = (data && (data.preguntas || data.comentarios)) || [];
          total     = (data && typeof data.total === 'number') ? data.total : preguntas.length;
          hayMas    = !!(data && data.hayMas);
          pagina    = 1;
          renderPreview();
        })
        .catch(function () { cargando = false; });
    }

    function renderPreview() {
      if (!el.preview) return;

      if (!preguntas.length) { el.preview.innerHTML = ''; return; }

      var html = '';
      var visibles = preguntas.slice(0, 2);

      visibles.forEach(function (c, i) {
        var esPenultima = (i === 1);
        html += '<div class="mk-qa-item' + (esPenultima ? ' preg-fade' : '') + '">';
        html +=   '<p class="mk-qa-question textoPrimario">' + escapeHtml(c.texto) + '</p>';
        html += '</div>';
      });

      el.preview.innerHTML = html;

      /* "Ver todas las preguntas" solo si hay penúltima con fade */
      var wrap = document.getElementById('pregVerTodasWrap');
      if (wrap) wrap.parentNode.removeChild(wrap);
      if (visibles.length >= 2) {
        wrap = document.createElement('div');
        wrap.className = 'mk-qa-vertodas-wrap';
        wrap.id = 'pregVerTodasWrap';
        wrap.innerHTML = '<button type="button" class="enlacesOpciones" id="pregVerTodas">Ver todas las preguntas</button>';
        el.preview.appendChild(wrap);
        wrap.querySelector('#pregVerTodas').addEventListener('click', function () {
          haptic(10);
          abrirSheet();
        });
      }
    }

    /* ============================================================
       PUBLICAR (sin recargar; recientes primero)
       ============================================================ */
    function publicar() {
      if (!idPostActual) return;
      var texto = el.input.value.trim();
      if (!texto || enviando) return;

      enviando = true;
      el.send.disabled = true;
      haptic([15, 10, 15]);

      postBackend('comentario', { idPost: idPostActual, texto: texto })
        .then(function (data) {
          enviando = false;

          preguntas.unshift({
            texto:         texto,
            fecha:         new Date().toISOString(),
            dispositivoId: (typeof getDeviceId === 'function' ? getDeviceId() : '')
          });
          if (data && typeof data.comenta === 'number') total = data.comenta;
          else total = total + 1;

          el.input.value = '';
          actualizarField();
          renderPreview();

          document.dispatchEvent(new CustomEvent('preguntas:change', {
            detail: { idPost: idPostActual, pregunta: total }
          }));

          if (sheetAbierto) cargarSheetLista();
        })
        .catch(function (err) {
          enviando = false;
          el.send.disabled = el.input.value.trim().length === 0;
          console.error('[Pregunta] No se pudo publicar:', err && err.message);
        });
    }

    /* ============================================================
       SHEET VER TODAS LAS PREGUNTAS · 90%, solo lectura
       ============================================================ */
    function construirSheet() {
      if (sheetRoot) return sheetRoot;
      var area = document.querySelector('.area-contenido') || document.body;

      sheetRoot = document.createElement('div');
      sheetRoot.className = 'mk-sheet-root preg-root';
      sheetRoot.id = 'pregSheetRoot';
      sheetRoot.innerHTML =
        '<div class="mk-sheet-backdrop" id="pregSheetBackdrop"></div>' +
        '<div class="mk-sheet" id="pregSheet">' +
          '<div class="mk-sheet-handle-area"><div class="mk-sheet-handle"></div></div>' +
          '<button type="button" class="mk-sheet-close" id="pregSheetClose" data-glifo="close" aria-label="Cerrar"></button>' +
          '<div class="mk-sheet-content preg-sheet-content" id="pregSheetContent">' +
            '<div class="preg-sheet-lista" id="pregSheetLista"></div>' +
            '<div class="preg-sheet-fade" id="pregSheetFade"></div>' +
          '</div>' +
        '</div>';

      area.appendChild(sheetRoot);
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(sheetRoot);

      sheetRoot.querySelector('#pregSheetBackdrop').addEventListener('click', cerrarSheet);
      sheetRoot.querySelector('#pregSheetClose').addEventListener('click', cerrarSheet);

      var content = sheetRoot.querySelector('#pregSheetContent');
      content.addEventListener('scroll', function () {
        var fade = sheetRoot.querySelector('#pregSheetFade');
        if (!fade) return;
        var alFinal = (content.scrollTop + content.clientHeight) >= (content.scrollHeight - 4);
        fade.classList.toggle('fin', alFinal);
      }, { passive: true });

      return sheetRoot;
    }

    function cargarSheetLista() {
      var lista = sheetRoot.querySelector('#pregSheetLista');
      if (!lista || !idPostActual) return;
      lista.innerHTML = '<p class="textoSecundario preg-sheet-cargando">Cargando preguntas...</p>';

      var todas = [];
      var paginaLocal = 1;

      function pedir() {
        return postBackend('comentarios', { idPost: idPostActual, pagina: paginaLocal })
          .then(function (data) {
            var lote = (data && (data.preguntas || data.comentarios)) || [];
            todas = todas.concat(lote);
            hayMas = !!(data && data.hayMas);
            paginaLocal = paginaLocal + 1;
            if (hayMas && paginaLocal <= 10) return pedir();
          });
      }

      pedir()
        .then(function () {
          if (!sheetRoot || !sheetRoot.classList.contains('abierto')) return;
          var html = '';
          todas.forEach(function (c) {
            html += '<div class="preg-sheet-item">';
            html +=   '<p class="mk-qa-question textoPrimario">' + escapeHtml(c.texto) + '</p>';
            html += '</div>';
          });
          lista.innerHTML = html || '<p class="textoSecundario preg-sheet-cargando">Aún no hay preguntas.</p>';

          var content = sheetRoot.querySelector('#pregSheetContent');
          content.scrollTop = 0;
          /* Si la lista no desborda, el fade se retira de una vez */
          var fade = sheetRoot.querySelector('#pregSheetFade');
          if (fade) {
            var alFinal = (content.scrollTop + content.clientHeight) >= (content.scrollHeight - 4);
            fade.classList.toggle('fin', alFinal);
          }
        })
        .catch(function () {
          if (lista) lista.innerHTML = '<p class="textoSecundario preg-sheet-cargando">No se pudieron cargar las preguntas.</p>';
        });
    }

    function abrirSheet() {
      if (!idPostActual) return;
      var root = construirSheet();
      if (!root) return;
      root.classList.add('abierto');
      sheetAbierto = true;
      cargarSheetLista();
    }

    function cerrarSheet() {
      if (!sheetRoot || !sheetAbierto) return;
      sheetAbierto = false;
      sheetRoot.classList.remove('abierto');
    }

    /* ============================================================
       EVENTOS GLOBALES
       ============================================================ */
    document.addEventListener('post:change', function () {
      /* El post cambió: el sheet de lectura se cierra. La carga del
         nuevo post la hace Seccion_Script vía cargar(idPost). */
      if (sheetAbierto) cerrarSheet();
      preguntas = []; total = 0; hayMas = false; pagina = 1;
    });

    /* ============================================================
       API
       ============================================================ */
    function estaAbierto() { return sheetAbierto === true; }

    function refrescar() {
      if (sheetAbierto && idPostActual) { cargarSheetLista(); return; }
      if (idPostActual && el.preview) cargar(idPostActual);
    }

    return {
      buildHTML:    buildHTML,
      enganchar:    enganchar,
      cargar:       cargar,
      estaAbierto:  estaAbierto,
      refrescar:    refrescar
    };
  })();
