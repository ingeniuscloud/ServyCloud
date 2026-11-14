/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Compartir_Script.html
ESPEJO GITHUB:   github/js/Compartir_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Compartir por enlace. Dos emisores:
                 (1) POST — Social pide Compartir.urlDePost(post) y
                 su mensaje de WhatsApp lleva el enlace del post;
                 (2) LISTA FILTRADA — el TEXTO "Compartir lista
                 filtrada" sobre la lista (Lista_Script decide su
                 visibilidad con los items) comparte el filtro
                 visible: término de búsqueda, chip activo o ambos
                 (R173), más la ciudad.
                 RECEPTOR · R171: la carga por enlace de UN POST ya
                 NO activa modo compartido — la app carga NORMAL y
                 el ad de esa carga es EL DEL POST (OpenAd.adDePost,
                 cross-sell directo: el post SOLO abre con el click
                 del ad). El modo compartido es SOLO de LISTA.
                 veredictoEntrante() le dice al OpenAd qué trae la
                 carga ANTES de montar el promo.
VERSIÓN:         2.9.4
CAMBIOS:         R180: ORDEN DEL DUEÑO — EL VERDADERO FILTRO: del
                 enlace compartido despiertan CIUDAD y CHIP.
                 recibirLista vuelve (reducido): puerta SÍNCRONA
                 que Core llama cuando el veredicto es 'lista',
                 ANTES del chequeo de ciudad pendiente. Misma
                 mecánica nativa de Puente.aplicarEstado:
                 aplicarGuardada + app_vista — Chips.pintar nace
                 con el chip del enlace activo y el carril monta
                 sus páginas ya filtradas en la ÚNICA pintada del
                 ciclo de siempre (sin buscar:change, sin
                 repintados, cero cuotas). La palabra de búsqueda
                 SIGUE DORMIDA (no se toca el campo). Legacy ?d=
                 (ya no se emiten) sigue dormido (R179).
                 R179: ORDEN DEL DUEÑO — CARGA DE PRIMERA VEZ: el
                 enlace compartido NO se aplica y su código de
                 precarga se ELIMINA (fuera recibirLista,
                 activarModo y avisoAmable). Ciudad, chip y
                 palabra viajan DORMIDOS: el emisor sigue
                 empaquetándolos igual, el receptor los ignora y
                 su app carga NORMAL — su ciudad guardada o, si no
                 tiene, la elección obligatoria de primera vez
                 (el arranque de Core decide con veredictoEntrante,
                 puerta local de siempre, cero cuotas). Solo el
                 POST compartido (R171) despierta: recibirPost →
                 OpenAd.adDePost intacto. La X de salida (limpiar)
                 se queda: es la puerta que Buscar usa.
                 R178: receptor con la lista completa sin filtro
                 (prueba sustituida por R179/R180).
                 R174: el cambio de CHIP ya NO limpia el modo
                 compartido (orden del dueño: mientras la palabra
                 esté en el campo, cada chip muestra SUS items que
                 concuerdan — solo el campo vacío quita el filtro).
                 La auto-limpieza queda SOLO en ciudad:change
                 (R108). Pareja con Chips_CSS: los chips vuelven a
                 verse en el modo compartido.
                 R173: receptor de lista — el enlace trae chip Y
                 palabra y se aplican AMBOS: la búsqueda es por
                 chip (Lista), así que aterrizar sin el chip del
                 emisor mostraba otro chip distinto, o vacío. El
                 token NO cambia.
                 R172: CORRECCIÓN — veredictoEntrante quedó sin
                 exportar en el return del módulo (falla R171): el
                 veredicto siempre resolvía null y el open ad de
                 PROMO montaba primero en toda carga de post
                 compartido (a los segundos el ad del post lo
                 relevaba). Exportado → el veredicto resuelve al
                 instante y el promo NUNCA monta en carga de post.
                 R171: MUERE el modo compartido-post (cápsula,
                 CANCELAR, título en el input, apertura automática
                 y aviso amable del receptor — orden del dueño).
                 recibirPost solo le pasa el id al OpenAd
                 (adDePost). Nace veredictoEntrante (?s= sync, ?d=
                 legacy async). Buscar_post y liberarTrasApertura
                 retirados (código sin función). El receptor de
                 LISTA queda INTACTO al 100%. Historial:
                 bitácora/versiones.
