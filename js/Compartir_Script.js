/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Compartir_Script.html
ESPEJO GITHUB:   js/Compartir_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Compartir por enlace. Dos emisores:
                 (1) POST — Social pide Compartir.urlDePost(post) y
                 su mensaje de WhatsApp lleva el enlace profundo;
                 (2) LISTA FILTRADA — el botón circular
                 #btnCompartir de la fila de filtros (INACTIVO al
                 abrir la búsqueda, activo SOLO cuando el filtro
                 trae resultados) comparte el término + la ciudad
                 activa.
                 El enlace viaja en UN parámetro ?d= con el payload
                 CIFRADO (AES-256-GCM, IV aleatorio por enlace,
                 base64url): el ID del post o el término NUNCA van
                 planos en la URL. Receptor: Core llama
                 Compartir.recibir() cuando TABLAS cargó y el lienzo
                 está inyectado; se aplica ciudad + contenido y la
                 app entra en MODO COMPARTIDO: ciudad VISTA pero
                 BLOQUEADA, campo de búsqueda fijado SIN foco y solo
                 "Limpiar búsqueda" a la derecha (sin menú global);
                 en un post compartido esa fila sustituye al par
                 volver/título del modo detalle. Al limpiar vuelve
                 todo el catálogo (la ciudad del enlace queda como
                 la del receptor). Aviso amable si el contenido
                 compartido ya no existe. La instalación de la PWA
                 NO cambia: se hace desde la app con el enlace
                 principal (menú / píldora), nunca desde el enlace
                 compartido.
VERSIÓN:         1.1
CAMBIOS:         R37: mensaje de WhatsApp de la lista con el formato
                 del dueño: saludo con la ciudad en MAYÚSCULAS y
                 negrita, "✨ Lista de *CHIP* de Grupo" y línea de
                 confianza (curso: inscripciones abiertas ·
                 servicio: te lo recomiendo), enlace en línea
                 propia; el modo compartido activa
                 body.modo-compartido y "Limpiar búsqueda" también
                 cierra el detalle de un post compartido. Encabezado
                 simplificado: solo lo vigente.
