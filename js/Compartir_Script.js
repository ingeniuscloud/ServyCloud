/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Compartir_Script.html
ESPEJO GITHUB:   github/js/Compartir_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Compartir por enlace. Dos emisores: (1) POST —
                 Social pide Compartir.urlDePost(post) y su mensaje
                 lleva el enlace de la PÁGINA GEMELA del post en
                 GitHub Pages (root.app.compartir.urlPages), que es
                 donde vive el OG que WhatsApp previsualiza; la
                 gemela abre la app al instante (location.replace,
                 nunca al /exec de GAS). Sin urlPages, el enlace va
                 a la app (root.app.urlApp) con el payload corto
                 ?s=. (2) LISTA FILTRADA — el enlace apunta a la
                 PAGE BASE de la carpeta (urlPages): esa page
                 muestra el OG POR DEFECTO y reenvía el ?s= para
                 que el receptor aterrice con su lista intacta.
                 MENSAJES: · POST → compartir.mensajeWhatsapp del
                 POSTJSON + enlace. · LISTA →
                 app.compartir.mensajeListaWhatsapp con [ciudad]
                 (UPPERCASE) y [textoBuscado] (buscador, chip o
                 "lista general"). Sin plantilla, enlace pelado.
VERSIÓN:         2.4
CAMBIOS:         R109: GEMELO SINCRONIZADO byte-idéntico al GAS:
                 urlPages desde app.compartir.urlPages (el enlace
                 del post aterriza en la página gemela con su OG)
                 y mensaje SOLO de la BD.
                 R108: urlPages desde app.compartir.urlPages;
                 enlace de LISTA a la page base con reenvío del
                 ?s=; mensaje de lista desde
                 mensajeListaWhatsapp con placeholders.
