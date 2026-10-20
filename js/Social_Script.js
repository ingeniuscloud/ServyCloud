/*══════════════════════════════════════════════════════════════════
ARCHIVO:         Social_Script.html
ESPEJO GITHUB:   github/js/Social_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Social. Pinta los botones sociales
                 sobre la imagen del hero (like + compartir, sin
                 contadores): corazón volador al dar like, share
                 nativo con fallback WhatsApp y contador de
                 compartidos en el backend. El mensaje de WhatsApp
                 lleva el formato del dueño y el enlace profundo de
                 Compartir. Key localStorage: post_likes.
VERSIÓN:         2.0.0
CAMBIOS:         R77: REPARACIÓN DEL ARCHIVO. El Social_Script de
                 producción había quedado reemplazado por una copia
                 vieja de Seccion_Script: eso borraba window.Social
                 (nadie pintaba los botones del hero) y pisaba
                 window.Secciones con una versión antigua. Vuelve el
                 módulo real, solo declara window.Social, pinta
                 like + compartir en #heroSocialButtons (diseño de
                 Social_CSS: círculos de 42px, sin contadores) y el
                 backend no cambia: mismas acciones like/comparte y
                 su notificación Telegram al partner.
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Index.html (SISTEMA, TABLAS), Iconos.html
                 (pintarGlifos), Lista_Script.html (window.Lista:
                 getPostActivo), Compartir_Script.html
                 (window.Compartir: urlDePost), Social_CSS.html,
                 Core_CSS.html
══════════════════════════════════════════════════════════════════*/

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

    /* Tipo del post en SINGULAR y MAYÚSCULAS para la negrita de
       WhatsApp (los chips viven en plural: "Cursos" → "CURSO"). */
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

    /* Ciudad del post (la primera declarada) en texto natural. */
    function ciudadDePost(post) {
      var id = String(((post && post.idCiudad) || [])[0] || '').trim();
      if (!id) return '';
      var ciudades = (window.SISTEMA && window.SISTEMA.ciudades) || [];
      for (var i = 0; i < ciudades.length; i++) {
        if (ciudades[i].idCiudad === id) return String(ciudades[i].titulo || '').trim();
      }
      return '';
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
       Texto a compartir (formato del dueño) · R77: el título viene
       de postJson.descripcion.tituloPost.
       ============================================================ */
    function generarTextoCompartir(post, urlEnlace) {
      var pj = post.postJson || {};
      var desc = pj.descripcion || {};

      var titulo  = String(desc.tituloPost || post.titulo || '').trim() || 'Publicación';
      var tagline = String(desc.tagline || '').trim();

      var partner = buscarPartner(post.idPartner);
      var nombre  = partner ? String(partner.nombre || '').trim() : '';

      var url = String(urlEnlace || '').trim() || urlApp();

      var tipo   = tipoSingularDePost(post);
      var ciudad = ciudadDePost(post);

      var confianza = esServicio(tipo)
        ? 'Te lo recomiendo'
        : 'Inscripciones abiertas, reserva tu cupo desde ya en la app Servy';

      var saludo;
      if (tipo && ciudad) saludo = '🖐️ ¡Mira este *' + tipo + '* en ' + ciudad + '! 🔎';
      else if (tipo)      saludo = '🖐️ ¡Mira este *' + tipo + '*! 🔎';
      else if (ciudad)    saludo = '🖐️ ¡Mira esto en ' + ciudad + '! 🔎';
      else                saludo = '🖐️ ¡Mira esto! 🔎';

      var texto =
        saludo + '\n\n' +
        (nombre ? '✨ ' + nombre + '\n' : '') +
        '*' + titulo + '*\n' +
        (tagline ? tagline + '\n' : '') +
        confianza + '\n\n' +
        '🔗 Abre la app para ver toda la información' +
        (url ? '\n' + url : '');

      return { titulo: titulo, texto: texto };
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
      var contenedor = document.getElementById('heroSocialButtons');
      var btn = document.getElementById('btnSocialLike');
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