DEPENDENCIAS:    Index.html (estructura .filtros-wrap, SISTEMA,
                 TABLAS), Buscar_Script.html (buscar:estado,
                 #buscarInput), Lista_Script.html
                 (buscar:resultados, TABLAS.posts),
                 Ciudad_Sheet_Script.html (getActual, getLista,
                 aplicarGuardada), Chips_Script.html (chips:change),
                 Seccion_Script.html (irAPost público),
                 Core_Script.html (llama pintar/recibir),
                 Social_Script.html (urlDePost), Chips_CSS.html
                 (.btn-compartir / .btn-limpiar / .compartida)
════════════════════════════════════════════════════════════════════*/

  window.Compartir = (function () {

    /* ============================================================
       CIFRADO · AES-256-GCM · clave fija embebida
       El objetivo (definido con el dueño) es que el enlace NO
       lleve el ID del post ni el término en claro: cifrar con una
       clave que viaja dentro de la app es OFUSCAMIENTO FUERTE, no
       custodia de secretos. IV aleatorio de 12 bytes por enlace →
       el mismo contenido produce enlaces distintos cada vez.
       Sin crypto.subtle (navegador viejo) no hay enlace profundo:
       urlDePost resuelve la URL principal y el resto funciona
       como siempre.
       ============================================================ */
    var CLAVE_B64 = 'jU8VmYAwIx8ipwsLIt3nAjo2fKPSdCPUphlZtVj6GlQ=';
    var LARGO_IV  = 12;

    var clavePromesa = null;

    function hayCrypto() {
      return !!(window.crypto && window.crypto.subtle &&
                typeof window.crypto.subtle.importKey === 'function');
    }

    function getClave() {
      if (!clavePromesa) {
        var crudo = Uint8Array.from(atob(CLAVE_B64), function (c) {
          return c.charCodeAt(0);
        });
        clavePromesa = window.crypto.subtle.importKey(
          'raw', crudo, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
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

    function cifrar(obj) {
      if (!hayCrypto()) return Promise.resolve(null);

      try {
        var datos = new TextEncoder().encode(JSON.stringify(obj));
        var iv = window.crypto.getRandomValues(new Uint8Array(LARGO_IV));

        return getClave()
          .then(function (clave) {
            return window.crypto.subtle.encrypt(
              { name: 'AES-GCM', iv: iv }, clave, datos
            );
          })
          .then(function (buf) {
            var cuerpo = new Uint8Array(buf);
            var todo = new Uint8Array(iv.length + cuerpo.length);
            todo.set(iv, 0);
            todo.set(cuerpo, iv.length);
            return bytesAB64url(todo);
          })
          .catch(function (err) {
            console.warn('[Compartir] Cifrado no disponible:', err && err.message);
            return null;
          });
      } catch (err) {
        console.warn('[Compartir] Cifrado no disponible:', err && err.message);
        return Promise.resolve(null);
      }
    }

    function descifrar(token) {
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
      return urlBase() + '?d=' + token;
    }

    /* ============================================================
       Estado
       ============================================================ */
    var modoCompartido = null;   /* 'post' | 'lista' | null */
    var aplicando      = false;  /* guarda durante la recepción */
    var btn            = null;
    var btnLimpiar     = null;

    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    /* ============================================================
       Emisor · POST (lo consume Social)
       ============================================================ */
    function urlDePost(post) {
      if (!post || !post.id) return Promise.resolve(urlBase());

      return cifrar({ v: 1, t: 'p', id: String(post.id) })
        .then(function (token) {
          return armarEnlace(token);
        });
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
      if (!termino) return;

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

      var payload = { v: 1, t: 'l', q: termino.slice(0, 40) };
      if (ciudad && ciudad.idCiudad) payload.c = String(ciudad.idCiudad);

      haptic(10);

      cifrar(payload)
        .then(function (token) {
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
            : 'Inscripciones abiertas actualmente';

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
        })
        .catch(function (err) {
          console.warn('[Compartir] No se pudo compartir la lista:', err && err.message);
        });
    }

    function abrirWhatsApp(texto) {
      var url = 'https://wa.me/?text=' + encodeURIComponent(texto);
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    /* ============================================================
       Botón compartir · estados pedido por el dueño
       · Oculto por defecto.
       · Al dar click en la lupa: aparece INACTIVO.
       · Solo cuando el filtro trae resultados: ACTIVO.
       ============================================================ */
    function pintar() {
      if (window.__compartirBound === '1') return;

      btn        = document.getElementById('btnCompartir');
      btnLimpiar = document.getElementById('btnLimpiarBusqueda');

      if (!btn || !btnLimpiar) return;

      window.__compartirBound = '1';

      /* El botón viste el MISMO glifo que el compartir del post */
      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(btn);
      }

      btn.addEventListener('click', compartirLista);
      btnLimpiar.addEventListener('click', function () {
        haptic(10);
        limpiar();
      });
    }

    document.addEventListener('buscar:estado', function (e) {
      if (!btn) return;
      var abierta = !!(e.detail && e.detail.abierta);

      if (abierta) {
        btn.hidden = false;
        btn.disabled = true;      /* inactivo hasta que haya resultados */
      } else {
        btn.hidden = true;
        btn.disabled = true;
      }
    });

    document.addEventListener('buscar:resultados', function (e) {
      if (!btn || btn.hidden) return;
      var d = e.detail || {};
      btn.disabled = !(Number(d.cantidad) > 0);
    });

    /* ============================================================
       Receptor · detección y recepción del enlace
       ============================================================ */
    function leerParam() {
      try {
        var q = new URLSearchParams(window.location.search);
        var v = String(q.get('d') || '').trim();
        return v || null;
      } catch (_) {
        return null;
      }
    }

    function hayEntrante() {
      return !!leerParam();
    }

    function limpiarUrl() {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.hash);
      } catch (_) {}
    }

    function recibir() {
      var crudo = leerParam();
      if (!crudo) return;

      /* La barra queda limpia YA: recargar o reenviar la URL no
         re-ejecuta el enlace compartido (protege iOS y evita
         compartir URLs sucias desde la barra del navegador). */
      limpiarUrl();

      descifrar(crudo)
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
      var input = document.getElementById('buscarInput');

      if (wrap) wrap.classList.add('compartida');
      if (input) {
        input.value = textoCampo || '';
        input.readOnly = true;
        if (typeof input.blur === 'function') input.blur();
      }

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
      if (!termino) { aplicando = false; return; }

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

      var aplicarTermino = function () {
        var input = document.getElementById('buscarInput');
        if (input) input.value = termino;

        /* Mismo carril que el buscador: Lista repinta con el
           filtro (y avisa "sin resultados" si ya no hay). */
        document.dispatchEvent(new CustomEvent('buscar:change', {
          detail: { termino: termino, enLimite: false }
        }));

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

      aplicarTermino();
    }

    /* ============================================================
       Limpiar · botón "Limpiar búsqueda" + auto-limpieza
       Devuelve la app a su estado normal: ciudades, chips y
       todas las listas. La ciudad aplicada por el enlace queda
       como la del receptor (ya es "su" ciudad).
       ============================================================ */
    function limpiar() {
      var wrap  = document.querySelector('.filtros-wrap');
      var input = document.getElementById('buscarInput');
      var aviso = document.getElementById('buscarVacio');

      if (wrap)  wrap.classList.remove('compartida');
      if (input) { input.value = ''; input.readOnly = false; }
      if (aviso) { aviso.hidden = true; aviso.textContent = ''; }

      modoCompartido = null;
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

      /* Mismo carril que cerrar la búsqueda: la lista vuelve al
         chip activo (y el botón compartir se oculta por
         buscar:estado). */
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
