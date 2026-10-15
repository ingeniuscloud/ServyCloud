/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Comenta_Script.html
ESPEJO GITHUB:   js/Comenta_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Bottom sheet de comentarios. Skeleton en carga
                 inicial, al publicar y al borrar. Like por
                 comentario aislado. Dispara 'comentarios:change'.
                 Placeholder leído de seccionPresentacion.titulo.
                 Keys localStorage: post_comments_user,
                 post_comments_likes.
VERSIÓN:         1.1
CAMBIOS:         R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Comenta_CSS.html, Global_CSS.html (base .sheet),
                 Iconos.html (glifos vía DOM)
════════════════════════════════════════════════════════════════════*/

  window.Comentarios = (function () {

    var STORAGE_KEY_USER    = 'post_comments_user';
    var STORAGE_KEY_LIKES_C = 'post_comments_likes';

    var MAX_CHARS_COMENTARIO = 280;
    var LONG_PRESS_MS        = 550;
    var LONG_PRESS_TOLERANCE = 8;

    var UMBRAL_VELOCIDAD = 0.5;
    var UMBRAL_DRAG      = 6;

    var abierto = false;
    var idPostActual = null;
    var postActivoObj = null;

    var comentariosCache = [];
    var paginaActual = 1;
    var totalComentarios = 0;
    var hayMas = false;
    var cargando = false;

    var placeholderComposerOriginal = '';

    var root = null;
    var backdrop = null;
    var sheet = null;
    var handleArea = null;
    var btnClose = null;
    var content = null;
    var actionBackdrop = null;
    var actionSheet = null;

    var el = {};

    var comentarioActionFecha = null;

    var dragActivo = false;
    var dragMoved = false;
    var dragPointerId = null;
    var dragStartY = 0;
    var dragUltimoY = 0;
    var dragUltimoT = 0;
    var dragVelocidad = 0;

    /* ============================================================
       Helpers
       ============================================================ */
    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    function getUser() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY_USER) || 'null'); }
      catch (_) { return null; }
    }
    function setUser(u) {
      try { localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(u)); } catch (_) {}
    }

    function getLikesComments() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY_LIKES_C) || '[]'); }
      catch (_) { return []; }
    }
    function setLikesComments(arr) {
      try { localStorage.setItem(STORAGE_KEY_LIKES_C, JSON.stringify(arr)); } catch (_) {}
    }

    function claveComentario(c) {
      return String(c.dispositivoId || '') + '|' + String(c.fecha || '');
    }
    function tengoLikeComentario(c) {
      return getLikesComments().indexOf(claveComentario(c)) !== -1;
    }
    function alternarLikeComentario(c) {
      var clave = claveComentario(c);
      var arr = getLikesComments();
      var idx = arr.indexOf(clave);
      if (idx === -1) { arr.push(clave); setLikesComments(arr); return true; }
      arr.splice(idx, 1); setLikesComments(arr); return false;
    }

    function getClaveActiva() {
      if (postActivoObj && postActivoObj.id) return postActivoObj.id;
      return null;
    }

    function colorAvatar(uid) {
      var hash = 0;
      var s = String(uid || 'x');
      for (var i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
      return 'hsl(' + (Math.abs(hash) % 360) + ', 55%, 52%)';
    }

    function iniciales(nombre) {
      var partes = String(nombre || '?').trim().split(/\s+/);
      var a = (partes[0] || '').charAt(0) || '?';
      var b = (partes[1] || '').charAt(0) || '';
      return (a + b).toUpperCase();
    }

    var DIAS  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    function formatearHora(d) {
      var h = d.getHours(); var m = d.getMinutes();
      var ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12; if (h === 0) h = 12;
      return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
    }
    function mismoDia(a, b) {
      return a.getFullYear() === b.getFullYear()
          && a.getMonth()    === b.getMonth()
          && a.getDate()     === b.getDate();
    }
    function tiempoSocial(iso) {
      var d = new Date(iso);
      var ahora = new Date();
      var min = Math.floor((ahora.getTime() - d.getTime()) / 60000);

      if (min < 1) return 'Ahora';
      if (min < 60) return 'Hace ' + min + ' min';
      if (mismoDia(d, ahora)) return 'Hoy · ' + formatearHora(d);

      var ayer = new Date(ahora);
      ayer.setDate(ayer.getDate() - 1);
      if (mismoDia(d, ayer)) return 'Ayer · ' + formatearHora(d);

      var diasDiff = Math.floor((ahora.getTime() - d.getTime()) / 86400000);
      if (diasDiff < 7) return DIAS[d.getDay()] + ' · ' + formatearHora(d);

      return d.getDate() + ' ' + MESES[d.getMonth()] + ' · ' + formatearHora(d);
    }

    /* ============================================================
       Backend
       ============================================================ */
    function cargarComentarios(pagina) {
      if (cargando) return Promise.resolve();
      cargando = true;

      return postBackend('comentarios', {
        idPost: idPostActual,
        pagina: pagina
      })
      .then(function (data) {
        totalComentarios = data.total;
        hayMas = data.hayMas;
        paginaActual = data.pagina;

        if (pagina === 1) {
          comentariosCache = data.comentarios;
        } else {
          comentariosCache = comentariosCache.concat(data.comentarios);
        }
        cargando = false;

        document.dispatchEvent(new CustomEvent('comentarios:change', {
          detail: { idPost: idPostActual, comenta: totalComentarios }
        }));
      })
      .catch(function (err) {
        cargando = false;
        console.error('[Comentarios] Error al cargar:', err.message);
      });
    }

    /* ============================================================
       Construir DOM base
       ============================================================ */
    function construirDOM() {
      if (root) return;

      var area = document.querySelector('.area-contenido');
      if (!area) return;

      root = document.createElement('div');
      root.className = 'comentarios-root';
      root.innerHTML =
        '<div class="sheet-backdrop"></div>' +
        '<div class="sheet modo-comentarios">' +
          '<div class="sheet-handle-area"><div class="sheet-handle"></div></div>' +
          '<button class="sheet-close" type="button" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
          '<div class="sheet-content"></div>' +
        '</div>' +
        '<div class="action-backdrop"></div>' +
        '<div class="action-sheet">' +
          '<button type="button" class="action-sheet-btn danger" id="btnActionDelete">Borrar comentario</button>' +
          '<button type="button" class="action-sheet-btn" id="btnActionCancel">Cancelar</button>' +
        '</div>';

      area.appendChild(root);

      backdrop       = root.querySelector('.sheet-backdrop');
      sheet          = root.querySelector('.sheet');
      handleArea     = root.querySelector('.sheet-handle-area');
      btnClose       = root.querySelector('.sheet-close');
      content        = root.querySelector('.sheet-content');
      actionBackdrop = root.querySelector('.action-backdrop');
      actionSheet    = root.querySelector('.action-sheet');

      backdrop.addEventListener('click', function () {
        if (actionSheet.classList.contains('visible')) { cerrarActionSheet(); return; }
        cerrar();
      });
      btnClose.addEventListener('click', cerrar);
      handleArea.addEventListener('pointerdown', onDragDown);

      actionBackdrop.addEventListener('click', cerrarActionSheet);
      actionSheet.querySelector('#btnActionDelete').addEventListener('click', confirmarBorrado);
      actionSheet.querySelector('#btnActionCancel').addEventListener('click', cerrarActionSheet);
    }

    /* ============================================================
       Abrir / cerrar
       ============================================================ */
    function abrir() {
      construirDOM();
      if (!root) return;

      idPostActual = getClaveActiva();
      if (!idPostActual) return;

      var sj = postActivoObj && postActivoObj.seccionJson ? postActivoObj.seccionJson : {};
      var meta = sj.meta || {};
      var color = meta.colorOficial || postActivoObj.colorOficial || '#1d4ed8';
      content.style.setProperty('--post-color', color);

      comentariosCache = [];
      paginaActual = 1;
      totalComentarios = 0;
      hayMas = false;

      inyectarContenido();
      renderSkeletons(3);
      cargarComentarios(1).then(renderLista);

      sheet.classList.add('sin-transicion');
      sheet.style.transform = 'translateY(100%)';
      root.classList.add('abierto');
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

      setTimeout(function () {
        var user = getUser();
        if (user && user.nombre) {
          if (el.composerInput && !el.composerInput.disabled) el.composerInput.focus();
        } else {
          if (el.nameInput) el.nameInput.focus();
        }
      }, 420);
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;
      cerrarActionSheet();

      backdrop.classList.remove('visible');
      sheet.style.transform = 'translateY(100%)';

      setTimeout(function () {
        if (!abierto) {
          sheet.classList.remove('abierto');
          root.classList.remove('abierto');
          if (content) content.innerHTML = '';
          el = {};
        }
      }, 420);
    }

    /* ============================================================
       Inyectar contenido
       ============================================================ */
    function inyectarContenido() {
      var sj = postActivoObj && postActivoObj.seccionJson ? postActivoObj.seccionJson : {};
      var sp = sj.seccionPresentacion || {};
      var nombrePost = sp.titulo || postActivoObj.titulo || 'esta publicación';
      var placeholder = '¿Qué te pareció ' + nombrePost + '?';

      placeholderComposerOriginal = placeholder;

      content.innerHTML =
        '<div class="sheet-head">' +
          '<h2 class="sheet-title">Comentarios</h2>' +
          '<span class="sheet-count" id="sheetCountComentarios">0</span>' +
        '</div>' +
        '<div class="comments-scroll" id="commentsScroll">' +
          '<div class="comments-list" id="commentsList"></div>' +
          '<div class="comments-actions" id="commentsActions" hidden>' +
            '<button type="button" class="comments-ver-mas" id="btnVerMas">Ver más</button>' +
          '</div>' +
        '</div>' +
        '<div class="composer-wrap">' +
          '<div class="name-prompt" id="namePrompt" hidden>' +
            '<span class="name-prompt-label">¿Cómo te llamas?</span>' +
            '<input type="text" class="name-prompt-input" id="nameInput" maxlength="30" placeholder="Tu nombre" autocomplete="name">' +
            '<button type="button" class="name-prompt-btn" id="nameBtn" disabled>OK</button>' +
          '</div>' +
          '<div class="composer">' +
            '<textarea class="composer-input" id="composerInput" rows="1" maxlength="' + MAX_CHARS_COMENTARIO + '" placeholder="' + escapeHtml(placeholder) + '"></textarea>' +
            '<span class="composer-counter" id="composerCounter" hidden>' + MAX_CHARS_COMENTARIO + '</span>' +
            '<button type="button" class="composer-send" id="composerSend" disabled aria-label="Enviar">' +
              '<svg viewBox="0 0 24 24"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';

      el = {
        sheetCount:      content.querySelector('#sheetCountComentarios'),
        scroll:          content.querySelector('#commentsScroll'),
        list:            content.querySelector('#commentsList'),
        actions:         content.querySelector('#commentsActions'),
        btnVerMas:       content.querySelector('#btnVerMas'),
        namePrompt:      content.querySelector('#namePrompt'),
        nameInput:       content.querySelector('#nameInput'),
        nameBtn:         content.querySelector('#nameBtn'),
        composerInput:   content.querySelector('#composerInput'),
        composerCounter: content.querySelector('#composerCounter'),
        composerSend:    content.querySelector('#composerSend')
      };

      bindear();
      actualizarNombreUI();
      actualizarBotonVerMas();
    }

    function renderSkeletons(n) {
      if (!el.list) return;
      var html = '';
      for (var i = 0; i < (n || 3); i++) {
        html += '<div class="comment-skeleton">' +
                  '<div class="skeleton-avatar"></div>' +
                  '<div class="skeleton-body">' +
                    '<div class="skeleton-line short"></div>' +
                    '<div class="skeleton-line long"></div>' +
                    '<div class="skeleton-line medium"></div>' +
                  '</div>' +
                '</div>';
      }
      el.list.innerHTML = html;
      if (el.actions) el.actions.hidden = true;
    }

    function bindear() {
      el.nameInput.addEventListener('input', function () {
        el.nameBtn.disabled = this.value.trim().length < 2;
      });

      el.nameBtn.addEventListener('click', function () {
        var nombre = el.nameInput.value.trim();
        if (nombre.length < 2) return;
        setUser({ uid: getDeviceId(), nombre: nombre });
        haptic([15, 10, 15]);
        el.namePrompt.hidden = true;
        el.composerInput.disabled = false;
        el.composerInput.placeholder = placeholderComposerOriginal;
        actualizarSend();
        setTimeout(function () { el.composerInput.focus(); }, 120);
      });

      el.nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (!el.nameBtn.disabled) el.nameBtn.click(); }
      });

      el.composerInput.addEventListener('input', function () {
        autogrow(this);
        actualizarCounter();
        actualizarSend();
      });
      el.composerSend.addEventListener('click', publicarComentario);

      if (el.btnVerMas) {
        el.btnVerMas.addEventListener('click', function () {
          haptic(8);
          el.btnVerMas.disabled = true;
          el.btnVerMas.textContent = 'Cargando…';
          cargarComentarios(paginaActual + 1).then(function () {
            renderLista();
            el.btnVerMas.disabled = false;
            el.btnVerMas.textContent = 'Ver más';
            actualizarBotonVerMas();
          });
        });
      }
    }

    function autogrow(ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(Math.max(ta.scrollHeight, 40), 84) + 'px';
    }

    function actualizarCounter() {
      var len = el.composerInput.value.length;
      if (len === 0) { el.composerCounter.hidden = true; return; }
      el.composerCounter.hidden = false;
      var restantes = MAX_CHARS_COMENTARIO - len;
      el.composerCounter.textContent = restantes;
      el.composerCounter.classList.remove('warn', 'danger');
      if (restantes <= 10) el.composerCounter.classList.add('danger');
      else if (restantes <= 20) el.composerCounter.classList.add('warn');
    }

    function actualizarSend() {
      var user = getUser();
      if (!user || !user.nombre) { el.composerSend.disabled = true; return; }
      el.composerSend.disabled = el.composerInput.value.trim().length === 0;
    }

    function actualizarNombreUI() {
      var user = getUser();
      if (user && user.nombre) {
        el.namePrompt.hidden = true;
        el.composerInput.disabled = false;
        el.composerInput.placeholder = placeholderComposerOriginal;
        actualizarSend();
      } else {
        el.namePrompt.hidden = false;
        el.nameInput.value = '';
        el.nameBtn.disabled = true;
        el.composerInput.disabled = true;
        el.composerInput.placeholder = 'Escribe tu nombre para comentar…';
        el.composerSend.disabled = true;
      }
    }

    function actualizarBotonVerMas() {
      if (!el.actions) return;
      el.actions.hidden = !hayMas;
    }

    function renderLista() {
      if (!el.list) return;

      if (el.sheetCount) el.sheetCount.textContent = String(totalComentarios);

      if (comentariosCache.length === 0) {
        el.list.innerHTML =
          '<div class="comments-empty">' +
            '<span class="comments-empty-icon">💬</span>' +
            '<p class="comments-empty-title">Sé el primero en comentar</p>' +
            '<p class="comments-empty-sub">Tu opinión ayuda a otros a decidir</p>' +
          '</div>';
        return;
      }

      var uid = getDeviceId();
      var html = '';

      comentariosCache.forEach(function (c) {
        var esPropio = (c.dispositivoId === uid);
        var tieneLike = tengoLikeComentario(c);

        html += '<div class="comment" data-fecha="' + escapeHtml(c.fecha) + '">';
        html +=   '<div class="comment-avatar" style="background-color:' + colorAvatar(c.dispositivoId) + '">' +
                    escapeHtml(iniciales(c.nombre)) +
                  '</div>';
        html +=   '<div class="comment-body">';
        html +=     '<div class="comment-head">';
        html +=       '<div class="comment-head-left">';
        html +=         '<span class="comment-name">' + escapeHtml(c.nombre) + '</span>';
        if (esPropio) html += '<span class="comment-badge-yo">Tú</span>';
        html +=         '<span class="comment-time">' + escapeHtml(tiempoSocial(c.fecha)) + '</span>';
        html +=       '</div>';
        if (esPropio) {
          html += '<button type="button" class="comment-more" data-more="' + escapeHtml(c.fecha) + '" aria-label="Más opciones">' +
                    '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' +
                  '</button>';
        }
        html +=     '</div>';
        html +=     '<p class="comment-text">' + escapeHtml(c.texto) + '</p>';
        html +=   '</div>';
        html +=   '<button type="button" class="comment-like' + (tieneLike ? ' activo' : '') + '" data-like="' + escapeHtml(c.fecha) + '" aria-label="Me gusta">' +
                    '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                  '</button>';
        html += '</div>';
      });

      el.list.innerHTML = html;

      el.list.querySelectorAll('.comment-like').forEach(function (btn) {
        btn.addEventListener('click', onLikeComment);
      });
      el.list.querySelectorAll('.comment-more').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation(); haptic(10);
          abrirActionSheet(this.getAttribute('data-more'));
        });
      });
      el.list.querySelectorAll('.comment').forEach(function (elComment) {
        var fecha = elComment.getAttribute('data-fecha');
        var c = comentariosCache.filter(function (x) { return x.fecha === fecha; })[0];
        if (c && c.dispositivoId === uid) bindLongPress(elComment, fecha);
      });
    }

    function publicarComentario() {
      var user = getUser();
      if (!user || !user.nombre) {
        el.namePrompt.hidden = false;
        el.composerInput.disabled = true;
        el.composerInput.placeholder = 'Escribe tu nombre para comentar…';
        el.composerSend.disabled = true;
        setTimeout(function () { el.nameInput.focus(); }, 100);
        return;
      }

      var texto = el.composerInput.value.trim();
      if (!texto) return;
      if (texto.length > MAX_CHARS_COMENTARIO) return;

      el.composerSend.disabled = true;

      el.composerInput.value = '';
      autogrow(el.composerInput);
      actualizarCounter();
      actualizarSend();

      renderSkeletons(3);

      postBackend('comentario', {
        idPost: idPostActual,
        nombre: user.nombre,
        texto:  texto
      })
      .then(function (data) {
        haptic([15, 10, 15]);
        if (data && typeof data.comenta === 'number') {
          document.dispatchEvent(new CustomEvent('comentarios:change', {
            detail: { idPost: idPostActual, comenta: data.comenta }
          }));
        }
        return cargarComentarios(1);
      })
      .then(function () {
        renderLista();
        actualizarBotonVerMas();
        el.scroll.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        console.error('[Comentarios] Error al publicar:', err.message);
        haptic([30, 20, 30]);
        renderLista();
        actualizarBotonVerMas();
      });
    }

    function onLikeComment(e) {
      e.stopPropagation();
      var btn = e.currentTarget;
      var fecha = btn.getAttribute('data-like');
      if (!fecha) return;
      var c = comentariosCache.filter(function (x) { return x.fecha === fecha; })[0];
      if (!c) return;

      var ahoraActivo = alternarLikeComentario(c);
      btn.classList.toggle('activo', ahoraActivo);
      haptic(10);
    }

    function bindLongPress(elComment, fecha) {
      var timer = null;
      var startX = 0, startY = 0;

      function cancelar() { if (timer) { clearTimeout(timer); timer = null; } }

      elComment.addEventListener('pointerdown', function (e) {
        if (e.target.closest && (e.target.closest('.comment-like') || e.target.closest('.comment-more'))) return;
        startX = e.clientX; startY = e.clientY;
        cancelar();
        timer = setTimeout(function () {
          timer = null; haptic(15); abrirActionSheet(fecha);
        }, LONG_PRESS_MS);
      });

      elComment.addEventListener('pointermove', function (e) {
        if (!timer) return;
        if (Math.abs(e.clientX - startX) > LONG_PRESS_TOLERANCE ||
            Math.abs(e.clientY - startY) > LONG_PRESS_TOLERANCE) {
          cancelar();
        }
      });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        elComment.addEventListener(ev, cancelar);
      });
    }

    function abrirActionSheet(fecha) {
      comentarioActionFecha = fecha;
      actionBackdrop.classList.add('visible');
      actionSheet.classList.add('visible');
    }

    function cerrarActionSheet() {
      comentarioActionFecha = null;
      if (actionBackdrop) actionBackdrop.classList.remove('visible');
      if (actionSheet)    actionSheet.classList.remove('visible');
    }

    function confirmarBorrado() {
      if (!comentarioActionFecha) return;
      var fecha = comentarioActionFecha;
      cerrarActionSheet();
      haptic([15, 10, 15]);

      renderSkeletons(3);

      postBackend('comentarioBorrar', { idPost: idPostActual, fecha: fecha })
      .then(function (data) {
        if (data && typeof data.comenta === 'number') {
          document.dispatchEvent(new CustomEvent('comentarios:change', {
            detail: { idPost: idPostActual, comenta: data.comenta }
          }));
        }
        return cargarComentarios(1);
      })
      .then(function () {
        renderLista();
        actualizarBotonVerMas();
      })
      .catch(function (err) {
        console.error('[Comentarios] Error al borrar:', err.message);
        haptic([30, 20, 30]);
        renderLista();
        actualizarBotonVerMas();
      });
    }

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

    document.addEventListener('post:change', function (e) {
      postActivoObj = (e.detail && e.detail.post) ? e.detail.post : null;

      if (!abierto || !root || !root.classList.contains('abierto')) return;

      var claveNueva = getClaveActiva();
      if (!claveNueva || claveNueva === idPostActual) return;

      idPostActual = claveNueva;
      var sj = postActivoObj && postActivoObj.seccionJson ? postActivoObj.seccionJson : {};
      var meta = sj.meta || {};
      var color = meta.colorOficial || postActivoObj.colorOficial || '#1d4ed8';
      content.style.setProperty('--post-color', color);

      comentariosCache = [];
      paginaActual = 1;
      totalComentarios = 0;
      hayMas = false;

      var textoGuardado = el.composerInput ? el.composerInput.value : '';

      inyectarContenido();
      renderSkeletons(3);
      cargarComentarios(1).then(function () {
        renderLista();
        actualizarBotonVerMas();
      });

      if (textoGuardado && el.composerInput && !el.composerInput.disabled) {
        el.composerInput.value = textoGuardado;
        autogrow(el.composerInput);
        actualizarCounter();
        actualizarSend();
      }
    });

    function estaAbierto() { return abierto === true; }

    function refrescar() {
      if (!abierto)      return Promise.resolve();
      if (!idPostActual) return Promise.resolve();
      if (cargando)      return Promise.resolve();

      return cargarComentarios(1).then(function () {
        renderLista();
        actualizarBotonVerMas();
      });
    }

    function pintar() { construirDOM(); }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pintar);
    } else {
      pintar();
    }

    return {
      pintar:      pintar,
      abrir:       abrir,
      cerrar:      cerrar,
      estaAbierto: estaAbierto,
      refrescar:   refrescar
    };

  })();
