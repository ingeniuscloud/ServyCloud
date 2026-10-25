/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Opend_Ad_Script.html
ESPEJO GITHUB:   github/js/Opend_Ad_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Open Ad de apertura (estilo App Open Ad de Mercado
                 Libre/Yummy/Cashea, casero). Al cargar la app —sin
                 esperar el catálogo— lee SISTEMA.promo.openAd
                 (bloque { activo, items[] }) y si HOY toca, monta
                 la capa sobre la app mientras termina de cargar:
                 creativo 9:16 protagonista con fondo tenue detrás.
                 R121 · CADA ITEM ES UNA CAMPAÑA de un anunciante
                 (contrato propio): idOpenAd, ciudad[], imagen,
                 textoBoton, idPost, telefonoWhatsapp,
                 mensajeWhatsapp y ventanas[{inicia, termina}] con
                 fecha+hora. Filtros del teléfono (red de seguridad:
                 el backend ya decidió AL SERVIR): bloque inactivo
                 nada · ventana estricta (ventanaVigente, reloj del
                 teléfono) · ciudad del item (vacío = todas; el
                 backend no conoce la ciudad activa) · item CON
                 idPost exige el post en el catálogo y activo/pronto
                 (MISMO tratamiento que titulares: post muerto =
                 anuncio no se carga; catálogo aún no cargado = se
                 confía en el backend, el ad no frena el boot) · el
                 eventual SIN idPost se rige solo por sus ventanas y
                 abre WhatsApp con SU teléfono y SU mensaje (el
                 WhatsApp del admin murió con la R120) · varios
                 vigentes a la vez → rotación POR CARGA por turno
                 (el teléfono recuerda el último mostrado en
                 localStorage y pasa al siguiente; si solo hay uno,
                 ese). CADA CLIC del CTA (a post o a WhatsApp)
                 dispara el aviso avisoOpenAd al backend → Telegram
                 del admin ("nueva entrada al Open Ad" + idOpenAd +
                 fecha y hora), FIRE-AND-FORGET: nunca bloquea ni
                 tumba la acción del usuario. CTA = botón PRIMARIO
                 naranja con flecha (mismo estilo del CTA del post)
                 colgando del borde inferior derecho con ~95% de su
                 alto FUERA del creativo; X = botón SECUNDARIO
                 (círculo con borde claro y X gris) colgando del
                 borde superior derecho con ~95% fuera. La imagen
                 viaja de Drive a lh3 directo y si tarda más de 6s
                 no molesta: la app carga normal. En GitHub Pages
                 SISTEMA llega POR DATOS: espera la sesión y
                 re-intenta UNA sola vez.
VERSIÓN:         1.5.0
CAMBIOS:         R121: (1) Módulo window.OpenAd con clases
                 .openad-* y eventos GA4 openad_view/openad_click:
                 cada cosa por su nombre. (2) Lee el PROMOJSON NUEVO: openAd.{activo,
                 items[]} con campaña por anunciante, campo ciudad
                 (vacío = todas) y ventanas fecha+hora. (3) CTA con
                 doble destino: idPost lleno → cierra la capa y
                 navega al post (misma vía que titulares: Chips +
                 bus 'post:solicitar', autocontenida); idPost vacío
                 → WhatsApp con telefonoWhatsapp y mensajeWhatsapp
                 DEL ANUNCIO. (4) FUERA el WhatsApp del admin
                 (admin.whatsapp / admin.mensajeWhatsapp): el botón
                 nunca abre el número del ROOTJSON. (5) Rotación por
                 carga cuando dos o más anuncios cocham de horario.
                 (6) Aviso avisoOpenAd al backend en cada clic del
                 CTA (efectividad de contratos), con el idOpenAd.
                 (7) Formato nuevo únicamente: corte limpio.
                 (8) Sin catálogo cargado aún, el chequeo de
                 post-en-catálogo confía en el backend (el ad nunca
                 frena el boot); con TABLAS presente se repite como
                 red de seguridad (los expirados ya salen filtrados
                 al cargar, Core_Script).

