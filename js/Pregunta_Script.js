/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Pregunta_Script.html
ESPEJO GITHUB:   github/js/Pregunta_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Pregunta. Q&A del post completo en el
                 lienzo: campo de pregunta (X de limpiar con círculo
                 gris tenue, fila inferior fija con el aviso corto y
                 el contador N/250 SIEMPRE visible a la derecha),
                 vista previa de las ÚLTIMAS 2 preguntas (con su
                 respuesta, si ya la tienen) que llegan DENTRO del
                 postDetalle (igual que la imagen: cero llamadas
                 extra), publicación sin recargar y sheet al 90%
                 con skeleton que carga TODAS las preguntas y
                 respuestas del post en UNA llamada (acción
                 `preguntas`). Sin borrado y sin nombre.
VERSIÓN:         1.2.0
CAMBIOS:         R86: (1) FECHAS VISIBLES: la pregunta lleva su
                 fecha (TIMESTAMPINI) y la respuesta la suya
                 (TIMESTAMPFIN) en .cita con el formato
                 "20-10-2026 9:23 pm" (formatoFecha) — el usuario
                 ve la rapidez de respuesta. (2) La respuesta se
                 pinta como CITA: línea vertical a la izquierda,
                 texto .textoPrimario, su fecha y debajo la firma
                 "Respuesta de " (.textoSecundario) + nombre del
                 partner (.textoPrimario) — el nombre llega desde
                 Seccion_Script con poner(idPost, data, nombre);
                 si no hay, cae "nuestro partner". (3) El nuevo
                 backend (02 Tablas 1.7) trae cada respuesta
                 embebida en su misma fila (RESPUESTA +
                 TIMESTAMPFIN): el shape cliente sigue siendo
                 {texto, fecha, respuesta:{texto, fecha}}.
CAMBIOS:         R84: (1) Las últimas 2 preguntas NO se piden
                 aparte: llegan con el post (postDetalle.preguntas)
                 y el lienzo las pinta con poner() — se acabó el
                 “se me mostraron y al recargar desaparecieron”:
                 lo que se publica viaja también a la caché del
                 cliente (PostFull.anotarPregunta) y la
                 revalidación muda repinta la vista previa
                 (evento post:actualizado). (2) El sheet “Ver
                 todas” pide TODAS las preguntas y respuestas en
                 UNA llamada (acción `preguntas`) con SKELETON
                 mientras llega (antes: hasta 10 pedidos paginados
                 y texto de “Cargando...”). (3) La respuesta se
                 pinta bajo su pregunta como burbuja suave, en el
                 lienzo y en el sheet.
                 R83: (1) El contador sale de debajo del botón enviar
                 y comparte LA MISMA FILA con el aviso: al escribir ya
                 no se mueve nada de sitio. (2) El contador queda
                 SIEMPRE visible en tenue (0/250 con el campo vacío).
                 (3) El error de envío toma el lugar del aviso dentro
                 de esa misma fila y al curarse vuelve el aviso.
