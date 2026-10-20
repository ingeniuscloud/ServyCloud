/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Ciudad_Sheet_Script.html
ESPEJO GITHUB:   github/js/Ciudad_Sheet_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo Ciudad. Resuelve la ciudad activa desde
                 localStorage (app_ciudad). Si no existe, abre
                 el sheet en modo BLOQUEADO: el usuario debe
                 seleccionar una ciudad antes de ver cualquier
                 lista. En esa primera carga el sheet muestra
                 PRIMERO el aviso de cookies (key
                 localStorage: app_cookies; el TEXTO llega servido
                 en SISTEMA.avisos.cookies — 03 Constantes.gs —, no
                 vive aquí): hasta pulsar
                 Aceptar no se ve la lista de ciudades, y tras
                 aceptar el aviso desaparece y la selección
                 obligatoria sigue. Pinta el botón .city-bar (en
                 la fila de filtros desde R62) y emite
                 'ciudad:change' cuando cambia.
                 Ordena las ciudades alfabéticamente por título.
                 R65: el sheet pinta el STACK NATIVO que trajo el
                 dueño de referencia — tarjetas apiladas (una por
                 fila): nombre en negrita + badge "Activo"
                 (solo la activa lo muestra) y pills horizontales
                 "N Servicios · N Cursos · N Promos" (la de
                 Promos destacada); al tocar, aplicar + cerrar
                 como siempre. Las métricas siguen calculándose
                 con TABLAS.posts y SISTEMA.promo.
VERSIÓN:         1.8
CAMBIOS:         R67: FIX de métricas — el PROMOJSON real trae
                 porCiudad como OBJETO (idPostActual, el mismo
                 que lee Promo_Script) y metricasDe llamaba
                 forEach sobre él: la excepción congelaba el
                 sheet (aviso de cookies pegado, sin lista de
                 ciudades). Ahora se normaliza el formato (array
                 u objeto) antes de contar.
                 R65: pintarContenido() cambia de MODELO — fuera
                 la rejilla 2 columnas con punto de selección
                 (el dueño lo vio plano); entra el stack
                 vertical: .ciudad-card-top con nombre en
                 negrita + .ciudad-card-badge "Activo"; pills
                 .ciudad-card-metrica (la de Promos con clase
                 .destacada); sin radio, sin punto, sin chevron.
                 R62: las métricas de items ACTIVOS por ciudad —
                 Servicios, Cursos y Promos — se calculan con
                 metricasDe(idCiudad) sobre TABLAS.posts y
                 SISTEMA.promo (mismas reglas de vigencia de la
                 marquesina; cursos manda: un post con chip de
                 curso cuenta como curso, CANON 3) y
                 promoVigente() reutiliza las reglas de fecha.
                 R40: el texto del aviso de cookies ya no vive
                 aquí: llega en SISTEMA.avisos.cookies
                 (03 Constantes.gs, única fuente de los textos);
                 sin texto disponible el aviso muestra solo el
                 icono y Aceptar.
DEPENDENCIAS:    Index.html (SISTEMA, .area-contenido), Iconos.html
                 (pintarGlifos), Ciudad_Sheet_CSS.html
