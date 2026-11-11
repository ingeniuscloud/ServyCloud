/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Aviso_Script.html
ESPEJO GITHUB:   github/js/Core_Aviso_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.AvisoRespuesta — el aviso «te respondió».
                 Despierta la clase centralizada .notificacionFlotante
                 (Core_CSS), dormida hasta que ESTE módulo la enciende
                 con .visible.
                 · CUÁNDO SE REVISA: al abrir la app (5 s después de
                 cargar, con la sesión y el catálogo ya en vuelo), en
                 cada entrada a un post (evento post:change de Lista)
                 y cada 60 s mientras la app esté abierta. Throttle
                 propio de 15 s: abrir la app y entrar a un post casi
                 juntos no duplican la llamada.
                 · QUÉ DISPARA EL AVISO: SOLO la respuesta del
                 partner — preguntas de ESTE dispositivo con
                 RESPUESTA en la BD y sin marcar VISTO
                 (respuestasPendientes, 02 Acciones.gs). Nada de
                 tiempo transcurrido, nada de preguntas nuevas.
                 · LA TARJETA ES FIJA (orden del dueño): sin
                 temporizador. Se queda hasta que el dueño de la
                 pregunta actúe: X → marca VISTO y punto (ya perdió
                 su oportunidad); tap en la tarjeta → abre EL post de
                 esa respuesta y marca VISTO. Tras actuar, sale con
                 la animación y recién entonces sube la siguiente
                 pendiente, si la hay — una a la vez, nunca un
                 bloque. Mientras hay tarjeta fija, las revisiones
                 SOLO observan: no apilan nada encima.
                 · VISTO SE MARCA AL ACTUAR (no al mostrar): cerrar
                 la app con la tarjeta fija sin actuar no pierde
                 nada — lo pendiente reavisa en el próximo arranque.
                 · VISTO AL ABRIR EL POST: entrar a un post con
                 pendientes PROPIOS los resuelve en el acto
                 (resolverPorPost): accionMarcarVisto con la LISTA
                 de filas, fuera de la cola (_tratadas) y, si la
                 tarjeta fija era de ese post, se resuelve y sube la
                 siguiente. Abrir OTRO post no toca nada (el filtro
                 es por idPost).
                 · EL TEXTO: nombre del partner (BD, cacheado) +
                 espacio + ROOTJSON.app.avisoRespuesta. CERO
                 constantes de texto aquí: lo que se dice SIEMPRE lo
                 manda el Setup (el dueño lo cambia sin tocar
                 código). Sin nada que decir, no nace tarjeta.
                 · ANTI-CARRERA: lo resuelto en esta sesión
                 (_tratadas) no vuelve, aunque la lectura de la BD
                 corra junto a la marca VISTO de la acción.
                 · TODO SILENCIOSO: si algo falla, la app ni se
                 entera.
VERSIÓN:         1.0
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Global_Script.html (postBackend),
                 Core_CSS.html (.notificacionFlotante),
                 Iconos.html (pintarGlifos), Lista_Script.html
                 (window.Lista.abrirDetalle)
