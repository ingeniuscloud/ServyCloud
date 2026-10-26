/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Social_Script.html
ESPEJO GITHUB:   github/js/Social_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Social. Pinta los botones sociales
                 sobre la imagen del hero (like + compartir, sin
                 contadores): corazón volador al dar like, share
                 nativo con fallback WhatsApp y contador de
                 compartidos en el backend. El mensaje de WhatsApp
                 sale COMPLETO del BD (POSTJSON.compartir.
                 mensajeWhatsapp — texto del dueño en PostDetalle)
                 con el enlace del post que arma Compartir (enlace
                 corto ?s= codificado, R124). Key localStorage:
                 post_likes.
VERSIÓN:         2.5
CAMBIOS:         R128: el corazón volador sale del registro (data-glifo like, el MISMO glifo del botón) y se pinta al crear el wrap. El CSS .heart-pop-svg sigue mandando (rojo #ef4444).
CAMBIOS:         R124: SOLO COMENTARIO HONESTO (regla del dueño):
                 el enlace que arma Compartir ya no apunta a la
                 página gemela del post — es el enlace corto ?s=
                 codificado (ver Compartir_Script 2.5). Lógica
                 INTACTA (like + share + contador).
                 R109: FUERA el mensaje hardcodeado (orden del
                 dueño: los textos de WhatsApp viven en la BD, no
                 en el código). El texto es SOLO
                 compartir.mensajeWhatsapp + el enlace; si el post
                  no trae mensaje, sale el enlace pelado.
                 R108: el mensaje de compartir del POST salió del
                 campo compartir.mensajeWhatsapp del POSTJSON
                 (nueva estructura) con respaldo del formato
                 armado — respaldo retirado en R109.
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Index.html (SISTEMA, TABLAS), Iconos.html
                 (pintarGlifos), Lista_Script.html (window.Lista:
                 getPostActivo), Compartir_Script.html
                 (window.Compartir: urlDePost), Social_CSS.html,
                 Core_CSS.html
════════════════════════════════════════════════════════════════════*/

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

    /* ============================================================
       Texto a compartir · R109 SOLO BD (orden del dueño: fuera
       mensajes hardcodeados): el MENSAJE COMPLETO sale del campo
       compartir.mensajeWhatsapp del POSTJSON (tabla PostDetalle).
       Solo se le pega el enlace al final. Si el post no trae
       mensaje en la BD, sale el enlace pelado: el texto lo
       escribe el dueño en la BD, nunca el código.
       ============================================================ */
    function generarTextoCompartir(post, urlEnlace) {
      var pj = post.postJson || {};
      var desc = pj.descripcion || {};
      var compartir = (pj.compartir && typeof pj.compartir === 'object') ? pj.compartir : {};

      var url = String(urlEnlace || '').trim();

      var mensajeBD = String(compartir.mensajeWhatsapp || '').trim();
      var titulo    = String(desc.tituloPost || post.titulo || '').trim();

      return {
        titulo: titulo,
        texto:  mensajeBD
          ? mensajeBD + (url ? '\n' + url : '')
          : url
      };
    }

    function textoCompartirDe(post) {
      if (window.Compartir && typeof window.Compartir.urlDePost === 'function') {
        return window.Compartir.urlDePost(post)
          .then(function (enlace) {
            return generarTextoCompartir(post, enlace);
          })
          .catch(function () {
            return generarTextoCompartir(post, '');
          });
      }
      return Promise.resolve(generarTextoCompartir(post, ''));
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
      var btn = document.getElementById('btnSocialLike');

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

      aplicarEstadoCorazon();
      if (!yaDio) lanzarCorazon();

      postBackend('like', { idPost: post.id, delta: delta })
        .then(function (data) {
          if (data && typeof data.like === 'number') post.like = data.like;
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
          aplicarEstadoCorazon();
          console.error('[Social] Error al dar like:', err.message);
        });
    }

    function aplicarEstadoCorazon() {
      var btn = document.getElementById('btnSocialLike');
      if (!btn) return;
      var activo = !!(postActivoObj && postActivoObj.id && postTieneLike(postActivoObj.id));
      btn.classList.toggle('activo', activo);
    }

    /* ============================================================
       Corazón volador (desde el botón del hero)
       ============================================================ */
    function lanzarCorazon() {
      var btn = document.getElementById('btnSocialLike');
      if (!btn) return;

      /* R90: el corazón nace DENTRO del botón (position:relative),
         anclado a 50%/50%: el translate(-50%,-50%) del keyframe lo
         centra EXACTO en el centro del corazón del botón. Sin
         rects ni offset parents: imposible que arranque en otra
         posición aunque el hero esté scrolleado, transformado o
         recién montado. */
      var wrap = document.createElement('div');
      wrap.className = 'heart-pop-wrap';
      wrap.style.left = '50%';
      wrap.style.top = '50%';

      wrap.innerHTML =
        '<div class="heart-pop-svg" data-glifo="like"></div>';

      btn.appendChild(wrap);

      /* R128 · el corazón del vuelo sale del registro (like). */
      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(wrap);
      }

      /* R91: limpieza alineada a la animación de 1.05s. */
      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 1150);
    }

    /* ============================================================
       COMPARTIR · nativo con fallback WhatsApp
       ============================================================ */
    function onShareClick(e) {
      if (e && e.stopPropagation) e.stopPropagation();

      var post = postActivoObj;
      if (!post || !post.id) return;

      compartirNativo(post)
        .then(function (resultado) {
          if (resultado === 'compartido') { contarCompartido(post); return; }
          if (resultado === 'cancelado') return;
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

      postBackend('comparte', { idPost: post.id })
        .then(function (data) {
          if (data && typeof data.comparte === 'number') post.comparte = data.comparte;
        })
        .catch(function (err) {
          post.comparte = Math.max(0, (post.comparte || 0) - 1);
          console.error('[Social] Error al compartir:', err.message);
        });
    }

    function compartirNativo(post) {
      if (!navigator.share) return Promise.resolve('no-soportado');

      return textoCompartirDe(post)
        .then(function (info) {
          return navigator.share({
            title: info.titulo,
            text:  info.texto
          })
          .then(function () { return 'compartido'; })
          .catch(function (err) {
            if (err && err.name === 'AbortError') return 'cancelado';
            return 'cancelado';
          });
        });
    }

    function compartirWhatsApp(post) {
      textoCompartirDe(post).then(function (info) {
        var url = 'https://wa.me/?text=' + encodeURIComponent(info.texto);
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    }

    /* ============================================================
       PINTAR · like + compartir sobre el hero (sin contadores)
       Secciones llama pintar() después de montar cada post.
       ============================================================ */
    function pintar() {
      var contenedor = document.getElementById('heroSocialButtons');
      if (!contenedor) return;

      /* El post vivo al momento del pintado lo tiene Lista */
      if (window.Lista && typeof window.Lista.getPostActivo === 'function') {
        postActivoObj = window.Lista.getPostActivo() || postActivoObj;
      }

      contenedor.innerHTML = '';

      var btnLike = document.createElement('button');
      btnLike.type = 'button';
      btnLike.className = 'app-hero-social-btn';
      btnLike.id = 'btnSocialLike';
      btnLike.setAttribute('data-glifo', 'like');
      btnLike.setAttribute('aria-label', 'Me gusta');

      var btnShare = document.createElement('button');
      btnShare.type = 'button';
      btnShare.className = 'app-hero-social-btn';
      btnShare.id = 'btnSocialShare';
      btnShare.setAttribute('data-glifo', 'share');
      btnShare.setAttribute('aria-label', 'Compartir');

      contenedor.appendChild(btnLike);
      contenedor.appendChild(btnShare);

      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(contenedor);

      btnLike.addEventListener('click', onLikeClick);
      btnShare.addEventListener('click', onShareClick);

      aplicarEstadoCorazon();
    }

    /* ============================================================
       Escuchar eventos
       ============================================================ */
    document.addEventListener('post:change', function (e) {
      postActivoObj = (e.detail && e.detail.post) ? e.detail.post : null;
      aplicarEstadoCorazon();
    });

    return {
      pintar: pintar
    };
  })();