════════════════════════════════════════════════════════════════════*/

  window.Ciudad = (function () {

    var KEY_CIUDAD = 'app_ciudad';
    var KEY_COOKIES = 'app_cookies';

    var UMBRAL_VELOCIDAD = 0.5;
    var UMBRAL_DRAG      = 6;

    /* Estado interno */
    var actual             = null;
    var lista              = [];
    var inicializada       = false;
    var botonEnlazado      = false;
    var pendienteSeleccion = false;

    /* Refs DOM */
    var btnCity   = null;
    var ciudadTxt = null;

    /* Sheet */
    var raiz       = null;
    var backdrop   = null;
    var sheet      = null;
    var handleArea = null;
    var content    = null;
    var abierto    = false;

    /* Drag */
    var dragActivo    = false;
    var dragMoved     = false;
    var dragPointerId = null;
    var dragStartY    = 0;
    var dragUltimoY   = 0;
    var dragUltimoT   = 0;
    var dragVelocidad = 0;

    /* ============================================================
       Helpers
       ============================================================ */
    function haptic(v) {
      if (navigator.vibrate) { try { navigator.vibrate(v); } catch (e) {} }
    }

    function leerStorage() {
      try {
        var raw = localStorage.getItem(KEY_CIUDAD);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object' || !obj.idCiudad) return null;
        return obj;
      } catch (_) { return null; }
    }

    function escribirStorage(obj) {
      try { localStorage.setItem(KEY_CIUDAD, JSON.stringify(obj)); } catch (_) {}
    }

    function ciudadesDisponibles() {
      var arr = (window.SISTEMA && window.SISTEMA.ciudades) || [];
      return arr
        .filter(function (c) {
          return c && c.idCiudad && c.estado !== false;
        })
        .sort(function (a, b) {
          return String(a.titulo || '').localeCompare(
            String(b.titulo || ''), 'es', { sensitivity: 'base' }
          );
        });
    }

    function buscarPorId(id) {
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].idCiudad === id) return lista[i];
      }
      return null;
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
      });
    }

    /* ============================================================
       MÉTRICAS POR CIUDAD (R62) · items ACTIVOS para las
       tarjetas del sheet. Servicios y Cursos se leen de los
       chips del post (cursos manda: si el post lleva chip de
       curso cuenta como curso — CANON 3 —, si no, servicio).
       Promos = posts con promo VIGENTE en esa ciudad (mismas
       reglas de la marquesina: fecha del PROMOJSON + post
       activo).
       ============================================================ */
    function hoyISO() {
      var d = new Date();
      var y = d.getFullYear();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var dd = ('0' + d.getDate()).slice(-2);
      return y + '-' + m + '-' + dd;
    }

    function tipoDePost(post) {
      var chips = (post && post.idChips) || [];
      if (!chips.length) return '';

      var catalogo = (window.SISTEMA && window.SISTEMA.chips) || [];
      var texto = '';

      chips.forEach(function (id) {
        for (var i = 0; i < catalogo.length; i++) {
          if (catalogo[i].idChip === id) {
            texto += ' ' + String(catalogo[i].titulo || '') + ' ' + id;
            break;
          }
        }
      });

      texto = texto.toLowerCase();
      if (texto.indexOf('curso') !== -1) return 'curso';
      if (texto.indexOf('servic') !== -1) return 'servicio';
      return '';
    }

    function promoVigente(item) {
      var hoy = hoyISO();
      if (item.inicia && item.inicia > hoy) return false;
      if (item.termina && item.termina < hoy) return false;
      return true;
    }

    function metricasDe(idCiudad) {
      var posts = (window.TABLAS && window.TABLAS.posts) || [];
      var promo = (window.SISTEMA && window.SISTEMA.promo) || {};
      var raw   = (promo.porCiudad && promo.porCiudad[idCiudad]) || null;
      /* R67 · FIX: el PROMOJSON real de la hoja trae porCiudad
         como OBJETO (idPostActual + proximaRotación, el mismo
         que lee Promo_Script), no como array. Antes se llamaba
         pool.forEach sobre el objeto y la excepción congelaba
         el repintado del sheet (el aviso de cookies quedaba
         pegado). Se normalizan los DOS formatos: array de
         promos o objeto de una promo. */
      var pool  = [];
      if (Array.isArray(raw)) {
        pool = raw;
      } else if (raw) {
        pool = [raw];
      }

      var promos = {};
      pool.forEach(function (item) {
        if (!item) return;
        var idPost = item.idPost || item.idPostActual;
        if (!idPost) return;
        if (!promoVigente(item)) return;
        promos[idPost] = 1;
      });

      var m = { servicios: 0, cursos: 0, promos: 0 };

      posts.forEach(function (p) {
        if (!p || !p.id) return;
        if (p.estado !== 'activo') return;

        var ciudades = p.idCiudad || [];
        if (ciudades.indexOf(idCiudad) === -1) return;

        var tipo = tipoDePost(p);
        if (tipo === 'curso') m.cursos++;
        else if (tipo === 'servicio') m.servicios++;

        if (promos[p.id]) m.promos++;
      });

      return m;
    }

    /* ============================================================
       Pintar botón
       ============================================================ */
    function pintarBoton() {
      if (!btnCity || !ciudadTxt) return;

      if (!actual) {
        btnCity.disabled = true;
        ciudadTxt.textContent = '—';
        return;
      }

      ciudadTxt.textContent = actual.titulo;
      btnCity.setAttribute('aria-label', 'Cambiar ciudad. Actual: ' + actual.titulo);

      var enDetalle = document.body.classList.contains('modo-detalle');
      btnCity.disabled = enDetalle;
    }

    /* ============================================================
       Aplicar ciudad · guarda, pinta, emite ciudad:change
       ============================================================ */
    function aplicar(ciudad) {
      if (!ciudad) return;

      actual = {
        idCiudad: ciudad.idCiudad,
        titulo:   ciudad.titulo
      };
      escribirStorage(actual);
      pendienteSeleccion = false;
      pintarBoton();

      document.dispatchEvent(new CustomEvent('ciudad:change', {
        detail: {
          idCiudad: actual.idCiudad,
          titulo:   actual.titulo
        }
      }));
    }

    /* ============================================================
       Arranque · resolución inicial
       ============================================================ */
    function iniciar() {
      if (inicializada) return;
      inicializada = true;

      lista = ciudadesDisponibles();

      if (!lista.length) {
        console.warn('[Ciudad] SISTEMA.ciudades vacío');
        return;
      }

      var guardada = leerStorage();
      if (guardada) {
        var c = buscarPorId(guardada.idCiudad);
        if (c) {
          actual = { idCiudad: c.idCiudad, titulo: c.titulo };
          pendienteSeleccion = false;
          return;
        }
      }

      /* Sin ciudad guardada → selección obligatoria */
      pendienteSeleccion = true;
    }

    /* R26: reconstruye el estado con el SISTEMA ya presente.
       Re-ejecutar iniciar() es seguro: solo fija estado (lista,
       actual, pendienteSeleccion); los listeners y el DOM del
       sheet se crean aparte y tienen sus propias guardias. */
    function reinicializar() {
      inicializada = false;
      actual = null;
      pendienteSeleccion = false;
      iniciar();
    }

    /* ============================================================
       Cookies · aviso de UNA SOLA VEZ en la primera carga.
       El sheet obligatorio muestra el aviso y NO deja ver la
       lista de ciudades hasta pulsar Aceptar: así el aviso se
       acepta sin opción de continuar sin hacerlo (petición del
       dueño). El flag vive en localStorage (app_cookies).
       ============================================================ */
    function cookiesAceptadas() {
      try { return localStorage.getItem(KEY_COOKIES) === '1'; }
      catch (_) { return false; }
    }

    function pintarCookies() {
      if (!content) return;

      /* Texto servido en SISTEMA.avisos (03 Constantes.gs). Sin
         texto (backend viejo o sin avisos) el aviso sigue
         funcionando: icono + Aceptar, sin párrafo. */
      var texto = '';
      try {
        texto = String((window.SISTEMA && window.SISTEMA.avisos &&
                window.SISTEMA.avisos.cookies) || '').trim();
      } catch (_) {}

      content.innerHTML =
        '<div class="ciudad-cookies">' +
          '<div class="cookies-fila">' +
            '<span class="cookies-icono" data-glifo="cookie" aria-hidden="true"></span>' +
            (texto ? '<p class="cookies-texto">' + texto + '</p>' : '') +
          '</div>' +
          '<button class="cookies-aceptar" type="button">Aceptar</button>' +
        '</div>';

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(content);
      }

      content.querySelector('.cookies-aceptar').addEventListener('click', aceptarCookies);
    }

    function aceptarCookies() {
      haptic(10);
      try { localStorage.setItem(KEY_COOKIES, '1'); } catch (_) {}
      pintarContenido();
    }

    /* ============================================================
       Enganchar botón · llamado por Core tras inyectar lienzo
       ============================================================ */
    function engancharBoton() {
      btnCity   = document.getElementById('btnCiudad');
      ciudadTxt = document.getElementById('ciudadTxt');
      if (!btnCity) return;

      botonEnlazado = true;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(btnCity);
      }

      initDelegacionBoton();

      var observer = new MutationObserver(pintarBoton);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });

      pintarBoton();
    }

    function initDelegacionBoton() {
      if (document.__ciudadDelegado === '1') return;
      document.__ciudadDelegado = '1';

      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('#btnCiudad');
        if (!btn) return;
        e.preventDefault();
        if (btn.disabled) return;
        if (abierto) cerrar();
        else abrir(false);
      });
    }

    /* ============================================================
       Sheet · construir DOM
       ============================================================ */
    function construirDOM() {
      if (raiz) return;
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      raiz = document.createElement('div');
      raiz.className = 'ciudad-root';
      raiz.innerHTML =
        '<div class="ciudad-backdrop"></div>' +
        '<div class="ciudad-sheet">' +
          '<div class="ciudad-handle-area"><div class="ciudad-handle"></div></div>' +
          '<button class="ciudad-close" type="button" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
          '<div class="ciudad-content"></div>' +
        '</div>';

      area.appendChild(raiz);

      backdrop   = raiz.querySelector('.ciudad-backdrop');
      sheet      = raiz.querySelector('.ciudad-sheet');
      handleArea = raiz.querySelector('.ciudad-handle-area');
      content    = raiz.querySelector('.ciudad-content');

      backdrop.addEventListener('click', onBackdropClick);
      raiz.querySelector('.ciudad-close').addEventListener('click', cerrar);
      handleArea.addEventListener('pointerdown', onDragDown);
    }

    function onBackdropClick() {
      if (pendienteSeleccion) return;   /* bloqueado: no cierra */
      cerrar();
    }

    /* ============================================================
       TARJETAS DE CIUDADES (R65) · STACK NATIVO (modelo del dueño)
       Una tarjeta POR FILA, apiladas: nombre en negrita con el
       badge "Activo" a la derecha (SOLO la activa lo muestra)
       y, debajo, las tres métricas en pills horizontales — la
       de PROMOS con la clase .destacada. Al tocar, el MISMO
       camino de siempre: haptic + aplicar + cerrar.
       ============================================================ */
    function pintarContenido() {
      if (!content) return;

      var html = '<h2 class="ciudad-titulo">Selecciona tu ciudad</h2>';
      html += '<div class="ciudad-tarjetas">';

      lista.forEach(function (c) {
        var esActual = actual && actual.idCiudad === c.idCiudad;
        var m = metricasDe(c.idCiudad);

        html +=
          '<button type="button" class="ciudad-card' +
            (esActual ? ' activa' : '') + '" data-ciudad="' +
            escapeHtml(c.idCiudad) + '" aria-pressed="' +
            (esActual ? 'true' : 'false') + '">' +
            '<span class="ciudad-card-top">' +
              '<span class="ciudad-card-nombre">' + escapeHtml(c.titulo) + '</span>' +
              '<span class="ciudad-card-badge" aria-hidden="true">Activo</span>' +
            '</span>' +
            '<span class="ciudad-card-metricas">' +
              '<span class="ciudad-card-metrica">' +
                '<span class="ciudad-card-num">' + m.servicios + '</span>' +
                '<span class="ciudad-card-etiqueta">Servicios</span>' +
              '</span>' +
              '<span class="ciudad-card-metrica">' +
                '<span class="ciudad-card-num">' + m.cursos + '</span>' +
                '<span class="ciudad-card-etiqueta">Cursos</span>' +
              '</span>' +
              '<span class="ciudad-card-metrica destacada">' +
                '<span class="ciudad-card-num">' + m.promos + '</span>' +
                '<span class="ciudad-card-etiqueta">Promos</span>' +
              '</span>' +
            '</span>' +
          '</button>';
      });

      html += '</div>';
      content.innerHTML = html;

      content.querySelectorAll('.ciudad-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var c = buscarPorId(this.getAttribute('data-ciudad'));
          if (!c) return;
          haptic(10);
          aplicar(c);
          pendienteSeleccion = false;
          cerrar();
        });
      });
    }

    /* ============================================================
       Sheet · abrir/cerrar
       obligatorio=true → modo bloqueado
       ============================================================ */
    function abrir(obligatorio) {
      if (abierto) return;
      if (!lista.length) return;
      if (!obligatorio && btnCity && btnCity.disabled) return;

      construirDOM();
      if (!raiz) return;

      /* Primera carga: el aviso de cookies va ANTES de la lista
         (no se puede continuar sin aceptar). Con cookies ya
         aceptadas, directo a las ciudades. */
      if (obligatorio && !cookiesAceptadas()) pintarCookies();
      else                                     pintarContenido();
      haptic(10);

      if (obligatorio) raiz.classList.add('bloqueado');
      else             raiz.classList.remove('bloqueado');

      sheet.classList.add('sin-transicion');
      sheet.style.transform = 'translateY(100%)';
      raiz.classList.add('abierto');
      sheet.classList.add('abierto');

      void sheet.offsetHeight;
      sheet.classList.remove('sin-transicion');

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sheet.style.transform = 'translateY(0)';
          backdrop.classList.add('visible');
          abierto = true;
        });
      });
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;

      backdrop.classList.remove('visible');
      sheet.style.transform = 'translateY(100%)';

      setTimeout(function () {
        if (!abierto) {
          sheet.classList.remove('abierto');
          raiz.classList.remove('abierto');
          raiz.classList.remove('bloqueado');
        }
      }, 420);
    }

    /* ============================================================
       Drag · solo cuando NO está bloqueado
       ============================================================ */
    function onDragDown(e) {
      if (!abierto) return;
      if (pendienteSeleccion) return;
      if (e.button !== undefined && e.button !== 0) return;

      dragActivo = true;
      dragMoved = false;
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragUltimoY = e.clientY;
      dragUltimoT = performance.now();
      dragVelocidad = 0;

      handleArea.addEventListener('pointermove', onDragMove);
      handleArea.addEventListener('pointerup', onDragEnd);
      handleArea.addEventListener('pointercancel', onDragEnd);
    }

    function onDragMove(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;

      var dy = e.clientY - dragStartY;

      if (!dragMoved) {
        if (Math.abs(dy) < UMBRAL_DRAG) return;
        dragMoved = true;
        sheet.classList.add('sin-transicion');
        try { handleArea.setPointerCapture(e.pointerId); } catch (err) {}
      }

      var altura = sheet.offsetHeight;
      var pct = (dy / altura) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      e.preventDefault();
      sheet.style.transform = 'translateY(' + pct + '%)';

      var ahora = performance.now();
      var dt = ahora - dragUltimoT;
      if (dt > 0) {
        var v = (e.clientY - dragUltimoY) / dt;
        dragVelocidad = dragVelocidad * 0.7 + v * 0.3;
        dragUltimoY = e.clientY;
        dragUltimoT = ahora;
      }
    }

    function onDragEnd(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;
      dragActivo = false;
      dragPointerId = null;

      if (!dragMoved) { limpiarDrag(); return; }
      dragMoved = false;
      sheet.classList.remove('sin-transicion');

      var t = sheet.style.transform || '';
      var m = t.match(/translateY\(([\d.]+)%\)/);
      var pct = m ? parseFloat(m[1]) : 0;

      if ((dragVelocidad > UMBRAL_VELOCIDAD) || (pct > 30)) cerrar();
      else sheet.style.transform = 'translateY(0)';

      limpiarDrag();
    }

    function limpiarDrag() {
      handleArea.removeEventListener('pointermove', onDragMove);
      handleArea.removeEventListener('pointerup', onDragEnd);
      handleArea.removeEventListener('pointercancel', onDragEnd);
    }

    /* ============================================================
       Arranque del módulo
       ============================================================ */
    iniciar();

    /* ============================================================
       API pública
       ============================================================ */
    return {
      getActual:          function () { return actual; },
      getLista:           function () { return lista.slice(); },
      hayPendiente:       function () { return pendienteSeleccion === true; },
      engancharBoton:     engancharBoton,
      abrirObligatorio:   function () { abrir(true); },
      abrir:              function () { abrir(false); },
      cerrar:             cerrar,
      aplicarGuardada:    aplicar,
      reinicializar:      reinicializar
    };

  })();