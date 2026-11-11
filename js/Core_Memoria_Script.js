/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Memoria_Script.html
ESPEJO GITHUB:   github/js/Core_Memoria_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: La memoria del teléfono. Guarda y devuelve el
                 catálogo y los detalles de posts sin pedirle nada
                 más al backend:
                 · fechaVenezuela() — hora real de Venezuela
                 (America/Caracas) en el MISMO formato literal que
                 escribe el backend: yyyy-mm-ddThh:mm:ss, militar,
                 T fija, sin offset ni milisegundos. Zona FIJA por
                 nombre vía Intl; no depende del reloj del equipo.
                 La usan window.Pregunta (publicar) y PostFull.
                 · window.CacheL2 — capa persistente en
                 localStorage (stale-while-revalidate al reabrir):
                 catálogo completo y detalles de posts, con tope
                 (MAX_POSTS), TTL de 7 días y purga del shape viejo.
                 · window.PostFull — caché cliente de detalles bajo
                 demanda: memoria en vivo → L2 → backend; la
                 revalidación muda avisa por el evento
                 'post:actualizado' y anotarPregunta cosecha las
                 preguntas recién publicadas.
VERSIÓN:         1.0
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Global_Script.html (postBackend),
                 Index.html (SISTEMA, TOKEN, URL_EXEC)
