/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Compartir_Script.html
ESPEJO GITHUB:   github/js/Compartir_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Compartir por enlace. Dos emisores:
                 (1) POST — Social pide Compartir.urlDePost(post) y
                 su mensaje de WhatsApp lleva el enlace; R98: si el
                 post trae meta.promo en su POSTJSON (viaja en el
                 catálogo como post.promo) y la BD define
                 ROOTJSON.app.urlPages, el enlace es la PAGE de
                 GitHub Pages (e/<id>.html, generada con la
                 Generador OG): tarjeta OG completa + redirección al
                 enlace profundo. Sin urlPages o sin meta.promo →
                 enlace ?s= de siempre.
                 (2) LISTA FILTRADA — el TEXTO "Compartir lista
                 filtrada" sobre la lista (R64: vive en el respiro
                 entre filtros y items; Lista_Script decide su
                 visibilidad con los items) comparte el filtro
                 visible: término de búsqueda O chip activo, más
                 la ciudad.
                 El enlace ?s= viaja en UN parámetro corto con el
                 payload compacto y OFUSCADO (XOR con clave
                 embebida + base64url): el ID del post o el
                 término NUNCA van planos en la URL. Los enlaces
                 antiguos ?d= (AES-256-GCM) siguen abriendo.
                 Receptor: Core llama
                 Compartir.recibir() cuando TABLAS cargó y el lienzo
                 está inyectado; se aplica ciudad + contenido y la
                 app entra en MODO COMPARTIDO: ciudad VISTA pero
                 BLOQUEADA, campo de búsqueda fijado SIN foco y la
                 X del campo libera la vista (sin menú global ni
                 compartir). El header del detalle lo decide el
                 TIPO de enlace (esta ronda marca el body): con UN
                 post la fila sustituye al par volver/título del
                 modo detalle y la salida es la X; con
                 una LISTA cada post abre con volver/título normales
                 para recorrer los demás posts del filtro, y
                 la X queda en la lista. Al limpiar
                 vuelve todo el catálogo (la ciudad del enlace queda
                 como la del receptor). Aviso amable si el contenido
                 compartido ya no existe. La instalación de la PWA
                 NO cambia: se hace desde la app con el enlace
                 principal (menú / píldora), nunca desde el enlace
                 compartido.