CAMBIOS:         R77B: El contador pasa a formato N/250 (cuánto
                 lleva y cuánto queda) centrado bajo el botón
                 enviar; el aviso corto lleva el icono info de
                 Iconos; al publicar el campo se limpia y pierde
                 el foco aunque venga del Enter; si el backend
                 falla se avisa con un mensaje suave y el botón
                 vuelve a su estado. Lee el total desde
                 data.pregunta (o data.comenta de transición).
                 R77: Nace el archivo. Reemplaza al módulo de
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
════════════════════════════════════════════════════════════════════*/

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
    var nombrePartner = '';   /* R86: firma "Respuesta de <partner>" */

    var el = {};          /* nodos del lienzo */
    var sheetRoot = null; /* root del sheet ver todas (lazy) */
    var sheetAbierto = false;

    function haptic(v) { if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} } }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    /* R86 · "20-10-2026 9:23 pm" (hora local del dispositivo;
       los ISO del backend vienen en UTC y new Date() los
       convierte solos). Devuelve '' si la fecha no es válida. */
    function formatoFecha(iso) {
      if (!iso) return '';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var dd  = String(d.getDate());
      var mm  = String(d.getMonth() + 1);
      var yy  = String(d.getFullYear());
      var h24 = d.getHours();
      var min = String(d.getMinutes()); if (min.length < 2) min = '0' + min;
      var ampm = h24 >= 12 ? 'pm' : 'am';
      var h12 = h24 % 12; if (h12 === 0) h12 = 12;
      return dd + '-' + mm + '-' + yy + ' ' + h12 + ':' + min + ' ' + ampm;
    }

    /* Fecha de la pregunta en .cita (R86) */
    function htmlFechaPregunta(c) {
      var f = formatoFecha(c && c.fecha);
      return f ? '<span class="preg-fecha cita">' + f + '</span>' : '';
    }

    /* ============================================================
       HTML DE LA SECCIÓN (la monta Seccion_Script en su orden)
       ============================================================ */
    function buildHTML() {
      /* R82: sin divisora propia — la ubicación ya cierra la
         sección del partner con la suya. */
      var html = '<div class="mk-qa-section">';
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
      /* R83: fila inferior fija — aviso a la izquierda (alineado
         con el placeholder) y contador SIEMPRE visible a la
         derecha en tenue. El error toma el lugar del aviso en
         ESA misma fila: escribir o fallar no mueve el layout. */
      html +=   '<div class="preg-meta">' +
                  '<span class="preg-aviso cita" id="pregAviso">' +
                    '<span class="preg-aviso-icono" data-glifo="info" aria-hidden="true"></span>' +
                    AVISO +
                  '</span>' +
                  '<span class="preg-error cita" id="pregError" hidden>No se pudo enviar. Intenta de nuevo.</span>' +
                  '<span class="preg-counter cita" id="pregCounter">0/' + MAX_CHARS + '</span>' +
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
        aviso:    track.querySelector('#pregAviso'),
        error:    track.querySelector('#pregError'),
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

      /* Contador N/250 (R83): SIEMPRE visible en tenue, viva en la
         fila del aviso; al llegar al tope avisa en naranja. */
      if (el.counter) {
        el.counter.textContent = len + '/' + MAX_CHARS;
        el.counter.classList.toggle('limite', len >= MAX_CHARS);
      }

      /* Si el usuario vuelve a escribir, el aviso curado regresa. */
      if (tieneTexto && el.error && !el.error.hidden) ocultarError();
    }

    var errorTimer = null;
    function mostrarError() {
      if (!el.error || !el.aviso) return;
      el.aviso.hidden = true;
      el.error.hidden = false;
      if (errorTimer) clearTimeout(errorTimer);
      errorTimer = setTimeout(ocultarError, 4000);
    }
    function ocultarError() {
      if (errorTimer) { clearTimeout(errorTimer); errorTimer = null; }
      if (el.error) el.error.hidden = true;
      if (el.aviso) el.aviso.hidden = false;
    }

    /* ============================================================
       CARGA Y VISTA PREVIA (recientes primero)
       R84: las últimas 2 llegan DENTRO del postDetalle
       (igual que la imagen) y se pintan con poner() — sin pedido
       extra. cargar() queda como respaldo (post viejo cacheado
       sin la clave preguntas).
       ============================================================ */
    function poner(idPost, data, nombrePartner_) {
      if (!idPost) return;
      idPostActual = idPost;
      /* R86: nombre del partner del post para la firma de la
         respuesta ("Respuesta de Creaciones Violeta"). */
      if (nombrePartner_) nombrePartner = String(nombrePartner_).trim();
      preguntas = (data && data.lista) || [];
      total     = (data && typeof data.total === 'number') ? data.total : preguntas.length;
      hayMas    = total > preguntas.length;
      pagina    = 1;
      cargando  = false;
      renderPreview();
    }

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

    /* Respuesta como CITA (R86): línea vertical a la izquierda,
       texto maestro, su fecha (TIMESTAMPFIN) y la firma
       "Respuesta de <partner>" debajo. Sin respuesta no se pinta
       nada. */
    function htmlRespuesta(r) {
      if (!r || !r.texto) return '';
      var html = '<div class="preg-respuesta">';
      html +=   '<p class="preg-respuesta-texto textoPrimario">' + escapeHtml(r.texto) + '</p>';
      var fResp = formatoFecha(r.fecha);
      if (fResp) html += '<span class="preg-respuesta-fecha cita">' + fResp + '</span>';
      html +=   '<p class="preg-respuesta-firma">' +
                  '<span class="textoSecundario">Respuesta de </span>' +
                  '<span class="textoPrimario">' + escapeHtml(nombrePartner || 'nuestro partner') + '</span>' +
                '</p>';
      html += '</div>';
      return html;
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
        html +=   htmlFechaPregunta(c);
        if (!esPenultima) html += htmlRespuesta(c.respuesta);
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

          var nueva = {
            texto:         texto,
            fecha:         new Date().toISOString(),
            dispositivoId: (typeof getDeviceId === 'function' ? getDeviceId() : ''),
            respuesta:     null
          };
          preguntas.unshift(nueva);
          if (data && typeof data.pregunta === 'number') total = data.pregunta;
          else if (data && typeof data.comenta === 'number') total = data.comenta;
          else total = total + 1;

          /* R84: la pregunta también vive en la caché del cliente:
             si el usuario cierra y reabre el post, la vista previa
             sigue mostrándola (PostFull + CacheL2). */
          try {
            if (window.PostFull && typeof window.PostFull.anotarPregunta === 'function') {
              window.PostFull.anotarPregunta(idPostActual, nueva);
            }
          } catch (err) {}

          /* Publicada: campo limpio, sin foco y arriba de la lista */
          el.input.value = '';
          actualizarField();
          try { el.input.blur(); } catch (err) {}
          renderPreview();

          document.dispatchEvent(new CustomEvent('preguntas:change', {
            detail: { idPost: idPostActual, pregunta: total }
          }));

          if (sheetAbierto) cargarSheetLista();
        })
        .catch(function (err) {
          enviando = false;
          el.send.disabled = el.input.value.trim().length === 0;
          mostrarError();
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

      /* R84 · SKELETON mientras llega TODO (preguntas + respuestas)
         en UNA llamada: suaviza la espera sin saltos de layout. */
      var skel = '';
      for (var i = 0; i < 5; i++) {
        skel += '<div class="preg-skel"><div class="preg-skel-linea"></div></div>';
      }
      lista.innerHTML = skel;

      postBackend('preguntas', { idPost: idPostActual })
        .then(function (data) {
          if (!sheetRoot || !sheetRoot.classList.contains('abierto')) return;
          var todas = (data && data.lista) || [];
          if (data && typeof data.total === 'number') total = data.total;

          var html = '';
          todas.forEach(function (c) {
            html += '<div class="preg-sheet-item">';
            html +=   '<p class="mk-qa-question textoPrimario">' + escapeHtml(c.texto) + '</p>';
            html +=   htmlFechaPregunta(c);
            html +=   htmlRespuesta(c.respuesta);
            html += '</div>';
          });
          lista.innerHTML = html || '<p class="textoSecundario preg-sheet-cargando">Aún no hay preguntas.</p>';

          refrescarFadeSheet();
        })
        .catch(function () {
          if (lista) lista.innerHTML = '<p class="textoSecundario preg-sheet-cargando">No se pudieron cargar las preguntas.</p>';
        });
    }

    function refrescarFadeSheet() {
      if (!sheetRoot) return;
      var content = sheetRoot.querySelector('#pregSheetContent');
      if (!content) return;
      content.scrollTop = 0;
      /* Si la lista no desborda, el fade se retira de una vez */
      var fade = sheetRoot.querySelector('#pregSheetFade');
      if (fade) {
        var alFinal = (content.scrollTop + content.clientHeight) >= (content.scrollHeight - 4);
        fade.classList.toggle('fin', alFinal);
      }
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
         nuevo post la hace Seccion_Script vía poner()/cargar(). */
      if (sheetAbierto) cerrarSheet();
      preguntas = []; total = 0; hayMas = false; pagina = 1;
    });

    /* R84: la revalidación muda del post activo trae preguntas
       frescas — la vista previa se repinta sola (el post que se
       abrió con caché L2 vieja se cura al llegar la respuesta). */
    document.addEventListener('post:actualizado', function (e) {
      var det = e.detail && e.detail.det;
      if (!det || !det.preguntas) return;
      if (det.idPost !== idPostActual || !el.preview) return;
      if (sheetAbierto) { cargarSheetLista(); return; }
      poner(det.idPost, det.preguntas);
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
      poner:        poner,
      cargar:       cargar,
      estaAbierto:  estaAbierto,
      refrescar:    refrescar
    };
  })();