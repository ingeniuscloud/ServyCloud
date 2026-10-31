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
VERSIÓN:         1.8.1
CAMBIOS:         R135: dependencia legado corregida — el gemelo real es Ciudad_Sheet_Script.js (decía Ciudad_Script.js; comentario de cabecera, cero efecto). Historial: bitácora/versiones.
DEPENDENCIAS:    Index.html (SISTEMA), Global_Script.js
                 (ventanaVigente, abrirWhatsapp, postBackend,
                 asegurarSesion), Seccion_Imagen_Script.js
                 (urlImagenDirecta), Chips_Script.js (getChipActivo,
                 seleccionar), Ciudad_Sheet_Script.js (getActual),
                 Telefono.css (.glass anfitrión), Opend_Ad_CSS.css
════════════════════════════════════════════════════════════════════*/


  window.OpenAd = (function () {

    var MAX_ESPERA_IMG = 6000;            /* ms: imagen lenta → no molesta */
    var CIERRE_DEFECTO = 10000;           /* ms: cierre automático por defecto (R-b) */
    var FADE_CIERRE_MS = 320;             /* ms: retiro del nodo tras el fade-out */
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
       Cada clic (a post o a WhatsApp) dispara la acción avisoOpenAd:
       el backend valida el idOpenAd y avisa al bot del admin ("nueva
       entrada al Open Ad" + idOpenAd + destino + fecha y hora).
       FIRE-AND-FORGET: si algo falla, la acción del usuario ya corrió
       y nada se rompe. Sin postBackend disponible se omite en
       silencio.
       ============================================================ */
    function _avisarTelegram(idOpenAd) {
      try {
        if (typeof window.postBackend !== 'function') return;
        var r = window.postBackend('avisoOpenAd', { idOpenAd: idOpenAd });
        if (r && typeof r.catch === 'function') r.catch(function () {});
      } catch (_) {}
    }

    /* ============================================================
       TIEMPOS DEL ANUNCIO · R122 (milisegundos, cada campaña es
       individual). REGLAS CERRADAS del dueño — Ley de la X:
       (R-a) esperaX ausente/inválido → X AL INSTANTE (la X SIEMPRE
             existe; nunca hay anuncio sin su X).
       (R-b) cierreAutomatico ausente/inválido/≤0 → CIERRE_DEFECTO
             (10000 ms): el anuncio NUNCA queda abierto eterno.
       (R-c) cierreAutomatico ≤ esperaX (JSON imposible) → la espera
             de la X se ANULA (X al instante) y el cierre dispara en
             su tiempo programado igual.
       (R-d) los DOS relojes son INDEPENDIENTES: el cierre
             automático NUNCA depende de la X; si la X fallara por
             cualquier motivo, el anuncio se cierra igual en su
             tiempo.
       ============================================================ */
    function _msEntero(v) {
      var n = Math.round(Number(v));
      return isFinite(n) ? n : NaN;
    }

    function _tiemposDe(it) {
      var espera = _msEntero(it.esperaX);
      if (!isFinite(espera) || espera < 0) espera = 0;                 /* R-a */
      var cierre = _msEntero(it.cierreAutomatico);
      if (!isFinite(cierre) || cierre <= 0) cierre = CIERRE_DEFECTO;   /* R-b */
      if (cierre <= espera) espera = 0;                                /* R-c */
      return { esperaX: espera, cierre: cierre };
    }

    /* ============================================================
       CONSTRUCCIÓN · la capa se monta ya (no espera catálogo)
       R122 · LA CAPA VIVE DENTRO DEL VIDRIO del teléfono (.glass):
       en la PC el simulador la recorta por el marco y se ve EXACTO
       a lo que verá el teléfono; en un teléfono real el vidrio es
       pantalla completa (mismo camino de código). Sin vidrio,
       respaldo en el body con .openad-fijo (capa fija).
       EL CTA ES LA IMAGEN (R122): el botón naranja murió. Tocar la
       imagen abre el destino y cierra el anuncio con fade-out. Sin
       destino (sin idPost y sin teléfono) la imagen no es clic: la
       pieza queda con su X. La X nace OCULTA y aparece con fade-in
       tras esperaX (Ley de la X: siempre termina apareciendo).
       ============================================================ */
    function montar(it, urlImagen) {
      var capa = document.createElement('div');
      capa.className = 'openad';
      capa.id = 'openad';
      capa.setAttribute('role', 'dialog');
      capa.setAttribute('aria-modal', 'true');
      capa.setAttribute('aria-label', 'Promoción');
      capa.hidden = true;

      var idp      = String(it.idPost || '').trim();
      var telefono = String(it.telefonoWhatsapp || '').trim();
      var mensaje  = String(it.mensajeWhatsapp || '').trim();
      var idOpenAd = String(it.idOpenAd || '').trim();
      var tiempos  = _tiemposDe(it);
      var tieneDestino = !!(idp || telefono);

      capa.innerHTML =
        '<figure class="openad-creativo">' +
          '<img class="openad-img" alt="" draggable="false">' +
          '<button type="button" class="openad-cerrar" aria-label="Cerrar" data-glifo="close"></button>' +
        '</figure>';

      /* R128 · la X del openAd sale del registro (close). */
      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(capa);
      }

      var img = capa.querySelector('.openad-img');
      img.src = urlImagen;

      var unoX = null;       /* reloj de la X (esperaX) */
      var unoCierre = null;  /* reloj del cierre automático */

      function cerrar() {
        if (unoX) { clearTimeout(unoX); unoX = null; }
        if (unoCierre) { clearTimeout(unoCierre); unoCierre = null; }
        capa.classList.remove('openad-visible');
        document.body.classList.remove('openad-abierto');
        setTimeout(function () {
          if (capa.parentNode) capa.parentNode.removeChild(capa);
        }, FADE_CIERRE_MS);
      }

      /* R-d · DOS RELOJES INDEPENDIENTES, arrancan cuando el anuncio
         SE MUESTRA (no antes): la X no participa en el cierre. */
      function programar() {
        unoX = setTimeout(function () {
          capa.querySelector('.openad-cerrar').classList.add('openad-x-visible');
        }, tiempos.esperaX);
        unoCierre = setTimeout(cerrar, tiempos.cierre);
      }

      capa.querySelector('.openad-cerrar')
          .addEventListener('click', cerrar);

      /* CTA = LA MISMA IMAGEN (R122): post directo o WhatsApp del
         anuncio. En ambos casos el anuncio se cierra con fade-out
         (convalidado: "mientras abre el destino"). */
      function alTocar() {
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
          cerrar();
        }
      }

      if (tieneDestino) {
        img.addEventListener('click', alTocar);
        img.setAttribute('aria-label', 'Abrir promoción');
      }

      /* ANFITRIÓN · dentro del vidrio del simulador (.glass); sin
         vidrio imprevisto → body con .openad-fijo (capa fija). */
      var vidrio = null;
      try { vidrio = document.querySelector('.glass'); } catch (_) {}
      var anfitrion = vidrio || document.body;
      if (!vidrio) capa.classList.add('openad-fijo');
      anfitrion.appendChild(capa);
      document.body.classList.add('openad-abierto');

      /* El fade necesita un frame para que la transición corra */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          capa.hidden = false;
          capa.classList.add('openad-visible');
          programar();
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

    return { iniciar: iniciar, datos: datos, tiemposDe: _tiemposDe };

  })();
