/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Social_Script.html
ESPEJO GITHUB:   github/js/Social_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Social. Pinta los botones sociales
                 sobre la imagen del hero (like + compartir, sin
                 contadores): corazón volador al dar like, share
                 nativo con fallback WhatsApp y contador de
                 compartidos en el backend. El mensaje de WhatsApp
                 lleva el FORMATO RICO del dueño (R98): emoji og +
                 *título* + _og.descripcion_ + línea de confianza +
                 enlace — todo con datos ya en memoria (0 lecturas
                 nuevas). Key localStorage: post_likes.
VERSIÓN:         2.1.0
CAMBIOS:         R98: MENSAJE RICO de WhatsApp. El texto sale del
                 bloque og del POSTJSON (meta.og): 1ª línea emoji +
                 *título* (og.titulo → tituloPost → post.titulo),
                 2ª _og.descripcion_ completa (se omite si viene
                 vacía), línea de confianza según el tipo (la misma
                 de siempre) y el enlace al final. Fuera el saludo,
                 el nombre del partner y el tagline (ya no existen en
                 el formato). El título para navigator.share lleva
                 el emoji. Sin og el mensaje cae al título en
                 negrita y no se rompe nada.
                 R91: LIMPIEZA ALINEADA AL VUELO LARGO — la animación
                 del corazón pasó de 0.8s a 1.05s (recorrido más
                 largo, ver Social_CSS 1.4.2) y la limpieza del
                 wrap pasa de 850ms a 1150ms para no cortarla.
                 R90: EL CORAZÓN VOLADOR SALE DESDE EL LUGAR JUSTO —
                 antes se calculaba su posición con rects contra el
                 contenedor (#heroSocialButtons) y en el teléfono
                 arrancaba desplazado de donde está el corazón.
                 Ahora el wrap nace DENTRO del botón (que ya es
                 position:relative para esto) anclado a left/top
                 50%: el translate(-50%,-50%) del keyframe lo centra
                 EXACTO en el centro del corazón, sin cálculos ni
                 dependencia del offset parent. El tiempo de limpieza
                 se alinea a la animación (700→850ms).
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

    /* Tipo del post en SINGULAR y MAYÚSCULAS (los chips viven en
       plural: "Cursos" → "CURSO"). Decide la línea de confianza. */
    function tipoSingularDePost(post) {
      var id = String(((post && post.idChips) || [])[0] || '').trim();
      if (!id) return '';
      var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].idChip === id) {
          return String(chips[i].titulo || '').trim().toUpperCase().replace(/S$/, '');
        }
      }
      return '';
    }

    /* Línea de confianza del mensaje (decisión del dueño):
       curso → inscripciones abiertas · servicio → recomendación. */
    function esServicio(tipoSingular) {
      return String(tipoSingular || '').indexOf('SERVIC') === 0;
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
       Texto a compartir (R98 · FORMATO RICO del dueño, igual que
       entrega el Generador OG):
         {emoji og} *{título}*
         _{og.descripcion completa}_   (se omite si viene vacía)
         {línea de confianza}

         🔗 {enlace}
       · Título: og.titulo → tituloPost → post.titulo (la misma
         cadena del servidor, 00 DoGet).
       · Todo sale del POSTJSON ya en memoria + el enlace de
         Compartir: 0 lecturas nuevas.
       · Sin og el mensaje cae al título en negrita y no se rompe.
       ============================================================ */
    function generarTextoCompartir(post, urlEnlace) {
      var pj   = post.postJson || {};
      var meta = pj.meta || {};
      var og   = (meta.og && typeof meta.og === 'object') ? meta.og : {};
      var desc = pj.descripcion || {};

      var tituloBase = String(og.titulo || '').trim() ||
                       String(desc.tituloPost || '').trim() ||
                       String(post.titulo || '').trim() || 'Publicación';
      var emoji = String(og.emoji || '').trim();
      var lineaOg = String(og.descripcion || '').trim();

      var url = String(urlEnlace || '').trim() || urlApp();

      var tipo = tipoSingularDePost(post);
      var confianza = esServicio(tipo)
        ? 'Te lo recomiendo'
        : 'Inscripciones abiertas, reserva tu cupo desde ya en la app Servy';

      var texto =
        (emoji ? emoji + ' ' : '') + '*' + tituloBase + '*\n' +
        (lineaOg ? '_' + lineaOg + '_\n' : '') +
        '\n' +
        confianza + '\n\n' +
        '🔗 ' + url;

      return { titulo: (emoji ? emoji + ' ' : '') + tituloBase, texto: texto };
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
        '<div class="heart-pop-svg">' +
          '<svg viewBox="0 0 24 24">' +
            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
          '</svg>' +
        '</div>';

      btn.appendChild(wrap);

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