VERSIÓN:         2.2
CAMBIOS:         R98: urlDePost entrega la PAGE de GitHub Pages
                 para los posts con meta.promo (post.promo del
                 catálogo) cuando la BD trae app.urlPages: base +
                 /e/ + id + .html + ?v= (pide a WhatsApp releer la
                 tarjeta en cada compartir). La page (subida con la
                 Generador OG) lleva la tarjeta OG completa y
                 redirige al enlace profundo ?s=. Sin urlPages o
                 sin meta.promo el enlace ?s= queda EXACTO como
                 siempre. La LISTA FILTRADA no cambia.
                 R64: la visibilidad del botón la lleva
                 Lista_Script (lo enciende con items en la
                 lista) — FUERA los listeners 'buscar:estado' y
                 'buscar:resultados'; el enlace de LISTA admite
                 compartir por CHIP sin término (payload
                 'l·ciudad·q·chip' con '-' como término vacío;
                 los de 2 partes antiguos siguen abriendo): si el
                 enlace trae término se filtra como siempre, y si
                 trae chip se selecciona el chip en el receptor.
                 La X del campo libera la vista (el trabajo que
                 hacía CANCELAR).
                 R61: el emisor de LISTA FILTRADA es el TEXTO
                 "Compartir lista filtrada" (el estilo lo viste
                 Chips_CSS). El modo compartido lo retira con
                 body.modo-compartido.
                 R43: lista compartida — activarModo marca el body
                 con compartido-lista / compartido-post y limpiar
                 los retira; con eso Chips_CSS devuelve el par
                 volver/título dentro de cada post de una lista
                 compartida (el receptor puede verlos todos y
                 regresar). El post compartido solitario queda
                 exactamente igual: la fila con la X es su
                 salida. Enlace corto ?s=, receptor legacy ?d= y
                 línea de confianza intactos.
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
       receptor lo trata como enlace no válido). R64: la lista
       acepta el chip como tercer campo (q '-' = sin término).
       Los de 2 partes (solo ciudad+término) siguen abriendo. */
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
       URL base · la misma que comparte la app (urlApp del Root),
       con la URL_EXEC de respaldo. La instalación de la PWA
       sigue siendo cosa de la app (menú), no del enlace.
       ============================================================ */
    function urlBase() {
      var url = '';
      try {
        var root = (window.SISTEMA && window.SISTEMA.root) || {};
        url = String((root.app && root.app.urlApp) || '').trim();
      } catch (_) {}
      if (!url) url = String(window.URL_EXEC || '').trim();
      return url.replace(/\?+$/, '');
    }

    function armarEnlace(token) {
      if (!token) return urlBase();
      return urlBase() + '?s=' + token;
    }

    /* ============================================================
       R98 · BASE DE PAGES · ROOTJSON.app.urlPages (carpeta e/ del
       repo, terminada en /e). Vacía → no hay pages y todo
       comparte el enlace ?s= de siempre (comportamiento intacto).
       ============================================================ */
    function urlPages() {
      try {
        var root = (window.SISTEMA && window.SISTEMA.root) || {};
        return String((root.app && root.app.urlPages) || '')
          .trim().replace(/[\/\?]+$/, '');
      } catch (_) {
        return '';
      }
    }

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
       R98 · PAGE DE ENLACE: post con meta.promo (post.promo viaja
       en el catálogo desde 02 Cache.gs) + app.urlPages en la BD →
       el enlace compartido es la page e/<id>.html (subida con la
       Generador OG): WhatsApp lee la tarjeta OG completa y la page
       redirige al enlace profundo. ?v= en el enlace pide releer
       la tarjeta en cada compartir (ediciones sin esperar caché).
       IMPORTANTE: la page debe estar SUBIDA antes de activar la
       promo del post (receta en el LEEME de la ronda).
       ============================================================ */
    function urlDePost(post) {
      if (!post || !post.id) return Promise.resolve(urlBase());

      var base = urlPages();
      if (base && post.promo) {
        return Promise.resolve(
          base + '/' + encodeURIComponent(post.id) + '.html?v=' + Date.now()
        );
      }

      return Promise.resolve(
        armarEnlace(empaquetar('p', [String(post.id)]))
      );
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

    function compartirLista() {
      if (!btn || btn.disabled) return;

      var input = document.getElementById('buscarInput');
      var termino = String((input && input.value) || '').trim();

      var chipActivo = null;
      try {
        chipActivo = (window.Chips && typeof window.Chips.getChipActivo === 'function')
          ? window.Chips.getChipActivo() : null;
      } catch (_) {}

      /* R64: sin término de búsqueda se comparte la lista del
         CHIP activo (el botón vive con items, no solo en
         búsqueda). Sin término y sin chip no hay nada que
         compartir. */
      if (!termino && !chipActivo) return;

      var ciudad = null;
      try {
        ciudad = (window.Ciudad && typeof window.Ciudad.getActual === 'function')
          ? window.Ciudad.getActual() : null;
      } catch (_) {}

      /* El mensaje describe la lista VISIBLE: el primer item en
         pantalla da el chip y el grupo (curso/servicio). */
      var primer = null;
      var item = document.querySelector('#listaWrap .lista-item[data-post]');
      if (item) primer = buscarPost(item.getAttribute('data-post'));

      var tipo = singularDe(tituloChip(primer && (primer.idChips || [])[0]));
      var grupo = tituloGrupo(primer && (primer.idGrupo || [])[0]);

      haptic(10);

      var token = (ciudad && ciudad.idCiudad)
        ? empaquetar('l', [
            String(ciudad.idCiudad),
            termino ? termino.slice(0, 40) : '-',
            String(chipActivo || '')
          ])
        : null;

      try {
        var url = armarEnlace(token);

        var saludo = (ciudad && ciudad.titulo)
          ? '🖐️ ¡Mira esto en *' + String(ciudad.titulo).trim().toUpperCase() + '*! 🔎'
          : '🖐️ ¡Mira esto! 🔎';

        var que = '✨ Lista';
        if (tipo)  que += ' de *' + tipo + '*';
        if (grupo) que += ' de ' + grupo;

        /* Línea de confianza según el caso (decisión del dueño) */
        var confianza = esServicio(tipo)
          ? 'Te lo recomiendo'
          : 'Inscripciones abiertas, reserva tu cupo desde ya en la app Servy';

        var texto =
          saludo + '\n\n' +
          que + '\n' +
          confianza + '\n\n' +
          '🔗 Abre el enlace para ver la lista en la app' +
          '\n' + url;

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
       Botón compartir (R64) · la visibilidad la decide
       Lista_Script (lo muestra cuando la lista trae items); aquí
       solo vive el binding del click y el envío.
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
         (compartido antes de R40) → descifrar AES. */
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

    /* Nombres legibles para el mensaje de WhatsApp. Los chips se
       escriben en plural ("Cursos", "Servicios"): al usuario se le
       habla en singular ("CURSO", "SERVICIO") con mayúsculas para
       la negrita de WhatsApp. */
    function tituloChip(idChip) {
      var chips = (window.SISTEMA && window.SISTEMA.chips) || [];
      var id = String(idChip || '').trim();
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].idChip === id) return String(chips[i].titulo || '').trim();
      }
      return '';
    }

    function tituloGrupo(idGrupo) {
      var grupos = (window.SISTEMA && window.SISTEMA.grupoJson) || [];
      var id = String(idGrupo || '').trim();
      for (var i = 0; i < grupos.length; i++) {
        if (grupos[i].idGrupo === id) return String(grupos[i].titulo || '').trim();
      }
      return '';
    }

    function singularDe(titulo) {
      var t = String(titulo || '').trim().toUpperCase();
      return t.replace(/S$/, '');
    }

    function esServicio(tipoSingular) {
      return String(tipoSingular || '').indexOf('SERVIC') === 0;
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

      /* R60: la CÁPSULA queda desplegada y bloqueada — la clase
         .compartida viste la fila (chips/lupa/compartir fuera,
         solo CANCELAR activo) y la cabecera (menú global
         fuera). */
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
         sustituyendo a ese par, como siempre. */
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

      /* Mismo camino probado del cross-sell (R19): ciudad con
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

      /* R64: el enlace puede venir por término de búsqueda (de
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
          /* R64 · lista compartida POR CHIP: se selecciona el
             chip del enlace (Lista repinta con su filtro). El
             campo queda limpio: el filtro real es el chip. */
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