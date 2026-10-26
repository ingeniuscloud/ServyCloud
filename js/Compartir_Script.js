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
                 visible: término de búsqueda O chip activo, más
                 la ciudad.
                 R126 · ENLACE DE POST = GEMELA POR TOKEN (orden del
                 dueño: cada post comparte SU OG real): urlPages +
                 '/' + token + '.html' — la page e/<TOKEN>.html que
                 el 04 Generador 2.0 escribe con la OG REAL del post
                 y el salto ?s= instantáneo. WhatsApp previsualiza
                 LA IMAGEN DEL POST (muere el OG POR DEFECTO para
                 los posts) y el nombre del archivo muestra SOLO el
                 token (cero idPost). El enlace de LISTA sigue en la
                 page base (urlPages + '/?s=' + token, OG de marca:
                 una lista no tiene imagen propia). Ambos llevan
                 cache-bust ?v=. Sin urlPages, el enlace va directo
                 a la app (root.app.urlApp) con el mismo payload ?s=.
                 R124 · ambos enlaces siguen CAMUFLADOS: token corto
                 ?s=, la idPost NUNCA en la URL (diseño original
                 del dueño): el token la lleva OFUSCADO y el
                 receptor de siempre lo abre (desempaquetar →
                 tipo 'p' → recibirPost). La page reenvía el ?s= a
                 la app (location.replace, NUNCA al /exec de GAS).
                 MENSAJES (R108 · nueva estructura):
                 · POST → compartir.mensajeWhatsapp del POSTJSON
                   (texto completo del dueño) + el enlace.
                 · LISTA → root.app.compartir.mensajeListaWhatsapp
                   con [ciudad] (UPPERCASE de la ciudad activa) y
                   [textoBuscado] (texto del buscador; sin filtro =
                   "lista general") + el enlace. Ahora se puede
                   compartir TAMBIÉN la lista sin filtros.
                 El payload viaja OFUSCADO (XOR con clave embebida +
                 base64url): el ID del post o el término NUNCA van
                 planos en la URL. Los enlaces antiguos ?d=
                 (AES-256-GCM) siguen abriendo.
                 Receptor: Core llama Compartir.recibir() cuando
                 TABLAS cargó y el lienzo está inyectado; se aplica
                 ciudad + contenido y la app entra en MODO
                 COMPARTIDO: ciudad VISTA pero BLOQUEADA, campo de
                 búsqueda fijado SIN foco y la X del campo libera la
                 vista. R108: el MENÚ GLOBAL queda VISIBLE en modo
                 lista compartida (decisión del dueño — CSS en
                 Chips_CSS). El header del detalle lo decide el TIPO
                 de enlace: con UN post la fila sustituye al par
                 volver/título del modo detalle y la salida es la X;
                 con una LISTA cada post abre con volver/título
                 normales para recorrer los demás posts del filtro,
                 y la X queda en la lista. Al limpiar vuelve todo el
                 catálogo (la ciudad del enlace queda como la del
                 receptor). Aviso amable si el contenido compartido
                 ya no existe. La instalación de la PWA NO cambia:
                 se hace desde la app con el enlace principal (menú /
                 píldora), nunca desde el enlace compartido.
