/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Social_Script.html
ESPEJO GITHUB:   js/Social_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Botones flotantes laterales. El contador de
                 compartir solo incrementa cuando el share nativo
                 resuelve (no en cancelación). Fallback WhatsApp
                 también cuenta. El botón Partner abre el bottom
                 sheet dedicado.
                 Key localStorage: post_likes.
VERSIÓN:         1.1
CAMBIOS:         R12: Capa 1 GA4. like se mide SOLO aquí (frontend)
                 cuando el usuario da un like NUEVO (quitar like no
                 dispara; sin doble conteo con el backend).
                 R5: baseline de producción incorporado al espejo;
                 encabezado normalizado al estándar ═══ (6 campos).
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Index.html (SISTEMA, TABLAS), Iconos.html
                 (pintarGlifos), Comenta_Script.html
                 (window.Comentarios), Partner_Sheet_Script.html
                 (window.PartnerSheet), Lista_Script.html
                 (window.Lista), Social_CSS.html
════════════════════════════════════════════════════════════════════
*/

  window.Social = (function () {

    var STORAGE_KEY_LIKES = 'post_likes';

    var postActivoObj = null;

    function haptic(v) {
      if (navigator.vibrate) {
        try { navigator.vibrate(v); } catch (e) {}
      }
    }

    function getLikes() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY_LIKES) || '[]'); }
      catch (_) { return []; }
    }
    function setLikes(arr) {
      try { localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(arr)); } catch (_) {}
    }
    function postTieneLike(id) {
      return getLikes().indexOf(id) !== -1;
    }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === idPartner) return partners[i];
      }
      return null;
    }

    function urlApp() {
      try {
        var root = (window.SISTEMA && window.SISTEMA.root) || {};
        var app  = root.app || {};
        return String(app.urlApp || '').trim();
      } catch (_) {
        return '';
      }
    }

    /* ============================================================
       Pintar
       ============================================================ */
    function pintar() {
      var contenedor = document.querySelector('.botones-flotantes');
      if (!contenedor) return;

      contenedor.style.color = '#475569';
      contenedor.innerHTML = '';

      var btnLike = document.createElement('button');
      btnLike.type = 'button';
      btnLike.id = 'btnLikeFlotante';
      btnLike.className = 'btn-flotante';
      btnLike.setAttribute('aria-label', 'Me gusta');
      btnLike.setAttribute('data-glifo', 'like');
      contenedor.appendChild(btnLike);

      var likes = document.createElement('span');
      likes.className = 'likes-flotante';
      likes.id = 'likesFlotante';
      likes.textContent = '0';
      contenedor.appendChild(likes);

      var btnComment = document.createElement('button');
      btnComment.type = 'button';
      btnComment.id = 'btnCommentFlotante';
      btnComment.className = 'btn-flotante';
      btnComment.setAttribute('aria-label', 'Comentarios');
      btnComment.setAttribute('data-glifo', 'comment');
      contenedor.appendChild(btnComment);

      var comments = document.createElement('span');
      comments.className = 'likes-flotante';
      comments.id = 'commentsFlotante';
      comments.textContent = '0';
      contenedor.appendChild(comments);

      var btnShare = document.createElement('button');
      btnShare.type = 'button';
      btnShare.id = 'btnShareFlotante';
      btnShare.className = 'btn-flotante';
      btnShare.setAttribute('aria-label', 'Compartir');
      btnShare.setAttribute('data-glifo', 'share');
      contenedor.appendChild(btnShare);

      var shares = document.createElement('span');
      shares.className = 'likes-flotante';
      shares.id = 'sharesFlotante';
      shares.textContent = '0';
      contenedor.appendChild(shares);

      var btnPartner = document.createElement('button');
      btnPartner.type = 'button';
      btnPartner.id = 'btnPartnerFlotante';
      btnPartner.className = 'btn-partner';
      btnPartner.setAttribute('aria-label', 'Sobre el partner');
      btnPartner.setAttribute('data-glifo', 'user');
      contenedor.appendChild(btnPartner);

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(contenedor);
      }

      btnLike.addEventListener('click', onLikeClick);
      btnComment.addEventListener('click', onCommentClick);
      btnShare.addEventListener('click', onShareClick);
      btnPartner.addEventListener('click', irAPartner);

      if (!postActivoObj && window.Lista && typeof window.Lista.getPostActivo === 'function') {
        postActivoObj = window.Lista.getPostActivo();
      }
      actualizarContadores();
    }

    /* ============================================================
       Estado visual del corazón
       ============================================================ */
    function aplicarEstadoCorazon(activo) {
      var btn = document.getElementById('btnLikeFlotante');
      if (!btn) return;

      if (activo) {
        btn.classList.add('activo');
        btn.style.color = '#ef4444';
      } else {
        btn.classList.remove('activo');
        btn.style.color = '';
      }
    }

    /* ============================================================
       Contadores
       ============================================================ */
    function actualizarContadores() {
      var likesEl    = document.getElementById('likesFlotante');
      var sharesEl   = document.getElementById('sharesFlotante');
      var commentsEl = document.getElementById('commentsFlotante');

      if (!postActivoObj) {
        aplicarEstadoCorazon(false);
        if (likesEl)    likesEl.textContent = '0';
        if (sharesEl)   sharesEl.textContent = '0';
        if (commentsEl) commentsEl.textContent = '0';
        return;
      }

      var tieneLike = postTieneLike(postActivoObj.id);
      aplicarEstadoCorazon(tieneLike);

      if (likesEl)    likesEl.textContent    = String(postActivoObj.like || 0);
      if (sharesEl)   sharesEl.textContent   = String(postActivoObj.comparte || 0);
      if (commentsEl) commentsEl.textContent = String(postActivoObj.comenta || 0);
    }

    /* ============================================================
       LIKE
       ============================================================ */
    function onLikeClick(e) {
      if (e && e.stopPropagation) e.stopPropagation();

      var post = postActivoObj;
      if (!post || !post.id) return;

      haptic([15, 10, 15]);

      var likes = getLikes();
      var yaDio = likes.indexOf(post.id) !== -1;
      var delta = yaDio ? -1 : 1;

      if (yaDio) {
        setLikes(likes.filter(function (k) { return k !== post.id; }));
        post.like = Math.max(0, (post.like || 0) - 1);
      } else {
        likes.push(post.id);
        setLikes(likes);
        post.like = (post.like || 0) + 1;

        /* GA4 (R12): like nuevo del usuario (solo frontend;
           quitar like no dispara evento) */
        if (window.Analitica) {
          window.Analitica.enviar('like', { post_id: post.id });
        }
      }

      actualizarContadores();
      bumpContador('likesFlotante');
      if (!yaDio) lanzarCorazon();

      postBackend('like', { idPost: post.id, delta: delta })
        .then(function (data) {
          if (data && typeof data.like === 'number') {
            post.like = data.like;
            var el = document.getElementById('likesFlotante');
            if (el) el.textContent = String(data.like);
          }
        })
        .catch(function (err) {
          if (delta === 1) {
            setLikes(getLikes().filter(function (k) { return k !== post.id; }));
            post.like = Math.max(0, (post.like || 0) - 1);
          } else {
            var ls = getLikes();
            if (ls.indexOf(post.id) === -1) { ls.push(post.id); setLikes(ls); }
            post.like = (post.like || 0) + 1;
          }
          actualizarContadores();
          console.error('[Social] Error al dar like:', err.message);
        });
    }

    /* ============================================================
       Comentario
       ============================================================ */
    function onCommentClick(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      haptic([15, 10, 15]);

      if (window.Comentarios && typeof window.Comentarios.abrir === 'function') {
        window.Comentarios.abrir();
      }
    }

    /* ============================================================
       Compartir
       ============================================================ */
    function onShareClick(e) {
      if (e && e.stopPropagation) e.stopPropagation();

      var post = postActivoObj;
      if (!post || !post.id) return;

      compartirNativo(post)
        .then(function (resultado) {
          if (resultado === 'compartido') {
            contarCompartido(post);
            return;
          }
          if (resultado === 'cancelado') {
            return;
          }
          compartirWhatsApp(post);
          contarCompartido(post);
        })
        .catch(function (err) {
          console.warn('[Social] Error en compartir:', err);
        });
    }

    function contarCompartido(post) {
      haptic(10);

      post.comparte = (post.comparte || 0) + 1;
      actualizarContadores();
      bumpContador('sharesFlotante');

      postBackend('comparte', { idPost: post.id })
        .then(function (data) {
          if (data && typeof data.comparte === 'number') {
            post.comparte = data.comparte;
            var el = document.getElementById('sharesFlotante');
            if (el) el.textContent = String(data.comparte);
          }
        })
        .catch(function (err) {
          post.comparte = Math.max(0, (post.comparte || 0) - 1);
          actualizarContadores();
          console.error('[Social] Error al compartir:', err.message);
        });
    }

    /* ============================================================
       Texto a compartir
       ============================================================ */
    function generarTextoCompartir(post) {
      var sj = post.seccionJson || {};
      var sp = sj.seccionPresentacion || {};

      var titulo  = sp.titulo  || 'Publicación';
      var tagline = sp.tagline || '';

      var partner = buscarPartner(post.idPartner);
      var nombre  = partner ? String(partner.nombre || '').trim() : '';

      var url = urlApp();

      var texto =
        '¡Mira esto! 📌\n\n' +
        (nombre ? nombre + '\n' : '') +
        '🎓 *' + titulo + '*\n' +
        (tagline ? tagline + '\n\n' : '\n') +
        '📲 Abre la app para ver toda la información' +
        (url ? '\n🔗 ' + url : '');

      return { titulo: titulo, texto: texto };
    }

    /* ============================================================
       Share nativo
       ============================================================ */
    function compartirNativo(post) {
      if (!navigator.share) return Promise.resolve('no-soportado');

      var info = generarTextoCompartir(post);

      return navigator.share({
        title: info.titulo,
        text:  info.texto
      })
      .then(function () {
        return 'compartido';
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return 'cancelado';
        return 'cancelado';
      });
    }

    /* ============================================================
       Fallback WhatsApp
       ============================================================ */
    function compartirWhatsApp(post) {
      var info = generarTextoCompartir(post);
      var url = 'https://wa.me/?text=' + encodeURIComponent(info.texto);
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    /* ============================================================
       Corazón volador
       ============================================================ */
    function lanzarCorazon() {
      var contenedor = document.querySelector('.botones-flotantes');
      var btn = document.getElementById('btnLikeFlotante');
      if (!contenedor || !btn) return;

      var contRect = contenedor.getBoundingClientRect();
      var btnRect  = btn.getBoundingClientRect();

      var centerX = btnRect.left - contRect.left + btnRect.width / 2;
      var centerY = btnRect.top  - contRect.top  + btnRect.height / 2;

      var wrap = document.createElement('div');
      wrap.className = 'heart-pop-wrap';
      wrap.style.left = (centerX - 20) + 'px';
      wrap.style.top  = (centerY - 20) + 'px';

      wrap.innerHTML =
        '<div class="heart-pop-svg">' +
          '<svg viewBox="0 0 24 24">' +
            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
          '</svg>' +
        '</div>';

      contenedor.appendChild(wrap);

      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 700);
    }

    function bumpContador(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('bump');
      setTimeout(function () { el.classList.remove('bump'); }, 250);
    }

    /* ============================================================
       Partner · abre el bottom sheet
       ============================================================ */
    function irAPartner() {
      haptic(10);
      if (window.PartnerSheet && typeof window.PartnerSheet.abrir === 'function') {
        window.PartnerSheet.abrir(postActivoObj);
      }
    }

    /* ============================================================
       Escuchar eventos
       ============================================================ */
    document.addEventListener('post:change', function (e) {
      postActivoObj = (e.detail && e.detail.post) ? e.detail.post : null;
      actualizarContadores();
    });

    document.addEventListener('chips:change', function () {
      setTimeout(actualizarContadores, 0);
    });

    document.addEventListener('comentarios:change', function (e) {
      var d = e.detail || {};
      if (!postActivoObj || d.idPost !== postActivoObj.id) return;
      if (typeof d.comenta === 'number') {
        postActivoObj.comenta = d.comenta;
        var contador = document.getElementById('commentsFlotante');
        if (contador) contador.textContent = String(d.comenta);
      }
    });

    return {
      pintar: pintar,
      refrescarContadores: actualizarContadores
    };

  })();