════════════════════════════════════════════════════════════════════*/

  window.AvisoRespuesta = (function () {
    var ARRANQUE_MS    = 5000;        /* primera revisión tras abrir */
    var CADA_MS        = 60 * 1000;   /* revisión de rutina */
    var GAP_MINIMO_MS  = 15 * 1000;   /* anti-ráfaga entre revisiones */
    var PAUSA_ENTRE_MS = 450;         /* salida (.visible 0.28s) + aire */
    var TOPE           = 20;          /* el backend ya topa en 20 */

    var _restantes      = [];         /* pendientes sin tratar (última revisión) */
    var _tratadas       = {};         /* filas resueltas EN ESTA sesión */
    var _enPantalla     = false;      /* hay tarjeta fija esperando acción */
    var _elemento       = null;
    var _lineaTexto     = null;
    var _temporizador   = null;
    var _ultimaRevision = 0;

    /* El texto lo manda el Setup — CERO constantes aquí. */
    function textoBD() {
      try {
        var app = (window.SISTEMA && window.SISTEMA.root &&
                   window.SISTEMA.root.app) || null;
        return app ? String(app.avisoRespuesta || '').trim() : '';
      } catch (_) {
        return '';
      }
    }

    /* La línea del aviso: nombre del partner + texto de la BD.
       Sin nombre queda el texto solo; sin NADA que decir, la
       tarjeta no nace (no inventa texto). */
    function textoDe(item) {
      var nombre = (item && item.partner) ? String(item.partner).trim() : '';
      return (nombre ? nombre + ' ' : '') + textoBD();
    }

    function asegurarElemento() {
      if (_elemento) return _elemento;
      _elemento = document.createElement('div');
      _elemento.className = 'notificacionFlotante';
      _elemento.setAttribute('role', 'status');
      _elemento.setAttribute('aria-live', 'polite');
      _lineaTexto = document.createElement('div');
      _lineaTexto.className = 'textoPrimario';
      _elemento.appendChild(_lineaTexto);
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'avisoCerrar';
      x.setAttribute('aria-label', 'Cerrar aviso');
      x.setAttribute('data-glifo', 'close');
      x.addEventListener('click', function (evento) {
        evento.stopPropagation();   /* la X NO abre el post: solo cierra */
        actuar();
      });
      _elemento.appendChild(x);
      _elemento.addEventListener('click', function () {
        var item = _restantes[0];
        if (item && item.idPost && window.Lista &&
            typeof window.Lista.abrirDetalle === 'function') {
          window.Lista.abrirDetalle(item.idPost);
        }
        actuar();
      });
      document.body.appendChild(_elemento);
      if (typeof window.pintarGlifos === 'function') window.pintarGlifos(_elemento);
      return _elemento;
    }

    function mostrarSiguiente() {
      if (_enPantalla || document.hidden) return;
      var linea = '';
      while (_restantes.length && !linea) {
        linea = textoDe(_restantes[0]);
        if (!linea) _restantes.shift();   /* sin nada que decir: se salta */
      }
      if (!linea) return;
      asegurarElemento();
      _lineaTexto.textContent = linea;
      _enPantalla = true;
      _elemento.classList.add('visible');
    }

    /* ÚNICA salida de la tarjeta: la X o el tap en ella. AMBAS
       marcan VISTO en la BD — la X y punto («ya perdió su
       oportunidad»), el tap porque la respuesta ya se leyó en
       el post. Después sube la siguiente, si la hay. */
    function actuar() {
      if (_temporizador) { clearTimeout(_temporizador); _temporizador = null; }
      var item = _restantes.shift();
      if (item) {
        _tratadas[item.fila] = true;
        if (typeof window.postBackend === 'function') {
          window.postBackend('marcarVisto', { marcas: [{ fila: item.fila }] })
            .catch(function () { /* silencioso: nada depende del eco */ });
        }
      }
      _enPantalla = false;
      if (_elemento) _elemento.classList.remove('visible');
      _temporizador = setTimeout(function () {
        if (!_enPantalla && _restantes.length) mostrarSiguiente();
      }, PAUSA_ENTRE_MS);
    }

    /* VISTO AL ABRIR EL POST · resolverPorPost(idPost): los
       pendientes DEL post que el usuario está abriendo se
       resuelven aquí y ahora (los está leyendo). La marca
       viaja IGUAL que la X: accionMarcarVisto con la lista de
       filas — CERO .gs nuevos. Abrir OTRO post no toca nada:
       el filtro es por idPost. Anti-carrera: _tratadas evita
       el doble marcaje si el tap de la tarjeta ya resolvió el
       ítem antes de que post:change llegue. */
    function resolverPorPost(idPost) {
      if (!idPost) return;
      var mias = [];
      var i;
      for (i = 0; i < _restantes.length; i++) {
        var p = _restantes[i];
        if (p && !_tratadas[p.fila] &&
            String(p.idPost || '') === String(idPost)) {
          mias.push(p);
        }
      }
      if (!mias.length) return;

      for (i = 0; i < mias.length; i++) _tratadas[mias[i].fila] = true;
      _restantes = _restantes.filter(function (p) {
        return !(p && String(p.idPost || '') === String(idPost));
      });

      if (typeof window.postBackend === 'function') {
        var marcas = [];
        for (i = 0; i < mias.length; i++) marcas.push({ fila: mias[i].fila });
        window.postBackend('marcarVisto', { marcas: marcas })
          .catch(function () { /* silencioso: nada depende del eco */ });
      }

      /* ¿la tarjeta fija en pantalla era de ESTE post? Se
         resuelve: sale con la animación y recién entonces
         sube la siguiente, si la hay. */
      if (_enPantalla) {
        if (_temporizador) { clearTimeout(_temporizador); _temporizador = null; }
        _enPantalla = false;
        if (_elemento) _elemento.classList.remove('visible');
        _temporizador = setTimeout(function () {
          if (!_enPantalla && _restantes.length) mostrarSiguiente();
        }, PAUSA_ENTRE_MS);
      }
    }

    function revisar() {
      if (_enPantalla || document.hidden) return;   /* tarjeta fija: solo observa */
      if (typeof window.postBackend !== 'function') return;
      var ahora = Date.now();
      if (ahora - _ultimaRevision < GAP_MINIMO_MS) return;
      _ultimaRevision = ahora;

      window.postBackend('respuestasPendientes', {})
        .then(function (data) {
          if (_enPantalla || document.hidden) return;
          var lista = ((data && data.pendientes) || []).slice(0, TOPE);
          _restantes = lista.filter(function (p) { return p && !_tratadas[p.fila]; });
          if (_restantes.length) mostrarSiguiente();
        })
        .catch(function () { /* silencioso: el aviso no molesta */ });
    }

    setTimeout(revisar, ARRANQUE_MS);
    setInterval(revisar, CADA_MS);
    document.addEventListener('post:change', revisar);
    /* post:change también resuelve: los pendientes del post que
       se abre marcan VISTO al instante (ver resolverPorPost).
       Abrir OTRO post no toca nada. */
    document.addEventListener('post:change', function (e) {
      resolverPorPost(e.detail && e.detail.idPost);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) revisar();
    });

    return { revisar: revisar };
  })();