VERSIÓN:         2.6
CAMBIOS:         R126: GEMELA POR TOKEN + LISTA COMPARIDA VUELVE A
                 FILTRAR. (1) armarEnlacePost arma ahora
                 urlPages + '/' + token + '.html' (page con OG real
                 del post; 04 Generador 2.0) y armarEnlace añade el
                 cache-bust ?v= (timestamp base36): el nombre del
                 archivo ya NO lleva idPost, así que el ?v= es
                 seguro otra vez y WhatsApp rescrapea cada enlace
                 nuevo (corregir la imagen de un post ya compartido
                 renueva la tarjeta). (2) RECEPTOR LISTA: el
                 repintado de fondo del aterrizaje (ciudad/chips,
                 R63) le ganaba la carrera al filtro de la palabra
                 y el receptor veía el campo con la palabra pero la
                 lista COMPLETA. aplicarFiltro re-afirma el filtro
                 en el ciclo siguiente (la palabra es el estado
                 FINAL del enlace compartido) y Core_Script 1.38
                 respeta el campo en sus repintados de fondo. Nada
                 más del receptor cambia.
                 R124: ENLACE DE POST CAMUFLADO (orden del dueño:
                 el idPost NO va en la URL — diseño original).
                 armarEnlacePost arma el token corto
                 empaquetar('p',[idPost]) y apunta a la PAGE BASE
                 (urlPages + '/?s=' + token): el MISMO patrón
                 convalidado del enlace de LISTA. Muere el enlace a
                 la página gemela con ?v= (timestamp): el idPost
                 viajaba PLANO en la URL. El receptor tipo 'p' ya
                 existía (recibirPost → irAPost) — cero cambios en
                 recepción. Las gemelas /e/ID.html siguen existiendo
                 para OG/QR (Generador), solo dejan de ser destino
                 del botón compartir.
                 R109: FUERA el mensaje hardcodeado de lista (orden
                 del dueño: los textos de WhatsApp viven en la BD).
                 Sin plantilla en app.compartir.mensajeListaWhatsapp
                 el mensaje es SOLO el enlace — el código no inventa
                  texto. tituloChip sigue (lo usa la plantilla
                  con [textoBuscado]) y buscarPost sigue (receptor).
                 R108: (1) urlPages() lee root.app.compartir.urlPages
                 (nueva ubicación del ROOT) con respaldo en
                 app.urlPages. (2) El enlace de LISTA apunta a la
                 page base (urlPages + '/?s=' + token) para que
                 WhatsApp previsualice el OG POR DEFECTO; la page
                 reenvía el ?s= y el receptor cae con su lista.
                 (3) El mensaje de lista sale de
                 app.compartir.mensajeListaWhatsapp con los
                 placeholders [ciudad] (UPPERCASE) y [textoBuscado]
                 (texto del buscador, título del chip si comparte
                 por chip, o "lista general" si comparte todo); se
                 puede compartir la lista SIN filtros. (4) El
                 formato armado previo queda como respaldo si el
                 ROOT aún no trae la plantilla — respaldo retirado
                 en R109.
DEPENDENCIAS:    Index.html (estructura .filtros-wrap, SISTEMA,
                 TABLAS), Lista_Script.html (TABLAS.posts,
                 visibilidad de #btnCompartir),
                 Ciudad_Sheet_Script.html (getActual, getLista,
                 aplicarGuardada), Chips_Script.html (chips:change,
                 getChipActivo, seleccionar),
                 Seccion_Script.html (irAPost público),
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
      return pages + '/' + token + '.html' + cacheBust();
    }

    function armarEnlace(token) {
      if (!token) return urlBase();
      return urlBase() + '?s=' + token + cacheBust();
    }

    /* R126 · cache-bust corto (base36): cada enlace emitido es
       una URL distinta → WhatsApp re-scrapea y la tarjeta sale
       fresca (el nombre de la page ya no lleva idPost, el ?v=
       es seguro; el receptor lo ignora: solo lee ?s=). */
    function cacheBust() {
      try { return '?v=' + Date.now().toString(36); }
      catch (_) { return ''; }
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
        var url = pages
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

          /* R126 · SEGUNDA PASADA en el ciclo siguiente: el
             aterrizaje dispara ciudad:change / chips:change
             (repintados R63) que pueden llegar DESPUÉS de este
             filtro; la palabra re-afirma aquí su repintado y
             queda como estado FINAL del enlace compartido.
             Core_Script 1.38 hace lo propio en sus repintados
             de fondo (catálogo L2 distinto). */
          setTimeout(function () {
            if (modoCompartido === 'lista') {
              document.dispatchEvent(new CustomEvent('buscar:change', {
                detail: { termino: termino, enLimite: false }
              }));
            }
          }, 0);
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