════════════════════════════════════════════════════════════════════*/
  window.Compartir = (function () {

    /* ============================================================
       ENLACE CORTO · ?s= · payload compacto + XOR embebido
       Mismo objetivo de siempre (el ID del post y el término
       NUNCA legibles en la URL) en la MENOS bytes posible:
       payload mínimo separado por \x1f, XOR con la clave
       embebida y base64url. La clave viaja dentro de la app:
       ofuscamiento, no custodia de secretos. Y sin crypto.subtle
       funciona igual (el enlace corto no lo necesita).
       LEGADO: los enlaces ?d= (AES-256-GCM) ya compartidos
       siguen abriendo por descifrar(); ya no se emiten.
       ============================================================ */
    var CLAVE_B64 = 'jU8VmYAwIx8ipwsLIt3nAjo2fKPSdCPUphlZtVj6GlQ=';
    var LARGO_IV  = 12;   /* solo receptor legacy ?d= */

    var clavePromesa = null;

    function getClave() {
      if (!clavePromesa) {
        var crudo = Uint8Array.from(atob(CLAVE_B64), function (c) {
          return c.charCodeAt(0);
        });
        clavePromesa = window.crypto.subtle.importKey(
          'raw', crudo, { name: 'AES-GCM' }, false, ['decrypt']
        );
      }
      return clavePromesa;
    }

    function bytesAB64url(bytes) {
      var bin = '';
      for (var i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return btoa(bin)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    function b64urlABytes(s) {
      var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4 !== 0) t += '=';
      var bin = atob(t);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }

    function xorBytes(bytes) {
      var clave = Uint8Array.from(atob(CLAVE_B64), function (c) {
        return c.charCodeAt(0);
      });
      var salida = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) {
        salida[i] = bytes[i] ^ clave[i % clave.length];
      }
      return salida;
    }

    /* Payload mínimo: 'p·id' para post y 'l·ciudad·término[·chip]'
       para lista (el separador real es \x1f, imposible de
       teclear). Devuelve el token corto o null si no pudo. */
    function empaquetar(tipo, partes) {
      try {
        var crudo = tipo;
        for (var i = 0; i < partes.length; i++) {
          var parte = String(partes[i] == null ? '' : partes[i]).trim();
          if (!parte) return null;
          crudo += '\x1f' + parte;
        }

        var bytes = new TextEncoder().encode(crudo);
        if (!bytes.length) return null;

        return bytesAB64url(xorBytes(bytes));
      } catch (err) {
        console.warn('[Compartir] Enlace corto no disponible:', err && err.message);
        return null;
      }
    }

    /* Inverso EXACTO de empaquetar. Valida la estructura: si el
       token no decodifica a post o lista completa, falla (el
       receptor lo trata como enlace no válido). La lista acepta
       el chip como tercer campo (q '-' = sin término); los de 2
       partes (solo ciudad+término) siguen abriendo. */
    function desempaquetar(token) {
      var partes = new TextDecoder()
        .decode(xorBytes(b64urlABytes(token)))
        .split('\x1f');

      var tipo = partes.shift();

      if (tipo === 'p' && partes.length === 1 && partes[0]) {
        return { t: 'p', id: partes[0] };
      }

      if (tipo === 'l' && partes.length === 2 && partes[0] && partes[1]) {
        return { t: 'l', c: partes[0], q: partes[1].slice(0, 40), g: '' };
      }

      if (tipo === 'l' && partes.length === 3 && partes[0] && partes[1] && partes[2]) {
        return {
          t: 'l',
          c: partes[0],
          q: partes[1] === '-' ? '' : partes[1].slice(0, 40),
          g: partes[2]
        };
      }

      throw new Error('enlace no válido');
    }

    function descifrar(token) {
      /* Receptor LEGADO ?d= (AES-256-GCM): los enlaces ya
         compartidos antes del enlace corto siguen abriendo. */
      try {
        var bytes = b64urlABytes(token);
        if (bytes.length <= LARGO_IV) {
          return Promise.reject(new Error('enlace corto'));
        }

        var iv = bytes.slice(0, LARGO_IV);
        var cuerpo = bytes.slice(LARGO_IV);

        return getClave()
          .then(function (clave) {
            return window.crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: iv }, clave, cuerpo
            );
          })
          .then(function (buf) {
            return JSON.parse(new TextDecoder().decode(buf));
          });
      } catch (err) {
        return Promise.reject(err);
      }
    }

    /* ============================================================
       URLS DE COMPARTIR · SOLO GitHub Pages, NUNCA el /exec de GAS
       · urlApp()   → la app (root.app.urlApp): aterrizaje de los
                      enlaces y respaldo del post sin página gemela.
       · urlPages() → la carpeta de páginas gemelas: R108 la lee
                      de root.app.compartir.urlPages (nueva
                      ubicación del ROOT) con respaldo en
                      app.urlPages. Ahí vive el OG por post y la
                      page base que previsualiza las listas.
       R105: FUERA el respaldo URL_EXEC. Si el ROOT no trae las
       URLs de GitHub no se inventa destino: el enlace queda vacío
       (Social manda el mensaje sin enlace) — jamás un /exec.
       ============================================================ */
    function rootApp() {
      try {
        var root = (window.SISTEMA && window.SISTEMA.root) || {};
        return (root.app && typeof root.app === 'object') ? root.app : {};
      } catch (_) {
        return {};
      }
    }

    function urlApp() {
      /* Raíz de la app con SU raya final (como viene en el ROOT):
         el aterrizaje ?s= no debe pasar por un salto de GitHub. */
      return String(rootApp().urlApp || '').trim().replace(/\?+$/, '');
    }

    function urlPages() {
      var compartir = rootApp().compartir || {};
      return String(compartir.urlPages || rootApp().urlPages || '')
        .trim().replace(/\?+$/, '').replace(/\/+$/, '');
    }

    function urlBase() {
      return urlApp() || urlPages();
    }

    /* Enlace del POST: página gemela del post en GitHub Pages.
       El ?v= (timestamp) renueva la previsualización de WhatsApp
       cada vez que se comparte: si el dueño regeneró la página
       con otra imagen o texto, el scrape no queda pegado al
       cache viejo. Sin urlPages en el ROOT, enlace directo a la
       app con el token corto (mismo receptor de siempre). */
    function armarEnlacePost(idPost) {
      var pages = urlPages();
      if (pages) {
        return pages + '/' + encodeURIComponent(idPost) + '.html?v=' + Date.now();
      }
      var token = empaquetar('p', [String(idPost)]);
      return token ? armarEnlace(token) : urlBase();
    }

    function armarEnlace(token) {
      if (!token) return urlBase();
      return urlBase() + '?s=' + token;
    }

    /* Líneas de confianza · RETIRADAS (R109): los textos de
       WhatsApp viven en la BD, no en el código. La plantilla de
       lista sale de app.compartir.mensajeListaWhatsapp y la del
       post de compartir.mensajeWhatsapp (Social). */

    /* ============================================================
       Estado
       ============================================================ */
    var modoCompartido = null;   /* 'post' | 'lista' | null */
    var aplicando      = false;  /* guarda durante la recepción */
    var btn            = null;

    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    /* ============================================================
       Emisor · POST (lo consume Social)
       ============================================================ */
    function urlDePost(post) {
      if (!post || !post.id) return Promise.resolve(urlBase());

      return Promise.resolve(armarEnlacePost(post.id));
    }

    /* ============================================================
       Emisor · LISTA FILTRADA (botón compartir de la búsqueda)
       ============================================================ */
    function marcaApp() {
      try {
        var root = (window.SISTEMA && window.SISTEMA.root) || {};
        return String((root.app && root.app.marca) || '') || 'ServyCloud';
      } catch (_) {
        return 'ServyCloud';
      }
    }

    /* R108 · MENSAJE DE LISTA desde el BD:
       app.compartir.mensajeListaWhatsapp con [ciudad] →
       UPPERCASE del título de la ciudad activa y [textoBuscado] →
       el texto del buscador; si comparte por chip, el título del
       chip; si comparte TODA la lista sin filtro, "lista
       general". Respaldo: el formato armado de siempre si el
       ROOT aún no trae la plantilla. */
    function mensajeLista(plantilla, ciudad, termino, chipActivo) {
      var textoBuscado = String(termino || '').trim();
      if (!textoBuscado && chipActivo) textoBuscado = tituloChip(chipActivo);
      if (!textoBuscado) textoBuscado = 'lista general';

      var ciudadTxt = (ciudad && ciudad.titulo)
        ? String(ciudad.titulo).trim().toUpperCase()
        : '';

      return String(plantilla || '')
        .replace(/\[ciudad\]/g, ciudadTxt)
        .replace(/\[textoBuscado\]/g, textoBuscado);
    }

    function compartirLista() {
      if (!btn || btn.disabled) return;

      var input = document.getElementById('buscarInput');
      var termino = String((input && input.value) || '').trim();

      var chipActivo = null;
      try {
        chipActivo = (window.Chips && typeof window.Chips.getChipActivo === 'function')
          ? window.Chips.getChipActivo() : null;
      } catch (_) {}

      /* R108 · también se puede compartir TODA la lista (sin
         término y sin chip): el mensaje dice "lista general".
         Lo único imprescindible es la ciudad (viaja en el
         token). */
      var ciudad = null;
      try {
        ciudad = (window.Ciudad && typeof window.Ciudad.getActual === 'function')
          ? window.Ciudad.getActual() : null;
      } catch (_) {}
      if (!ciudad || !ciudad.idCiudad) return;

      haptic(10);

      var token = empaquetar('l', [
        String(ciudad.idCiudad),
        termino ? termino.slice(0, 40) : '-',
        String(chipActivo || '')
      ]);

      try {
        /* R108 · el enlace de lista apunta a la PAGE BASE de la
           carpeta e/ (urlPages): ahí WhatsApp previsualiza el OG
           POR DEFECTO (fijo del ROOT). La page reenvía el ?s= a
           la app, así el receptor aterriza con su lista. Sin
           urlPages, el enlace va directo a la app como siempre. */
        var pages = urlPages();
        var url = pages
          ? pages + '/?s=' + token
          : armarEnlace(token);

        var root = (window.SISTEMA && window.SISTEMA.root) || {};
        var comp = (root.app && root.app.compartir) || {};
        var plantilla = String(comp.mensajeListaWhatsapp || '').trim();

        var texto;
        if (plantilla) {
          /* R108 · plantilla del BD + enlace al final. */
          texto = mensajeLista(plantilla, ciudad, termino, chipActivo) +
                  (url ? '\n' + url : '');
        } else {
          /* R109 · sin plantilla en el BD NO se inventa texto:
             sale el enlace pelado (los mensajes de WhatsApp
             viven en la BD, nunca en el código). */
          texto = url;
        }

        if (navigator.share) {
          return navigator.share({ title: marcaApp(), text: texto })
            .catch(function (err) {
              if (err && err.name === 'AbortError') return null;
              abrirWhatsApp(texto);
            });
        }
        abrirWhatsApp(texto);
      } catch (err) {
        console.warn('[Compartir] No se pudo compartir la lista:', err && err.message);
      }
    }

    function abrirWhatsApp(texto) {
      var url = 'https://wa.me/?text=' + encodeURIComponent(texto);
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    /* ============================================================
       Botón compartir · la visibilidad la decide Lista_Script
       (lo muestra cuando la lista trae items); aquí solo vive el
       binding del click y el envío.
       ============================================================ */
    function pintar() {
      if (window.__compartirBound === '1') return;

      btn = document.getElementById('btnCompartir');

      if (!btn) return;

      window.__compartirBound = '1';

      btn.addEventListener('click', compartirLista);
    }

    /* ============================================================
       Receptor · detección y recepción del enlace
       ============================================================ */
    function leerParam(nombre) {
      try {
        var q = new URLSearchParams(window.location.search);
        var v = String(q.get(nombre) || '').trim();
        return v || null;
      } catch (_) {
        return null;
      }
    }

    function hayEntrante() {
      return !!(leerParam('s') || leerParam('d'));
    }

    function limpiarUrl() {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.hash);
      } catch (_) {}
    }

    function recibir() {
      var corto = leerParam('s');
      var crudo = corto || leerParam('d');
      if (!crudo) return;

      /* La barra queda limpia YA: recargar o reenviar la URL no
         re-ejecuta el enlace compartido (protege iOS y evita
         compartir URLs sucias desde la barra del navegador). */
      limpiarUrl();

      /* Enlace corto ?s= → desempaquetar. Enlace legacy ?d=
         (compartido antes del enlace corto) → descifrar AES. */
      var tarea = corto
        ? Promise.resolve().then(function () { return desempaquetar(corto); })
        : descifrar(crudo);

      tarea
        .then(function (datos) {
          if (!datos || typeof datos !== 'object') return;

          /* Guardia: la apertura del contenido dispara
             ciudad:change / chips:change legítimos (cambio de
             ciudad y chip del enlace) que NO deben limpiar el
             modo compartido recién activado. */
          aplicando = true;

          if (datos.t === 'p') recibirPost(datos);
          else if (datos.t === 'l') recibirLista(datos);
        })
        .catch(function (err) {
          console.warn('[Compartir] Enlace no válido:', err && err.message);
        });
    }

    function buscarPost(id) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === id) return posts[i];
      }
      return null;
    }

    /* Nombres legibles para la plantilla del BD: [textoBuscado]
       toma el título del chip cuando se comparte por chip (los
       chips se escriben en plural: "Cursos"). */
    function tituloChip(idChip) {
      var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
      var id = String(idChip || '').trim();
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].idChip === id) return String(chips[i].titulo || '').trim();
      }
      return '';
    }

    function avisoAmable(texto) {
      var el = document.getElementById('buscarVacio');
      if (!el) return;
      el.textContent = texto;
      el.hidden = false;
    }

    function activarModo(tipo, textoCampo) {
      modoCompartido = tipo;

      var wrap  = document.querySelector('.filtros-wrap');
      var fila  = document.querySelector('.filtros-fila');
      var input = document.getElementById('buscarInput');

      /* La CÁPSULA queda desplegada y bloqueada — la clase
         .compartida viste la fila (chips/lupa/compartir fuera,
         solo CANCELAR activo) y la cabecera (menú global fuera). */
      if (wrap) wrap.classList.add('compartida');
      if (fila) fila.classList.add('compartida');
      if (input) {
        input.value = textoCampo || '';
        input.readOnly = true;
        if (typeof input.blur === 'function') input.blur();
      }

      /* El header del detalle lo decide el TIPO de enlace:
         compartido-lista → dentro del post vuelve el par
         volver/título (Chips_CSS) para recorrer la lista;
         compartido-post  → la fila con CANCELAR sigue
         sustituyendo a ese par. */
      document.body.classList.remove('compartido-post');
      document.body.classList.remove('compartido-lista');
      document.body.classList.add(
        tipo === 'post' ? 'compartido-post' : 'compartido-lista'
      );

      /* La ciudad se ve pero NO se toca (CSS en Chips_CSS) */
      document.body.classList.add('modo-compartido');
    }

    function recibirPost(datos) {
      var id = String(datos.id || '').trim();
      if (!id) { aplicando = false; return; }

      var post = buscarPost(id);
      var vivo = post &&
                 post.estado !== 'inactivo' &&
                 post.estado !== 'pausado';

      if (!vivo) {
        aplicando = false;
        avisoAmable('Este contenido ya no está disponible.');
        return;
      }

      activarModo('post', post.titulo || post.boton || 'Publicación');

      /* Mismo camino probado del cross-sell: ciudad con
         aplicarGuardada + chip + apertura diferida. Los eventos
         que dispara (ciudad:change / chips:change) no limpian el
         modo porque aplicando está en true. */
      try {
        if (window.Secciones && typeof window.Secciones.irAPost === 'function') {
          window.Secciones.irAPost(id);
          liberarTrasApertura(id);
          return;
        }
      } catch (err) {
        console.warn('[Compartir] Apertura del post falló:', err && err.message);
      }

      aplicando = false;
    }

    function liberarTrasApertura(idPost) {
      var on_change = function (e) {
        var p = e.detail && e.detail.post;
        if (p && p.id === idPost) {
          document.removeEventListener('post:change', on_change);
          setTimeout(function () { aplicando = false; }, 250);
        }
      };
      document.addEventListener('post:change', on_change);

      setTimeout(function () {
        document.removeEventListener('post:change', on_change);
        aplicando = false;
      }, 2500);
    }

    function recibirLista(datos) {
      var termino = String(datos.q || '').trim().slice(0, 40);
      var chip = String(datos.g || '').trim();

      /* El enlace puede venir por término de búsqueda (de
         siempre) o por CHIP sin término (compartir en modo
         chip). Sin ninguno de los dos no hay lista que abrir. */
      if (!termino && !chip) { aplicando = false; return; }

      /* La lista filtrada depende de la ciudad: si la ciudad del
         enlace ya no existe, aviso amable y app normal. */
      var ciudad = null;
      try {
        if (window.Ciudad && typeof window.Ciudad.getLista === 'function') {
          var idCiudad = String(datos.c || '').trim();
          var lista = window.Ciudad.getLista() || [];
          for (var i = 0; i < lista.length; i++) {
            if (lista[i].idCiudad === idCiudad) { ciudad = lista[i]; break; }
          }
        }
      } catch (_) {}

      if (!ciudad) {
        aplicando = false;
        avisoAmable('Esta lista ya no está disponible.');
        return;
      }

      activarModo('lista', termino);

      var aplicarFiltro = function () {
        if (termino) {
          var input = document.getElementById('buscarInput');
          if (input) input.value = termino;

          /* Mismo carril que el buscador: Lista repinta con el
             filtro (y avisa "sin resultados" si ya no hay). */
          document.dispatchEvent(new CustomEvent('buscar:change', {
            detail: { termino: termino, enLimite: false }
          }));
        } else if (chip) {
          /* Lista compartida POR CHIP: se selecciona el chip del
             enlace (Lista repinta con su filtro). El campo queda
             limpio: el filtro real es el chip. */
          if (window.Chips && typeof window.Chips.seleccionar === 'function') {
            window.Chips.seleccionar(chip);
          }
        }

        aplicando = false;
      };

      try {
        var actual = (window.Ciudad && typeof window.Ciudad.getActual === 'function')
          ? window.Ciudad.getActual() : null;

        if (!actual || actual.idCiudad !== ciudad.idCiudad) {
          /* aplicarGuardada guarda, pinta y emite ciudad:change
             (repintado completo sincrónico cuando TABLAS ya está). */
          window.Ciudad.aplicarGuardada(ciudad);
        }
      } catch (err) {
        console.warn('[Compartir] Aplicar ciudad falló:', err && err.message);
      }

      aplicarFiltro();
    }

    /* ============================================================
       Limpiar · la X del campo + auto-limpieza
       Devuelve la app a su estado normal: ciudades, chips y
       todas las listas. La ciudad aplicada por el enlace queda
       como la del receptor (ya es "su" ciudad).
       ============================================================ */
    function limpiar() {
      var wrap  = document.querySelector('.filtros-wrap');
      var fila  = document.querySelector('.filtros-fila');
      var input = document.getElementById('buscarInput');
      var capsula = document.getElementById('buscarFila');
      var aviso = document.getElementById('buscarVacio');

      if (wrap) wrap.classList.remove('compartida');
      if (fila) fila.classList.remove('compartida');
      if (capsula) capsula.classList.remove('con-texto');
      if (input) { input.value = ''; input.readOnly = false; }
      if (aviso) { aviso.hidden = true; aviso.textContent = ''; }

      modoCompartido = null;
      document.body.classList.remove('compartido-post');
      document.body.classList.remove('compartido-lista');
      document.body.classList.remove('modo-compartido');

      /* Post compartido: la app está en modo detalle. Limpiar
         devuelve a la normalidad COMPLETA: cerrar el detalle y
         volver al listado. */
      try {
        if (window.Lista && typeof window.Lista.getModo === 'function' &&
            window.Lista.getModo() === 'detalle' &&
            typeof window.Lista.cerrarDetalle === 'function') {
          window.Lista.cerrarDetalle(false);
        }
      } catch (_) {}

      /* Mismo carril que limpiar el campo: la lista vuelve al
         chip activo (y Lista apaga el botón compartir con la
         cifra del repintado). */
      document.dispatchEvent(new CustomEvent('buscar:change', {
        detail: { termino: '', enLimite: false }
      }));
    }

    /* Si el receptor cambia de ciudad o de chip, el compartido se
       limpia automáticamente (decisión del dueño). Durante la
       recepción, los eventos que dispara la propia apertura no
       cuentan (aplicando). */
    document.addEventListener('chips:change', function () {
      if (modoCompartido && !aplicando) limpiar();
    });

    document.addEventListener('ciudad:change', function () {
      if (modoCompartido && !aplicando) limpiar();
    });

    /* ============================================================
       API pública
       ============================================================ */
    return {
      pintar:         pintar,
      hayEntrante:    hayEntrante,
      recibir:        recibir,
      urlDePost:      urlDePost,
      limpiar:        limpiar,
      estaCompartido: function () { return !!modoCompartido; }
    };

  })();