════════════════════════════════════════════════════════════════════*/


  /* ============================================================
     HORA VENEZUELA REAL · fechaVenezuela()
     Único generador de horas del CLIENTE. Devuelve SIEMPRE la
     hora real de Venezuela (America/Caracas, sin horario de
     verano): yyyy-mm-ddThh:mm:ss — militar 24 h, T fija, SIN
     offset, SIN Z y SIN milisegundos: el MISMO formato literal
     que escribe el backend (_fechaVenezuela_, 02 Tablas.gs) y
     el dueño a mano en la BD. Zona FIJA por nombre vía Intl:
     no depende del reloj ni de la zona del dispositivo.
     La usa window.Pregunta (publicar) y anotarPregunta aquí.
     ============================================================ */
  function fechaVenezuela() {
    var partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      hour12:   false,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit'
    }).formatToParts(new Date());
    var v = {};
    for (var i = 0; i < partes.length; i++) {
      v[partes[i].type] = partes[i].value;
    }
    /* Motor viejo: medianoche puede salir "24" → normaliza a 00. */
    if (v.hour === '24') v.hour = '00';
    return v.year + '-' + v.month + '-' + v.day + 'T' +
           v.hour + ':' + v.minute + ':' + v.second;
  }

  /* ============================================================
     CACHEL2 · capa del dispositivo
     Persiste/lee `postJson`. La clave de localStorage se
     mantiene (sv_l2_post_<id>): el dueño ejecuta invalidarTodo()
     antes de cargar la app, y el cliente purga el shape viejo
     porque _valido() exige `postJson` en el envuelto.
     ============================================================ */
  window.CacheL2 = (function () {
    var K_CAT       = 'sv_l2_catalogo';
    var K_IDX       = 'sv_l2_posts_idx';
    var K_POST      = 'sv_l2_post_';
    var MAX_POSTS   = 30;
    var TTL_MS      = 7 * 24 * 60 * 60 * 1000;
    var ENV_VERSION = 3;   /* el catálogo viaja en su shape sin imagen */

    function _valido(env, requiereSecciones) {
      if (!env || env.v !== ENV_VERSION) return false;
      if (!env.data || typeof env.data !== 'object') return false;
      if (typeof env.ts !== 'number') return false;
      if (Date.now() - env.ts > TTL_MS) return false;
      if (requiereSecciones && !env.data.postJson) return false;
      return true;
    }

    function _envuelto(data) {
      return { v: ENV_VERSION, ts: Date.now(), data: data };
    }

    function leerCatalogo() {
      try {
        var raw = localStorage.getItem(K_CAT);
        if (!raw) return null;
        var env = JSON.parse(raw);
        if (!_valido(env, false)) return null;
        if (!Array.isArray(env.data.posts) ||
            !Array.isArray(env.data.partners)) return null;
        return { data: env.data, raw: JSON.stringify(env.data) };
      } catch (_) { return null; }
    }

    function guardarCatalogo(data) {
      if (!data || !Array.isArray(data.posts) ||
          !Array.isArray(data.partners)) return null;
      var raw = JSON.stringify(data);
      try {
        localStorage.setItem(K_CAT, JSON.stringify(_envuelto(data)));
      } catch (_) {}
      return raw;
    }

    function leerPost(idPost) {
      try {
        var clave = K_POST + String(idPost);
        var raw = localStorage.getItem(clave);
        if (!raw) return null;
        var env = JSON.parse(raw);
        if (!_valido(env, true)) {
          try { localStorage.removeItem(clave); } catch (_) {}
          return null;
        }
        return env.data;
      } catch (_) { return null; }
    }

    function guardarPost(idPost, det) {
      if (!idPost || !det || !det.postJson) return;
      try {
        localStorage.setItem(K_POST + String(idPost),
                             JSON.stringify(_envuelto(det)));
      } catch (_) { return; }

      try {
        var idx = JSON.parse(localStorage.getItem(K_IDX) || '[]');
        if (!Array.isArray(idx)) idx = [];
        var pos = idx.indexOf(idPost);
        if (pos !== -1) idx.splice(pos, 1);
        idx.push(idPost);
        while (idx.length > MAX_POSTS) {
          var viejo = idx.shift();
          if (viejo) {
            try { localStorage.removeItem(K_POST + String(viejo)); } catch (_) {}
          }
        }
        localStorage.setItem(K_IDX, JSON.stringify(idx));
      } catch (_) {}
    }

    return {
      leerCatalogo:    leerCatalogo,
      guardarCatalogo: guardarCatalogo,
      leerPost:        leerPost,
      guardarPost:     guardarPost
    };
  })();

  /* ============================================================
     POSTFULL · caché cliente de detalles bajo demanda
     (clave `postJson`).
     ============================================================ */
  window.PostFull = (function () {
    var _cache = {};

    function _recordar(idPost, det) {
      _cache[idPost] = det;
      window.CacheL2.guardarPost(idPost, det);
    }

    function _revalidar(idPost) {
      postBackend('postDetalle', { idPost: idPost }, { mudo: true })
        .then(function (det) {
          if (det && det.postJson) {
            _recordar(idPost, det);
            /* La revalidación muda AVISA — el Q&A del post activo
               repinta sus últimas preguntas con lo fresco (el post
               abierto con L2 vieja se cura al llegar). */
            try {
              document.dispatchEvent(new CustomEvent('post:actualizado', {
                detail: { idPost: idPost, det: det }
              }));
            } catch (_) {}
          }
        })
        .catch(function () {});
    }

    function obtener(idPost) {
      if (_cache[idPost]) return Promise.resolve(_cache[idPost]);

      var l2 = window.CacheL2.leerPost(idPost);
      if (l2) {
        _cache[idPost] = l2;
        _revalidar(idPost);
        return Promise.resolve(l2);
      }

      return postBackend('postDetalle', { idPost: idPost })
        .then(function (det) {
          _recordar(idPost, det);
          return det;
        })
        .catch(function (err) {
          console.warn('[PostFull] Error al pedir detalle de ' + idPost + ':', err.message);
          throw err;
        });
    }

    /* Una pregunta recién publicada también vive en la caché del
       cliente — cerrar y reabrir el post la sigue mostrando hasta
       que el detalle real (ya invalidado en GAS) la traiga. */
    function anotarPregunta(idPost, pregunta) {
      var det = _cache[idPost];
      if (!det || !pregunta) return;
      var pq = (det.preguntas && typeof det.preguntas === 'object')
        ? det.preguntas : { total: 0, lista: [] };
      pq.lista = (Array.isArray(pq.lista) ? pq.lista : []).slice();
      pq.lista.unshift({
        texto:     String(pregunta.texto || ''),
        fecha:     pregunta.fecha || fechaVenezuela(),
        respuesta: null
      });
      pq.lista = pq.lista.slice(0, 2);
      pq.total = (typeof pq.total === 'number' && isFinite(pq.total))
        ? pq.total + 1 : pq.lista.length;
      det.preguntas = pq;
      window.CacheL2.guardarPost(idPost, det);
    }

    function limpiar() { _cache = {}; }

    return {
      obtener:        obtener,
      anotarPregunta: anotarPregunta,
      limpiar:        limpiar
    };
  })();
