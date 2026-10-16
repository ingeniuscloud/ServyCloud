/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Social_Script.html
ESPEJO GITHUB:   js/Social_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Botones flotantes laterales. El contador de
                 compartir solo incrementa cuando el share nativo
                 resuelve (no en cancelación). Fallback WhatsApp
                 también cuenta. El mensaje de WhatsApp lleva el
                 formato del dueño: saludo con tipo y ciudad,
                 partner con ✨, título en negrita, tagline, línea
                 de confianza (curso: inscripciones abiertas con
                 invitación a reservar en la app · servicio: te lo
                 recomiendo) y enlace profundo en
                 línea propia. La fila del partner (bajo la fila
                 CTA, estilo Instagram) abre el bottom sheet
                 dedicado.
                 Key localStorage: post_likes.
VERSIÓN:         1.7
CAMBIOS:         R50: el título de la fila del partner se pinta
                 con el colorOficial del partner (sin color,
                 hereda el del texto).
                 R49: fila .user-fila del partner bajo la fila
                 CTA (estilo Instagram del dueño): nombre y
                 eslogan de subtítulo, misma acción (Partner
                 Sheet); se oculta sin post/partner; el rail
                 queda like/comenta/comparte.
                 R40: la línea de confianza del curso pasa a
                 "Inscripciones abiertas, reserva tu cupo desde
                 ya en la app Servy" (servicio: "Te lo
                 recomiendo" sin cambio).
DEPENDENCIAS:    Global_Script.html (postBackend, getDeviceId),
                 Index.html (SISTEMA, TABLAS), Iconos.html
                 (pintarGlifos), Comenta_Script.html
                 (window.Comentarios), Partner_Sheet_Script.html
                 (window.PartnerSheet), Lista_Script.html
                 (window.Lista), Social_CSS.html
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

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(contenedor);
      }

      btnLike.addEventListener('click', onLikeClick);
      btnComment.addEventListener('click', onCommentClick);
      btnShare.addEventListener('click', onShareClick);

      engancharUserFila();
      actualizarUserFila();

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
    function generarTextoCompartir(post, urlEnlace) {
      var sj = post.seccionJson || {};
      var sp = sj.seccionPresentacion || {};

      var titulo  = sp.titulo  || 'Publicación';
      var tagline = sp.tagline || '';

      var partner = buscarPartner(post.idPartner);
      var nombre  = partner ? String(partner.nombre || '').trim() : '';

      /* Formato WhatsApp del dueño: saludo con tipo y ciudad,
         partner con ✨, título SIN emoji y en negrita, tagline,
         línea de confianza y el enlace en línea propia. */
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

    /* Texto a compartir con enlace profundo · Promise.
       Compartir.urlDePost resuelve el enlace cifrado (o la URL
       principal si no pudo). */
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
       Share nativo
       ============================================================ */
    function compartirNativo(post) {
      if (!navigator.share) return Promise.resolve('no-soportado');

      return textoCompartirDe(post)
        .then(function (info) {
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
        });
    }

    /* ============================================================
       Fallback WhatsApp
       ============================================================ */
    function compartirWhatsApp(post) {
      textoCompartirDe(post).then(function (info) {
        var url = 'https://wa.me/?text=' + encodeURIComponent(info.texto);
        window.open(url, '_blank', 'noopener,noreferrer');
      });
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
       FILA PARTNER (R49) · estilo Instagram bajo la fila CTA.
       Muestra nombre + eslogan del partner del post activo y
       mantiene la acción de siempre: abrir el Partner Sheet.
       Sin post/partner: fila oculta. El texto vive en
       Index.html (userFila); aquí solo se llena y se decide
       visibilidad (post:change + arranque).
       R50 · el título va en el colorOficial del partner (campo
       plano, mismo que pinta el Partner Sheet); si no tiene,
       se limpia el inline y hereda el color del texto.
       ============================================================ */
    function partnerDePost(post) {
      if (!post || !post.idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === post.idPartner) return partners[i];
      }
      return null;
    }

    function actualizarUserFila() {
      var fila = document.getElementById('userFila');
      if (!fila) return;

      var partner = partnerDePost(postActivoObj);
      var nombre = (partner && partner.nombre) ? String(partner.nombre).trim() : '';
      if (!nombre) {
        fila.hidden = true;
        return;
      }

      var pj = (partner && partner.partnerJson) || {};
      var eslogan = String(pj.esloganPartner || '').trim();
      var colorPartner = (partner && partner.colorOficial)
        ? String(partner.colorOficial).trim() : '';

      var nombreEl  = fila.querySelector('.user-nombre');
      var esloganEl = fila.querySelector('.user-eslogan');

      if (nombreEl) {
        nombreEl.textContent = nombre;
        nombreEl.style.color = colorPartner;
      }
      if (esloganEl) {
        esloganEl.textContent = eslogan;
        esloganEl.hidden = !eslogan;
      }

      fila.hidden = false;
    }

    function engancharUserFila() {
      var fila = document.getElementById('userFila');
      if (!fila || fila.getAttribute('data-enganchado') === '1') return;
      fila.setAttribute('data-enganchado', '1');
      fila.addEventListener('click', irAPartner);
    }

    /* ============================================================
       Escuchar eventos
       ============================================================ */
    document.addEventListener('post:change', function (e) {
      postActivoObj = (e.detail && e.detail.post) ? e.detail.post : null;
      actualizarContadores();
      actualizarUserFila();
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