DEPENDENCIAS:    Index.html (SISTEMA), Global_Script.js
                 (ventanaVigente, abrirWhatsapp, postBackend,
                 asegurarSesion), Seccion_Imagen_Script.js
                 (urlImagenDirecta), Chips_Script.js (getChipActivo,
                 seleccionar), Ciudad_Script.js (getActual),
                 Opend_Ad_CSS.css
════════════════════════════════════════════════════════════════════*/
  window.OpenAd = (function () {

    var MAX_ESPERA_IMG = 6000;            /* ms: imagen lenta → no molesta */
    var CLAVE_TURNO    = 'openad_ultimo'; /* rotación por carga (localStorage) */

    /* ============================================================
       FILTROS DEL TELÉFONO · red de seguridad sobre lo que el
       backend ya dejó viajar (decisión AL SERVIR, 02 Cache.gs).
       ============================================================ */
    function _ciudadActual() {
      try {
        if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
          var c = window.Ciudad.getActual();
          return c ? (c.idCiudad || '') : '';
        }
      } catch (_) {}
      return '';
    }

    function _buscarPost(idPost) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i] && posts[i].id === idPost) return posts[i];
      }
      return null;
    }

    function _anuncioPasa(item) {
      if (!item || typeof item !== 'object') return false;
      if (!String(item.imagen || '').trim()) return false;

      /* 1 · Ventana ESTRICTA (R108): sin ventanas o ninguna
         vigente en el reloj del teléfono → fuera. */
      var ventanas = Array.isArray(item.ventanas) ? item.ventanas : [];
      if (!ventanas.length) return false;
      var enVentana = ventanas.some(function (v) {
        if (!v) return false;
        if (typeof window.ventanaVigente !== 'function') return false;
        return window.ventanaVigente(v.inicia, v.termina) === true;
      });
      if (!enVentana) return false;

      /* 2 · Ciudad del item: vacío [] = TODAS las ciudades. Si
         trae ciudades, la ciudad activa debe estar. Sin ciudad
         activa conocida solo pasan los de todas. */
      var cs = Array.isArray(item.ciudad) ? item.ciudad : [];
      if (cs.length) {
        var actual = _ciudadActual();
        if (!actual || cs.indexOf(actual) === -1) return false;
      }

      /* 3 · Post registrado (idPost lleno): MISMO tratamiento que
         titulares. Con TABLAS presente: el post debe existir y
         estar activo/pronto (los vencidos ya salen filtrados al
         cargar, Core_Script). Sin TABLAS aún: se confía en el
         backend — el ad nunca frena el boot. */
      var idp = String(item.idPost || '').trim();
      if (idp) {
        var post = _buscarPost(idp);
        if (post && post.estado !== 'activo' && post.estado !== 'pronto') {
          return false;
        }
      }
      return true;
    }

    /* 4 · Rotación POR CARGA (solo cuando varios cocham de
       horario): por turno — el teléfono recuerda el último
       mostrado y pasa al siguiente de los vigentes. */
    function _elegirPorTurno(lista) {
      if (lista.length === 1) return lista[0];
      var ids = lista.map(function (it) {
        return String(it.idOpenAd || it.imagen || '');
      });
      var ultimo = '';
      try { ultimo = localStorage.getItem(CLAVE_TURNO) || ''; } catch (_) {}
      var idx = ids.indexOf(ultimo);
      var elegido = (idx === -1) ? 0 : ((idx + 1) % ids.length);
      try { localStorage.setItem(CLAVE_TURNO, ids[elegido]); } catch (_) {}
      return lista[elegido];
    }

    function datos() {
      var promo  = (window.SISTEMA && window.SISTEMA.promo) || null;
      var bloque = promo && promo.openAd;
      if (!bloque || typeof bloque !== 'object') return null;
      if (bloque.activo !== true) return null;

      var items = Array.isArray(bloque.items) ? bloque.items : [];
      var vivos = items.filter(_anuncioPasa);
      if (!vivos.length) return null;
      return _elegirPorTurno(vivos);
    }

    /* ============================================================
       NAVEGACIÓN AL POST · misma vía que las titulares
       (autocontenida, lección R115/R116: usa Chips y el bus
       'post:solicitar' sin depender de módulos privados).
       ============================================================ */
    function _irAPost(idPost) {
      var post = _buscarPost(idPost);
      if (!post) return;

      var chipActivo = (window.Chips && typeof window.Chips.getChipActivo === 'function')
        ? window.Chips.getChipActivo()
        : null;

      var chips = post.idChips || [];
      var enMismoChip = (chipActivo && chips.indexOf(chipActivo) !== -1);

      if (enMismoChip || chips.length === 0) {
        if (chips.length === 0) return;
        document.dispatchEvent(new CustomEvent('post:solicitar', {
          detail: { idPost: idPost }
        }));
        return;
      }

      if (window.Chips && typeof window.Chips.seleccionar === 'function') {
        window.Chips.seleccionar(chips[0]);
        setTimeout(function () {
          document.dispatchEvent(new CustomEvent('post:solicitar', {
            detail: { idPost: idPost }
          }));
        }, 80);
      } else {
        document.dispatchEvent(new CustomEvent('post:solicitar', {
          detail: { idPost: idPost }
        }));
      }
    }

    /* ============================================================
       AVISO TELEGRAM · R121
       Cada clic del CTA (a post o a WhatsApp) dispara la acción
       avisoOpenAd: el backend valida el idOpenAd y avisa al bot
       del admin ("nueva entrada al Open Ad" + idOpenAd + destino
       + fecha y hora). FIRE-AND-FORGET: si algo falla, la acción
       del usuario ya corrió y nada se rompe. Sin postBackend
       disponible se omite en silencio.
       ============================================================ */
    function _avisarTelegram(idOpenAd) {
      try {
        if (typeof window.postBackend !== 'function') return;
        var r = window.postBackend('avisoOpenAd', { idOpenAd: idOpenAd });
        if (r && typeof r.catch === 'function') r.catch(function () {});
      } catch (_) {}
    }

    /* ============================================================
       CONSTRUCCIÓN · la capa se monta ya (no espera catálogo)
       CTA = PRIMARIO (naranja, flecha blanca, mismo estilo del
       CTA del post) colgando del borde inferior derecho con ~95%
       de su alto FUERA del creativo. X = SECUNDARIO (círculo con
       borde claro, X gris) colgando del borde superior derecho
       con ~95% fuera. Sin destino (sin idPost y sin teléfono) el
       CTA no se pinta: queda la pieza con su X.
       ============================================================ */
    function montar(it, urlImagen) {
      var capa = document.createElement('div');
      capa.className = 'openad';
      capa.id = 'openad';
      capa.setAttribute('role', 'dialog');
      capa.setAttribute('aria-modal', 'true');
      capa.setAttribute('aria-label', 'Promoción');
      capa.hidden = true;

      var textoBoton = String(it.textoBoton || '').trim();
      var idp        = String(it.idPost || '').trim();
      var telefono   = String(it.telefonoWhatsapp || '').trim();
      var mensaje    = String(it.mensajeWhatsapp || '').trim();
      var idOpenAd   = String(it.idOpenAd || '').trim();

      capa.innerHTML =
        '<figure class="openad-creativo">' +
          '<img class="openad-img" alt="" draggable="false">' +
          '<button type="button" class="openad-cerrar" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '</svg>' +
          '</button>' +
          ((textoBoton && (idp || telefono))
            ? '<button type="button" class="openad-boton">' +
                '<span class="openad-boton-texto"></span>' +
                '<svg class="cta-flecha" viewBox="0 0 24 24" fill="none"' +
                     ' stroke="#ffffff" stroke-width="2.5"' +
                     ' stroke-linecap="round" stroke-linejoin="round"' +
                     ' aria-hidden="true">' +
                  '<path d="M4 12h15"/>' +
                  '<path d="m13 6 6 6-6 6"/>' +
                '</svg>' +
              '</button>'
            : '') +
        '</figure>';

      capa.querySelector('.openad-img').src = urlImagen;

      var btn = capa.querySelector('.openad-boton');
      if (btn) {
        capa.querySelector('.openad-boton-texto').textContent = textoBoton;
      }

      function cerrar() {
        capa.classList.remove('openad-visible');
        document.body.classList.remove('openad-abierto');
        document.removeEventListener('keydown', alTeclear);
        setTimeout(function () {
          if (capa.parentNode) capa.parentNode.removeChild(capa);
        }, 220);
      }

      function alTeclear(e) {
        if (e && e.key === 'Escape') cerrar();
      }

      capa.querySelector('.openad-cerrar')
          .addEventListener('click', cerrar);
      document.addEventListener('keydown', alTeclear);

      if (btn) {
        btn.addEventListener('click', function () {
          try {
            if (window.Analitica) {
              window.Analitica.enviar('openad_click', { idOpenAd: idOpenAd });
            }
          } catch (_) {}
          _avisarTelegram(idOpenAd);
          if (idp) {
            cerrar();
            setTimeout(function () { _irAPost(idp); }, 80);
          } else if (typeof window.abrirWhatsapp === 'function') {
            window.abrirWhatsapp(telefono, mensaje);
          }
        });
      }

      document.body.appendChild(capa);
      document.body.classList.add('openad-abierto');

      /* El fade necesita un frame para que la transición corra */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          capa.hidden = false;
          capa.classList.add('openad-visible');
          try {
            if (window.Analitica) {
              window.Analitica.enviar('openad_view', { idOpenAd: idOpenAd });
            }
          } catch (_) {}
        });
      });
    }

    /* ============================================================
       ARRANQUE · precarga con guardia: la imagen manda, el boot
       de la app NUNCA espera.
       ============================================================ */
    var esperaSesion = false;   /* reintento único (páginas GitHub) */

    function iniciar() {
      try {
        /* GitHub Pages: SISTEMA llega POR DATOS. Sin SISTEMA.promo
           todavía, se espera la sesión (una sola vez) y se
           re-intenta; sin sesión posible, el openAd no molesta y
           la app carga normal. */
        if (!(window.SISTEMA && window.SISTEMA.promo)) {
          if (esperaSesion) return;
          esperaSesion = true;
          if (typeof window.asegurarSesion === 'function') {
            window.asegurarSesion().then(
              function () { iniciar(); },
              function () {}
            );
          }
          return;
        }

        var it = datos();
        if (!it) return;

        /* Drive → lh3 directo (misma conversión de la app) */
        var url = String(it.imagen || '').trim();
        if (window.SeccionImagen &&
            typeof window.SeccionImagen.urlImagenDirecta === 'function') {
          url = window.SeccionImagen.urlImagenDirecta(url);
        }
        if (!url) return;

        var lista = new Image();
        var listo = false;

        var guardia = setTimeout(function () {
          if (!listo) { listo = true; }  /* lenta: se descarta */
        }, MAX_ESPERA_IMG);

        lista.onload = function () {
          if (listo) return;
          listo = true;
          clearTimeout(guardia);
          montar(it, url);
        };
        lista.onerror = function () {
          if (listo) return;
          listo = true;
          clearTimeout(guardia);
        };
        lista.src = url;
      } catch (err) {
        /* Cualquier fallo del openAd NUNCA tumba la app */
        try { console.warn('[OpenAd] ' + (err && err.message)); } catch (_) {}
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciar);
    } else {
      iniciar();
    }

    return { iniciar: iniciar, datos: datos };

  })();