DEPENDENCIAS:    Index.html (estructura .filtros-wrap, SISTEMA,
                 TABLAS), Lista_Script.html (TABLAS.posts,
                 visibilidad de #btnCompartir),
                 Ciudad_Sheet_Script.html (getActual, getLista,
                 aplicarGuardada), Chips_Script.html (chips:change,
                 getChipActivo, seleccionar),
                 Opend_Ad_Script.html (adDePost — R171),
                 Core_Script.html (llama pintar/recibir),
                 Social_Script.html (urlDePost), Chips_CSS.html
                 (.btn-compartir / .compartida)
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
                      enlaces y respaldo de ambos emisores.
       · urlPages() → la carpeta e/: R108 la lee de
                      root.app.compartir.urlPages (ubicación del
                      ROOT) con respaldo en app.urlPages. R124:
                      AMBOS enlaces (post y lista) apuntan a su
                      page base con el token ?s= — WhatsApp
                      previsualiza el OG POR DEFECTO y la page
                      reenvía el ?s= a la app.
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

    /* Enlace del POST (R126 · orden del dueño: OG REAL sin
       exponer el idPost). GEMELA POR TOKEN: la page
       e/<TOKEN>.html lleva la OG REAL del post (04 Generador
       2.0) y salta a la app con el mismo token. WhatsApp lee la
       OG del archivo ANTES de que salte: tarjeta con la imagen
       del post, URL con SOLO el token. Sin urlPages en el ROOT,
       directo a la app con el token. Sin token (fallo de
       empaquetado), enlace pelado a la base. */
    function armarEnlacePost(idPost) {
      var token = empaquetar('p', [String(idPost)]);
      if (!token) return urlBase();

      var pages = urlPages();
      if (!pages) return armarEnlace(token);
      return pages + '/' + token + '.html' + cacheBust('?');
    }

    function armarEnlace(token) {
      if (!token) return urlBase();
      return urlBase() + '?s=' + token + cacheBust();
    }

    /* R126 · cache-bust corto (base36): cada enlace emitido es
       una URL distinta → WhatsApp re-scrapea y la tarjeta sale
       fresca (el nombre de la page ya no lleva idPost, el ?v=
       es seguro; el receptor lo ignora: solo lee ?s=).
       R132 · SEPARADOR: la gemela del post (e/TOKEN.html) abre
       su query propia → «?v=»; los enlaces ?s= ya llevan query
       → «&v=» (un segundo «?» empalmaba el token — ?s=TOKEN?v=
       — y el receptor no filtraba nada ni mostraba la palabra). */
    function cacheBust(separador) {
      try {
        return (separador === '?' ? '?' : '&') + 'v=' + Date.now().toString(36);
      } catch (_) { return ''; }
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
           POR DEFECTO (fijo del ROOT) — una lista no tiene
           imagen propia. La page reenvía el ?s= a la app, así el
           receptor aterriza con su lista. R126: con cache-bust
           ?v=. Sin urlPages, el enlace va directo a la app como
           siempre. */
        var pages = urlPages();
        var url = (token && pages)
          ? pages + '/?s=' + token + cacheBust()
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

    /* ============================================================
       R171 · VEREDICTO DE ENTRADA · ¿qué trae esta carga?
       El OpenAd lo pregunta ANTES de montar el promo: si la carga
       viene por el enlace de UN POST (?s= token 'p' — o el ?d=
       legacy que descifre a un post), el promo queda APAGADO para
       esa carga y el ad es EL DEL POST. Lista compartida y carga
       normal → promo como siempre.
       · ?s=  → desempaquetar es LOCAL y SINCRÓNICO: resuelve al
                instante.
       · ?d=  → descifrar (crypto local, legacy): resuelve al
                milisegundo.
       SIEMPRE resuelve (fallo → null): el promo nunca queda
       colgado. No toca la URL ni el estado: solo LEE.
       ============================================================ */
    function veredictoEntrante() {
      var corto = leerParam('s');
      var crudo = corto || leerParam('d');
      if (!crudo) return Promise.resolve(null);

      if (corto) {
        try {
          var d = desempaquetar(corto);
          if (d && d.t === 'p') return Promise.resolve('post');
          if (d && d.t === 'l') return Promise.resolve('lista');
          return Promise.resolve(null);
        } catch (_) {
          return Promise.resolve(null);
        }
      }

      return descifrar(crudo).then(function (datos) {
        if (!datos || !datos.t) return null;
        return datos.t === 'p' ? 'post' : 'lista';
      }).catch(function () {
        return null;
      });
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

          /* R179 · SOLO EL POST DESPIERTA (orden del dueño): el
             enlace de LISTA no se aplica — ciudad, chip y palabra
             viajan dormidos y la app carga normal de primera vez
             (el arranque de Core enruta con veredictoEntrante).
             El código de precarga de lista fue ELIMINADO. */
          if (datos.t !== 'p') return;

          aplicando = true;
          recibirPost(datos);
        })
        .catch(function (err) {
          console.warn('[Compartir] Enlace no válido:', err && err.message);
        });
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

    /* R171 · RECEPTOR DE POST · la app carga NORMAL detrás y el
       post SOLO abre con el click del open ad del post (la puerta
       de entrada convalidada: cross-sell directo). Aquí no se
       activa modo, no se abre nada y no hay aviso amable: la
       cadena de imagen y los destinos viven en OpenAd.adDePost
       (propio o de emergencia — el ad nunca falta). */
    function recibirPost(datos) {
      var id = String(datos.id || '').trim();
      aplicando = false;
      if (!id) return;

      try {
        if (window.OpenAd && typeof window.OpenAd.adDePost === 'function') {
          window.OpenAd.adDePost(id);
          return;
        }
      } catch (err) {
        console.warn('[Compartir] Ad del post falló:', err && err.message);
      }
    }

    /* ============================================================
       R180 · RECEPTOR DE LISTA (despierto parcial, orden del
       dueño): del enlace SOLO despiertan CIUDAD y CHIP — la
       palabra de búsqueda sigue dormida (no se toca el campo).
       Es la puerta SÍNCRONA que Core llama en el arranque cuando
       el veredicto es 'lista', ANTES del chequeo de ciudad
       pendiente. Misma mecánica nativa de Puente.aplicarEstado:
       · ciudad → Ciudad.aplicarGuardada (queda como la del
                  receptor, pinta el botón y emite ciudad:change —
                  el ciclo de siempre; su resetearVista escribe el
                  chip de servicio y ATRÁS llega el chip del
                  enlace).
       · chip   → app_vista en localStorage (validado contra
                  SISTEMA.chips): Chips.pintar lo NACE activo y el
                  carril monta sus páginas con ese chip — la lista
                  sale filtrada en la ÚNICA pintada del ciclo
                  normal. Sin buscar:change, sin repintados, cero
                  llamadas GAS nuevas.
       Enlace legacy ?d= (ya no se emiten): dormido (R179).
       ============================================================ */
    function aplicarDatosLista(datos) {
      var chip = String(datos.g || '').trim();

      /* Ciudad del enlace: misma búsqueda de siempre (R178). Si
         ya no existe, la ciudad no se aplica (carga normal). */
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

      if (ciudad) {
        try { window.Ciudad.aplicarGuardada(ciudad); } catch (_) {}
      }

      /* El chip del enlace va DESPUÉS de la ciudad: el
         ciudad:change de la aplicación escribe el chip de
         servicio (resetearVista, R63) y el chip del enlace manda
         al final. Si no existe o está apagado, la vista no se
         toca (camino de siempre). */
      if (chip) {
        var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
        for (var j = 0; j < chips.length; j++) {
          if (chips[j] && chips[j].idChip === chip &&
              chips[j].estado !== false) {
            try {
              localStorage.setItem('app_vista',
                JSON.stringify({ idChip: chip }));
            } catch (_) {}
            break;
          }
        }
      }
    }

    function recibirLista() {
      var corto = leerParam('s');
      if (!corto) return;   /* legacy ?d=: dormido (R179) */

      var datos = null;
      try {
        datos = desempaquetar(corto);
      } catch (err) {
        console.warn('[Compartir] Enlace no válido:', err && err.message);
        return;
      }
      if (!datos || datos.t !== 'l') return;

      /* La barra queda limpia YA (misma regla de recibir):
         recargar no re-ejecuta el enlace compartido. */
      limpiarUrl();

      aplicarDatosLista(datos);
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
      document.body.classList.remove('compartido-lista');
      document.body.classList.remove('modo-compartido');

      /* Lista compartida: si el receptor abrió el detalle de un
         post de la lista, limpiar devuelve a la normalidad
         COMPLETA: cerrar el detalle y volver al listado. */
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

    /* R174 · el compartido SOLO se limpia con la CIUDAD (R108,
       decisión del dueño): el CAMBIO DE CHIP ya no toca nada.
       Mientras la palabra siga en el campo, cada chip muestra
       SUS items que concuerdan (postsDeChip de Lista repinta
       con el término) y el filtro muere únicamente cuando el
       campo queda vacío (la X de salida → Compartir.limpiar).
       Durante la recepción, los eventos que dispara la propia
       apertura siguen sin contar (aplicando). */
    document.addEventListener('ciudad:change', function () {
      if (modoCompartido && !aplicando) limpiar();
    });

    /* ============================================================
       API pública
       ============================================================ */
    return {
      pintar:         pintar,
      hayEntrante:       hayEntrante,
      veredictoEntrante: veredictoEntrante,
      recibir:           recibir,
      recibirLista:      recibirLista,
      urlDePost:         urlDePost,
      limpiar:           limpiar,
      estaCompartido:    function () { return !!modoCompartido; }
    };

  })();
